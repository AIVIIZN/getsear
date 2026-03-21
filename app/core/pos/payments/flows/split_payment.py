"""Split payment flow for Sear POS.

Supports equal split, split by item, custom amount split, and
mixed tender (card + cash + gift card on the same order).
All amounts in INTEGER CENTS.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

import structlog

from app.core.pos.payments.flows.cash import CashPaymentManager
from app.core.pos.payments.flows.standard import StandardPaymentFlow
from app.core.pos.payments.gift_cards import GiftCardSystem
from app.core.pos.payments.processor import PaymentProcessor
from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)


@dataclass
class SplitPortion:
    """One portion of a split payment."""

    portion_id: str
    portion_index: int
    amount_cents: int
    tax_cents: int
    payment_method: str = "card"  # card, cash, gift_card
    items: list[str] = field(default_factory=list)
    paid: bool = False
    payment_id: str | None = None
    transaction_id: str | None = None


class SplitPaymentManager:
    """Manage split payments across multiple guests and tender types."""

    def __init__(
        self,
        processor: PaymentProcessor,
        gift_card_system: GiftCardSystem | None = None,
    ) -> None:
        self.processor = processor
        self.standard_flow = StandardPaymentFlow(processor)
        self.cash_flow = CashPaymentManager()
        self.gift_card_system = gift_card_system or GiftCardSystem()

    def split_equal(self, order_id: str, num_ways: int, org_id: str = "") -> list[SplitPortion]:
        """Split an order equally N ways. Last person absorbs penny rounding remainder."""
        if num_ways < 2:
            raise ValueError("Must split at least 2 ways")

        order = self._get_order(order_id, org_id)
        if not order:
            raise ValueError("Order not found")

        subtotal_cents = order["subtotal_cents"]
        tax_cents = order["tax_cents"]

        per_person_subtotal = subtotal_cents // num_ways
        per_person_tax = tax_cents // num_ways

        portions: list[SplitPortion] = []
        running_subtotal = 0
        running_tax = 0

        for i in range(num_ways):
            if i == num_ways - 1:
                # Last person gets remainder
                amount = subtotal_cents - running_subtotal
                tax = tax_cents - running_tax
            else:
                amount = per_person_subtotal
                tax = per_person_tax

            portions.append(SplitPortion(
                portion_id=str(uuid4()),
                portion_index=i,
                amount_cents=amount,
                tax_cents=tax,
                payment_method="card",
                items=[],
            ))
            running_subtotal += amount
            running_tax += tax

        self._store_split_portions(order_id, org_id, portions)
        return portions

    def split_by_item(
        self,
        order_id: str,
        assignments: dict[str, list[str]],
        org_id: str = "",
    ) -> list[SplitPortion]:
        """Split order by assigning specific items to each guest.

        assignments: {"guest_0": ["item_id_1", "item_id_3"], "guest_1": ["item_id_2"]}
        """
        order = self._get_order(order_id, org_id)
        if not order:
            raise ValueError("Order not found")

        items = self._get_order_items(order_id, org_id)
        item_lookup = {item["id"]: item for item in items}

        portions: list[SplitPortion] = []

        for idx, (guest_key, item_ids) in enumerate(assignments.items()):
            amount_cents = 0
            tax_cents = 0

            for item_id in item_ids:
                item = item_lookup.get(item_id)
                if not item:
                    raise ValueError(f"Item {item_id} not found on order {order_id}")
                amount_cents += item.get("price_cents", 0) * item.get("quantity", 1)
                tax_cents += item.get("tax_cents", 0)

            portions.append(SplitPortion(
                portion_id=str(uuid4()),
                portion_index=idx,
                amount_cents=amount_cents,
                tax_cents=tax_cents,
                payment_method="card",
                items=item_ids,
            ))

        self._store_split_portions(order_id, org_id, portions)
        return portions

    def split_custom_amounts(
        self,
        order_id: str,
        amounts: list[int],
        org_id: str = "",
    ) -> list[SplitPortion]:
        """Split by custom dollar amounts. Tax distributed proportionally.

        amounts: list of subtotal cents for each split. Must sum to order subtotal.
        """
        order = self._get_order(order_id, org_id)
        if not order:
            raise ValueError("Order not found")

        subtotal_cents = order["subtotal_cents"]
        tax_cents = order["tax_cents"]

        if sum(amounts) != subtotal_cents:
            raise ValueError(
                f"Split amounts ({sum(amounts)}) don't equal order subtotal ({subtotal_cents})"
            )

        portions: list[SplitPortion] = []
        running_tax = 0

        for i, amount in enumerate(amounts):
            if i == len(amounts) - 1:
                # Last portion absorbs tax rounding remainder
                portion_tax = tax_cents - running_tax
            else:
                proportion = amount / subtotal_cents if subtotal_cents > 0 else 0
                portion_tax = round(tax_cents * proportion)
                running_tax += portion_tax

            portions.append(SplitPortion(
                portion_id=str(uuid4()),
                portion_index=i,
                amount_cents=amount,
                tax_cents=portion_tax,
                payment_method="card",
                items=[],
            ))

        self._store_split_portions(order_id, org_id, portions)
        return portions

    def process_split_portion(
        self,
        order_id: str,
        portion_index: int,
        payment_method: str,
        terminal_id: str | None = None,
        cash_tendered_cents: int | None = None,
        gift_card_number: str | None = None,
        tip_cents: int = 0,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Process payment for one portion of a split. Supports mixed tender.

        Each portion is processed independently. A split_group_id links
        all portions for the same order.
        """
        split_data = self._get_split_data(order_id, org_id)
        if not split_data:
            return {"success": False, "error": "No split found for this order"}

        portions = split_data.get("portions", [])
        if portion_index < 0 or portion_index >= len(portions):
            return {"success": False, "error": f"Invalid portion_index: {portion_index}"}

        portion = portions[portion_index]
        if portion.get("paid"):
            return {"success": False, "error": "This portion is already paid"}

        portion_total_cents = portion["amount_cents"] + portion["tax_cents"]
        split_group_id = split_data["split_group_id"]
        payment_id = str(uuid4())

        if payment_method == "cash":
            if cash_tendered_cents is None:
                return {"success": False, "error": "cash_tendered_cents required for cash payment"}
            if cash_tendered_cents < portion_total_cents:
                return {
                    "success": False,
                    "error": "Insufficient cash",
                    "short_by_cents": portion_total_cents - cash_tendered_cents,
                }
            change_cents = cash_tendered_cents - portion_total_cents

            record = {
                "id": payment_id,
                "org_id": org_id,
                "order_id": order_id,
                "payment_method": "cash",
                "status": "captured",
                "amount_cents": portion_total_cents,
                "tip_cents": 0,
                "total_cents": portion_total_cents,
                "cash_tendered_cents": cash_tendered_cents,
                "cash_change_cents": change_cents,
                "split_group_id": split_group_id,
                "split_portion_index": portion_index,
                "created_by": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._insert_payment(record)
            self._log_transaction(payment_id, org_id, order_id, "split_cash_capture", portion_total_cents, user_id)

            event_bus.emit("cash_drawer.open", {
                "order_id": order_id,
                "org_id": org_id,
                "user_id": user_id,
                "reason": "split_cash_payment",
            })

            result = {
                "success": True,
                "payment_id": payment_id,
                "method": "cash",
                "amount_cents": portion_total_cents,
                "change_cents": change_cents,
            }

        elif payment_method == "gift_card":
            if not gift_card_number:
                return {"success": False, "error": "gift_card_number required"}

            gc_result = self.gift_card_system.redeem(
                card_number=gift_card_number,
                amount_cents=portion_total_cents,
                order_id=order_id,
            )

            if not gc_result.get("success"):
                return {"success": False, "error": gc_result.get("error", "Gift card redemption failed")}

            redeemed_cents = gc_result["redeemed_cents"]
            remaining_owed = gc_result.get("remaining_owed_cents", 0)

            record = {
                "id": payment_id,
                "org_id": org_id,
                "order_id": order_id,
                "payment_method": "gift_card",
                "status": "captured",
                "amount_cents": redeemed_cents,
                "tip_cents": 0,
                "total_cents": redeemed_cents,
                "split_group_id": split_group_id,
                "split_portion_index": portion_index,
                "created_by": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._insert_payment(record)
            self._log_transaction(payment_id, org_id, order_id, "split_gc_redeem", redeemed_cents, user_id)

            result = {
                "success": True,
                "payment_id": payment_id,
                "method": "gift_card",
                "amount_cents": redeemed_cents,
                "remaining_owed_cents": remaining_owed,
                "partial": remaining_owed > 0,
            }

            if remaining_owed > 0:
                # Mark partial -- still needs another payment for remainder
                self._update_portion(order_id, org_id, portion_index, {
                    "partial_payment_id": payment_id,
                    "partial_paid_cents": redeemed_cents,
                    "remaining_owed_cents": remaining_owed,
                })
                return result

        elif payment_method == "card":
            if not terminal_id:
                return {"success": False, "error": "terminal_id required for card payment"}

            auth_result = self.processor.authorize(
                amount_cents=portion_total_cents,
                tip_cents=tip_cents,
                terminal_id=terminal_id,
                order_id=f"{order_id}_split_{portion_index}",
                capture=True,
            )

            if not auth_result.success:
                return {
                    "success": False,
                    "error": "Card declined",
                    "decline_code": auth_result.decline_code,
                    "decline_reason": auth_result.decline_reason,
                    "action_needed": "present_different_card",
                }

            total_with_tip = portion_total_cents + tip_cents

            record = {
                "id": payment_id,
                "org_id": org_id,
                "order_id": order_id,
                "payment_method": "card",
                "status": "captured",
                "amount_cents": portion_total_cents,
                "tip_cents": tip_cents,
                "total_cents": total_with_tip,
                "processor_transaction_id": auth_result.transaction_id,
                "auth_code": auth_result.auth_code,
                "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
                "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
                "card_entry_mode": auth_result.card_info.entry_mode.value if auth_result.card_info else None,
                "card_token": auth_result.card_info.token if auth_result.card_info else None,
                "terminal_id": terminal_id,
                "split_group_id": split_group_id,
                "split_portion_index": portion_index,
                "created_by": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._insert_payment(record)
            self._log_transaction(payment_id, org_id, order_id, "split_card_capture", total_with_tip, user_id)

            result = {
                "success": True,
                "payment_id": payment_id,
                "method": "card",
                "amount_cents": portion_total_cents,
                "tip_cents": tip_cents,
                "total_cents": total_with_tip,
                "auth_code": auth_result.auth_code,
                "card_brand": auth_result.card_info.brand.value if auth_result.card_info else None,
                "card_last_four": auth_result.card_info.last_four if auth_result.card_info else None,
            }

        else:
            return {"success": False, "error": f"Unsupported payment method: {payment_method}"}

        # Mark portion as paid
        self._update_portion(order_id, org_id, portion_index, {
            "paid": True,
            "payment_id": payment_id,
            "payment_method": payment_method,
        })

        # Update order balance
        order = self._get_order(order_id, org_id)
        if order:
            paid_portion_cents = portion["amount_cents"] + portion["tax_cents"]
            new_balance = order["balance_due_cents"] - paid_portion_cents
            self._update_order_balance(order_id, org_id, new_balance)

            # Check if all portions paid
            updated_split = self._get_split_data(order_id, org_id)
            all_paid = all(p.get("paid") for p in updated_split.get("portions", []))

            if all_paid:
                self._close_order(order_id, org_id)
                result["all_portions_paid"] = True

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="payment.split_portion",
            entity_type="payment",
            entity_id=payment_id,
            description=f"Split portion {portion_index} paid via {payment_method} on order {order_id}",
            new_state={"split_group_id": split_group_id, "portion_index": portion_index, "method": payment_method},
        )

        event_bus.emit("payment.processed", {
            "payment_id": payment_id,
            "order_id": order_id,
            "org_id": org_id,
            "method": payment_method,
            "amount_cents": result.get("amount_cents", 0),
            "split_group_id": split_group_id,
            "split_portion_index": portion_index,
            "status": "captured",
        })

        return result

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
            log.exception("split_payment.get_order_failed", order_id=order_id)
            return None

    def _get_order_items(self, order_id: str, org_id: str) -> list[dict]:
        try:
            resp = (
                supabase_client.table("order_items")
                .select("id, menu_item_id, price_cents, quantity, tax_cents")
                .eq("order_id", order_id)
                .eq("org_id", org_id)
                .eq("is_voided", False)
                .execute()
            )
            return resp.data or []
        except Exception:
            log.exception("split_payment.get_items_failed", order_id=order_id)
            return []

    def _store_split_portions(self, order_id: str, org_id: str, portions: list[SplitPortion]) -> None:
        split_group_id = str(uuid4())
        split_record = {
            "id": split_group_id,
            "org_id": org_id,
            "order_id": order_id,
            "split_group_id": split_group_id,
            "num_portions": len(portions),
            "portions": [
                {
                    "portion_id": p.portion_id,
                    "portion_index": p.portion_index,
                    "amount_cents": p.amount_cents,
                    "tax_cents": p.tax_cents,
                    "payment_method": p.payment_method,
                    "items": p.items,
                    "paid": False,
                    "payment_id": None,
                }
                for p in portions
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase_client.table("split_payments").upsert(
                split_record, on_conflict="order_id,org_id"
            ).execute()
        except Exception:
            log.exception("split_payment.store_failed", order_id=order_id)
            raise

    def _get_split_data(self, order_id: str, org_id: str) -> dict | None:
        try:
            resp = (
                supabase_client.table("split_payments")
                .select("*")
                .eq("order_id", order_id)
                .eq("org_id", org_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception:
            log.exception("split_payment.get_split_failed", order_id=order_id)
            return None

    def _update_portion(self, order_id: str, org_id: str, portion_index: int, updates: dict) -> None:
        split_data = self._get_split_data(order_id, org_id)
        if not split_data:
            return

        portions = split_data.get("portions", [])
        if portion_index < len(portions):
            portions[portion_index].update(updates)

        try:
            supabase_client.table("split_payments").update({
                "portions": portions,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", split_data["id"]).execute()
        except Exception:
            log.exception("split_payment.update_portion_failed", order_id=order_id)

    def _insert_payment(self, record: dict) -> None:
        try:
            supabase_client.table("payments").insert(record).execute()
        except Exception:
            log.exception("split_payment.insert_failed", payment_id=record.get("id"))
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
            log.exception("split_payment.log_transaction_failed", payment_id=payment_id)

    def _update_order_balance(self, order_id: str, org_id: str, new_balance_cents: int) -> None:
        try:
            supabase_client.table("orders").update({
                "balance_due_cents": max(new_balance_cents, 0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", order_id).eq("org_id", org_id).execute()
        except Exception:
            log.exception("split_payment.update_balance_failed", order_id=order_id)

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
                "reason": "split_fully_paid",
            })
        except Exception:
            log.exception("split_payment.close_order_failed", order_id=order_id)
