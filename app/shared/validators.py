"""
Input validation helpers for Sear POS.

Validates UUIDs, monetary amounts (integer cents), required fields,
and enum membership. Returns (is_valid, error_message) tuples so
callers can build structured error responses.
"""

from __future__ import annotations

import uuid
from typing import Any


def validate_uuid(value: Any) -> tuple[bool, str]:
    """
    Check that value is a valid UUID string.

    Returns:
        (True, "") on success, (False, error_message) on failure.
    """
    if value is None:
        return False, "Value is required"
    try:
        uuid.UUID(str(value))
        return True, ""
    except (ValueError, AttributeError):
        return False, f"Invalid UUID: {value}"


def validate_money(value: Any) -> tuple[bool, str]:
    """
    Validate a monetary amount stored as integer cents.

    Rules:
      - Must be an integer (no floats — floats cause rounding bugs with money)
      - Must be >= 0

    Returns:
        (True, "") on success, (False, error_message) on failure.
    """
    if value is None:
        return False, "Amount is required"
    if isinstance(value, float):
        return False, "Money must be integer cents, not float (e.g. 1299 for $12.99)"
    if not isinstance(value, int):
        return False, f"Money must be integer cents, got {type(value).__name__}"
    if value < 0:
        return False, "Amount cannot be negative"
    return True, ""


def validate_required(data: dict[str, Any], fields: list[str]) -> tuple[bool, list[str]]:
    """
    Check that all required fields are present and non-empty in the data dict.

    Returns:
        (True, []) if all fields present.
        (False, [list of missing field names]) if any are missing.
    """
    missing: list[str] = []
    for field in fields:
        val = data.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ""):
            missing.append(field)
    return (len(missing) == 0, missing)


def validate_enum(value: Any, enum_values: list[Any]) -> tuple[bool, str]:
    """
    Check that value is one of the allowed enum values.

    Returns:
        (True, "") on success, (False, error_message) on failure.
    """
    if value not in enum_values:
        return False, f"Invalid value '{value}'. Must be one of: {enum_values}"
    return True, ""
