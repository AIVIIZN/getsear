"""
Request decorators for Sear POS API routes.

Handles JWT auth, permission checks, role checks, module gating,
manager approval (PIN), and location validation.
"""

from __future__ import annotations

import bcrypt
from functools import wraps
from typing import Any, Callable

import structlog
from flask import g, redirect, request

from app.shared.responses import api_error
from app.shared.tenant import TenantContext

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# @require_auth — JWT verification, sets g.current_user
# ---------------------------------------------------------------------------

def require_auth(f: Callable) -> Callable:
    """
    Verify the Authorization: Bearer <jwt> header by decoding the JWT locally.
    If the middleware already set g.current_user, reuse it.
    On success, populate g.current_user with org_id, user_id, role,
    permissions, location_ids, and display_name.
    """

    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        # If middleware already decoded the JWT, reuse it
        if getattr(g, "current_user", None) is not None:
            return f(*args, **kwargs)

        is_api_route = request.path.startswith("/api/")

        # Try Authorization header first, then sear_token cookie as fallback
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            token = request.cookies.get("sear_token")

        if not token:
            if not is_api_route:
                return redirect("/login")
            return api_error("Missing or invalid Authorization header", status=401)

        try:
            from app.core.auth.services import verify_jwt

            claims = verify_jwt(token)

            g.current_user = TenantContext(
                org_id=claims["org_id"],
                location_ids=claims.get("location_ids", []),
                user_id=claims["sub"],
                role=claims.get("role", "staff"),
                permissions=claims.get("permissions", []),
                terminal_id=claims.get("terminal_id"),
                display_name=claims.get("display_name", ""),
            )
            g.org_id = claims["org_id"]
            g.user_id = claims["sub"]
            g.user_display_name = claims.get("display_name", "")
            g.role = claims.get("role", "staff")

        except Exception:
            log.exception("auth_verification_failed")
            if not is_api_route:
                return redirect("/login")
            return api_error("Authentication failed", status=401)

        return f(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# @require_permission — granular permission gate
# ---------------------------------------------------------------------------

def require_permission(permission_code: str) -> Callable:
    """
    Check that g.current_user has the given permission code.
    Owners bypass all permission checks.
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user = getattr(g, "current_user", None)
            if user is None:
                return api_error("Authentication required", status=401)

            # Owners bypass permission checks
            if user.role == "owner":
                return f(*args, **kwargs)

            permissions: list[str] = user.permissions or []
            if permission_code not in permissions:
                log.warning(
                    "permission_denied",
                    user_id=user.user_id,
                    required=permission_code,
                )
                return api_error(
                    f"Permission '{permission_code}' required",
                    status=403,
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# @require_role — role-level gate
# ---------------------------------------------------------------------------

def require_role(*roles: str) -> Callable:
    """
    Check that g.current_user.role is one of the allowed roles.
    Example: @require_role("owner", "admin", "manager")
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user = getattr(g, "current_user", None)
            if user is None:
                return api_error("Authentication required", status=401)

            user_role = user.role
            if user_role not in roles:
                log.warning(
                    "role_denied",
                    user_id=user.user_id,
                    user_role=user_role,
                    required_roles=roles,
                )
                return api_error(
                    f"One of roles {list(roles)} required",
                    status=403,
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# @require_module — tenant module gate
# ---------------------------------------------------------------------------

def require_module(module_id: str) -> Callable:
    """
    Check that the module is enabled for the current tenant (org_id).
    Uses cache first, then Supabase. Returns 403 JSON if not enabled.
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user = getattr(g, "current_user", None)
            if user is None:
                return api_error("Authentication required", status=401)

            org_id = user.org_id
            from app.shared.module_registry import registry

            if not registry.is_module_enabled(org_id, module_id):
                log.info(
                    "module_not_enabled",
                    org_id=org_id,
                    module_id=module_id,
                )
                return api_error(
                    f"Module '{module_id}' is not enabled for your organization",
                    status=403,
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# @require_manager_approval — PIN verification
# ---------------------------------------------------------------------------

def require_manager_approval(f: Callable) -> Callable:
    """
    Verify the X-Manager-PIN header against the users table.
    The PIN must belong to a user with role manager, admin, or owner
    within the same org. Logs which manager approved the action.
    """

    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        user = getattr(g, "current_user", None)
        if user is None:
            return api_error("Authentication required", status=401)

        pin = request.headers.get("X-Manager-PIN", "").strip()
        if not pin:
            return api_error("Manager PIN required (X-Manager-PIN header)", status=403)

        org_id = user.org_id

        try:
            from app.extensions import supabase_client

            resp = (
                supabase_client.table("users")
                .select("id, display_name, role, pin_hash")
                .eq("org_id", org_id)
                .in_("role", ["manager", "admin", "owner"])
                .eq("is_active", True)
                .not_.is_("pin_hash", "null")
                .execute()
            )

            manager = None
            for candidate in (resp.data or []):
                try:
                    if bcrypt.checkpw(pin.encode(), candidate["pin_hash"].encode()):
                        manager = candidate
                        break
                except Exception:
                    continue

            if not manager:
                log.warning(
                    "manager_pin_invalid",
                    org_id=org_id,
                    requesting_user=user.user_id,
                )
                return api_error("Invalid manager PIN", status=403)
            g.approving_manager = {
                "user_id": manager["id"],
                "display_name": manager["display_name"],
                "role": manager["role"],
            }
            log.info(
                "manager_approval_granted",
                manager_id=manager["id"],
                manager_name=manager["display_name"],
                requesting_user=user.user_id,
            )

        except Exception:
            log.exception("manager_pin_verification_failed")
            return api_error("Manager PIN verification failed", status=500)

        return f(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# @require_location — location validation
# ---------------------------------------------------------------------------

def require_location(f: Callable) -> Callable:
    """
    Extract location_id from:
      1. Route kwargs (path parameter)
      2. X-Location-ID header
      3. Query parameter ?location_id=

    Validate the user has access to that location (location_id is in
    their location_ids list, or they are an owner/admin with org-wide access).
    Sets g.location_id.
    """

    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        user = getattr(g, "current_user", None)
        if user is None:
            return api_error("Authentication required", status=401)

        # Extract location_id from multiple sources
        location_id = (
            kwargs.get("location_id")
            or request.headers.get("X-Location-ID", "").strip()
            or request.args.get("location_id", "").strip()
        )

        if not location_id:
            return api_error("location_id is required", status=400)

        # Owners and admins can access any location in their org
        role = user.role
        user_locations: list[str] = user.location_ids or []

        if role not in ("owner", "admin") and location_id not in user_locations:
            log.warning(
                "location_access_denied",
                user_id=user.user_id,
                location_id=location_id,
                user_locations=user_locations,
            )
            return api_error("You do not have access to this location", status=403)

        g.location_id = location_id
        return f(*args, **kwargs)

    return wrapper
