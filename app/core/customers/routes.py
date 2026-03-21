"""Customer API blueprint — CRUD, lookup, merge, loyalty, order history."""

from __future__ import annotations

import structlog
from flask import Blueprint, g, request

from app.core.customers.services import (
    create_customer,
    delete_customer,
    get_customer,
    get_customer_loyalty,
    get_customer_orders,
    get_customers,
    lookup_customer,
    merge_customers,
    update_customer,
)
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_role
from app.shared.responses import api_error, api_paginated, api_success
from app.shared.validators import validate_uuid

log = structlog.get_logger(__name__)

customers_bp = Blueprint("customers", __name__, url_prefix="/api/v1/customers")


# ---------------------------------------------------------------------------
# List / Search
# ---------------------------------------------------------------------------


@customers_bp.route("/", methods=["GET"])
@require_auth
def list_customers():
    """Search/list customers. Filter by name, email, phone, tags."""
    org_id = g.current_user.org_id
    search = request.args.get("search", "").strip() or None
    tags_raw = request.args.get("tags", "").strip()
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else None
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    except (ValueError, TypeError):
        per_page = 50

    try:
        customers, total = get_customers(
            org_id=org_id,
            search=search,
            tags=tags,
            page=page,
            per_page=per_page,
        )
        return api_paginated(customers, total, page, per_page)
    except Exception as exc:
        log.exception("customers.list_failed")
        return api_error(f"Failed to list customers: {exc}", 500)


# ---------------------------------------------------------------------------
# Lookup (POS checkout)
# ---------------------------------------------------------------------------


@customers_bp.route("/lookup", methods=["POST"])
@require_auth
def lookup():
    """Quick lookup by phone or email for POS checkout."""
    org_id = g.current_user.org_id
    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "").strip() or None
    email = data.get("email", "").strip() or None

    if not phone and not email:
        return api_error("Provide phone or email for lookup", 400)

    try:
        result = lookup_customer(org_id, phone=phone, email=email)
        if not result:
            return api_success({"best_match": None, "all_matches": []})
        return api_success(result)
    except Exception as exc:
        log.exception("customers.lookup_failed")
        return api_error(f"Lookup failed: {exc}", 500)


# ---------------------------------------------------------------------------
# Get Single
# ---------------------------------------------------------------------------


@customers_bp.route("/<customer_id>", methods=["GET"])
@require_auth
def get_single_customer(customer_id: str):
    """Get customer with addresses, loyalty, and order summary."""
    valid, msg = validate_uuid(customer_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    try:
        customer = get_customer(org_id, customer_id)
        if not customer:
            return api_error("Customer not found", 404)
        return api_success(customer)
    except Exception as exc:
        log.exception("customers.get_failed", customer_id=customer_id)
        return api_error(f"Failed to get customer: {exc}", 500)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@customers_bp.route("/", methods=["POST"])
@require_auth
def create_customer_route():
    """Create a new customer."""
    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    try:
        customer = create_customer(org_id, data)
        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="customer.created",
            entity_type="customer",
            entity_id=customer.get("id", ""),
            description=f"Created customer {data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        )
        return api_success(customer, status=201)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("customers.create_failed")
        return api_error(f"Failed to create customer: {exc}", 500)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@customers_bp.route("/<customer_id>", methods=["PUT"])
@require_auth
def update_customer_route(customer_id: str):
    """Update customer fields."""
    valid, msg = validate_uuid(customer_id)
    if not valid:
        return api_error(msg, 400)

    data = request.get_json(silent=True) or {}
    org_id = g.current_user.org_id

    try:
        customer = update_customer(org_id, customer_id, data)
        if not customer:
            return api_error("Customer not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="customer.updated",
            entity_type="customer",
            entity_id=customer_id,
            description=f"Updated customer fields: {', '.join(data.keys())}",
        )
        return api_success(customer)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("customers.update_failed", customer_id=customer_id)
        return api_error(f"Failed to update customer: {exc}", 500)


# ---------------------------------------------------------------------------
# Soft Delete
# ---------------------------------------------------------------------------


@customers_bp.route("/<customer_id>", methods=["DELETE"])
@require_auth
@require_role("owner", "admin", "manager")
def delete_customer_route(customer_id: str):
    """Soft-delete a customer. Requires manager+."""
    valid, msg = validate_uuid(customer_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    try:
        success = delete_customer(org_id, customer_id)
        if not success:
            return api_error("Customer not found", 404)

        log_audit(
            org_id=org_id,
            user_id=g.current_user.user_id,
            user_name=g.current_user.display_name,
            user_role=g.current_user.role,
            action="customer.deleted",
            entity_type="customer",
            entity_id=customer_id,
            description=f"Soft-deleted customer {customer_id}",
        )
        return api_success(message="Customer deleted")
    except Exception as exc:
        log.exception("customers.delete_failed", customer_id=customer_id)
        return api_error(f"Failed to delete customer: {exc}", 500)


# ---------------------------------------------------------------------------
# Order History
# ---------------------------------------------------------------------------


@customers_bp.route("/<customer_id>/orders", methods=["GET"])
@require_auth
def customer_orders(customer_id: str):
    """Get paginated order history for a customer."""
    valid, msg = validate_uuid(customer_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))
    except (ValueError, TypeError):
        per_page = 25

    try:
        orders, total = get_customer_orders(org_id, customer_id, page, per_page)
        return api_paginated(orders, total, page, per_page)
    except Exception as exc:
        log.exception("customers.orders_failed", customer_id=customer_id)
        return api_error(f"Failed to get customer orders: {exc}", 500)


# ---------------------------------------------------------------------------
# Loyalty
# ---------------------------------------------------------------------------


@customers_bp.route("/<customer_id>/loyalty", methods=["GET"])
@require_auth
def customer_loyalty(customer_id: str):
    """Get loyalty account info for a customer."""
    valid, msg = validate_uuid(customer_id)
    if not valid:
        return api_error(msg, 400)

    org_id = g.current_user.org_id

    try:
        loyalty = get_customer_loyalty(org_id, customer_id)
        if not loyalty:
            return api_success({"enrolled": False, "account": None})
        return api_success({"enrolled": True, "account": loyalty})
    except Exception as exc:
        log.exception("customers.loyalty_failed", customer_id=customer_id)
        return api_error(f"Failed to get loyalty info: {exc}", 500)


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------


@customers_bp.route("/merge", methods=["POST"])
@require_auth
@require_role("owner", "admin", "manager")
def merge_customers_route():
    """Merge duplicate customer into primary. Requires manager+."""
    data = request.get_json(silent=True) or {}
    primary_id = data.get("primary_id", "").strip()
    duplicate_id = data.get("duplicate_id", "").strip()

    if not primary_id or not duplicate_id:
        return api_error("primary_id and duplicate_id are required", 400)

    for label, uid in [("primary_id", primary_id), ("duplicate_id", duplicate_id)]:
        valid, msg = validate_uuid(uid)
        if not valid:
            return api_error(f"Invalid {label}: {msg}", 400)

    org_id = g.current_user.org_id

    try:
        merged = merge_customers(
            org_id=org_id,
            primary_id=primary_id,
            duplicate_id=duplicate_id,
            merged_by_user_id=g.current_user.user_id,
            merged_by_name=g.current_user.display_name,
            merged_by_role=g.current_user.role,
        )
        return api_success(merged)
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception as exc:
        log.exception("customers.merge_failed")
        return api_error(f"Failed to merge customers: {exc}", 500)
