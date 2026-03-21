"""
Core Valor PayTech data structures for Sear POS.

All amounts are INTEGER CENTS. No floats for money, ever.
No full card numbers stored anywhere — only tokens, last_four, brand, auth codes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


# ── Enums ────────────────────────────────────────────────────────────────


class PaymentMethod(Enum):
    CASH = "cash"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    GIFT_CARD = "gift_card"
    HOUSE_ACCOUNT = "house_account"
    APPLE_PAY = "apple_pay"
    GOOGLE_PAY = "google_pay"
    EXTERNAL = "external"


class TransactionStatus(Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    SETTLED = "settled"
    DECLINED = "declined"
    VOIDED = "voided"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    FAILED = "failed"
    EXPIRED = "expired"


class CardBrand(Enum):
    VISA = "visa"
    MASTERCARD = "mastercard"
    AMEX = "amex"
    DISCOVER = "discover"
    DINERS = "diners"
    JCB = "jcb"
    UNIONPAY = "unionpay"
    UNKNOWN = "unknown"


class EntryMode(Enum):
    EMV = "emv"
    NFC = "nfc"
    SWIPE = "swipe"
    MANUAL = "manual"
    TOKEN = "token"
    ONLINE = "online"


class ConnectionType(Enum):
    BLUETOOTH = "bluetooth"
    NETWORK = "network"
    USB = "usb"


class ReaderStatus(Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    ERROR = "error"


# ── Data Classes ─────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CardInfo:
    """Masked card info returned from processor. NEVER contains full PAN."""

    brand: CardBrand
    last_four: str
    entry_mode: EntryMode
    is_debit: bool = False
    token: Optional[str] = None
    cardholder_name: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None


@dataclass(frozen=True)
class AuthorizationResult:
    success: bool
    transaction_id: str
    auth_code: str
    amount_cents: int
    card_info: Optional[CardInfo] = None
    processor_response: Optional[dict] = None
    decline_code: Optional[str] = None
    decline_reason: Optional[str] = None
    error_message: Optional[str] = None


@dataclass(frozen=True)
class CaptureResult:
    success: bool
    transaction_id: str
    captured_amount_cents: int
    tip_amount_cents: int = 0
    error_message: Optional[str] = None


@dataclass(frozen=True)
class RefundResult:
    success: bool
    refund_id: str
    refund_amount_cents: int
    original_transaction_id: str = ""
    error_message: Optional[str] = None


@dataclass(frozen=True)
class VoidResult:
    success: bool
    transaction_id: str
    voided_amount_cents: int = 0
    error_message: Optional[str] = None


@dataclass(frozen=True)
class BatchResult:
    success: bool
    batch_id: str
    transaction_count: int
    total_amount_cents: int
    net_amount_cents: int = 0
    settled_at: Optional[datetime] = None
    error_message: Optional[str] = None


@dataclass
class ReaderDevice:
    serial: str
    model: str
    label: str
    connection_type: ConnectionType
    status: ReaderStatus
    battery_level: Optional[int] = None
    firmware_version: Optional[str] = None


@dataclass(frozen=True)
class GiftCardResult:
    success: bool
    card_number_masked: str
    balance_cents: int
    amount_applied_cents: int = 0
    error_message: Optional[str] = None
