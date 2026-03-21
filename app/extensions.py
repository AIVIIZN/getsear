from __future__ import annotations

from typing import TYPE_CHECKING

import redis
import structlog
from celery import Celery
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect

if TYPE_CHECKING:
    from flask import Flask

logger = structlog.get_logger()

# --- Redis connections (lazy, initialized in init_extensions) ---
redis_client: redis.Redis | None = None          # DB 0 — application cache
rate_limiter_redis: redis.Redis | None = None     # DB 1 — rate limiting
session_redis: redis.Redis | None = None          # DB 2 — session storage

# --- Celery ---
celery_app: Celery = Celery("sear-pos")

# --- Flask-Limiter (storage set during init) ---
limiter: Limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute", "5000/hour"],
    storage_uri="memory://",  # overridden in init_extensions
)

# --- CSRF ---
csrf: CSRFProtect = CSRFProtect()

# --- Supabase (initialized in init, not at import time) ---
supabase_client = None


def _build_redis_connection(base_url: str, db: int) -> redis.Redis:
    """Create a Redis connection for a specific DB number."""
    return redis.Redis.from_url(
        f"{base_url}/{db}",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )


def _init_redis(app: Flask) -> None:
    """Initialize all Redis connections from app config."""
    global redis_client, rate_limiter_redis, session_redis

    base_url = app.config.get("REDIS_URL", "redis://localhost:6379")
    db_cache = app.config.get("REDIS_DB_CACHE", 0)
    db_rate = app.config.get("REDIS_DB_RATE_LIMIT", 1)
    db_sessions = app.config.get("REDIS_DB_SESSIONS", 2)

    redis_client = _build_redis_connection(base_url, db_cache)
    rate_limiter_redis = _build_redis_connection(base_url, db_rate)
    session_redis = _build_redis_connection(base_url, db_sessions)

    logger.info(
        "redis.initialized",
        base_url=base_url,
        dbs={"cache": db_cache, "rate_limit": db_rate, "sessions": db_sessions},
    )


def _init_celery(app: Flask) -> None:
    """Configure the Celery app from Flask config."""
    base_url = app.config.get("REDIS_URL", "redis://localhost:6379")
    celery_db = app.config.get("REDIS_DB_CELERY", 3)
    broker_url = f"{base_url}/{celery_db}"

    celery_app.conf.update(
        broker_url=broker_url,
        result_backend=broker_url,
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
    )

    # Bind the Celery app to the Flask context so tasks can access app.config
    class FlaskTask(celery_app.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = FlaskTask

    logger.info("celery.initialized", broker=broker_url)


def _init_limiter(app: Flask) -> None:
    """Attach Flask-Limiter to the app with Redis storage."""
    base_url = app.config.get("REDIS_URL", "redis://localhost:6379")
    db_rate = app.config.get("REDIS_DB_RATE_LIMIT", 1)
    storage_uri = f"{base_url}/{db_rate}"

    limiter._storage_uri = storage_uri
    limiter.init_app(app)

    logger.info("limiter.initialized", storage=storage_uri)


def _init_supabase(app: Flask) -> None:
    """Initialize the Supabase client from app config."""
    global supabase_client

    url = app.config.get("SUPABASE_URL", "")
    key = app.config.get("SUPABASE_SERVICE_ROLE_KEY", "") or app.config.get("SUPABASE_ANON_KEY", "")

    if not url or not key:
        logger.warning("supabase.skipped", reason="SUPABASE_URL or key not configured")
        return

    from supabase import create_client

    supabase_client = create_client(url, key)
    logger.info("supabase.initialized", url=url)


def init_extensions(app: Flask) -> None:
    """Initialize all extensions with the Flask app instance.

    Called from the app factory in app/__init__.py.
    """
    # CSRF protection
    csrf.init_app(app)

    # CORS for API routes (kiosk/customer display on different devices)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Redis connections
    _init_redis(app)

    # Celery
    _init_celery(app)

    # Rate limiter
    _init_limiter(app)

    # Supabase
    _init_supabase(app)

    logger.info("extensions.all_initialized")
