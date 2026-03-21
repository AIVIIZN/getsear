"""
KDS module API routes.

All routes are gated by @require_auth and @require_module("mod.kds").
"""

from __future__ import annotations

from flask import Blueprint

from app.shared.decorators import require_auth, require_module, require_permission, require_location
from app.shared.responses import api_success, api_error
from app.shared.tenant import get_current_org_id, get_current_location_id

bp = Blueprint("kds", __name__, template_folder="templates")


@bp.route("/stations", methods=["GET"])
@require_auth
@require_module("mod.kds")
@require_location
@require_permission("kds.view")
def list_stations() -> tuple:
    """List all KDS stations for the current location."""
    from app.extensions import supabase_client

    org_id = get_current_org_id()
    location_id = get_current_location_id()

    resp = (
        supabase_client.table("kds_stations")
        .select("*")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )
    return api_success(data=resp.data)


@bp.route("/tickets", methods=["GET"])
@require_auth
@require_module("mod.kds")
@require_location
@require_permission("kds.view")
def list_active_tickets() -> tuple:
    """List all active (unfulfilled) tickets for the current location."""
    from app.extensions import supabase_client

    org_id = get_current_org_id()
    location_id = get_current_location_id()

    resp = (
        supabase_client.table("kds_tickets")
        .select("*, kds_ticket_items(*)")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .in_("status", ["pending", "in_progress"])
        .order("created_at")
        .execute()
    )
    return api_success(data=resp.data)


@bp.route("/tickets/<ticket_id>/bump", methods=["POST"])
@require_auth
@require_module("mod.kds")
@require_permission("kds.bump")
def bump_ticket(ticket_id: str) -> tuple:
    """Mark a ticket as completed (bumped off the screen)."""
    from app.extensions import supabase_client
    from app.shared.event_bus import event_bus

    org_id = get_current_org_id()

    resp = (
        supabase_client.table("kds_tickets")
        .update({"status": "completed"})
        .eq("id", ticket_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not resp.data:
        return api_error("Ticket not found", status=404)

    event_bus.emit("kds.ticket_bumped", {
        "org_id": org_id,
        "ticket_id": ticket_id,
    })

    return api_success(message="Ticket bumped")


@bp.route("/tickets/<ticket_id>/recall", methods=["POST"])
@require_auth
@require_module("mod.kds")
@require_permission("kds.recall")
def recall_ticket(ticket_id: str) -> tuple:
    """Recall a bumped ticket back to the screen."""
    from app.extensions import supabase_client
    from app.shared.event_bus import event_bus

    org_id = get_current_org_id()

    resp = (
        supabase_client.table("kds_tickets")
        .update({"status": "in_progress"})
        .eq("id", ticket_id)
        .eq("org_id", org_id)
        .eq("status", "completed")
        .execute()
    )

    if not resp.data:
        return api_error("Ticket not found or not in completed state", status=404)

    event_bus.emit("kds.ticket_recalled", {
        "org_id": org_id,
        "ticket_id": ticket_id,
    })

    return api_success(message="Ticket recalled")


@bp.route("/stations", methods=["POST"])
@require_auth
@require_module("mod.kds")
@require_location
@require_permission("kds.manage")
def create_station() -> tuple:
    """Create a new KDS station."""
    from flask import request
    from app.extensions import supabase_client

    org_id = get_current_org_id()
    location_id = get_current_location_id()
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    if not name:
        return api_error("name is required", status=400)

    station_type = data.get("type", "kitchen")
    prep_stations = data.get("prep_stations", [])
    terminal_id = data.get("terminal_id")
    display_settings = data.get("display_settings", {})

    row = {
        "org_id": org_id,
        "location_id": location_id,
        "name": name,
        "type": station_type,
        "prep_stations": prep_stations,
        "terminal_id": terminal_id,
        "display_settings": display_settings,
        "is_active": True,
    }
    if data.get("sort_order") is not None:
        row["sort_order"] = data["sort_order"]

    resp = supabase_client.table("kds_stations").insert(row).execute()
    if not resp.data:
        return api_error("Failed to create station", status=500)

    return api_success(data=resp.data[0], status=201)


@bp.route("/stations/<station_id>", methods=["PUT"])
@require_auth
@require_module("mod.kds")
@require_permission("kds.manage")
def update_station(station_id: str) -> tuple:
    """Update a KDS station."""
    from flask import request
    from app.extensions import supabase_client

    org_id = get_current_org_id()
    data = request.get_json(silent=True) or {}

    allowed = {"name", "type", "prep_stations", "terminal_id", "display_settings", "sort_order", "is_active"}
    updates = {k: v for k, v in data.items() if k in allowed}

    if not updates:
        return api_error("No valid fields to update", status=400)

    resp = (
        supabase_client.table("kds_stations")
        .update(updates)
        .eq("id", station_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not resp.data:
        return api_error("Station not found", status=404)

    return api_success(data=resp.data[0])


@bp.route("/tickets/bump-all/<order_id>", methods=["POST"])
@require_auth
@require_module("mod.kds")
@require_permission("kds.bump")
def bump_all_tickets(order_id: str) -> tuple:
    """Bump all tickets for an order at once."""
    from app.extensions import supabase_client
    from app.shared.event_bus import event_bus

    org_id = get_current_org_id()

    resp = (
        supabase_client.table("kds_tickets")
        .update({"status": "completed"})
        .eq("order_id", order_id)
        .eq("org_id", org_id)
        .in_("status", ["pending", "in_progress"])
        .execute()
    )

    bumped_count = len(resp.data or [])

    event_bus.emit("kds.tickets_bumped", {
        "org_id": org_id,
        "order_id": order_id,
        "bumped_count": bumped_count,
    })

    return api_success(message=f"Bumped {bumped_count} ticket(s)", data={"bumped_count": bumped_count})
