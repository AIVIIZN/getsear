"""
Audit logging for Sear POS.

Every sensitive action (voids, comps, price changes, cash drawer opens,
role changes, failed logins, module toggles, report exports) is recorded
to the audit_log table with full context.
"""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable

import structlog
from flask import g, request

log = structlog.get_logger(__name__)


def log_audit(
    org_id: str = "",
    user_id: str = "",
    user_name: str = "",
    user_role: str = "",
    action: str = "",
    entity_type: str = "",
    entity_id: str = "",
    description: str = "",
    previous_state: dict[str, Any] | None = None,
    new_state: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    terminal_id: str | None = None,
) -> None:
    """
    Insert a row into the audit_log table via Supabase.

    This function never raises — audit failures are logged but don't
    break the calling operation.
    """
    from app.extensions import supabase_client

    row: dict[str, Any] = {
        "org_id": org_id,
        "user_id": user_id,
        "user_name": user_name,
        "user_role": user_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
    }

    if previous_state is not None:
        row["previous_state"] = previous_state
    if new_state is not None:
        row["new_state"] = new_state
    if ip_address is not None:
        row["ip_address"] = ip_address
    if user_agent is not None:
        row["user_agent"] = user_agent
    if terminal_id is not None:
        row["terminal_id"] = terminal_id

    try:
        supabase_client.table("audit_log").insert(row).execute()
        log.info(
            "audit_logged",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
        )
    except Exception:
        log.exception(
            "audit_log_failed",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
        )


def audit_decorator(action: str, entity_type: str) -> Callable:
    """
    Decorator that auto-logs an audit entry after a Flask route executes
    successfully.

    Pulls org_id, user_id, user_name, user_role from flask.g (set by
    @require_auth). Extracts ip_address and user_agent from the request.

    The entity_id is determined from:
      1. The route's keyword argument named "<entity_type>_id", or
      2. The first UUID-shaped path segment, or
      3. "unknown"

    Usage:
        @bp.route("/orders/<order_id>/void", methods=["POST"])
        @require_auth
        @audit_decorator("order.void", "order")
        def void_order(order_id):
            ...
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            response = f(*args, **kwargs)

            # Only audit on successful responses (2xx)
            status = getattr(response, "status_code", 200)
            if 200 <= status < 300:
                entity_id = (
                    kwargs.get(f"{entity_type}_id")
                    or kwargs.get("id")
                    or "unknown"
                )

                current_user = getattr(g, "current_user", None)
                log_audit(
                    org_id=getattr(current_user, "org_id", "") or getattr(g, "org_id", ""),
                    user_id=getattr(current_user, "user_id", "") or getattr(g, "user_id", ""),
                    user_name=getattr(current_user, "display_name", "") or getattr(g, "user_display_name", ""),
                    user_role=getattr(current_user, "role", "") or getattr(g, "role", ""),
                    action=action,
                    entity_type=entity_type,
                    entity_id=str(entity_id),
                    description=f"{action} on {entity_type} {entity_id}",
                    ip_address=request.remote_addr,
                    user_agent=request.user_agent.string,
                    terminal_id=getattr(g, "terminal_id", None),
                )

            return response

        return wrapper

    return decorator
