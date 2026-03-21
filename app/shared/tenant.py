"""
Tenant context for Sear POS.

Provides typed access to the current tenant (organization), location, and
user identity stored on Flask's request-scoped `g` object. Every API
request has its tenant context set by the @require_auth decorator.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from flask import g


@dataclass
class TenantContext:
    """Typed container for the current request's tenant state."""

    org_id: str
    location_ids: list[str] = field(default_factory=list)
    user_id: str = ""
    role: str = "staff"
    permissions: list[str] = field(default_factory=list)
    terminal_id: str | None = None
    display_name: str = ""


def get_current_org_id() -> str:
    """Return the org_id for the current request, or empty string."""
    user = getattr(g, "current_user", None)
    if user is not None:
        return user.org_id
    return getattr(g, "org_id", "")


def get_current_location_id() -> str:
    """Return the location_id for the current request, or empty string."""
    return getattr(g, "location_id", "")


def get_current_user() -> TenantContext | None:
    """
    Return the current user's TenantContext from g.current_user.

    Returns None if no authenticated user.
    """
    return getattr(g, "current_user", None)


def set_tenant_context(
    org_id: str,
    location_id: str,
    user: TenantContext | dict[str, Any],
) -> None:
    """
    Manually set tenant context on Flask g. Normally this is done by
    @require_auth, but this function is useful for background tasks,
    tests, and internal service-to-service calls.
    """
    if isinstance(user, dict):
        user = TenantContext(
            org_id=user.get("org_id", org_id),
            location_ids=user.get("location_ids", []),
            user_id=user.get("user_id", ""),
            role=user.get("role", "staff"),
            permissions=user.get("permissions", []),
            terminal_id=user.get("terminal_id"),
            display_name=user.get("display_name", ""),
        )
    g.org_id = org_id
    g.location_id = location_id
    g.current_user = user
    g.user_id = user.user_id
    g.user_display_name = user.display_name
    g.role = user.role


def build_tenant_context(user: TenantContext | dict[str, Any]) -> TenantContext:
    """
    Build a TenantContext dataclass from a user dict or return the
    existing TenantContext. Useful for passing tenant state to service
    functions without coupling them to Flask's g.
    """
    if isinstance(user, TenantContext):
        return user
    return TenantContext(
        org_id=user.get("org_id", ""),
        location_ids=user.get("location_ids", []),
        user_id=user.get("user_id", ""),
        role=user.get("role", "staff"),
        permissions=user.get("permissions", []),
        terminal_id=user.get("terminal_id"),
        display_name=user.get("display_name", ""),
    )
