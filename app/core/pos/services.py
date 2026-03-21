"""Order business logic for Sear POS.

Handles order creation, item management, state transitions, voids, comps,
splits, merges, transfers, discounts, and all order modification tracking.
All money is stored as numeric(10,2) in the database (Supabase handles
decimal serialization as strings or floats; we convert to float for calcs).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Enums (must match DB enum types)
# ---------------------------------------------------------------------------

ORDER_STATUSES = [
    "draft", "open", "fired", "ready", "served", "closed", "voided", "refunded",
]
ORDER_TYPES = [
    "dine_in", "takeout", "delivery", "bar", "catering", "online", "kiosk",
]
VOID_REASONS = [
    "customer_request", "kitchen_error", "server_error", "wrong_item",
    "quality_issue", "86d", "duplicate", "other",
]
COMP_REASONS = [
    "manager_comp", "quality_issue", "service_issue", "birthday",
    "vip", "employee_meal", "promotional", "other",
]
DISCOUNT_TYPES = ["percentage", "fixed_amount", "bogo", "free_item"]

# Valid order state transitions
VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["open", "voided"],
    "open": ["fired", "ready", "served", "voided"],
    "fired": ["ready", "served", "voided"],
    "ready": ["served", "voided"],
    "served": ["closed", "voided"],
    "closed": ["refunded", "served"],  # served = reopen
    "voided": [],
    "refunded": [],
}


# ---------------------------------------------------------------------------
# Order CRUD
# ---------------------------------------------------------------------------

def create_order(
    org_id: str,
    location_id: str,
    server_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Create a new order in draft status.

    Calls the DB function next_order_number() for sequential numbering.
    """
    order_type = data.get("order_type", "dine_in")
    if order_type not in ORDER_TYPES:
        raise ValueError(f"Invalid order_type: {order_type}")

    # Get next sequential order number for this location today
    num_resp = supabase_client.rpc(
        "next_order_number", {"p_location_id": location_id}
    ).execute()
    order_number = num_resp.data if isinstance(num_resp.data, int) else 1

    # Build display number (e.g. "A-042")
    prefix = _order_type_prefix(order_type)
    display_number = f"{prefix}-{order_number:03d}"

    row: dict[str, Any] = {
        "org_id": org_id,
        "location_id": location_id,
        "order_type": order_type,
        "status": "draft",
        "order_number": order_number,
        "display_number": display_number,
        "server_id": server_id,
        "table_id": data.get("table_id"),
        "customer_id": data.get("customer_id"),
        "guest_count": data.get("guest_count"),
        "guest_name": data.get("guest_name"),
        "guest_phone": data.get("guest_phone"),
        "notes": data.get("notes"),
        "source": data.get("source", "pos"),
        "subtotal": 0,
        "discount_total": 0,
        "tax_total": 0,
        "tip_total": 0,
        "total": 0,
        "amount_paid": 0,
        "balance_due": 0,
        "created_by": server_id,
        "updated_by": server_id,
    }
    if data.get("terminal_id"):
        row["terminal_id"] = data["terminal_id"]
    if data.get("scheduled_for"):
        row["scheduled_for"] = data["scheduled_for"]
    if data.get("delivery_address"):
        row["delivery_address"] = data["delivery_address"]

    resp = supabase_client.table("orders").insert(row).execute()
    order = resp.data[0]

    # Update table status if dine-in
    table_id = data.get("table_id")
    if table_id:
        supabase_client.table("tables").update({
            "status": "seated",
            "current_order_id": order["id"],
            "current_server_id": server_id,
            "seated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", table_id).execute()

    log.info("order.created", order_id=order["id"], order_number=display_number)
    return order


def get_orders(
    org_id: str,
    location_id: str,
    filters: dict[str, Any],
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """List orders for a location with filtering and pagination."""
    query = (
        supabase_client.table("orders")
        .select("*, order_items(id, name, quantity, unit_price, line_total, is_voided, is_comped)", count="exact")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .is_("deleted_at", "null")  # soft-delete guard if applicable
    )

    if filters.get("status"):
        if isinstance(filters["status"], list):
            query = query.in_("status", filters["status"])
        else:
            query = query.eq("status", filters["status"])

    if filters.get("order_type"):
        query = query.eq("order_type", filters["order_type"])

    if filters.get("server_id"):
        query = query.eq("server_id", filters["server_id"])

    if filters.get("table_id"):
        query = query.eq("table_id", filters["table_id"])

    if filters.get("opened_after"):
        query = query.gte("opened_at", filters["opened_after"])

    if filters.get("opened_before"):
        query = query.lte("opened_at", filters["opened_before"])

    # Pagination
    offset = (page - 1) * per_page
    query = query.order("opened_at", desc=True).range(offset, offset + per_page - 1)

    resp = query.execute()
    total = resp.count if resp.count is not None else len(resp.data or [])
    return resp.data or [], total


def get_order(org_id: str, order_id: str) -> dict[str, Any]:
    """Get full order detail with items, modifiers, and modifications."""
    resp = (
        supabase_client.table("orders")
        .select(
            "*, order_items(*, order_item_modifiers(*)), "
            "order_modifications(id, modification_type, description, performed_by, approved_by, created_at)"
        )
        .eq("id", order_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError("Order not found")
    return resp.data


def get_order_by_table(org_id: str, table_id: str) -> dict[str, Any] | None:
    """Get the active (non-closed, non-voided) order for a table."""
    resp = (
        supabase_client.table("orders")
        .select("*, order_items(*, order_item_modifiers(*))")
        .eq("org_id", org_id)
        .eq("table_id", table_id)
        .not_.in_("status", ["closed", "voided", "refunded"])
        .order("opened_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]
    return None


# ---------------------------------------------------------------------------
# Item Management
# ---------------------------------------------------------------------------

def add_items(
    org_id: str,
    order_id: str,
    items_data: list[dict[str, Any]],
    user_id: str,
) -> dict[str, Any]:
    """Add one or more items to an order with price snapshots.

    Each item in items_data should have:
        menu_item_id, quantity, modifier_ids (optional), seat_number (optional),
        course (optional), notes (optional).
    """
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot add items to order in '{order['status']}' status")

    created_items = []
    for item_data in items_data:
        menu_item_id = item_data.get("menu_item_id")
        quantity = item_data.get("quantity", 1)

        if menu_item_id:
            snapshot = _snapshot_menu_item(org_id, menu_item_id)
        else:
            # Open/custom item
            snapshot = {
                "name": item_data.get("name", "Custom Item"),
                "short_name": item_data.get("short_name"),
                "unit_price": float(item_data.get("unit_price", 0)),
                "prep_station": item_data.get("prep_station"),
                "tax_rate_id": item_data.get("tax_rate_id"),
                "is_taxable": item_data.get("is_taxable", True),
            }

        # Calculate modifier total from selected modifiers
        modifier_ids = item_data.get("modifier_ids", [])
        modifier_records = []
        modifier_total = 0.0

        if modifier_ids:
            mod_resp = (
                supabase_client.table("modifiers")
                .select("id, name, price_adjustment, modifier_group_id")
                .in_("id", modifier_ids)
                .execute()
            )
            for mod in mod_resp.data or []:
                adj = float(mod["price_adjustment"])
                modifier_total += adj
                modifier_records.append({
                    "modifier_id": mod["id"],
                    "modifier_group_id": mod["modifier_group_id"],
                    "name": mod["name"],
                    "price_adjustment": adj,
                    "quantity": 1,
                })

        unit_price = float(snapshot["unit_price"])
        line_total = (unit_price + modifier_total) * quantity

        item_row: dict[str, Any] = {
            "org_id": org_id,
            "order_id": order_id,
            "menu_item_id": menu_item_id,
            "name": snapshot["name"],
            "short_name": snapshot.get("short_name"),
            "quantity": quantity,
            "unit_price": unit_price,
            "modifier_total": modifier_total,
            "discount_amount": 0,
            "tax_amount": 0,
            "line_total": line_total,
            "prep_station": snapshot.get("prep_station"),
            "course": item_data.get("course", 1),
            "seat_number": item_data.get("seat_number"),
            "is_sent": False,
            "is_fired": False,
            "is_ready": False,
            "is_served": False,
            "is_voided": False,
            "is_comped": False,
            "notes": item_data.get("notes"),
            "sort_order": item_data.get("sort_order", 0),
            "created_by": user_id,
        }

        item_resp = supabase_client.table("order_items").insert(item_row).execute()
        created_item = item_resp.data[0]

        # Insert modifier snapshots
        for mod_rec in modifier_records:
            mod_rec["order_item_id"] = created_item["id"]
            supabase_client.table("order_item_modifiers").insert(mod_rec).execute()

        created_items.append(created_item)

    # Recalculate totals
    _recalculate_totals(order_id)

    # If order was already sent, record modification
    if order["status"] != "draft":
        item_names = ", ".join(f"{i.get('quantity', 1)}x {i.get('name', '?')}" for i in created_items)
        _create_modification_record(
            org_id=org_id,
            order_id=order_id,
            order_item_id=None,
            action="add_item",
            description=f"Added items after send: {item_names}",
            user_id=user_id,
        )

    return get_order(org_id, order_id)


def send_order(org_id: str, order_id: str, user_id: str) -> dict[str, Any]:
    """Send unsent items to kitchen. Transitions draft->open, or marks new items as sent."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot send order in '{order['status']}' status")

    # Get unsent items
    items_resp = (
        supabase_client.table("order_items")
        .select("id, name, quantity")
        .eq("order_id", order_id)
        .eq("is_sent", False)
        .eq("is_voided", False)
        .execute()
    )
    unsent_items = items_resp.data or []

    if not unsent_items:
        raise ValueError("No unsent items to send")

    now = datetime.now(timezone.utc).isoformat()

    # Mark all unsent items as sent
    for item in unsent_items:
        supabase_client.table("order_items").update({
            "is_sent": True,
            "sent_at": now,
        }).eq("id", item["id"]).execute()

    # Transition order status
    updates: dict[str, Any] = {"updated_by": user_id, "updated_at": now}
    if order["status"] == "draft":
        updates["status"] = "open"
        updates["sent_at"] = now
        event_name = "order.created"
    else:
        event_name = "order.updated"

    supabase_client.table("orders").update(updates).eq("id", order_id).execute()

    # Update table status if applicable
    if order.get("table_id"):
        supabase_client.table("tables").update({
            "status": "ordered",
        }).eq("id", order["table_id"]).execute()

    event_bus.emit(event_name, {
        "org_id": org_id,
        "order_id": order_id,
        "location_id": order["location_id"],
        "items": [{"id": i["id"], "name": i["name"], "quantity": i["quantity"]} for i in unsent_items],
    })

    log.info("order.sent", order_id=order_id, items_count=len(unsent_items))
    return get_order(org_id, order_id)


def fire_course(
    org_id: str,
    order_id: str,
    course_number: int,
    user_id: str,
) -> dict[str, Any]:
    """Fire a specific course number, marking matching items as fired."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] not in ("open", "fired"):
        raise ValueError(f"Cannot fire course on order in '{order['status']}' status")

    now = datetime.now(timezone.utc).isoformat()

    # Get sent, non-voided items for this course
    items_resp = (
        supabase_client.table("order_items")
        .select("id, name")
        .eq("order_id", order_id)
        .eq("course", course_number)
        .eq("is_sent", True)
        .eq("is_fired", False)
        .eq("is_voided", False)
        .execute()
    )
    items = items_resp.data or []

    if not items:
        raise ValueError(f"No unfired items found for course {course_number}")

    for item in items:
        supabase_client.table("order_items").update({
            "is_fired": True,
            "fired_at": now,
        }).eq("id", item["id"]).execute()

    # Update order status to fired if not already
    if order["status"] == "open":
        supabase_client.table("orders").update({
            "status": "fired",
            "updated_by": user_id,
            "updated_at": now,
        }).eq("id", order_id).execute()

    event_bus.emit("order.course_fired", {
        "org_id": org_id,
        "order_id": order_id,
        "location_id": order["location_id"],
        "course_number": course_number,
        "items": [{"id": i["id"], "name": i["name"]} for i in items],
    })

    log.info("order.course_fired", order_id=order_id, course=course_number)
    return get_order(org_id, order_id)


def void_item(
    org_id: str,
    order_id: str,
    item_id: str,
    reason: str,
    user_id: str,
    approved_by: str | None = None,
) -> dict[str, Any]:
    """Void a single item on an order."""
    if reason not in VOID_REASONS:
        raise ValueError(f"Invalid void_reason: {reason}")

    order = _get_order_or_raise(org_id, order_id)
    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot void item on order in '{order['status']}' status")

    # Fetch the item
    item_resp = (
        supabase_client.table("order_items")
        .select("*")
        .eq("id", item_id)
        .eq("order_id", order_id)
        .single()
        .execute()
    )
    item = item_resp.data
    if not item:
        raise ValueError("Order item not found")
    if item["is_voided"]:
        raise ValueError("Item is already voided")

    # If item was already sent, require manager approval
    if item["is_sent"] and not approved_by:
        raise ValueError("Manager approval required to void a sent item")

    now = datetime.now(timezone.utc).isoformat()

    supabase_client.table("order_items").update({
        "is_voided": True,
        "void_reason": reason,
        "voided_by": approved_by or user_id,
        "voided_at": now,
        "updated_at": now,
    }).eq("id", item_id).execute()

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=item_id,
        action="void_item",
        description=f"Voided {item['quantity']}x {item['name']} ({reason})",
        user_id=user_id,
        approved_by=approved_by,
        previous_value={"is_voided": False, "line_total": str(item["line_total"])},
        new_value={"is_voided": True, "void_reason": reason},
    )

    _recalculate_totals(order_id)

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.void_item",
        entity_type="order_item",
        entity_id=item_id,
        description=f"Voided {item['quantity']}x {item['name']} - {reason}",
        previous_state={"line_total": str(item["line_total"])},
        new_state={"void_reason": reason, "approved_by": approved_by},
    )

    event_bus.emit("order.updated", {
        "org_id": org_id,
        "order_id": order_id,
        "location_id": order["location_id"],
        "action": "void_item",
        "item_id": item_id,
    })

    log.info("order.item_voided", order_id=order_id, item_id=item_id, reason=reason)
    return get_order(org_id, order_id)


def comp_item(
    org_id: str,
    order_id: str,
    item_id: str,
    reason: str,
    comp_amount: float | None,
    user_id: str,
    approved_by: str | None = None,
) -> dict[str, Any]:
    """Comp a single item (full or partial)."""
    if reason not in COMP_REASONS:
        raise ValueError(f"Invalid comp_reason: {reason}")

    order = _get_order_or_raise(org_id, order_id)
    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot comp item on order in '{order['status']}' status")

    item_resp = (
        supabase_client.table("order_items")
        .select("*")
        .eq("id", item_id)
        .eq("order_id", order_id)
        .single()
        .execute()
    )
    item = item_resp.data
    if not item:
        raise ValueError("Order item not found")
    if item["is_voided"]:
        raise ValueError("Cannot comp a voided item")
    if item["is_comped"]:
        raise ValueError("Item is already comped")

    if not approved_by:
        raise ValueError("Manager approval required to comp an item")

    # Default to full comp if no amount specified
    actual_comp = comp_amount if comp_amount is not None else float(item["line_total"])

    now = datetime.now(timezone.utc).isoformat()

    supabase_client.table("order_items").update({
        "is_comped": True,
        "comp_reason": reason,
        "comp_amount": actual_comp,
        "comped_by": approved_by,
        "updated_at": now,
    }).eq("id", item_id).execute()

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=item_id,
        action="comp_item",
        description=f"Comped {item['quantity']}x {item['name']} (${actual_comp:.2f}) - {reason}",
        user_id=user_id,
        approved_by=approved_by,
        previous_value={"is_comped": False, "line_total": str(item["line_total"])},
        new_value={"is_comped": True, "comp_reason": reason, "comp_amount": str(actual_comp)},
    )

    _recalculate_totals(order_id)

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.comp_item",
        entity_type="order_item",
        entity_id=item_id,
        description=f"Comped {item['quantity']}x {item['name']} (${actual_comp:.2f}) - {reason}",
        previous_state={"line_total": str(item["line_total"])},
        new_state={"comp_reason": reason, "comp_amount": str(actual_comp), "approved_by": approved_by},
    )

    log.info("order.item_comped", order_id=order_id, item_id=item_id, reason=reason, amount=actual_comp)
    return get_order(org_id, order_id)


# ---------------------------------------------------------------------------
# Order Actions
# ---------------------------------------------------------------------------

def transfer_order(
    org_id: str,
    order_id: str,
    new_server_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Transfer order to a different server."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot transfer order in '{order['status']}' status")

    old_server_id = order.get("server_id")
    now = datetime.now(timezone.utc).isoformat()

    supabase_client.table("orders").update({
        "server_id": new_server_id,
        "updated_by": user_id,
        "updated_at": now,
    }).eq("id", order_id).execute()

    # Update table assignment if applicable
    if order.get("table_id"):
        supabase_client.table("tables").update({
            "current_server_id": new_server_id,
        }).eq("id", order["table_id"]).execute()

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=None,
        action="change_server",
        description=f"Transferred order from server {old_server_id} to {new_server_id}",
        user_id=user_id,
        previous_value={"server_id": old_server_id},
        new_value={"server_id": new_server_id},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.transferred",
        entity_type="order",
        entity_id=order_id,
        description=f"Order transferred to server {new_server_id}",
        previous_state={"server_id": old_server_id},
        new_state={"server_id": new_server_id},
    )

    event_bus.emit("order.transferred", {
        "org_id": org_id,
        "order_id": order_id,
        "location_id": order["location_id"],
        "old_server_id": old_server_id,
        "new_server_id": new_server_id,
    })

    log.info("order.transferred", order_id=order_id, new_server=new_server_id)
    return get_order(org_id, order_id)


def move_order_to_table(
    org_id: str,
    order_id: str,
    new_table_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Move order to a different table."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot move order in '{order['status']}' status")

    old_table_id = order.get("table_id")
    now = datetime.now(timezone.utc).isoformat()

    # Free old table
    if old_table_id:
        supabase_client.table("tables").update({
            "status": "available",
            "current_order_id": None,
            "current_server_id": None,
            "seated_at": None,
        }).eq("id", old_table_id).execute()

    # Assign new table
    supabase_client.table("tables").update({
        "status": "seated",
        "current_order_id": order_id,
        "current_server_id": order.get("server_id"),
        "seated_at": now,
    }).eq("id", new_table_id).execute()

    supabase_client.table("orders").update({
        "table_id": new_table_id,
        "updated_by": user_id,
        "updated_at": now,
    }).eq("id", order_id).execute()

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=None,
        action="change_table",
        description=f"Moved order from table {old_table_id} to {new_table_id}",
        user_id=user_id,
        previous_value={"table_id": old_table_id},
        new_value={"table_id": new_table_id},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.move_table",
        entity_type="order",
        entity_id=order_id,
        description=f"Order moved to table {new_table_id}",
        previous_state={"table_id": old_table_id},
        new_state={"table_id": new_table_id},
    )

    log.info("order.moved_table", order_id=order_id, old_table=old_table_id, new_table=new_table_id)
    return get_order(org_id, order_id)


def split_order(
    org_id: str,
    order_id: str,
    splits: list[dict[str, Any]],
    user_id: str,
) -> list[dict[str, Any]]:
    """Split an order into multiple checks.

    splits is an array of: [{"check_index": 1, "item_ids": ["uuid", ...]}, ...]
    Items not assigned to any split remain on the original order.
    Each split creates a new order.
    """
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot split order in '{order['status']}' status")

    if not splits:
        raise ValueError("At least one split group is required")

    new_orders = []

    for split in splits:
        item_ids = split.get("item_ids", [])
        if not item_ids:
            continue

        # Create a new order (child check) with same base data
        num_resp = supabase_client.rpc(
            "next_order_number", {"p_location_id": order["location_id"]}
        ).execute()
        order_number = num_resp.data if isinstance(num_resp.data, int) else 1

        prefix = _order_type_prefix(order["order_type"])
        display_number = f"{prefix}-{order_number:03d}"

        child_row: dict[str, Any] = {
            "org_id": org_id,
            "location_id": order["location_id"],
            "terminal_id": order.get("terminal_id"),
            "order_type": order["order_type"],
            "status": order["status"],
            "order_number": order_number,
            "display_number": display_number,
            "server_id": order.get("server_id"),
            "table_id": order.get("table_id"),
            "customer_id": order.get("customer_id"),
            "guest_count": None,
            "notes": f"Split from order {order['display_number']}",
            "source": order.get("source", "pos"),
            "subtotal": 0,
            "discount_total": 0,
            "tax_total": 0,
            "tip_total": 0,
            "total": 0,
            "amount_paid": 0,
            "balance_due": 0,
            "opened_at": order["opened_at"],
            "sent_at": order.get("sent_at"),
            "created_by": user_id,
            "updated_by": user_id,
            "metadata": {"split_from": order_id},
        }

        child_resp = supabase_client.table("orders").insert(child_row).execute()
        child_order = child_resp.data[0]

        # Move items to the new order
        for iid in item_ids:
            supabase_client.table("order_items").update({
                "order_id": child_order["id"],
            }).eq("id", iid).eq("order_id", order_id).execute()

        _recalculate_totals(child_order["id"])
        new_orders.append(child_order)

    # Recalculate the original order (some items were removed)
    _recalculate_totals(order_id)

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=None,
        action="split_order",
        description=f"Split into {len(new_orders)} additional check(s)",
        user_id=user_id,
        new_value={"new_order_ids": [o["id"] for o in new_orders]},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.split",
        entity_type="order",
        entity_id=order_id,
        description=f"Split order into {len(new_orders)} checks",
        new_state={"new_order_ids": [o["id"] for o in new_orders]},
    )

    log.info("order.split", order_id=order_id, new_orders=len(new_orders))

    # Return all orders (original refreshed + new ones)
    refreshed = [get_order(org_id, order_id)]
    for no in new_orders:
        refreshed.append(get_order(org_id, no["id"]))
    return refreshed


def merge_orders(
    org_id: str,
    target_id: str,
    source_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Merge source order into target order. Closes the source."""
    target = _get_order_or_raise(org_id, target_id)
    source = _get_order_or_raise(org_id, source_id)

    if target["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot merge into order in '{target['status']}' status")
    if source["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot merge from order in '{source['status']}' status")

    now = datetime.now(timezone.utc).isoformat()

    # Move all non-voided items from source to target
    source_items_resp = (
        supabase_client.table("order_items")
        .select("id")
        .eq("order_id", source_id)
        .eq("is_voided", False)
        .execute()
    )
    moved_count = 0
    for item in source_items_resp.data or []:
        supabase_client.table("order_items").update({
            "order_id": target_id,
        }).eq("id", item["id"]).execute()
        moved_count += 1

    # Close the source order
    supabase_client.table("orders").update({
        "status": "voided",
        "notes": f"Merged into order {target['display_number']}",
        "closed_at": now,
        "updated_by": user_id,
        "updated_at": now,
    }).eq("id", source_id).execute()

    # Free source table if different from target
    source_table = source.get("table_id")
    target_table = target.get("table_id")
    if source_table and source_table != target_table:
        supabase_client.table("tables").update({
            "status": "available",
            "current_order_id": None,
            "current_server_id": None,
            "seated_at": None,
        }).eq("id", source_table).execute()

    _recalculate_totals(target_id)

    _create_modification_record(
        org_id=org_id,
        order_id=target_id,
        order_item_id=None,
        action="merge_order",
        description=f"Merged {moved_count} item(s) from order {source['display_number']}",
        user_id=user_id,
        previous_value={"source_order_id": source_id},
        new_value={"items_merged": moved_count},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.merged",
        entity_type="order",
        entity_id=target_id,
        description=f"Merged order {source['display_number']} into {target['display_number']}",
        previous_state={"source_order_id": source_id},
        new_state={"items_merged": moved_count},
    )

    log.info("order.merged", target=target_id, source=source_id, items_moved=moved_count)
    return get_order(org_id, target_id)


def reopen_order(
    org_id: str,
    order_id: str,
    user_id: str,
    approved_by: str,
) -> dict[str, Any]:
    """Reopen a closed order. Requires manager approval."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] != "closed":
        raise ValueError("Only closed orders can be reopened")

    now = datetime.now(timezone.utc).isoformat()

    supabase_client.table("orders").update({
        "status": "served",
        "closed_at": None,
        "updated_by": user_id,
        "updated_at": now,
    }).eq("id", order_id).execute()

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=None,
        action="reopen_order",
        description="Reopened closed order",
        user_id=user_id,
        approved_by=approved_by,
        previous_value={"status": "closed"},
        new_value={"status": "served"},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.reopened",
        entity_type="order",
        entity_id=order_id,
        description=f"Reopened order (approved by {approved_by})",
        previous_state={"status": "closed"},
        new_state={"status": "served", "approved_by": approved_by},
    )

    log.info("order.reopened", order_id=order_id, approved_by=approved_by)
    return get_order(org_id, order_id)


def apply_discount(
    org_id: str,
    order_id: str,
    discount_data: dict[str, Any],
    user_id: str,
    approved_by: str | None = None,
) -> dict[str, Any]:
    """Apply a discount to an order or specific item.

    discount_data may contain:
        - discount_id: UUID of a predefined discount
        - name, discount_type, value: for manual discounts
        - item_id: if discount applies to a specific item (otherwise order-level)
    """
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot apply discount to order in '{order['status']}' status")

    discount_id = discount_data.get("discount_id")
    item_id = discount_data.get("item_id")

    if discount_id:
        # Fetch predefined discount
        disc_resp = (
            supabase_client.table("discounts")
            .select("*")
            .eq("id", discount_id)
            .eq("org_id", org_id)
            .eq("is_active", True)
            .single()
            .execute()
        )
        disc = disc_resp.data
        if not disc:
            raise ValueError("Discount not found or inactive")

        name = disc["name"]
        disc_type = disc["discount_type"]
        value = float(disc.get("percentage") or disc.get("fixed_amount") or 0)

        if disc.get("requires_manager_approval") and not approved_by:
            raise ValueError("Manager approval required for this discount")
    else:
        # Manual discount
        name = discount_data.get("name", "Manual Discount")
        disc_type = discount_data.get("discount_type", "percentage")
        value = float(discount_data.get("value", 0))

        if disc_type not in DISCOUNT_TYPES:
            raise ValueError(f"Invalid discount_type: {disc_type}")

    # Calculate the applied amount
    if item_id:
        item_resp = (
            supabase_client.table("order_items")
            .select("line_total")
            .eq("id", item_id)
            .eq("order_id", order_id)
            .single()
            .execute()
        )
        if not item_resp.data:
            raise ValueError("Order item not found")
        base_amount = float(item_resp.data["line_total"])
    else:
        base_amount = float(order["subtotal"])

    if disc_type == "percentage":
        applied_amount = round(base_amount * (value / 100), 2)
    elif disc_type == "fixed_amount":
        applied_amount = min(value, base_amount)
    else:
        applied_amount = value  # bogo / free_item handled by value

    # Insert order_discounts record
    od_row: dict[str, Any] = {
        "order_id": order_id,
        "discount_id": discount_id,
        "order_item_id": item_id,
        "name": name,
        "discount_type": disc_type,
        "value": value,
        "applied_amount": applied_amount,
        "applied_by": user_id,
        "approved_by": approved_by,
    }
    supabase_client.table("order_discounts").insert(od_row).execute()

    # If item-level discount, update the item's discount_amount
    if item_id:
        # Accumulate discounts on the item
        existing_disc_resp = (
            supabase_client.table("order_discounts")
            .select("applied_amount")
            .eq("order_id", order_id)
            .eq("order_item_id", item_id)
            .execute()
        )
        total_item_discount = sum(float(d["applied_amount"]) for d in existing_disc_resp.data or [])
        supabase_client.table("order_items").update({
            "discount_amount": total_item_discount,
        }).eq("id", item_id).execute()

    _recalculate_totals(order_id)

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=item_id,
        action="apply_discount",
        description=f"Applied discount '{name}' ({disc_type}: {value}) = ${applied_amount:.2f}",
        user_id=user_id,
        approved_by=approved_by,
        new_value={"name": name, "type": disc_type, "value": str(value), "applied": str(applied_amount)},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.discount_applied",
        entity_type="order",
        entity_id=order_id,
        description=f"Discount '{name}' applied: ${applied_amount:.2f}",
        new_state={"discount_name": name, "applied_amount": str(applied_amount), "approved_by": approved_by},
    )

    log.info("order.discount_applied", order_id=order_id, name=name, amount=applied_amount)
    return get_order(org_id, order_id)


def comp_order(
    org_id: str,
    order_id: str,
    reason: str,
    user_id: str,
    approved_by: str,
) -> dict[str, Any]:
    """Comp an entire order. Requires manager approval."""
    if reason not in COMP_REASONS:
        raise ValueError(f"Invalid comp_reason: {reason}")

    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot comp order in '{order['status']}' status")

    now = datetime.now(timezone.utc).isoformat()

    # Comp all non-voided, non-comped items
    items_resp = (
        supabase_client.table("order_items")
        .select("id, name, quantity, line_total")
        .eq("order_id", order_id)
        .eq("is_voided", False)
        .eq("is_comped", False)
        .execute()
    )
    total_comped = 0.0
    for item in items_resp.data or []:
        item_total = float(item["line_total"])
        supabase_client.table("order_items").update({
            "is_comped": True,
            "comp_reason": reason,
            "comp_amount": item_total,
            "comped_by": approved_by,
            "updated_at": now,
        }).eq("id", item["id"]).execute()
        total_comped += item_total

    _recalculate_totals(order_id)

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=None,
        action="comp_order",
        description=f"Comped entire order (${total_comped:.2f}) - {reason}",
        user_id=user_id,
        approved_by=approved_by,
        previous_value={"total": str(order["total"])},
        new_value={"comp_reason": reason, "total_comped": str(total_comped)},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.comped",
        entity_type="order",
        entity_id=order_id,
        description=f"Entire order comped (${total_comped:.2f}) - {reason}",
        previous_state={"total": str(order["total"])},
        new_state={"comp_reason": reason, "total_comped": str(total_comped), "approved_by": approved_by},
    )

    log.info("order.comped", order_id=order_id, reason=reason, total_comped=total_comped)
    return get_order(org_id, order_id)


def get_modifications(
    org_id: str,
    order_id: str,
) -> list[dict[str, Any]]:
    """Get full modification history for an order."""
    # Verify order belongs to org
    _get_order_or_raise(org_id, order_id)

    resp = (
        supabase_client.table("order_modifications")
        .select("*")
        .eq("order_id", order_id)
        .eq("org_id", org_id)
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _get_order_or_raise(org_id: str, order_id: str) -> dict[str, Any]:
    """Fetch an order by ID and org, or raise ValueError."""
    resp = (
        supabase_client.table("orders")
        .select("*")
        .eq("id", order_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError("Order not found")
    return resp.data


def _recalculate_totals(order_id: str) -> None:
    """Recalculate subtotal, discount_total, tax_total, and total on an order.

    Subtotal = sum of line_total for non-voided items, minus comp amounts.
    Tax is recalculated from non-voided, non-comped items.
    """
    items_resp = (
        supabase_client.table("order_items")
        .select("line_total, discount_amount, tax_amount, is_voided, is_comped, comp_amount")
        .eq("order_id", order_id)
        .execute()
    )

    subtotal = 0.0
    discount_total = 0.0
    tax_total = 0.0

    for item in items_resp.data or []:
        if item["is_voided"]:
            continue

        line = float(item["line_total"])
        disc = float(item.get("discount_amount") or 0)
        tax = float(item.get("tax_amount") or 0)

        if item["is_comped"]:
            comp_amt = float(item.get("comp_amount") or line)
            discount_total += comp_amt
            subtotal += line
            # Tax typically waived on comped items
        else:
            subtotal += line
            discount_total += disc
            tax_total += tax

    # Also add order-level discounts (not item-specific)
    order_disc_resp = (
        supabase_client.table("order_discounts")
        .select("applied_amount")
        .eq("order_id", order_id)
        .is_("order_item_id", "null")
        .execute()
    )
    for od in order_disc_resp.data or []:
        discount_total += float(od["applied_amount"])

    total = max(0, subtotal - discount_total + tax_total)

    # Get current amount_paid to calculate balance_due
    order_resp = (
        supabase_client.table("orders")
        .select("amount_paid, tip_total")
        .eq("id", order_id)
        .single()
        .execute()
    )
    amount_paid = float(order_resp.data.get("amount_paid", 0)) if order_resp.data else 0
    tip_total = float(order_resp.data.get("tip_total", 0)) if order_resp.data else 0
    balance_due = max(0, total - amount_paid)

    supabase_client.table("orders").update({
        "subtotal": round(subtotal, 2),
        "discount_total": round(discount_total, 2),
        "tax_total": round(tax_total, 2),
        "total": round(total, 2),
        "balance_due": round(balance_due, 2),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", order_id).execute()


def _snapshot_menu_item(org_id: str, menu_item_id: str) -> dict[str, Any]:
    """Snapshot the current state of a menu item for order recording."""
    resp = (
        supabase_client.table("menu_items")
        .select("id, name, short_name, price, cost, prep_station, course, tax_rate_id, is_taxable, is_86d")
        .eq("id", menu_item_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError(f"Menu item {menu_item_id} not found")

    item = resp.data
    if item.get("is_86d"):
        raise ValueError(f"Menu item '{item['name']}' is currently 86'd (unavailable)")

    return {
        "name": item["name"],
        "short_name": item.get("short_name"),
        "unit_price": float(item["price"]),
        "prep_station": item.get("prep_station"),
        "course": item.get("course"),
        "tax_rate_id": item.get("tax_rate_id"),
        "is_taxable": item.get("is_taxable", True),
    }


def _create_modification_record(
    org_id: str,
    order_id: str,
    order_item_id: str | None,
    action: str,
    description: str,
    user_id: str,
    approved_by: str | None = None,
    previous_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert an order_modifications record."""
    row: dict[str, Any] = {
        "org_id": org_id,
        "order_id": order_id,
        "modification_type": action,
        "description": description,
        "performed_by": user_id,
    }
    if order_item_id:
        row["order_item_id"] = order_item_id
    if approved_by:
        row["approved_by"] = approved_by
    if previous_value is not None:
        row["previous_value"] = previous_value
    if new_value is not None:
        row["new_value"] = new_value

    resp = supabase_client.table("order_modifications").insert(row).execute()
    return resp.data[0] if resp.data else row


def _order_type_prefix(order_type: str) -> str:
    """Map order type to a display prefix letter."""
    prefixes = {
        "dine_in": "D",
        "takeout": "T",
        "delivery": "V",
        "bar": "B",
        "catering": "C",
        "online": "O",
        "kiosk": "K",
    }
    return prefixes.get(order_type, "X")


# ---------------------------------------------------------------------------
# Void Order
# ---------------------------------------------------------------------------

def void_order(
    org_id: str,
    order_id: str,
    reason: str,
    user_id: str,
    approved_by: str,
) -> dict[str, Any]:
    """Void an entire order. Requires manager approval."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot void order in '{order['status']}' status")

    now = datetime.now(timezone.utc).isoformat()

    # Void all non-voided items
    items_resp = (
        supabase_client.table("order_items")
        .select("id, name, quantity, is_voided")
        .eq("order_id", order_id)
        .eq("is_voided", False)
        .execute()
    )
    for item in items_resp.data or []:
        supabase_client.table("order_items").update({
            "is_voided": True,
            "void_reason": reason,
            "voided_by": approved_by,
            "voided_at": now,
            "updated_at": now,
        }).eq("id", item["id"]).execute()

    # Set order status to voided
    supabase_client.table("orders").update({
        "status": "voided",
        "voided_at": now,
        "voided_by": approved_by,
        "void_reason": reason,
        "updated_at": now,
    }).eq("id", order_id).eq("org_id", org_id).execute()

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=None,
        action="void_order",
        description=f"Entire order voided: {reason}",
        user_id=user_id,
        approved_by=approved_by,
        new_value={"status": "voided", "reason": reason},
    )

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="order.voided",
        entity_type="order",
        entity_id=order_id,
        description=f"Order voided: {reason}",
        new_state={"void_reason": reason, "approved_by": approved_by},
    )

    event_bus.emit("order.updated", {
        "org_id": org_id,
        "order_id": order_id,
        "location_id": order["location_id"],
        "action": "void_order",
    })

    log.info("order.voided", order_id=order_id, reason=reason)
    return get_order(org_id, order_id)


# ---------------------------------------------------------------------------
# Update Order Metadata
# ---------------------------------------------------------------------------

def update_order(
    org_id: str,
    order_id: str,
    data: dict[str, Any],
    user_id: str,
) -> dict[str, Any]:
    """Update order metadata (notes, guest_count, order_type)."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot update order in '{order['status']}' status")

    allowed = {"notes", "guest_count", "order_type", "guest_name", "guest_phone"}
    updates: dict[str, Any] = {}
    for k, v in data.items():
        if k in allowed:
            updates[k] = v

    if not updates:
        raise ValueError("No valid fields to update")

    if "order_type" in updates and updates["order_type"] not in ORDER_TYPES:
        raise ValueError(f"Invalid order_type: {updates['order_type']}")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user_id

    supabase_client.table("orders").update(updates).eq("id", order_id).eq("org_id", org_id).execute()

    log.info("order.updated_metadata", order_id=order_id, fields=list(updates.keys()))
    return get_order(org_id, order_id)


# ---------------------------------------------------------------------------
# Update Order Item
# ---------------------------------------------------------------------------

def update_order_item(
    org_id: str,
    order_id: str,
    item_id: str,
    data: dict[str, Any],
    user_id: str,
) -> dict[str, Any]:
    """Update an order item (quantity, modifiers, notes, seat_number)."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot update items on order in '{order['status']}' status")

    item_resp = (
        supabase_client.table("order_items")
        .select("*")
        .eq("id", item_id)
        .eq("order_id", order_id)
        .single()
        .execute()
    )
    item = item_resp.data
    if not item:
        raise ValueError("Order item not found")
    if item["is_voided"]:
        raise ValueError("Cannot update a voided item")

    allowed = {"quantity", "notes", "seat_number", "course"}
    updates: dict[str, Any] = {}
    for k, v in data.items():
        if k in allowed:
            updates[k] = v

    if "quantity" in updates:
        qty = updates["quantity"]
        if not isinstance(qty, int) or qty < 1:
            raise ValueError("quantity must be a positive integer")
        unit_price = float(item["unit_price"])
        modifier_total = float(item.get("modifier_total") or 0)
        updates["line_total"] = (unit_price + modifier_total) * qty

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase_client.table("order_items").update(updates).eq("id", item_id).execute()

        if "quantity" in updates:
            _recalculate_totals(order_id)

        _create_modification_record(
            org_id=org_id,
            order_id=order_id,
            order_item_id=item_id,
            action="update_item",
            description=f"Updated item '{item['name']}': {', '.join(updates.keys())}",
            user_id=user_id,
        )

    log.info("order.item_updated", order_id=order_id, item_id=item_id)
    return get_order(org_id, order_id)


# ---------------------------------------------------------------------------
# Remove Discount
# ---------------------------------------------------------------------------

def remove_discount(
    org_id: str,
    order_id: str,
    discount_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Remove an applied discount from an order."""
    order = _get_order_or_raise(org_id, order_id)

    if order["status"] in ("closed", "voided", "refunded"):
        raise ValueError(f"Cannot modify discounts on order in '{order['status']}' status")

    # Fetch the order_discount record
    disc_resp = (
        supabase_client.table("order_discounts")
        .select("*")
        .eq("id", discount_id)
        .eq("order_id", order_id)
        .single()
        .execute()
    )
    if not disc_resp.data:
        raise ValueError("Discount not found on this order")

    disc = disc_resp.data
    item_id = disc.get("order_item_id")

    # Delete the discount record
    supabase_client.table("order_discounts").delete().eq("id", discount_id).execute()

    # If item-level discount, recalculate item discount_amount
    if item_id:
        remaining_resp = (
            supabase_client.table("order_discounts")
            .select("applied_amount")
            .eq("order_id", order_id)
            .eq("order_item_id", item_id)
            .execute()
        )
        total_item_discount = sum(float(d["applied_amount"]) for d in remaining_resp.data or [])
        supabase_client.table("order_items").update({
            "discount_amount": total_item_discount,
        }).eq("id", item_id).execute()

    _recalculate_totals(order_id)

    _create_modification_record(
        org_id=org_id,
        order_id=order_id,
        order_item_id=item_id,
        action="remove_discount",
        description=f"Removed discount '{disc.get('name', discount_id)}'",
        user_id=user_id,
        previous_value={"name": disc.get("name"), "applied_amount": str(disc.get("applied_amount"))},
    )

    log.info("order.discount_removed", order_id=order_id, discount_id=discount_id)
    return get_order(org_id, order_id)
