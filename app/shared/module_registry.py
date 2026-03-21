"""
Hot-swappable module registry for Sear POS.

Discovers module manifests at startup, registers Flask blueprints,
resolves dependency order, and gates modules per-tenant at request time.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import structlog

log = structlog.get_logger(__name__)


@dataclass
class ModuleManifest:
    """Declares a module's identity, dependencies, routes, hooks, and UI contributions."""

    id: str
    name: str
    version: str
    description: str
    dependencies: list[str] = field(default_factory=list)
    migration_path: str = ""
    blueprint_name: str = ""
    url_prefix: str = ""
    event_hooks: dict[str, str] = field(default_factory=dict)
    nav_items: list[dict] = field(default_factory=list)
    settings_sections: list[dict] = field(default_factory=list)
    dashboard_widgets: list[dict] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    celery_tasks: list[str] = field(default_factory=list)


class ModuleRegistry:
    """
    Central registry for all optional modules.

    Modules are discovered at startup by scanning app/modules/ for packages
    containing a MANIFEST attribute. Blueprints are registered once globally;
    tenant-level gating is handled by the @require_module decorator at
    request time.
    """

    def __init__(self) -> None:
        self._manifests: dict[str, ModuleManifest] = {}
        self._loaded: set[str] = set()

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def discover_modules(self, app: Any) -> list[ModuleManifest]:
        """Scan app/modules/ for packages that expose a MANIFEST constant."""
        modules_dir = Path(app.root_path) / "modules"
        discovered: list[ModuleManifest] = []

        if not modules_dir.is_dir():
            log.warning("modules_dir_missing", path=str(modules_dir))
            return discovered

        for child in sorted(modules_dir.iterdir()):
            if not child.is_dir():
                continue
            init_file = child / "__init__.py"
            if not init_file.exists():
                continue

            module_pkg_name = child.name
            try:
                mod = importlib.import_module(f"app.modules.{module_pkg_name}")
                manifest: ModuleManifest | None = getattr(mod, "MANIFEST", None)
                if manifest is None:
                    log.debug("module_no_manifest", package=module_pkg_name)
                    continue
                self._manifests[manifest.id] = manifest
                discovered.append(manifest)
                log.info("module_discovered", module_id=manifest.id, name=manifest.name)
            except Exception:
                log.exception("module_discovery_error", package=module_pkg_name)

        return discovered

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load_module(self, module_id: str, app: Any) -> bool:
        """
        Import module package, register its Flask blueprint, and wire up
        event hooks. Safe to call multiple times — already-loaded modules
        are skipped.
        """
        if module_id in self._loaded:
            return True

        manifest = self._manifests.get(module_id)
        if manifest is None:
            log.error("module_not_found", module_id=module_id)
            return False

        # Ensure all dependencies are loaded first
        for dep in manifest.dependencies:
            if dep.startswith("core."):
                continue  # core modules are always present
            if dep not in self._loaded:
                dep_ok = self.load_module(dep, app)
                if not dep_ok:
                    log.error(
                        "module_dependency_failed",
                        module_id=module_id,
                        missing_dep=dep,
                    )
                    return False

        # Register Flask blueprint
        if manifest.blueprint_name:
            try:
                pkg = importlib.import_module(f"app.modules.{manifest.blueprint_name}")
                bp = getattr(pkg, "bp", None)
                if bp is not None:
                    app.register_blueprint(bp, url_prefix=manifest.url_prefix)
                    log.info(
                        "blueprint_registered",
                        module_id=module_id,
                        prefix=manifest.url_prefix,
                    )
                else:
                    log.warning("blueprint_missing", module_id=module_id)
            except Exception:
                log.exception("blueprint_register_error", module_id=module_id)
                return False

        # Register event hooks via the global EventBus
        if manifest.event_hooks:
            from app.shared.event_bus import event_bus

            for event_name, handler_path in manifest.event_hooks.items():
                try:
                    # handler_path is like "hooks.on_order_created"
                    parts = handler_path.rsplit(".", 1)
                    sub_module_name = parts[0]
                    func_name = parts[1]
                    hook_mod = importlib.import_module(
                        f"app.modules.{manifest.blueprint_name}.{sub_module_name}"
                    )
                    handler: Callable = getattr(hook_mod, func_name)
                    event_bus.subscribe(event_name, handler)
                    log.info(
                        "event_hook_registered",
                        module_id=module_id,
                        event_name=event_name,
                        handler=handler_path,
                    )
                except Exception:
                    log.exception(
                        "event_hook_register_error",
                        module_id=module_id,
                        event_name=event_name,
                        handler_path=handler_path,
                    )

        # Register Celery tasks (import the tasks module so Celery autodiscovers them)
        for task_path in manifest.celery_tasks:
            try:
                importlib.import_module(
                    f"app.modules.{manifest.blueprint_name}.{task_path.rsplit('.', 1)[0]}"
                )
            except Exception:
                log.exception(
                    "celery_task_import_error",
                    module_id=module_id,
                    task=task_path,
                )

        self._loaded.add(module_id)
        log.info("module_loaded", module_id=module_id)
        return True

    def load_all_enabled_modules(self, app: Any, org_id: str | None = None) -> list[str]:
        """
        Load every module that has been discovered. Blueprint registration is
        global (not per-tenant). Tenant-level enable/disable is enforced at
        request time by @require_module.

        If org_id is supplied, only load modules enabled for that org. If None,
        load all discovered modules (typical at startup so all routes exist).
        """
        loaded: list[str] = []

        if org_id is not None:
            enabled_ids = self._query_enabled_modules(org_id)
            to_load = [mid for mid in enabled_ids if mid in self._manifests]
        else:
            to_load = list(self._manifests.keys())

        # Sort by dependency order
        ordered: list[str] = []
        for mid in to_load:
            for dep_id in self.resolve_dependencies(mid):
                if dep_id not in ordered and dep_id in self._manifests:
                    ordered.append(dep_id)

        for mid in ordered:
            if self.load_module(mid, app):
                loaded.append(mid)

        return loaded

    # ------------------------------------------------------------------
    # Dependency resolution
    # ------------------------------------------------------------------

    def resolve_dependencies(self, module_id: str) -> list[str]:
        """
        Topological sort of module_id and its transitive dependencies.
        Returns a list where dependencies come before dependents.
        """
        visited: set[str] = set()
        order: list[str] = []

        def _visit(mid: str) -> None:
            if mid in visited:
                return
            visited.add(mid)
            manifest = self._manifests.get(mid)
            if manifest:
                for dep in manifest.dependencies:
                    if not dep.startswith("core."):
                        _visit(dep)
            order.append(mid)

        _visit(module_id)
        return order

    # ------------------------------------------------------------------
    # Tenant queries
    # ------------------------------------------------------------------

    def is_module_enabled(self, org_id: str, module_id: str) -> bool:
        """Check if a module is enabled for a specific organization."""
        from app.shared.cache import get_cached_modules, cache_modules
        from app.extensions import supabase_client

        # Try cache first
        cached = get_cached_modules(org_id)
        if cached is not None:
            return module_id in cached

        # Query Supabase
        try:
            resp = (
                supabase_client.table("org_modules")
                .select("module_id")
                .eq("org_id", org_id)
                .eq("is_enabled", True)
                .execute()
            )
            enabled_ids = [row["module_id"] for row in resp.data]
            cache_modules(org_id, enabled_ids)
            return module_id in enabled_ids
        except Exception:
            log.exception("module_enabled_check_failed", org_id=org_id, module_id=module_id)
            return False

    def get_module_manifest(self, module_id: str) -> ModuleManifest | None:
        """Return the manifest for a discovered module, or None."""
        return self._manifests.get(module_id)

    def get_all_modules(self) -> dict[str, ModuleManifest]:
        """Return all discovered module manifests keyed by module id."""
        return dict(self._manifests)

    def get_nav_items_for_tenant(self, org_id: str) -> list[dict]:
        """Collect nav items from all modules enabled for this org."""
        enabled_ids = self._query_enabled_modules(org_id)
        items: list[dict] = []
        for mid in enabled_ids:
            manifest = self._manifests.get(mid)
            if manifest:
                items.extend(manifest.nav_items)
        return items

    def get_dashboard_widgets_for_tenant(self, org_id: str) -> list[dict]:
        """Collect dashboard widgets from all modules enabled for this org."""
        enabled_ids = self._query_enabled_modules(org_id)
        widgets: list[dict] = []
        for mid in enabled_ids:
            manifest = self._manifests.get(mid)
            if manifest:
                widgets.extend(manifest.dashboard_widgets)
        return widgets

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _query_enabled_modules(self, org_id: str) -> list[str]:
        """Return list of enabled module IDs for an org (cached)."""
        from app.shared.cache import get_cached_modules, cache_modules
        from app.extensions import supabase_client

        cached = get_cached_modules(org_id)
        if cached is not None:
            return cached

        try:
            resp = (
                supabase_client.table("org_modules")
                .select("module_id")
                .eq("org_id", org_id)
                .eq("is_enabled", True)
                .execute()
            )
            enabled_ids = [row["module_id"] for row in resp.data]
            cache_modules(org_id, enabled_ids)
            return enabled_ids
        except Exception:
            log.exception("query_enabled_modules_failed", org_id=org_id)
            return []


# Singleton — importable throughout the app
registry = ModuleRegistry()
