"""SSE (Server-Sent Events) blueprint for real-time POS updates.

Provides event streams for orders, KDS, tables, and 86 notifications.
Uses Redis pub/sub (DB 4) as the event transport.
"""

from __future__ import annotations

import structlog
from flask import Blueprint, Response, g, request, stream_with_context

from app.core.pos.sse_service import (
    CHANNEL_86,
    CHANNEL_KDS,
    CHANNEL_ORDERS,
    CHANNEL_TABLES,
    build_channel,
    subscribe_events,
)
from app.shared.responses import api_error

log = structlog.get_logger(__name__)

sse_bp = Blueprint("sse", __name__, url_prefix="/api/v1/events")


def _verify_sse_auth() -> tuple[str | None, str | None, Response | None]:
    """
    Verify auth for SSE endpoints. EventSource API doesn't support custom
    headers, so we accept the JWT as a query parameter.

    Returns (org_id, location_id, error_response).
    If error_response is not None, return it immediately.
    """
    token = request.args.get("token", "").strip()
    if not token:
        return None, None, api_error("Missing token query parameter", 401)

    location_id = request.args.get("location_id", "").strip()
    if not location_id:
        return None, None, api_error("Missing location_id query parameter", 400)

    try:
        from app.core.auth.services import verify_jwt

        claims = verify_jwt(token)
        org_id = claims["org_id"]
        role = claims.get("role", "staff")
        user_locations = claims.get("location_ids") or []

        # Validate location access
        if role not in ("owner", "admin") and location_id not in user_locations:
            return None, None, api_error("You do not have access to this location", 403)

        return org_id, location_id, None

    except Exception:
        log.exception("sse.auth_failed")
        return None, None, api_error("Authentication failed", 401)


def _sse_response(channel: str) -> Response:
    """Build an SSE Response for the given Redis pub/sub channel."""
    last_event_id = request.headers.get("Last-Event-ID")

    def generate():
        yield from subscribe_events(channel, last_event_id=last_event_id)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Order Events
# ---------------------------------------------------------------------------


@sse_bp.route("/orders", methods=["GET"])
def order_events():
    """SSE stream for order status changes (new, updated, voided).

    Used by server tablets to see order flow in real time.
    Query params: token, location_id
    """
    org_id, location_id, error = _verify_sse_auth()
    if error:
        return error

    channel = build_channel(CHANNEL_ORDERS, location_id)
    log.info("sse.orders.connected", org_id=org_id, location_id=location_id)
    return _sse_response(channel)


# ---------------------------------------------------------------------------
# KDS Events
# ---------------------------------------------------------------------------


@sse_bp.route("/kds", methods=["GET"])
def kds_events():
    """SSE stream for kitchen display tickets (new, bumped, recalled, course fired).

    Used by KDS screens. Optionally filter by station_id.
    Query params: token, location_id, station_id (optional)
    """
    org_id, location_id, error = _verify_sse_auth()
    if error:
        return error

    station_id = request.args.get("station_id", "").strip()
    channel = build_channel(CHANNEL_KDS, location_id)

    log.info(
        "sse.kds.connected",
        org_id=org_id,
        location_id=location_id,
        station_id=station_id or "all",
    )
    # Station filtering happens client-side from the event data.
    # All KDS events for the location flow through one channel;
    # each event includes a station_ids field for client filtering.
    return _sse_response(channel)


# ---------------------------------------------------------------------------
# Table Events
# ---------------------------------------------------------------------------


@sse_bp.route("/tables", methods=["GET"])
def table_events():
    """SSE stream for table status changes (seated, cleared, dirty, available).

    Used by host stand and floor plan displays.
    Query params: token, location_id
    """
    org_id, location_id, error = _verify_sse_auth()
    if error:
        return error

    channel = build_channel(CHANNEL_TABLES, location_id)
    log.info("sse.tables.connected", org_id=org_id, location_id=location_id)
    return _sse_response(channel)


# ---------------------------------------------------------------------------
# 86 Events
# ---------------------------------------------------------------------------


@sse_bp.route("/86", methods=["GET"])
def eighty_six_events():
    """SSE stream for 86 notifications (items going on/off 86).

    Used by all POS terminals to immediately grey out unavailable items.
    Query params: token, location_id
    """
    org_id, location_id, error = _verify_sse_auth()
    if error:
        return error

    channel = build_channel(CHANNEL_86, location_id)
    log.info("sse.86.connected", org_id=org_id, location_id=location_id)
    return _sse_response(channel)
