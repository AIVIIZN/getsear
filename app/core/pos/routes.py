"""POS order entry API routes for Sear POS.

Blueprint: pos_bp mounted at /api/v1/orders
All routes require authentication and location context.
"""

from __future__ import annotations

import structlog
from flask import Blueprint, g, request

from app.core.pos.services import (
    add_items,
    apply_discount,
    comp_item,
    comp_order,
    create_order,
    fire_course,
    get_modifications,
    get_order,
    get_order_by_table,
    get_orders,
    merge_orders,
    move_order_to_table,
    remove_discount,
    reopen_order,
    send_order,
    split_order,
    transfer_order,
    update_order,
    update_order_item,
    void_item,
    void_order,
)
from app.shared.decorators import (
    require_auth,
    require_location,
    require_manager_approval,
    require_permission,
)
from app.shared.responses import api_error, api_paginated, api_success

log = structlog.get_logger(__name__)

pos_bp = Blueprint("pos", __name__)


# ---------------------------------------------------------------------------
# Order CRUD
# ---------------------------------------------------------------------------


@pos_bp.route("", methods=["POST"])
@require_auth
@require_location
def create_order_route():
    """Create a new order in draft status."""
    data = request.get_json(silent=True) or {}

    order_type = data.get("order_type", "dine_in")
    if order_type not in (
        "dine_in", "takeout", "delivery", "bar", "catering", "online", "kiosk",
    ):
        return api_error(f"Invalid order_type: {order_type}", 400)

    try:
        order = create_order(
            org_id=g.org_id,
            location_id=g.location_id,
            server_id=g.user_id,
            data={**data, "terminal_id": getattr(g.current_user, "terminal_id", None)},
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.create_failed")
        return api_error("Failed to create order", 500)

    return api_success(order, status=201)


@pos_bp.route("", methods=["GET"])
@require_auth
@require_location
def list_orders_route():
    """List open orders for a location with optional filters."""
    filters: dict = {}

    status_param = request.args.get("status")
    if status_param:
        # Support comma-separated statuses: ?status=draft,open
        filters["status"] = status_param.split(",") if "," in status_param else status_param

    if request.args.get("order_type"):
        filters["order_type"] = request.args["order_type"]
    if request.args.get("server_id"):
        filters["server_id"] = request.args["server_id"]
    if request.args.get("table_id"):
        filters["table_id"] = request.args["table_id"]
    if request.args.get("opened_after"):
        filters["opened_after"] = request.args["opened_after"]
    if request.args.get("opened_before"):
        filters["opened_before"] = request.args["opened_before"]

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 200)

    try:
        orders, total = get_orders(
            org_id=g.org_id,
            location_id=g.location_id,
            filters=filters,
            page=page,
            per_page=per_page,
        )
    except Exception:
        log.exception("order.list_failed")
        return api_error("Failed to list orders", 500)

    return api_paginated(orders, total, page, per_page)


@pos_bp.route("/<order_id>", methods=["GET"])
@require_auth
def get_order_route(order_id: str):
    """Get full order detail with items, modifiers, and modification history."""
    try:
        order = get_order(org_id=g.org_id, order_id=order_id)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception:
        log.exception("order.get_failed", order_id=order_id)
        return api_error("Failed to fetch order", 500)

    return api_success(order)


@pos_bp.route("/by-table/<table_id>", methods=["GET"])
@require_auth
def get_order_by_table_route(table_id: str):
    """Get the active order for a table."""
    try:
        order = get_order_by_table(org_id=g.org_id, table_id=table_id)
    except Exception:
        log.exception("order.get_by_table_failed", table_id=table_id)
        return api_error("Failed to fetch order by table", 500)

    if order is None:
        return api_error("No active order for this table", 404)

    return api_success(order)


# ---------------------------------------------------------------------------
# Item Management
# ---------------------------------------------------------------------------


@pos_bp.route("/<order_id>/items", methods=["POST"])
@require_auth
def add_items_route(order_id: str):
    """Add item(s) to an order. Expects JSON array of items."""
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])

    if not items:
        return api_error("items array is required and cannot be empty", 400)

    try:
        order = add_items(
            org_id=g.org_id,
            order_id=order_id,
            items_data=items,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.add_items_failed", order_id=order_id)
        return api_error("Failed to add items", 500)

    return api_success(order)


# ---------------------------------------------------------------------------
# Order Actions
# ---------------------------------------------------------------------------


@pos_bp.route("/<order_id>/send", methods=["POST"])
@require_auth
def send_order_route(order_id: str):
    """Send unsent items to kitchen. Transitions draft->open."""
    try:
        order = send_order(
            org_id=g.org_id,
            order_id=order_id,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.send_failed", order_id=order_id)
        return api_error("Failed to send order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/fire-course", methods=["POST"])
@require_auth
def fire_course_route(order_id: str):
    """Fire a specific course number."""
    data = request.get_json(silent=True) or {}
    course_number = data.get("course_number")

    if course_number is None:
        return api_error("course_number is required", 400)

    try:
        course_number = int(course_number)
    except (TypeError, ValueError):
        return api_error("course_number must be an integer", 400)

    try:
        order = fire_course(
            org_id=g.org_id,
            order_id=order_id,
            course_number=course_number,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.fire_course_failed", order_id=order_id)
        return api_error("Failed to fire course", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/void-item", methods=["POST"])
@require_auth
@require_permission("orders.void")
def void_item_route(order_id: str):
    """Void a single item. Manager approval required if item was already sent.

    If the item was already sent to the kitchen, the X-Manager-PIN header
    must be provided. The decorator @require_manager_approval is not used
    here because approval is conditionally required (only for sent items).
    Instead, the manager_id is passed from g.approving_manager when
    the PIN header is present.
    """
    data = request.get_json(silent=True) or {}
    item_id = data.get("item_id", "").strip()
    reason = data.get("reason", "").strip()

    if not item_id:
        return api_error("item_id is required", 400)
    if not reason:
        return api_error("reason is required", 400)

    # Check for manager approval (optional header -- service layer validates if needed)
    approved_by = None
    manager = getattr(g, "approving_manager", None)
    if manager:
        approved_by = manager["user_id"]
    else:
        # Try extracting from X-Manager-PIN if provided
        pin = request.headers.get("X-Manager-PIN", "").strip()
        if pin:
            approved_by = _verify_manager_pin_inline(pin)

    try:
        order = void_item(
            org_id=g.org_id,
            order_id=order_id,
            item_id=item_id,
            reason=reason,
            user_id=g.user_id,
            approved_by=approved_by,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.void_item_failed", order_id=order_id, item_id=item_id)
        return api_error("Failed to void item", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/comp-item", methods=["POST"])
@require_auth
@require_permission("orders.comp")
@require_manager_approval
def comp_item_route(order_id: str):
    """Comp a single item. Always requires manager approval."""
    data = request.get_json(silent=True) or {}
    item_id = data.get("item_id", "").strip()
    reason = data.get("reason", "").strip()
    comp_amount = data.get("comp_amount")  # None = full comp

    if not item_id:
        return api_error("item_id is required", 400)
    if not reason:
        return api_error("reason is required", 400)

    if comp_amount is not None:
        try:
            comp_amount = float(comp_amount)
        except (TypeError, ValueError):
            return api_error("comp_amount must be a number", 400)

    manager = g.approving_manager
    try:
        order = comp_item(
            org_id=g.org_id,
            order_id=order_id,
            item_id=item_id,
            reason=reason,
            comp_amount=comp_amount,
            user_id=g.user_id,
            approved_by=manager["user_id"],
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.comp_item_failed", order_id=order_id, item_id=item_id)
        return api_error("Failed to comp item", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/transfer", methods=["POST"])
@require_auth
def transfer_order_route(order_id: str):
    """Transfer order to a different server."""
    data = request.get_json(silent=True) or {}
    new_server_id = data.get("new_server_id", "").strip()

    if not new_server_id:
        return api_error("new_server_id is required", 400)

    try:
        order = transfer_order(
            org_id=g.org_id,
            order_id=order_id,
            new_server_id=new_server_id,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.transfer_failed", order_id=order_id)
        return api_error("Failed to transfer order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/move-table", methods=["POST"])
@require_auth
def move_table_route(order_id: str):
    """Move order to a different table."""
    data = request.get_json(silent=True) or {}
    new_table_id = data.get("new_table_id", "").strip()

    if not new_table_id:
        return api_error("new_table_id is required", 400)

    try:
        order = move_order_to_table(
            org_id=g.org_id,
            order_id=order_id,
            new_table_id=new_table_id,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.move_table_failed", order_id=order_id)
        return api_error("Failed to move order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/split", methods=["POST"])
@require_auth
def split_order_route(order_id: str):
    """Split order into multiple checks.

    Expects: {"splits": [{"check_index": 1, "item_ids": ["uuid", ...]}, ...]}
    """
    data = request.get_json(silent=True) or {}
    splits = data.get("splits", [])

    if not splits:
        return api_error("splits array is required", 400)

    try:
        orders = split_order(
            org_id=g.org_id,
            order_id=order_id,
            splits=splits,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.split_failed", order_id=order_id)
        return api_error("Failed to split order", 500)

    return api_success({"orders": orders})


@pos_bp.route("/<order_id>/merge", methods=["POST"])
@require_auth
def merge_order_route(order_id: str):
    """Merge another order into this one.

    Expects: {"source_order_id": "uuid"}
    """
    data = request.get_json(silent=True) or {}
    source_order_id = data.get("source_order_id", "").strip()

    if not source_order_id:
        return api_error("source_order_id is required", 400)

    try:
        order = merge_orders(
            org_id=g.org_id,
            target_id=order_id,
            source_id=source_order_id,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.merge_failed", order_id=order_id)
        return api_error("Failed to merge orders", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/reopen", methods=["POST"])
@require_auth
@require_permission("orders.reopen")
@require_manager_approval
def reopen_order_route(order_id: str):
    """Reopen a closed order. Requires manager approval."""
    manager = g.approving_manager
    try:
        order = reopen_order(
            org_id=g.org_id,
            order_id=order_id,
            user_id=g.user_id,
            approved_by=manager["user_id"],
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.reopen_failed", order_id=order_id)
        return api_error("Failed to reopen order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/modifications", methods=["GET"])
@require_auth
def get_modifications_route(order_id: str):
    """Get modification history for an order."""
    try:
        mods = get_modifications(org_id=g.org_id, order_id=order_id)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception:
        log.exception("order.get_modifications_failed", order_id=order_id)
        return api_error("Failed to fetch modifications", 500)

    return api_success(mods)


@pos_bp.route("/<order_id>/discount", methods=["POST"])
@require_auth
@require_permission("orders.discount")
def apply_discount_route(order_id: str):
    """Apply a discount to an order or specific item.

    Expects:
        - discount_id (for predefined discounts) OR
        - name, discount_type, value (for manual discounts)
        - item_id (optional, for item-level discounts)

    Manager approval via X-Manager-PIN header if discount requires it
    or if over threshold.
    """
    data = request.get_json(silent=True) or {}

    # Check for manager approval (optional -- service validates if needed)
    approved_by = None
    manager = getattr(g, "approving_manager", None)
    if manager:
        approved_by = manager["user_id"]
    else:
        pin = request.headers.get("X-Manager-PIN", "").strip()
        if pin:
            approved_by = _verify_manager_pin_inline(pin)

    try:
        order = apply_discount(
            org_id=g.org_id,
            order_id=order_id,
            discount_data=data,
            user_id=g.user_id,
            approved_by=approved_by,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.discount_failed", order_id=order_id)
        return api_error("Failed to apply discount", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/comp", methods=["POST"])
@require_auth
@require_permission("orders.comp")
@require_manager_approval
def comp_order_route(order_id: str):
    """Comp an entire order. Always requires manager approval."""
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "").strip()

    if not reason:
        return api_error("reason is required", 400)

    manager = g.approving_manager
    try:
        order = comp_order(
            org_id=g.org_id,
            order_id=order_id,
            reason=reason,
            user_id=g.user_id,
            approved_by=manager["user_id"],
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.comp_order_failed", order_id=order_id)
        return api_error("Failed to comp order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>", methods=["DELETE"])
@require_auth
@require_permission("orders.void")
@require_manager_approval
def void_order_route(order_id: str):
    """Void an entire order. Requires manager approval."""
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "").strip()

    if not reason:
        return api_error("reason is required", 400)

    manager = g.approving_manager
    try:
        order = void_order(
            org_id=g.org_id,
            order_id=order_id,
            reason=reason,
            user_id=g.user_id,
            approved_by=manager["user_id"],
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.void_order_failed", order_id=order_id)
        return api_error("Failed to void order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>", methods=["PUT"])
@require_auth
def update_order_route(order_id: str):
    """Update order metadata (notes, guest_count, order_type)."""
    data = request.get_json(silent=True) or {}

    if not data:
        return api_error("No update data provided", 400)

    try:
        order = update_order(
            org_id=g.org_id,
            order_id=order_id,
            data=data,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.update_failed", order_id=order_id)
        return api_error("Failed to update order", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/items/<item_id>", methods=["PUT"])
@require_auth
def update_item_route(order_id: str, item_id: str):
    """Update an order item (quantity, modifiers, notes, seat_number)."""
    data = request.get_json(silent=True) or {}

    if not data:
        return api_error("No update data provided", 400)

    try:
        order = update_order_item(
            org_id=g.org_id,
            order_id=order_id,
            item_id=item_id,
            data=data,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.update_item_failed", order_id=order_id, item_id=item_id)
        return api_error("Failed to update item", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/items/<item_id>", methods=["DELETE"])
@require_auth
@require_permission("orders.void")
def delete_item_route(order_id: str, item_id: str):
    """Remove/void an item from an order (alias for void-item by path).

    Manager approval via X-Manager-PIN header if item was already sent.
    """
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "").strip()

    if not reason:
        return api_error("reason is required", 400)

    approved_by = None
    manager = getattr(g, "approving_manager", None)
    if manager:
        approved_by = manager["user_id"]
    else:
        pin = request.headers.get("X-Manager-PIN", "").strip()
        if pin:
            approved_by = _verify_manager_pin_inline(pin)

    try:
        order = void_item(
            org_id=g.org_id,
            order_id=order_id,
            item_id=item_id,
            reason=reason,
            user_id=g.user_id,
            approved_by=approved_by,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.delete_item_failed", order_id=order_id, item_id=item_id)
        return api_error("Failed to void item", 500)

    return api_success(order)


@pos_bp.route("/<order_id>/discount/<discount_id>", methods=["DELETE"])
@require_auth
@require_permission("orders.discount")
def remove_discount_route(order_id: str, discount_id: str):
    """Remove an applied discount from an order."""
    try:
        order = remove_discount(
            org_id=g.org_id,
            order_id=order_id,
            discount_id=discount_id,
            user_id=g.user_id,
        )
    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("order.remove_discount_failed", order_id=order_id, discount_id=discount_id)
        return api_error("Failed to remove discount", 500)

    return api_success(order)


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------


def _verify_manager_pin_inline(pin: str) -> str | None:
    """Verify a manager PIN from the X-Manager-PIN header inline.

    Returns the manager's user_id if valid, None otherwise.
    Used when manager approval is conditionally required (not always).
    """
    import bcrypt

    from app.extensions import supabase_client

    org_id = g.org_id

    try:
        resp = (
            supabase_client.table("users")
            .select("id, display_name, role, pin_hash")
            .eq("org_id", org_id)
            .in_("role", ["manager", "admin", "owner"])
            .eq("is_active", True)
            .not_.is_("pin_hash", "null")
            .execute()
        )
        for candidate in (resp.data or []):
            try:
                if bcrypt.checkpw(pin.encode(), candidate["pin_hash"].encode()):
                    g.approving_manager = {
                        "user_id": candidate["id"],
                        "display_name": candidate["display_name"],
                        "role": candidate["role"],
                    }
                    return candidate["id"]
            except Exception:
                continue
    except Exception:
        log.exception("manager_pin_inline_verification_failed")

    return None
