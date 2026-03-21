"""Customer business logic — CRUD, lookup, merge, stats."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog

from app.extensions import supabase_client
from app.shared.audit import log_audit

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# List / Search
# ---------------------------------------------------------------------------

def get_customers(
    org_id: str,
    search: str | None = None,
    tags: list[str] | None = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """List customers with optional search (name/email/phone) and tag filter."""
    query = (
        supabase_client.table("customers")
        .select(
            "id, org_id, first_name, last_name, email, phone, notes, tags, "
            "total_visits, total_spent, average_check, last_visit_at, "
            "marketing_opt_in, birthday, anniversary, created_at, updated_at",
            count="exact",
        )
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
    )

    if search:
        # Case-insensitive partial match on name, email, or phone
        search_lower = search.strip().lower()
        query = query.or_(
            f"first_name.ilike.%{search_lower}%,"
            f"last_name.ilike.%{search_lower}%,"
            f"email.ilike.%{search_lower}%,"
            f"phone.ilike.%{search_lower}%"
        )

    if tags:
        query = query.contains("tags", tags)

    offset = (page - 1) * per_page
    query = query.order("last_name").order("first_name").range(offset, offset + per_page - 1)

    resp = query.execute()
    customers = resp.data or []
    total = resp.count or 0

    return customers, total


# ---------------------------------------------------------------------------
# Get Single
# ---------------------------------------------------------------------------

def get_customer(org_id: str, customer_id: str) -> dict[str, Any] | None:
    """Get customer with addresses and summary stats."""
    resp = (
        supabase_client.table("customers")
        .select(
            "id, org_id, first_name, last_name, email, phone, notes, tags, "
            "total_visits, total_spent, average_check, last_visit_at, "
            "marketing_opt_in, birthday, anniversary, created_at, updated_at"
        )
        .eq("org_id", org_id)
        .eq("id", customer_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    customer = resp.data
    if not customer:
        return None

    # Fetch addresses
    addr_resp = (
        supabase_client.table("customer_addresses")
        .select("id, label, line1, line2, city, state, zip, is_default, created_at")
        .eq("customer_id", customer_id)
        .order("is_default", desc=True)
        .order("created_at")
        .execute()
    )
    customer["addresses"] = addr_resp.data or []

    # Order history summary: count and total from closed orders
    order_summary_resp = (
        supabase_client.table("orders")
        .select("id, total", count="exact")
        .eq("org_id", org_id)
        .eq("customer_id", customer_id)
        .eq("status", "closed")
        .execute()
    )
    order_rows = order_summary_resp.data or []
    customer["order_count"] = order_summary_resp.count or 0
    customer["order_total_cents"] = sum(
        int(round(float(o.get("total", 0)) * 100)) for o in order_rows
    )

    return customer


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def create_customer(org_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new customer. Validates email uniqueness within org."""
    email = (data.get("email") or "").strip().lower() or None
    phone = (data.get("phone") or "").strip() or None

    # Check email uniqueness within org
    if email:
        dup_resp = (
            supabase_client.table("customers")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .ilike("email", email)
            .is_("deleted_at", "null")
            .execute()
        )
        if (dup_resp.count or 0) > 0:
            raise ValueError(f"A customer with email '{email}' already exists")

    row: dict[str, Any] = {
        "org_id": org_id,
        "first_name": (data.get("first_name") or "").strip() or None,
        "last_name": (data.get("last_name") or "").strip() or None,
        "email": email,
        "phone": phone,
        "notes": (data.get("notes") or "").strip() or None,
        "tags": data.get("tags") or [],
        "birthday": data.get("birthday") or None,
        "anniversary": data.get("anniversary") or None,
        "marketing_opt_in": bool(data.get("marketing_opt_in", False)),
    }

    resp = supabase_client.table("customers").insert(row).execute()
    return resp.data[0]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def update_customer(
    org_id: str,
    customer_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    """Update customer fields. Returns updated customer or None if not found."""
    # Verify customer exists in this org
    existing = (
        supabase_client.table("customers")
        .select("id, email")
        .eq("org_id", org_id)
        .eq("id", customer_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not existing.data:
        return None

    allowed_fields = {
        "first_name", "last_name", "email", "phone", "notes", "tags",
        "birthday", "anniversary", "marketing_opt_in",
    }
    updates: dict[str, Any] = {}
    for key in allowed_fields:
        if key in data:
            val = data[key]
            if isinstance(val, str):
                val = val.strip() or None
            updates[key] = val

    # If email is being changed, check uniqueness
    new_email = updates.get("email")
    if new_email and new_email.lower() != (existing.data.get("email") or "").lower():
        dup_resp = (
            supabase_client.table("customers")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .ilike("email", new_email.lower())
            .is_("deleted_at", "null")
            .neq("id", customer_id)
            .execute()
        )
        if (dup_resp.count or 0) > 0:
            raise ValueError(f"A customer with email '{new_email}' already exists")
        updates["email"] = new_email.lower()

    if not updates:
        return get_customer(org_id, customer_id)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = (
        supabase_client.table("customers")
        .update(updates)
        .eq("org_id", org_id)
        .eq("id", customer_id)
        .execute()
    )
    if not resp.data:
        return None

    return get_customer(org_id, customer_id)


# ---------------------------------------------------------------------------
# Soft Delete
# ---------------------------------------------------------------------------

def delete_customer(org_id: str, customer_id: str) -> bool:
    """Soft-delete a customer by setting deleted_at."""
    existing = (
        supabase_client.table("customers")
        .select("id")
        .eq("org_id", org_id)
        .eq("id", customer_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not existing.data:
        return False

    supabase_client.table("customers").update({
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", customer_id).execute()

    return True


# ---------------------------------------------------------------------------
# Order History
# ---------------------------------------------------------------------------

def get_customer_orders(
    org_id: str,
    customer_id: str,
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[dict[str, Any]], int]:
    """Get paginated order history for a customer."""
    offset = (page - 1) * per_page

    resp = (
        supabase_client.table("orders")
        .select(
            "id, order_number, display_number, order_type, status, subtotal, "
            "discount_total, tax_total, tip_total, total, guest_count, "
            "created_at, updated_at",
            count="exact",
        )
        .eq("org_id", org_id)
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    orders = resp.data or []
    total = resp.count or 0
    return orders, total


# ---------------------------------------------------------------------------
# Loyalty
# ---------------------------------------------------------------------------

def get_customer_loyalty(org_id: str, customer_id: str) -> dict[str, Any] | None:
    """Get loyalty account for a customer, if one exists."""
    resp = (
        supabase_client.table("loyalty_accounts")
        .select(
            "id, program_id, points_balance, lifetime_points, tier, "
            "enrolled_at, last_activity_at, created_at"
        )
        .eq("org_id", org_id)
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    accounts = resp.data or []
    if not accounts:
        return None

    account = accounts[0]

    # Fetch the program name
    prog_resp = (
        supabase_client.table("loyalty_programs")
        .select("id, name, program_type, points_per_dollar, redemption_threshold, reward_value")
        .eq("id", account["program_id"])
        .single()
        .execute()
    )
    account["program"] = prog_resp.data

    # Recent transactions
    txn_resp = (
        supabase_client.table("loyalty_transactions")
        .select("id, transaction_type, points, balance_after, description, created_at")
        .eq("loyalty_account_id", account["id"])
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    account["recent_transactions"] = txn_resp.data or []

    return account


# ---------------------------------------------------------------------------
# Quick Lookup (POS Checkout)
# ---------------------------------------------------------------------------

def lookup_customer(
    org_id: str,
    phone: str | None = None,
    email: str | None = None,
) -> dict[str, Any] | None:
    """Quick lookup by phone or email for POS checkout. Returns basic info + loyalty points."""
    if not phone and not email:
        return None

    query = (
        supabase_client.table("customers")
        .select("id, first_name, last_name, email, phone, tags, total_visits, total_spent")
        .eq("org_id", org_id)
        .is_("deleted_at", "null")
    )

    if phone:
        cleaned = phone.strip().replace("-", "").replace("(", "").replace(")", "").replace(" ", "")
        query = query.ilike("phone", f"%{cleaned}%")
    elif email:
        query = query.ilike("email", email.strip().lower())

    query = query.limit(5)
    resp = query.execute()
    customers = resp.data or []

    if not customers:
        return None

    # Return the first (best) match, attach loyalty info
    customer = customers[0]

    loyalty_resp = (
        supabase_client.table("loyalty_accounts")
        .select("points_balance, tier")
        .eq("org_id", org_id)
        .eq("customer_id", customer["id"])
        .limit(1)
        .execute()
    )
    loyalty_data = loyalty_resp.data
    if loyalty_data:
        customer["loyalty_points"] = loyalty_data[0]["points_balance"]
        customer["loyalty_tier"] = loyalty_data[0]["tier"]
    else:
        customer["loyalty_points"] = None
        customer["loyalty_tier"] = None

    # Return all matches for disambiguation
    result = {
        "best_match": customer,
        "all_matches": customers,
    }
    return result


# ---------------------------------------------------------------------------
# Merge Customers
# ---------------------------------------------------------------------------

def merge_customers(
    org_id: str,
    primary_id: str,
    duplicate_id: str,
    merged_by_user_id: str = "",
    merged_by_name: str = "",
    merged_by_role: str = "",
) -> dict[str, Any]:
    """
    Merge duplicate customer into primary. Moves all orders, addresses,
    and loyalty data to primary. Soft-deletes the duplicate.
    """
    # Verify both exist in this org
    primary_resp = (
        supabase_client.table("customers")
        .select("*")
        .eq("org_id", org_id)
        .eq("id", primary_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not primary_resp.data:
        raise ValueError(f"Primary customer {primary_id} not found")

    dup_resp = (
        supabase_client.table("customers")
        .select("*")
        .eq("org_id", org_id)
        .eq("id", duplicate_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not dup_resp.data:
        raise ValueError(f"Duplicate customer {duplicate_id} not found")

    if primary_id == duplicate_id:
        raise ValueError("Cannot merge a customer with itself")

    primary = primary_resp.data
    duplicate = dup_resp.data
    now = datetime.now(timezone.utc).isoformat()

    # 1. Move orders from duplicate to primary
    supabase_client.table("orders").update({
        "customer_id": primary_id,
        "updated_at": now,
    }).eq("customer_id", duplicate_id).eq("org_id", org_id).execute()

    # 2. Move addresses from duplicate to primary
    supabase_client.table("customer_addresses").update({
        "customer_id": primary_id,
        "is_default": False,  # Don't override primary's default
        "updated_at": now,
    }).eq("customer_id", duplicate_id).execute()

    # 3. Move loyalty accounts (merge points if both have accounts for same program)
    dup_loyalty_resp = (
        supabase_client.table("loyalty_accounts")
        .select("*")
        .eq("customer_id", duplicate_id)
        .execute()
    )
    for dup_acct in (dup_loyalty_resp.data or []):
        # Check if primary already has an account for this program
        primary_acct_resp = (
            supabase_client.table("loyalty_accounts")
            .select("id, points_balance, lifetime_points")
            .eq("customer_id", primary_id)
            .eq("program_id", dup_acct["program_id"])
            .limit(1)
            .execute()
        )
        if primary_acct_resp.data:
            # Merge points into primary's account
            pa = primary_acct_resp.data[0]
            new_balance = pa["points_balance"] + dup_acct["points_balance"]
            new_lifetime = pa["lifetime_points"] + dup_acct["lifetime_points"]
            supabase_client.table("loyalty_accounts").update({
                "points_balance": new_balance,
                "lifetime_points": new_lifetime,
                "updated_at": now,
            }).eq("id", pa["id"]).execute()

            # Move loyalty transactions to primary account
            supabase_client.table("loyalty_transactions").update({
                "loyalty_account_id": pa["id"],
            }).eq("loyalty_account_id", dup_acct["id"]).execute()

            # Delete the duplicate loyalty account
            supabase_client.table("loyalty_accounts").delete().eq(
                "id", dup_acct["id"]
            ).execute()
        else:
            # No conflict, just reassign
            supabase_client.table("loyalty_accounts").update({
                "customer_id": primary_id,
                "updated_at": now,
            }).eq("id", dup_acct["id"]).execute()

    # 4. Merge stats: combine totals
    combined_visits = (primary.get("total_visits") or 0) + (duplicate.get("total_visits") or 0)
    combined_spent = float(primary.get("total_spent") or 0) + float(duplicate.get("total_spent") or 0)
    combined_avg = round(combined_spent / combined_visits, 2) if combined_visits > 0 else 0

    primary_last = primary.get("last_visit_at")
    dup_last = duplicate.get("last_visit_at")
    if primary_last and dup_last:
        last_visit = max(primary_last, dup_last)
    else:
        last_visit = primary_last or dup_last

    # Fill in missing fields from duplicate
    updates: dict[str, Any] = {
        "total_visits": combined_visits,
        "total_spent": combined_spent,
        "average_check": combined_avg,
        "last_visit_at": last_visit,
        "updated_at": now,
    }
    if not primary.get("email") and duplicate.get("email"):
        updates["email"] = duplicate["email"]
    if not primary.get("phone") and duplicate.get("phone"):
        updates["phone"] = duplicate["phone"]
    if not primary.get("birthday") and duplicate.get("birthday"):
        updates["birthday"] = duplicate["birthday"]
    if not primary.get("anniversary") and duplicate.get("anniversary"):
        updates["anniversary"] = duplicate["anniversary"]
    if not primary.get("notes") and duplicate.get("notes"):
        updates["notes"] = duplicate["notes"]

    # Merge tags (union)
    primary_tags = set(primary.get("tags") or [])
    dup_tags = set(duplicate.get("tags") or [])
    merged_tags = sorted(primary_tags | dup_tags)
    updates["tags"] = merged_tags

    supabase_client.table("customers").update(updates).eq("id", primary_id).execute()

    # 5. Soft-delete the duplicate
    supabase_client.table("customers").update({
        "deleted_at": now,
        "updated_at": now,
        "notes": f"[MERGED into {primary_id}] {duplicate.get('notes') or ''}".strip(),
    }).eq("id", duplicate_id).execute()

    # 6. Audit trail
    log_audit(
        org_id=org_id,
        user_id=merged_by_user_id,
        user_name=merged_by_name,
        user_role=merged_by_role,
        action="customer.merged",
        entity_type="customer",
        entity_id=primary_id,
        description=f"Merged customer {duplicate_id} into {primary_id}",
        previous_state={
            "primary": primary,
            "duplicate": duplicate,
        },
        new_state={"merged_tags": merged_tags, "combined_visits": combined_visits},
    )

    log.info(
        "customer.merged",
        org_id=org_id,
        primary_id=primary_id,
        duplicate_id=duplicate_id,
    )

    return get_customer(org_id, primary_id)


# ---------------------------------------------------------------------------
# Update Stats (async recalculation)
# ---------------------------------------------------------------------------

def update_customer_stats(org_id: str, customer_id: str) -> dict[str, Any] | None:
    """Recalculate visit_count, total_spend, avg_check, last_visit from orders."""
    # Verify customer exists
    cust_resp = (
        supabase_client.table("customers")
        .select("id")
        .eq("org_id", org_id)
        .eq("id", customer_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not cust_resp.data:
        return None

    # Aggregate from closed orders
    orders_resp = (
        supabase_client.table("orders")
        .select("id, total, created_at")
        .eq("org_id", org_id)
        .eq("customer_id", customer_id)
        .eq("status", "closed")
        .order("created_at", desc=True)
        .execute()
    )
    orders = orders_resp.data or []

    total_visits = len(orders)
    total_spent = sum(float(o.get("total", 0)) for o in orders)
    avg_check = round(total_spent / total_visits, 2) if total_visits > 0 else 0
    last_visit = orders[0]["created_at"] if orders else None

    updates = {
        "total_visits": total_visits,
        "total_spent": total_spent,
        "average_check": avg_check,
        "last_visit_at": last_visit,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase_client.table("customers").update(updates).eq("id", customer_id).execute()

    return updates
