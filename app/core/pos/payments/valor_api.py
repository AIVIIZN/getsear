"""
Valor PayTech REST API client for Sear POS.

Handles server-to-server communication with Valor for captures, voids,
refunds, tip adjustments, batch settlement, and health checks.

Card data never passes through this client. All card interaction happens
on the Valor terminal via ValorConnect (MQTT). This client only handles
operations that reference existing transaction IDs or tokens.

All amounts are INTEGER CENTS.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Optional

import httpx
import structlog

from app.core.pos.payments.valor import (
    AuthorizationResult,
    BatchResult,
    CardBrand,
    CardInfo,
    CaptureResult,
    EntryMode,
    GiftCardResult,
    RefundResult,
    TransactionStatus,
    VoidResult,
)

log = structlog.get_logger(__name__)

# Network errors worth retrying (never retry payment mutations)
_RETRYABLE_EXCEPTIONS = (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout)

_CARD_BRAND_MAP: dict[str, CardBrand] = {
    "visa": CardBrand.VISA,
    "mastercard": CardBrand.MASTERCARD,
    "amex": CardBrand.AMEX,
    "discover": CardBrand.DISCOVER,
    "diners": CardBrand.DINERS,
    "jcb": CardBrand.JCB,
    "unionpay": CardBrand.UNIONPAY,
}

_ENTRY_MODE_MAP: dict[str, EntryMode] = {
    "emv": EntryMode.EMV,
    "chip": EntryMode.EMV,
    "nfc": EntryMode.NFC,
    "contactless": EntryMode.NFC,
    "swipe": EntryMode.SWIPE,
    "mag_stripe": EntryMode.SWIPE,
    "manual": EntryMode.MANUAL,
    "keyed": EntryMode.MANUAL,
    "token": EntryMode.TOKEN,
}


class ValorAPIError(Exception):
    """Raised when Valor API returns a non-success response."""

    def __init__(self, status_code: int, message: str, raw: dict | None = None):
        self.status_code = status_code
        self.message = message
        self.raw = raw or {}
        super().__init__(f"Valor API error {status_code}: {message}")


class ValorAPIClient:
    """
    Communicates with Valor PayTech via REST API.

    Card data never touches Sear servers. This client handles post-auth
    operations (capture, void, refund, tip adjust, batch settlement) and
    card-not-present transactions via token.
    """

    def __init__(
        self,
        api_key: str,
        app_id: str,
        epi: str,
        base_url: str = "https://api.valorpaytech.com",
        timeout_seconds: float = 30.0,
        mock_mode: bool = False,
    ):
        self._api_key = api_key
        self._app_id = app_id
        self._epi = epi
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._mock_mode = mock_mode
        self._client: httpx.Client | None = None

    @classmethod
    def from_config(cls, config: dict) -> ValorAPIClient:
        """Build from Flask app config dict."""
        return cls(
            api_key=config.get("VALOR_API_KEY", ""),
            app_id=config.get("VALOR_APP_ID", ""),
            epi=config.get("VALOR_EPI", ""),
            base_url=config.get("VALOR_API_BASE", "https://api.valorpaytech.com"),
            timeout_seconds=float(config.get("VALOR_TIMEOUT", 30)),
            mock_mode=config.get("VALOR_MOCK", "false").lower() == "true",
        )

    # ── HTTP transport ───────────────────────────────────────────────

    @property
    def client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "X-App-Id": self._app_id,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        return self._client

    def close(self) -> None:
        if self._client and not self._client.is_closed:
            self._client.close()

    def _request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        *,
        allow_retry: bool = False,
    ) -> dict:
        """
        Make an authenticated request to Valor API.

        allow_retry=True only for idempotent reads (health_check, batch_status).
        Payment mutations (sale, auth, capture, void, refund) NEVER retry to
        prevent duplicate charges.
        """
        url = endpoint if endpoint.startswith("/") else f"/{endpoint}"
        attempts = 2 if allow_retry else 1
        last_exc: Exception | None = None

        for attempt in range(attempts):
            try:
                response = self.client.request(method, url, json=data)
                body = response.json()

                if response.status_code >= 400:
                    error_msg = body.get("message", body.get("error", "Unknown error"))
                    log.error(
                        "valor_api.error",
                        endpoint=url,
                        status_code=response.status_code,
                        error=error_msg,
                    )
                    raise ValorAPIError(response.status_code, error_msg, body)

                log.info(
                    "valor_api.request",
                    method=method,
                    endpoint=url,
                    status_code=response.status_code,
                )
                return body

            except _RETRYABLE_EXCEPTIONS as exc:
                last_exc = exc
                if attempt < attempts - 1:
                    backoff = 0.5 * (attempt + 1)
                    log.warning(
                        "valor_api.retry",
                        endpoint=url,
                        attempt=attempt + 1,
                        backoff_seconds=backoff,
                        error=str(exc),
                    )
                    time.sleep(backoff)
                else:
                    log.error(
                        "valor_api.network_failure",
                        endpoint=url,
                        error=str(exc),
                    )

        raise ValorAPIError(0, f"Network error after {attempts} attempt(s): {last_exc}")

    # ── Mock helpers ─────────────────────────────────────────────────

    @staticmethod
    def _mock_txn_id() -> str:
        return f"mock_{uuid.uuid4().hex[:12]}"

    @staticmethod
    def _mock_auth_code() -> str:
        return f"M{int(time.time()) % 100000:05d}"

    def _mock_card_info(self) -> CardInfo:
        return CardInfo(
            brand=CardBrand.VISA,
            last_four="4242",
            entry_mode=EntryMode.EMV,
            is_debit=False,
            token=f"tok_mock_{uuid.uuid4().hex[:8]}",
            cardholder_name="Test Customer",
        )

    # ── Sale / Auth ──────────────────────────────────────────────────

    def direct_sale(
        self,
        amount_cents: int,
        terminal_id: str,
        order_id: str = "",
        tip_cents: int = 0,
    ) -> AuthorizationResult:
        """Direct Sale — auth + capture in one step. Used for counter-service."""
        if self._mock_mode:
            txn_id = self._mock_txn_id()
            log.info("valor_api.mock.direct_sale", amount_cents=amount_cents, txn_id=txn_id)
            return AuthorizationResult(
                success=True,
                transaction_id=txn_id,
                auth_code=self._mock_auth_code(),
                amount_cents=amount_cents + tip_cents,
                card_info=self._mock_card_info(),
                processor_response={"mock": True, "type": "sale"},
            )

        data = {
            "epi": self._epi,
            "txn_type": "sale",
            "amount": amount_cents,
            "tip": tip_cents,
            "terminal_id": terminal_id,
            "invoice_number": order_id or uuid.uuid4().hex[:12],
        }
        result = self._request("POST", "/v1/sale", data)
        return self._parse_auth_result(result, amount_cents + tip_cents)

    def auth_only(
        self,
        amount_cents: int,
        terminal_id: str,
        order_id: str = "",
    ) -> AuthorizationResult:
        """Auth only — used for bar tabs, tip-adjust flow."""
        if self._mock_mode:
            txn_id = self._mock_txn_id()
            log.info("valor_api.mock.auth_only", amount_cents=amount_cents, txn_id=txn_id)
            return AuthorizationResult(
                success=True,
                transaction_id=txn_id,
                auth_code=self._mock_auth_code(),
                amount_cents=amount_cents,
                card_info=self._mock_card_info(),
                processor_response={"mock": True, "type": "auth"},
            )

        data = {
            "epi": self._epi,
            "txn_type": "auth",
            "amount": amount_cents,
            "terminal_id": terminal_id,
            "invoice_number": order_id or uuid.uuid4().hex[:12],
        }
        result = self._request("POST", "/v1/auth", data)
        return self._parse_auth_result(result, amount_cents)

    def incremental_auth(
        self,
        transaction_id: str,
        additional_cents: int,
    ) -> AuthorizationResult:
        """Increase existing auth for bar tabs exceeding initial hold."""
        if self._mock_mode:
            log.info(
                "valor_api.mock.incremental_auth",
                transaction_id=transaction_id,
                additional_cents=additional_cents,
            )
            return AuthorizationResult(
                success=True,
                transaction_id=transaction_id,
                auth_code=self._mock_auth_code(),
                amount_cents=additional_cents,
                processor_response={"mock": True, "type": "incremental_auth"},
            )

        data = {
            "transaction_id": transaction_id,
            "additional_amount": additional_cents,
        }
        result = self._request("POST", "/v1/incremental-auth", data)
        return self._parse_auth_result(result, additional_cents)

    # ── Capture / Tip ────────────────────────────────────────────────

    def capture_with_tip(
        self,
        transaction_id: str,
        tip_cents: int = 0,
    ) -> CaptureResult:
        """Capture a previously authorized transaction, optionally adding tip."""
        if self._mock_mode:
            log.info(
                "valor_api.mock.capture",
                transaction_id=transaction_id,
                tip_cents=tip_cents,
            )
            return CaptureResult(
                success=True,
                transaction_id=transaction_id,
                captured_amount_cents=0,  # processor fills this from the auth amount
                tip_amount_cents=tip_cents,
            )

        data = {
            "transaction_id": transaction_id,
            "tip": tip_cents,
        }
        result = self._request("POST", "/v1/capture", data)
        return CaptureResult(
            success=result.get("status") == "approved",
            transaction_id=result.get("transaction_id", transaction_id),
            captured_amount_cents=result.get("amount", 0),
            tip_amount_cents=tip_cents,
            error_message=result.get("error_message"),
        )

    def tip_adjust(
        self,
        transaction_id: str,
        tip_cents: int,
    ) -> CaptureResult:
        """Adjust tip on a captured-but-unsettled transaction."""
        if self._mock_mode:
            log.info(
                "valor_api.mock.tip_adjust",
                transaction_id=transaction_id,
                tip_cents=tip_cents,
            )
            return CaptureResult(
                success=True,
                transaction_id=transaction_id,
                captured_amount_cents=0,
                tip_amount_cents=tip_cents,
            )

        data = {
            "transaction_id": transaction_id,
            "tip": tip_cents,
        }
        result = self._request("POST", "/v1/tip-adjust", data)
        return CaptureResult(
            success=result.get("status") == "approved",
            transaction_id=result.get("transaction_id", transaction_id),
            captured_amount_cents=result.get("total_amount", 0),
            tip_amount_cents=tip_cents,
            error_message=result.get("error_message"),
        )

    # ── Void / Refund ────────────────────────────────────────────────

    def void_transaction(self, transaction_id: str) -> VoidResult:
        """Void an authorized/captured transaction before settlement."""
        if self._mock_mode:
            log.info("valor_api.mock.void", transaction_id=transaction_id)
            return VoidResult(
                success=True,
                transaction_id=transaction_id,
                voided_amount_cents=0,
            )

        data = {"transaction_id": transaction_id}
        result = self._request("POST", "/v1/void", data)
        return VoidResult(
            success=result.get("status") == "approved",
            transaction_id=result.get("transaction_id", transaction_id),
            voided_amount_cents=result.get("amount", 0),
            error_message=result.get("error_message"),
        )

    def refund_transaction(
        self,
        transaction_id: str,
        amount_cents: int | None = None,
    ) -> RefundResult:
        """Refund a settled transaction. None = full refund, int = partial."""
        if self._mock_mode:
            refund_id = self._mock_txn_id()
            log.info(
                "valor_api.mock.refund",
                transaction_id=transaction_id,
                amount_cents=amount_cents,
                refund_id=refund_id,
            )
            return RefundResult(
                success=True,
                refund_id=refund_id,
                refund_amount_cents=amount_cents or 0,
                original_transaction_id=transaction_id,
            )

        data: dict = {"transaction_id": transaction_id}
        if amount_cents is not None:
            data["amount"] = amount_cents
        result = self._request("POST", "/v1/refund", data)
        return RefundResult(
            success=result.get("status") == "approved",
            refund_id=result.get("refund_id", ""),
            refund_amount_cents=result.get("amount", 0),
            original_transaction_id=transaction_id,
            error_message=result.get("error_message"),
        )

    # ── Batch / Settlement ───────────────────────────────────────────

    def settle_batch(self) -> BatchResult:
        """Manually close the current batch and initiate settlement."""
        if self._mock_mode:
            batch_id = f"batch_mock_{uuid.uuid4().hex[:8]}"
            log.info("valor_api.mock.settle_batch", batch_id=batch_id)
            return BatchResult(
                success=True,
                batch_id=batch_id,
                transaction_count=0,
                total_amount_cents=0,
                net_amount_cents=0,
            )

        data = {"epi": self._epi}
        result = self._request("POST", "/v1/settlement", data)
        return BatchResult(
            success=result.get("status") == "approved",
            batch_id=result.get("batch_id", ""),
            transaction_count=result.get("transaction_count", 0),
            total_amount_cents=result.get("total_amount", 0),
            net_amount_cents=result.get("net_amount", 0),
            error_message=result.get("error_message"),
        )

    def get_batch_status(self, batch_id: str) -> BatchResult:
        """Get status of a specific batch."""
        if self._mock_mode:
            log.info("valor_api.mock.batch_status", batch_id=batch_id)
            return BatchResult(
                success=True,
                batch_id=batch_id,
                transaction_count=0,
                total_amount_cents=0,
                net_amount_cents=0,
            )

        result = self._request(
            "GET",
            f"/v1/settlement/{batch_id}",
            allow_retry=True,
        )
        return BatchResult(
            success=True,
            batch_id=batch_id,
            transaction_count=result.get("transaction_count", 0),
            total_amount_cents=result.get("total_amount", 0),
            net_amount_cents=result.get("net_amount", 0),
            settled_at=(
                None  # caller parses if present
            ),
            error_message=result.get("error_message"),
        )

    # ── Health ───────────────────────────────────────────────────────

    def health_check(self) -> dict:
        """
        Check Valor API connectivity.

        Returns {"status": "ok"|"degraded"|"down", "latency_ms": int}.
        """
        if self._mock_mode:
            return {"status": "ok", "latency_ms": 1, "mock": True}

        start = time.monotonic()
        try:
            self._request("GET", "/v1/health", allow_retry=True)
            latency_ms = int((time.monotonic() - start) * 1000)
            status = "ok" if latency_ms < 2000 else "degraded"
            return {"status": status, "latency_ms": latency_ms}
        except (ValorAPIError, Exception) as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            log.error("valor_api.health_check_failed", error=str(exc))
            return {"status": "down", "latency_ms": latency_ms, "error": str(exc)}

    # ── Response parsing ─────────────────────────────────────────────

    def _parse_auth_result(self, result: dict, amount_cents: int) -> AuthorizationResult:
        """Parse a Valor auth/sale response into our AuthorizationResult."""
        approved = result.get("status") == "approved"
        card_data = result.get("card")
        card_info = self._extract_card_info(card_data) if card_data else None

        return AuthorizationResult(
            success=approved,
            transaction_id=result.get("transaction_id", ""),
            auth_code=result.get("auth_code", ""),
            amount_cents=amount_cents,
            card_info=card_info,
            processor_response=result,
            decline_code=result.get("response_code") if not approved else None,
            decline_reason=result.get("response_text") if not approved else None,
            error_message=result.get("error_message") if not approved else None,
        )

    @staticmethod
    def _extract_card_info(card: dict) -> CardInfo:
        """Extract masked card info from Valor response. Never stores full PAN."""
        brand_raw = card.get("brand", "unknown").lower()
        entry_raw = card.get("entry_mode", "emv").lower()

        return CardInfo(
            brand=_CARD_BRAND_MAP.get(brand_raw, CardBrand.UNKNOWN),
            last_four=card.get("last4", card.get("last_four", "")),
            entry_mode=_ENTRY_MODE_MAP.get(entry_raw, EntryMode.EMV),
            is_debit=card.get("is_debit", False),
            token=card.get("token"),
            cardholder_name=card.get("cardholder_name"),
            exp_month=card.get("exp_month"),
            exp_year=card.get("exp_year"),
        )
