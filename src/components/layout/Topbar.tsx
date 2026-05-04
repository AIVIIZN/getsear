"use client";

import { useEffect, useState } from "react";
import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StaffClockButton } from "@/components/pos/StaffClockButton";
import { useAuthStore } from "@/stores/auth-store";
import { PrintQueueBadge, PrintQueueDropdown } from "@/components/printing/PrintQueueDropdown";
import { SyncStatusIndicator } from "@/components/offline/SyncStatusIndicator";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { SyncProgressBar } from "@/components/offline/SyncProgressBar";
import { PendingMutationsBadge } from "@/components/offline/PendingMutationsBadge";

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
    <span className="tabular-nums text-[15px] font-medium text-[#3C3C43]">
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
              "text-[#007AFF] hover:bg-black/[0.04] active:bg-black/[0.06]",
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
              className="text-[#007AFF] hover:text-[#0051D5]"
            >
              Home
            </Link>
            <span className="text-[#C7C7CC]">/</span>
            <span className="font-medium text-[#1C1C1E]">Dashboard</span>
          </nav>
        ) : (
          <h1 className="text-[17px] font-semibold text-[#1C1C1E]">
            Sear POS
          </h1>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">
        <StaffClockButton />
        <LiveClock />
        <SyncStatusIndicator />
        <PendingMutationsBadge />
        <div className="relative">
          <PrintQueueBadge />
          <PrintQueueDropdown />
        </div>
        <span className="text-[15px] font-medium text-[#3C3C43]">
          {displayName}
        </span>
        <Link
          href="/settings"
          className={cn(
            "flex items-center justify-center rounded-[8px]",
            "text-[#8E8E93] hover:bg-black/[0.04] active:bg-black/[0.06]",
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
