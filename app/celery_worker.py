"""Celery worker entry point.

Start with:
    celery -A app.celery_worker.celery_app worker --loglevel=info
    celery -A app.celery_worker.celery_app beat --loglevel=info
"""

from pathlib import Path

from celery.schedules import crontab
from dotenv import load_dotenv

# Load env before anything reads os.environ
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app import create_app  # noqa: E402
from app.extensions import celery_app  # noqa: E402

# Create a Flask app context so Celery tasks can access config and extensions
flask_app = create_app()

# Import tasks so they are discovered by Celery
import app.tasks  # noqa: E402, F401

celery_app.conf.include = ["app.tasks"]

# --- Task routing ---
celery_app.conf.task_routes = {
    "app.tasks.reports.*": {"queue": "reports"},
    "app.tasks.notifications.*": {"queue": "notifications"},
    "app.tasks.sync.*": {"queue": "sync"},
    "app.tasks.*": {"queue": "default"},
}

# --- Beat schedule ---
celery_app.conf.beat_schedule = {
    "aggregate-daily-metrics": {
        "task": "app.tasks.aggregate_daily_metrics",
        "schedule": crontab(minute=0, hour=4),
        "options": {"queue": "reports"},
    },
    "cleanup-stale-sessions": {
        "task": "app.tasks.cleanup_stale_sessions",
        "schedule": crontab(minute="*/30"),
        "options": {"queue": "default"},
    },
    "sync-offline-relays": {
        "task": "app.tasks.sync_offline_relays",
        "schedule": crontab(minute="*/5"),
        "options": {"queue": "sync"},
    },
    "check-gift-card-expiry": {
        "task": "app.tasks.check_gift_card_expiry",
        "schedule": crontab(minute=0, hour=6),
        "options": {"queue": "default"},
    },
    "check-low-stock": {
        "task": "app.tasks.check_low_stock",
        "schedule": crontab(minute=0, hour="*/4"),
        "options": {"queue": "notifications"},
    },
}

# --- Serializer config ---
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
