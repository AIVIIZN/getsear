"""Settings business logic — org, location, tax, terminals, printers, modules, roles."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.extensions import supabase_client
from app.shared.cache import cache_delete, invalidate_modules

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Organization Settings
# ---------------------------------------------------------------------------

def get_org_settings(org_id: str) -> dict[str, Any] | None:
    """Get organization settings (name, plan, branding, contact)."""
    resp = (
        supabase_client.table("organizations")
        .select("id, name, slug, plan, subscription_status, trial_ends_at, "
                "logo_url, primary_color, owner_name, owner_email, owner_phone, "
                "settings, created_at, updated_at")
        .eq("id", org_id)
        .single()
        .execute()
    )
    return resp.data


def update_org_settings(org_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Update organization settings. Returns updated org or None."""
    allowed = {
        "name", "logo_url", "primary_color", "owner_name", "owner_email",
        "owner_phone", "settings",
    }
    update_fields: dict[str, Any] = {}
    for key in allowed:
        if key in data:
            update_fields[key] = data[key]

    if not update_fields:
        return get_org_settings(org_id)

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase_client.table("organizations")
        .update(update_fields)
        .eq("id", org_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


# ---------------------------------------------------------------------------
# Location Settings
# ---------------------------------------------------------------------------

def get_location_settings(org_id: str, location_id: str) -> dict[str, Any] | None:
    """Get location settings (address, hours, timezone, etc.)."""
    resp = (
        supabase_client.table("locations")
        .select("id, org_id, name, slug, address_line1, address_line2, city, state, "
                "zip, country, latitude, longitude, phone, email, timezone, currency, "
                "business_hours, settings, is_active, created_at, updated_at")
        .eq("org_id", org_id)
        .eq("id", location_id)
        .single()
        .execute()
    )
    return resp.data


def update_location_settings(
    org_id: str,
    location_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    """Update location settings. Returns updated location or None."""
    allowed = {
        "name", "slug", "address_line1", "address_line2", "city", "state",
        "zip", "country", "latitude", "longitude", "phone", "email",
        "timezone", "currency", "business_hours", "settings", "is_active",
    }
    update_fields: dict[str, Any] = {}
    for key in allowed:
        if key in data:
            update_fields[key] = data[key]

    if not update_fields:
        return get_location_settings(org_id, location_id)

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase_client.table("locations")
        .update(update_fields)
        .eq("org_id", org_id)
        .eq("id", location_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


# ---------------------------------------------------------------------------
# Tax Rates
# ---------------------------------------------------------------------------

def get_tax_rates(
    org_id: str,
    location_id: str | None = None,
) -> list[dict[str, Any]]:
    """List tax rates for an org, optionally filtered by location."""
    query = (
        supabase_client.table("tax_rates")
        .select("*")
        .eq("org_id", org_id)
        .eq("is_active", True)
        .order("name")
    )

    if location_id:
        # Include org-wide (NULL location) and location-specific
        query = query.or_(f"location_id.is.null,location_id.eq.{location_id}")

    resp = query.execute()
    return resp.data or []


def create_tax_rate(org_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new tax rate.

    Raises ValueError on validation errors.
    """
    name = data.get("name", "").strip()
    rate = data.get("rate")

    if not name:
        raise ValueError("name is required")
    if rate is None:
        raise ValueError("rate is required")

    try:
        rate_val = float(rate)
    except (TypeError, ValueError):
        raise ValueError("rate must be a number")

    if rate_val < 0 or rate_val > 1:
        raise ValueError("rate must be between 0 and 1 (e.g., 0.0825 for 8.25%)")

    row = {
        "org_id": org_id,
        "location_id": data.get("location_id"),
        "name": name,
        "rate": rate_val,
        "is_inclusive": data.get("is_inclusive", False),
        "is_default": data.get("is_default", False),
        "applies_to": data.get("applies_to", []),
        "is_active": True,
    }

    resp = supabase_client.table("tax_rates").insert(row).execute()
    return resp.data[0] if resp.data else row


def update_tax_rate(
    org_id: str,
    rate_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    """Update an existing tax rate. Returns updated rate or None."""
    allowed = {"name", "rate", "is_inclusive", "is_default", "applies_to", "location_id", "is_active"}
    update_fields: dict[str, Any] = {}
    for key in allowed:
        if key in data:
            update_fields[key] = data[key]

    if "rate" in update_fields:
        try:
            rate_val = float(update_fields["rate"])
        except (TypeError, ValueError):
            raise ValueError("rate must be a number")
        if rate_val < 0 or rate_val > 1:
            raise ValueError("rate must be between 0 and 1")
        update_fields["rate"] = rate_val

    if not update_fields:
        return None

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase_client.table("tax_rates")
        .update(update_fields)
        .eq("org_id", org_id)
        .eq("id", rate_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def delete_tax_rate(org_id: str, rate_id: str) -> bool:
    """Soft-delete a tax rate by setting is_active=False."""
    resp = (
        supabase_client.table("tax_rates")
        .update({
            "is_active": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("org_id", org_id)
        .eq("id", rate_id)
        .execute()
    )
    return bool(resp.data)


# ---------------------------------------------------------------------------
# Terminals
# ---------------------------------------------------------------------------

def get_terminals(org_id: str, location_id: str) -> list[dict[str, Any]]:
    """List terminals for a location."""
    resp = (
        supabase_client.table("terminals")
        .select("id, org_id, location_id, name, terminal_type, device_id, "
                "is_online, last_heartbeat_at, current_user_id, settings, "
                "is_active, created_at, updated_at")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    return resp.data or []


def update_terminal(
    org_id: str,
    terminal_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    """Update terminal configuration."""
    allowed = {"name", "terminal_type", "settings", "is_active"}
    update_fields: dict[str, Any] = {}
    for key in allowed:
        if key in data:
            update_fields[key] = data[key]

    if not update_fields:
        return None

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase_client.table("terminals")
        .update(update_fields)
        .eq("org_id", org_id)
        .eq("id", terminal_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


# ---------------------------------------------------------------------------
# Printers
# ---------------------------------------------------------------------------

def get_printers(org_id: str, location_id: str) -> list[dict[str, Any]]:
    """List configured printers for a location.

    Printers are stored in the location settings JSON under 'printers' key,
    or in a dedicated printers table if one exists.
    """
    # Printers are stored in location settings
    loc = get_location_settings(org_id, location_id)
    if not loc:
        return []

    settings = loc.get("settings") or {}
    printers = settings.get("printers") or []

    # Ensure each printer has an ID for reference
    for i, p in enumerate(printers):
        if "id" not in p:
            p["id"] = f"printer_{i}"

    return printers


def update_printer(
    org_id: str,
    location_id: str,
    printer_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    """Update a printer configuration within the location settings."""
    loc = get_location_settings(org_id, location_id)
    if not loc:
        return None

    settings = loc.get("settings") or {}
    printers = settings.get("printers") or []

    updated_printer = None
    for p in printers:
        if p.get("id") == printer_id:
            # Merge new data into existing printer config
            allowed = {"name", "ip_address", "port", "type", "is_default",
                       "print_kitchen", "print_bar", "print_receipts", "width"}
            for key in allowed:
                if key in data:
                    p[key] = data[key]
            updated_printer = p
            break

    if not updated_printer:
        return None

    settings["printers"] = printers
    update_location_settings(org_id, location_id, {"settings": settings})
    return updated_printer


# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------

def get_modules(org_id: str) -> list[dict[str, Any]]:
    """List all available and enabled modules for an org."""
    from app.shared.module_registry import registry

    all_manifests = registry.get_all_modules()

    # Get enabled modules from DB
    resp = (
        supabase_client.table("org_modules")
        .select("module_id, is_enabled, config, location_ids, enabled_at, disabled_at")
        .eq("org_id", org_id)
        .execute()
    )
    enabled_map: dict[str, dict] = {}
    for row in (resp.data or []):
        enabled_map[row["module_id"]] = row

    result = []
    for mid, manifest in all_manifests.items():
        enabled_info = enabled_map.get(mid)
        result.append({
            "id": manifest.id,
            "name": manifest.name,
            "version": manifest.version,
            "description": manifest.description,
            "dependencies": manifest.dependencies,
            "is_enabled": enabled_info["is_enabled"] if enabled_info else False,
            "config": enabled_info.get("config", {}) if enabled_info else {},
            "enabled_at": enabled_info.get("enabled_at") if enabled_info else None,
        })

    return result


def enable_module(org_id: str, module_id: str) -> dict[str, Any]:
    """Enable a module for an org. Checks dependencies. Runs migrations.

    Raises ValueError if dependencies are not met.
    """
    from app.shared.module_registry import registry

    manifest = registry.get_module_manifest(module_id)
    if not manifest:
        raise ValueError(f"Module '{module_id}' not found")

    # Check dependencies
    for dep in manifest.dependencies:
        if dep.startswith("core."):
            continue  # Core modules always available
        if not registry.is_module_enabled(org_id, dep):
            raise ValueError(
                f"Module '{module_id}' requires '{dep}' to be enabled first"
            )

    now = datetime.now(timezone.utc).isoformat()

    # Upsert into org_modules
    existing = (
        supabase_client.table("org_modules")
        .select("id")
        .eq("org_id", org_id)
        .eq("module_id", module_id)
        .limit(1)
        .execute()
    )

    if existing.data:
        resp = (
            supabase_client.table("org_modules")
            .update({
                "is_enabled": True,
                "enabled_at": now,
                "disabled_at": None,
                "updated_at": now,
            })
            .eq("org_id", org_id)
            .eq("module_id", module_id)
            .execute()
        )
    else:
        resp = (
            supabase_client.table("org_modules")
            .insert({
                "org_id": org_id,
                "module_id": module_id,
                "is_enabled": True,
                "enabled_at": now,
                "config": {},
            })
            .execute()
        )

    # Run module migrations if defined
    if manifest.migration_path:
        _run_module_migrations(org_id, manifest)

    # Invalidate module cache
    invalidate_modules(org_id)

    return {
        "module_id": module_id,
        "name": manifest.name,
        "is_enabled": True,
        "enabled_at": now,
    }


def disable_module(org_id: str, module_id: str) -> dict[str, Any]:
    """Disable a module. Checks no other enabled modules depend on it.

    Raises ValueError if other modules depend on this one.
    """
    from app.shared.module_registry import registry

    manifest = registry.get_module_manifest(module_id)
    if not manifest:
        raise ValueError(f"Module '{module_id}' not found")

    # Check if any enabled module depends on this one
    enabled_resp = (
        supabase_client.table("org_modules")
        .select("module_id")
        .eq("org_id", org_id)
        .eq("is_enabled", True)
        .neq("module_id", module_id)
        .execute()
    )
    for row in (enabled_resp.data or []):
        dep_manifest = registry.get_module_manifest(row["module_id"])
        if dep_manifest and module_id in dep_manifest.dependencies:
            raise ValueError(
                f"Cannot disable '{module_id}': module '{row['module_id']}' depends on it"
            )

    now = datetime.now(timezone.utc).isoformat()
    supabase_client.table("org_modules").update({
        "is_enabled": False,
        "disabled_at": now,
        "updated_at": now,
    }).eq("org_id", org_id).eq("module_id", module_id).execute()

    # Invalidate module cache
    invalidate_modules(org_id)

    return {
        "module_id": module_id,
        "name": manifest.name,
        "is_enabled": False,
        "disabled_at": now,
    }


def update_module_config(
    org_id: str,
    module_id: str,
    config: dict[str, Any],
) -> dict[str, Any] | None:
    """Update a module's configuration for an org."""
    from app.shared.module_registry import registry

    manifest = registry.get_module_manifest(module_id)
    if not manifest:
        raise ValueError(f"Module '{module_id}' not found")

    # Merge with existing config
    existing = (
        supabase_client.table("org_modules")
        .select("config")
        .eq("org_id", org_id)
        .eq("module_id", module_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise ValueError(f"Module '{module_id}' is not registered for this organization")

    merged_config = {**(existing.data.get("config") or {}), **config}

    resp = (
        supabase_client.table("org_modules")
        .update({
            "config": merged_config,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("org_id", org_id)
        .eq("module_id", module_id)
        .execute()
    )

    if resp.data:
        return {
            "module_id": module_id,
            "name": manifest.name,
            "config": merged_config,
        }
    return None


# ---------------------------------------------------------------------------
# Roles & Permissions
# ---------------------------------------------------------------------------

def get_roles(org_id: str) -> list[dict[str, Any]]:
    """List all roles with their default permissions."""
    roles = [
        "owner", "admin", "manager", "server", "bartender",
        "host", "kitchen", "cashier", "kiosk", "readonly",
    ]

    result = []
    for role in roles:
        perms_resp = (
            supabase_client.table("role_permissions")
            .select("permissions(id, code, description, category)")
            .eq("role", role)
            .execute()
        )
        permissions = []
        for row in (perms_resp.data or []):
            perm = row.get("permissions")
            if isinstance(perm, dict):
                permissions.append(perm)

        result.append({
            "role": role,
            "permissions": permissions,
            "permission_count": len(permissions),
        })

    return result


def get_all_permissions() -> list[dict[str, Any]]:
    """List all permission codes grouped by category."""
    resp = (
        supabase_client.table("permissions")
        .select("id, code, module_id, description, category")
        .order("category")
        .order("code")
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _run_module_migrations(org_id: str, manifest: Any) -> None:
    """Run SQL migrations for a module if a migration_path is defined.

    Migrations are applied via Supabase. Each migration file is idempotent.
    """
    from pathlib import Path

    if not manifest.migration_path:
        return

    migration_dir = Path(manifest.migration_path)
    if not migration_dir.is_dir():
        log.warning(
            "module_migration_dir_missing",
            module_id=manifest.id,
            path=str(migration_dir),
        )
        return

    migration_files = sorted(migration_dir.glob("*.sql"))
    for mf in migration_files:
        sql = mf.read_text()
        try:
            supabase_client.rpc("exec_sql", {"query": sql}).execute()
            log.info(
                "module_migration_applied",
                module_id=manifest.id,
                file=mf.name,
            )
        except Exception:
            log.exception(
                "module_migration_failed",
                module_id=manifest.id,
                file=mf.name,
            )
