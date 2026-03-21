"""
Valor Connect client — MQTT-based communication with Valor terminals.

Valor Connect is the cloud protocol Valor PayTech uses for POS-to-terminal
communication. The terminal handles all PCI-sensitive card interaction
(P2PE encrypted). Sear's server sends transaction requests; the terminal
collects the card, encrypts at the hardware level, and routes through
Valor's network to the backend processor.

When VALOR_MOCK=true, this client simulates terminal responses without
any real hardware or MQTT connection.

All amounts are INTEGER CENTS.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from typing import Optional

import structlog

from app.core.pos.payments.valor import (
    AuthorizationResult,
    CardBrand,
    CardInfo,
    CaptureResult,
    ConnectionType,
    EntryMode,
    ReaderDevice,
    ReaderStatus,
    TransactionStatus,
)

log = structlog.get_logger(__name__)

# Timeout waiting for customer to interact with terminal (tap/insert/swipe)
_TERMINAL_TIMEOUT_SECONDS = 120

# MQTT topic patterns for Valor Connect
_TOPIC_REQUEST = "valorconnect/{epi}/terminal/{serial}/request"
_TOPIC_RESPONSE = "valorconnect/{epi}/terminal/{serial}/response"
_TOPIC_STATUS = "valorconnect/{epi}/terminal/{serial}/status"

# Maps Valor's card_type field to our CardBrand enum
_BRAND_MAP: dict[str, CardBrand] = {
    "visa": CardBrand.VISA,
    "mastercard": CardBrand.MASTERCARD,
    "mc": CardBrand.MASTERCARD,
    "amex": CardBrand.AMEX,
    "american_express": CardBrand.AMEX,
    "discover": CardBrand.DISCOVER,
    "diners": CardBrand.DINERS,
    "jcb": CardBrand.JCB,
    "unionpay": CardBrand.UNIONPAY,
    "cup": CardBrand.UNIONPAY,
}

_ENTRY_MAP: dict[str, EntryMode] = {
    "emv": EntryMode.EMV,
    "chip": EntryMode.EMV,
    "nfc": EntryMode.NFC,
    "contactless": EntryMode.NFC,
    "tap": EntryMode.NFC,
    "swipe": EntryMode.SWIPE,
    "mag": EntryMode.SWIPE,
    "manual": EntryMode.MANUAL,
    "keyed": EntryMode.MANUAL,
}


class ValorConnectError(Exception):
    """Raised when a Valor Connect operation fails."""

    def __init__(self, message: str, terminal_serial: str = "", raw: dict | None = None):
        self.terminal_serial = terminal_serial
        self.raw = raw or {}
        super().__init__(message)


class ValorConnectClient:
    """
    MQTT-based communication with Valor payment terminals.

    In production, connects to Valor's MQTT broker and publishes transaction
    commands to the terminal's topic. The terminal collects the card, processes
    the payment via Valor's network, and publishes the result back.

    In mock mode (VALOR_MOCK=true), simulates all terminal interactions with
    configurable delays to mimic real-world behavior.
    """

    def __init__(
        self,
        api_key: str,
        app_id: str,
        epi: str,
        mqtt_broker: str = "connect.valorpaytech.com",
        mqtt_port: int = 8883,
        mock_mode: bool = False,
    ):
        self._api_key = api_key
        self._app_id = app_id
        self._epi = epi
        self._mqtt_broker = mqtt_broker
        self._mqtt_port = mqtt_port
        self._mock_mode = mock_mode

        self._mqtt_client = None  # paho.mqtt.client.Client when connected
        self._connected = False
        self._lock = threading.Lock()
        self._pending_responses: dict[str, threading.Event] = {}
        self._response_data: dict[str, dict] = {}
        self._known_readers: dict[str, ReaderDevice] = {}

    @classmethod
    def from_config(cls, config: dict) -> ValorConnectClient:
        """Build from Flask app config dict."""
        return cls(
            api_key=config.get("VALOR_API_KEY", ""),
            app_id=config.get("VALOR_APP_ID", ""),
            epi=config.get("VALOR_EPI", ""),
            mqtt_broker=config.get("VALOR_MQTT_BROKER", "connect.valorpaytech.com"),
            mqtt_port=int(config.get("VALOR_MQTT_PORT", 8883)),
            mock_mode=config.get("VALOR_MOCK", "false").lower() == "true",
        )

    # ── Connection lifecycle ─────────────────────────────────────────

    def connect(self) -> bool:
        """Establish MQTT connection to Valor Connect broker."""
        if self._mock_mode:
            self._connected = True
            log.info("valor_connect.mock.connected")
            return True

        try:
            import paho.mqtt.client as mqtt

            self._mqtt_client = mqtt.Client(
                client_id=f"sear_{self._epi}_{uuid.uuid4().hex[:8]}",
                protocol=mqtt.MQTTv311,
            )
            self._mqtt_client.username_pw_set(self._app_id, self._api_key)
            self._mqtt_client.tls_set()
            self._mqtt_client.on_connect = self._on_connect
            self._mqtt_client.on_message = self._on_message
            self._mqtt_client.on_disconnect = self._on_disconnect

            self._mqtt_client.connect(self._mqtt_broker, self._mqtt_port, keepalive=60)
            self._mqtt_client.loop_start()

            # Wait for connection confirmation (up to 10 seconds)
            deadline = time.monotonic() + 10
            while not self._connected and time.monotonic() < deadline:
                time.sleep(0.1)

            if not self._connected:
                log.error("valor_connect.connection_timeout", broker=self._mqtt_broker)
                return False

            log.info("valor_connect.connected", broker=self._mqtt_broker)
            return True

        except ImportError:
            log.error("valor_connect.paho_not_installed", hint="pip install paho-mqtt")
            return False
        except Exception as exc:
            log.error("valor_connect.connection_failed", error=str(exc))
            return False

    def disconnect(self) -> None:
        """Disconnect from Valor Connect broker."""
        if self._mock_mode:
            self._connected = False
            log.info("valor_connect.mock.disconnected")
            return

        if self._mqtt_client:
            self._mqtt_client.loop_stop()
            self._mqtt_client.disconnect()
            self._mqtt_client = None
        self._connected = False
        log.info("valor_connect.disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ── MQTT callbacks ───────────────────────────────────────────────

    def _on_connect(self, client, userdata, flags, rc) -> None:
        if rc == 0:
            self._connected = True
            # Subscribe to response topics for all terminals under this EPI
            topic = f"valorconnect/{self._epi}/terminal/+/response"
            client.subscribe(topic, qos=1)
            status_topic = f"valorconnect/{self._epi}/terminal/+/status"
            client.subscribe(status_topic, qos=1)
            log.info("valor_connect.mqtt.subscribed", topic=topic)
        else:
            self._connected = False
            log.error("valor_connect.mqtt.connect_failed", return_code=rc)

    def _on_message(self, client, userdata, msg) -> None:
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            topic_parts = msg.topic.split("/")
            # topic: valorconnect/{epi}/terminal/{serial}/{type}
            if len(topic_parts) >= 5:
                serial = topic_parts[3]
                msg_type = topic_parts[4]

                if msg_type == "response":
                    request_id = payload.get("request_id", "")
                    with self._lock:
                        self._response_data[request_id] = payload
                        event = self._pending_responses.get(request_id)
                        if event:
                            event.set()
                    log.info(
                        "valor_connect.response_received",
                        serial=serial,
                        request_id=request_id,
                    )

                elif msg_type == "status":
                    self._handle_status_update(serial, payload)

        except Exception as exc:
            log.error("valor_connect.message_parse_error", error=str(exc))

    def _on_disconnect(self, client, userdata, rc) -> None:
        self._connected = False
        if rc != 0:
            log.warning("valor_connect.unexpected_disconnect", return_code=rc)
            # Paho auto-reconnects by default when loop_start is running

    def _handle_status_update(self, serial: str, payload: dict) -> None:
        """Process terminal status update from MQTT."""
        status_str = payload.get("status", "offline").lower()
        status_map = {
            "online": ReaderStatus.ONLINE,
            "offline": ReaderStatus.OFFLINE,
            "busy": ReaderStatus.BUSY,
            "error": ReaderStatus.ERROR,
        }
        reader = self._known_readers.get(serial)
        if reader:
            reader.status = status_map.get(status_str, ReaderStatus.OFFLINE)
            reader.battery_level = payload.get("battery_level", reader.battery_level)
        log.info("valor_connect.status_update", serial=serial, status=status_str)

    # ── Terminal command execution ────────────────────────────────────

    def _send_command(
        self,
        serial: str,
        command: dict,
        timeout: float = _TERMINAL_TIMEOUT_SECONDS,
    ) -> dict:
        """
        Publish a command to a terminal and block until it responds.

        Raises ValorConnectError on timeout or terminal error.
        """
        request_id = uuid.uuid4().hex
        command["request_id"] = request_id
        command["epi"] = self._epi

        event = threading.Event()
        with self._lock:
            self._pending_responses[request_id] = event

        try:
            topic = _TOPIC_REQUEST.format(epi=self._epi, serial=serial)
            payload = json.dumps(command).encode("utf-8")

            if self._mqtt_client:
                result = self._mqtt_client.publish(topic, payload, qos=1)
                if result.rc != 0:
                    raise ValorConnectError(
                        f"MQTT publish failed with rc={result.rc}",
                        terminal_serial=serial,
                    )

            log.info(
                "valor_connect.command_sent",
                serial=serial,
                txn_type=command.get("txn_type"),
                request_id=request_id,
            )

            # Block until terminal responds or timeout
            if not event.wait(timeout=timeout):
                raise ValorConnectError(
                    f"Terminal {serial} did not respond within {timeout}s",
                    terminal_serial=serial,
                )

            with self._lock:
                response = self._response_data.pop(request_id, {})

            return response

        finally:
            with self._lock:
                self._pending_responses.pop(request_id, None)

    # ── Mock terminal simulation ─────────────────────────────────────

    def _mock_terminal_response(
        self,
        txn_type: str,
        amount_cents: int,
        serial: str,
    ) -> dict:
        """Simulate a terminal response for development/testing."""
        # Simulate the delay of customer interacting with terminal
        time.sleep(0.3)

        txn_id = f"mock_{uuid.uuid4().hex[:12]}"
        auth_code = f"M{int(time.time()) % 100000:05d}"

        log.info(
            "valor_connect.mock.terminal_response",
            serial=serial,
            txn_type=txn_type,
            amount_cents=amount_cents,
            txn_id=txn_id,
        )

        return {
            "response_code": "00",
            "response_text": "APPROVED",
            "transaction_id": txn_id,
            "auth_code": auth_code,
            "authorized_amount": amount_cents,
            "card_type": "visa",
            "masked_pan": "************4242",
            "entry_mode": "emv",
            "is_debit": False,
            "cardholder_name": "TEST/CUSTOMER",
            "token": f"tok_mock_{uuid.uuid4().hex[:8]}",
        }

    # ── Reader management ────────────────────────────────────────────

    def discover_readers(self) -> list[ReaderDevice]:
        """Find available Valor terminals via MQTT discovery."""
        if self._mock_mode:
            mock_readers = [
                ReaderDevice(
                    serial="MOCK001",
                    model="VP800",
                    label="Main Counter",
                    connection_type=ConnectionType.NETWORK,
                    status=ReaderStatus.ONLINE,
                    battery_level=None,
                    firmware_version="2.1.0",
                ),
                ReaderDevice(
                    serial="MOCK002",
                    model="RCKT",
                    label="Tableside 1",
                    connection_type=ConnectionType.BLUETOOTH,
                    status=ReaderStatus.ONLINE,
                    battery_level=85,
                    firmware_version="1.8.3",
                ),
                ReaderDevice(
                    serial="MOCK003",
                    model="VP550",
                    label="Bar",
                    connection_type=ConnectionType.NETWORK,
                    status=ReaderStatus.ONLINE,
                    battery_level=None,
                    firmware_version="2.0.1",
                ),
            ]
            self._known_readers = {r.serial: r for r in mock_readers}
            log.info("valor_connect.mock.discover", count=len(mock_readers))
            return mock_readers

        if not self._connected:
            raise ValorConnectError("Not connected to Valor Connect broker")

        # Publish discovery request and wait for status responses
        discovery_topic = f"valorconnect/{self._epi}/discovery/request"
        request_id = uuid.uuid4().hex
        payload = json.dumps({"request_id": request_id, "action": "discover"}).encode("utf-8")

        if self._mqtt_client:
            self._mqtt_client.publish(discovery_topic, payload, qos=1)

        # Give terminals time to respond with status messages
        time.sleep(3)

        readers = list(self._known_readers.values())
        log.info("valor_connect.discover", count=len(readers))
        return readers

    def connect_reader(self, serial: str) -> bool:
        """Establish connection to a specific Valor terminal."""
        if self._mock_mode:
            if serial in self._known_readers:
                self._known_readers[serial].status = ReaderStatus.ONLINE
            else:
                self._known_readers[serial] = ReaderDevice(
                    serial=serial,
                    model="VP800",
                    label=f"Terminal {serial}",
                    connection_type=ConnectionType.NETWORK,
                    status=ReaderStatus.ONLINE,
                )
            log.info("valor_connect.mock.reader_connected", serial=serial)
            return True

        if not self._connected:
            raise ValorConnectError("Not connected to Valor Connect broker")

        try:
            result = self._send_command(serial, {"action": "connect"}, timeout=10)
            connected = result.get("status") == "connected"
            if connected and serial not in self._known_readers:
                self._known_readers[serial] = ReaderDevice(
                    serial=serial,
                    model=result.get("model", "unknown"),
                    label=result.get("label", f"Terminal {serial}"),
                    connection_type=ConnectionType.NETWORK,
                    status=ReaderStatus.ONLINE,
                    firmware_version=result.get("firmware_version"),
                )
            log.info("valor_connect.reader_connected", serial=serial, success=connected)
            return connected
        except ValorConnectError:
            log.error("valor_connect.reader_connect_failed", serial=serial)
            return False

    def get_reader_status(self, serial: str) -> ReaderDevice:
        """Get current status of a connected Valor terminal."""
        if self._mock_mode:
            reader = self._known_readers.get(serial)
            if reader:
                return reader
            return ReaderDevice(
                serial=serial,
                model="VP800",
                label=f"Terminal {serial}",
                connection_type=ConnectionType.NETWORK,
                status=ReaderStatus.OFFLINE,
            )

        reader = self._known_readers.get(serial)
        if reader:
            return reader

        # Try to get live status from terminal
        if self._connected:
            try:
                result = self._send_command(serial, {"action": "status"}, timeout=5)
                status_str = result.get("status", "offline")
                status_map = {
                    "online": ReaderStatus.ONLINE,
                    "offline": ReaderStatus.OFFLINE,
                    "busy": ReaderStatus.BUSY,
                    "error": ReaderStatus.ERROR,
                }
                device = ReaderDevice(
                    serial=serial,
                    model=result.get("model", "unknown"),
                    label=result.get("label", f"Terminal {serial}"),
                    connection_type=ConnectionType.NETWORK,
                    status=status_map.get(status_str, ReaderStatus.OFFLINE),
                    battery_level=result.get("battery_level"),
                    firmware_version=result.get("firmware_version"),
                )
                self._known_readers[serial] = device
                return device
            except ValorConnectError:
                pass

        return ReaderDevice(
            serial=serial,
            model="unknown",
            label=f"Terminal {serial}",
            connection_type=ConnectionType.NETWORK,
            status=ReaderStatus.OFFLINE,
        )

    # ── Payment operations ───────────────────────────────────────────

    def authorize(
        self,
        terminal_serial: str,
        amount_cents: int,
        order_id: str = "",
        *,
        capture: bool = False,
    ) -> AuthorizationResult:
        """
        Send payment command to terminal via MQTT. Blocks until customer
        interacts with the terminal (tap/insert/swipe) and Valor returns
        the auth result.

        capture=True  -> SALE (auth + capture in one step)
        capture=False -> AUTH_ONLY (capture later with tip)
        """
        txn_type = "sale" if capture else "auth"

        if self._mock_mode:
            result = self._mock_terminal_response(txn_type, amount_cents, terminal_serial)
        else:
            if not self._connected:
                raise ValorConnectError("Not connected to Valor Connect broker")

            command = {
                "txn_type": txn_type,
                "amount": amount_cents,
                "terminal_id": terminal_serial,
                "invoice_number": order_id or uuid.uuid4().hex[:12],
            }
            result = self._send_command(
                terminal_serial,
                command,
                timeout=_TERMINAL_TIMEOUT_SECONDS,
            )

        # Parse terminal response
        approved = result.get("response_code") == "00"
        masked_pan = result.get("masked_pan", "")
        last_four = masked_pan[-4:] if len(masked_pan) >= 4 else ""
        card_type_raw = result.get("card_type", "unknown").lower()
        entry_mode_raw = result.get("entry_mode", "emv").lower()

        card_info = CardInfo(
            brand=_BRAND_MAP.get(card_type_raw, CardBrand.UNKNOWN),
            last_four=last_four,
            entry_mode=_ENTRY_MAP.get(entry_mode_raw, EntryMode.EMV),
            is_debit=result.get("is_debit", False),
            token=result.get("token"),
            cardholder_name=result.get("cardholder_name"),
        )

        return AuthorizationResult(
            success=approved,
            transaction_id=result.get("transaction_id", ""),
            auth_code=result.get("auth_code", ""),
            amount_cents=result.get("authorized_amount", amount_cents),
            card_info=card_info,
            processor_response=result,
            decline_code=result.get("response_code") if not approved else None,
            decline_reason=result.get("response_text") if not approved else None,
        )

    def capture(
        self,
        transaction_id: str,
        amount_cents: int,
        tip_cents: int = 0,
    ) -> CaptureResult:
        """
        Capture a previously authorized transaction.

        Capture goes through the REST API, not the terminal. The terminal
        is only needed when a physical card is present. This is a convenience
        wrapper that uses the MQTT channel if the REST client isn't available.
        """
        if self._mock_mode:
            log.info(
                "valor_connect.mock.capture",
                transaction_id=transaction_id,
                amount_cents=amount_cents,
                tip_cents=tip_cents,
            )
            return CaptureResult(
                success=True,
                transaction_id=transaction_id,
                captured_amount_cents=amount_cents + tip_cents,
                tip_amount_cents=tip_cents,
            )

        if not self._connected:
            raise ValorConnectError("Not connected to Valor Connect broker")

        # Capture via REST-over-MQTT (Valor Connect supports API relay)
        command = {
            "action": "capture",
            "transaction_id": transaction_id,
            "amount": amount_cents + tip_cents,
            "tip": tip_cents,
        }
        # Use a generic serial since capture doesn't need a specific terminal
        # Valor routes it server-side based on transaction_id
        result = self._send_command("_api", command, timeout=30)

        return CaptureResult(
            success=result.get("status") == "approved",
            transaction_id=result.get("transaction_id", transaction_id),
            captured_amount_cents=result.get("amount", amount_cents + tip_cents),
            tip_amount_cents=tip_cents,
            error_message=result.get("error_message"),
        )
