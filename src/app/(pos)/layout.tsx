"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { StaleOrderModal } from "@/components/pos/StaleOrderModal";
import { useUIStore } from "@/stores/ui-store";
import { fadeUp, useReducedMotion } from "@/lib/motion/transitions";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.actions.toggleSidebar);
  const pathname = usePathname();
  const reduced = useReducedMotion();

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
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            className="flex-1 overflow-hidden"
            initial={reduced ? false : fadeUp.initial}
            animate={fadeUp.animate}
            exit={reduced ? undefined : fadeUp.exit}
            transition={reduced ? { duration: 0 } : fadeUp.transition}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* V5.4.1 — listens for the global stale-order event from
          src/lib/orders/api-client.ts. One mount serves every (pos)
          subroute. */}
      <StaleOrderModal />
    </div>
  );
}
