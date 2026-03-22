"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TopbarProps {
  showBreadcrumbs?: boolean;
}

function LiveClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    function updateTime() {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    }
    updateTime();
    const interval = setInterval(updateTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <span className="tabular-nums text-sm font-medium text-[var(--foreground)]">
      {time}
    </span>
  );
}

function ConnectionStatus() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full bg-[var(--success)]" />
      <span className="text-xs text-[var(--muted-foreground)]">Connected</span>
    </div>
  );
}

export function Topbar({ showBreadcrumbs = false }: TopbarProps) {
  return (
    <header
      className={cn(
        "no-select flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4"
      )}
      style={{
        height: "var(--topbar-height)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {showBreadcrumbs ? (
          <nav className="flex items-center gap-1.5 text-sm">
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
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Main Location
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <LiveClock />
        <ConnectionStatus />
        <span className="text-sm text-[var(--muted-foreground)]">
          Demo User
        </span>
        <Link
          href="/settings"
          className="touch-target flex items-center justify-center rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
