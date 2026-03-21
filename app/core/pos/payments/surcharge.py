"""
Surcharge and Cash Discount calculator for Sear POS.

Implements both surcharging (where legal) and Valor's Dual Pricing
cash discount model. Surcharging has state prohibitions, state caps,
and network caps. Cash discount (Dual Pricing) is legal in all 50 states.

All amounts are INTEGER CENTS.
"""

from __future__ import annotations

from app.core.pos.payments.valor import CardBrand

# States that PROHIBIT surcharging as of 2026
SURCHARGE_PROHIBITED_STATES: frozenset[str] = frozenset({
    "CT",  # Connecticut
    "MA",  # Massachusetts
    "PR",  # Puerto Rico
})

# State-specific surcharge caps (percentage, e.g., 200 = 2.00%)
# Stored as basis points * 100 for precision (integer math)
_STATE_CAP_BPS: dict[str, int] = {
    "CO": 200,  # Colorado caps at 2%
}
_DEFAULT_CAP_BPS: int = 300  # Most states: 3%

# Network-level surcharge caps (percentage as basis points)
_NETWORK_CAP_BPS: dict[CardBrand, int] = {
    CardBrand.VISA: 300,        # Visa caps at 3%
    CardBrand.MASTERCARD: 400,  # Mastercard caps at 4%
    CardBrand.AMEX: 300,        # Amex: 3%
    CardBrand.DISCOVER: 300,    # Discover: 3%
    CardBrand.DINERS: 400,      # Diners: 4%
    CardBrand.JCB: 300,         # JCB: 3%
    CardBrand.UNIONPAY: 300,    # UnionPay: 3%
}
_DEFAULT_NETWORK_CAP_BPS: int = 300


class SurchargeCalculator:
    """
    Calculates surcharges and cash discounts in compliance with
    state laws, federal law (Durbin Amendment), and card network rules.

    Debit cards are NEVER surcharged (federal law).
    Prepaid cards are NEVER surcharged.
    """

    def __init__(
        self,
        state: str,
        merchant_rate_bps: int = 300,
        cash_discount_rate_bps: int = 400,
    ):
        """
        state:                Two-letter state code (e.g., "WA").
        merchant_rate_bps:    Merchant's actual processing cost in basis points
                              (e.g., 300 = 3.00%).
        cash_discount_rate_bps: Dual Pricing discount rate in basis points
                              (e.g., 400 = 4.00%). Valor default.
        """
        self._state = state.upper().strip()
        self._merchant_rate_bps = merchant_rate_bps
        self._cash_discount_rate_bps = cash_discount_rate_bps

    # ── Surcharging ──────────────────────────────────────────────────

    def is_surcharge_allowed(self, state: str | None = None) -> bool:
        """Check if surcharging is legal in the given state."""
        check_state = (state or self._state).upper().strip()
        return check_state not in SURCHARGE_PROHIBITED_STATES

    def get_effective_rate(
        self,
        state: str | None,
        card_brand: CardBrand,
        merchant_rate_bps: int | None = None,
    ) -> int:
        """
        Return the effective surcharge rate in basis points.

        This is the minimum of:
          1. Merchant's actual processing cost
          2. State cap
          3. Network cap

        Returns 0 if surcharging is prohibited in the state.
        """
        check_state = (state or self._state).upper().strip()
        if check_state in SURCHARGE_PROHIBITED_STATES:
            return 0

        merchant = merchant_rate_bps if merchant_rate_bps is not None else self._merchant_rate_bps
        state_cap = _STATE_CAP_BPS.get(check_state, _DEFAULT_CAP_BPS)
        network_cap = _NETWORK_CAP_BPS.get(card_brand, _DEFAULT_NETWORK_CAP_BPS)

        return min(merchant, state_cap, network_cap)

    def calculate_surcharge(
        self,
        subtotal_cents: int,
        card_brand: CardBrand,
        is_debit: bool,
        state: str | None = None,
    ) -> int:
        """
        Calculate the surcharge amount in cents for a card transaction.

        Returns 0 if:
          - Surcharging is prohibited in the state
          - Card is debit (Durbin Amendment — federal law)
          - Subtotal is zero or negative

        The surcharge is: subtotal * effective_rate / 10000
        (effective_rate is in basis points, e.g., 300 = 3.00%)
        """
        if subtotal_cents <= 0:
            return 0

        # Debit cards CANNOT be surcharged (Durbin Amendment)
        if is_debit:
            return 0

        check_state = (state or self._state).upper().strip()
        if check_state in SURCHARGE_PROHIBITED_STATES:
            return 0

        rate_bps = self.get_effective_rate(check_state, card_brand)
        if rate_bps <= 0:
            return 0

        # Integer math: subtotal_cents * rate_bps / 10000
        # Round to nearest cent using integer arithmetic
        surcharge = (subtotal_cents * rate_bps + 5000) // 10000
        return surcharge

    # ── Cash Discount (Dual Pricing) ─────────────────────────────────

    def calculate_cash_discount(
        self,
        subtotal_cents: int,
        discount_rate_bps: int | None = None,
    ) -> int:
        """
        Calculate the cash discount amount in cents.

        Valor Dual Pricing model: menu prices are the CARD price.
        Cash customers pay less. Legal in all 50 states because it's
        structured as a discount, not a surcharge.

        discount_rate_bps defaults to the instance's cash_discount_rate_bps
        (typically 400 = 4.00%).

        Returns the discount in cents (always positive or zero).
        """
        if subtotal_cents <= 0:
            return 0

        rate = discount_rate_bps if discount_rate_bps is not None else self._cash_discount_rate_bps
        if rate <= 0:
            return 0

        # Integer math: subtotal * rate / 10000, rounded to nearest cent
        discount = (subtotal_cents * rate + 5000) // 10000
        return discount

    # ── Convenience methods ──────────────────────────────────────────

    def get_pricing_breakdown(
        self,
        subtotal_cents: int,
        card_brand: CardBrand,
        is_debit: bool,
        state: str | None = None,
    ) -> dict:
        """
        Return a full pricing breakdown for display on receipts and
        the VP800 customer-facing screen.

        {
            "subtotal_cents": 1500,
            "card_price_cents": 1500,             # What they pay with card
            "cash_price_cents": 1440,             # What they pay with cash
            "cash_discount_cents": 60,            # Dual Pricing discount
            "surcharge_cents": 0,                 # 0 if using Dual Pricing
            "surcharge_allowed": True,
            "surcharge_rate_bps": 300,
            "cash_discount_rate_bps": 400,
            "is_debit": False,
        }
        """
        check_state = (state or self._state).upper().strip()
        surcharge_allowed = self.is_surcharge_allowed(check_state)
        surcharge_rate = self.get_effective_rate(check_state, card_brand) if surcharge_allowed else 0
        surcharge_cents = self.calculate_surcharge(subtotal_cents, card_brand, is_debit, check_state)
        cash_discount_cents = self.calculate_cash_discount(subtotal_cents)

        return {
            "subtotal_cents": subtotal_cents,
            "card_price_cents": subtotal_cents,
            "cash_price_cents": subtotal_cents - cash_discount_cents,
            "cash_discount_cents": cash_discount_cents,
            "surcharge_cents": surcharge_cents,
            "surcharge_allowed": surcharge_allowed,
            "surcharge_rate_bps": surcharge_rate,
            "cash_discount_rate_bps": self._cash_discount_rate_bps,
            "is_debit": is_debit,
        }
