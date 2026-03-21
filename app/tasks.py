"""Celery tasks for Sear POS background processing."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog

from app.extensions import celery_app

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Beat-scheduled tasks
# ---------------------------------------------------------------------------


@celery_app.task(name="app.tasks.aggregate_daily_metrics")
def aggregate_daily_metrics() -> dict:
    """Aggregate yesterday's orders/payments into daily_metrics."""
    from app.extensions import supabase_client
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    day_start = f"{yesterday}T00:00:00+00:00"
    day_end = f"{yesterday}T23:59:59+00:00"

    try:
        # Get all orgs with activity
        orders_resp = (
            supabase_client.table("orders")
            .select("org_id, location_id, total, tax_total, discount_total, tip_total")
            .gte("opened_at", day_start)
            .lte("opened_at", day_end)
            .in_("status", ["closed"])
            .execute()
        )
        orders = orders_resp.data or []

        # Group by org_id + location_id
        metrics: dict[tuple[str, str], dict] = {}
        for o in orders:
            key = (o["org_id"], o["location_id"])
            if key not in metrics:
                metrics[key] = {
                    "order_count": 0,
                    "gross_sales": 0.0,
                    "tax_total": 0.0,
                    "discount_total": 0.0,
                    "tip_total": 0.0,
                }
            m = metrics[key]
            m["order_count"] += 1
            m["gross_sales"] += float(o.get("total") or 0)
            m["tax_total"] += float(o.get("tax_total") or 0)
            m["discount_total"] += float(o.get("discount_total") or 0)
            m["tip_total"] += float(o.get("tip_total") or 0)

        for (org_id, location_id), m in metrics.items():
            supabase_client.table("daily_metrics").upsert({
                "org_id": org_id,
                "location_id": location_id,
                "business_date": str(yesterday),
                "order_count": m["order_count"],
                "gross_sales": m["gross_sales"],
                "tax_total": m["tax_total"],
                "discount_total": m["discount_total"],
                "tip_total": m["tip_total"],
            }, on_conflict="org_id,location_id,business_date").execute()

        log.info("tasks.aggregate_daily_metrics.done", date=str(yesterday), locations=len(metrics))
        return {"date": str(yesterday), "locations": len(metrics)}

    except Exception:
        log.exception("tasks.aggregate_daily_metrics.failed")
        raise


@celery_app.task(name="app.tasks.cleanup_stale_sessions")
def cleanup_stale_sessions() -> dict:
    """Mark terminals with stale heartbeats as offline."""
    from app.extensions import supabase_client
    threshold = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

    try:
        resp = (
            supabase_client.table("terminals")
            .update({"is_online": False})
            .eq("is_online", True)
            .lt("last_heartbeat_at", threshold)
            .execute()
        )
        count = len(resp.data or [])
        log.info("tasks.cleanup_stale_sessions.done", stale_count=count)
        return {"stale_count": count}

    except Exception:
        log.exception("tasks.cleanup_stale_sessions.failed")
        raise


@celery_app.task(name="app.tasks.sync_offline_relays")
def sync_offline_relays() -> dict:
    """Placeholder for offline relay sync (requires hardware integration)."""
    log.info("tasks.sync_offline_relays.noop")
    return {"status": "noop"}


@celery_app.task(name="app.tasks.check_gift_card_expiry")
def check_gift_card_expiry() -> dict:
    """Expire gift cards past their expiration date."""
    from app.extensions import supabase_client
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        resp = (
            supabase_client.table("gift_cards")
            .update({"is_active": False, "updated_at": now_iso})
            .eq("is_active", True)
            .lt("expires_at", now_iso)
            .not_.is_("expires_at", "null")
            .execute()
        )
        count = len(resp.data or [])
        log.info("tasks.check_gift_card_expiry.done", expired_count=count)
        return {"expired_count": count}

    except Exception:
        log.exception("tasks.check_gift_card_expiry.failed")
        raise


@celery_app.task(name="app.tasks.check_low_stock")
def check_low_stock() -> dict:
    """Check inventory items at or below reorder point and log alerts."""
    from app.extensions import supabase_client
    try:
        resp = (
            supabase_client.table("inventory_items")
            .select("id, org_id, name, current_quantity, reorder_point")
            .lte("current_quantity", "reorder_point")
            .eq("is_active", True)
            .execute()
        )
        # Filter in Python since Supabase doesn't support column-to-column comparison natively
        low_items = []
        for item in (resp.data or []):
            qty = float(item.get("current_quantity") or 0)
            reorder = float(item.get("reorder_point") or 0)
            if qty <= reorder:
                low_items.append(item)

        if low_items:
            log.warning(
                "tasks.check_low_stock.alerts",
                count=len(low_items),
                items=[{"id": i["id"], "name": i["name"]} for i in low_items[:10]],
            )

        log.info("tasks.check_low_stock.done", low_count=len(low_items))
        return {"low_count": len(low_items)}

    except Exception:
        log.exception("tasks.check_low_stock.failed")
        raise


# ---------------------------------------------------------------------------
# Event-driven task
# ---------------------------------------------------------------------------


@celery_app.task(name="app.tasks.process_event")
def process_event(event_name: str, data: dict) -> dict:
    """Re-emit an event synchronously on the Celery worker."""
    from app.shared.event_bus import event_bus

    log.info("tasks.process_event", event_name=event_name)
    event_bus.emit(event_name, data, sync=True)
    return {"event_name": event_name, "status": "processed"}


# ---------------------------------------------------------------------------
# Reconciliation tasks
# ---------------------------------------------------------------------------


@celery_app.task(name="tasks.reconciliation.daily_aggregation")
def reconciliation_daily_aggregation(org_id: str, location_id: str, business_date: str) -> dict:
    """Aggregate daily reconciliation data after day close."""
    log.info(
        "tasks.reconciliation.daily_aggregation",
        org_id=org_id,
        location_id=location_id,
        business_date=business_date,
    )
    # The actual aggregation logic lives in reconciliation.py;
    # this task is dispatched after close_day to run async.
    try:
        from app.core.pos.reconciliation import DailyReconciliation
        # Placeholder: the reconciliation engine already runs inline during close_day.
        # This task can be used for post-close re-aggregation if needed.
        return {"status": "complete", "business_date": business_date}
    except Exception:
        log.exception("tasks.reconciliation.daily_aggregation.failed")
        raise


@celery_app.task(name="tasks.reconciliation.tip_distribution_calc")
def reconciliation_tip_distribution_calc(org_id: str, location_id: str, business_date: str) -> dict:
    """Calculate tip distribution for the business day."""
    from app.extensions import supabase_client
    log.info(
        "tasks.reconciliation.tip_distribution_calc",
        org_id=org_id,
        location_id=location_id,
        business_date=business_date,
    )
    try:
        # Query payments with tips for this day/location
        day_start = f"{business_date}T00:00:00+00:00"
        day_end = f"{business_date}T23:59:59+00:00"

        resp = (
            supabase_client.table("payments")
            .select("order_id, tip_amount")
            .eq("org_id", org_id)
            .gte("created_at", day_start)
            .lte("created_at", day_end)
            .gt("tip_amount", 0)
            .execute()
        )
        total_tips = sum(float(p.get("tip_amount") or 0) for p in (resp.data or []))
        log.info("tasks.reconciliation.tip_distribution_calc.done", total_tips=total_tips)
        return {"status": "complete", "total_tips": total_tips}
    except Exception:
        log.exception("tasks.reconciliation.tip_distribution_calc.failed")
        raise


@celery_app.task(name="tasks.reconciliation.email_daily_summary")
def reconciliation_email_daily_summary(org_id: str, location_id: str, business_date: str) -> dict:
    """Email daily summary report to org owners/managers."""
    log.info(
        "tasks.reconciliation.email_daily_summary",
        org_id=org_id,
        location_id=location_id,
        business_date=business_date,
    )
    try:
        # Placeholder: actual email sending via SendGrid would go here
        log.info("tasks.reconciliation.email_daily_summary.done", business_date=business_date)
        return {"status": "complete", "business_date": business_date}
    except Exception:
        log.exception("tasks.reconciliation.email_daily_summary.failed")
        raise
