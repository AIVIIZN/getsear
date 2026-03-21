"""KDS Celery tasks — ticket time calculations and kitchen analytics."""

from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)


def calculate_ticket_times() -> None:
    """Calculate average ticket completion times per station.

    Runs on a schedule via Celery beat. Results are stored in
    kds_station_metrics for dashboard widgets.
    """
    from app.extensions import supabase_client

    if supabase_client is None:
        log.warning("kds_ticket_times_skipped", reason="no supabase client")
        return

    log.info("kds_ticket_times_placeholder", status="stub — not yet implemented")
