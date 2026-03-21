"""
In-process event bus for Sear POS module communication.

Modules communicate through events, never by importing each other directly.
Supports sync dispatch (same request) and async dispatch (Celery task).
Thread-safe handler registration.
"""

from __future__ import annotations

import threading
from typing import Any, Callable

import structlog

log = structlog.get_logger(__name__)


class EventBus:
    """
    Singleton event bus. Handlers are registered by modules at startup.
    Events are emitted by core modules during normal operations.

    Thread-safe: handler lists are guarded by a lock so that concurrent
    gunicorn/gevent workers registering hooks don't race.
    """

    _instance: EventBus | None = None
    _lock = threading.Lock()

    def __new__(cls) -> EventBus:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    inst = super().__new__(cls)
                    inst._handlers: dict[str, list[tuple[int, Callable]]] = {}
                    inst._handler_lock = threading.Lock()
                    cls._instance = inst
        return cls._instance

    # ------------------------------------------------------------------
    # Subscribe
    # ------------------------------------------------------------------

    def subscribe(self, event_name: str, handler: Callable, priority: int = 0) -> None:
        """
        Register a handler for an event.

        Args:
            event_name: Dot-delimited event string, e.g. "order.created".
            handler: Callable receiving (event_name: str, data: dict).
            priority: Lower numbers fire first. Default 0.
        """
        with self._handler_lock:
            if event_name not in self._handlers:
                self._handlers[event_name] = []
            self._handlers[event_name].append((priority, handler))
            # Keep sorted so lower priority numbers run first
            self._handlers[event_name].sort(key=lambda t: t[0])
        log.debug(
            "event_subscribed",
            event_name=event_name,
            handler=f"{handler.__module__}.{handler.__qualname__}",
            priority=priority,
        )

    # ------------------------------------------------------------------
    # Emit
    # ------------------------------------------------------------------

    def emit(self, event_name: str, data: dict[str, Any], sync: bool = True) -> list[Any]:
        """
        Fire an event to all subscribed handlers.

        Args:
            event_name: Event identifier string.
            data: Payload dict passed to each handler.
            sync: If True, run handlers inline. If False, dispatch via Celery.

        Returns:
            List of handler return values (sync only). Async returns empty list.
        """
        if not sync:
            self.emit_async(event_name, data)
            return []

        with self._handler_lock:
            handlers = list(self._handlers.get(event_name, []))

        results: list[Any] = []
        for _priority, handler in handlers:
            try:
                result = handler(event_name, data)
                results.append(result)
            except Exception:
                log.exception(
                    "event_handler_error",
                    event_name=event_name,
                    handler=f"{handler.__module__}.{handler.__qualname__}",
                )
        return results

    def emit_async(self, event_name: str, data: dict[str, Any]) -> None:
        """
        Dispatch event processing to a Celery background task.
        The task will re-emit the event synchronously on the worker.
        """
        try:
            from app.extensions import celery_app

            celery_app.send_task(
                "app.tasks.process_event",
                args=[event_name, data],
            )
            log.info("event_dispatched_async", event_name=event_name)
        except Exception:
            log.exception("event_async_dispatch_failed", event_name=event_name)

    # ------------------------------------------------------------------
    # Introspection / management
    # ------------------------------------------------------------------

    def get_handlers(self, event_name: str) -> list[Callable]:
        """Return list of handlers registered for an event (sans priority)."""
        with self._handler_lock:
            return [h for _p, h in self._handlers.get(event_name, [])]

    def clear(self) -> None:
        """Remove all handlers. Useful in tests."""
        with self._handler_lock:
            self._handlers.clear()


# Module-level singleton
event_bus = EventBus()
