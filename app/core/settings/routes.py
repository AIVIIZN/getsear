"""Settings API blueprint — org, location, tax, terminals, printers, modules, roles."""

from __future__ import annotations

import structlog
from flask import Blueprint, g, request

from app.core.settings.services import (
    create_tax_rate,
    delete_tax_rate,
    disable_module,
    enable_module,
    get_all_permissions,
    get_location_settings,
    get_modules,
    get_org_settings,
    get_printers,
    get_roles,
    get_tax_rates,
    get_terminals,
    update_location_settings,
    update_module_config,
    update_org_settings,
    update_printer,
    update_tax_rate,
    update_terminal,
)
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_location, require_role
from app.shared.responses import api_error, api_success
from app.shared.validators import validate_required, validate_uuid

log = structlog.get_logger(__name__)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/v1/settings")


# ---------------------------------------------------------------------------
# Organization Settings
# ---------------------------------------------------------------------------


@settings_bp.route("/organization", methods=["GET"])
@require_auth
@require_role("owner", "admin", "manager")
def get_org():
    """Get organization settings."""
    org_id = g.current_user.org_id

    try:
        org = get_org_settings(org_id)
        if not org:
            return api_error("Organization not found", 404)
        return api_success(org)
    except Exception as exc:
        log.exception("settings.get_org_failed")
        return api_error(f"Failed to get organization settings: {exc}", 500)


@settings_bp.route("/organization", methods=["PUT"])
@require_auth
@require_role("owner")
def update_org():
    """Update organization settings. Requires owner."""
    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    try:
        org = update_org_settings(org_id, data)
        if not org:
            return api_error("Organization not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.org_updated",
            entity_type="organization",
            entity_id=org_id,
            description=f"Updated org settings: {', '.join(data.keys())}",
        )
        return api_success(org)
    except Exception as exc:
        log.exception("settings.update_org_failed")
        return api_error(f"Failed to update organization settings: {exc}", 500)


# ---------------------------------------------------------------------------
# Location Settings
# ---------------------------------------------------------------------------


@settings_bp.route("/location/<location_id>", methods=["GET"])
@require_auth
def get_location(location_id: str):
    """Get location settings."""
    valid, msg = validate_uuid(location_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    try:
        loc = get_location_settings(org_id, location_id)
        if not loc:
            return api_error("Location not found", 404)
        return api_success(loc)
    except Exception as exc:
        log.exception("settings.get_location_failed", location_id=location_id)
        return api_error(f"Failed to get location settings: {exc}", 500)


@settings_bp.route("/location/<location_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
def update_location(location_id: str):
    """Update location settings. Requires admin+."""
    valid, msg = validate_uuid(location_id)
    if not valid:
        return api_error(msg, 400)

    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    try:
        loc = update_location_settings(org_id, location_id, data)
        if not loc:
            return api_error("Location not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.location_updated",
            entity_type="location",
            entity_id=location_id,
            description=f"Updated location settings: {', '.join(data.keys())}",
        )
        return api_success(loc)
    except Exception as exc:
        log.exception("settings.update_location_failed", location_id=location_id)
        return api_error(f"Failed to update location settings: {exc}", 500)


# ---------------------------------------------------------------------------
# Tax Rates
# ---------------------------------------------------------------------------


@settings_bp.route("/tax-rates", methods=["GET"])
@require_auth
def list_tax_rates():
    """List tax rates for org/location."""
    org_id = g.current_user.org_id
    location_id = request.args.get("location_id")

    try:
        rates = get_tax_rates(org_id, location_id)
        return api_success(rates)
    except Exception as exc:
        log.exception("settings.list_tax_rates_failed")
        return api_error(f"Failed to list tax rates: {exc}", 500)


@settings_bp.route("/tax-rates", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def create_tax():
    """Create a new tax rate. Requires admin+."""
    data = request.get_json(silent=True) or {}
    ok, missing = validate_required(data, ["name", "rate"])
    if not ok:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    org_id = g.current_user.org_id

    try:
        rate = create_tax_rate(org_id, data)
        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.tax_rate_created",
            entity_type="tax_rate",
            entity_id=rate.get("id", ""),
            description=f"Created tax rate '{data.get('name')}' at {data.get('rate')}",
        )
        return api_success(rate, status=201)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("settings.create_tax_rate_failed")
        return api_error(f"Failed to create tax rate: {exc}", 500)


@settings_bp.route("/tax-rates/<rate_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
def update_tax(rate_id: str):
    """Update an existing tax rate. Requires admin+."""
    valid, msg = validate_uuid(rate_id)
    if not valid:
        return api_error(msg, 400)

    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    try:
        rate = update_tax_rate(org_id, rate_id, data)
        if not rate:
            return api_error("Tax rate not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.tax_rate_updated",
            entity_type="tax_rate",
            entity_id=rate_id,
            description=f"Updated tax rate: {', '.join(data.keys())}",
        )
        return api_success(rate)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("settings.update_tax_rate_failed", rate_id=rate_id)
        return api_error(f"Failed to update tax rate: {exc}", 500)


@settings_bp.route("/tax-rates/<rate_id>", methods=["DELETE"])
@require_auth
@require_role("owner", "admin")
def delete_tax(rate_id: str):
    """Delete (deactivate) a tax rate. Requires admin+."""
    valid, msg = validate_uuid(rate_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    try:
        success = delete_tax_rate(org_id, rate_id)
        if not success:
            return api_error("Tax rate not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.tax_rate_deleted",
            entity_type="tax_rate",
            entity_id=rate_id,
            description=f"Deleted tax rate {rate_id}",
        )
        return api_success(message="Tax rate deleted")
    except Exception as exc:
        log.exception("settings.delete_tax_rate_failed", rate_id=rate_id)
        return api_error(f"Failed to delete tax rate: {exc}", 500)


# ---------------------------------------------------------------------------
# Terminals
# ---------------------------------------------------------------------------


@settings_bp.route("/terminals", methods=["GET"])
@require_auth
@require_location
def list_terminals():
    """List terminals for a location."""
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        terminals = get_terminals(org_id, location_id)
        return api_success(terminals)
    except Exception as exc:
        log.exception("settings.list_terminals_failed")
        return api_error(f"Failed to list terminals: {exc}", 500)


@settings_bp.route("/terminals/<terminal_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
def update_term(terminal_id: str):
    """Update terminal configuration. Requires admin+."""
    valid, msg = validate_uuid(terminal_id)
    if not valid:
        return api_error(msg, 400)

    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    try:
        terminal = update_terminal(org_id, terminal_id, data)
        if not terminal:
            return api_error("Terminal not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.terminal_updated",
            entity_type="terminal",
            entity_id=terminal_id,
            description=f"Updated terminal: {', '.join(data.keys())}",
        )
        return api_success(terminal)
    except Exception as exc:
        log.exception("settings.update_terminal_failed", terminal_id=terminal_id)
        return api_error(f"Failed to update terminal: {exc}", 500)


# ---------------------------------------------------------------------------
# Printers
# ---------------------------------------------------------------------------


@settings_bp.route("/printers", methods=["GET"])
@require_auth
@require_location
def list_printers():
    """List configured printers for a location."""
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        printers = get_printers(org_id, location_id)
        return api_success(printers)
    except Exception as exc:
        log.exception("settings.list_printers_failed")
        return api_error(f"Failed to list printers: {exc}", 500)


@settings_bp.route("/printers/<printer_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
@require_location
def update_print(printer_id: str):
    """Update printer configuration. Requires admin+."""
    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        printer = update_printer(org_id, location_id, printer_id, data)
        if not printer:
            return api_error("Printer not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.printer_updated",
            entity_type="printer",
            entity_id=printer_id,
            description=f"Updated printer: {', '.join(data.keys())}",
        )
        return api_success(printer)
    except Exception as exc:
        log.exception("settings.update_printer_failed", printer_id=printer_id)
        return api_error(f"Failed to update printer: {exc}", 500)


# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------


@settings_bp.route("/modules", methods=["GET"])
@require_auth
@require_role("owner", "admin")
def list_modules():
    """List available/enabled modules for the org."""
    org_id = g.current_user.org_id

    try:
        modules = get_modules(org_id)
        return api_success(modules)
    except Exception as exc:
        log.exception("settings.list_modules_failed")
        return api_error(f"Failed to list modules: {exc}", 500)


@settings_bp.route("/modules/<module_id>/enable", methods=["POST"])
@require_auth
@require_role("owner")
def enable_mod(module_id: str):
    """Enable a module. Checks dependencies. Runs migrations. Requires owner."""
    org_id = g.current_user.org_id

    try:
        result = enable_module(org_id, module_id)
        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.module_enabled",
            entity_type="module",
            entity_id=module_id,
            description=f"Enabled module '{module_id}'",
        )
        return api_success(result)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("settings.enable_module_failed", module_id=module_id)
        return api_error(f"Failed to enable module: {exc}", 500)


@settings_bp.route("/modules/<module_id>/disable", methods=["POST"])
@require_auth
@require_role("owner")
def disable_mod(module_id: str):
    """Disable a module. Checks no dependents. Requires owner."""
    org_id = g.current_user.org_id

    try:
        result = disable_module(org_id, module_id)
        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.module_disabled",
            entity_type="module",
            entity_id=module_id,
            description=f"Disabled module '{module_id}'",
        )
        return api_success(result)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("settings.disable_module_failed", module_id=module_id)
        return api_error(f"Failed to disable module: {exc}", 500)


@settings_bp.route("/modules/<module_id>/config", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
def update_mod_config(module_id: str):
    """Update module configuration. Requires admin+."""
    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    if not data:
        return api_error("No configuration data provided", 400)

    try:
        result = update_module_config(org_id, module_id, data)
        if not result:
            return api_error("Module not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="settings.module_config_updated",
            entity_type="module",
            entity_id=module_id,
            description=f"Updated module config for '{module_id}'",
        )
        return api_success(result)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("settings.update_module_config_failed", module_id=module_id)
        return api_error(f"Failed to update module config: {exc}", 500)


# ---------------------------------------------------------------------------
# Roles & Permissions
# ---------------------------------------------------------------------------


@settings_bp.route("/roles", methods=["GET"])
@require_auth
@require_role("owner", "admin")
def list_roles():
    """List all roles with their permissions."""
    org_id = g.current_user.org_id

    try:
        roles = get_roles(org_id)
        return api_success(roles)
    except Exception as exc:
        log.exception("settings.list_roles_failed")
        return api_error(f"Failed to list roles: {exc}", 500)


@settings_bp.route("/permissions", methods=["GET"])
@require_auth
@require_role("owner", "admin")
def list_permissions():
    """List all permission codes."""
    try:
        perms = get_all_permissions()
        return api_success(perms)
    except Exception as exc:
        log.exception("settings.list_permissions_failed")
        return api_error(f"Failed to list permissions: {exc}", 500)
