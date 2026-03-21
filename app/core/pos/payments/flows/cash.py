"""Cash payment flow for Sear POS.

Handles cash tendering, change calculation, denomination breakdown,
and cash drawer reconciliation. All amounts in INTEGER CENTS.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import structlog

from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)


class CashPaymentManager:
    """Process cash payments with change calculation and drawer management."""

    def process_cash_payment(
        self,
        order_id: str,
        amount_tendered_cents: int,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Process a cash payment. Returns change and denomination breakdown.

        Records the payment, updates order balance_due, and emits
        a cash_drawer.open event to kick the cash drawer.
        """
        order = self._get_order(order_id, org_id)
        if not order:
            return {"success": False, "error": "Order not found"}

        balance_due_cents = order["balance_due_cents"]
        if balance_due_cents <= 0:
            return {"success": False, "error": "Order already fully paid"}

        if amount_tendered_cents < balance_due_cents:
            return {
                "success": False,
                "error": "Insufficient cash",
                "short_by_cents": balance_due_cents - amount_tendered_cents,
            }

        change_cents = amount_tendered_cents - balance_due_cents

        payment_id = str(uuid4())
        payment_record = {
            "id": payment_id,
            "org_id": org_id,
            "order_id": order_id,
            "payment_method": "cash",
            "status": "captured",
            "amount_cents": balance_due_cents,
            "tip_cents": 0,
            "total_cents": balance_due_cents,
            "cash_tendered_cents": amount_tendered_cents,
            "cash_change_cents": change_cents,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase_client.table("payments").insert(payment_record).execute()
        except Exception:
            log.exception("cash_payment.insert_failed", order_id=order_id)
            return {"success": False, "error": "Failed to record payment"}

        self._log_transaction(payment_id, org_id, order_id, "cash_capture", balance_due_cents, user_id)
        self._update_order_balance(order_id, org_id, 0)
        self._close_order(order_id, org_id)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.processed",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Cash payment ${balance_due_cents / 100:.2f} (tendered ${amount_tendered_cents / 100:.2f}) on order {order_id}",
            new_state={"amount_cents": balance_due_cents, "method": "cash", "change_cents": change_cents},
        )

        event_bus.emit("payment.processed", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "method": "cash",
            "amount_cents": balance_due_cents,
            "tip_cents": 0,
            "status": "captured",
        })

        event_bus.emit("cash_drawer.open", {
            "order_id": order_id,
            "org_id": org_id,
            "user_id": user_id,
            "reason": "cash_payment",
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "amount_cents": balance_due_cents,
            "cash_tendered_cents": amount_tendered_cents,
            "change_cents": change_cents,
            "denomination_breakdown": self._suggest_change(change_cents),
            "open_drawer": True,
        }

    def cash_drawer_reconciliation(
        self,
        drawer_id: str,
        counted_cents: int,
        org_id: str = "",
        location_id: str = "",
        user_id: str = "",
    ) -> dict:
        """End-of-shift cash drawer reconciliation.

        Compares expected cash (from POS records) against actual counted
        cash. Flags variance over $5 for manager review.
        """
        drawer = self._get_drawer(drawer_id, org_id)
        if not drawer:
            return {"success": False, "error": "Drawer not found"}

        starting_bank_cents = drawer.get("starting_bank_cents", 0)
        cash_sales_cents = drawer.get("cash_sales_cents", 0)
        cash_refunds_cents = drawer.get("cash_refunds_cents", 0)
        paid_outs_cents = drawer.get("paid_outs_cents", 0)

        expected_cents = starting_bank_cents + cash_sales_cents - cash_refunds_cents - paid_outs_cents
        variance_cents = counted_cents - expected_cents
        needs_review = abs(variance_cents) > 500  # $5.00

        if needs_review:
            over_short = "over" if variance_cents > 0 else "short"
        else:
            over_short = "balanced" if variance_cents == 0 else ("over" if variance_cents > 0 else "short")

        recon_record = {
            "id": str(uuid4()),
            "org_id": org_id,
            "location_id": location_id,
            "drawer_id": drawer_id,
            "starting_bank_cents": starting_bank_cents,
            "cash_sales_cents": cash_sales_cents,
            "cash_refunds_cents": cash_refunds_cents,
            "paid_outs_cents": paid_outs_cents,
            "expected_cents": expected_cents,
            "counted_cents": counted_cents,
            "variance_cents": variance_cents,
            "needs_review": needs_review,
            "reconciled_by": user_id,
            "reconciled_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase_client.table("cash_drawer_reconciliations").insert(recon_record).execute()
        except Exception:
            log.exception("cash_reconciliation.insert_failed", drawer_id=drawer_id)

        if needs_review:
            log_audit(
                org_id=org_id,
                user_id=user_id,
                action="cash_drawer.variance",
                entity_type="cash_drawer",
                entity_id=drawer_id,
                description=f"Drawer {drawer_id} variance ${variance_cents / 100:.2f} ({over_short})",
                new_state={"expected_cents": expected_cents, "counted_cents": counted_cents, "variance_cents": variance_cents},
            )

        return {
            "success": True,
            "starting_bank_cents": starting_bank_cents,
            "cash_sales_cents": cash_sales_cents,
            "cash_refunds_cents": cash_refunds_cents,
            "paid_outs_cents": paid_outs_cents,
            "expected_cents": expected_cents,
            "counted_cents": counted_cents,
            "variance_cents": variance_cents,
            "over_short": over_short,
            "needs_review": needs_review,
        }

    def _suggest_change(self, change_cents: int) -> dict:
        """Optimal denomination breakdown for making change."""
        remaining = change_cents
        breakdown = {}

        for name, value in [
            ("twenties", 2000),
            ("tens", 1000),
            ("fives", 500),
            ("ones", 100),
            ("quarters", 25),
            ("dimes", 10),
            ("nickels", 5),
            ("pennies", 1),
        ]:
            count = remaining // value
            breakdown[name] = count
            remaining %= value

        return breakdown

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    def _get_order(self, order_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("orders")
                .select("id, org_id, status, total_cents, balance_due_cents")
                .eq("id", order_id)
                .eq("org_id", org_id)
                .single()
                .execute()
            )
            return resp.data
        except Exception:
            log.exception("cash_payment.get_order_failed", order_id=order_id)
            return None

    def _get_drawer(self, drawer_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("cash_drawers")
                .select("*")
                .eq("id", drawer_id)
                .eq("org_id", org_id)
                .single()
                .execute()
            )
            return resp.data
        except Exception:
            log.exception("cash_reconciliation.get_drawer_failed", drawer_id=drawer_id)
            return None

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
            log.exception("cash_payment.log_transaction_failed", payment_id=payment_id)

    def _update_order_balance(self, order_id: str, org_id: str, new_balance_cents: int) -> None:
        try:
            supabase_client.table("orders").update({
                "balance_due_cents": max(new_balance_cents, 0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("cash_payment.update_balance_failed", order_id=order_id)

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
            log.exception("cash_payment.close_order_failed", order_id=order_id)

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
            log.exception("cash_payment.table_update_on_close_failed", order_id=order_id)
