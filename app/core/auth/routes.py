"""Auth API blueprint — login, PIN, refresh, logout, manager override, terminal registration."""

from __future__ import annotations

import re

import structlog
from flask import Blueprint, Response, g, request

from app.core.auth.services import (
    authenticate_email,
    authenticate_pin,
    generate_approval_token,
    generate_jwt,
    refresh_tokens,
    register_terminal,
    verify_manager_pin,
)
from app.extensions import limiter, supabase_client
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_role
from app.shared.responses import api_error, api_success

logger = structlog.get_logger()

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

PIN_PATTERN = re.compile(r"^\d{4,6}$")


# ---------------------------------------------------------------------------
# Public routes (no auth required)
# ---------------------------------------------------------------------------


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10/minute")
def login() -> Response:
    """Email + password login. Optionally sets terminal context."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    terminal_id = data.get("terminal_id")

    if not email or not password:
        return api_error("Email and password are required", 400)

    try:
        user, tokens = authenticate_email(email, password)
    except ValueError as exc:
        logger.warning("auth.login_failed", email=email, reason=str(exc))
        return api_error("Invalid email or password", 401)
    except Exception as exc:
        logger.error("auth.login_error", email=email, error=str(exc))
        return api_error("Authentication service unavailable", 503)

    access_token = generate_jwt(user, terminal_id=terminal_id)

    if terminal_id:
        try:
            supabase_client.table("terminals").update({
                "current_user_id": user["id"],
            }).eq("id", terminal_id).execute()
        except Exception as exc:
            logger.warning("auth.terminal_assign_failed", terminal_id=terminal_id, error=str(exc))

    log_audit(
        action="auth.login",
        entity_type="user",
        entity_id=user["id"],
        description=f"Email login from {request.remote_addr}",
        org_id=user["org_id"],
        user_id=user["id"],
    )

    return api_success({
        "access_token": access_token,
        "refresh_token": tokens["refresh_token"],
        "user": _safe_user(user),
    })


@auth_bp.route("/pin-login", methods=["POST"])
@limiter.limit(
    "10/minute",
    key_func=lambda: request.remote_addr,
)
def pin_login() -> Response:
    """Quick PIN login within a terminal context.

    Rate limited by IP address. After 5 failed PIN attempts for an org
    (tracked via Redis), PIN login is locked for that org for 5 minutes.
    """
    data = request.get_json(silent=True) or {}
    terminal_id = data.get("terminal_id", "").strip()
    pin = data.get("pin", "").strip()

    if not terminal_id or not pin:
        return api_error("terminal_id and pin are required", 400)

    if not PIN_PATTERN.match(pin):
        return api_error("PIN must be 4-6 digits", 400)

    try:
        terminal_resp = (
            supabase_client.table("terminals")
            .select("id, org_id, location_id, is_active")
            .eq("id", terminal_id)
            .single()
            .execute()
        )
    except Exception:
        return api_error("Terminal not found", 404)

    terminal = terminal_resp.data
    if not terminal or not terminal.get("is_active"):
        return api_error("Terminal not found or inactive", 404)

    org_id = terminal["org_id"]

    # Check if PIN login is locked for this org+IP
    lockout_key = f"pin_lockout:{request.remote_addr}:{org_id}"
    fail_key = f"pin_fails:{request.remote_addr}:{org_id}"
    try:
        from app.extensions import redis_client
        if redis_client.exists(lockout_key):
            ttl = redis_client.ttl(lockout_key)
            return api_error(
                f"PIN login locked due to too many failed attempts. Try again in {ttl} seconds.",
                429,
            )
    except Exception:
        pass  # If Redis is down, don't block login

    try:
        user = authenticate_pin(org_id, pin)
    except ValueError:
        logger.warning("auth.pin_failed", terminal_id=terminal_id, org_id=org_id, ip=request.remote_addr)
        log_audit(
            action="auth.pin_failed",
            entity_type="terminal",
            entity_id=terminal_id,
            description=f"Failed PIN attempt on terminal {terminal_id} from {request.remote_addr}",
            org_id=org_id,
        )

        # Increment failure counter and check for lockout
        try:
            from app.extensions import redis_client
            failures = redis_client.incr(fail_key)
            redis_client.expire(fail_key, 300)  # 5 minute window
            if failures >= 5:
                redis_client.setex(lockout_key, 300, "locked")
                redis_client.delete(fail_key)
                logger.warning("auth.pin_locked", org_id=org_id, ip=request.remote_addr)
                return api_error("Too many failed PIN attempts. PIN login locked for 5 minutes.", 429)
        except Exception:
            pass

        return api_error("Invalid PIN", 401)
    except Exception as exc:
        logger.error("auth.pin_error", terminal_id=terminal_id, error=str(exc))
        return api_error("Authentication service unavailable", 503)

    # Clear failure counter on success
    try:
        from app.extensions import redis_client
        redis_client.delete(fail_key)
    except Exception:
        pass

    access_token = generate_jwt(user, terminal_id=terminal_id, pin_login=True)

    try:
        supabase_client.table("terminals").update({
            "current_user_id": user["id"],
        }).eq("id", terminal_id).execute()
    except Exception as exc:
        logger.warning("auth.terminal_assign_failed", terminal_id=terminal_id, error=str(exc))

    log_audit(
        action="auth.pin_login",
        entity_type="user",
        entity_id=user["id"],
        description=f"PIN login on terminal {terminal_id}",
        org_id=org_id,
        user_id=user["id"],
    )

    return api_success({
        "access_token": access_token,
        "user": _safe_user(user),
    })


@auth_bp.route("/refresh", methods=["POST"])
@limiter.limit("20/minute")
def refresh() -> Response:
    """Refresh JWT using Supabase refresh token."""
    data = request.get_json(silent=True) or {}
    refresh_token = data.get("refresh_token", "").strip()

    if not refresh_token:
        return api_error("refresh_token is required", 400)

    try:
        tokens = refresh_tokens(refresh_token)
    except ValueError as exc:
        return api_error(str(exc), 401)
    except Exception as exc:
        logger.error("auth.refresh_error", error=str(exc))
        return api_error("Token refresh failed", 503)

    return api_success({
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_at": tokens["expires_at"],
    })


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3/minute")
def forgot_password() -> Response:
    """Send password reset email via Supabase Auth."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return api_error("Email is required", 400)

    try:
        supabase_client.auth.reset_password_email(email)
    except Exception as exc:
        logger.info("auth.forgot_password", email=email, error=str(exc))

    return api_success({"message": "If an account exists for that email, a reset link has been sent"})


@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("5/minute")
def reset_password() -> Response:
    """Process password reset with token from Supabase."""
    data = request.get_json(silent=True) or {}
    access_token = data.get("access_token", "").strip()
    new_password = data.get("new_password", "").strip()

    if not access_token or not new_password:
        return api_error("access_token and new_password are required", 400)

    if len(new_password) < 12:
        return api_error(
            "Password must be at least 12 characters and contain an uppercase letter, "
            "a lowercase letter, a digit, and a special character (!@#$%^&*…)",
            400,
        )

    if (
        not re.search(r"[A-Z]", new_password)
        or not re.search(r"[a-z]", new_password)
        or not re.search(r"\d", new_password)
        or not re.search(r"[^A-Za-z0-9]", new_password)
    ):
        return api_error(
            "Password must contain at least one uppercase letter, one lowercase letter, "
            "one digit, and one special character",
            400,
        )

    try:
        supabase_client.auth.update_user(
            access_token,
            {"password": new_password},
        )
    except Exception as exc:
        logger.warning("auth.reset_password_failed", error=str(exc))
        return api_error("Password reset failed -- token may be expired", 400)

    logger.info("auth.password_reset")
    return api_success({"message": "Password has been reset"})


# ---------------------------------------------------------------------------
# Authenticated routes
# ---------------------------------------------------------------------------


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout() -> Response:
    """Invalidate the current session and clear terminal user assignment."""
    terminal_id = getattr(g, "terminal_id", None)

    if terminal_id:
        try:
            supabase_client.table("terminals").update({
                "current_user_id": None,
            }).eq("id", terminal_id).execute()
        except Exception as exc:
            logger.warning("auth.terminal_clear_failed", terminal_id=terminal_id, error=str(exc))

    try:
        supabase_client.auth.sign_out()
    except Exception as exc:
        logger.warning("auth.supabase_signout_failed", error=str(exc))

    log_audit(
        action="auth.logout",
        entity_type="user",
        entity_id=g.current_user.user_id,
        description="User logged out",
        org_id=g.current_user.org_id,
        user_id=g.current_user.user_id,
    )

    return api_success({"message": "Logged out"})


@auth_bp.route("/me", methods=["GET"])
@require_auth
def me() -> Response:
    """Return current user profile, permissions, and assigned locations."""
    ctx = g.current_user

    try:
        user_resp = (
            supabase_client.table("users")
            .select("id, org_id, auth_id, email, display_name, role, is_active, created_at")
            .eq("id", ctx.user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        logger.error("auth.me_error", user_id=ctx.user_id, error=str(exc))
        return api_error("Failed to fetch user profile", 500)

    user = user_resp.data or {}
    user["permissions"] = ctx.permissions
    user["location_ids"] = ctx.location_ids

    return api_success({"user": user})


@auth_bp.route("/me", methods=["PUT"])
@require_auth
def update_me() -> Response:
    """Update current user profile (display_name, phone, avatar)."""
    ctx = g.current_user
    data = request.get_json(silent=True) or {}

    allowed = {"display_name", "phone", "avatar_url"}
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}

    if not updates:
        return api_error("No valid fields to update (allowed: display_name, phone, avatar_url)", 400)

    try:
        resp = (
            supabase_client.table("users")
            .update(updates)
            .eq("id", ctx.user_id)
            .execute()
        )
    except Exception as exc:
        logger.error("auth.update_me_error", user_id=ctx.user_id, error=str(exc))
        return api_error("Failed to update profile", 500)

    if not resp.data:
        return api_error("User not found", 404)

    log_audit(
        action="auth.profile_updated",
        entity_type="user",
        entity_id=ctx.user_id,
        description=f"Updated profile fields: {', '.join(updates.keys())}",
        org_id=ctx.org_id,
        user_id=ctx.user_id,
    )

    user = _safe_user(resp.data[0])
    return api_success({"user": user})


@auth_bp.route("/verify-manager-pin", methods=["POST"])
@require_auth
def verify_manager_pin_route() -> Response:
    """One-time manager PIN verification for sensitive actions."""
    data = request.get_json(silent=True) or {}
    pin = data.get("pin", "").strip()
    action = data.get("action", "").strip()

    if not pin or not action:
        return api_error("pin and action are required", 400)

    if not PIN_PATTERN.match(pin):
        return api_error("PIN must be 4-6 digits", 400)

    org_id = g.current_user.org_id

    try:
        manager = verify_manager_pin(org_id, pin)
    except ValueError:
        log_audit(
            action="auth.manager_pin_failed",
            entity_type="user",
            entity_id=g.current_user.user_id,
            description=f"Failed manager PIN verification for action: {action}",
            org_id=org_id,
            user_id=g.current_user.user_id,
        )
        return api_error("Invalid manager PIN", 401)
    except Exception as exc:
        logger.error("auth.manager_pin_error", error=str(exc))
        return api_error("Verification failed", 503)

    approval_token = generate_approval_token(manager["id"], action)

    log_audit(
        action="auth.manager_pin_verified",
        entity_type="user",
        entity_id=manager["id"],
        description=f"Manager {manager.get('display_name', manager['id'])} approved action: {action}",
        org_id=org_id,
        user_id=g.current_user.user_id,
        new_state={"manager_id": manager["id"], "action": action},
    )

    return api_success({
        "manager_id": manager["id"],
        "manager_name": manager.get("display_name", ""),
        "approval_token": approval_token,
        "expires_in": 60,
    })


@auth_bp.route("/register-terminal", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def register_terminal_route() -> Response:
    """Register a new terminal device for a location."""
    data = request.get_json(silent=True) or {}
    device_fingerprint = data.get("device_fingerprint", "").strip()
    registration_code = data.get("registration_code", "").strip()
    name = data.get("name", "").strip()
    location_id = data.get("location_id", "").strip()
    terminal_type = data.get("terminal_type", "server_station").strip()

    if not device_fingerprint or not registration_code or not name or not location_id:
        return api_error(
            "device_fingerprint, registration_code, name, and location_id are required", 400
        )

    org_id = g.current_user.org_id

    try:
        org_resp = (
            supabase_client.table("organizations")
            .select("id, terminal_registration_code")
            .eq("id", org_id)
            .single()
            .execute()
        )
        org = org_resp.data
        if not org or org.get("terminal_registration_code") != registration_code:
            return api_error("Invalid registration code", 403)
    except Exception as exc:
        logger.error("auth.register_terminal_org_check_failed", error=str(exc))
        return api_error("Failed to verify registration code", 500)

    try:
        loc_resp = (
            supabase_client.table("locations")
            .select("id")
            .eq("id", location_id)
            .eq("org_id", org_id)
            .single()
            .execute()
        )
        if not loc_resp.data:
            return api_error("Location not found in this organization", 404)
    except Exception as exc:
        logger.error("auth.register_terminal_loc_check_failed", error=str(exc))
        return api_error("Location not found in this organization", 404)

    try:
        dup_resp = (
            supabase_client.table("terminals")
            .select("id")
            .eq("device_fingerprint", device_fingerprint)
            .eq("org_id", org_id)
            .eq("is_active", True)
            .execute()
        )
        if dup_resp.data:
            return api_error(
                "A terminal with this device fingerprint is already registered", 409
            )
    except Exception as exc:
        logger.warning("auth.terminal_dup_check_failed", device_fingerprint=device_fingerprint, error=str(exc))

    try:
        terminal = register_terminal(
            org_id=org_id,
            location_id=location_id,
            device_fingerprint=device_fingerprint,
            name=name,
            terminal_type=terminal_type,
        )
    except Exception as exc:
        logger.error("auth.register_terminal_failed", error=str(exc))
        return api_error("Terminal registration failed", 500)

    log_audit(
        action="auth.terminal_registered",
        entity_type="terminal",
        entity_id=terminal["id"],
        description=f"Terminal '{name}' registered for location {location_id}",
        org_id=org_id,
        user_id=g.current_user.user_id,
        new_state={"terminal_id": terminal["id"], "terminal_type": terminal_type},
    )

    return api_success(
        {
            "terminal_id": terminal["id"],
            "terminal_token": terminal["token"],
            "name": name,
            "terminal_type": terminal_type,
        },
        201,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_user(user: dict) -> dict:
    """Strip sensitive fields before returning user to client."""
    exclude = {"pin_hash", "user_permission_overrides", "auth_id"}
    return {k: v for k, v in user.items() if k not in exclude}
