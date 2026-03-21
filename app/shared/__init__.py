"""
Sear POS — Shared utilities and module infrastructure.

Provides: module registry, event bus, audit logging, caching,
auth decorators, response helpers, validators, tenant context.
"""

from app.shared.module_registry import ModuleManifest, ModuleRegistry, registry
from app.shared.event_bus import EventBus, event_bus
from app.shared.audit import log_audit, audit_decorator
from app.shared.cache import (
    cache_menu, get_cached_menu, invalidate_menu,
    cache_floor_plan, get_cached_floor_plan, invalidate_floor_plan,
    cache_modules, get_cached_modules, invalidate_modules,
    cache_set, cache_get, cache_delete,
)
from app.shared.decorators import (
    require_auth, require_permission, require_role,
    require_module, require_manager_approval, require_location,
)
from app.shared.responses import api_success, api_error, api_paginated
from app.shared.validators import validate_uuid, validate_money, validate_required, validate_enum
from app.shared.tenant import (
    get_current_org_id, get_current_location_id, get_current_user,
    set_tenant_context, TenantContext,
)

__all__ = [
    # Module system
    "ModuleManifest", "ModuleRegistry", "registry",
    "EventBus", "event_bus",
    # Audit
    "log_audit", "audit_decorator",
    # Cache
    "cache_menu", "get_cached_menu", "invalidate_menu",
    "cache_floor_plan", "get_cached_floor_plan", "invalidate_floor_plan",
    "cache_modules", "get_cached_modules", "invalidate_modules",
    "cache_set", "cache_get", "cache_delete",
    # Decorators
    "require_auth", "require_permission", "require_role",
    "require_module", "require_manager_approval", "require_location",
    # Responses
    "api_success", "api_error", "api_paginated",
    # Validators
    "validate_uuid", "validate_money", "validate_required", "validate_enum",
    # Tenant
    "get_current_org_id", "get_current_location_id", "get_current_user",
    "set_tenant_context", "TenantContext",
]
