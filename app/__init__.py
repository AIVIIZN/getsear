"""Sear POS — Flask application factory."""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING

from dotenv import load_dotenv

# Load .env with explicit path BEFORE anything reads os.environ
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import structlog
from flask import Flask, jsonify

from app.config import get_config

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application.

    Args:
        config_name: Environment name (development, staging, production, testing).
                     Falls back to FLASK_ENV env var, then 'development'.
    """
    env = config_name or os.environ.get("FLASK_ENV", "development")

    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )

    # Load config
    config = get_config(env)
    app.config.from_object(config)

    # Configure structlog
    _configure_structlog(app)

    logger.info("app.creating", env=env)

    # Initialize extensions
    from app.extensions import init_extensions
    init_extensions(app)

    # Register core blueprints
    _register_core_blueprints(app)

    # Exempt all API blueprints from CSRF (they use JWT auth, not cookies)
    from app.extensions import csrf
    if csrf is not None:
        for rule in app.url_map.iter_rules():
            if rule.rule.startswith("/api/"):
                view_func = app.view_functions.get(rule.endpoint)
                if view_func is not None:
                    csrf.exempt(view_func)

    # Discover and load optional modules
    _register_modules(app)

    # Register error handlers
    _register_error_handlers(app)

    # Register auth middleware (JWT extraction + security headers)
    from app.core.auth.middleware import register_auth_middleware
    register_auth_middleware(app)

    # Wire event bus to SSE (bridge internal events to real-time streams)
    from app.shared.sse_bridge import register_sse_bridge
    register_sse_bridge()

    # Health check endpoint
    @app.route("/health")
    def health_check():
        """Health check endpoint for load balancer probes."""
        return jsonify({"status": "healthy", "service": "sear-pos"}), 200

    logger.info("app.created", env=env)

    return app


def _configure_structlog(app: Flask) -> None:
    """Set up structured logging with JSON output in prod, console in dev."""
    is_dev = app.config.get("DEBUG", False)

    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if is_dev:
        processors.append(structlog.dev.ConsoleRenderer())
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def _register_core_blueprints(app: Flask) -> None:
    """Register all core (always-loaded) blueprints."""
    from app.core.auth import bp as auth_bp
    from app.core.pos import bp as pos_bp
    from app.core.pos.table_routes import tables_bp
    from app.core.pos.sse_routes import sse_bp
    from app.core.pos.reconciliation_routes import reconciliation_bp
    from app.core.pos.payment_routes import payments_bp
    from app.core.menu import bp as menu_bp
    from app.core.staff import bp as staff_bp
    from app.core.customers import bp as customers_bp
    from app.core.reports import bp as reports_bp
    from app.core.settings import bp as settings_bp
    from app.core.pages import bp as pages_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(pos_bp, url_prefix="/api/v1/orders")
    app.register_blueprint(payments_bp)  # url_prefix set on blueprint
    app.register_blueprint(tables_bp)  # url_prefix set on blueprint
    app.register_blueprint(sse_bp)  # url_prefix set on blueprint
    app.register_blueprint(reconciliation_bp)  # url_prefix set on blueprint
    app.register_blueprint(menu_bp, url_prefix="/api/v1/menu")
    app.register_blueprint(staff_bp, url_prefix="/api/v1/staff")
    app.register_blueprint(customers_bp)  # url_prefix set on blueprint
    app.register_blueprint(reports_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(settings_bp, url_prefix="/api/v1/settings")
    app.register_blueprint(pages_bp)  # HTML pages at root

    logger.info("blueprints.core_registered", count=12)


def _register_modules(app: Flask) -> None:
    """Discover and load enabled optional modules via the ModuleRegistry."""
    from app.shared.module_registry import registry

    discovered = registry.discover_modules(app)
    logger.info("modules.discovered", count=len(discovered))

    loaded = registry.load_all_enabled_modules(app)
    logger.info("modules.loaded", count=len(loaded))


def _register_error_handlers(app: Flask) -> None:
    """Register error handlers that return JSON for API requests, HTML for pages."""
    from flask import render_template, request

    def _wants_json() -> bool:
        """Return True if the client prefers JSON (API call) over HTML."""
        if request.path.startswith("/api/"):
            return True
        best = request.accept_mimetypes.best_match(["application/json", "text/html"])
        return best == "application/json"

    @app.errorhandler(400)
    def bad_request(error):
        if _wants_json():
            return jsonify({"error": "Bad request", "message": str(error)}), 400
        return render_template("errors/400.html"), 400

    @app.errorhandler(401)
    def unauthorized(error):
        if _wants_json():
            return jsonify({"error": "Unauthorized", "message": "Authentication required"}), 401
        return render_template("errors/401.html"), 401

    @app.errorhandler(403)
    def forbidden(error):
        if _wants_json():
            return jsonify({"error": "Forbidden", "message": "Insufficient permissions"}), 403
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(error):
        if _wants_json():
            return jsonify({"error": "Not found", "message": "Resource not found"}), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error("server_error", error=str(error), path=request.path)
        if _wants_json():
            return jsonify({"error": "Internal server error", "message": "An unexpected error occurred"}), 500
        return render_template("errors/500.html"), 500

    logger.info("error_handlers.registered")
