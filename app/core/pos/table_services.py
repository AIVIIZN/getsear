"""Table management business logic for Sear POS."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.shared.cache import cache_floor_plan, get_cached_floor_plan, invalidate_floor_plan
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)

VALID_TABLE_STATUSES = [
    "available", "seated", "ordered", "served",
    "check_presented", "dirty", "reserved",
]

VALID_TABLE_SHAPES = [
    "square", "rectangle", "round", "booth", "bar_seat",
]


def _get_supabase():
    from app.extensions import supabase_client
    return supabase_client


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Floor plans
# ---------------------------------------------------------------------------


def get_floor_plans(org_id: str, location_id: str) -> list[dict[str, Any]]:
    sb = _get_supabase()
    resp = (
        sb.table("floor_plans")
        .select("id, name, canvas_width, canvas_height, background_image_url, sort_order, is_active, created_at, updated_at")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )
    return resp.data or []


def get_floor_plan(org_id: str, floor_plan_id: str) -> dict[str, Any]:
    """Get a single floor plan with its tables."""
    sb = _get_supabase()
    fp_resp = (
        sb.table("floor_plans")
        .select("*")
        .eq("id", floor_plan_id)
        .eq("org_id", org_id)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not fp_resp.data:
        raise ValueError(f"Floor plan {floor_plan_id} not found")

    floor_plan = fp_resp.data

    # Fetch tables for this floor plan
    tables_resp = (
        sb.table("tables")
        .select(
            "id, name, capacity, shape, pos_x, pos_y, width, height, rotation, "
            "status, current_order_id, current_server_id, seated_at, "
            "section, sort_order, is_active"
        )
        .eq("floor_plan_id", floor_plan_id)
        .eq("org_id", org_id)
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )
    floor_plan["tables"] = tables_resp.data or []

    return floor_plan


def create_floor_plan(org_id: str, location_id: str, data: dict[str, Any]) -> dict[str, Any]:
    sb = _get_supabase()

    row: dict[str, Any] = {
        "org_id": org_id,
        "location_id": location_id,
        "name": data["name"],
        "canvas_width": data.get("width", 1200),
        "canvas_height": data.get("height", 800),
    }

    if data.get("background_image_url"):
        row["background_image_url"] = data["background_image_url"]
    if data.get("sort_order") is not None:
        row["sort_order"] = data["sort_order"]

    resp = sb.table("floor_plans").insert(row).execute()
    floor_plan = resp.data[0]

    invalidate_floor_plan(location_id)
    log.info("floor_plan.created", floor_plan_id=floor_plan["id"], location_id=location_id)

    return floor_plan


def update_floor_plan(org_id: str, floor_plan_id: str, data: dict[str, Any]) -> dict[str, Any]:
    sb = _get_supabase()

    updates: dict[str, Any] = {"updated_at": _utcnow()}

    allowed = ["name", "canvas_width", "canvas_height", "background_image_url", "sort_order", "is_active"]
    # Map external field names to DB columns
    field_map = {"width": "canvas_width", "height": "canvas_height"}
    for key, val in data.items():
        db_key = field_map.get(key, key)
        if db_key in allowed and val is not None:
            updates[db_key] = val

    resp = (
        sb.table("floor_plans")
        .update(updates)
        .eq("id", floor_plan_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not resp.data:
        raise ValueError(f"Floor plan {floor_plan_id} not found")

    floor_plan = resp.data[0]
    invalidate_floor_plan(floor_plan["location_id"])
    log.info("floor_plan.updated", floor_plan_id=floor_plan_id)

    return floor_plan


def delete_floor_plan(org_id: str, floor_plan_id: str) -> bool:
    sb = _get_supabase()

    # Fetch floor plan to get location_id
    fp_resp = (
        sb.table("floor_plans")
        .select("id, location_id")
        .eq("id", floor_plan_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not fp_resp.data:
        raise ValueError(f"Floor plan {floor_plan_id} not found")

    location_id = fp_resp.data["location_id"]

    # Check for active orders on tables in this floor plan
    tables_resp = (
        sb.table("tables")
        .select("id, status, current_order_id")
        .eq("floor_plan_id", floor_plan_id)
        .eq("org_id", org_id)
        .neq("status", "available")
        .execute()
    )

    active_tables = [t for t in (tables_resp.data or []) if t.get("current_order_id")]
    if active_tables:
        raise ValueError(
            f"Cannot delete floor plan: {len(active_tables)} table(s) have active orders"
        )

    # Soft delete: set is_active = false
    sb.table("floor_plans").update({
        "is_active": False,
        "updated_at": _utcnow(),
    }).eq("id", floor_plan_id).eq("org_id", org_id).execute()

    # Also deactivate all tables on this floor plan
    sb.table("tables").update({
        "is_active": False,
        "updated_at": _utcnow(),
    }).eq("floor_plan_id", floor_plan_id).eq("org_id", org_id).execute()

    invalidate_floor_plan(location_id)
    log.info("floor_plan.deleted", floor_plan_id=floor_plan_id)

    return True


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


def get_tables(
    org_id: str,
    location_id: str,
    floor_plan_id: str | None = None,
    section: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    sb = _get_supabase()

    # Try cache for unfiltered requests (the common floor-plan render path)
    no_filters = not floor_plan_id and not section and not status
    if no_filters:
        cached = get_cached_floor_plan(location_id)
        if cached is not None:
            tables = cached
            # Re-enrich dynamic fields (minutes_seated) from cached data
            _enrich_tables(sb, tables)
            return tables

    query = (
        sb.table("tables")
        .select(
            "id, name, capacity, shape, pos_x, pos_y, width, height, rotation, "
            "status, current_order_id, current_server_id, seated_at, "
            "section, floor_plan_id, sort_order, is_active"
        )
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
    )

    if floor_plan_id:
        query = query.eq("floor_plan_id", floor_plan_id)
    if section:
        query = query.eq("section", section)
    if status:
        query = query.eq("status", status)

    resp = query.order("sort_order").execute()
    tables = resp.data or []

    # Cache the full unfiltered set for subsequent requests
    if no_filters and tables:
        cache_floor_plan(location_id, tables)

    _enrich_tables(sb, tables)
    return tables


def _enrich_tables(sb: Any, tables: list[dict[str, Any]]) -> None:
    """Add server display_name and minutes_seated to table records."""
    # Enrich with server display_name where assigned
    server_ids = list({t["current_server_id"] for t in tables if t.get("current_server_id")})
    server_map: dict[str, str] = {}
    if server_ids:
        srv_resp = (
            sb.table("users")
            .select("id, display_name")
            .in_("id", server_ids)
            .execute()
        )
        server_map = {s["id"]: s["display_name"] for s in (srv_resp.data or [])}

    for t in tables:
        t["current_server"] = server_map.get(t.get("current_server_id", ""), None)
        # Calculate time seated if seated_at is present
        if t.get("seated_at"):
            try:
                seated = datetime.fromisoformat(t["seated_at"].replace("Z", "+00:00"))
                delta = datetime.now(timezone.utc) - seated
                t["minutes_seated"] = int(delta.total_seconds() / 60)
            except Exception:
                t["minutes_seated"] = None
        else:
            t["minutes_seated"] = None


def create_table(org_id: str, location_id: str, data: dict[str, Any]) -> dict[str, Any]:
    sb = _get_supabase()

    # Verify floor plan exists and belongs to this org/location
    fp_resp = (
        sb.table("floor_plans")
        .select("id")
        .eq("id", data["floor_plan_id"])
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not fp_resp.data:
        raise ValueError("Floor plan not found for this location")

    row: dict[str, Any] = {
        "org_id": org_id,
        "location_id": location_id,
        "floor_plan_id": data["floor_plan_id"],
        "name": data["table_number"],
        "capacity": data.get("capacity", 4),
        "shape": data.get("shape", "rectangle"),
        "pos_x": data.get("position_x", 0),
        "pos_y": data.get("position_y", 0),
        "width": data.get("width", 80),
        "height": data.get("height", 80),
        "rotation": data.get("rotation", 0),
        "status": "available",
    }

    if data.get("section"):
        row["section"] = data["section"]
    if data.get("sort_order") is not None:
        row["sort_order"] = data["sort_order"]

    resp = sb.table("tables").insert(row).execute()
    table = resp.data[0]

    invalidate_floor_plan(location_id)
    log.info("table.created", table_id=table["id"], name=table["name"])

    return table


def update_table(org_id: str, table_id: str, data: dict[str, Any]) -> dict[str, Any]:
    sb = _get_supabase()

    updates: dict[str, Any] = {"updated_at": _utcnow()}

    field_map = {
        "table_number": "name",
        "position_x": "pos_x",
        "position_y": "pos_y",
    }
    allowed_direct = [
        "capacity", "shape", "width", "height", "rotation",
        "section", "sort_order", "is_active",
    ]

    for key, val in data.items():
        if val is None:
            continue
        db_key = field_map.get(key, key)
        if db_key in allowed_direct or key in field_map:
            updates[db_key] = val

    resp = (
        sb.table("tables")
        .update(updates)
        .eq("id", table_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not resp.data:
        raise ValueError(f"Table {table_id} not found")

    table = resp.data[0]
    invalidate_floor_plan(table["location_id"])
    log.info("table.updated", table_id=table_id)

    return table


def seat_table(
    org_id: str,
    table_id: str,
    guest_count: int,
    server_id: str,
    reservation_id: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    sb = _get_supabase()
    now = _utcnow()

    # Fetch current table state
    table_resp = (
        sb.table("tables")
        .select("id, name, location_id, status, current_order_id, floor_plan_id, capacity")
        .eq("id", table_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not table_resp.data:
        raise ValueError(f"Table {table_id} not found")

    table = table_resp.data
    if table["status"] not in ("available", "reserved"):
        raise ValueError(
            f"Table {table['name']} is currently '{table['status']}' and cannot be seated"
        )

    location_id = table["location_id"]

    # Create a draft order for this table
    # Get next order number
    order_num_resp = sb.rpc("next_order_number", {"p_location_id": location_id}).execute()
    order_number = order_num_resp.data if order_num_resp.data else 1

    # Build display number from order_number
    display_number = f"D-{order_number:03d}"

    order_row: dict[str, Any] = {
        "org_id": org_id,
        "location_id": location_id,
        "order_number": order_number,
        "display_number": display_number,
        "order_type": "dine_in",
        "status": "draft",
        "server_id": server_id,
        "table_id": table_id,
        "guest_count": guest_count,
        "opened_at": now,
    }
    if reservation_id:
        order_row["metadata"] = {"reservation_id": reservation_id}

    order_resp = sb.table("orders").insert(order_row).execute()
    order = order_resp.data[0]

    # Update table state
    table_update: dict[str, Any] = {
        "status": "seated",
        "current_order_id": order["id"],
        "current_server_id": server_id,
        "seated_at": now,
        "updated_at": now,
    }

    updated_table_resp = (
        sb.table("tables")
        .update(table_update)
        .eq("id", table_id)
        .eq("org_id", org_id)
        .execute()
    )
    updated_table = updated_table_resp.data[0]

    invalidate_floor_plan(location_id)

    event_bus.emit("table.seated", {
        "org_id": org_id,
        "location_id": location_id,
        "table_id": table_id,
        "table_name": table["name"],
        "order_id": order["id"],
        "server_id": server_id,
        "guest_count": guest_count,
        "seated_at": now,
    })

    log.info(
        "table.seated",
        table_id=table_id,
        table_name=table["name"],
        order_id=order["id"],
        guest_count=guest_count,
        server_id=server_id,
    )

    return updated_table, order


def clear_table(org_id: str, table_id: str) -> dict[str, Any]:
    sb = _get_supabase()
    now = _utcnow()

    # Fetch current table state
    table_resp = (
        sb.table("tables")
        .select("id, name, location_id, status, current_order_id, seated_at, current_server_id")
        .eq("id", table_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not table_resp.data:
        raise ValueError(f"Table {table_id} not found")

    table = table_resp.data

    if table["status"] == "available":
        raise ValueError(f"Table {table['name']} is already available")

    location_id = table["location_id"]

    # Calculate turn time before clearing
    turn_minutes = _calculate_turn_time(table.get("seated_at"))

    # Update table to dirty
    table_update: dict[str, Any] = {
        "status": "dirty",
        "updated_at": now,
    }

    updated_resp = (
        sb.table("tables")
        .update(table_update)
        .eq("id", table_id)
        .eq("org_id", org_id)
        .execute()
    )
    updated_table = updated_resp.data[0]

    invalidate_floor_plan(location_id)

    event_bus.emit("table.cleared", {
        "org_id": org_id,
        "location_id": location_id,
        "table_id": table_id,
        "table_name": table["name"],
        "cleared_at": now,
        "turn_time_minutes": turn_minutes,
        "previous_order_id": table.get("current_order_id"),
        "previous_server_id": table.get("current_server_id"),
    })

    log.info(
        "table.cleared",
        table_id=table_id,
        table_name=table["name"],
        turn_time_minutes=turn_minutes,
    )

    return updated_table


def update_table_status(org_id: str, table_id: str, new_status: str) -> dict[str, Any]:
    sb = _get_supabase()
    now = _utcnow()

    if new_status not in VALID_TABLE_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of: {VALID_TABLE_STATUSES}")

    # Fetch current table state
    table_resp = (
        sb.table("tables")
        .select("id, name, location_id, status, current_order_id, current_server_id, seated_at")
        .eq("id", table_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not table_resp.data:
        raise ValueError(f"Table {table_id} not found")

    table = table_resp.data
    previous_status = table["status"]
    location_id = table["location_id"]

    table_update: dict[str, Any] = {
        "status": new_status,
        "updated_at": now,
    }

    # If marking as available, clear the occupancy fields
    if new_status == "available":
        table_update["current_order_id"] = None
        table_update["current_server_id"] = None
        table_update["seated_at"] = None

    updated_resp = (
        sb.table("tables")
        .update(table_update)
        .eq("id", table_id)
        .eq("org_id", org_id)
        .execute()
    )
    updated_table = updated_resp.data[0]

    invalidate_floor_plan(location_id)

    event_bus.emit("table.status_changed", {
        "org_id": org_id,
        "location_id": location_id,
        "table_id": table_id,
        "table_name": table["name"],
        "previous_status": previous_status,
        "new_status": new_status,
        "changed_at": now,
    })

    log.info(
        "table.status_changed",
        table_id=table_id,
        table_name=table["name"],
        previous_status=previous_status,
        new_status=new_status,
    )

    return updated_table


def get_table_history(org_id: str, table_id: str, limit: int = 20) -> list[dict[str, Any]]:
    sb = _get_supabase()

    # Verify table exists
    table_resp = (
        sb.table("tables")
        .select("id, name")
        .eq("id", table_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not table_resp.data:
        raise ValueError(f"Table {table_id} not found")

    # Fetch past orders for this table
    orders_resp = (
        sb.table("orders")
        .select(
            "id, order_number, display_number, status, order_type, "
            "server_id, guest_count, subtotal, total, tip_total, "
            "opened_at, closed_at"
        )
        .eq("table_id", table_id)
        .eq("org_id", org_id)
        .order("opened_at", desc=True)
        .limit(limit)
        .execute()
    )
    orders = orders_resp.data or []

    # Enrich with server names
    server_ids = list({o["server_id"] for o in orders if o.get("server_id")})
    server_map: dict[str, str] = {}
    if server_ids:
        srv_resp = (
            sb.table("users")
            .select("id, display_name")
            .in_("id", server_ids)
            .execute()
        )
        server_map = {s["id"]: s["display_name"] for s in (srv_resp.data or [])}

    for order in orders:
        order["server_name"] = server_map.get(order.get("server_id", ""), None)
        # Calculate turn time for closed orders
        if order.get("opened_at") and order.get("closed_at"):
            try:
                opened = datetime.fromisoformat(order["opened_at"].replace("Z", "+00:00"))
                closed = datetime.fromisoformat(order["closed_at"].replace("Z", "+00:00"))
                order["turn_time_minutes"] = int((closed - opened).total_seconds() / 60)
            except Exception:
                order["turn_time_minutes"] = None
        else:
            order["turn_time_minutes"] = None

    return orders


def get_sections(org_id: str, location_id: str) -> list[dict[str, Any]]:
    sb = _get_supabase()

    tables_resp = (
        sb.table("tables")
        .select("id, section, status, current_server_id")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
        .execute()
    )
    tables = tables_resp.data or []

    # Group by section
    section_map: dict[str, dict[str, Any]] = {}
    for t in tables:
        sec = t.get("section") or "Unassigned"
        if sec not in section_map:
            section_map[sec] = {
                "section": sec,
                "total_tables": 0,
                "available": 0,
                "occupied": 0,
                "dirty": 0,
                "reserved": 0,
                "server_ids": set(),
            }
        entry = section_map[sec]
        entry["total_tables"] += 1

        status = t.get("status", "available")
        if status == "available":
            entry["available"] += 1
        elif status == "dirty":
            entry["dirty"] += 1
        elif status == "reserved":
            entry["reserved"] += 1
        else:
            entry["occupied"] += 1

        if t.get("current_server_id"):
            entry["server_ids"].add(t["current_server_id"])

    # Resolve server names
    all_server_ids = set()
    for entry in section_map.values():
        all_server_ids.update(entry["server_ids"])

    server_map: dict[str, str] = {}
    if all_server_ids:
        srv_resp = (
            sb.table("users")
            .select("id, display_name")
            .in_("id", list(all_server_ids))
            .execute()
        )
        server_map = {s["id"]: s["display_name"] for s in (srv_resp.data or [])}

    result: list[dict[str, Any]] = []
    for sec_name, entry in sorted(section_map.items()):
        servers = [
            {"id": sid, "name": server_map.get(sid, "Unknown")}
            for sid in entry["server_ids"]
        ]
        result.append({
            "section": sec_name,
            "total_tables": entry["total_tables"],
            "available": entry["available"],
            "occupied": entry["occupied"],
            "dirty": entry["dirty"],
            "reserved": entry["reserved"],
            "servers": servers,
        })

    return result


def get_table_status_summary(org_id: str, location_id: str) -> dict[str, Any]:
    sb = _get_supabase()

    tables_resp = (
        sb.table("tables")
        .select("id, status")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
        .execute()
    )
    tables = tables_resp.data or []

    counts: dict[str, int] = {s: 0 for s in VALID_TABLE_STATUSES}
    for t in tables:
        status = t.get("status", "available")
        if status in counts:
            counts[status] += 1
        else:
            counts[status] = 1

    total = len(tables)
    occupied = total - counts.get("available", 0) - counts.get("dirty", 0) - counts.get("reserved", 0)

    return {
        "total_tables": total,
        "occupied": occupied,
        "counts": counts,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _calculate_turn_time(seated_at: str | None) -> int | None:
    if not seated_at:
        return None
    try:
        seated = datetime.fromisoformat(seated_at.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - seated
        return int(delta.total_seconds() / 60)
    except Exception:
        return None
