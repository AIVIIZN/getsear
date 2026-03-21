"""Staff business logic — CRUD, time clock, breaks, tips, overtime."""

from __future__ import annotations

from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Any

import structlog

from app.extensions import supabase_client

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Staff CRUD
# ---------------------------------------------------------------------------

def get_staff(
    org_id: str,
    location_id: str | None = None,
    role: str | None = None,
    is_active: bool = True,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """List staff members for an org/location with filters and pagination."""
    query = (
        supabase_client.table("users")
        .select("id, org_id, first_name, last_name, display_name, email, phone, role, "
                "hourly_rate, hire_date, is_active, location_ids, avatar_url, "
                "created_at, updated_at", count="exact")
        .eq("org_id", org_id)
        .eq("is_active", is_active)
    )

    if role:
        query = query.eq("role", role)

    if location_id:
        query = query.contains("location_ids", [location_id])

    offset = (page - 1) * per_page
    query = query.order("last_name").range(offset, offset + per_page - 1)

    resp = query.execute()
    staff = resp.data or []
    total = resp.count or 0

    # Attach last_clock_in for each user
    user_ids = [s["id"] for s in staff]
    if user_ids:
        clock_resp = (
            supabase_client.table("time_entries")
            .select("user_id, clock_in")
            .in_("user_id", user_ids)
            .is_("clock_out", "null")
            .order("clock_in", desc=True)
            .execute()
        )
        active_clocks: dict[str, str] = {}
        for entry in (clock_resp.data or []):
            uid = entry["user_id"]
            if uid not in active_clocks:
                active_clocks[uid] = entry["clock_in"]

        for s in staff:
            s["last_clock_in"] = active_clocks.get(s["id"])

    return staff, total


def get_staff_member(org_id: str, user_id: str) -> dict[str, Any] | None:
    """Get a single staff member with permissions, locations, employment details."""
    resp = (
        supabase_client.table("users")
        .select("id, org_id, first_name, last_name, display_name, email, phone, "
                "role, hourly_rate, hire_date, is_active, location_ids, avatar_url, "
                "settings, created_at, updated_at")
        .eq("org_id", org_id)
        .eq("id", user_id)
        .single()
        .execute()
    )
    user = resp.data
    if not user:
        return None

    # Fetch permissions for this user's role + overrides
    user["permissions"] = _get_user_permissions(user_id, user["role"])

    # Fetch location details
    loc_ids = user.get("location_ids") or []
    if loc_ids:
        loc_resp = (
            supabase_client.table("locations")
            .select("id, name, slug")
            .in_("id", loc_ids)
            .execute()
        )
        user["locations"] = loc_resp.data or []
    else:
        user["locations"] = []

    return user


def create_staff_member(org_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new staff member: Supabase Auth user + users table record.

    Raises ValueError on validation failures.
    """
    email = data.get("email", "").strip().lower()
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    phone = data.get("phone", "").strip()
    role = data.get("role", "server")
    pin = data.get("pin", "")
    location_ids = data.get("location_ids", [])
    hourly_rate = data.get("hourly_rate")

    if not first_name or not last_name:
        raise ValueError("first_name and last_name are required")
    if not role:
        raise ValueError("role is required")

    VALID_ROLES = [
        "owner", "admin", "manager", "server", "bartender",
        "host", "kitchen", "cashier", "kiosk", "readonly",
    ]
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {VALID_ROLES}")

    # Create Supabase Auth user if email provided
    auth_id = None
    if email:
        temp_password = data.get("password") or _generate_temp_password()
        try:
            auth_resp = supabase_client.auth.admin.create_user({
                "email": email,
                "password": temp_password,
                "email_confirm": True,
            })
            auth_id = str(auth_resp.user.id)
        except Exception as exc:
            log.error("staff.auth_create_failed", email=email, error=str(exc))
            raise ValueError(f"Failed to create auth user: {exc}") from exc
    else:
        # PIN-only user (no email login)
        import uuid
        auth_id = str(uuid.uuid4())

    # Hash PIN if provided
    pin_hash = None
    if pin:
        if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
            raise ValueError("PIN must be 4-6 digits")

        from app.core.auth.services import hash_pin, verify_pin

        # Check PIN uniqueness within org (must iterate since bcrypt hashes differ)
        existing_resp = (
            supabase_client.table("users")
            .select("id, pin_hash")
            .eq("org_id", org_id)
            .eq("is_active", True)
            .not_.is_("pin_hash", "null")
            .execute()
        )
        for row in (existing_resp.data or []):
            if verify_pin(pin, row["pin_hash"]):
                raise ValueError("PIN already in use by another staff member")

        pin_hash = hash_pin(pin)

    display_name = data.get("display_name") or f"{first_name} {last_name[0]}."

    user_row = {
        "id": auth_id,
        "org_id": org_id,
        "email": email or None,
        "phone": phone or None,
        "first_name": first_name,
        "last_name": last_name,
        "display_name": display_name,
        "role": role,
        "pin_hash": pin_hash,
        "location_ids": location_ids,
        "hourly_rate": float(hourly_rate) if hourly_rate is not None else None,
        "hire_date": data.get("hire_date") or str(date.today()),
        "is_active": True,
    }

    resp = supabase_client.table("users").insert(user_row).execute()
    created = resp.data[0] if resp.data else user_row
    created.pop("pin_hash", None)
    return created


def update_staff_member(
    org_id: str,
    user_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    """Update a staff member. Rehashes PIN if changed.

    Returns updated user or None if not found.
    """
    # Fetch existing
    existing = (
        supabase_client.table("users")
        .select("id, org_id, role")
        .eq("org_id", org_id)
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not existing.data:
        return None

    update_fields: dict[str, Any] = {}
    allowed_fields = [
        "first_name", "last_name", "display_name", "email", "phone",
        "role", "location_ids", "hourly_rate", "hire_date", "avatar_url",
    ]

    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]

    # Handle PIN update
    pin = data.get("pin")
    if pin is not None:
        if pin == "":
            update_fields["pin_hash"] = None
        else:
            if not str(pin).isdigit() or len(str(pin)) < 4 or len(str(pin)) > 6:
                raise ValueError("PIN must be 4-6 digits")

            from app.core.auth.services import hash_pin, verify_pin

            # Check uniqueness (must iterate since bcrypt hashes differ)
            existing_resp = (
                supabase_client.table("users")
                .select("id, pin_hash")
                .eq("org_id", org_id)
                .eq("is_active", True)
                .neq("id", user_id)
                .not_.is_("pin_hash", "null")
                .execute()
            )
            for row in (existing_resp.data or []):
                if verify_pin(str(pin), row["pin_hash"]):
                    raise ValueError("PIN already in use by another staff member")

            update_fields["pin_hash"] = hash_pin(str(pin))

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase_client.table("users")
        .update(update_fields)
        .eq("org_id", org_id)
        .eq("id", user_id)
        .execute()
    )
    updated = resp.data[0] if resp.data else None
    if updated:
        updated.pop("pin_hash", None)
    return updated


def deactivate_staff_member(org_id: str, user_id: str) -> bool:
    """Soft-delete a staff member by setting is_active=False."""
    now = datetime.now(timezone.utc).isoformat()
    resp = (
        supabase_client.table("users")
        .update({"is_active": False, "deleted_at": now, "updated_at": now})
        .eq("org_id", org_id)
        .eq("id", user_id)
        .execute()
    )
    return bool(resp.data)


# ---------------------------------------------------------------------------
# Time Clock
# ---------------------------------------------------------------------------

def clock_in(
    org_id: str,
    user_id: str,
    location_id: str,
    role: str | None = None,
) -> dict[str, Any]:
    """Clock in a user. Validates not already clocked in.

    Raises ValueError if already clocked in.
    """
    # Check for existing open time entry
    existing = (
        supabase_client.table("time_entries")
        .select("id, clock_in")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .is_("clock_out", "null")
        .limit(1)
        .execute()
    )
    if existing.data:
        raise ValueError(
            f"Already clocked in since {existing.data[0]['clock_in']}. "
            "Clock out before clocking in again."
        )

    # Get user's hourly rate and role if not specified
    user_resp = (
        supabase_client.table("users")
        .select("role, hourly_rate")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user_data = user_resp.data or {}
    effective_role = role or user_data.get("role", "server")
    hourly_rate = user_data.get("hourly_rate")

    # Find active shift for this location, if any
    today = date.today().isoformat()
    shift_resp = (
        supabase_client.table("shifts")
        .select("id")
        .eq("location_id", location_id)
        .eq("shift_date", today)
        .eq("is_closed", False)
        .order("start_time", desc=True)
        .limit(1)
        .execute()
    )
    shift_id = shift_resp.data[0]["id"] if shift_resp.data else None

    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "org_id": org_id,
        "location_id": location_id,
        "user_id": user_id,
        "shift_id": shift_id,
        "clock_in": now,
        "role_during_shift": effective_role,
        "hourly_rate": float(hourly_rate) if hourly_rate else None,
    }

    resp = supabase_client.table("time_entries").insert(entry).execute()
    return resp.data[0] if resp.data else entry


def clock_out(
    org_id: str,
    user_id: str,
    cash_tips: float = 0,
    credit_tips: float = 0,
) -> dict[str, Any]:
    """Clock out a user. Calculates hours and overtime.

    Raises ValueError if not clocked in.
    """
    # Find open time entry
    open_entry = (
        supabase_client.table("time_entries")
        .select("*")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .is_("clock_out", "null")
        .order("clock_in", desc=True)
        .limit(1)
        .execute()
    )
    if not open_entry.data:
        raise ValueError("Not currently clocked in")

    entry = open_entry.data[0]
    clock_in_dt = datetime.fromisoformat(entry["clock_in"].replace("Z", "+00:00"))
    clock_out_dt = datetime.now(timezone.utc)

    # Calculate total hours worked
    total_seconds = (clock_out_dt - clock_in_dt).total_seconds()
    total_hours = round(total_seconds / 3600, 2)

    # Subtract unpaid break time
    break_resp = (
        supabase_client.table("break_entries")
        .select("duration_minutes, break_type")
        .eq("time_entry_id", entry["id"])
        .execute()
    )
    unpaid_break_minutes = 0
    for brk in (break_resp.data or []):
        if brk.get("break_type") == "unpaid" and brk.get("duration_minutes"):
            unpaid_break_minutes += brk["duration_minutes"]

    # Close any open breaks
    open_breaks = (
        supabase_client.table("break_entries")
        .select("id, start_time, break_type")
        .eq("time_entry_id", entry["id"])
        .is_("end_time", "null")
        .execute()
    )
    for ob in (open_breaks.data or []):
        brk_start = datetime.fromisoformat(ob["start_time"].replace("Z", "+00:00"))
        brk_dur = round((clock_out_dt - brk_start).total_seconds() / 60)
        supabase_client.table("break_entries").update({
            "end_time": clock_out_dt.isoformat(),
            "duration_minutes": brk_dur,
        }).eq("id", ob["id"]).execute()
        if ob.get("break_type") == "unpaid":
            unpaid_break_minutes += brk_dur

    worked_hours = max(0, total_hours - (unpaid_break_minutes / 60))

    # Calculate overtime
    clock_in_date = clock_in_dt.date()
    regular_hours, overtime_hours = _calculate_overtime(
        user_id, clock_in_date, worked_hours
    )

    # Calculate pay
    hourly_rate = float(entry.get("hourly_rate") or 0)
    regular_pay = round(regular_hours * hourly_rate, 2)
    overtime_pay = round(overtime_hours * hourly_rate * 1.5, 2)
    total_pay = round(regular_pay + overtime_pay, 2)

    update = {
        "clock_out": clock_out_dt.isoformat(),
        "regular_hours": regular_hours,
        "overtime_hours": overtime_hours,
        "total_pay": total_pay,
        "cash_tips": cash_tips,
        "credit_tips": credit_tips,
        "updated_at": clock_out_dt.isoformat(),
    }

    resp = (
        supabase_client.table("time_entries")
        .update(update)
        .eq("id", entry["id"])
        .execute()
    )
    return resp.data[0] if resp.data else {**entry, **update}


def start_break(
    org_id: str,
    user_id: str,
    break_type: str = "unpaid",
) -> dict[str, Any]:
    """Start a break for a clocked-in user.

    Raises ValueError if not clocked in or already on break.
    """
    if break_type not in ("paid", "unpaid"):
        raise ValueError("break_type must be 'paid' or 'unpaid'")

    # Find open time entry
    open_entry = (
        supabase_client.table("time_entries")
        .select("id")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .is_("clock_out", "null")
        .limit(1)
        .execute()
    )
    if not open_entry.data:
        raise ValueError("Not currently clocked in")

    time_entry_id = open_entry.data[0]["id"]

    # Check for existing open break
    existing_break = (
        supabase_client.table("break_entries")
        .select("id")
        .eq("time_entry_id", time_entry_id)
        .is_("end_time", "null")
        .limit(1)
        .execute()
    )
    if existing_break.data:
        raise ValueError("Already on break. End current break first.")

    now = datetime.now(timezone.utc).isoformat()
    brk = {
        "time_entry_id": time_entry_id,
        "break_type": break_type,
        "start_time": now,
    }

    resp = supabase_client.table("break_entries").insert(brk).execute()
    return resp.data[0] if resp.data else brk


def end_break(org_id: str, user_id: str) -> dict[str, Any]:
    """End the current break. Calculates duration.

    Raises ValueError if not on break.
    """
    # Find open time entry
    open_entry = (
        supabase_client.table("time_entries")
        .select("id")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .is_("clock_out", "null")
        .limit(1)
        .execute()
    )
    if not open_entry.data:
        raise ValueError("Not currently clocked in")

    time_entry_id = open_entry.data[0]["id"]

    # Find open break
    open_break = (
        supabase_client.table("break_entries")
        .select("id, start_time, break_type")
        .eq("time_entry_id", time_entry_id)
        .is_("end_time", "null")
        .order("start_time", desc=True)
        .limit(1)
        .execute()
    )
    if not open_break.data:
        raise ValueError("Not currently on break")

    brk = open_break.data[0]
    start_dt = datetime.fromisoformat(brk["start_time"].replace("Z", "+00:00"))
    end_dt = datetime.now(timezone.utc)
    duration_minutes = round((end_dt - start_dt).total_seconds() / 60)

    update = {
        "end_time": end_dt.isoformat(),
        "duration_minutes": duration_minutes,
    }

    resp = (
        supabase_client.table("break_entries")
        .update(update)
        .eq("id", brk["id"])
        .execute()
    )
    return resp.data[0] if resp.data else {**brk, **update}


# ---------------------------------------------------------------------------
# Time Entries
# ---------------------------------------------------------------------------

def get_time_entries(
    org_id: str,
    filters: dict[str, Any],
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """List time entries with filters and pagination."""
    query = (
        supabase_client.table("time_entries")
        .select("*, break_entries(*), users!time_entries_user_id_fkey(first_name, last_name, display_name)",
                count="exact")
        .eq("org_id", org_id)
    )

    if filters.get("user_id"):
        query = query.eq("user_id", filters["user_id"])
    if filters.get("location_id"):
        query = query.eq("location_id", filters["location_id"])
    if filters.get("start_date"):
        query = query.gte("clock_in", f"{filters['start_date']}T00:00:00Z")
    if filters.get("end_date"):
        query = query.lte("clock_in", f"{filters['end_date']}T23:59:59Z")
    if filters.get("is_approved") is not None:
        query = query.eq("is_approved", filters["is_approved"])

    offset = (page - 1) * per_page
    query = query.order("clock_in", desc=True).range(offset, offset + per_page - 1)

    resp = query.execute()
    return resp.data or [], resp.count or 0


def approve_time_entry(
    org_id: str,
    entry_id: str,
    approved_by: str,
) -> dict[str, Any] | None:
    """Approve a time entry. Returns updated entry or None if not found."""
    now = datetime.now(timezone.utc).isoformat()
    resp = (
        supabase_client.table("time_entries")
        .update({
            "is_approved": True,
            "approved_by": approved_by,
            "updated_at": now,
        })
        .eq("org_id", org_id)
        .eq("id", entry_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def edit_time_entry(
    org_id: str,
    entry_id: str,
    data: dict[str, Any],
    edited_by: str,
) -> dict[str, Any] | None:
    """Edit a time entry (clock_in, clock_out times). Returns updated entry or None."""
    now = datetime.now(timezone.utc).isoformat()

    allowed = {"clock_in", "clock_out"}
    updates: dict[str, Any] = {}
    for k, v in data.items():
        if k in allowed and v is not None:
            updates[k] = v

    if not updates:
        return None

    updates["updated_at"] = now
    updates["edited_by"] = edited_by

    resp = (
        supabase_client.table("time_entries")
        .update(updates)
        .eq("org_id", org_id)
        .eq("id", entry_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


# ---------------------------------------------------------------------------
# On-Duty Staff
# ---------------------------------------------------------------------------

def get_on_duty_staff(org_id: str, location_id: str) -> list[dict[str, Any]]:
    """List currently clocked-in staff for a location."""
    resp = (
        supabase_client.table("time_entries")
        .select("id, user_id, clock_in, role_during_shift, "
                "users!time_entries_user_id_fkey(first_name, last_name, display_name, avatar_url)")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .is_("clock_out", "null")
        .order("clock_in")
        .execute()
    )
    entries = resp.data or []
    result = []
    for e in entries:
        user_info = e.pop("users", {}) or {}
        result.append({
            "time_entry_id": e["id"],
            "user_id": e["user_id"],
            "clock_in": e["clock_in"],
            "role": e.get("role_during_shift"),
            "first_name": user_info.get("first_name"),
            "last_name": user_info.get("last_name"),
            "display_name": user_info.get("display_name"),
            "avatar_url": user_info.get("avatar_url"),
        })
    return result


# ---------------------------------------------------------------------------
# Tips
# ---------------------------------------------------------------------------

def get_tip_summary(
    org_id: str,
    location_id: str,
    shift_date: str,
) -> dict[str, Any]:
    """Get tip breakdown for a date/location.

    Returns per-server cash tips, credit tips, auto-gratuity, and totals.
    """
    # Get time entries for the date
    entries_resp = (
        supabase_client.table("time_entries")
        .select("user_id, cash_tips, credit_tips, tip_out_given, tip_out_received, "
                "regular_hours, overtime_hours, "
                "users!time_entries_user_id_fkey(first_name, last_name, display_name)")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("clock_in", f"{shift_date}T00:00:00Z")
        .lte("clock_in", f"{shift_date}T23:59:59Z")
        .execute()
    )
    entries = entries_resp.data or []

    # Get auto-gratuity from orders for that date/location
    orders_resp = (
        supabase_client.table("orders")
        .select("server_id, tip_total")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("opened_at", f"{shift_date}T00:00:00Z")
        .lte("opened_at", f"{shift_date}T23:59:59Z")
        .neq("status", "voided")
        .execute()
    )
    # Aggregate credit tips from payments
    order_tips_by_server: dict[str, float] = {}
    for o in (orders_resp.data or []):
        sid = o.get("server_id")
        if sid:
            order_tips_by_server[sid] = order_tips_by_server.get(sid, 0) + float(o.get("tip_total") or 0)

    servers: list[dict[str, Any]] = []
    total_cash = 0.0
    total_credit = 0.0
    total_auto_grat = 0.0
    total_all = 0.0

    for e in entries:
        user_info = e.get("users") or {}
        cash = float(e.get("cash_tips") or 0)
        credit = float(e.get("credit_tips") or 0)
        order_tips = order_tips_by_server.get(e["user_id"], 0)
        hours = float(e.get("regular_hours") or 0) + float(e.get("overtime_hours") or 0)
        server_total = cash + credit + order_tips

        servers.append({
            "user_id": e["user_id"],
            "display_name": user_info.get("display_name") or f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}",
            "cash_tips": round(cash, 2),
            "credit_tips": round(credit, 2),
            "auto_gratuity": round(order_tips, 2),
            "total_tips": round(server_total, 2),
            "hours_worked": round(hours, 2),
            "tip_out_given": float(e.get("tip_out_given") or 0),
            "tip_out_received": float(e.get("tip_out_received") or 0),
        })

        total_cash += cash
        total_credit += credit
        total_auto_grat += order_tips
        total_all += server_total

    return {
        "shift_date": shift_date,
        "location_id": location_id,
        "servers": servers,
        "totals": {
            "cash_tips": round(total_cash, 2),
            "credit_tips": round(total_credit, 2),
            "auto_gratuity": round(total_auto_grat, 2),
            "total": round(total_all, 2),
        },
    }


def distribute_tips(
    org_id: str,
    location_id: str,
    shift_date: str,
    method: str,
    pool_method: str | None = None,
) -> list[dict[str, Any]]:
    """Distribute tip pool for a shift date.

    Args:
        method: 'direct' (keep own tips) or 'pool' (redistribute).
        pool_method: If method='pool', one of 'hours_worked', 'equal', 'points'.

    Returns list of tip distribution records.
    """
    if method not in ("direct", "pool"):
        raise ValueError("method must be 'direct' or 'pool'")
    if method == "pool" and pool_method not in ("hours_worked", "equal", "points"):
        raise ValueError("pool_method must be 'hours_worked', 'equal', or 'points'")

    # Get all time entries for the shift date
    entries_resp = (
        supabase_client.table("time_entries")
        .select("id, user_id, cash_tips, credit_tips, regular_hours, overtime_hours, "
                "role_during_shift")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("clock_in", f"{shift_date}T00:00:00Z")
        .lte("clock_in", f"{shift_date}T23:59:59Z")
        .not_.is_("clock_out", "null")
        .execute()
    )
    entries = entries_resp.data or []
    if not entries:
        return []

    if method == "direct":
        # Each server keeps their own tips (no redistribution)
        distributions = []
        for e in entries:
            cash = float(e.get("cash_tips") or 0)
            credit = float(e.get("credit_tips") or 0)
            total = round(cash + credit, 2)
            distributions.append({
                "user_id": e["user_id"],
                "time_entry_id": e["id"],
                "cash_tips": round(cash, 2),
                "credit_tips": round(credit, 2),
                "pool_share": 0,
                "total_tips": total,
                "method": "direct",
            })
        return distributions

    # Pool method — collect all tips and redistribute
    total_pool = sum(
        float(e.get("cash_tips") or 0) + float(e.get("credit_tips") or 0)
        for e in entries
    )

    if total_pool <= 0:
        return []

    distributions: list[dict[str, Any]] = []

    if pool_method == "equal":
        share = round(total_pool / len(entries), 2)
        # Adjust last person to absorb rounding difference
        remainder = round(total_pool - (share * len(entries)), 2)
        for i, e in enumerate(entries):
            amount = share + (remainder if i == len(entries) - 1 else 0)
            distributions.append({
                "user_id": e["user_id"],
                "time_entry_id": e["id"],
                "pool_share": round(amount, 2),
                "total_tips": round(amount, 2),
                "method": "pool_equal",
            })

    elif pool_method == "hours_worked":
        total_hours = sum(
            float(e.get("regular_hours") or 0) + float(e.get("overtime_hours") or 0)
            for e in entries
        )
        if total_hours <= 0:
            # Fall back to equal if nobody has hours recorded
            return distribute_tips(org_id, location_id, shift_date, "pool", "equal")

        running_total = 0.0
        for i, e in enumerate(entries):
            hours = float(e.get("regular_hours") or 0) + float(e.get("overtime_hours") or 0)
            if i == len(entries) - 1:
                # Last person gets remainder to avoid rounding errors
                amount = round(total_pool - running_total, 2)
            else:
                amount = round(total_pool * (hours / total_hours), 2)
                running_total += amount

            distributions.append({
                "user_id": e["user_id"],
                "time_entry_id": e["id"],
                "hours_worked": round(hours, 2),
                "pool_share": amount,
                "total_tips": amount,
                "method": "pool_hours_worked",
            })

    elif pool_method == "points":
        # Point system: different roles get different point multipliers
        ROLE_POINTS = {
            "server": 1.0,
            "bartender": 1.0,
            "host": 0.5,
            "kitchen": 0.5,
            "cashier": 0.75,
            "manager": 0.5,
            "admin": 0.0,
            "owner": 0.0,
        }

        total_points = 0.0
        entry_points: list[float] = []
        for e in entries:
            role = e.get("role_during_shift", "server")
            hours = float(e.get("regular_hours") or 0) + float(e.get("overtime_hours") or 0)
            pts = hours * ROLE_POINTS.get(role, 0.5)
            entry_points.append(pts)
            total_points += pts

        if total_points <= 0:
            return distribute_tips(org_id, location_id, shift_date, "pool", "equal")

        running_total = 0.0
        for i, e in enumerate(entries):
            if i == len(entries) - 1:
                amount = round(total_pool - running_total, 2)
            else:
                amount = round(total_pool * (entry_points[i] / total_points), 2)
                running_total += amount

            distributions.append({
                "user_id": e["user_id"],
                "time_entry_id": e["id"],
                "points": round(entry_points[i], 2),
                "pool_share": amount,
                "total_tips": amount,
                "method": "pool_points",
            })

    # Update tip_out fields on time entries
    for dist in distributions:
        supabase_client.table("time_entries").update({
            "tip_out_received": dist["pool_share"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", dist["time_entry_id"]).execute()

    return distributions


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _calculate_overtime(
    user_id: str,
    work_date: date,
    hours_today: float,
) -> tuple[float, float]:
    """Calculate regular vs overtime hours.

    Overtime rules:
    - Daily: hours over 8 in a single day
    - Weekly: hours over 40 in a work week (Mon-Sun)

    Returns (regular_hours, overtime_hours).
    """
    DAILY_OT_THRESHOLD = 8.0
    WEEKLY_OT_THRESHOLD = 40.0

    # Calculate weekly hours so far (Mon-Sun week)
    # Find Monday of the current week
    days_since_monday = work_date.weekday()  # Monday=0
    week_start = work_date - timedelta(days=days_since_monday)
    week_start_str = week_start.isoformat()
    # Don't include today (we'll add hours_today separately)
    yesterday = work_date - timedelta(days=1)
    yesterday_str = yesterday.isoformat()

    weekly_hours_before_today = 0.0
    if days_since_monday > 0:
        week_resp = (
            supabase_client.table("time_entries")
            .select("regular_hours, overtime_hours")
            .eq("user_id", user_id)
            .gte("clock_in", f"{week_start_str}T00:00:00Z")
            .lte("clock_in", f"{yesterday_str}T23:59:59Z")
            .not_.is_("clock_out", "null")
            .execute()
        )
        for row in (week_resp.data or []):
            weekly_hours_before_today += float(row.get("regular_hours") or 0)
            weekly_hours_before_today += float(row.get("overtime_hours") or 0)

    # Daily overtime: anything over 8 hours today
    daily_regular = min(hours_today, DAILY_OT_THRESHOLD)
    daily_overtime = max(0, hours_today - DAILY_OT_THRESHOLD)

    # Weekly overtime: if adding today's regular hours pushes total over 40
    weekly_total_with_today = weekly_hours_before_today + daily_regular
    if weekly_total_with_today > WEEKLY_OT_THRESHOLD:
        # Some of the "regular" hours are actually weekly overtime
        weekly_ot_from_regular = weekly_total_with_today - WEEKLY_OT_THRESHOLD
        weekly_ot_from_regular = max(0, weekly_ot_from_regular)
        daily_regular -= weekly_ot_from_regular
        daily_overtime += weekly_ot_from_regular

    return round(max(0, daily_regular), 2), round(max(0, daily_overtime), 2)


def _get_user_permissions(user_id: str, role: str) -> list[str]:
    """Get effective permissions for a user: role defaults + overrides."""
    # Get role-level permissions
    role_perms_resp = (
        supabase_client.table("role_permissions")
        .select("permissions(code)")
        .eq("role", role)
        .execute()
    )
    permissions: set[str] = set()
    for row in (role_perms_resp.data or []):
        perm = row.get("permissions", {})
        if isinstance(perm, dict) and perm.get("code"):
            permissions.add(perm["code"])

    # Get user-level overrides
    override_resp = (
        supabase_client.table("user_permission_overrides")
        .select("granted, permissions(code)")
        .eq("user_id", user_id)
        .execute()
    )
    for row in (override_resp.data or []):
        perm = row.get("permissions", {})
        code = perm.get("code") if isinstance(perm, dict) else None
        if code:
            if row.get("granted"):
                permissions.add(code)
            else:
                permissions.discard(code)

    return sorted(permissions)


def _generate_temp_password() -> str:
    """Generate a temporary password for new staff accounts."""
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(16))
