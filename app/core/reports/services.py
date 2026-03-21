"""Reports business logic — sales, product mix, labor, tips, payments, tax, exports."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone
from typing import Any

import structlog

from app.extensions import supabase_client
from app.shared.cache import cache_get, cache_set

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Daily Sales
# ---------------------------------------------------------------------------

def get_daily_report(
    org_id: str,
    location_id: str,
    report_date: str | None = None,
) -> dict[str, Any]:
    """Daily sales summary: gross/net, by payment type, by category, by daypart.

    Tries pre-aggregated daily_metrics first, falls back to live queries.
    """
    target_date = report_date or date.today().isoformat()

    # Try cache
    cache_key = f"daily_report:{location_id}:{target_date}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Try daily_metrics table (pre-aggregated)
    metrics = _get_daily_metrics(org_id, location_id, target_date)
    if metrics:
        result = _format_daily_metrics(metrics, target_date, location_id)
        cache_set(cache_key, result, ttl=600)
        return result

    # Fall back to live query
    result = _build_daily_report_live(org_id, location_id, target_date)
    cache_set(cache_key, result, ttl=300)
    return result


def get_weekly_report(
    org_id: str,
    location_id: str,
    week_start: str | None = None,
) -> dict[str, Any]:
    """Weekly sales summary. Aggregates daily reports for 7 days."""
    if week_start:
        start = date.fromisoformat(week_start)
    else:
        today = date.today()
        start = today - timedelta(days=today.weekday())  # Monday

    end = start + timedelta(days=6)

    daily_reports = []
    current = start
    totals = _empty_totals()

    while current <= end:
        day_report = get_daily_report(org_id, location_id, current.isoformat())
        daily_reports.append(day_report)
        _accumulate_totals(totals, day_report)
        current += timedelta(days=1)

    return {
        "report_type": "weekly",
        "location_id": location_id,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily_breakdown": daily_reports,
        "totals": totals,
    }


def get_monthly_report(
    org_id: str,
    location_id: str,
    year: int | None = None,
    month: int | None = None,
) -> dict[str, Any]:
    """Monthly sales summary."""
    today = date.today()
    y = year or today.year
    m = month or today.month

    start = date(y, m, 1)
    if m == 12:
        end = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(y, m + 1, 1) - timedelta(days=1)

    # Query daily_metrics for the whole month
    metrics_resp = (
        supabase_client.table("daily_metrics")
        .select("*")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("metric_date", start.isoformat())
        .lte("metric_date", end.isoformat())
        .order("metric_date")
        .execute()
    )
    rows = metrics_resp.data or []

    totals = _empty_totals()
    daily_summaries = []

    for row in rows:
        day_data = _format_daily_metrics(row, row["metric_date"], location_id)
        daily_summaries.append(day_data)
        _accumulate_totals(totals, day_data)

    # If no pre-aggregated data, fall back to live queries
    if not rows:
        current = start
        while current <= end:
            day_report = get_daily_report(org_id, location_id, current.isoformat())
            daily_summaries.append(day_report)
            _accumulate_totals(totals, day_report)
            current += timedelta(days=1)

    return {
        "report_type": "monthly",
        "location_id": location_id,
        "year": y,
        "month": m,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days_count": len(daily_summaries),
        "daily_breakdown": daily_summaries,
        "totals": totals,
    }


def get_custom_report(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    """Custom date range sales report."""
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)

    if end < start:
        raise ValueError("end_date must be after start_date")
    if (end - start).days > 365:
        raise ValueError("Date range cannot exceed 365 days")

    daily_reports = []
    totals = _empty_totals()
    current = start

    while current <= end:
        day_report = get_daily_report(org_id, location_id, current.isoformat())
        daily_reports.append(day_report)
        _accumulate_totals(totals, day_report)
        current += timedelta(days=1)

    return {
        "report_type": "custom",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end_date,
        "days_count": len(daily_reports),
        "daily_breakdown": daily_reports,
        "totals": totals,
    }


def get_hourly_report(
    org_id: str,
    location_id: str,
    report_date: str | None = None,
) -> dict[str, Any]:
    """Hourly sales breakdown for a date (heatmap data)."""
    target_date = report_date or date.today().isoformat()

    # Try daily_metrics first (has hourly_revenue/hourly_covers)
    metrics = _get_daily_metrics(org_id, location_id, target_date)
    if metrics and metrics.get("hourly_revenue"):
        hourly_revenue = metrics.get("hourly_revenue") or {}
        hourly_covers = metrics.get("hourly_covers") or {}
    else:
        # Live query
        hourly_revenue, hourly_covers = _build_hourly_data_live(
            org_id, location_id, target_date
        )

    hours = []
    for h in range(24):
        hour_str = str(h)
        rev = float(hourly_revenue.get(hour_str, 0))
        covers = int(hourly_covers.get(hour_str, 0))
        hours.append({
            "hour": h,
            "label": f"{h:02d}:00",
            "revenue": round(rev, 2),
            "covers": covers,
            "avg_check": round(rev / covers, 2) if covers > 0 else 0,
        })

    return {
        "report_type": "hourly",
        "location_id": location_id,
        "date": target_date,
        "hours": hours,
        "peak_hour": max(hours, key=lambda x: x["revenue"]),
    }


# ---------------------------------------------------------------------------
# Product & Category Mix
# ---------------------------------------------------------------------------

def get_product_mix(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Product mix report with menu engineering matrix classification.

    Categorizes each item as Star/Plowhorse/Puzzle/Dog based on
    popularity (quantity) and profitability (margin).
    """
    end = end_date or start_date

    # Try daily_item_metrics
    item_resp = (
        supabase_client.table("daily_item_metrics")
        .select("menu_item_id, quantity_sold, gross_revenue, food_cost, margin_percentage, "
                "menu_items(name, category_id, price, cost)")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("metric_date", start_date)
        .lte("metric_date", end)
        .execute()
    )
    rows = item_resp.data or []

    if not rows:
        # Fall back to live query from order_items
        rows = _build_product_mix_live(org_id, location_id, start_date, end)

    # Aggregate by item
    items: dict[str, dict] = {}
    for row in rows:
        mid = row.get("menu_item_id")
        if mid not in items:
            menu_item = row.get("menu_items") or {}
            items[mid] = {
                "menu_item_id": mid,
                "name": menu_item.get("name", "Unknown"),
                "category_id": menu_item.get("category_id"),
                "price": float(menu_item.get("price") or 0),
                "cost": float(menu_item.get("cost") or 0),
                "quantity_sold": 0,
                "gross_revenue": 0.0,
                "food_cost": 0.0,
            }
        items[mid]["quantity_sold"] += int(row.get("quantity_sold") or 0)
        items[mid]["gross_revenue"] += float(row.get("gross_revenue") or 0)
        items[mid]["food_cost"] += float(row.get("food_cost") or 0)

    # Calculate metrics and classify
    total_quantity = sum(i["quantity_sold"] for i in items.values())
    total_revenue = sum(i["gross_revenue"] for i in items.values())
    avg_quantity = total_quantity / len(items) if items else 0
    avg_margin = 0.0

    item_list = list(items.values())
    for item in item_list:
        rev = item["gross_revenue"]
        cost = item["food_cost"]
        profit = rev - cost
        item["profit"] = round(profit, 2)
        item["food_cost_pct"] = round((cost / rev * 100) if rev > 0 else 0, 1)
        item["margin_pct"] = round((profit / rev * 100) if rev > 0 else 0, 1)
        item["revenue_pct"] = round((rev / total_revenue * 100) if total_revenue > 0 else 0, 1)
        item["quantity_pct"] = round((item["quantity_sold"] / total_quantity * 100) if total_quantity > 0 else 0, 1)
        item["gross_revenue"] = round(rev, 2)
        item["food_cost"] = round(cost, 2)

    if item_list:
        avg_margin = sum(i["margin_pct"] for i in item_list) / len(item_list)

    # Menu engineering matrix classification
    for item in item_list:
        high_pop = item["quantity_sold"] >= avg_quantity
        high_profit = item["margin_pct"] >= avg_margin
        if high_pop and high_profit:
            item["classification"] = "Star"
        elif high_pop and not high_profit:
            item["classification"] = "Plowhorse"
        elif not high_pop and high_profit:
            item["classification"] = "Puzzle"
        else:
            item["classification"] = "Dog"

    # Sort by revenue descending
    item_list.sort(key=lambda x: x["gross_revenue"], reverse=True)

    return {
        "report_type": "product_mix",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "total_items": len(item_list),
        "total_quantity": total_quantity,
        "total_revenue": round(total_revenue, 2),
        "items": item_list,
    }


def get_category_mix(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Sales breakdown by category."""
    end = end_date or start_date

    # Query orders with items grouped by category
    orders_resp = (
        supabase_client.table("order_items")
        .select("menu_item_id, quantity, line_total, "
                "menu_items!order_items_menu_item_id_fkey(category_id, "
                "menu_categories!menu_items_category_id_fkey(name))")
        .eq("org_id", org_id)
        .gte("created_at", f"{start_date}T00:00:00Z")
        .lte("created_at", f"{end}T23:59:59Z")
        .execute()
    )

    categories: dict[str, dict] = {}
    total_revenue = 0.0

    for item in (orders_resp.data or []):
        menu_item = item.get("menu_items") or {}
        cat_id = menu_item.get("category_id", "uncategorized")
        cat_info = menu_item.get("menu_categories") or {}
        cat_name = cat_info.get("name", "Uncategorized")
        rev = float(item.get("line_total") or 0)
        qty = int(item.get("quantity") or 0)

        if cat_id not in categories:
            categories[cat_id] = {
                "category_id": cat_id,
                "category_name": cat_name,
                "quantity_sold": 0,
                "revenue": 0.0,
                "item_count": 0,
            }

        categories[cat_id]["quantity_sold"] += qty
        categories[cat_id]["revenue"] += rev
        categories[cat_id]["item_count"] += 1
        total_revenue += rev

    cat_list = list(categories.values())
    for cat in cat_list:
        cat["revenue"] = round(cat["revenue"], 2)
        cat["revenue_pct"] = round(
            (cat["revenue"] / total_revenue * 100) if total_revenue > 0 else 0, 1
        )

    cat_list.sort(key=lambda x: x["revenue"], reverse=True)

    return {
        "report_type": "category_mix",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "total_revenue": round(total_revenue, 2),
        "categories": cat_list,
    }


# ---------------------------------------------------------------------------
# Server Performance
# ---------------------------------------------------------------------------

def get_server_performance(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Per-server performance: checks, avg check, covers, sales, tips, voids, comps."""
    end = end_date or start_date

    # Orders by server
    orders_resp = (
        supabase_client.table("orders")
        .select("id, server_id, subtotal, discount_total, tip_total, total, "
                "guest_count, status, "
                "users!orders_server_id_fkey(first_name, last_name, display_name)")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("opened_at", f"{start_date}T00:00:00Z")
        .lte("opened_at", f"{end}T23:59:59Z")
        .in_("status", ["closed"])
        .execute()
    )

    servers: dict[str, dict] = {}
    for order in (orders_resp.data or []):
        sid = order.get("server_id")
        if not sid:
            continue
        user_info = order.get("users") or {}

        if sid not in servers:
            servers[sid] = {
                "user_id": sid,
                "display_name": user_info.get("display_name") or
                    f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}",
                "checks": 0,
                "covers": 0,
                "gross_sales": 0.0,
                "net_sales": 0.0,
                "tips": 0.0,
                "discounts": 0.0,
                "voids": 0,
                "comps": 0.0,
            }

        s = servers[sid]
        s["checks"] += 1
        s["covers"] += int(order.get("guest_count") or 0)
        s["gross_sales"] += float(order.get("subtotal") or 0)
        s["net_sales"] += float(order.get("total") or 0)
        s["tips"] += float(order.get("tip_total") or 0)
        s["discounts"] += float(order.get("discount_total") or 0)

    # Get void counts per server
    void_resp = (
        supabase_client.table("orders")
        .select("server_id")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("status", "voided")
        .gte("opened_at", f"{start_date}T00:00:00Z")
        .lte("opened_at", f"{end}T23:59:59Z")
        .execute()
    )
    for v in (void_resp.data or []):
        sid = v.get("server_id")
        if sid and sid in servers:
            servers[sid]["voids"] += 1

    server_list = list(servers.values())
    for s in server_list:
        s["gross_sales"] = round(s["gross_sales"], 2)
        s["net_sales"] = round(s["net_sales"], 2)
        s["tips"] = round(s["tips"], 2)
        s["discounts"] = round(s["discounts"], 2)
        s["comps"] = round(s["comps"], 2)
        s["avg_check"] = round(s["net_sales"] / s["checks"], 2) if s["checks"] > 0 else 0
        s["avg_covers_per_check"] = round(s["covers"] / s["checks"], 1) if s["checks"] > 0 else 0
        s["tip_pct"] = round((s["tips"] / s["net_sales"] * 100) if s["net_sales"] > 0 else 0, 1)

    server_list.sort(key=lambda x: x["net_sales"], reverse=True)

    return {
        "report_type": "server_performance",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "servers": server_list,
    }


# ---------------------------------------------------------------------------
# Labor
# ---------------------------------------------------------------------------

def get_labor_report(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Labor report: hours, cost, labor %, overtime, by role."""
    end = end_date or start_date

    entries_resp = (
        supabase_client.table("time_entries")
        .select("user_id, role_during_shift, hourly_rate, regular_hours, "
                "overtime_hours, total_pay, clock_in, clock_out")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("clock_in", f"{start_date}T00:00:00Z")
        .lte("clock_in", f"{end}T23:59:59Z")
        .not_.is_("clock_out", "null")
        .execute()
    )
    entries = entries_resp.data or []

    # Get total sales for labor % calculation
    sales_resp = (
        supabase_client.table("orders")
        .select("total")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("opened_at", f"{start_date}T00:00:00Z")
        .lte("opened_at", f"{end}T23:59:59Z")
        .in_("status", ["closed"])
        .execute()
    )
    total_sales = sum(float(o.get("total") or 0) for o in (sales_resp.data or []))

    # Aggregate by role
    roles: dict[str, dict] = {}
    total_hours = 0.0
    total_ot_hours = 0.0
    total_cost = 0.0

    for e in entries:
        role = e.get("role_during_shift") or "unknown"
        reg = float(e.get("regular_hours") or 0)
        ot = float(e.get("overtime_hours") or 0)
        pay = float(e.get("total_pay") or 0)

        if role not in roles:
            roles[role] = {
                "role": role,
                "employee_count": set(),
                "regular_hours": 0.0,
                "overtime_hours": 0.0,
                "total_hours": 0.0,
                "labor_cost": 0.0,
            }

        roles[role]["employee_count"].add(e["user_id"])
        roles[role]["regular_hours"] += reg
        roles[role]["overtime_hours"] += ot
        roles[role]["total_hours"] += reg + ot
        roles[role]["labor_cost"] += pay

        total_hours += reg + ot
        total_ot_hours += ot
        total_cost += pay

    role_list = []
    for r in roles.values():
        r["employee_count"] = len(r["employee_count"])
        r["regular_hours"] = round(r["regular_hours"], 2)
        r["overtime_hours"] = round(r["overtime_hours"], 2)
        r["total_hours"] = round(r["total_hours"], 2)
        r["labor_cost"] = round(r["labor_cost"], 2)
        r["labor_pct"] = round((r["labor_cost"] / total_sales * 100) if total_sales > 0 else 0, 1)
        role_list.append(r)

    role_list.sort(key=lambda x: x["labor_cost"], reverse=True)

    return {
        "report_type": "labor",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "total_sales": round(total_sales, 2),
        "total_labor_cost": round(total_cost, 2),
        "total_hours": round(total_hours, 2),
        "total_overtime_hours": round(total_ot_hours, 2),
        "labor_pct": round((total_cost / total_sales * 100) if total_sales > 0 else 0, 1),
        "by_role": role_list,
    }


# ---------------------------------------------------------------------------
# Discounts / Comps / Voids
# ---------------------------------------------------------------------------

def get_discount_report(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Discount, comp, and void summary."""
    end = end_date or start_date

    # Discounts
    disc_resp = (
        supabase_client.table("order_discounts")
        .select("name, discount_type, value, applied_amount, "
                "applied_by, approved_by, created_at, "
                "orders!order_discounts_order_id_fkey(location_id, opened_at)")
        .gte("created_at", f"{start_date}T00:00:00Z")
        .lte("created_at", f"{end}T23:59:59Z")
        .execute()
    )

    discounts_by_name: dict[str, dict] = {}
    total_discount = 0.0

    for d in (disc_resp.data or []):
        order_info = d.get("orders") or {}
        if order_info.get("location_id") != location_id:
            continue
        name = d.get("name", "Unknown")
        amount = float(d.get("applied_amount") or 0)
        if name not in discounts_by_name:
            discounts_by_name[name] = {
                "name": name,
                "count": 0,
                "total_amount": 0.0,
            }
        discounts_by_name[name]["count"] += 1
        discounts_by_name[name]["total_amount"] += amount
        total_discount += amount

    disc_list = list(discounts_by_name.values())
    for d in disc_list:
        d["total_amount"] = round(d["total_amount"], 2)
    disc_list.sort(key=lambda x: x["total_amount"], reverse=True)

    # Voided orders
    void_resp = (
        supabase_client.table("orders")
        .select("id, total, server_id")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("status", "voided")
        .gte("opened_at", f"{start_date}T00:00:00Z")
        .lte("opened_at", f"{end}T23:59:59Z")
        .execute()
    )
    void_count = len(void_resp.data or [])
    void_total = sum(float(v.get("total") or 0) for v in (void_resp.data or []))

    return {
        "report_type": "discounts",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "discounts": {
            "items": disc_list,
            "total_count": sum(d["count"] for d in disc_list),
            "total_amount": round(total_discount, 2),
        },
        "voids": {
            "count": void_count,
            "total_amount": round(void_total, 2),
        },
    }


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

def get_payment_report(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Payment summary by method and card brand."""
    end = end_date or start_date

    payments_resp = (
        supabase_client.table("payments")
        .select("payment_method, amount, tip_amount, total_amount, card_brand, "
                "status, "
                "orders!payments_order_id_fkey(location_id)")
        .eq("org_id", org_id)
        .eq("status", "captured")
        .gte("processed_at", f"{start_date}T00:00:00Z")
        .lte("processed_at", f"{end}T23:59:59Z")
        .execute()
    )

    by_method: dict[str, dict] = {}
    by_card_brand: dict[str, dict] = {}
    total_amount = 0.0
    total_tips = 0.0

    for p in (payments_resp.data or []):
        order = p.get("orders") or {}
        if order.get("location_id") != location_id:
            continue

        method = p.get("payment_method", "other")
        amount = float(p.get("total_amount") or 0)
        tips = float(p.get("tip_amount") or 0)

        if method not in by_method:
            by_method[method] = {
                "method": method,
                "count": 0,
                "amount": 0.0,
                "tips": 0.0,
            }
        by_method[method]["count"] += 1
        by_method[method]["amount"] += amount
        by_method[method]["tips"] += tips

        # Card brand breakdown
        if p.get("card_brand"):
            brand = p["card_brand"]
            if brand not in by_card_brand:
                by_card_brand[brand] = {
                    "brand": brand,
                    "count": 0,
                    "amount": 0.0,
                }
            by_card_brand[brand]["count"] += 1
            by_card_brand[brand]["amount"] += amount

        total_amount += amount
        total_tips += tips

    method_list = list(by_method.values())
    for m in method_list:
        m["amount"] = round(m["amount"], 2)
        m["tips"] = round(m["tips"], 2)
        m["pct"] = round((m["amount"] / total_amount * 100) if total_amount > 0 else 0, 1)

    brand_list = list(by_card_brand.values())
    for b in brand_list:
        b["amount"] = round(b["amount"], 2)

    method_list.sort(key=lambda x: x["amount"], reverse=True)
    brand_list.sort(key=lambda x: x["amount"], reverse=True)

    return {
        "report_type": "payments",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "total_amount": round(total_amount, 2),
        "total_tips": round(total_tips, 2),
        "by_method": method_list,
        "by_card_brand": brand_list,
    }


# ---------------------------------------------------------------------------
# Tax
# ---------------------------------------------------------------------------

def get_tax_report(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Tax collected breakdown by rate."""
    end = end_date or start_date

    # Get tax totals from orders
    orders_resp = (
        supabase_client.table("orders")
        .select("id, tax_total, subtotal, total")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .in_("status", ["closed"])
        .gte("opened_at", f"{start_date}T00:00:00Z")
        .lte("opened_at", f"{end}T23:59:59Z")
        .execute()
    )

    total_taxable_sales = 0.0
    total_tax_collected = 0.0
    order_count = 0

    for o in (orders_resp.data or []):
        total_taxable_sales += float(o.get("subtotal") or 0)
        total_tax_collected += float(o.get("tax_total") or 0)
        order_count += 1

    # Get tax rates for context
    rates_resp = (
        supabase_client.table("tax_rates")
        .select("id, name, rate, is_inclusive, applies_to")
        .eq("org_id", org_id)
        .eq("is_active", True)
        .or_(f"location_id.is.null,location_id.eq.{location_id}")
        .execute()
    )
    rates = []
    for r in (rates_resp.data or []):
        rate_val = float(r.get("rate") or 0)
        estimated_tax = round(total_taxable_sales * rate_val, 2)
        rates.append({
            "id": r["id"],
            "name": r["name"],
            "rate": rate_val,
            "rate_pct": round(rate_val * 100, 2),
            "is_inclusive": r.get("is_inclusive", False),
            "applies_to": r.get("applies_to", []),
            "estimated_amount": estimated_tax,
        })

    return {
        "report_type": "tax",
        "location_id": location_id,
        "start_date": start_date,
        "end_date": end,
        "total_taxable_sales": round(total_taxable_sales, 2),
        "total_tax_collected": round(total_tax_collected, 2),
        "order_count": order_count,
        "effective_rate": round(
            (total_tax_collected / total_taxable_sales * 100) if total_taxable_sales > 0 else 0, 2
        ),
        "rates": rates,
    }


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_report(
    org_id: str,
    location_id: str,
    report_type: str,
    start_date: str,
    end_date: str | None = None,
    extra_params: dict[str, Any] | None = None,
) -> tuple[str, str]:
    """Export any report as CSV. Returns (csv_string, filename)."""
    params = extra_params or {}

    # Generate the report data
    report_generators = {
        "daily": lambda: get_daily_report(org_id, location_id, start_date),
        "weekly": lambda: get_weekly_report(org_id, location_id, start_date),
        "monthly": lambda: get_monthly_report(org_id, location_id,
                                               int(params.get("year", 0)) or None,
                                               int(params.get("month", 0)) or None),
        "custom": lambda: get_custom_report(org_id, location_id, start_date, end_date or start_date),
        "hourly": lambda: get_hourly_report(org_id, location_id, start_date),
        "product_mix": lambda: get_product_mix(org_id, location_id, start_date, end_date),
        "category_mix": lambda: get_category_mix(org_id, location_id, start_date, end_date),
        "server_performance": lambda: get_server_performance(org_id, location_id, start_date, end_date),
        "labor": lambda: get_labor_report(org_id, location_id, start_date, end_date),
        "discounts": lambda: get_discount_report(org_id, location_id, start_date, end_date),
        "payments": lambda: get_payment_report(org_id, location_id, start_date, end_date),
        "tax": lambda: get_tax_report(org_id, location_id, start_date, end_date),
    }

    generator = report_generators.get(report_type)
    if not generator:
        raise ValueError(f"Unknown report type: {report_type}")

    report_data = generator()
    csv_str = _report_to_csv(report_type, report_data)
    filename = f"{report_type}_{location_id}_{start_date}.csv"

    return csv_str, filename


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _get_daily_metrics(
    org_id: str,
    location_id: str,
    target_date: str,
) -> dict[str, Any] | None:
    """Fetch pre-aggregated daily metrics row."""
    resp = (
        supabase_client.table("daily_metrics")
        .select("*")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("metric_date", target_date)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def _format_daily_metrics(
    metrics: dict[str, Any],
    target_date: str,
    location_id: str,
) -> dict[str, Any]:
    """Format a daily_metrics row into the standard report shape."""
    return {
        "report_type": "daily",
        "location_id": location_id,
        "date": target_date,
        "gross_sales": float(metrics.get("total_revenue") or 0),
        "net_sales": float(metrics.get("net_revenue") or 0),
        "order_count": int(metrics.get("order_count") or 0),
        "avg_check": float(metrics.get("average_check") or 0),
        "covers": int(metrics.get("covers") or 0),
        "revenue_per_cover": float(metrics.get("revenue_per_cover") or 0),
        "by_type": {
            "dine_in": float(metrics.get("dine_in_revenue") or 0),
            "takeout": float(metrics.get("takeout_revenue") or 0),
            "delivery": float(metrics.get("delivery_revenue") or 0),
            "online": float(metrics.get("online_revenue") or 0),
        },
        "by_payment": {
            "cash": float(metrics.get("cash_total") or 0),
            "card": float(metrics.get("card_total") or 0),
            "gift_card": float(metrics.get("gift_card_total") or 0),
        },
        "labor": {
            "cost": float(metrics.get("labor_cost") or 0),
            "hours": float(metrics.get("labor_hours") or 0),
            "pct": float(metrics.get("labor_percentage") or 0),
        },
        "adjustments": {
            "discounts": float(metrics.get("discount_total") or 0),
            "comps": float(metrics.get("comp_total") or 0),
            "voids": float(metrics.get("void_total") or 0),
            "refunds": float(metrics.get("refund_total") or 0),
        },
        "tips": float(metrics.get("tip_total") or 0),
        "timing": {
            "avg_ticket_time_seconds": int(metrics.get("avg_ticket_time_seconds") or 0),
            "avg_table_turn_minutes": int(metrics.get("avg_table_turn_minutes") or 0),
        },
    }


def _build_daily_report_live(
    org_id: str,
    location_id: str,
    target_date: str,
) -> dict[str, Any]:
    """Build daily report from live order/payment data."""
    orders_resp = (
        supabase_client.table("orders")
        .select("id, order_type, subtotal, discount_total, tax_total, "
                "tip_total, total, guest_count, status, opened_at")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("opened_at", f"{target_date}T00:00:00Z")
        .lte("opened_at", f"{target_date}T23:59:59Z")
        .in_("status", ["closed"])
        .execute()
    )
    orders = orders_resp.data or []

    gross = 0.0
    net = 0.0
    covers = 0
    tips = 0.0
    discounts = 0.0
    by_type: dict[str, float] = {"dine_in": 0, "takeout": 0, "delivery": 0, "online": 0}

    for o in orders:
        gross += float(o.get("subtotal") or 0)
        net += float(o.get("total") or 0)
        covers += int(o.get("guest_count") or 0)
        tips += float(o.get("tip_total") or 0)
        discounts += float(o.get("discount_total") or 0)
        ot = o.get("order_type", "dine_in")
        if ot in by_type:
            by_type[ot] += float(o.get("total") or 0)

    # Payment breakdown
    payments_resp = (
        supabase_client.table("payments")
        .select("payment_method, total_amount, "
                "orders!payments_order_id_fkey(location_id, opened_at)")
        .eq("org_id", org_id)
        .eq("status", "captured")
        .gte("processed_at", f"{target_date}T00:00:00Z")
        .lte("processed_at", f"{target_date}T23:59:59Z")
        .execute()
    )
    cash_total = 0.0
    card_total = 0.0
    gift_total = 0.0
    for p in (payments_resp.data or []):
        order = p.get("orders") or {}
        if order.get("location_id") != location_id:
            continue
        amt = float(p.get("total_amount") or 0)
        method = p.get("payment_method", "")
        if method in ("cash",):
            cash_total += amt
        elif method in ("credit_card", "debit_card"):
            card_total += amt
        elif method == "gift_card":
            gift_total += amt
        else:
            card_total += amt  # Default to card

    # Void count
    void_resp = (
        supabase_client.table("orders")
        .select("total")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .eq("status", "voided")
        .gte("opened_at", f"{target_date}T00:00:00Z")
        .lte("opened_at", f"{target_date}T23:59:59Z")
        .execute()
    )
    void_total = sum(float(v.get("total") or 0) for v in (void_resp.data or []))

    order_count = len(orders)
    avg_check = round(net / order_count, 2) if order_count > 0 else 0
    rev_per_cover = round(net / covers, 2) if covers > 0 else 0

    return {
        "report_type": "daily",
        "location_id": location_id,
        "date": target_date,
        "gross_sales": round(gross, 2),
        "net_sales": round(net, 2),
        "order_count": order_count,
        "avg_check": avg_check,
        "covers": covers,
        "revenue_per_cover": rev_per_cover,
        "by_type": {k: round(v, 2) for k, v in by_type.items()},
        "by_payment": {
            "cash": round(cash_total, 2),
            "card": round(card_total, 2),
            "gift_card": round(gift_total, 2),
        },
        "labor": {"cost": 0, "hours": 0, "pct": 0},
        "adjustments": {
            "discounts": round(discounts, 2),
            "comps": 0,
            "voids": round(void_total, 2),
            "refunds": 0,
        },
        "tips": round(tips, 2),
        "timing": {"avg_ticket_time_seconds": 0, "avg_table_turn_minutes": 0},
    }


def _build_hourly_data_live(
    org_id: str,
    location_id: str,
    target_date: str,
) -> tuple[dict[str, float], dict[str, int]]:
    """Build hourly revenue/covers from live order data."""
    orders_resp = (
        supabase_client.table("orders")
        .select("total, guest_count, opened_at")
        .eq("org_id", org_id)
        .eq("location_id", location_id)
        .gte("opened_at", f"{target_date}T00:00:00Z")
        .lte("opened_at", f"{target_date}T23:59:59Z")
        .in_("status", ["closed"])
        .execute()
    )

    hourly_revenue: dict[str, float] = {}
    hourly_covers: dict[str, int] = {}

    for o in (orders_resp.data or []):
        opened = o.get("opened_at", "")
        if "T" in opened:
            hour = opened.split("T")[1][:2].lstrip("0") or "0"
        else:
            continue
        hourly_revenue[hour] = hourly_revenue.get(hour, 0) + float(o.get("total") or 0)
        hourly_covers[hour] = hourly_covers.get(hour, 0) + int(o.get("guest_count") or 0)

    return hourly_revenue, hourly_covers


def _build_product_mix_live(
    org_id: str,
    location_id: str,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    """Build product mix from live order_items data."""
    items_resp = (
        supabase_client.table("order_items")
        .select("menu_item_id, quantity, unit_price, line_total, "
                "menu_items!order_items_menu_item_id_fkey(name, category_id, price, cost)")
        .eq("org_id", org_id)
        .gte("created_at", f"{start_date}T00:00:00Z")
        .lte("created_at", f"{end_date}T23:59:59Z")
        .execute()
    )

    results = []
    for item in (items_resp.data or []):
        menu_item = item.get("menu_items") or {}
        cost_per = float(menu_item.get("cost") or 0)
        qty = int(item.get("quantity") or 1)
        results.append({
            "menu_item_id": item.get("menu_item_id"),
            "menu_items": menu_item,
            "quantity_sold": qty,
            "gross_revenue": float(item.get("line_total") or 0),
            "food_cost": round(cost_per * qty, 2),
            "margin_percentage": 0,  # Will be calculated in caller
        })
    return results


def _empty_totals() -> dict[str, Any]:
    """Return empty totals dict for aggregation."""
    return {
        "gross_sales": 0.0,
        "net_sales": 0.0,
        "order_count": 0,
        "covers": 0,
        "tips": 0.0,
        "discounts": 0.0,
        "voids": 0.0,
    }


def _accumulate_totals(totals: dict[str, Any], day: dict[str, Any]) -> None:
    """Add a day's data to running totals."""
    totals["gross_sales"] += float(day.get("gross_sales") or 0)
    totals["net_sales"] += float(day.get("net_sales") or 0)
    totals["order_count"] += int(day.get("order_count") or 0)
    totals["covers"] += int(day.get("covers") or 0)
    totals["tips"] += float(day.get("tips") or 0)
    adj = day.get("adjustments") or {}
    totals["discounts"] += float(adj.get("discounts") or 0)
    totals["voids"] += float(adj.get("voids") or 0)

    # Round
    for key in ("gross_sales", "net_sales", "tips", "discounts", "voids"):
        totals[key] = round(totals[key], 2)


def _report_to_csv(report_type: str, data: dict[str, Any]) -> str:
    """Convert report data to CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "daily":
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Date", data.get("date")])
        writer.writerow(["Gross Sales", data.get("gross_sales")])
        writer.writerow(["Net Sales", data.get("net_sales")])
        writer.writerow(["Order Count", data.get("order_count")])
        writer.writerow(["Avg Check", data.get("avg_check")])
        writer.writerow(["Covers", data.get("covers")])
        writer.writerow(["Revenue/Cover", data.get("revenue_per_cover")])
        writer.writerow(["Tips", data.get("tips")])
        for k, v in (data.get("by_type") or {}).items():
            writer.writerow([f"Type: {k}", v])
        for k, v in (data.get("by_payment") or {}).items():
            writer.writerow([f"Payment: {k}", v])

    elif report_type == "hourly":
        writer.writerow(["Hour", "Revenue", "Covers", "Avg Check"])
        for h in (data.get("hours") or []):
            writer.writerow([h["label"], h["revenue"], h["covers"], h["avg_check"]])

    elif report_type == "product_mix":
        writer.writerow(["Item", "Qty Sold", "Revenue", "Food Cost", "Food Cost %",
                         "Profit", "Margin %", "Classification"])
        for item in (data.get("items") or []):
            writer.writerow([
                item["name"], item["quantity_sold"], item["gross_revenue"],
                item["food_cost"], item["food_cost_pct"], item["profit"],
                item["margin_pct"], item["classification"],
            ])

    elif report_type == "category_mix":
        writer.writerow(["Category", "Qty Sold", "Revenue", "Revenue %"])
        for cat in (data.get("categories") or []):
            writer.writerow([
                cat["category_name"], cat["quantity_sold"],
                cat["revenue"], cat["revenue_pct"],
            ])

    elif report_type == "server_performance":
        writer.writerow(["Server", "Checks", "Covers", "Gross Sales", "Net Sales",
                         "Avg Check", "Tips", "Tip %", "Voids"])
        for s in (data.get("servers") or []):
            writer.writerow([
                s["display_name"], s["checks"], s["covers"], s["gross_sales"],
                s["net_sales"], s["avg_check"], s["tips"], s["tip_pct"], s["voids"],
            ])

    elif report_type == "labor":
        writer.writerow(["Role", "Employees", "Regular Hrs", "OT Hrs", "Total Hrs",
                         "Labor Cost", "Labor %"])
        for r in (data.get("by_role") or []):
            writer.writerow([
                r["role"], r["employee_count"], r["regular_hours"],
                r["overtime_hours"], r["total_hours"], r["labor_cost"], r["labor_pct"],
            ])
        writer.writerow([])
        writer.writerow(["Total Sales", data.get("total_sales")])
        writer.writerow(["Total Labor Cost", data.get("total_labor_cost")])
        writer.writerow(["Total Hours", data.get("total_hours")])
        writer.writerow(["Labor %", data.get("labor_pct")])

    elif report_type == "discounts":
        writer.writerow(["Discount Name", "Count", "Total Amount"])
        for d in (data.get("discounts", {}).get("items") or []):
            writer.writerow([d["name"], d["count"], d["total_amount"]])
        writer.writerow([])
        writer.writerow(["Void Count", data.get("voids", {}).get("count")])
        writer.writerow(["Void Total", data.get("voids", {}).get("total_amount")])

    elif report_type == "payments":
        writer.writerow(["Method", "Count", "Amount", "Tips", "% of Total"])
        for m in (data.get("by_method") or []):
            writer.writerow([m["method"], m["count"], m["amount"], m["tips"], m["pct"]])
        writer.writerow([])
        writer.writerow(["Card Brand", "Count", "Amount"])
        for b in (data.get("by_card_brand") or []):
            writer.writerow([b["brand"], b["count"], b["amount"]])

    elif report_type == "tax":
        writer.writerow(["Tax Rate", "Rate %", "Inclusive", "Estimated Amount"])
        for r in (data.get("rates") or []):
            writer.writerow([r["name"], r["rate_pct"], r["is_inclusive"], r["estimated_amount"]])
        writer.writerow([])
        writer.writerow(["Total Taxable Sales", data.get("total_taxable_sales")])
        writer.writerow(["Total Tax Collected", data.get("total_tax_collected")])
        writer.writerow(["Effective Rate %", data.get("effective_rate")])

    elif report_type in ("weekly", "monthly", "custom"):
        writer.writerow(["Date", "Gross Sales", "Net Sales", "Orders", "Covers", "Tips"])
        for day in (data.get("daily_breakdown") or []):
            writer.writerow([
                day.get("date"), day.get("gross_sales"), day.get("net_sales"),
                day.get("order_count"), day.get("covers"), day.get("tips"),
            ])
        writer.writerow([])
        totals = data.get("totals") or {}
        writer.writerow(["Totals", totals.get("gross_sales"), totals.get("net_sales"),
                         totals.get("order_count"), totals.get("covers"), totals.get("tips")])

    return output.getvalue()
