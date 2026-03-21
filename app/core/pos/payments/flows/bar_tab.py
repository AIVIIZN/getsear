"""Bar tab lifecycle management for Sear POS.

Handles open, add item (with incremental auth), close, walkout,
and stale tab auto-close. All amounts in INTEGER CENTS.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import structlog

from app.core.pos.payments.processor import PaymentProcessor
from app.core.pos.payments.valor import TransactionStatus
from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)


class BarTabManager:
    """Manage bar tab lifecycle from open through close/walkout."""

    DEFAULT_HOLD_CENTS = 5000       # $50
    MAX_HOLD_CENTS = 50000          # $500
    AUTO_CLOSE_HOURS = 4
    PRE_AUTH_EXPIRY_DAYS = 7
    HEADROOM_MULTIPLIER = 1.5
    TAX_TIP_BUFFER = 1.30           # 30% buffer for estimated tax + tip
    WALKOUT_AUTO_GRAT_RATE = 20     # 20% auto-gratuity on walkouts

    def __init__(self, processor: PaymentProcessor) -> None:
        self.processor = processor

    def open_tab(
        self,
        order_id: str,
        terminal_id: str,
        hold_cents: int | None = None,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Open a bar tab with an auth-only hold on the card.

        The hold is NOT a charge -- it's a pre-authorization that reserves
        funds on the card. Captured at close for the actual amount consumed.
        """
        order = self._get_order(order_id, org_id)
        if not order:
            return {"success": False, "error": "Order not found"}

        effective_hold = hold_cents or self.DEFAULT_HOLD_CENTS
        effective_hold = min(effective_hold, self.MAX_HOLD_CENTS)

        auth_result = self.processor.authorize(
            amount_cents=effective_hold,
            tip_cents=0,
            terminal_id=terminal_id,
            order_id=order_id,
            capture=False,
        )

        if not auth_result.success:
            log.warning(
                "bar_tab.open_declined",
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
        now_iso = datetime.now(timezone.utc).isoformat()

        payment_record = {
            "id": payment_id,
            "org_id": org_id,
            "order_id": order_id,
            "payment_method": "card",
            "status": TransactionStatus.AUTHORIZED.value,
            "amount": effective_hold / 100,
            "tip_amount": 0,
            "total_amount": effective_hold / 100,
            "processor_transaction_id": auth_result.transaction_id,
            "auth_code": auth_result.auth_code,
            "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
            "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
            "processed_by": user_id,
            "processed_at": now_iso,
            "processor_response": {
                "is_bar_tab": True,
                "bar_tab_running_total_cents": 0,
                "terminal_id": terminal_id,
                "card_entry_mode": auth_result.card_info.entry_mode.value if auth_result.card_info else None,
                "card_token": auth_result.card_info.token if auth_result.card_info else None,
            },
            "created_at": now_iso,
        }

        try:
            supabase_client.table("payments").insert(payment_record).execute()
        except Exception:
            log.exception("bar_tab.insert_failed", order_id=order_id)
            return {"success": False, "error": "Failed to record tab"}

        # Mark order as bar tab
        try:
            supabase_client.table("orders").update({
                "order_type": "bar",
                "metadata": {"is_bar_tab": True, "bar_tab_payment_id": payment_id},
                "updated_at": now_iso,
            }).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("bar_tab.update_order_failed", order_id=order_id)

        self._log_transaction(payment_id, org_id, order_id, "authorize", effective_hold, user_id)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="bar_tab.opened",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Bar tab opened with ${effective_hold / 100:.2f} hold on order {order_id}",
            new_state={"hold_cents": effective_hold, "order_id": order_id},
        )

        event_bus.emit("bar_tab.opened", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "hold_cents": effective_hold,
        })

        return {
            "success": True,
            "payment_id": payment_id,
            "order_id": order_id,
            "hold_cents": effective_hold,
            "auth_code": auth_result.auth_code,
            "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
            "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
        }

    def add_item_to_tab(
        self,
        order_id: str,
        item_total_cents: int,
        org_id: str = "",
    ) -> dict:
        """Track item added to tab. Trigger incremental auth if running total exceeds hold.

        Checks if running_total * 1.30 (buffer for tax+tip) exceeds the
        current auth. If so, attempts incremental auth or re-auth at
        HEADROOM_MULTIPLIER * current total.
        """
        tab_payment = self._get_tab_payment(order_id, org_id)
        if not tab_payment:
            return {"success": False, "error": "No active bar tab for this order"}

        old_running = tab_payment.get("bar_tab_running_total_cents", 0)
        new_running = old_running + item_total_cents
        auth_amount = tab_payment["amount_cents"]

        estimated_final = int(new_running * self.TAX_TIP_BUFFER)
        needs_more_auth = estimated_final > auth_amount

        auth_increased = False
        new_auth_amount = auth_amount

        if needs_more_auth:
            new_auth_target = int(new_running * self.HEADROOM_MULTIPLIER)
            new_auth_target = min(new_auth_target, self.MAX_HOLD_CENTS)
            additional_cents = new_auth_target - auth_amount

            if additional_cents > 0:
                try:
                    incr_result = self.processor.incremental_auth(
                        transaction_id=tab_payment["processor_transaction_id"],
                        additional_cents=additional_cents,
                    )
                    if incr_result.success:
                        new_auth_amount = new_auth_target
                        auth_increased = True
                    else:
                        # Incremental auth failed -- try void + re-auth with token
                        token = tab_payment.get("card_token")
                        if token:
                            void_result = self.processor.void(tab_payment["processor_transaction_id"])
                            if void_result.success:
                                reauth = self.processor.authorize_token(
                                    token=token,
                                    amount_cents=new_auth_target,
                                    tip_cents=0,
                                    order_id=order_id,
                                )
                                if reauth.success:
                                    new_auth_amount = new_auth_target
                                    auth_increased = True
                                    # Update processor txn id
                                    try:
                                        supabase_client.table("payments").update({
                                            "processor_transaction_id": reauth.transaction_id,
                                            "auth_code": reauth.auth_code,
                                        }).eq("id", tab_payment["id"]).execute()
                                    except Exception:
                                        log.exception("bar_tab.update_txn_id_failed")
                except Exception:
                    log.exception("bar_tab.incremental_auth_failed", order_id=order_id)

            if not auth_increased:
                log.warning(
                    "bar_tab.over_auth",
                    order_id=order_id,
                    running_cents=new_running,
                    auth_cents=auth_amount,
                )
                event_bus.emit("bar_tab.over_auth", {
                    "order_id": order_id,
                    "org_id": org_id,
                    "running_cents": new_running,
                    "auth_cents": auth_amount,
                    "over_by_cents": estimated_final - auth_amount,
                })

        # Update running total and auth amount on payment record (store in metadata)
        try:
            meta = tab_payment.get("processor_response") or {}
            meta["bar_tab_running_total_cents"] = new_running
            update_data: dict = {
                "processor_response": meta,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if auth_increased:
                update_data["amount"] = new_auth_amount / 100
                update_data["total_amount"] = new_auth_amount / 100
            supabase_client.table("payments").update(update_data).eq("id", tab_payment["id"]).execute()
        except Exception:
            log.exception("bar_tab.update_running_total_failed", order_id=order_id)

        return {
            "success": True,
            "running_total_cents": new_running,
            "auth_amount_cents": new_auth_amount,
            "auth_increased": auth_increased,
            "over_auth": needs_more_auth and not auth_increased,
        }

    def close_tab(
        self,
        order_id: str,
        tip_cents: int = 0,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Close a bar tab: capture at final amount + tip.

        Captures the pre-authorized amount at the actual consumption total
        (subtotal + tax) plus tip. If the capture amount exceeds the auth,
        the processor handles it (most support over-capture up to 20%).
        """
        tab_payment = self._get_tab_payment(order_id, org_id)
        if not tab_payment:
            return {"success": False, "error": "No active bar tab for this order"}

        order = self._get_order(order_id, org_id)
        if not order:
            return {"success": False, "error": "Order not found"}

        # The actual amount is the order total (subtotal + tax)
        capture_amount_cents = order["total_cents"]

        capture_result = self.processor.capture(
            transaction_id=tab_payment["processor_transaction_id"],
            amount_cents=capture_amount_cents,
            tip_cents=tip_cents,
        )

        if not capture_result.success:
            log.error(
                "bar_tab.capture_failed",
                order_id=order_id,
                error=capture_result.error_message,
            )
            return {
                "success": False,
                "error": "Capture failed",
                "details": capture_result.error_message,
                "action_needed": "try_different_card_or_comp",
            }

        total_charged_cents = capture_amount_cents + tip_cents
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            supabase_client.table("payments").update({
                "status": TransactionStatus.CAPTURED.value,
                "amount": capture_amount_cents / 100,
                "tip_amount": tip_cents / 100,
                "total_amount": total_charged_cents / 100,
                "updated_at": now_iso,
            }).eq("id", tab_payment["id"]).execute()
        except Exception:
            log.exception("bar_tab.update_payment_failed", order_id=order_id)

        self._log_transaction(tab_payment["id"], org_id, order_id, "capture", total_charged_cents, user_id)
        self._update_order_balance(order_id, org_id, 0)
        self._close_order(order_id, org_id)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="bar_tab.closed",
            entity_type="payment",
            entity_id=tab_payment["id"],
            description=f"Bar tab closed ${total_charged_cents / 100:.2f} (tip ${tip_cents / 100:.2f}) on order {order_id}",
            new_state={"capture_cents": capture_amount_cents, "tip_cents": tip_cents, "total_cents": total_charged_cents},
        )

        event_bus.emit("payment.processed", {
            "payment_id": tab_payment["id"],
            "order_id": order_id,
            "org_id": org_id,
            "method": "card",
            "amount_cents": total_charged_cents,
            "tip_cents": tip_cents,
            "status": "captured",
            "was_bar_tab": True,
        })

        return {
            "success": True,
            "payment_id": tab_payment["id"],
            "capture_amount_cents": capture_amount_cents,
            "tip_cents": tip_cents,
            "total_charged_cents": total_charged_cents,
        }

    def handle_walkout(
        self,
        order_id: str,
        user_id: str = "",
        org_id: str = "",
        tax_rate: int = 850,  # 8.50% as basis points
    ) -> dict:
        """Customer left without closing. Capture running total + tax + 20% auto-gratuity.

        The auto-gratuity on walkouts is classified as a service charge
        (not a tip) for IRS purposes.
        """
        tab_payment = self._get_tab_payment(order_id, org_id)
        if not tab_payment:
            return {"success": False, "error": "No active bar tab for this order"}

        running_total_cents = tab_payment.get("bar_tab_running_total_cents", 0)
        if running_total_cents <= 0:
            # Empty tab -- just void
            void_result = self.processor.void(tab_payment["processor_transaction_id"])
            try:
                supabase_client.table("payments").update({
                    "status": TransactionStatus.VOIDED.value,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", tab_payment["id"]).execute()
            except Exception:
                log.exception("bar_tab.void_empty_failed", order_id=order_id)
            return {
                "success": True,
                "action": "voided_empty_tab",
                "payment_id": tab_payment["id"],
            }

        tax_cents = (running_total_cents * tax_rate) // 10000
        subtotal_plus_tax = running_total_cents + tax_cents
        auto_grat_cents = (running_total_cents * self.WALKOUT_AUTO_GRAT_RATE) // 100
        total_capture = subtotal_plus_tax + auto_grat_cents

        capture_result = self.processor.capture(
            transaction_id=tab_payment["processor_transaction_id"],
            amount_cents=subtotal_plus_tax,
            tip_cents=auto_grat_cents,
        )

        if not capture_result.success:
            log.error(
                "bar_tab.walkout_capture_failed",
                order_id=order_id,
                error=capture_result.error_message,
            )
            return {
                "success": False,
                "error": "Walkout capture failed",
                "details": capture_result.error_message,
            }

        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            meta = tab_payment.get("processor_response") or {}
            meta["is_walkout"] = True
            meta["auto_gratuity_cents"] = auto_grat_cents
            meta["auto_gratuity_is_service_charge"] = True
            supabase_client.table("payments").update({
                "status": TransactionStatus.CAPTURED.value,
                "amount": subtotal_plus_tax / 100,
                "tip_amount": auto_grat_cents / 100,
                "total_amount": total_capture / 100,
                "processor_response": meta,
                "updated_at": now_iso,
            }).eq("id", tab_payment["id"]).execute()
        except Exception:
            log.exception("bar_tab.walkout_update_failed", order_id=order_id)

        self._log_transaction(tab_payment["id"], org_id, order_id, "walkout_capture", total_capture, user_id)

        # Update order
        try:
            supabase_client.table("orders").update({
                "status": "closed",
                "balance_due": 0,
                "metadata": {"is_walkout": True, "auto_gratuity_cents": auto_grat_cents, "auto_gratuity_is_service_charge": True},
                "closed_at": now_iso,
                "updated_at": now_iso,
            }).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("bar_tab.walkout_close_order_failed", order_id=order_id)

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="bar_tab.walkout",
            entity_type="payment",
            entity_id=tab_payment["id"],
            description=f"Walkout on order {order_id}: captured ${total_capture / 100:.2f} (includes ${auto_grat_cents / 100:.2f} auto-gratuity)",
            new_state={
                "running_total_cents": running_total_cents,
                "tax_cents": tax_cents,
                "auto_gratuity_cents": auto_grat_cents,
                "total_capture_cents": total_capture,
            },
        )

        event_bus.emit("bar_tab.walkout", {
            "payment_id": tab_payment["id"],
            "order_id": order_id,
            "org_id": org_id,
            "total_capture_cents": total_capture,
            "auto_gratuity_cents": auto_grat_cents,
        })

        return {
            "success": True,
            "payment_id": tab_payment["id"],
            "running_total_cents": running_total_cents,
            "tax_cents": tax_cents,
            "auto_gratuity_cents": auto_grat_cents,
            "total_captured_cents": total_capture,
            "auto_gratuity_is_service_charge": True,
        }

    def auto_close_stale_tabs(
        self,
        org_id: str,
        location_id: str,
    ) -> dict:
        """Close tabs open longer than AUTO_CLOSE_HOURS. Called by Celery beat.

        Tabs with a running total are captured. Empty tabs are voided.
        Also alerts managers about tabs approaching pre-auth expiry.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.AUTO_CLOSE_HOURS)
        expiry_cutoff = datetime.now(timezone.utc) - timedelta(days=self.PRE_AUTH_EXPIRY_DAYS - 1)

        stale_tabs = self._get_stale_tabs(org_id, location_id, cutoff)
        closed_count = 0
        voided_count = 0
        failed_count = 0

        for tab in stale_tabs:
            running_total = tab.get("bar_tab_running_total_cents", 0)
            order_id = tab["order_id"]

            if running_total > 0:
                result = self.close_tab(
                    order_id=order_id,
                    tip_cents=0,
                    user_id="system",
                    org_id=org_id,
                )
                if result.get("success"):
                    closed_count += 1
                else:
                    failed_count += 1
            else:
                void_result = self.processor.void(tab["processor_transaction_id"])
                if void_result.success:
                    try:
                        supabase_client.table("payments").update({
                            "status": TransactionStatus.VOIDED.value,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }).eq("id", tab["id"]).execute()
                    except Exception:
                        log.exception("bar_tab.void_stale_failed", tab_id=tab["id"])
                    voided_count += 1
                else:
                    failed_count += 1

        # Check for tabs approaching pre-auth expiry
        expiring_tabs = self._get_stale_tabs(org_id, location_id, expiry_cutoff)
        for tab in expiring_tabs:
            if tab.get("status") == TransactionStatus.AUTHORIZED.value:
                event_bus.emit("bar_tab.expiry_warning", {
                    "payment_id": tab["id"],
                    "order_id": tab["order_id"],
                    "org_id": org_id,
                    "location_id": location_id,
                    "running_total_cents": tab.get("bar_tab_running_total_cents", 0),
                    "message": "Tab pre-auth will expire soon. Close immediately.",
                })

        log.info(
            "bar_tab.auto_close_complete",
            org_id=org_id,
            location_id=location_id,
            closed=closed_count,
            voided=voided_count,
            failed=failed_count,
        )

        return {
            "closed": closed_count,
            "voided": voided_count,
            "failed": failed_count,
            "expiry_warnings": len(expiring_tabs),
        }

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    def _get_order(self, order_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("orders")
                .select("id, org_id, status, subtotal, tax_total, total, balance_due")
                .eq("id", order_id)
                .eq("org_id", org_id)
                .single()
                .execute()
            )
            row = resp.data
            if row:
                row["balance_due_cents"] = int(float(row["balance_due"]) * 100)
                row["total_cents"] = int(float(row["total"]) * 100)
                row["subtotal_cents"] = int(float(row["subtotal"]) * 100)
                row["tax_cents"] = int(float(row["tax_total"]) * 100)
            return row
        except Exception:
            log.exception("bar_tab.get_order_failed", order_id=order_id)
            return None

    def _get_tab_payment(self, order_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("payments")
                .select("*")
                .eq("order_id", order_id)
                .eq("org_id", org_id)
                .eq("status", TransactionStatus.AUTHORIZED.value)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            # Filter for bar tab payments via metadata
            for row in (resp.data or []):
                meta = row.get("processor_response") or {}
                if meta.get("is_bar_tab"):
                    row["amount_cents"] = int(float(row.get("amount", 0)) * 100)
                    row["bar_tab_running_total_cents"] = meta.get("bar_tab_running_total_cents", 0)
                    row["card_token"] = meta.get("card_token")
                    return row
            if resp.data:
                row = resp.data[0]
                row["amount_cents"] = int(float(row.get("amount", 0)) * 100)
                return row
            return None
        except Exception:
            log.exception("bar_tab.get_tab_payment_failed", order_id=order_id)
            return None

    def _get_stale_tabs(self, org_id: str, location_id: str, cutoff: datetime) -> list[dict]:
        try:
            resp = (
                supabase_client.table("payments")
                .select("id, order_id, processor_transaction_id, amount, processor_response, status, created_at")
                .eq("org_id", org_id)
                .eq("status", TransactionStatus.AUTHORIZED.value)
                .lt("created_at", cutoff.isoformat())
                .execute()
            )
            # Filter for bar tab payments via metadata
            tabs = []
            for row in (resp.data or []):
                meta = row.get("processor_response") or {}
                if meta.get("is_bar_tab"):
                    row["amount_cents"] = int(float(row.get("amount", 0)) * 100)
                    row["bar_tab_running_total_cents"] = meta.get("bar_tab_running_total_cents", 0)
                    row["card_token"] = meta.get("card_token")
                    tabs.append(row)
            return tabs
        except Exception:
            log.exception("bar_tab.get_stale_tabs_failed", org_id=org_id)
            return []

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
                "org_id": org_id,
                "order_id": order_id,
                "processor_name": "valor",
                "authorized_amount_cents": amount_cents,
                "payment_method": "card",
                "status": action,
                "server_id": user_id or None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            log.exception("bar_tab.log_transaction_failed")

    def _update_order_balance(self, order_id: str, org_id: str, new_balance_cents: int) -> None:
        try:
            supabase_client.table("orders").update({
                "balance_due": max(new_balance_cents, 0) / 100,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("bar_tab.update_balance_failed", order_id=order_id)

    def _close_order(self, order_id: str, org_id: str) -> None:
        try:
            supabase_client.table("orders").update({
                "status": "closed",
                "closed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", order_id).eq("org_id", org_id).execute()

            event_bus.emit("order.closed", {
                "order_id": order_id,
                "org_id": org_id,
                "reason": "bar_tab_closed",
            })
        except Exception:
            log.exception("bar_tab.close_order_failed", order_id=order_id)
