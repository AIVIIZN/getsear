"""
Valor PayTech payment integration layer for Sear POS.

Card data never touches Sear servers. All card interaction happens on
Valor terminals (P2PE encrypted). We store only tokens, last_four,
brand, and auth codes.
"""

from app.core.pos.payments.valor import (
    AuthorizationResult,
    BatchResult,
    CardBrand,
    CardInfo,
    CaptureResult,
    GiftCardResult,
    PaymentMethod,
    ReaderDevice,
    RefundResult,
    TransactionStatus,
    VoidResult,
)
from app.core.pos.payments.processor import PaymentProcessor
from app.core.pos.payments.surcharge import SurchargeCalculator
from app.core.pos.payments.valor_api import ValorAPIClient
from app.core.pos.payments.valor_connect import ValorConnectClient

__all__ = [
    "AuthorizationResult",
    "BatchResult",
    "CardBrand",
    "CardInfo",
    "CaptureResult",
    "GiftCardResult",
    "PaymentMethod",
    "PaymentProcessor",
    "ReaderDevice",
    "RefundResult",
    "SurchargeCalculator",
    "TransactionStatus",
    "ValorAPIClient",
    "ValorConnectClient",
    "VoidResult",
]
