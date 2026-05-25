"use client";

import dynamic from "next/dynamic";
import { Sidebar } from "@/components/layout/Sidebar";
import { useUIStore } from "@/stores/ui-store";

const Topbar = dynamic(
  () => import("@/components/layout/Topbar").then((m) => ({ default: m.Topbar })),
  {
    ssr: false,
    loading: () => (
      <div
        className="shrink-0 bg-white/80"
        style={{ height: "var(--topbar-height)" }}
      />
    ),
  },
);
const StaleOrderModal = dynamic(
  () => import("@/components/pos/StaleOrderModal").then((m) => ({ default: m.StaleOrderModal })),
  { ssr: false },
);

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.actions.toggleSidebar);

  return (
    <div className="no-select no-overscroll flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Backdrop when sidebar is expanded — overlay mode */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-10 bg-black/40 animate-backdrop"
          style={{ left: "var(--sidebar-expanded)" }}
          onClick={toggleSidebar}
        />
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      {/* V5.4.1 — listens for the global stale-order event from
          src/lib/orders/api-client.ts. One mount serves every (pos)
          subroute. */}
      <StaleOrderModal />
    </div>
  );
}
