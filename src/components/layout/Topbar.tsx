"use client";

import { useEffect, useState } from "react";
import { Menu, Settings, Wifi } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StaffClockButton } from "@/components/pos/StaffClockButton";
import { useAuthStore } from "@/stores/auth-store";

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
    <span className="tabular-nums text-callout font-semibold text-[var(--foreground)]">
      {time}
    </span>
  );
}

function ConnectionStatus() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
        <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-[var(--success)] animate-pulse-dot" />
      </div>
      <span className="text-footnote text-[var(--muted-foreground)]">
        Online
      </span>
    </div>
  );
}

export function Topbar({ showBreadcrumbs = false, onToggleSidebar }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? "Demo User";
  const role = user?.role ?? "owner";

  return (
    <header
      className="no-select flex shrink-0 items-center justify-between bg-[var(--card)] px-4"
      style={{
        height: "var(--topbar-height)",
        boxShadow: "var(--shadow-sm)",
        borderBottom: "0.5px solid var(--separator)",
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="btn-press touch-target flex items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            style={{
              width: 44,
              height: 44,
              transitionDuration: "var(--duration-fast)",
            }}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {showBreadcrumbs ? (
          <nav className="flex items-center gap-1.5 text-subhead">
            <Link
              href="/"
              className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Home
            </Link>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-medium text-[var(--foreground)]">
              Dashboard
            </span>
          </nav>
        ) : (
          <span className="text-callout font-semibold text-[var(--foreground)]">
            Main Location
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <StaffClockButton />
        <LiveClock />
        <ConnectionStatus />
        <div className="flex items-center gap-2">
          <span className="text-subhead font-medium text-[var(--foreground)]">
            {displayName}
          </span>
          <span className="text-caption-1 font-medium rounded-md bg-[var(--accent)] px-2 py-0.5 text-[var(--accent-foreground)]">
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
        </div>
        <Link
          href="/settings"
          className="btn-press touch-target flex items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          style={{
            width: 44,
            height: 44,
            transitionDuration: "var(--duration-fast)",
          }}
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
