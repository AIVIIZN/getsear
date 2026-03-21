"""Bridge internal event bus events to SSE channels via Redis pub/sub."""

from __future__ import annotations

from typing import Any

import structlog

from app.core.pos.sse_service import (
    CHANNEL_86,
    CHANNEL_KDS,
    CHANNEL_ORDERS,
    CHANNEL_TABLES,
    build_channel,
    publish_event,
)
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)


def _get_location_id(data: dict[str, Any]) -> str | None:
    """Extract location_id from event data, falling back to order lookup."""
    loc = data.get("location_id")
    if loc:
        return loc
    # Some events only carry org_id + order_id; location_id unavailable without DB lookup.
    # In those cases we skip SSE publishing rather than making a blocking query.
    return None


# ---------------------------------------------------------------------------
# Order events → SSE
# ---------------------------------------------------------------------------

def _on_order_created(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel_orders = build_channel(CHANNEL_ORDERS, location_id)
    publish_event(channel_orders, "order.new", data)
    channel_kds = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel_kds, "ticket.new", data)


def _on_order_updated(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_ORDERS, location_id)
    publish_event(channel, "order.updated", data)
    channel_kds = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel_kds, "ticket.update", data)


def _on_order_voided(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_ORDERS, location_id)
    publish_event(channel, "order.voided", data)
    channel_kds = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel_kds, "ticket.void", data)


def _on_order_transferred(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_ORDERS, location_id)
    publish_event(channel, "order.transferred", data)


def _on_order_course_fired(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel_kds = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel_kds, "course.fired", data)
    channel_orders = build_channel(CHANNEL_ORDERS, location_id)
    publish_event(channel_orders, "order.course_fired", data)


def _on_order_closed(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_ORDERS, location_id)
    publish_event(channel, "order.closed", data)


# ---------------------------------------------------------------------------
# Table events → SSE
# ---------------------------------------------------------------------------

def _on_table_seated(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_TABLES, location_id)
    publish_event(channel, "table.seated", data)


def _on_table_cleared(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_TABLES, location_id)
    publish_event(channel, "table.cleared", data)


def _on_table_status_changed(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_TABLES, location_id)
    publish_event(channel, "table.status_changed", data)


# ---------------------------------------------------------------------------
# Menu 86 events → SSE
# ---------------------------------------------------------------------------

def _on_menu_item_86d(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_86, location_id)
    publish_event(channel, "item.86d", data)


def _on_menu_item_un86d(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_86, location_id)
    publish_event(channel, "item.un86d", data)


# ---------------------------------------------------------------------------
# KDS events → SSE
# ---------------------------------------------------------------------------

def _on_kds_ticket_bumped(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel, "ticket.bump", data)


def _on_kds_tickets_bumped(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel, "ticket.bump", data)


def _on_kds_ticket_recalled(event_name: str, data: dict[str, Any]) -> None:
    location_id = _get_location_id(data)
    if not location_id:
        return
    channel = build_channel(CHANNEL_KDS, location_id)
    publish_event(channel, "ticket.recall", data)


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def register_sse_bridge() -> None:
    """Subscribe event bus handlers that forward events to SSE channels."""
    handlers = {
        "order.created": _on_order_created,
        "order.updated": _on_order_updated,
        "order.voided": _on_order_voided,
        "order.transferred": _on_order_transferred,
        "order.course_fired": _on_order_course_fired,
        "order.closed": _on_order_closed,
        "table.seated": _on_table_seated,
        "table.cleared": _on_table_cleared,
        "table.status_changed": _on_table_status_changed,
        "menu.item_86d": _on_menu_item_86d,
        "menu.item_un86d": _on_menu_item_un86d,
        "kds.ticket_bumped": _on_kds_ticket_bumped,
        "kds.tickets_bumped": _on_kds_tickets_bumped,
        "kds.ticket_recalled": _on_kds_ticket_recalled,
    }

    for event_name, handler in handlers.items():
        event_bus.subscribe(event_name, handler)

    log.info("sse_bridge.registered", event_count=len(handlers))
