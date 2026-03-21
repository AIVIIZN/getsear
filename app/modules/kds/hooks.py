"""
KDS event hooks — subscribed to POS events via the EventBus.

These handlers are registered automatically when the KDS module loads,
based on the event_hooks dict in the MANIFEST.
"""

from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger(__name__)


def on_order_created(event_name: str, data: dict[str, Any]) -> None:
    """
    When a new order is created in the POS, create KDS tickets for each
    kitchen station that needs to prepare items from the order.
    """
    from app.extensions import supabase_client

    order_id = data.get("order_id")
    org_id = data.get("org_id")
    location_id = data.get("location_id")
    items = data.get("items", [])

    if not order_id or not org_id:
        log.warning("kds_order_created_missing_data", data=data)
        return

    # Group items by their assigned KDS station
    station_items: dict[str, list[dict]] = {}
    for item in items:
        station_id = item.get("kds_station_id", "default")
        station_items.setdefault(station_id, []).append(item)

    # Create a KDS ticket per station
    for station_id, s_items in station_items.items():
        ticket_row = {
            "org_id": org_id,
            "location_id": location_id,
            "order_id": order_id,
            "station_id": station_id,
            "status": "pending",
            "item_count": len(s_items),
        }
        try:
            ticket_resp = (
                supabase_client.table("kds_tickets")
                .insert(ticket_row)
                .execute()
            )
            ticket_id = ticket_resp.data[0]["id"] if ticket_resp.data else None

            if ticket_id:
                ticket_items = [
                    {
                        "org_id": org_id,
                        "ticket_id": ticket_id,
                        "order_item_id": item.get("id"),
                        "name": item.get("name", ""),
                        "quantity": item.get("quantity", 1),
                        "modifiers": item.get("modifiers", []),
                        "notes": item.get("notes", ""),
                        "status": "pending",
                    }
                    for item in s_items
                ]
                supabase_client.table("kds_ticket_items").insert(ticket_items).execute()

            log.info(
                "kds_ticket_created",
                ticket_id=ticket_id,
                order_id=order_id,
                station_id=station_id,
                item_count=len(s_items),
            )
        except Exception:
            log.exception(
                "kds_ticket_creation_failed",
                order_id=order_id,
                station_id=station_id,
            )


def on_order_updated(event_name: str, data: dict[str, Any]) -> None:
    """Handle order modifications — update corresponding KDS tickets."""
    from app.extensions import supabase_client

    order_id = data.get("order_id")
    org_id = data.get("org_id")
    status = data.get("status")

    if not order_id or not org_id:
        return

    # If order is voided or cancelled, void the KDS tickets too
    if status in ("voided", "cancelled"):
        try:
            supabase_client.table("kds_tickets").update(
                {"status": "voided"}
            ).eq("order_id", order_id).eq("org_id", org_id).execute()

            log.info("kds_tickets_voided", order_id=order_id)
        except Exception:
            log.exception("kds_ticket_void_failed", order_id=order_id)


def on_item_fired(event_name: str, data: dict[str, Any]) -> None:
    """When items are fired to kitchen, update ticket status to in_progress."""
    from app.extensions import supabase_client

    order_id = data.get("order_id")
    org_id = data.get("org_id")
    item_ids = data.get("item_ids", [])

    if not order_id or not org_id:
        return

    try:
        # Update ticket items to fired status
        for item_id in item_ids:
            supabase_client.table("kds_ticket_items").update(
                {"status": "in_progress"}
            ).eq("order_item_id", item_id).eq("org_id", org_id).execute()

        # Update parent tickets to in_progress
        supabase_client.table("kds_tickets").update(
            {"status": "in_progress"}
        ).eq("order_id", order_id).eq("org_id", org_id).eq(
            "status", "pending"
        ).execute()

        log.info("kds_items_fired", order_id=order_id, count=len(item_ids))
    except Exception:
        log.exception("kds_item_fire_failed", order_id=order_id)


def on_item_86d(event_name: str, data: dict[str, Any]) -> None:
    """When a menu item is 86'd, mark it on any active KDS tickets."""
    from app.extensions import supabase_client

    org_id = data.get("org_id")
    menu_item_id = data.get("menu_item_id")
    item_name = data.get("item_name", "Unknown")

    if not org_id or not menu_item_id:
        return

    log.info("kds_item_86d", menu_item_id=menu_item_id, item_name=item_name)
    # The KDS display will show an 86'd badge. We don't modify tickets —
    # the display layer checks active 86'd items and overlays the badge.
