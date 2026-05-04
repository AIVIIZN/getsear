"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useUIStore } from "@/stores/ui-store";
import { fadeUp, useReducedMotion } from "@/lib/motion/transitions";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.actions.setSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.actions.toggleSidebar);
  const pathname = usePathname();
  const reduced = useReducedMotion();

  // Backoffice defaults to expanded sidebar
  useEffect(() => {
    setSidebarCollapsed(false);
  }, [setSidebarCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — always visible in backoffice */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar showBreadcrumbs onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto scroll-container">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              className="mx-auto w-full max-w-[1280px] p-6"
              initial={reduced ? false : fadeUp.initial}
              animate={fadeUp.animate}
              exit={reduced ? undefined : fadeUp.exit}
              transition={reduced ? { duration: 0 } : fadeUp.transition}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
