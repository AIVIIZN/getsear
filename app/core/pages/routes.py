"""Page-serving blueprint -- returns HTML for each major section of Sear POS."""

from __future__ import annotations

import structlog
from flask import Blueprint, g, redirect, render_template, request, url_for

from app.shared.decorators import require_auth, require_module, require_role

logger = structlog.get_logger()

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def index() -> str:
    """Landing page -- redirect to /pos if authenticated, else show login."""
    if g.get("current_user"):
        return redirect(url_for("pages.pos"))
    return redirect(url_for("pages.login_page"))


@pages_bp.route("/login")
def login_page() -> str:
    """Render the login page."""
    if g.get("current_user"):
        return redirect(url_for("pages.pos"))
    return render_template("auth/login.html")


@pages_bp.route("/pin")
def pin_login() -> str:
    """Render the PIN login screen."""
    return render_template("auth/pin_login.html")


@pages_bp.route("/clock-in")
def clock_in() -> str:
    """Render the clock in/out screen."""
    return render_template("auth/clock_in.html")


@pages_bp.route("/pos")
@require_auth
def pos() -> str:
    """Render the POS terminal interface."""
    return render_template("pos/order_entry.html", active_page="orders")


@pages_bp.route("/tables")
@require_auth
def tables() -> str:
    """Render the table management screen."""
    return render_template("tables/floor_plan.html", active_page="tables")


@pages_bp.route("/checks")
@require_auth
def checks() -> str:
    """Render the open checks list."""
    return render_template("pos/checks.html", active_page="checks")


@pages_bp.route("/kds")
@require_auth
@require_module("kds")
def kds() -> str:
    """Render the Kitchen Display System."""
    return render_template("kds/display.html", active_page="kds")


@pages_bp.route("/reports")
@require_auth
@require_role("owner", "admin", "manager")
def reports() -> str:
    """Render the reports dashboard."""
    return render_template("reports/dashboard.html", active_page="reports")


@pages_bp.route("/reports/sales")
@require_auth
@require_role("owner", "admin", "manager")
def reports_sales() -> str:
    """Render the sales report."""
    return render_template("reports/sales.html", active_page="reports")


@pages_bp.route("/reports/labor")
@require_auth
@require_role("owner", "admin", "manager")
def reports_labor() -> str:
    """Render the labor report."""
    return render_template("reports/labor.html", active_page="reports")


@pages_bp.route("/reports/product-mix")
@require_auth
@require_role("owner", "admin", "manager")
def reports_product_mix() -> str:
    """Render the product mix report."""
    return render_template("reports/product_mix.html", active_page="reports")


@pages_bp.route("/reports/server-performance")
@require_auth
@require_role("owner", "admin", "manager")
def reports_server_performance() -> str:
    """Render the server performance report."""
    return render_template("reports/server_performance.html", active_page="reports")


@pages_bp.route("/reports/voids")
@require_auth
@require_role("owner", "admin", "manager")
def reports_voids() -> str:
    """Render the voids/comps/discounts report."""
    return render_template("reports/voids.html", active_page="reports")


@pages_bp.route("/reports/cash")
@require_auth
@require_role("owner", "admin", "manager")
def reports_cash() -> str:
    """Render the cash management report."""
    return render_template("reports/cash.html", active_page="reports")


@pages_bp.route("/reports/speed")
@require_auth
@require_role("owner", "admin", "manager")
def reports_speed() -> str:
    """Render the speed of service report."""
    return render_template("reports/speed.html", active_page="reports")


@pages_bp.route("/admin")
@require_auth
@require_role("owner", "admin", "manager")
def admin() -> str:
    """Render the back-office admin panel."""
    return render_template("pages/admin.html", active_page="admin")


@pages_bp.route("/admin/menu")
@require_auth
@require_role("owner", "admin", "manager")
def admin_menu() -> str:
    """Render the menu manager."""
    return render_template("backoffice/menu_manager.html", active_page="admin")


@pages_bp.route("/admin/staff")
@require_auth
@require_role("owner", "admin", "manager")
def admin_staff() -> str:
    """Render the staff manager."""
    return render_template("backoffice/staff_manager.html", active_page="admin")


@pages_bp.route("/admin/settings")
@require_auth
@require_role("owner", "admin", "manager")
def admin_settings() -> str:
    """Render the settings page."""
    return render_template("backoffice/settings.html", active_page="admin")


@pages_bp.route("/payment")
@require_auth
def payment() -> str:
    """Render the payment flow screen."""
    return render_template("pos/payment.html", active_page="orders")


@pages_bp.route("/pos/payment")
@require_auth
def pos_payment() -> str:
    """Render the payment flow screen (alternate route)."""
    return render_template("pos/payment.html", active_page="orders")


@pages_bp.route("/pos/cash-drawer")
@require_auth
def pos_cash_drawer() -> str:
    """Render the cash drawer count screen."""
    return render_template("pos/cash_drawer.html", active_page="orders")


@pages_bp.route("/customer-display")
def customer_display() -> str:
    """Render the customer-facing display."""
    return render_template("customer_display/display.html")


@pages_bp.route("/kiosk")
def kiosk() -> str:
    """Render the kiosk self-ordering screen."""
    return render_template("kiosk/order.html")
