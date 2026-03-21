"""Standard card and token payment flow for Sear POS.

Handles auth-only, auth+capture, and token-based payments.
All amounts in INTEGER CENTS. No floats for money, ever.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import structlog

from app.core.pos.payments.processor import PaymentProcessor
from app.core.pos.payments.valor import TransactionStatus
from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)


class StandardPaymentFlow:
    """Process card payments via terminal tap/dip/swipe or saved token."""

    def __init__(self, processor: PaymentProcessor) -> None:
        self.processor = processor

    def process_card_payment(
        self,
        order_id: str,
        terminal_id: str,
        tip_cents: int = 0,
        capture_immediately: bool = True,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Authorize (and optionally capture) a card payment via terminal.

        Flow: validate order -> check balance_due -> authorize ->
              (optionally capture) -> record payment -> update order -> emit event
        """
        order = self._get_order(order_id, org_id)
        if not order:
            return {"success": False, "error": "Order not found"}

        balance_due_cents = order["balance_due_cents"]
        if balance_due_cents <= 0:
            return {"success": False, "error": "Order already fully paid"}

        total_cents = balance_due_cents + tip_cents

        auth_result = self.processor.authorize(
            amount_cents=balance_due_cents,
            tip_cents=tip_cents,
            terminal_id=terminal_id,
            order_id=order_id,
            capture=capture_immediately,
        )

        if not auth_result.success:
            log.warning(
                "payment.card_declined",
                order_id=order_id,
                decline_code=auth_result.decline_code,
                decline_reason=auth_result.decline_reason,
            )
            return {
                "success": False,
                "error": "Card declined",
                "decline_code": auth_result.decline_code,
                "decline_reason": auth_result.decline_reason,
            }

        payment_id = str(uuid4())
        status = (
            TransactionStatus.CAPTURED.value
            if capture_immediately
            else TransactionStatus.AUTHORIZED.value
        )

        payment_record = {
            "id": payment_id,
            "org_id": org_id,
            "order_id": order_id,
            "payment_method": "card",
            "status": status,
            "amount_cents": balance_due_cents,
            "tip_cents": tip_cents,
            "total_cents": total_cents,
            "processor_transaction_id": auth_result.transaction_id,
            "auth_code": auth_result.auth_code,
            "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
            "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
            "card_entry_mode": auth_result.card_info.entry_mode.value if auth_result.card_info else None,
            "card_token": auth_result.card_info.token if auth_result.card_info else None,
            "terminal_id": terminal_id,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self._insert_payment(payment_record)
        self._log_transaction(payment_id, org_id, order_id, "authorize" if not capture_immediately else "capture", total_cents, user_id)

        if capture_immediately:
            new_balance = balance_due_cents - balance_due_cents  # fully paid
            self._update_order_balance(order_id, org_id, new_balance)

            if new_balance <= 0:
                self._close_order(order_id, org_id)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.processed",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Card payment ${total_cents / 100:.2f} on order {order_id}",
            new_state={"amount_cents": total_cents, "method": "card", "status": status},
        )

        event_bus.emit("payment.processed", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "method": "card",
            "amount_cents": total_cents,
            "tip_cents": tip_cents,
            "status": status,
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "status": status,
            "amount_cents": balance_due_cents,
            "tip_cents": tip_cents,
            "total_cents": total_cents,
            "auth_code": auth_result.auth_code,
            "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
            "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
        }

    def process_token_payment(
        self,
        order_id: str,
        token: str,
        amount_cents: int,
        tip_cents: int = 0,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Process payment using a saved card token (online orders, saved cards)."""
        order = self._get_order(order_id, org_id)
        if not order:
            return {"success": False, "error": "Order not found"}

        balance_due_cents = order["balance_due_cents"]
        if balance_due_cents <= 0:
            return {"success": False, "error": "Order already fully paid"}

        charge_cents = min(amount_cents, balance_due_cents)
        total_cents = charge_cents + tip_cents

        auth_result = self.processor.authorize_token(
            token=token,
            amount_cents=charge_cents,
            tip_cents=tip_cents,
            order_id=order_id,
        )

        if not auth_result.success:
            log.warning(
                "payment.token_declined",
                order_id=order_id,
                decline_code=auth_result.decline_code,
            )
            return {
                "success": False,
                "error": "Card declined",
                "decline_code": auth_result.decline_code,
                "decline_reason": auth_result.decline_reason,
            }

        payment_id = str(uuid4())

        payment_record = {
            "id": payment_id,
            "org_id": org_id,
            "order_id": order_id,
            "payment_method": "card",
            "status": TransactionStatus.CAPTURED.value,
            "amount_cents": charge_cents,
            "tip_cents": tip_cents,
            "total_cents": total_cents,
            "processor_transaction_id": auth_result.transaction_id,
            "auth_code": auth_result.auth_code,
            "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
            "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
            "card_entry_mode": "token",
            "card_token": token,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self._insert_payment(payment_record)
        self._log_transaction(payment_id, org_id, order_id, "capture", total_cents, user_id)

        new_balance = balance_due_cents - charge_cents
        self._update_order_balance(order_id, org_id, new_balance)

        if new_balance <= 0:
            self._close_order(order_id, org_id)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.processed",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Token payment ${total_cents / 100:.2f} on order {order_id}",
            new_state={"amount_cents": total_cents, "method": "card_token", "status": "captured"},
        )

        event_bus.emit("payment.processed", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "method": "card_token",
            "amount_cents": total_cents,
            "tip_cents": tip_cents,
            "status": "captured",
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "status": "captured",
            "amount_cents": charge_cents,
            "tip_cents": tip_cents,
            "total_cents": total_cents,
            "auth_code": auth_result.auth_code,
            "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
            "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
        }

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    def _get_order(self, order_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("orders")
                .select("id, org_id, status, subtotal_cents, tax_cents, total_cents, balance_due_cents")
                .eq("id", order_id)
                .eq("org_id", org_id)
                .single()
                .execute()
            )
            return resp.data
        except Exception:
            log.exception("payment.get_order_failed", order_id=order_id)
            return None

    def _insert_payment(self, record: dict) -> None:
        try:
            supabase_client.table("payments").insert(record).execute()
        except Exception:
            log.exception("payment.insert_failed", payment_id=record.get("id"))
            raise

    def _log_transaction(
        self,
        payment_id: str,
        org_id: str,
        order_id: str,
        action: str,
        amount_cents: int,
        user_id: str,
    ) -> None:
        try:
            supabase_client.table("payment_transactions").insert({
                "id": str(uuid4()),
                "payment_id": payment_id,
                "org_id": org_id,
                "order_id": order_id,
                "action": action,
                "amount_cents": amount_cents,
                "performed_by": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            log.exception("payment.log_transaction_failed", payment_id=payment_id)

    def _update_order_balance(self, order_id: str, org_id: str, new_balance_cents: int) -> None:
        try:
            supabase_client.table("orders").update({
                "balance_due_cents": max(new_balance_cents, 0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("payment.update_balance_failed", order_id=order_id)

    def _close_order(self, order_id: str, org_id: str) -> None:
        try:
            now = datetime.now(timezone.utc).isoformat()
            supabase_client.table("orders").update({
                "status": "closed",
                "closed_at": now,
                "updated_at": now,
            }).eq("id", order_id).eq("org_id", org_id).execute()

            event_bus.emit("order.closed", {
                "order_id": order_id,
                "org_id": org_id,
                "reason": "fully_paid",
            })

            # Update table status if order has a table
            self._update_table_on_close(order_id, org_id)
        except Exception:
            log.exception("payment.close_order_failed", order_id=order_id)

    def _update_table_on_close(self, order_id: str, org_id: str) -> None:
        """Set the table to dirty when its order is fully paid."""
        try:
            table_resp = (
                supabase_client.table("tables")
                .select("id, name, location_id")
                .eq("current_order_id", order_id)
                .eq("org_id", org_id)
                .execute()
            )
            for table in table_resp.data or []:
                supabase_client.table("tables").update({
                    "status": "dirty",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", table["id"]).eq("org_id", org_id).execute()

                event_bus.emit("table.cleared", {
                    "org_id": org_id,
                    "location_id": table.get("location_id"),
                    "table_id": table["id"],
                    "table_name": table.get("name"),
                    "reason": "order_paid",
                })
        except Exception:
            log.exception("payment.table_update_on_close_failed", order_id=order_id)
