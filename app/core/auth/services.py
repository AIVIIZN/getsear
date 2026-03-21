"""Auth business logic — JWT generation, PIN auth, terminal registration."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import structlog
from flask import current_app

from app.extensions import supabase_client

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Password / email auth via Supabase
# ---------------------------------------------------------------------------

def authenticate_email(email: str, password: str) -> tuple[dict, dict]:
    """Authenticate via Supabase Auth, return (user_record, tokens).

    Raises ValueError on bad credentials.
    Raises RuntimeError on unexpected Supabase errors.
    """
    try:
        auth_resp = supabase_client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception as exc:
        logger.warning("auth.email_failed", email=email, error=str(exc))
        raise ValueError("Invalid email or password") from exc

    supabase_user = auth_resp.user
    if supabase_user is None:
        raise ValueError("Invalid email or password")

    # Fetch the app-level user record (has org_id, role, permissions, etc.)
    # users.id matches the Supabase Auth user ID directly
    user_row = (
        supabase_client.table("users")
        .select("*, user_permission_overrides(*)")
        .eq("id", str(supabase_user.id))
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not user_row.data:
        raise ValueError("User account is inactive or not found")

    user = user_row.data
    user["permissions"] = get_user_permissions(user["id"], user["role"])
    user["location_ids"] = _fetch_user_location_ids(user["id"])

    tokens = {
        "access_token": auth_resp.session.access_token,
        "refresh_token": auth_resp.session.refresh_token,
        "expires_at": auth_resp.session.expires_at,
    }

    logger.info("auth.email_success", user_id=user["id"], email=email)
    return user, tokens


# ---------------------------------------------------------------------------
# PIN auth (quick login within terminal context)
# ---------------------------------------------------------------------------

def authenticate_pin(org_id: str, pin: str) -> dict:
    """Look up active user by org + PIN hash, return user record.

    Raises ValueError if PIN doesn't match any active user.
    """
    rows = (
        supabase_client.table("users")
        .select("*, user_permission_overrides(*)")
        .eq("org_id", org_id)
        .eq("is_active", True)
        .not_.is_("pin_hash", "null")
        .execute()
    )
    if not rows.data:
        raise ValueError("Invalid PIN")

    for user in rows.data:
        if verify_pin(pin, user["pin_hash"]):
            user["permissions"] = get_user_permissions(user["id"], user["role"])
            user["location_ids"] = _fetch_user_location_ids(user["id"])
            logger.info("auth.pin_success", user_id=user["id"], org_id=org_id)
            return user

    raise ValueError("Invalid PIN")


# ---------------------------------------------------------------------------
# JWT generation & verification
# ---------------------------------------------------------------------------

def generate_jwt(user: dict, terminal_id: str | None = None, pin_login: bool = False) -> str:
    """Create JWT with custom claims for the given user.

    Email logins get 8-hour expiry; PIN logins get 12 hours.
    """
    expiry_hours = 12 if pin_login else current_app.config.get("JWT_EXPIRY_HOURS", 8)
    now = datetime.now(timezone.utc)
    claims = build_custom_claims(user)
    claims.update({
        "iat": now,
        "exp": now + timedelta(hours=expiry_hours),
        "jti": str(uuid.uuid4()),
    })
    if terminal_id:
        claims["terminal_id"] = terminal_id

    secret = current_app.config["JWT_SECRET_KEY"]
    token: str = jwt.encode(claims, secret, algorithm="HS256")
    return token


def verify_jwt(token: str) -> dict:
    """Decode and validate a JWT, returning the claims dict.

    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    secret = current_app.config["JWT_SECRET_KEY"]
    claims: dict = jwt.decode(token, secret, algorithms=["HS256"])
    return claims


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

def refresh_tokens(refresh_token: str) -> dict:
    """Use Supabase Auth to refresh session tokens.

    Returns dict with access_token, refresh_token, expires_at.
    Raises ValueError on failure.
    """
    try:
        resp = supabase_client.auth.refresh_session(refresh_token)
    except Exception as exc:
        logger.warning("auth.refresh_failed", error=str(exc))
        raise ValueError("Unable to refresh token") from exc

    if resp.session is None:
        raise ValueError("Unable to refresh token")

    return {
        "access_token": resp.session.access_token,
        "refresh_token": resp.session.refresh_token,
        "expires_at": resp.session.expires_at,
    }


# ---------------------------------------------------------------------------
# Manager PIN verification
# ---------------------------------------------------------------------------

MANAGER_ROLES = {"owner", "admin", "manager"}


def verify_manager_pin(org_id: str, pin: str) -> dict:
    """Verify a PIN belongs to a user with a manager-level role.

    Returns the manager's user record.
    Raises ValueError if no match.
    """
    rows = (
        supabase_client.table("users")
        .select("id, org_id, display_name, role, pin_hash")
        .eq("org_id", org_id)
        .eq("is_active", True)
        .in_("role", list(MANAGER_ROLES))
        .not_.is_("pin_hash", "null")
        .execute()
    )
    if not rows.data:
        raise ValueError("Invalid manager PIN")

    for user in rows.data:
        if verify_pin(pin, user["pin_hash"]):
            logger.info("auth.manager_pin_verified", manager_id=user["id"], org_id=org_id)
            return user

    raise ValueError("Invalid manager PIN")


# ---------------------------------------------------------------------------
# Approval tokens (short-lived, for manager overrides)
# ---------------------------------------------------------------------------

def generate_approval_token(manager_id: str, action: str) -> str:
    """Create a 60-second signed token authorizing a single sensitive action."""
    now = datetime.now(timezone.utc)
    payload = {
        "type": "manager_approval",
        "manager_id": manager_id,
        "action": action,
        "iat": now,
        "exp": now + timedelta(seconds=60),
        "jti": str(uuid.uuid4()),
    }
    secret = current_app.config["JWT_SECRET_KEY"]
    token: str = jwt.encode(payload, secret, algorithm="HS256")
    return token


def verify_approval_token(token: str) -> tuple[str, str]:
    """Validate an approval token. Returns (manager_id, action).

    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    secret = current_app.config["JWT_SECRET_KEY"]
    claims: dict = jwt.decode(token, secret, algorithms=["HS256"])
    if claims.get("type") != "manager_approval":
        raise jwt.InvalidTokenError("Not an approval token")
    return claims["manager_id"], claims["action"]


# ---------------------------------------------------------------------------
# Terminal registration
# ---------------------------------------------------------------------------

def register_terminal(
    org_id: str,
    location_id: str,
    device_id: str,
    name: str,
    terminal_type: str = "server_station",
) -> dict:
    """Register a new terminal device and return the record."""
    terminal_id = str(uuid.uuid4())

    row = (
        supabase_client.table("terminals")
        .insert({
            "id": terminal_id,
            "org_id": org_id,
            "location_id": location_id,
            "device_id": device_id,
            "name": name,
            "terminal_type": terminal_type,
            "is_active": True,
        })
        .execute()
    )
    terminal = row.data[0] if row.data else {"id": terminal_id}

    logger.info(
        "auth.terminal_registered",
        terminal_id=terminal_id,
        org_id=org_id,
        location_id=location_id,
    )
    return terminal


# ---------------------------------------------------------------------------
# PIN hashing
# ---------------------------------------------------------------------------

def hash_pin(pin: str) -> str:
    """Bcrypt-hash a PIN string."""
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify a plaintext PIN against its bcrypt hash."""
    try:
        return bcrypt.checkpw(pin.encode(), pin_hash.encode())
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

def get_user_permissions(user_id: str, role: str) -> list[str]:
    """Fetch the effective permission list for a user.

    Combines role-level defaults with any user-specific overrides.
    """
    # Role defaults from role_permissions table (join to get permission code)
    role_resp = (
        supabase_client.table("role_permissions")
        .select("permission_id, permissions(code)")
        .eq("role", role)
        .execute()
    )
    base_perms: set[str] = set()
    for r in (role_resp.data or []):
        perm = r.get("permissions")
        if perm and perm.get("code"):
            base_perms.add(perm["code"])

    # Per-user overrides (grants and revocations, join to get permission code)
    override_resp = (
        supabase_client.table("user_permission_overrides")
        .select("permission_id, granted, permissions(code)")
        .eq("user_id", user_id)
        .execute()
    )
    for row in override_resp.data or []:
        perm = row.get("permissions")
        if perm and perm.get("code"):
            if row["granted"]:
                base_perms.add(perm["code"])
            else:
                base_perms.discard(perm["code"])

    return sorted(base_perms)


# ---------------------------------------------------------------------------
# Custom JWT claims builder
# ---------------------------------------------------------------------------

def build_custom_claims(user: dict) -> dict:
    """Build the JWT custom claims payload from a user record."""
    return {
        "sub": user["id"],
        "org_id": user["org_id"],
        "role": user["role"],
        "permissions": user.get("permissions", []),
        "location_ids": user.get("location_ids", []),
        "display_name": user.get("display_name", ""),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch_user_location_ids(user_id: str) -> list[str]:
    """Return location IDs a user is assigned to (stored as uuid[] on users)."""
    resp = (
        supabase_client.table("users")
        .select("location_ids")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if resp.data:
        return resp.data.get("location_ids") or []
    return []
