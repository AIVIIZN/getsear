"""
Standardized JSON response helpers for Sear POS API.

All responses use orjson for fast serialization and follow a consistent
envelope format:
  { "ok": true/false, "data": ..., "message": ..., "errors": ... }
"""

from __future__ import annotations

from typing import Any

import orjson
from flask import Response


def _json_response(body: dict[str, Any], status: int = 200) -> Response:
    """Build a Flask Response with orjson-serialized body."""
    return Response(
        orjson.dumps(body),
        status=status,
        content_type="application/json",
    )


def api_success(
    data: Any = None,
    message: str | None = None,
    status: int = 200,
) -> Response:
    """
    Standard success response.

    {
        "ok": true,
        "data": <data>,
        "message": "..."   // optional
    }
    """
    body: dict[str, Any] = {"ok": True}
    if data is not None:
        body["data"] = data
    if message is not None:
        body["message"] = message
    return _json_response(body, status)


def api_error(
    message: str,
    status: int = 400,
    errors: list[dict[str, Any]] | None = None,
) -> Response:
    """
    Standard error response.

    {
        "ok": false,
        "message": "Something went wrong",
        "errors": [...]     // optional field-level errors
    }
    """
    body: dict[str, Any] = {"ok": False, "message": message}
    if errors is not None:
        body["errors"] = errors
    return _json_response(body, status)


def api_paginated(
    items: list[Any],
    total: int,
    page: int,
    per_page: int,
) -> Response:
    """
    Paginated list response.

    {
        "ok": true,
        "data": [...],
        "meta": {
            "total": 142,
            "page": 2,
            "per_page": 25,
            "total_pages": 6,
            "has_next": true,
            "has_prev": true
        }
    }
    """
    total_pages = max(1, (total + per_page - 1) // per_page)
    body: dict[str, Any] = {
        "ok": True,
        "data": items,
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }
    return _json_response(body)
