"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { CommandPaletteButton } from "@/components/layout/CommandPalette";
import { HelpDrawer } from "@/components/help/HelpDrawer";

const StaffClockButton = dynamic(
  () => import("@/components/pos/StaffClockButton").then((m) => ({ default: m.StaffClockButton })),
  { ssr: false },
);
const PrintQueueBadge = dynamic(
  () => import("@/components/printing/PrintQueueDropdown").then((m) => ({ default: m.PrintQueueBadge })),
  { ssr: false },
);
const PrintQueueDropdown = dynamic(
  () => import("@/components/printing/PrintQueueDropdown").then((m) => ({ default: m.PrintQueueDropdown })),
  { ssr: false },
);
const SyncStatusIndicator = dynamic(
  () => import("@/components/offline/SyncStatusIndicator").then((m) => ({ default: m.SyncStatusIndicator })),
  { ssr: false },
);
const OfflineBanner = dynamic(
  () => import("@/components/offline/OfflineBanner").then((m) => ({ default: m.OfflineBanner })),
  { ssr: false },
);
const SyncProgressBar = dynamic(
  () => import("@/components/offline/SyncProgressBar").then((m) => ({ default: m.SyncProgressBar })),
  { ssr: false },
);
const PendingMutationsBadge = dynamic(
  () => import("@/components/offline/PendingMutationsBadge").then((m) => ({ default: m.PendingMutationsBadge })),
  { ssr: false },
);
const OfflineConfidencePanel = dynamic(
  () => import("@/components/offline/OfflineConfidencePanel").then((m) => ({ default: m.OfflineConfidencePanel })),
  { ssr: false },
);

interface TopbarProps {
  showBreadcrumbs?: boolean;
  onToggleSidebar?: () => void;
}

function LiveClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      const period = hours >= 12 ? "PM" : "AM";
      const h = hours % 12 || 12;
      setTime(`${h}:${minutes}:${seconds} ${period}`);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <span className="tabular-nums text-[15px] font-medium text-[var(--color-text-secondary)]">
      {time}
    </span>
  );
}

// ConnectionDot replaced by SyncStatusIndicator

export function Topbar({ showBreadcrumbs = false, onToggleSidebar }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? "Demo User";

  return (
    <>
    <SyncProgressBar />
    <OfflineBanner />
    <OfflineConfidencePanel />
    <header
      className="no-select flex shrink-0 items-center justify-between bg-white/80 px-4"
      style={{
        height: "var(--topbar-height)",
        borderBottom: "0.5px solid rgba(60, 60, 67, 0.12)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={cn(
              "flex items-center justify-center rounded-[8px]",
              "text-[var(--color-primary)] hover:bg-black/[0.04] active:bg-black/[0.06]",
              "transition-colors duration-100"
            )}
            style={{ width: 36, height: 36 }}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-[20px] w-[20px]" strokeWidth={2} />
          </button>
        )}

        {showBreadcrumbs ? (
          <nav className="flex items-center gap-1.5 text-[15px]">
            <Link
              href="/"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-deep)]"
            >
              Home
            </Link>
            <span className="text-[var(--gray-400)]">/</span>
            <span className="font-medium text-[var(--color-text)]">Dashboard</span>
          </nav>
        ) : (
          <h1 className="text-[17px] font-semibold text-[var(--color-text)]">
            Sear POS
          </h1>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <CommandPaletteButton />
        <HelpDrawer />
        <StaffClockButton />
        <LiveClock />
        <SyncStatusIndicator />
        <PendingMutationsBadge />
        <div className="relative">
          <PrintQueueBadge />
          <PrintQueueDropdown />
        </div>
        <span className="text-[15px] font-medium text-[var(--color-text-secondary)]">
          {displayName}
        </span>
        <Link
          href="/settings"
          className={cn(
            "flex items-center justify-center rounded-[8px]",
            "text-[var(--color-text-muted)] hover:bg-black/[0.04] active:bg-black/[0.06]",
            "transition-colors duration-100"
          )}
          style={{ width: 36, height: 36 }}
        >
          <Settings className="h-[20px] w-[20px]" strokeWidth={1.8} />
        </Link>
      </div>
    </header>
    </>
  );
}
