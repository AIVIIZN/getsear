"""Menu business logic — categories, items, modifier groups, modifiers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.shared.audit import log_audit
from app.shared.cache import cache_menu, get_cached_menu, invalidate_menu
from app.shared.event_bus import event_bus

log = structlog.get_logger(__name__)

MANAGER_ROLES = ("owner", "admin", "manager", "platform_admin")


def _db():
    from app.extensions import supabase_client
    return supabase_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Price conversion helpers (DB stores numeric(10,2), API uses integer cents)
# ---------------------------------------------------------------------------

def _cents_to_decimal(cents: int | None) -> float | None:
    if cents is None:
        return None
    return round(cents / 100, 2)


def _decimal_to_cents(value: float | int | None) -> int | None:
    if value is None:
        return None
    return int(round(float(value) * 100))


def _item_to_api(row: dict[str, Any]) -> dict[str, Any]:
    """Convert a menu_items DB row to API format (prices in cents)."""
    out = dict(row)
    if "price" in out and out["price"] is not None:
        out["price"] = int(round(float(out["price"]) * 100))
    if "cost" in out and out["cost"] is not None:
        out["cost"] = int(round(float(out["cost"]) * 100))
    return out


def _modifier_to_api(row: dict[str, Any]) -> dict[str, Any]:
    """Convert a modifiers DB row to API format (price_adjustment in cents)."""
    out = dict(row)
    if "price_adjustment" in out and out["price_adjustment"] is not None:
        out["price_adjustment"] = int(round(float(out["price_adjustment"]) * 100))
    return out


# ===================================================================
# CATEGORIES
# ===================================================================

def get_categories(
    org_id: str,
    location_id: str,
    menu_type: str | None = None,
    include_items: bool = False,
) -> list[dict[str, Any]]:
    query = (
        _db().table("menu_categories")
        .select("*")
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .order("sort_order", desc=False)
    )

    # Location filter: org-wide (location_id IS NULL) OR specific location
    # Supabase Python SDK: use .or_ for OR conditions
    query = query.or_(f"location_id.eq.{location_id},location_id.is.null")

    # menu_type column does not exist on menu_categories; ignore filter
    # if menu_type:
    #     query = query.eq("menu_type", menu_type)

    resp = query.execute()
    categories = resp.data or []

    # Attach item counts
    for cat in categories:
        count_resp = (
            _db().table("menu_items")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .eq("category_id", cat["id"])
            .is_("deleted_at", "null")
            .eq("is_active", True)
            .execute()
        )
        cat["item_count"] = count_resp.count if count_resp.count is not None else 0

    if include_items:
        for cat in categories:
            items_resp = (
                _db().table("menu_items")
                .select("*")
                .eq("org_id", org_id)
                .eq("category_id", cat["id"])
                .is_("deleted_at", "null")
                .order("sort_order", desc=False)
                .execute()
            )
            cat["items"] = [_item_to_api(i) for i in (items_resp.data or [])]

    return categories


def create_category(
    org_id: str,
    location_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    row = {
        "org_id": org_id,
        "location_id": location_id,
        "name": data["name"],
        "description": data.get("description"),
        "sort_order": data.get("sort_order", 0),
        "color": data.get("display_color") or data.get("color"),
        "image_url": data.get("image_url"),
        "is_active": data.get("is_active", True),
    }

    # Availability
    if data.get("available_start_time"):
        row["available_start_time"] = data["available_start_time"]
    if data.get("available_end_time"):
        row["available_end_time"] = data["available_end_time"]
    if data.get("available_days") is not None:
        row["available_days"] = data["available_days"]

    resp = _db().table("menu_categories").insert(row).execute()
    category = resp.data[0]

    invalidate_menu(location_id)

    log.info("category_created", org_id=org_id, category_id=category["id"], name=data["name"])
    return category


def update_category(
    org_id: str,
    category_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    # Fetch existing to verify ownership
    existing_resp = (
        _db().table("menu_categories")
        .select("*")
        .eq("id", category_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise ValueError("Category not found")

    update_fields: dict[str, Any] = {"updated_at": _now_iso()}

    allowed = [
        "name", "description", "sort_order", "color", "image_url",
        "is_active", "available_start_time", "available_end_time", "available_days",
    ]
    for field in allowed:
        if field in data:
            update_fields[field] = data[field]

    # Handle display_color alias
    if "display_color" in data:
        update_fields["color"] = data["display_color"]

    resp = (
        _db().table("menu_categories")
        .update(update_fields)
        .eq("id", category_id)
        .eq("org_id", org_id)
        .execute()
    )
    updated = resp.data[0]

    location_id = existing.get("location_id") or ""
    if location_id:
        invalidate_menu(location_id)

    log.info("category_updated", org_id=org_id, category_id=category_id)
    return updated


def delete_category(org_id: str, category_id: str) -> bool:
    # Verify ownership
    existing_resp = (
        _db().table("menu_categories")
        .select("id, location_id")
        .eq("id", category_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise ValueError("Category not found")

    # Check for active items in this category
    items_resp = (
        _db().table("menu_items")
        .select("id", count="exact")
        .eq("org_id", org_id)
        .eq("category_id", category_id)
        .is_("deleted_at", "null")
        .eq("is_active", True)
        .execute()
    )
    active_count = items_resp.count if items_resp.count is not None else 0
    if active_count > 0:
        raise ValueError(f"Cannot delete category with {active_count} active items. Deactivate or move items first.")

    # Soft delete
    _db().table("menu_categories").update({
        "deleted_at": _now_iso(),
        "updated_at": _now_iso(),
    }).eq("id", category_id).eq("org_id", org_id).execute()

    location_id = existing.get("location_id") or ""
    if location_id:
        invalidate_menu(location_id)

    log.info("category_deleted", org_id=org_id, category_id=category_id)
    return True


# ===================================================================
# ITEMS
# ===================================================================

def get_items(
    org_id: str,
    location_id: str,
    category_id: str | None = None,
    search: str | None = None,
    available_only: bool = False,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    offset = (page - 1) * per_page

    query = (
        _db().table("menu_items")
        .select("*", count="exact")
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .or_(f"location_id.eq.{location_id},location_id.is.null")
        .order("sort_order", desc=False)
    )

    if category_id:
        query = query.eq("category_id", category_id)

    if available_only:
        query = query.eq("is_active", True).eq("is_86d", False)

    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.range(offset, offset + per_page - 1)

    resp = query.execute()
    items = [_item_to_api(row) for row in (resp.data or [])]
    total = resp.count if resp.count is not None else len(items)

    # Attach modifier groups for each item
    for item in items:
        item["modifier_groups"] = _get_item_modifier_groups(org_id, item["id"])

    return items, total


def get_item(org_id: str, item_id: str) -> dict[str, Any]:
    resp = (
        _db().table("menu_items")
        .select("*")
        .eq("id", item_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    item = resp.data
    if not item:
        raise ValueError("Item not found")

    item = _item_to_api(item)
    item["modifier_groups"] = _get_item_modifier_groups(org_id, item_id)

    return item


def _get_item_modifier_groups(org_id: str, item_id: str) -> list[dict[str, Any]]:
    """Fetch modifier groups linked to an item, with their modifiers."""
    join_resp = (
        _db().table("menu_item_modifier_groups")
        .select("modifier_group_id, sort_order")
        .eq("menu_item_id", item_id)
        .order("sort_order", desc=False)
        .execute()
    )
    joins = join_resp.data or []
    if not joins:
        return []

    group_ids = [j["modifier_group_id"] for j in joins]

    groups_resp = (
        _db().table("modifier_groups")
        .select("*")
        .in_("id", group_ids)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .execute()
    )
    groups_by_id = {g["id"]: g for g in (groups_resp.data or [])}

    result = []
    for j in joins:
        gid = j["modifier_group_id"]
        group = groups_by_id.get(gid)
        if not group:
            continue
        group = dict(group)
        group["sort_order"] = j["sort_order"]

        # Fetch modifiers for this group
        mods_resp = (
            _db().table("modifiers")
            .select("*")
            .eq("modifier_group_id", gid)
            .eq("org_id", org_id)
            .is_("deleted_at", "null")
            .eq("is_active", True)
            .order("sort_order", desc=False)
            .execute()
        )
        group["modifiers"] = [_modifier_to_api(m) for m in (mods_resp.data or [])]
        result.append(group)

    return result


def create_item(
    org_id: str,
    location_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "org_id": org_id,
        "location_id": location_id,
        "category_id": data["category_id"],
        "name": data["name"],
        "price": _cents_to_decimal(data["price"]),
        "is_active": data.get("is_active", True),
        "sort_order": data.get("sort_order", 0),
    }

    # Optional fields
    optional_str = ["short_name", "description", "prep_station", "course", "image_url", "color", "plu_code", "barcode"]
    for field in optional_str:
        if data.get(field) is not None:
            row[field] = data[field]

    if data.get("cost") is not None:
        row["cost"] = _cents_to_decimal(data["cost"])

    if data.get("tax_rate_id"):
        row["tax_rate_id"] = data["tax_rate_id"]

    if data.get("is_taxable") is not None:
        row["is_taxable"] = data["is_taxable"]

    if data.get("prep_time_minutes") is not None:
        row["prep_time_minutes"] = data["prep_time_minutes"]

    if data.get("available_start_time"):
        row["available_start_time"] = data["available_start_time"]
    if data.get("available_end_time"):
        row["available_end_time"] = data["available_end_time"]
    if data.get("available_days") is not None:
        row["available_days"] = data["available_days"]

    if data.get("allergens") is not None:
        row["allergens"] = data["allergens"]
    if data.get("nutrition") is not None:
        row["nutrition"] = data["nutrition"]
    if data.get("dietary_tags") is not None:
        # Store as part of nutrition JSONB or allergens array depending on schema
        # The schema doesn't have a dedicated dietary_tags column, store in nutrition
        if row.get("nutrition") is None:
            row["nutrition"] = {}
        row["nutrition"]["dietary_tags"] = data["dietary_tags"]

    resp = _db().table("menu_items").insert(row).execute()
    item = resp.data[0]

    # Link modifier groups
    modifier_group_ids = data.get("modifier_group_ids") or []
    if modifier_group_ids:
        joins = [
            {
                "menu_item_id": item["id"],
                "modifier_group_id": gid,
                "sort_order": idx,
            }
            for idx, gid in enumerate(modifier_group_ids)
        ]
        _db().table("menu_item_modifier_groups").insert(joins).execute()

    invalidate_menu(location_id)

    log.info("item_created", org_id=org_id, item_id=item["id"], name=data["name"])
    return _item_to_api(item)


def update_item(
    org_id: str,
    item_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    # Fetch existing
    existing_resp = (
        _db().table("menu_items")
        .select("*")
        .eq("id", item_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise ValueError("Item not found")

    update_fields: dict[str, Any] = {"updated_at": _now_iso()}

    direct_fields = [
        "name", "short_name", "description", "category_id", "prep_station",
        "course", "image_url", "color", "sort_order", "is_active",
        "is_taxable", "tax_rate_id", "prep_time_minutes",
        "available_start_time", "available_end_time", "available_days",
        "allergens", "nutrition", "plu_code", "barcode",
    ]
    for field in direct_fields:
        if field in data:
            update_fields[field] = data[field]

    # Price fields: convert from cents to decimal
    if "price" in data:
        update_fields["price"] = _cents_to_decimal(data["price"])
    if "cost" in data:
        update_fields["cost"] = _cents_to_decimal(data["cost"])

    resp = (
        _db().table("menu_items")
        .update(update_fields)
        .eq("id", item_id)
        .eq("org_id", org_id)
        .execute()
    )
    updated = resp.data[0]

    # Update modifier group links if provided
    if "modifier_group_ids" in data:
        # Delete existing links
        _db().table("menu_item_modifier_groups").delete().eq("menu_item_id", item_id).execute()
        # Insert new links
        modifier_group_ids = data["modifier_group_ids"] or []
        if modifier_group_ids:
            joins = [
                {
                    "menu_item_id": item_id,
                    "modifier_group_id": gid,
                    "sort_order": idx,
                }
                for idx, gid in enumerate(modifier_group_ids)
            ]
            _db().table("menu_item_modifier_groups").insert(joins).execute()

    location_id = existing.get("location_id") or updated.get("location_id") or ""
    if location_id:
        invalidate_menu(location_id)

    log.info("item_updated", org_id=org_id, item_id=item_id)
    return _item_to_api(updated)


def delete_item(org_id: str, item_id: str) -> bool:
    existing_resp = (
        _db().table("menu_items")
        .select("id, location_id")
        .eq("id", item_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise ValueError("Item not found")

    _db().table("menu_items").update({
        "deleted_at": _now_iso(),
        "updated_at": _now_iso(),
        "is_active": False,
    }).eq("id", item_id).eq("org_id", org_id).execute()

    # Clean up modifier group links
    _db().table("menu_item_modifier_groups").delete().eq("menu_item_id", item_id).execute()

    location_id = existing.get("location_id") or ""
    if location_id:
        invalidate_menu(location_id)

    log.info("item_deleted", org_id=org_id, item_id=item_id)
    return True


def toggle_86(
    org_id: str,
    item_id: str,
    is_available: bool,
    reason: str | None = None,
    user_id: str = "",
    user_name: str = "",
) -> dict[str, Any]:
    existing_resp = (
        _db().table("menu_items")
        .select("*")
        .eq("id", item_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise ValueError("Item not found")

    is_86d = not is_available

    update_fields: dict[str, Any] = {
        "is_86d": is_86d,
        "updated_at": _now_iso(),
    }

    resp = (
        _db().table("menu_items")
        .update(update_fields)
        .eq("id", item_id)
        .eq("org_id", org_id)
        .execute()
    )
    updated = resp.data[0]

    location_id = existing.get("location_id") or ""
    if location_id:
        invalidate_menu(location_id)

    # Emit event for KDS and other subscribers
    event_data = {
        "org_id": org_id,
        "item_id": item_id,
        "item_name": existing.get("name", ""),
        "is_86d": is_86d,
        "reason": reason or "",
        "toggled_by": user_id,
        "toggled_by_name": user_name,
        "location_id": location_id,
        "timestamp": _now_iso(),
    }

    if is_86d:
        event_bus.emit("menu.item_86d", event_data)
        log.warning("item_86d", org_id=org_id, item_id=item_id, name=existing["name"], reason=reason)
    else:
        event_bus.emit("menu.item_un86d", event_data)
        log.info("item_un86d", org_id=org_id, item_id=item_id, name=existing["name"])

    return _item_to_api(updated)


def reorder_categories(org_id: str, categories_order: list[dict[str, Any]]) -> bool:
    """Bulk update sort_order for categories."""
    for entry in categories_order:
        cat_id = entry.get("id")
        sort_order = entry.get("sort_order")
        if cat_id is None or sort_order is None:
            continue
        _db().table("menu_categories").update({
            "sort_order": sort_order,
            "updated_at": _now_iso(),
        }).eq("id", cat_id).eq("org_id", org_id).execute()

    log.info("categories_reordered", org_id=org_id, count=len(categories_order))
    return True


def reorder_items(org_id: str, items_order: list[dict[str, Any]]) -> bool:
    for entry in items_order:
        item_id = entry.get("id")
        sort_order = entry.get("sort_order")
        if item_id is None or sort_order is None:
            continue
        _db().table("menu_items").update({
            "sort_order": sort_order,
            "updated_at": _now_iso(),
        }).eq("id", item_id).eq("org_id", org_id).execute()

    log.info("items_reordered", org_id=org_id, count=len(items_order))
    return True


# ===================================================================
# MODIFIER GROUPS
# ===================================================================

def get_modifier_groups(
    org_id: str,
    location_id: str | None = None,
) -> list[dict[str, Any]]:
    query = (
        _db().table("modifier_groups")
        .select("*")
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .order("sort_order", desc=False)
    )

    resp = query.execute()
    groups = resp.data or []

    # Attach modifiers for each group
    for group in groups:
        mods_resp = (
            _db().table("modifiers")
            .select("*")
            .eq("modifier_group_id", group["id"])
            .eq("org_id", org_id)
            .is_("deleted_at", "null")
            .eq("is_active", True)
            .order("sort_order", desc=False)
            .execute()
        )
        group["modifiers"] = [_modifier_to_api(m) for m in (mods_resp.data or [])]

    return groups


def create_modifier_group(
    org_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    group_row: dict[str, Any] = {
        "org_id": org_id,
        "name": data["name"],
        "min_selections": data.get("min_selections", 0),
        "max_selections": data.get("max_selections", 1),
        "is_required_prompt": data.get("is_required", False),
        "sort_order": data.get("sort_order", 0),
    }

    group_resp = _db().table("modifier_groups").insert(group_row).execute()
    group = group_resp.data[0]

    # Create nested modifiers
    modifiers_data = data.get("modifiers") or []
    created_modifiers = []
    for idx, mod in enumerate(modifiers_data):
        mod_row = {
            "org_id": org_id,
            "modifier_group_id": group["id"],
            "name": mod["name"],
            "price_adjustment": _cents_to_decimal(mod.get("price_adjustment", 0)),
            "is_default": mod.get("is_default", False),
            "sort_order": mod.get("sort_order", idx),
            "is_active": True,
        }
        if mod.get("short_name"):
            mod_row["short_name"] = mod["short_name"]

        mod_resp = _db().table("modifiers").insert(mod_row).execute()
        created_modifiers.append(_modifier_to_api(mod_resp.data[0]))

    group["modifiers"] = created_modifiers

    log.info("modifier_group_created", org_id=org_id, group_id=group["id"], name=data["name"])
    return group


def update_modifier_group(
    org_id: str,
    group_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    # Verify ownership
    existing_resp = (
        _db().table("modifier_groups")
        .select("*")
        .eq("id", group_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise ValueError("Modifier group not found")

    update_fields: dict[str, Any] = {"updated_at": _now_iso()}

    if "name" in data:
        update_fields["name"] = data["name"]
    if "min_selections" in data:
        update_fields["min_selections"] = data["min_selections"]
    if "max_selections" in data:
        update_fields["max_selections"] = data["max_selections"]
    if "is_required" in data:
        update_fields["is_required_prompt"] = data["is_required"]
    if "sort_order" in data:
        update_fields["sort_order"] = data["sort_order"]

    resp = (
        _db().table("modifier_groups")
        .update(update_fields)
        .eq("id", group_id)
        .eq("org_id", org_id)
        .execute()
    )
    group = resp.data[0]

    # Replace modifiers if provided (full replacement strategy)
    if "modifiers" in data:
        # Soft-delete existing modifiers
        _db().table("modifiers").update({
            "deleted_at": _now_iso(),
            "is_active": False,
        }).eq("modifier_group_id", group_id).eq("org_id", org_id).execute()

        # Insert new modifiers
        created_modifiers = []
        for idx, mod in enumerate(data["modifiers"] or []):
            mod_row = {
                "org_id": org_id,
                "modifier_group_id": group_id,
                "name": mod["name"],
                "price_adjustment": _cents_to_decimal(mod.get("price_adjustment", 0)),
                "is_default": mod.get("is_default", False),
                "sort_order": mod.get("sort_order", idx),
                "is_active": True,
            }
            if mod.get("short_name"):
                mod_row["short_name"] = mod["short_name"]

            mod_resp = _db().table("modifiers").insert(mod_row).execute()
            created_modifiers.append(_modifier_to_api(mod_resp.data[0]))

        group["modifiers"] = created_modifiers
    else:
        # Fetch current modifiers
        mods_resp = (
            _db().table("modifiers")
            .select("*")
            .eq("modifier_group_id", group_id)
            .eq("org_id", org_id)
            .is_("deleted_at", "null")
            .eq("is_active", True)
            .order("sort_order", desc=False)
            .execute()
        )
        group["modifiers"] = [_modifier_to_api(m) for m in (mods_resp.data or [])]

    # Invalidate cache for all locations that use items with this modifier group
    _invalidate_locations_for_modifier_group(org_id, group_id)

    log.info("modifier_group_updated", org_id=org_id, group_id=group_id)
    return group


def delete_modifier_group(org_id: str, group_id: str) -> bool:
    existing_resp = (
        _db().table("modifier_groups")
        .select("id")
        .eq("id", group_id)
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not existing_resp.data:
        raise ValueError("Modifier group not found")

    # Soft-delete the group
    _db().table("modifier_groups").update({
        "deleted_at": _now_iso(),
        "updated_at": _now_iso(),
    }).eq("id", group_id).eq("org_id", org_id).execute()

    # Soft-delete all modifiers in the group
    _db().table("modifiers").update({
        "deleted_at": _now_iso(),
        "is_active": False,
    }).eq("modifier_group_id", group_id).eq("org_id", org_id).execute()

    # Remove links from menu items
    _db().table("menu_item_modifier_groups").delete().eq("modifier_group_id", group_id).execute()

    _invalidate_locations_for_modifier_group(org_id, group_id)

    log.info("modifier_group_deleted", org_id=org_id, group_id=group_id)
    return True


def _invalidate_locations_for_modifier_group(org_id: str, group_id: str) -> None:
    """Find all locations with items linked to this modifier group and invalidate their caches."""
    try:
        join_resp = (
            _db().table("menu_item_modifier_groups")
            .select("menu_item_id")
            .eq("modifier_group_id", group_id)
            .execute()
        )
        item_ids = [j["menu_item_id"] for j in (join_resp.data or [])]
        if not item_ids:
            return

        items_resp = (
            _db().table("menu_items")
            .select("location_id")
            .in_("id", item_ids)
            .eq("org_id", org_id)
            .execute()
        )
        location_ids = {i["location_id"] for i in (items_resp.data or []) if i.get("location_id")}
        for lid in location_ids:
            invalidate_menu(lid)
    except Exception:
        log.exception("invalidate_locations_for_modifier_group_failed", group_id=group_id)


# ===================================================================
# FULL MENU TREE (cached)
# ===================================================================

def get_full_menu(org_id: str, location_id: str) -> dict[str, Any]:
    """Return the complete menu tree: categories -> items -> modifier groups -> modifiers.

    Cached per location with 5 minute TTL.
    """
    cached = get_cached_menu(location_id)
    if cached is not None:
        return cached

    categories = get_categories(org_id, location_id, include_items=True)

    # Attach modifier groups to each item
    for cat in categories:
        for item in cat.get("items", []):
            item["modifier_groups"] = _get_item_modifier_groups(org_id, item["id"])

    menu_tree = {
        "org_id": org_id,
        "location_id": location_id,
        "categories": categories,
        "generated_at": _now_iso(),
    }

    cache_menu(location_id, menu_tree, ttl=300)

    log.info("full_menu_built", org_id=org_id, location_id=location_id, category_count=len(categories))
    return menu_tree
