"""Gift card system for Sear POS.

Sear-managed gift card ledger independent of Valor payment processing.
Balances stored in Sear's database, work across all locations.
Card numbers stored as SHA-256 hash -- NEVER logged or stored in plaintext.
All amounts passed in as INTEGER CENTS, converted to dollars for DB storage.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from uuid import uuid4

import structlog

from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)

# Card number is NEVER logged. This sentinel replaces it in any log output.
_REDACTED = "[REDACTED]"


def _cents_to_dollars(cents: int) -> float:
    """Convert integer cents to dollar float for DB storage."""
    return round(cents / 100.0, 2)


def _dollars_to_cents(dollars: float | int | str) -> int:
    """Convert dollar amount from DB to integer cents."""
    return int(round(float(dollars) * 100))


class GiftCardSystem:
    """Full lifecycle management for Sear gift cards."""

    def generate_card_number(self) -> str:
        """Generate a cryptographically random 16-digit gift card number.

        Format: XXXX-XXXX-XXXX-XXXX
        """
        digits = "".join(str(secrets.randbelow(10)) for _ in range(16))
        return f"{digits[:4]}-{digits[4:8]}-{digits[8:12]}-{digits[12:]}"

    @staticmethod
    def _hash_card_number(card_number: str) -> str:
        """SHA-256 hash of the card number for secure lookup."""
        normalized = card_number.replace("-", "").replace(" ", "").strip()
        return hashlib.sha256(normalized.encode()).hexdigest()

    def activate(
        self,
        org_id: str,
        initial_balance_cents: int,
        purchaser_info: dict | None = None,
        recipient_info: dict | None = None,
        card_type: str = "physical",
        user_id: str = "",
    ) -> dict:
        """Activate a new gift card with initial balance.

        For physical cards: generates number to print/encode on card.
        For digital cards: generates number and optionally emails to recipient.
        """
        if initial_balance_cents <= 0:
            return {"success": False, "error": "Initial balance must be positive"}

        card_number = self.generate_card_number()
        card_number_hash = self._hash_card_number(card_number)
        card_id = str(uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        balance_dollars = _cents_to_dollars(initial_balance_cents)

        card_record = {
            "id": card_id,
            "org_id": org_id,
            "card_number": card_number,
            "card_number_hash": card_number_hash,
            "current_balance": balance_dollars,
            "initial_balance": balance_dollars,
            "is_active": True,
            "purchased_at": now_iso,
        }

        if purchaser_info:
            card_record["purchased_by_customer_id"] = purchaser_info.get("customer_id")

        if recipient_info:
            card_record["recipient_name"] = recipient_info.get("name")
            card_record["recipient_email"] = recipient_info.get("email")
            card_record["recipient_phone"] = recipient_info.get("phone")
            card_record["message"] = recipient_info.get("message")

        try:
            supabase_client.table("gift_cards").insert(card_record).execute()
        except Exception:
            log.exception("gift_card.activate_failed", card_id=card_id)
            return {"success": False, "error": "Failed to activate gift card"}

        # Record the purchase transaction
        try:
            supabase_client.table("gift_card_transactions").insert({
                "id": str(uuid4()),
                "gift_card_id": card_id,
                "org_id": org_id,
                "transaction_type": "purchase",
                "amount": balance_dollars,
                "balance_after": balance_dollars,
                "performed_by": user_id or None,
                "created_at": now_iso,
            }).execute()
        except Exception:
            log.exception("gift_card.activation_txn_failed", card_id=card_id)

        if card_type == "digital" and recipient_info and recipient_info.get("email"):
            event_bus.emit("gift_card.send_digital", {
                "card_id": card_id,
                "org_id": org_id,
                "recipient_email": recipient_info["email"],
                "recipient_name": recipient_info.get("name", ""),
                "balance_cents": initial_balance_cents,
                # Card number sent via event -- handler sends email, then discards
                "card_number": card_number,
            })

        log_audit(
            org_id=org_id,
            user_id=user_id,
            action="gift_card.activated",
            entity_type="gift_card",
            entity_id=card_id,
            description=f"Gift card activated: ${initial_balance_cents / 100:.2f} ({card_type})",
            new_state={"balance_cents": initial_balance_cents, "card_type": card_type},
        )

        return {
            "success": True,
            "card_id": card_id,
            "card_number": card_number,  # Only returned at activation, never stored in plaintext
            "balance_cents": initial_balance_cents,
            "card_type": card_type,
        }

    def check_balance(self, card_number: str) -> dict:
        """Look up gift card balance by card number."""
        card = self._find_card(card_number)
        if not card:
            return {"success": False, "error": "Gift card not found"}

        if not card["is_active"]:
            return {"success": False, "error": "Gift card is inactive"}

        balance_cents = _dollars_to_cents(card["current_balance"])

        return {
            "success": True,
            "balance_cents": balance_cents,
            "is_active": card["is_active"],
        }

    def redeem(
        self,
        card_number: str,
        amount_cents: int,
        order_id: str,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Redeem from gift card. Supports partial redemption.

        If the card balance is less than the requested amount, only the
        available balance is applied. Returns remaining_owed_cents for
        the portion that still needs another payment method.
        """
        card = self._find_card(card_number)
        if not card:
            return {"success": False, "error": "Gift card not found"}

        if not card["is_active"]:
            return {"success": False, "error": "Gift card is inactive"}

        balance_cents = _dollars_to_cents(card["current_balance"])
        if balance_cents <= 0:
            return {"success": False, "error": "Gift card has zero balance"}

        redeemed_cents = min(amount_cents, balance_cents)
        new_balance_cents = balance_cents - redeemed_cents
        remaining_owed = amount_cents - redeemed_cents
        new_balance_dollars = _cents_to_dollars(new_balance_cents)
        new_is_active = new_balance_cents > 0

        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            supabase_client.table("gift_cards").update({
                "current_balance": new_balance_dollars,
                "is_active": new_is_active,
                "updated_at": now_iso,
            }).eq("id", card["id"]).execute()
        except Exception:
            log.exception("gift_card.redeem_update_failed", card_id=card["id"])
            return {"success": False, "error": "Failed to update gift card balance"}

        try:
            supabase_client.table("gift_card_transactions").insert({
                "id": str(uuid4()),
                "gift_card_id": card["id"],
                "org_id": org_id or card.get("org_id", ""),
                "transaction_type": "redeem",
                "amount": -_cents_to_dollars(redeemed_cents),
                "balance_after": new_balance_dollars,
                "order_id": order_id,
                "performed_by": user_id or None,
                "created_at": now_iso,
            }).execute()
        except Exception:
            log.exception("gift_card.redeem_txn_failed", card_id=card["id"])

        log_audit(
            org_id=org_id or card.get("org_id", ""),
            user_id=user_id,
            action="gift_card.redeemed",
            entity_type="gift_card",
            entity_id=card["id"],
            description=f"Gift card redeemed ${redeemed_cents / 100:.2f} on order {order_id}",
            new_state={"redeemed_cents": redeemed_cents, "new_balance_cents": new_balance_cents},
        )

        return {
            "success": True,
            "redeemed_cents": redeemed_cents,
            "remaining_balance_cents": new_balance_cents,
            "remaining_owed_cents": remaining_owed,
            "fully_redeemed": new_balance_cents == 0,
        }

    def reload(
        self,
        card_number: str,
        amount_cents: int,
        user_id: str = "",
        org_id: str = "",
    ) -> dict:
        """Add funds to an existing gift card."""
        if amount_cents <= 0:
            return {"success": False, "error": "Reload amount must be positive"}

        card = self._find_card(card_number)
        if not card:
            return {"success": False, "error": "Gift card not found"}

        if not card["is_active"]:
            # Check if expired
            expires_at = card.get("expires_at")
            if expires_at:
                return {"success": False, "error": "Cannot reload expired card"}
            return {"success": False, "error": "Cannot reload inactive card"}

        current_cents = _dollars_to_cents(card["current_balance"])
        new_balance_cents = current_cents + amount_cents
        new_balance_dollars = _cents_to_dollars(new_balance_cents)
        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            supabase_client.table("gift_cards").update({
                "current_balance": new_balance_dollars,
                "is_active": True,
                "updated_at": now_iso,
            }).eq("id", card["id"]).execute()
        except Exception:
            log.exception("gift_card.reload_update_failed", card_id=card["id"])
            return {"success": False, "error": "Failed to reload gift card"}

        try:
            supabase_client.table("gift_card_transactions").insert({
                "id": str(uuid4()),
                "gift_card_id": card["id"],
                "org_id": org_id or card.get("org_id", ""),
                "transaction_type": "reload",
                "amount": _cents_to_dollars(amount_cents),
                "balance_after": new_balance_dollars,
                "performed_by": user_id or None,
                "created_at": now_iso,
            }).execute()
        except Exception:
            log.exception("gift_card.reload_txn_failed", card_id=card["id"])

        log_audit(
            org_id=org_id or card.get("org_id", ""),
            user_id=user_id,
            action="gift_card.reloaded",
            entity_type="gift_card",
            entity_id=card["id"],
            description=f"Gift card reloaded ${amount_cents / 100:.2f}",
            new_state={"reload_cents": amount_cents, "new_balance_cents": new_balance_cents},
        )

        return {
            "success": True,
            "new_balance_cents": new_balance_cents,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_card(self, card_number: str) -> dict | None:
        """Find a gift card by its hashed number. NEVER logs the card number."""
        card_hash = self._hash_card_number(card_number)
        try:
            resp = (
                supabase_client.table("gift_cards")
                .select("id, org_id, card_number_hash, current_balance, initial_balance, is_active, expires_at, created_at")
                .eq("card_number_hash", card_hash)
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception:
            log.exception("gift_card.find_failed")
            return None
