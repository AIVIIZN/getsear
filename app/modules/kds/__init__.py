"""
Kitchen Display System module for Sear POS.

Provides real-time kitchen order display with bump-bar support.
Orders flow from POS → KDS screens, grouped by station (grill, fry, expo).
"""

from app.shared.module_registry import ModuleManifest
from app.modules.kds.routes import bp

MANIFEST = ModuleManifest(
    id="mod.kds",
    name="Kitchen Display System",
    version="1.0.0",
    description="Real-time kitchen order display with bump-bar support",
    dependencies=["core.pos"],
    migration_path="migrations/",
    blueprint_name="kds",
    url_prefix="/api/v1/kds",
    event_hooks={
        "order.created": "hooks.on_order_created",
        "order.updated": "hooks.on_order_updated",
        "order.item_fired": "hooks.on_item_fired",
        "menu.item_86d": "hooks.on_item_86d",
    },
    nav_items=[
        {
            "label": "Kitchen Display",
            "icon": "kitchen",
            "url": "/kds",
            "position": "main_nav",
            "required_permission": "kds.view",
        }
    ],
    settings_sections=[
        {
            "label": "KDS Configuration",
            "url": "/settings/kds",
            "required_permission": "kds.configure",
        }
    ],
    dashboard_widgets=[
        {
            "id": "kds_avg_ticket_time",
            "label": "Avg Ticket Time",
            "component": "widgets/avg_ticket_time.html",
            "size": "small",
            "refresh_interval": 30,
        }
    ],
    permissions=[
        "kds.view",
        "kds.bump",
        "kds.configure",
        "kds.recall",
    ],
    celery_tasks=[
        "tasks.calculate_ticket_times",
    ],
)

__all__ = ["MANIFEST", "bp"]
