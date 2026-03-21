"""Table management API blueprint for Sear POS."""

from __future__ import annotations

import structlog
from flask import Blueprint, g, request

from app.core.pos.table_services import (
    VALID_TABLE_SHAPES,
    VALID_TABLE_STATUSES,
    clear_table,
    create_floor_plan,
    create_table,
    delete_floor_plan,
    get_floor_plan,
    get_floor_plans,
    get_sections,
    get_table_history,
    get_table_status_summary,
    get_tables,
    seat_table,
    update_floor_plan,
    update_table,
    update_table_status,
)
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_location, require_role
from app.shared.responses import api_error, api_success
from app.shared.validators import validate_enum, validate_required, validate_uuid

log = structlog.get_logger(__name__)

tables_bp = Blueprint("tables", __name__, url_prefix="/api/v1/tables")


# ---------------------------------------------------------------------------
# Floor plans
# ---------------------------------------------------------------------------


@tables_bp.route("/floor-plans", methods=["GET"])
@require_auth
@require_location
def list_floor_plans():
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        plans = get_floor_plans(org_id, location_id)
    except Exception:
        log.exception("floor_plans.list_failed")
        return api_error("Failed to retrieve floor plans", 500)

    return api_success(plans)


@tables_bp.route("/floor-plans/<floor_plan_id>", methods=["GET"])
@require_auth
@require_location
def get_floor_plan_route(floor_plan_id: str):
    org_id = g.current_user.org_id

    ok, msg = validate_uuid(floor_plan_id)
    if not ok:
        return api_error(msg, 400)

    try:
        plan = get_floor_plan(org_id, floor_plan_id)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception:
        log.exception("floor_plans.get_failed")
        return api_error("Failed to retrieve floor plan", 500)

    return api_success(plan)


@tables_bp.route("/floor-plans", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def create_floor_plan_route():
    org_id = g.current_user.org_id
    location_id = g.location_id
    data = request.get_json(silent=True) or {}

    valid, missing = validate_required(data, ["name"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    try:
        plan = create_floor_plan(org_id, location_id, data)
    except Exception:
        log.exception("floor_plans.create_failed")
        return api_error("Failed to create floor plan", 500)

    log_audit(
        action="floor_plan.created",
        entity_type="floor_plan",
        entity_id=plan["id"],
        description=f"Created floor plan '{plan['name']}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
        new_state={"name": plan["name"], "location_id": location_id},
    )

    return api_success(plan, status=201)


@tables_bp.route("/floor-plans/<floor_plan_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def update_floor_plan_route(floor_plan_id: str):
    org_id = g.current_user.org_id
    data = request.get_json(silent=True) or {}

    ok, msg = validate_uuid(floor_plan_id)
    if not ok:
        return api_error(msg, 400)

    try:
        plan = update_floor_plan(org_id, floor_plan_id, data)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception:
        log.exception("floor_plans.update_failed")
        return api_error("Failed to update floor plan", 500)

    log_audit(
        action="floor_plan.updated",
        entity_type="floor_plan",
        entity_id=floor_plan_id,
        description=f"Updated floor plan '{plan.get('name', floor_plan_id)}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
        new_state=data,
    )

    return api_success(plan)


@tables_bp.route("/floor-plans/<floor_plan_id>", methods=["DELETE"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def delete_floor_plan_route(floor_plan_id: str):
    org_id = g.current_user.org_id

    ok, msg = validate_uuid(floor_plan_id)
    if not ok:
        return api_error(msg, 400)

    try:
        delete_floor_plan(org_id, floor_plan_id)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("floor_plans.delete_failed")
        return api_error("Failed to delete floor plan", 500)

    log_audit(
        action="floor_plan.deleted",
        entity_type="floor_plan",
        entity_id=floor_plan_id,
        description=f"Deleted floor plan {floor_plan_id}",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
    )

    return api_success({"deleted": True})


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


@tables_bp.route("/", methods=["GET"])
@require_auth
@require_location
def list_tables():
    org_id = g.current_user.org_id
    location_id = g.location_id

    floor_plan_id = request.args.get("floor_plan_id")
    section = request.args.get("section")
    status = request.args.get("status")

    if status:
        ok, msg = validate_enum(status, VALID_TABLE_STATUSES)
        if not ok:
            return api_error(msg, 400)

    try:
        result = get_tables(org_id, location_id, floor_plan_id=floor_plan_id, section=section, status=status)
    except Exception:
        log.exception("tables.list_failed")
        return api_error("Failed to retrieve tables", 500)

    return api_success(result)


@tables_bp.route("/", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def create_table_route():
    org_id = g.current_user.org_id
    location_id = g.location_id
    data = request.get_json(silent=True) or {}

    valid, missing = validate_required(data, ["table_number", "floor_plan_id"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    ok, msg = validate_uuid(data["floor_plan_id"])
    if not ok:
        return api_error(f"floor_plan_id: {msg}", 400)

    if data.get("shape"):
        ok, msg = validate_enum(data["shape"], VALID_TABLE_SHAPES)
        if not ok:
            return api_error(msg, 400)

    try:
        table = create_table(org_id, location_id, data)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("tables.create_failed")
        return api_error("Failed to create table", 500)

    log_audit(
        action="table.created",
        entity_type="table",
        entity_id=table["id"],
        description=f"Created table '{table['name']}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
        new_state={
            "name": table["name"],
            "capacity": table.get("capacity"),
            "shape": table.get("shape"),
            "floor_plan_id": data["floor_plan_id"],
        },
    )

    return api_success(table, status=201)


@tables_bp.route("/<table_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def update_table_route(table_id: str):
    org_id = g.current_user.org_id
    data = request.get_json(silent=True) or {}

    ok, msg = validate_uuid(table_id)
    if not ok:
        return api_error(msg, 400)

    if data.get("shape"):
        ok, msg = validate_enum(data["shape"], VALID_TABLE_SHAPES)
        if not ok:
            return api_error(msg, 400)

    try:
        table = update_table(org_id, table_id, data)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception:
        log.exception("tables.update_failed")
        return api_error("Failed to update table", 500)

    log_audit(
        action="table.updated",
        entity_type="table",
        entity_id=table_id,
        description=f"Updated table '{table.get('name', table_id)}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
        new_state=data,
    )

    return api_success(table)


@tables_bp.route("/<table_id>/seat", methods=["POST"])
@require_auth
@require_location
def seat_table_route(table_id: str):
    org_id = g.current_user.org_id
    data = request.get_json(silent=True) or {}

    ok, msg = validate_uuid(table_id)
    if not ok:
        return api_error(msg, 400)

    valid, missing = validate_required(data, ["guest_count", "server_id"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    guest_count = data.get("guest_count")
    if not isinstance(guest_count, int) or guest_count < 1:
        return api_error("guest_count must be a positive integer", 400)

    ok, msg = validate_uuid(data["server_id"])
    if not ok:
        return api_error(f"server_id: {msg}", 400)

    reservation_id = data.get("reservation_id")
    if reservation_id:
        ok, msg = validate_uuid(reservation_id)
        if not ok:
            return api_error(f"reservation_id: {msg}", 400)

    try:
        table, order = seat_table(
            org_id=org_id,
            table_id=table_id,
            guest_count=guest_count,
            server_id=data["server_id"],
            reservation_id=reservation_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("tables.seat_failed")
        return api_error("Failed to seat table", 500)

    log_audit(
        action="table.seated",
        entity_type="table",
        entity_id=table_id,
        description=f"Seated {guest_count} guests at table '{table.get('name', table_id)}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
        new_state={
            "guest_count": guest_count,
            "server_id": data["server_id"],
            "order_id": order["id"],
            "reservation_id": reservation_id,
        },
    )

    return api_success({
        "table": table,
        "order": order,
    })


@tables_bp.route("/<table_id>/clear", methods=["POST"])
@require_auth
@require_location
def clear_table_route(table_id: str):
    org_id = g.current_user.org_id

    ok, msg = validate_uuid(table_id)
    if not ok:
        return api_error(msg, 400)

    try:
        table = clear_table(org_id, table_id)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("tables.clear_failed")
        return api_error("Failed to clear table", 500)

    log_audit(
        action="table.cleared",
        entity_type="table",
        entity_id=table_id,
        description=f"Cleared table '{table.get('name', table_id)}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
    )

    return api_success(table)


@tables_bp.route("/<table_id>/status", methods=["PUT"])
@require_auth
@require_location
def update_table_status_route(table_id: str):
    org_id = g.current_user.org_id
    data = request.get_json(silent=True) or {}

    ok, msg = validate_uuid(table_id)
    if not ok:
        return api_error(msg, 400)

    valid, missing = validate_required(data, ["new_status"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    new_status = data["new_status"]
    ok, msg = validate_enum(new_status, VALID_TABLE_STATUSES)
    if not ok:
        return api_error(msg, 400)

    try:
        table = update_table_status(org_id, table_id, new_status)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("tables.status_update_failed")
        return api_error("Failed to update table status", 500)

    log_audit(
        action="table.status_changed",
        entity_type="table",
        entity_id=table_id,
        description=f"Table '{table.get('name', table_id)}' status changed to '{new_status}'",
        org_id=org_id,
        user_id=g.current_user.user_id,
        user_name=g.current_user.display_name,
        user_role=g.current_user.role,
        new_state={"status": new_status},
    )

    return api_success(table)


@tables_bp.route("/<table_id>/history", methods=["GET"])
@require_auth
@require_location
def table_history_route(table_id: str):
    org_id = g.current_user.org_id

    ok, msg = validate_uuid(table_id)
    if not ok:
        return api_error(msg, 400)

    limit = request.args.get("limit", 20, type=int)
    limit = min(max(limit, 1), 100)

    try:
        history = get_table_history(org_id, table_id, limit=limit)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception:
        log.exception("tables.history_failed")
        return api_error("Failed to retrieve table history", 500)

    return api_success(history)


@tables_bp.route("/sections", methods=["GET"])
@require_auth
@require_location
def list_sections():
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        sections = get_sections(org_id, location_id)
    except Exception:
        log.exception("tables.sections_failed")
        return api_error("Failed to retrieve sections", 500)

    return api_success(sections)


@tables_bp.route("/status-summary", methods=["GET"])
@require_auth
@require_location
def table_status_summary():
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        summary = get_table_status_summary(org_id, location_id)
    except Exception:
        log.exception("tables.status_summary_failed")
        return api_error("Failed to retrieve status summary", 500)

    return api_success(summary)
