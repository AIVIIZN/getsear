"""Reconciliation API routes for Sear POS.

Handles end-of-day close, daily reports, and deposit matching.
"""

from __future__ import annotations

from datetime import date, datetime

import structlog
from flask import Blueprint, g, request

from app.core.pos.reconciliation import ReconciliationEngine
from app.shared.decorators import require_auth, require_location, require_role
from app.shared.responses import api_error, api_success
from app.shared.validators import validate_money

log = structlog.get_logger(__name__)

reconciliation_bp = Blueprint("reconciliation", __name__, url_prefix="/api/v1/reconciliation")

_engine = ReconciliationEngine()


# ---------------------------------------------------------------------------
# Close Business Day
# ---------------------------------------------------------------------------


@reconciliation_bp.route("/close-day", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def close_business_day():
    """Close the business day for a location. Requires manager+.

    Takes: business_date, cash_drawer_counted_cents (optional), notes (optional).
    Generates full reconciliation, saves it, triggers async tasks.
    """
    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id
    location_id = g.location_id

    # Parse business_date
    date_str = data.get("business_date", "").strip()
    if not date_str:
        return api_error("business_date is required (YYYY-MM-DD)", 400)
    try:
        business_date = date.fromisoformat(date_str)
    except ValueError:
        return api_error(f"Invalid date format: {date_str}. Use YYYY-MM-DD.", 400)

    # Don't allow closing future dates
    if business_date > date.today():
        return api_error("Cannot close a future business date", 400)

    # Cash drawer count (optional, in cents)
    cash_counted = data.get("cash_drawer_counted_cents")
    if cash_counted is not None:
        valid, msg = validate_money(cash_counted)
        if not valid:
            return api_error(f"cash_drawer_counted_cents: {msg}", 400)

    notes = (data.get("notes") or "").strip() or None

    try:
        result = _engine.close_business_day(
            org_id=org_id,
            location_id=location_id,
            business_date=business_date,
            manager_id=g.current_user.user_id,
            manager_name=g.current_user.display_name,
            manager_role=g.current_user.role,
            cash_drawer_counted_cents=cash_counted,
            notes=notes,
        )
        return api_success(result, status=201)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception(
            "reconciliation.close_day_failed",
            location_id=location_id,
            business_date=date_str,
        )
        return api_error(f"Failed to close business day: {exc}", 500)


# ---------------------------------------------------------------------------
# Get Daily Reconciliation
# ---------------------------------------------------------------------------


@reconciliation_bp.route("/daily/<date_str>", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def get_daily_reconciliation(date_str: str):
    """Get the daily reconciliation report for a date and location.

    If the day hasn't been formally closed yet, generates a live preview.
    """
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        business_date = date.fromisoformat(date_str)
    except ValueError:
        return api_error(f"Invalid date format: {date_str}. Use YYYY-MM-DD.", 400)

    try:
        from app.extensions import supabase_client

        # Check for saved reconciliation
        existing_resp = (
            supabase_client.table("daily_reconciliations")
            .select("*")
            .eq("org_id", org_id)
            .eq("location_id", location_id)
            .eq("business_date", business_date.isoformat())
            .limit(1)
            .execute()
        )

        if existing_resp.data:
            result = existing_resp.data[0]
            result["is_closed"] = result.get("closed_at") is not None
            return api_success(result)

        # No saved record: generate a live preview
        recon = _engine.generate_daily_reconciliation(org_id, location_id, business_date)
        preview = recon.to_dict()
        preview["is_closed"] = False
        preview["closed_by"] = None
        preview["closed_at"] = None
        return api_success(preview)

    except Exception as exc:
        log.exception(
            "reconciliation.get_daily_failed",
            location_id=location_id,
            business_date=date_str,
        )
        return api_error(f"Failed to get reconciliation: {exc}", 500)


# ---------------------------------------------------------------------------
# Match Deposit
# ---------------------------------------------------------------------------


@reconciliation_bp.route("/match-deposit", methods=["POST"])
@require_auth
@require_role("owner", "admin")
@require_location
def match_deposit():
    """Match a bank deposit to a processor batch.

    Takes: batch_id, deposit_amount_cents.
    Returns matching analysis with variance breakdown.
    """
    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    batch_id = (data.get("batch_id") or "").strip()
    if not batch_id:
        return api_error("batch_id is required", 400)

    deposit_amount_cents = data.get("deposit_amount_cents")
    if deposit_amount_cents is None:
        return api_error("deposit_amount_cents is required", 400)

    valid, msg = validate_money(deposit_amount_cents)
    if not valid:
        return api_error(f"deposit_amount_cents: {msg}", 400)

    try:
        result = _engine.reconcile_processor_deposit(
            org_id=org_id,
            batch_id=batch_id,
            deposit_amount_cents=deposit_amount_cents,
        )
        return api_success(result)
    except Exception as exc:
        log.exception("reconciliation.match_deposit_failed", batch_id=batch_id)
        return api_error(f"Failed to match deposit: {exc}", 500)
