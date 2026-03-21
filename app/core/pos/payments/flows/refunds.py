"""Refund and void flow for Sear POS.

Handles pre-settlement voids, post-settlement refunds (full/partial),
and unlinked refunds to different cards. All amounts in INTEGER CENTS.
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


class RefundManager:
    """Handle voids, full refunds, partial refunds, and unlinked refunds."""

    MANAGER_THRESHOLD_CENTS = 5000  # $50 -- require manager for amounts above this
    MAX_REFUND_DAYS = 120

    def __init__(self, processor: PaymentProcessor) -> None:
        self.processor = processor

    def void_transaction(
        self,
        payment_id: str,
        reason: str,
        approved_by: str | None = None,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Void a payment BEFORE batch settlement.

        Releases the hold immediately. No interchange cost.
        Requires manager approval for amounts > $50.
        """
        payment = self._get_payment(payment_id, org_id)
        if not payment:
            return {"success": False, "error": "Payment not found"}

        if payment["status"] in ("settled", "refunded", "voided"):
            if payment["status"] == "settled":
                return {
                    "success": False,
                    "error": "Transaction already settled. Use refund instead.",
                }
            return {"success": False, "error": f"Cannot void payment in status: {payment['status']}"}

        amount_cents = payment.get("total_cents", payment.get("amount_cents", 0))

        if amount_cents > self.MANAGER_THRESHOLD_CENTS:
            if not approved_by:
                return {
                    "success": False,
                    "error": "Manager approval required for voids over $50",
                    "needs_manager": True,
                }

        processor_txn_id = payment.get("processor_transaction_id")
        if not processor_txn_id:
            return {"success": False, "error": "No processor transaction to void"}

        void_result = self.processor.void(processor_txn_id)

        if not void_result.success:
            log.error(
                "refund.void_failed",
                payment_id=payment_id,
                error=void_result.error_message,
            )
            return {
                "success": False,
                "error": "Void failed at processor",
                "details": void_result.error_message,
            }

        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            supabase_client.table("payments").update({
                "status": TransactionStatus.VOIDED.value,
                "voided_at": now_iso,
                "void_reason": reason,
                "voided_by": user_id,
                "updated_at": now_iso,
            }).eq("id", payment_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("refund.void_update_failed", payment_id=payment_id)

        self._log_transaction(payment_id, org_id, payment.get("order_id", ""), "void", amount_cents, user_id, reason)

        # Restore order balance
        order_id = payment.get("order_id", "")
        if order_id:
            self._restore_order_balance(order_id, org_id, amount_cents)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.voided",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Voided payment ${amount_cents / 100:.2f}: {reason}",
            previous_state={"status": payment["status"]},
            new_state={"status": "voided", "reason": reason, "approved_by": approved_by},
        )

        event_bus.emit("payment.voided", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "amount_cents": amount_cents,
            "reason": reason,
            "voided_by": user_id,
            "approved_by": approved_by,
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "voided_amount_cents": amount_cents,
            "reason": reason,
        }

    def refund_transaction(
        self,
        payment_id: str,
        amount_cents: int | None = None,
        reason: str | None = None,
        approved_by: str | None = None,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Refund a captured/settled payment. Full or partial.

        Full refund: pass amount_cents=None. Partial: pass the cents to refund.
        120-day max window. Manager approval for amounts > $50.
        """
        payment = self._get_payment(payment_id, org_id)
        if not payment:
            return {"success": False, "error": "Payment not found"}

        if payment["status"] not in ("captured", "settled", "partially_refunded"):
            return {
                "success": False,
                "error": f"Cannot refund payment in status: {payment['status']}",
            }

        original_amount_cents = payment.get("total_cents", payment.get("amount_cents", 0))
        already_refunded_cents = payment.get("refunded_amount_cents", 0)
        max_refundable = original_amount_cents - already_refunded_cents

        refund_amount = amount_cents if amount_cents is not None else max_refundable

        if refund_amount <= 0:
            return {"success": False, "error": "Refund amount must be positive"}

        if refund_amount > max_refundable:
            return {
                "success": False,
                "error": f"Max refundable: ${max_refundable / 100:.2f}. Already refunded: ${already_refunded_cents / 100:.2f}.",
            }

        # Age check
        created_at_str = payment.get("captured_at") or payment.get("created_at")
        if created_at_str:
            try:
                if isinstance(created_at_str, str):
                    created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                else:
                    created_at = created_at_str
                days_old = (datetime.now(timezone.utc) - created_at).days
                if days_old > self.MAX_REFUND_DAYS:
                    return {
                        "success": False,
                        "error": f"Transaction is {days_old} days old. Max refund window: {self.MAX_REFUND_DAYS} days.",
                    }
            except (ValueError, TypeError):
                pass

        # Manager approval check
        if refund_amount > self.MANAGER_THRESHOLD_CENTS:
            if not approved_by:
                return {
                    "success": False,
                    "error": "Manager approval required for refunds over $50",
                    "needs_manager": True,
                }

        processor_txn_id = payment.get("processor_transaction_id")
        if not processor_txn_id:
            return {"success": False, "error": "No processor transaction to refund"}

        # Full refund passes None to processor; partial passes specific amount
        refund_cents_for_processor = refund_amount if amount_cents is not None else None

        refund_result = self.processor.refund(
            transaction_id=processor_txn_id,
            amount_cents=refund_cents_for_processor,
        )

        if not refund_result.success:
            log.error(
                "refund.refund_failed",
                payment_id=payment_id,
                error=refund_result.error_message,
            )
            return {
                "success": False,
                "error": "Refund failed at processor",
                "details": refund_result.error_message,
            }

        new_refunded_total = already_refunded_cents + refund_amount
        new_status = (
            TransactionStatus.REFUNDED.value
            if new_refunded_total >= original_amount_cents
            else TransactionStatus.PARTIALLY_REFUNDED.value
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            supabase_client.table("payments").update({
                "status": new_status,
                "refunded_amount_cents": new_refunded_total,
                "last_refund_reason": reason or "",
                "last_refunded_by": user_id,
                "last_refunded_at": now_iso,
                "updated_at": now_iso,
            }).eq("id", payment_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("refund.update_payment_failed", payment_id=payment_id)

        self._log_transaction(
            payment_id, org_id, payment.get("order_id", ""),
            "refund", refund_amount, user_id, reason,
            extra={"refund_id": refund_result.refund_id, "new_status": new_status},
        )

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.refunded",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Refund ${refund_amount / 100:.2f} on payment {payment_id}: {reason or 'no reason'}",
            previous_state={"status": payment["status"], "refunded_cents": already_refunded_cents},
            new_state={"status": new_status, "refunded_cents": new_refunded_total, "approved_by": approved_by},
        )

        event_bus.emit("payment.refunded", {
            "payment_id": payment_id,
            "order_id": payment.get("order_id", ""),
            "org_id": org_id,
            "refund_amount_cents": refund_amount,
            "remaining_refundable_cents": max_refundable - refund_amount,
            "new_status": new_status,
            "reason": reason,
            "refund_id": refund_result.refund_id,
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "refund_amount_cents": refund_amount,
            "new_status": new_status,
            "remaining_refundable_cents": max_refundable - refund_amount,
            "refund_id": refund_result.refund_id,
        }

    def unlinked_refund(
        self,
        order_id: str,
        amount_cents: int,
        card_token: str,
        reason: str,
        approved_by: str,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Refund to a DIFFERENT card than the original payment. Always requires manager.

        Used when original card is unavailable (lost, expired, etc).
        Higher fraud risk -- always requires manager approval.
        """
        if not approved_by:
            return {
                "success": False,
                "error": "Manager approval always required for unlinked refunds",
                "needs_manager": True,
            }

        if amount_cents <= 0:
            return {"success": False, "error": "Refund amount must be positive"}

        refund_result = self.processor.unlinked_refund(
            card_token=card_token,
            amount_cents=amount_cents,
            reason=reason,
        )

        if not refund_result.success:
            log.error(
                "refund.unlinked_failed",
                order_id=order_id,
                error=refund_result.error_message,
            )
            return {
                "success": False,
                "error": "Unlinked refund failed at processor",
                "details": refund_result.error_message,
            }

        payment_id = str(uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        record = {
            "id": payment_id,
            "org_id": org_id,
            "order_id": order_id,
            "payment_method": "card",
            "status": "refunded",
            "amount_cents": -amount_cents,
            "tip_cents": 0,
            "total_cents": -amount_cents,
            "processor_transaction_id": refund_result.refund_id,
            "is_unlinked_refund": True,
            "refund_reason": reason,
            "created_by": user_id,
            "created_at": now_iso,
        }

        try:
            supabase_client.table("payments").insert(record).execute()
        except Exception:
            log.exception("refund.unlinked_insert_failed", order_id=order_id)

        self._log_transaction(
            payment_id, org_id, order_id, "unlinked_refund", amount_cents,
            user_id, reason, extra={"refund_id": refund_result.refund_id, "approved_by": approved_by},
        )

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.unlinked_refund",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Unlinked refund ${amount_cents / 100:.2f} on order {order_id}: {reason}",
            new_state={"amount_cents": amount_cents, "approved_by": approved_by, "is_unlinked": True},
        )

        event_bus.emit("payment.refunded", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "refund_amount_cents": amount_cents,
            "is_unlinked": True,
            "reason": reason,
            "refund_id": refund_result.refund_id,
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "refund_amount_cents": amount_cents,
            "refund_id": refund_result.refund_id,
            "is_unlinked": True,
        }

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    def _get_payment(self, payment_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("payments")
                .select("*")
                .eq("id", payment_id)
                .eq("org_id", org_id)
                .single()
                .execute()
            )
            return resp.data
        except Exception:
            log.exception("refund.get_payment_failed", payment_id=payment_id)
            return None

    def _restore_order_balance(self, order_id: str, org_id: str, amount_cents: int) -> None:
        try:
            order = (
                supabase_client.table("orders")
                .select("id, balance_due, total, status")
                .eq("id", order_id)
                .eq("org_id", org_id)
                .single()
                .execute()
            ).data

            if order:
                balance_due_cents = int(float(order["balance_due"]) * 100)
                total_cents = int(float(order["total"]) * 100)
                new_balance = min(
                    balance_due_cents + amount_cents,
                    total_cents,
                )
                update_data: dict = {
                    "balance_due": new_balance / 100,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if order["status"] == "closed":
                    update_data["status"] = "open"
                    update_data["closed_at"] = None

                supabase_client.table("orders").update(update_data).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("refund.restore_balance_failed", order_id=order_id)

    def _log_transaction(
        self,
        payment_id: str,
        org_id: str,
        order_id: str,
        action: str,
        amount_cents: int,
        user_id: str,
        reason: str | None = None,
        extra: dict | None = None,
    ) -> None:
        record = {
            "id": str(uuid4()),
            "org_id": org_id,
            "order_id": order_id,
            "processor_name": "valor",
            "authorized_amount_cents": amount_cents,
            "payment_method": "card",
            "status": action,
            "server_id": user_id or None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"reason": reason or ""},
        }
        if extra:
            record["metadata"].update(extra)

        try:
            supabase_client.table("payment_transactions").insert(record).execute()
        except Exception:
            log.exception("refund.log_transaction_failed", payment_id=payment_id)
