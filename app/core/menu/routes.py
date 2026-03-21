"""Menu API blueprint — categories, items, modifier groups, modifiers, 86 logic."""

from __future__ import annotations

import structlog
from flask import Blueprint, g, request

from app.core.menu import services
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_location, require_role
from app.shared.responses import api_error, api_paginated, api_success
from app.shared.validators import validate_money, validate_required, validate_uuid

logger = structlog.get_logger()

menu_bp = Blueprint("menu", __name__, url_prefix="/api/v1/menu")

MANAGER_ROLES = ("owner", "admin", "manager", "platform_admin")
KITCHEN_MANAGER_ROLES = ("owner", "admin", "manager", "kitchen", "platform_admin")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _audit(action: str, entity_type: str, entity_id: str, description: str, **extra):
    ctx = g.current_user
    log_audit(
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        user_name=ctx.display_name,
        user_role=ctx.role,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        description=description,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string,
        **extra,
    )


# ===================================================================
# CATEGORIES
# ===================================================================


@menu_bp.route("/categories", methods=["GET"])
@require_auth
@require_location
def list_categories():
    """List all categories for the current location, with item counts."""
    org_id = g.current_user.org_id
    location_id = g.location_id
    menu_type = request.args.get("menu_type")

    try:
        categories = services.get_categories(
            org_id=org_id,
            location_id=location_id,
            menu_type=menu_type,
        )
    except Exception as exc:
        logger.error("menu.list_categories_failed", error=str(exc))
        return api_error("Failed to fetch categories", 500)

    return api_success(categories)


@menu_bp.route("/categories", methods=["POST"])
@require_auth
@require_role(*MANAGER_ROLES)
@require_location
def create_category():
    """Create a new menu category."""
    data = request.get_json(silent=True) or {}

    valid, missing = validate_required(data, ["name"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    name = data["name"].strip()
    if not name:
        return api_error("Category name cannot be empty", 400)

    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        category = services.create_category(org_id, location_id, data)
    except Exception as exc:
        logger.error("menu.create_category_failed", error=str(exc))
        return api_error("Failed to create category", 500)

    _audit("menu.category_created", "menu_category", category["id"],
           f"Created category '{name}'", new_state=category)

    return api_success(category, status=201)


@menu_bp.route("/categories/<category_id>", methods=["PUT"])
@require_auth
@require_role(*MANAGER_ROLES)
def update_category(category_id: str):
    """Update an existing menu category."""
    ok, err = validate_uuid(category_id)
    if not ok:
        return api_error(err, 400)

    data = request.get_json(silent=True) or {}
    if not data:
        return api_error("No update data provided", 400)

    org_id = g.current_user.org_id

    try:
        category = services.update_category(org_id, category_id, data)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.update_category_failed", error=str(exc), category_id=category_id)
        return api_error("Failed to update category", 500)

    _audit("menu.category_updated", "menu_category", category_id,
           f"Updated category '{category.get('name', '')}'", new_state=category)

    return api_success(category)


@menu_bp.route("/categories/<category_id>", methods=["DELETE"])
@require_auth
@require_role(*MANAGER_ROLES)
def delete_category(category_id: str):
    """Soft-delete a menu category. Fails if it contains active items."""
    ok, err = validate_uuid(category_id)
    if not ok:
        return api_error(err, 400)

    org_id = g.current_user.org_id

    try:
        services.delete_category(org_id, category_id)
    except ValueError as exc:
        msg = str(exc)
        status = 404 if "not found" in msg.lower() else 409
        return api_error(msg, status)
    except Exception as exc:
        logger.error("menu.delete_category_failed", error=str(exc), category_id=category_id)
        return api_error("Failed to delete category", 500)

    _audit("menu.category_deleted", "menu_category", category_id,
           f"Deleted category {category_id}")

    return api_success({"deleted": True}, message="Category deleted")


# ===================================================================
# ITEMS
# ===================================================================


@menu_bp.route("/categories/reorder", methods=["PATCH"])
@require_auth
@require_role(*MANAGER_ROLES)
def reorder_categories():
    """Bulk update sort_order for categories. Expects array of {id, sort_order}."""
    data = request.get_json(silent=True) or {}
    categories_order = data.get("categories") or []

    if not categories_order or not isinstance(categories_order, list):
        return api_error("'categories' array is required with [{id, sort_order}, ...]", 400)

    for entry in categories_order:
        if "id" not in entry or "sort_order" not in entry:
            return api_error("Each category must have 'id' and 'sort_order'", 400)
        ok, err = validate_uuid(entry["id"])
        if not ok:
            return api_error(f"Invalid category id: {err}", 400)
        if not isinstance(entry["sort_order"], int):
            return api_error("sort_order must be an integer", 400)

    org_id = g.current_user.org_id

    try:
        services.reorder_categories(org_id, categories_order)
    except Exception as exc:
        logger.error("menu.reorder_categories_failed", error=str(exc))
        return api_error("Failed to reorder categories", 500)

    return api_success({"reordered": len(categories_order)}, message="Categories reordered")


@menu_bp.route("/items", methods=["GET"])
@require_auth
@require_location
def list_items():
    """List menu items with filtering, search, and pagination."""
    org_id = g.current_user.org_id
    location_id = g.location_id

    category_id = request.args.get("category_id")
    search = request.args.get("search", "").strip() or None
    available_only = request.args.get("is_available", "").lower() == "true"

    try:
        page = max(1, int(request.args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    except (ValueError, TypeError):
        per_page = 50

    if category_id:
        ok, err = validate_uuid(category_id)
        if not ok:
            return api_error(f"Invalid category_id: {err}", 400)

    try:
        items, total = services.get_items(
            org_id=org_id,
            location_id=location_id,
            category_id=category_id,
            search=search,
            available_only=available_only,
            page=page,
            per_page=per_page,
        )
    except Exception as exc:
        logger.error("menu.list_items_failed", error=str(exc))
        return api_error("Failed to fetch items", 500)

    return api_paginated(items, total, page, per_page)


@menu_bp.route("/items/<item_id>", methods=["GET"])
@require_auth
def get_item(item_id: str):
    """Get a single menu item with full details including modifier groups."""
    ok, err = validate_uuid(item_id)
    if not ok:
        return api_error(err, 400)

    org_id = g.current_user.org_id

    try:
        item = services.get_item(org_id, item_id)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.get_item_failed", error=str(exc), item_id=item_id)
        return api_error("Failed to fetch item", 500)

    return api_success(item)


@menu_bp.route("/items", methods=["POST"])
@require_auth
@require_role(*MANAGER_ROLES)
@require_location
def create_item():
    """Create a new menu item."""
    data = request.get_json(silent=True) or {}

    valid, missing = validate_required(data, ["name", "category_id", "price"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    # Validate category_id is a UUID
    ok, err = validate_uuid(data["category_id"])
    if not ok:
        return api_error(f"Invalid category_id: {err}", 400)

    # Validate price is integer cents
    ok, err = validate_money(data["price"])
    if not ok:
        return api_error(f"Invalid price: {err}", 400)

    # Validate cost if provided
    if data.get("cost") is not None:
        ok, err = validate_money(data["cost"])
        if not ok:
            return api_error(f"Invalid cost: {err}", 400)

    # Validate tax_rate_id if provided
    if data.get("tax_rate_id"):
        ok, err = validate_uuid(data["tax_rate_id"])
        if not ok:
            return api_error(f"Invalid tax_rate_id: {err}", 400)

    # Validate modifier_group_ids if provided
    for gid in data.get("modifier_group_ids") or []:
        ok, err = validate_uuid(gid)
        if not ok:
            return api_error(f"Invalid modifier_group_id: {err}", 400)

    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        item = services.create_item(org_id, location_id, data)
    except Exception as exc:
        logger.error("menu.create_item_failed", error=str(exc))
        return api_error("Failed to create item", 500)

    _audit("menu.item_created", "menu_item", item["id"],
           f"Created item '{data['name']}'", new_state=item)

    return api_success(item, status=201)


@menu_bp.route("/items/<item_id>", methods=["PUT"])
@require_auth
@require_role(*MANAGER_ROLES)
def update_item(item_id: str):
    """Update an existing menu item."""
    ok, err = validate_uuid(item_id)
    if not ok:
        return api_error(err, 400)

    data = request.get_json(silent=True) or {}
    if not data:
        return api_error("No update data provided", 400)

    # Validate price if provided
    if "price" in data:
        ok, err = validate_money(data["price"])
        if not ok:
            return api_error(f"Invalid price: {err}", 400)

    # Validate cost if provided
    if "cost" in data:
        ok, err = validate_money(data["cost"])
        if not ok:
            return api_error(f"Invalid cost: {err}", 400)

    # Validate category_id if provided
    if "category_id" in data:
        ok, err = validate_uuid(data["category_id"])
        if not ok:
            return api_error(f"Invalid category_id: {err}", 400)

    # Validate modifier_group_ids if provided
    for gid in data.get("modifier_group_ids") or []:
        ok, err = validate_uuid(gid)
        if not ok:
            return api_error(f"Invalid modifier_group_id: {err}", 400)

    org_id = g.current_user.org_id

    try:
        item = services.update_item(org_id, item_id, data)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.update_item_failed", error=str(exc), item_id=item_id)
        return api_error("Failed to update item", 500)

    _audit("menu.item_updated", "menu_item", item_id,
           f"Updated item '{item.get('name', '')}'", new_state=item)

    return api_success(item)


@menu_bp.route("/items/<item_id>", methods=["DELETE"])
@require_auth
@require_role(*MANAGER_ROLES)
def delete_item(item_id: str):
    """Soft-delete a menu item."""
    ok, err = validate_uuid(item_id)
    if not ok:
        return api_error(err, 400)

    org_id = g.current_user.org_id

    try:
        services.delete_item(org_id, item_id)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.delete_item_failed", error=str(exc), item_id=item_id)
        return api_error("Failed to delete item", 500)

    _audit("menu.item_deleted", "menu_item", item_id,
           f"Deleted item {item_id}")

    return api_success({"deleted": True}, message="Item deleted")


@menu_bp.route("/items/<item_id>/86", methods=["PATCH"])
@require_auth
@require_role(*KITCHEN_MANAGER_ROLES)
def toggle_86_status(item_id: str):
    """Toggle 86 status on a menu item. Kitchen managers and above can do this."""
    ok, err = validate_uuid(item_id)
    if not ok:
        return api_error(err, 400)

    data = request.get_json(silent=True) or {}

    if "is_available" not in data:
        return api_error("is_available field is required (true = available, false = 86'd)", 400)

    is_available = bool(data["is_available"])
    reason = data.get("reason", "").strip() or None

    org_id = g.current_user.org_id
    ctx = g.current_user

    try:
        item = services.toggle_86(
            org_id=org_id,
            item_id=item_id,
            is_available=is_available,
            reason=reason,
            user_id=ctx.user_id,
            user_name=ctx.display_name,
        )
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.toggle_86_failed", error=str(exc), item_id=item_id)
        return api_error("Failed to update 86 status", 500)

    status_label = "available" if is_available else "86'd"
    _audit(
        "menu.item_86_toggled", "menu_item", item_id,
        f"Item '{item.get('name', '')}' marked {status_label}" + (f" (reason: {reason})" if reason else ""),
        new_state={"is_86d": not is_available, "reason": reason},
    )

    return api_success(item, message=f"Item marked as {status_label}")


@menu_bp.route("/items/reorder", methods=["PATCH"])
@require_auth
@require_role(*MANAGER_ROLES)
def reorder_items():
    """Bulk update sort_order for items. Expects array of {id, sort_order}."""
    data = request.get_json(silent=True) or {}
    items_order = data.get("items") or []

    if not items_order or not isinstance(items_order, list):
        return api_error("'items' array is required with [{id, sort_order}, ...]", 400)

    # Validate each entry
    for entry in items_order:
        if "id" not in entry or "sort_order" not in entry:
            return api_error("Each item must have 'id' and 'sort_order'", 400)
        ok, err = validate_uuid(entry["id"])
        if not ok:
            return api_error(f"Invalid item id: {err}", 400)
        if not isinstance(entry["sort_order"], int):
            return api_error("sort_order must be an integer", 400)

    org_id = g.current_user.org_id

    try:
        services.reorder_items(org_id, items_order)
    except Exception as exc:
        logger.error("menu.reorder_items_failed", error=str(exc))
        return api_error("Failed to reorder items", 500)

    return api_success({"reordered": len(items_order)}, message="Items reordered")


# ===================================================================
# MODIFIER GROUPS
# ===================================================================


@menu_bp.route("/modifier-groups", methods=["GET"])
@require_auth
def list_modifier_groups():
    """List all modifier groups with their modifiers."""
    org_id = g.current_user.org_id
    location_id = request.args.get("location_id")

    try:
        groups = services.get_modifier_groups(org_id, location_id=location_id)
    except Exception as exc:
        logger.error("menu.list_modifier_groups_failed", error=str(exc))
        return api_error("Failed to fetch modifier groups", 500)

    return api_success(groups)


@menu_bp.route("/modifier-groups", methods=["POST"])
@require_auth
@require_role(*MANAGER_ROLES)
def create_modifier_group():
    """Create a modifier group with nested modifiers."""
    data = request.get_json(silent=True) or {}

    valid, missing = validate_required(data, ["name"])
    if not valid:
        return api_error(f"Missing required fields: {', '.join(missing)}", 400)

    # Validate min/max selections
    min_sel = data.get("min_selections", 0)
    max_sel = data.get("max_selections", 1)
    if not isinstance(min_sel, int) or min_sel < 0:
        return api_error("min_selections must be a non-negative integer", 400)
    if not isinstance(max_sel, int) or max_sel < 1:
        return api_error("max_selections must be a positive integer", 400)
    if min_sel > max_sel:
        return api_error("min_selections cannot exceed max_selections", 400)

    # Validate nested modifiers
    modifiers = data.get("modifiers") or []
    for idx, mod in enumerate(modifiers):
        if not mod.get("name"):
            return api_error(f"Modifier at index {idx} missing 'name'", 400)
        price_adj = mod.get("price_adjustment", 0)
        if price_adj != 0:
            ok, err = validate_money(price_adj)
            if not ok:
                return api_error(f"Modifier '{mod['name']}' invalid price_adjustment: {err}", 400)

    org_id = g.current_user.org_id

    try:
        group = services.create_modifier_group(org_id, data)
    except Exception as exc:
        logger.error("menu.create_modifier_group_failed", error=str(exc))
        return api_error("Failed to create modifier group", 500)

    _audit("menu.modifier_group_created", "modifier_group", group["id"],
           f"Created modifier group '{data['name']}' with {len(modifiers)} modifiers",
           new_state=group)

    return api_success(group, status=201)


@menu_bp.route("/modifier-groups/<group_id>", methods=["PUT"])
@require_auth
@require_role(*MANAGER_ROLES)
def update_modifier_group(group_id: str):
    """Update a modifier group and optionally replace its modifiers."""
    ok, err = validate_uuid(group_id)
    if not ok:
        return api_error(err, 400)

    data = request.get_json(silent=True) or {}
    if not data:
        return api_error("No update data provided", 400)

    # Validate min/max if provided
    if "min_selections" in data:
        min_sel = data["min_selections"]
        if not isinstance(min_sel, int) or min_sel < 0:
            return api_error("min_selections must be a non-negative integer", 400)

    if "max_selections" in data:
        max_sel = data["max_selections"]
        if not isinstance(max_sel, int) or max_sel < 1:
            return api_error("max_selections must be a positive integer", 400)

    # Cross-validate min/max
    min_sel = data.get("min_selections")
    max_sel = data.get("max_selections")
    if min_sel is not None and max_sel is not None and min_sel > max_sel:
        return api_error("min_selections cannot exceed max_selections", 400)

    # Validate nested modifiers if provided
    if "modifiers" in data:
        for idx, mod in enumerate(data["modifiers"] or []):
            if not mod.get("name"):
                return api_error(f"Modifier at index {idx} missing 'name'", 400)
            price_adj = mod.get("price_adjustment", 0)
            if price_adj != 0:
                ok, err = validate_money(price_adj)
                if not ok:
                    return api_error(f"Modifier '{mod['name']}' invalid price_adjustment: {err}", 400)

    org_id = g.current_user.org_id

    try:
        group = services.update_modifier_group(org_id, group_id, data)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.update_modifier_group_failed", error=str(exc), group_id=group_id)
        return api_error("Failed to update modifier group", 500)

    _audit("menu.modifier_group_updated", "modifier_group", group_id,
           f"Updated modifier group '{group.get('name', '')}'", new_state=group)

    return api_success(group)


@menu_bp.route("/modifier-groups/<group_id>", methods=["DELETE"])
@require_auth
@require_role(*MANAGER_ROLES)
def delete_modifier_group(group_id: str):
    """Soft-delete a modifier group and its modifiers."""
    ok, err = validate_uuid(group_id)
    if not ok:
        return api_error(err, 400)

    org_id = g.current_user.org_id

    try:
        services.delete_modifier_group(org_id, group_id)
    except ValueError as exc:
        return api_error(str(exc), 404)
    except Exception as exc:
        logger.error("menu.delete_modifier_group_failed", error=str(exc), group_id=group_id)
        return api_error("Failed to delete modifier group", 500)

    _audit("menu.modifier_group_deleted", "modifier_group", group_id,
           f"Deleted modifier group {group_id}")

    return api_success({"deleted": True}, message="Modifier group deleted")


# ===================================================================
# FULL MENU
# ===================================================================


@menu_bp.route("/full", methods=["GET"])
@require_auth
@require_location
def get_full_menu():
    """Get the complete menu tree for a location (cached)."""
    org_id = g.current_user.org_id
    location_id = g.location_id

    try:
        menu = services.get_full_menu(org_id, location_id)
    except Exception as exc:
        logger.error("menu.get_full_menu_failed", error=str(exc))
        return api_error("Failed to fetch menu", 500)

    return api_success(menu)
