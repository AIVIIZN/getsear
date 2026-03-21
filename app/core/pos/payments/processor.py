"""
PaymentProcessor — unified facade over ValorAPIClient + ValorConnectClient.

Routes card-present operations to ValorConnect (terminal) and card-not-present
or server-side operations to ValorAPI (REST). Records every transaction to the
payment_transactions table. Provides full audit logging.

All amounts are INTEGER CENTS.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog

from app.core.pos.payments.valor import (
    AuthorizationResult,
    BatchResult,
    CaptureResult,
    ReaderDevice,
    RefundResult,
    TransactionStatus,
    VoidResult,
)
from app.core.pos.payments.valor_api import ValorAPIClient
from app.core.pos.payments.valor_connect import ValorConnectClient
from app.shared.audit import log_audit

log = structlog.get_logger(__name__)


def _utcnow() -> str:
    """ISO 8601 timestamp in UTC for database storage."""
    return datetime.now(timezone.utc).isoformat()


class PaymentProcessor:
    """
    Unified payment facade. Delegates to ValorConnect for card-present
    terminal interactions and ValorAPI for server-side operations (capture,
    void, refund, batch settlement).

    Every operation is recorded to payment_transactions via Supabase and
    audit-logged for PCI compliance.
    """

    def __init__(
        self,
        api_client: ValorAPIClient,
        connect_client: ValorConnectClient,
        restaurant_id: str,
    ):
        self._api = api_client
        self._connect = connect_client
        self._restaurant_id = restaurant_id

    @classmethod
    def from_config(cls, config: dict, restaurant_id: str) -> PaymentProcessor:
        """Build the full processor stack from Flask app config."""
        api_client = ValorAPIClient.from_config(config)
        connect_client = ValorConnectClient.from_config(config)
        return cls(api_client, connect_client, restaurant_id)

    # ── Supabase helpers ─────────────────────────────────────────────

    @staticmethod
    def _get_supabase():
        """Lazy import to avoid circular imports during app init."""
        from app.extensions import supabase_client
        return supabase_client

    def _record_transaction(self, row: dict) -> str:
        """Insert a payment_transactions row. Returns the row ID."""
        row.setdefault("id", str(uuid.uuid4()))
        row.setdefault("restaurant_id", self._restaurant_id)
        row.setdefault("processor_name", "valor")
        row.setdefault("created_at", _utcnow())
        row.setdefault("updated_at", _utcnow())

        try:
            db = self._get_supabase()
            if db:
                db.table("payment_transactions").insert(row).execute()
                log.info(
                    "payment.transaction_recorded",
                    txn_id=row["id"],
                    status=row.get("status"),
                )
            else:
                log.warning("payment.no_supabase", txn_id=row["id"])
        except Exception:
            log.exception("payment.record_failed", txn_id=row["id"])

        return row["id"]

    def _update_transaction(self, txn_id: str, updates: dict) -> None:
        """Update fields on an existing payment_transactions row."""
        updates["updated_at"] = _utcnow()
        try:
            db = self._get_supabase()
            if db:
                db.table("payment_transactions").update(updates).eq("id", txn_id).execute()
                log.info("payment.transaction_updated", txn_id=txn_id, fields=list(updates.keys()))
        except Exception:
            log.exception("payment.update_failed", txn_id=txn_id)

    def _find_transaction(self, processor_txn_id: str) -> dict | None:
        """Look up a transaction by Valor's processor_transaction_id."""
        try:
            db = self._get_supabase()
            if db:
                result = (
                    db.table("payment_transactions")
                    .select("*")
                    .eq("processor_transaction_id", processor_txn_id)
                    .eq("restaurant_id", self._restaurant_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return result.data[0]
        except Exception:
            log.exception("payment.lookup_failed", processor_txn_id=processor_txn_id)
        return None

    # ── Audit helper ─────────────────────────────────────────────────

    def _audit(
        self,
        action: str,
        entity_id: str,
        description: str,
        new_state: dict | None = None,
        previous_state: dict | None = None,
    ) -> None:
        """Fire an audit log entry for payment operations."""
        log_audit(
            org_id=self._restaurant_id,
            action=action,
            entity_type="payment_transaction",
            entity_id=entity_id,
            description=description,
            new_state=new_state,
            previous_state=previous_state,
        )

    # ── Authorization ────────────────────────────────────────────────

    def authorize(
        self,
        amount_cents: int,
        order_id: str,
        check_id: str,
        *,
        terminal_id: str | None = None,
        token: str | None = None,
        capture: bool = False,
        server_id: str | None = None,
        metadata: dict | None = None,
    ) -> AuthorizationResult:
        """
        Authorize a payment. Routes to terminal (card-present) or API (token).

        terminal_id -> card-present via ValorConnect (customer taps/inserts)
        token       -> card-not-present via ValorAPI (saved card, online order)
        capture     -> True = sale (auth+capture), False = auth only (tip later)
        """
        if not terminal_id and not token:
            return AuthorizationResult(
                success=False,
                transaction_id="",
                auth_code="",
                amount_cents=amount_cents,
                error_message="Either terminal_id or token is required",
            )

        # Card-present: route through ValorConnect (terminal)
        if terminal_id:
            auth_result = self._connect.authorize(
                terminal_serial=terminal_id,
                amount_cents=amount_cents,
                order_id=order_id,
                capture=capture,
            )
        else:
            # Card-not-present: route through ValorAPI with token
            if capture:
                auth_result = self._api.direct_sale(
                    amount_cents=amount_cents,
                    terminal_id=token or "",
                    order_id=order_id,
                )
            else:
                auth_result = self._api.auth_only(
                    amount_cents=amount_cents,
                    terminal_id=token or "",
                    order_id=order_id,
                )

        # Determine status for DB record
        if auth_result.success:
            status = TransactionStatus.CAPTURED.value if capture else TransactionStatus.AUTHORIZED.value
        else:
            status = TransactionStatus.DECLINED.value

        # Build card-related fields (never store full PAN)
        card_info = auth_result.card_info
        card_fields: dict = {}
        if card_info:
            card_fields = {
                "card_brand": card_info.brand.value,
                "card_last_four": card_info.last_four,
                "card_entry_mode": card_info.entry_mode.value,
                "card_token": card_info.token,
                "is_debit": card_info.is_debit,
                "payment_method": (
                    "debit_card" if card_info.is_debit else "credit_card"
                ),
            }

        # Record to payment_transactions
        txn_id = str(uuid.uuid4())
        row = {
            "id": txn_id,
            "order_id": order_id,
            "check_id": check_id,
            "processor_transaction_id": auth_result.transaction_id,
            "authorization_code": auth_result.auth_code,
            "authorized_amount_cents": auth_result.amount_cents,
            "captured_amount_cents": auth_result.amount_cents if capture else None,
            "tip_amount_cents": 0,
            "surcharge_amount_cents": 0,
            "refunded_amount_cents": 0,
            "status": status,
            "authorized_at": _utcnow() if auth_result.success else None,
            "captured_at": _utcnow() if capture and auth_result.success else None,
            "server_id": server_id,
            "device_id": terminal_id,
            "processor_raw_response": auth_result.processor_response,
            "metadata": metadata or {},
            **card_fields,
        }
        self._record_transaction(row)

        # Audit log
        self._audit(
            action="payment.authorize" if not capture else "payment.sale",
            entity_id=txn_id,
            description=(
                f"{'Sale' if capture else 'Auth'} for {amount_cents}c on order {order_id}"
                f" — {'approved' if auth_result.success else 'declined'}"
            ),
            new_state={"status": status, "amount_cents": amount_cents},
        )

        log.info(
            "payment.authorized",
            txn_id=txn_id,
            processor_txn_id=auth_result.transaction_id,
            amount_cents=amount_cents,
            capture=capture,
            success=auth_result.success,
        )

        return auth_result

    # ── Capture ──────────────────────────────────────────────────────

    def capture(
        self,
        transaction_id: str,
        amount_cents: int,
        tip_cents: int = 0,
    ) -> CaptureResult:
        """
        Capture a previously authorized transaction with optional tip.

        The transaction_id here is Valor's processor transaction ID.
        Capture always goes through the REST API (not the terminal).
        """
        result = self._api.capture_with_tip(
            transaction_id=transaction_id,
            tip_cents=tip_cents,
        )

        # Update our DB record
        existing = self._find_transaction(transaction_id)
        if existing:
            total_captured = amount_cents + tip_cents
            self._update_transaction(existing["id"], {
                "status": TransactionStatus.CAPTURED.value,
                "captured_amount_cents": total_captured,
                "tip_amount_cents": tip_cents,
                "captured_at": _utcnow(),
            })
            self._audit(
                action="payment.capture",
                entity_id=existing["id"],
                description=(
                    f"Captured {amount_cents}c + {tip_cents}c tip"
                    f" (total {amount_cents + tip_cents}c)"
                ),
                previous_state={"status": existing.get("status")},
                new_state={
                    "status": TransactionStatus.CAPTURED.value,
                    "captured_amount_cents": total_captured,
                    "tip_amount_cents": tip_cents,
                },
            )

        log.info(
            "payment.captured",
            processor_txn_id=transaction_id,
            amount_cents=amount_cents,
            tip_cents=tip_cents,
            success=result.success,
        )

        return result

    # ── Void ─────────────────────────────────────────────────────────

    def void(self, transaction_id: str) -> VoidResult:
        """Void an authorized or captured transaction before settlement."""
        result = self._api.void_transaction(transaction_id)

        existing = self._find_transaction(transaction_id)
        if existing:
            self._update_transaction(existing["id"], {
                "status": TransactionStatus.VOIDED.value,
                "voided_at": _utcnow(),
            })
            self._audit(
                action="payment.void",
                entity_id=existing["id"],
                description=f"Voided transaction {transaction_id}",
                previous_state={"status": existing.get("status")},
                new_state={"status": TransactionStatus.VOIDED.value},
            )

        log.info(
            "payment.voided",
            processor_txn_id=transaction_id,
            success=result.success,
        )

        return result

    # ── Refund ───────────────────────────────────────────────────────

    def refund(
        self,
        transaction_id: str,
        amount_cents: int | None = None,
    ) -> RefundResult:
        """
        Refund a settled transaction.

        amount_cents=None -> full refund
        amount_cents=int  -> partial refund
        """
        result = self._api.refund_transaction(transaction_id, amount_cents)

        existing = self._find_transaction(transaction_id)
        if existing:
            prev_refunded = existing.get("refunded_amount_cents", 0) or 0
            actual_refund = result.refund_amount_cents
            new_refunded = prev_refunded + actual_refund
            captured = existing.get("captured_amount_cents", 0) or 0

            if new_refunded >= captured:
                new_status = TransactionStatus.REFUNDED.value
            else:
                new_status = TransactionStatus.PARTIALLY_REFUNDED.value

            self._update_transaction(existing["id"], {
                "status": new_status,
                "refunded_amount_cents": new_refunded,
            })
            self._audit(
                action="payment.refund",
                entity_id=existing["id"],
                description=(
                    f"Refunded {actual_refund}c"
                    f" ({'full' if amount_cents is None else 'partial'})"
                    f" on transaction {transaction_id}"
                ),
                previous_state={
                    "status": existing.get("status"),
                    "refunded_amount_cents": prev_refunded,
                },
                new_state={
                    "status": new_status,
                    "refunded_amount_cents": new_refunded,
                },
            )

        log.info(
            "payment.refunded",
            processor_txn_id=transaction_id,
            amount_cents=amount_cents,
            success=result.success,
        )

        return result

    # ── Tip Adjust ───────────────────────────────────────────────────

    def adjust_tip(
        self,
        transaction_id: str,
        tip_cents: int,
    ) -> CaptureResult:
        """Adjust tip on a captured-but-unsettled transaction."""
        result = self._api.tip_adjust(transaction_id, tip_cents)

        existing = self._find_transaction(transaction_id)
        if existing:
            old_tip = existing.get("tip_amount_cents", 0) or 0
            self._update_transaction(existing["id"], {
                "tip_amount_cents": tip_cents,
                "captured_amount_cents": result.captured_amount_cents or existing.get("captured_amount_cents"),
            })
            self._audit(
                action="payment.tip_adjust",
                entity_id=existing["id"],
                description=f"Tip adjusted from {old_tip}c to {tip_cents}c",
                previous_state={"tip_amount_cents": old_tip},
                new_state={"tip_amount_cents": tip_cents},
            )

        log.info(
            "payment.tip_adjusted",
            processor_txn_id=transaction_id,
            tip_cents=tip_cents,
            success=result.success,
        )

        return result

    # ── Incremental Auth ─────────────────────────────────────────────

    def incremental_auth(
        self,
        transaction_id: str,
        additional_cents: int,
    ) -> AuthorizationResult:
        """
        Increase an existing authorization (bar tabs exceeding initial hold).
        """
        result = self._api.incremental_auth(transaction_id, additional_cents)

        existing = self._find_transaction(transaction_id)
        if existing:
            old_amount = existing.get("authorized_amount_cents", 0) or 0
            new_amount = old_amount + additional_cents
            self._update_transaction(existing["id"], {
                "authorized_amount_cents": new_amount,
            })
            self._audit(
                action="payment.incremental_auth",
                entity_id=existing["id"],
                description=(
                    f"Incremental auth +{additional_cents}c"
                    f" (was {old_amount}c, now {new_amount}c)"
                ),
                previous_state={"authorized_amount_cents": old_amount},
                new_state={"authorized_amount_cents": new_amount},
            )

        log.info(
            "payment.incremental_auth",
            processor_txn_id=transaction_id,
            additional_cents=additional_cents,
            success=result.success,
        )

        return result

    # ── Batch Settlement ─────────────────────────────────────────────

    def close_batch(self) -> BatchResult:
        """Close the current batch and initiate settlement."""
        result = self._api.settle_batch()

        self._audit(
            action="payment.batch_close",
            entity_id=result.batch_id,
            description=(
                f"Batch {result.batch_id} closed:"
                f" {result.transaction_count} txns,"
                f" total {result.total_amount_cents}c,"
                f" net {result.net_amount_cents}c"
            ),
            new_state={
                "batch_id": result.batch_id,
                "transaction_count": result.transaction_count,
                "total_amount_cents": result.total_amount_cents,
            },
        )

        log.info(
            "payment.batch_closed",
            batch_id=result.batch_id,
            transaction_count=result.transaction_count,
            total_amount_cents=result.total_amount_cents,
            success=result.success,
        )

        return result

    # ── Reader Management ────────────────────────────────────────────

    def get_reader_status(self, terminal_serial: str) -> ReaderDevice:
        """Get current status of a connected Valor terminal."""
        return self._connect.get_reader_status(terminal_serial)

    def discover_readers(self) -> list[ReaderDevice]:
        """Discover available Valor terminals."""
        return self._connect.discover_readers()
