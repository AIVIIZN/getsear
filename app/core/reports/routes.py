"""Reports API blueprint — sales, product mix, labor, payments, tax, exports."""

from __future__ import annotations

from datetime import date

import structlog
from flask import Blueprint, Response, g, request

from app.core.reports.services import (
    export_report,
    get_category_mix,
    get_custom_report,
    get_daily_report,
    get_discount_report,
    get_hourly_report,
    get_labor_report,
    get_monthly_report,
    get_payment_report,
    get_product_mix,
    get_server_performance,
    get_tax_report,
    get_weekly_report,
)
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_location, require_role
from app.shared.responses import api_error, api_success

log = structlog.get_logger(__name__)

reports_bp = Blueprint("reports", __name__, url_prefix="/api/v1/reports")


# ---------------------------------------------------------------------------
# Sales Reports
# ---------------------------------------------------------------------------


@reports_bp.route("/sales/daily", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def daily():
    """Daily sales summary. Defaults to today."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    report_date = request.args.get("date")

    try:
        result = get_daily_report(org_id, location_id, report_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.daily_failed")
        return api_error(f"Failed to generate daily report: {exc}", 500)


@reports_bp.route("/sales/weekly", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def weekly():
    """Weekly sales summary."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    week_start = request.args.get("week_start")

    try:
        result = get_weekly_report(org_id, location_id, week_start)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.weekly_failed")
        return api_error(f"Failed to generate weekly report: {exc}", 500)


@reports_bp.route("/sales/monthly", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def monthly():
    """Monthly sales summary."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)

    try:
        result = get_monthly_report(org_id, location_id, year, month)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.monthly_failed")
        return api_error(f"Failed to generate monthly report: {exc}", 500)


@reports_bp.route("/sales/custom", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def custom():
    """Custom date range sales report."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return api_error("start_date and end_date are required", 400)

    try:
        result = get_custom_report(org_id, location_id, start_date, end_date)
        return api_success(result)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("reports.custom_failed")
        return api_error(f"Failed to generate custom report: {exc}", 500)


@reports_bp.route("/sales/hourly", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def hourly():
    """Hourly sales breakdown (heatmap data)."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    report_date = request.args.get("date")

    try:
        result = get_hourly_report(org_id, location_id, report_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.hourly_failed")
        return api_error(f"Failed to generate hourly report: {exc}", 500)


# ---------------------------------------------------------------------------
# Mix Reports
# ---------------------------------------------------------------------------


@reports_bp.route("/product-mix", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def product_mix():
    """Product mix report with menu engineering matrix classification."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_product_mix(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.product_mix_failed")
        return api_error(f"Failed to generate product mix report: {exc}", 500)


@reports_bp.route("/category-mix", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def category_mix():
    """Sales breakdown by category."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_category_mix(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.category_mix_failed")
        return api_error(f"Failed to generate category mix report: {exc}", 500)


# ---------------------------------------------------------------------------
# Performance Reports
# ---------------------------------------------------------------------------


@reports_bp.route("/server-performance", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def server_perf():
    """Per-server performance report."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_server_performance(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.server_performance_failed")
        return api_error(f"Failed to generate server performance report: {exc}", 500)


@reports_bp.route("/labor", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def labor():
    """Labor cost report."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_labor_report(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.labor_failed")
        return api_error(f"Failed to generate labor report: {exc}", 500)


# ---------------------------------------------------------------------------
# Financial Reports
# ---------------------------------------------------------------------------


@reports_bp.route("/discount-summary", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def discounts():
    """Discount, comp, and void summary."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_discount_report(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.discounts_failed")
        return api_error(f"Failed to generate discount report: {exc}", 500)


@reports_bp.route("/payment-summary", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def payments():
    """Payment method breakdown."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_payment_report(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.payments_failed")
        return api_error(f"Failed to generate payment report: {exc}", 500)


@reports_bp.route("/tax-report", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def tax():
    """Tax collected breakdown."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date:
        start_date = date.today().isoformat()

    try:
        result = get_tax_report(org_id, location_id, start_date, end_date)
        return api_success(result)
    except Exception as exc:
        log.exception("reports.tax_failed")
        return api_error(f"Failed to generate tax report: {exc}", 500)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


@reports_bp.route("/export", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
@require_location
def export():
    """Export any report as CSV."""
    data = request.get_json(silent=True) or {}
    report_type = data.get("report_type")
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    if not report_type:
        return api_error("report_type is required", 400)
    if not start_date:
        start_date = date.today().isoformat()

    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        csv_str, filename = export_report(
            org_id, location_id, report_type, start_date, end_date,
            extra_params=data,
        )

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="reports.exported",
            entity_type="report",
            entity_id=report_type,
            description=f"Exported {report_type} report for {start_date}",
        )

        return Response(
            csv_str,
            mimetype="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
            },
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("reports.export_failed", report_type=report_type)
        return api_error(f"Failed to export report: {exc}", 500)
