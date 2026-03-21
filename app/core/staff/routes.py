"""Staff API blueprint — CRUD, time clock, breaks, tips."""

from __future__ import annotations

import structlog
from flask import Blueprint, g, request

from app.core.staff.services import (
    approve_time_entry,
    clock_in,
    clock_out,
    create_staff_member,
    deactivate_staff_member,
    distribute_tips,
    edit_time_entry,
    end_break,
    get_on_duty_staff,
    get_staff,
    get_staff_member,
    get_time_entries,
    get_tip_summary,
    start_break,
    update_staff_member,
)
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_location, require_role
from app.shared.responses import api_error, api_paginated, api_success
from app.shared.validators import validate_required, validate_uuid

log = structlog.get_logger(__name__)

staff_bp = Blueprint("staff", __name__, url_prefix="/api/v1/staff")


# ---------------------------------------------------------------------------
# Staff CRUD
# ---------------------------------------------------------------------------


@staff_bp.route("/", methods=["GET"])
@require_auth
def list_staff():
    """List staff members for org/location. Filter by role, location_id, is_active."""
    org_id = g.current_user.org_id
    role_filter = request.args.get("role")
    location_id = request.args.get("location_id")
    is_active = request.args.get("is_active", "true").lower() != "false"
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    except (ValueError, TypeError):
        per_page = 50

    try:
        staff, total = get_staff(
            org_id=org_id,
            location_id=location_id,
            role=role_filter,
            is_active=is_active,
            page=page,
            per_page=per_page,
        )
        return api_paginated(staff, total, page, per_page)
    except Exception as exc:
        log.exception("staff.list_failed")
        return api_error(f"Failed to list staff: {exc}", 500)


@staff_bp.route("/<staff_id>", methods=["GET"])
@require_auth
def get_single_staff(staff_id: str):
    """Get a single staff member with permissions, locations, employment details."""
    valid, msg = validate_uuid(staff_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    try:
        user = get_staff_member(org_id, staff_id)
        if not user:
            return api_error("Staff member not found", 404)
        return api_success(user)
    except Exception as exc:
        log.exception("staff.get_failed", staff_id=staff_id)
        return api_error(f"Failed to get staff member: {exc}", 500)


@staff_bp.route("/", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def create_staff():
    """Create a new staff member. Requires admin+."""
    data = request.get_json(silent=True) or {}
    ok, missing = validate_required(data, ["first_name", "last_name", "role"])
    if not ok:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    org_id = g.current_user.org_id

    try:
        user = create_staff_member(org_id, data)
        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.created",
            entity_type="user",
            entity_id=user.get("id", ""),
            description=f"Created staff member {data.get('first_name')} {data.get('last_name')}",
        )
        return api_success(user, status=201)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.create_failed")
        return api_error(f"Failed to create staff member: {exc}", 500)


@staff_bp.route("/<staff_id>", methods=["PUT"])
@require_auth
def update_staff(staff_id: str):
    """Update a staff member. Admin+ for all fields, manager for limited fields.

    Cannot change own role.
    """
    valid, msg = validate_uuid(staff_id)
    if not valid:
        return api_error(msg, 400)

    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id
    current_role = g.current_user.role
    current_user_id = g.current_user.user_id

    # Role-based field restrictions
    admin_roles = ("owner", "admin")
    manager_roles = ("owner", "admin", "manager")

    if current_role not in manager_roles:
        return api_error("Manager or higher role required", 403)

    # Cannot change own role
    if staff_id == current_user_id and "role" in data:
        return api_error("Cannot change your own role", 400)

    # Managers can only update limited fields
    if current_role == "manager":
        allowed = {"display_name", "phone", "avatar_url", "pin", "location_ids"}
        restricted_keys = set(data.keys()) - allowed
        if restricted_keys:
            return api_error(
                f"Manager cannot update fields: {', '.join(restricted_keys)}. "
                "Admin or owner required.",
                403,
            )

    # Non-owners cannot set role to owner
    if data.get("role") == "owner" and current_role != "owner":
        return api_error("Only owners can assign the owner role", 403)

    try:
        user = update_staff_member(org_id, staff_id, data)
        if not user:
            return api_error("Staff member not found", 404)

        log_audit(
            org_id=org_id,
            user_id=current_user_id,
            user_name=g.current_user.display_name,
            user_role=current_role,
            action="staff.updated",
            entity_type="user",
            entity_id=staff_id,
            description=f"Updated staff member fields: {', '.join(data.keys())}",
        )
        return api_success(user)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.update_failed", staff_id=staff_id)
        return api_error(f"Failed to update staff member: {exc}", 500)


@staff_bp.route("/<staff_id>", methods=["DELETE"])
@require_auth
@require_role("owner", "admin")
def delete_staff(staff_id: str):
    """Soft-delete (deactivate) a staff member. Requires admin+."""
    valid, msg = validate_uuid(staff_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    # Cannot deactivate yourself
    if staff_id == g.current_user.user_id:
        return api_error("Cannot deactivate your own account", 400)

    try:
        success = deactivate_staff_member(org_id, staff_id)
        if not success:
            return api_error("Staff member not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.deactivated",
            entity_type="user",
            entity_id=staff_id,
            description=f"Deactivated staff member {staff_id}",
        )
        return api_success(message="Staff member deactivated")
    except Exception as exc:
        log.exception("staff.delete_failed", staff_id=staff_id)
        return api_error(f"Failed to deactivate staff member: {exc}", 500)


# ---------------------------------------------------------------------------
# On-Duty
# ---------------------------------------------------------------------------


@staff_bp.route("/on-duty", methods=["GET"])
@require_auth
@require_location
def list_on_duty():
    """List currently clocked-in staff for a location."""
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        staff = get_on_duty_staff(org_id, location_id)
        return api_success(staff)
    except Exception as exc:
        log.exception("staff.on_duty_failed")
        return api_error(f"Failed to get on-duty staff: {exc}", 500)


# ---------------------------------------------------------------------------
# Time Clock
# ---------------------------------------------------------------------------


@staff_bp.route("/clock-in", methods=["POST"])
@require_auth
@require_location
def do_clock_in():
    """Clock in the current user."""
    org_id = g.current_user.org_id
    user_id = g.current_user.user_id
    location_id = g.location_id

    data = request.get_json(silent=True) or {}
    role = data.get("role")

    try:
        entry = clock_in(org_id, user_id, location_id, role=role)
        log_audit(
            org_id=org_id,
            user_id=user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.clock_in",
            entity_type="time_entry",
            entity_id=entry.get("id", ""),
            description=f"Clocked in at location {location_id}",
        )
        return api_success(entry, status=201)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.clock_in_failed")
        return api_error(f"Failed to clock in: {exc}", 500)


@staff_bp.route("/clock-out", methods=["POST"])
@require_auth
def do_clock_out():
    """Clock out the current user. Optionally report tips."""
    org_id = g.current_user.org_id
    user_id = g.current_user.user_id

    data = request.get_json(silent=True) or {}
    cash_tips = float(data.get("cash_tips", 0))
    credit_tips = float(data.get("credit_tips", 0))

    try:
        entry = clock_out(org_id, user_id, cash_tips=cash_tips, credit_tips=credit_tips)
        log_audit(
            org_id=org_id,
            user_id=user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.clock_out",
            entity_type="time_entry",
            entity_id=entry.get("id", ""),
            description=f"Clocked out. Tips: cash={cash_tips}, credit={credit_tips}",
        )
        return api_success(entry)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.clock_out_failed")
        return api_error(f"Failed to clock out: {exc}", 500)


@staff_bp.route("/break/start", methods=["POST"])
@require_auth
def do_start_break():
    """Start a break for the current user."""
    org_id = g.current_user.org_id
    user_id = g.current_user.user_id

    data = request.get_json(silent=True) or {}
    break_type = data.get("break_type", "unpaid")

    try:
        brk = start_break(org_id, user_id, break_type)
        return api_success(brk, status=201)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.break_start_failed")
        return api_error(f"Failed to start break: {exc}", 500)


@staff_bp.route("/break/end", methods=["POST"])
@require_auth
def do_end_break():
    """End the current break for the current user."""
    org_id = g.current_user.org_id
    user_id = g.current_user.user_id

    try:
        brk = end_break(org_id, user_id)
        return api_success(brk)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.break_end_failed")
        return api_error(f"Failed to end break: {exc}", 500)


# ---------------------------------------------------------------------------
# Time Entries
# ---------------------------------------------------------------------------


@staff_bp.route("/time-entries", methods=["GET"])
@require_auth
def list_time_entries():
    """List time entries. Manager+ can see all; others see only their own."""
    org_id = g.current_user.org_id
    current_role = g.current_user.role
    current_user_id = g.current_user.user_id

    filters: dict = {}

    # Non-managers can only see their own entries
    requested_user_id = request.args.get("user_id")
    manager_roles = ("owner", "admin", "manager")

    if current_role in manager_roles:
        if requested_user_id:
            filters["user_id"] = requested_user_id
    else:
        filters["user_id"] = current_user_id

    filters["location_id"] = request.args.get("location_id")
    filters["start_date"] = request.args.get("start_date")
    filters["end_date"] = request.args.get("end_date")

    is_approved = request.args.get("is_approved")
    if is_approved is not None:
        filters["is_approved"] = is_approved.lower() == "true"

    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    except (ValueError, TypeError):
        per_page = 50

    try:
        entries, total = get_time_entries(org_id, filters, page, per_page)
        return api_paginated(entries, total, page, per_page)
    except Exception as exc:
        log.exception("staff.time_entries_failed")
        return api_error(f"Failed to list time entries: {exc}", 500)


@staff_bp.route("/time-entries/<entry_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin", "manager")
def edit_entry(entry_id: str):
    """Edit a time entry (clock_in, clock_out times). Requires manager+."""
    valid, msg = validate_uuid(entry_id)
    if not valid:
        return api_error(msg, 400)

    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id
    edited_by = g.current_user.user_id

    try:
        entry = edit_time_entry(org_id, entry_id, data, edited_by)
        if not entry:
            return api_error("Time entry not found or no valid fields", 404)

        log_audit(
            org_id=org_id,
            user_id=edited_by,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.time_entry_edited",
            entity_type="time_entry",
            entity_id=entry_id,
            description=f"Edited time entry {entry_id}: {', '.join(data.keys())}",
        )
        return api_success(entry)
    except Exception as exc:
        log.exception("staff.edit_entry_failed", entry_id=entry_id)
        return api_error(f"Failed to edit time entry: {exc}", 500)


@staff_bp.route("/time-entries/<entry_id>/approve", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
def approve_entry(entry_id: str):
    """Approve a time entry. Requires manager+."""
    valid, msg = validate_uuid(entry_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id
    approved_by = g.current_user.user_id

    try:
        entry = approve_time_entry(org_id, entry_id, approved_by)
        if not entry:
            return api_error("Time entry not found", 404)

        log_audit(
            org_id=org_id,
            user_id=approved_by,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.time_entry_approved",
            entity_type="time_entry",
            entity_id=entry_id,
            description=f"Approved time entry {entry_id}",
        )
        return api_success(entry)
    except Exception as exc:
        log.exception("staff.approve_failed", entry_id=entry_id)
        return api_error(f"Failed to approve time entry: {exc}", 500)


# ---------------------------------------------------------------------------
# Tips
# ---------------------------------------------------------------------------


@staff_bp.route("/tips", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def get_tips():
    """Get tip summary for a date/shift. Requires manager+."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    shift_date = request.args.get("shift_date")

    if not shift_date:
        from datetime import date
        shift_date = date.today().isoformat()

    try:
        summary = get_tip_summary(org_id, location_id, shift_date)
        return api_success(summary)
    except Exception as exc:
        log.exception("staff.tips_failed")
        return api_error(f"Failed to get tip summary: {exc}", 500)


@staff_bp.route("/tip-pool/distribute", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def distribute_tip_pool():
    """Distribute tip pool for a shift. Requires manager+."""
    data = request.get_json(silent=True) or {}
    ok, missing = validate_required(data, ["shift_date", "distribution_method"])
    if not ok:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    org_id = g.current_user.org_id
    location_id = g.location_id
    shift_date = data["shift_date"]
    method = data["distribution_method"]
    pool_method = data.get("pool_method")

    try:
        distributions = distribute_tips(
            org_id, location_id, shift_date, method, pool_method
        )
        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="staff.tips_distributed",
            entity_type="tip_distribution",
            entity_id=shift_date,
            description=f"Distributed tips for {shift_date} via {method}/{pool_method}",
        )
        return api_success(distributions)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("staff.tip_distribute_failed")
        return api_error(f"Failed to distribute tips: {exc}", 500)
