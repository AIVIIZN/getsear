"""
Redis caching layer for Sear POS.

All serialization uses orjson (faster than stdlib json). Every cached value
is stored as bytes with an explicit TTL. Functions never raise on cache
miss — they return None so the caller falls through to the database.
"""

from __future__ import annotations

from typing import Any

import orjson
import structlog

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Generic cache operations
# ---------------------------------------------------------------------------

def cache_set(key: str, data: Any, ttl: int = 300) -> None:
    """Store data in Redis with a TTL (seconds)."""
    from app.extensions import redis_client

    try:
        payload = orjson.dumps(data)
        redis_client.setex(key, ttl, payload)
    except Exception:
        log.exception("cache_set_failed", key=key)


def cache_get(key: str) -> Any | None:
    """Fetch data from Redis. Returns None on miss or error."""
    from app.extensions import redis_client

    try:
        raw = redis_client.get(key)
        if raw is None:
            return None
        return orjson.loads(raw)
    except Exception:
        log.exception("cache_get_failed", key=key)
        return None


def cache_delete(key: str) -> None:
    """Delete a key from Redis."""
    from app.extensions import redis_client

    try:
        redis_client.delete(key)
    except Exception:
        log.exception("cache_delete_failed", key=key)


# ---------------------------------------------------------------------------
# Menu cache
# ---------------------------------------------------------------------------

def cache_menu(location_id: str, menu_data: dict[str, Any], ttl: int = 300) -> None:
    """Cache the full menu structure for a location."""
    cache_set(f"menu:{location_id}", menu_data, ttl)


def get_cached_menu(location_id: str) -> dict[str, Any] | None:
    """Retrieve cached menu for a location, or None."""
    return cache_get(f"menu:{location_id}")


def invalidate_menu(location_id: str) -> None:
    """Remove a location's menu from cache (call after menu edits)."""
    cache_delete(f"menu:{location_id}")


# ---------------------------------------------------------------------------
# Floor plan cache
# ---------------------------------------------------------------------------

def cache_floor_plan(location_id: str, data: dict[str, Any], ttl: int = 300) -> None:
    """Cache floor plan / table layout for a location."""
    cache_set(f"floorplan:{location_id}", data, ttl)


def get_cached_floor_plan(location_id: str) -> dict[str, Any] | None:
    """Retrieve cached floor plan, or None."""
    return cache_get(f"floorplan:{location_id}")


def invalidate_floor_plan(location_id: str) -> None:
    """Remove a location's floor plan from cache."""
    cache_delete(f"floorplan:{location_id}")


# ---------------------------------------------------------------------------
# Module list cache (per-org)
# ---------------------------------------------------------------------------

def cache_modules(org_id: str, modules_data: list[str], ttl: int = 600) -> None:
    """Cache the list of enabled module IDs for an organization."""
    cache_set(f"modules:{org_id}", modules_data, ttl)


def get_cached_modules(org_id: str) -> list[str] | None:
    """Retrieve cached module list for an org, or None."""
    return cache_get(f"modules:{org_id}")


def invalidate_modules(org_id: str) -> None:
    """Remove an org's module cache (call after module enable/disable)."""
    cache_delete(f"modules:{org_id}")
