"""Auth middleware — JWT extraction into g.current_user + security headers."""

from __future__ import annotations

import structlog
from flask import Flask, Response, current_app, g, request

from app.core.auth.services import verify_jwt
from app.shared.tenant import TenantContext

logger = structlog.get_logger()

# Routes that don't require a valid Authorization header
PUBLIC_PREFIXES: tuple[str, ...] = (
    "/api/v1/auth/login",
    "/api/v1/auth/pin-login",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/refresh",
    "/static/",
    "/favicon.ico",
    "/health",
)

PUBLIC_PAGE_PREFIXES: tuple[str, ...] = (
    "/login",
    "/",
)


def inject_tenant_context() -> None:
    """Before-request hook: decode JWT and populate g.current_user.

    Skips public routes. Silently sets g.current_user = None when no
    Authorization header is present (page routes handle auth via decorators).
    """
    g.current_user = None

    path = request.path

    # Skip public API routes
    for prefix in PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return

    # Try Authorization header first, then sear_token cookie as fallback
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    elif not path.startswith("/api/"):
        # For page routes, check cookie as fallback (browser navigation)
        token = request.cookies.get("sear_token")

    if not token:
        # No token found -- let @require_auth on each route handle it
        return
    try:
        claims = verify_jwt(token)
        g.current_user = TenantContext(
            user_id=claims["sub"],
            org_id=claims["org_id"],
            role=claims["role"],
            permissions=claims.get("permissions", []),
            location_ids=claims.get("location_ids", []),
            terminal_id=claims.get("terminal_id"),
            display_name=claims.get("display_name", ""),
        )
        # Also set convenience attributes on g for backward compat
        g.user_id = claims["sub"]
        g.org_id = claims["org_id"]
        g.role = claims["role"]
        g.permissions = claims.get("permissions", [])
        g.terminal_id = claims.get("terminal_id")
    except Exception as exc:
        logger.debug("auth.middleware.jwt_invalid", error=str(exc), path=path)
        # Don't abort here — let @require_auth on each route handle it
        return


def inject_security_headers(response: Response) -> Response:
    """After-request hook: add security headers to every response."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # CSP — allow CDNs for htmx/Alpine/fonts, Supabase realtime, Valor iframe
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net 'unsafe-inline'; "
        "frame-src https://*.valorpaytech.com; "
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.valorpaytech.com; "
        "img-src 'self' https://*.supabase.co data:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com;"
    )

    return response


def register_auth_middleware(app: Flask) -> None:
    """Register before_request and after_request hooks on the app."""
    app.before_request(inject_tenant_context)
    app.after_request(inject_security_headers)
