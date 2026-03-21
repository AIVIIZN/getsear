"""SSE event publishing and subscription via Redis pub/sub (DB 4)."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Generator

import redis
import structlog

log = structlog.get_logger(__name__)

# Redis DB 4 is dedicated to SSE pub/sub
_SSE_REDIS_DB = 4
_HEARTBEAT_INTERVAL = 30  # seconds

# Channel name templates
CHANNEL_ORDERS = "sse:{location_id}:orders"
CHANNEL_KDS = "sse:{location_id}:kds"
CHANNEL_TABLES = "sse:{location_id}:tables"
CHANNEL_86 = "sse:{location_id}:86"


def _get_sse_redis() -> redis.Redis:
    """Get a Redis connection on DB 4 for SSE pub/sub."""
    from flask import current_app
    base_url = current_app.config.get("REDIS_URL", "redis://localhost:6379")
    return redis.Redis.from_url(
        f"{base_url}/{_SSE_REDIS_DB}",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )


def build_channel(template: str, location_id: str, **kwargs: str) -> str:
    """Build a channel name from a template."""
    return template.format(location_id=location_id, **kwargs)


def publish_event(
    channel: str,
    event_type: str,
    data: dict[str, Any],
) -> str:
    """
    Publish an SSE event to a Redis pub/sub channel.

    Returns the event_id (UUID) for client reconnection tracking.
    """
    event_id = str(uuid.uuid4())
    message = json.dumps({
        "event": event_type,
        "data": data,
        "id": event_id,
        "timestamp": time.time(),
    })

    try:
        r = _get_sse_redis()
        r.publish(channel, message)
        log.info(
            "sse.event_published",
            channel=channel,
            event_type=event_type,
            event_id=event_id,
        )
    except Exception:
        log.exception("sse.publish_failed", channel=channel, event_type=event_type)

    return event_id


def subscribe_events(
    channel: str,
    last_event_id: str | None = None,
) -> Generator[str, None, None]:
    """
    Generator that yields SSE-formatted strings from a Redis pub/sub channel.

    Sends heartbeat comments every 30 seconds to keep the connection alive.
    Handles client disconnection via GeneratorExit.

    Each yielded string is a complete SSE message:
        event: {type}
        data: {json}
        id: {uuid}

    """
    r = _get_sse_redis()
    pubsub = r.pubsub()
    pubsub.subscribe(channel)

    log.info("sse.client_subscribed", channel=channel, last_event_id=last_event_id)

    last_heartbeat = time.time()

    try:
        while True:
            message = pubsub.get_message(timeout=1.0)

            if message and message["type"] == "message":
                raw = message["data"]
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8")

                try:
                    parsed = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue

                event_type = parsed.get("event", "message")
                event_data = parsed.get("data", {})
                event_id = parsed.get("id", str(uuid.uuid4()))

                # If client sent Last-Event-ID, skip events we already sent
                # (basic dedup -- full replay would need a buffer store)
                if last_event_id and event_id == last_event_id:
                    last_event_id = None  # Found the marker, start sending from next
                    continue

                yield (
                    f"event: {event_type}\n"
                    f"data: {json.dumps(event_data)}\n"
                    f"id: {event_id}\n\n"
                )

            # Heartbeat to keep connection alive
            now = time.time()
            if now - last_heartbeat >= _HEARTBEAT_INTERVAL:
                yield ": heartbeat\n\n"
                last_heartbeat = now

    except GeneratorExit:
        log.info("sse.client_disconnected", channel=channel)
    finally:
        try:
            pubsub.unsubscribe(channel)
            pubsub.close()
        except Exception:
            pass
