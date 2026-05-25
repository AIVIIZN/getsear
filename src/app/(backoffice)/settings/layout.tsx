"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  MapPin,
  Receipt,
  Monitor,
  Printer,
  Shield,
  Puzzle,
  BookOpen,
  Plug2,
  ChefHat,
  Sparkles,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { href: "/settings/organization", label: "Organization", icon: Building2 },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/tax-rates", label: "Tax Rates", icon: Receipt },
  { href: "/settings/terminals", label: "Terminals", icon: Monitor },
  { href: "/settings/printers", label: "Printers", icon: Printer },
  { href: "/settings/kds", label: "KDS Stations", icon: ChefHat },
  { href: "/settings/roles", label: "Roles & Permissions", icon: Shield },
  { href: "/settings/modules", label: "Modules", icon: Puzzle },
  { href: "/settings/accounting", label: "Accounting", icon: BookOpen },
  { href: "/settings/ai", label: "AI Intelligence", icon: Sparkles },
  { href: "/settings/security", label: "Security", icon: Lock },
  { href: "/settings/integrations", label: "Integrations", icon: Plug2 },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div>
        <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-snug)] text-[color:var(--color-text)]">
          Settings
        </h1>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Manage your organization, locations, and system configuration.
        </p>
      </div>

      {/* Settings body: sidebar + content */}
      <div className="flex gap-[var(--space-6)]">
        {/* Left nav — Apple iPadOS-style light sidebar */}
        <nav className="hidden w-[224px] shrink-0 md:block">
          <ul className="flex flex-col gap-[var(--space-1)]">
            {settingsNav.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "btn-press touch-target flex items-center gap-[var(--space-3)] rounded-[var(--radius-sm)]",
                      "px-[var(--space-3)] py-[var(--space-2)]",
                      "text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]",
                      "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                      "focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)] focus-visible:outline-offset-2",
                      isActive
                        ? "bg-[color:var(--color-sidebar-active)] text-[color:var(--color-primary)]"
                        : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-sidebar)] hover:text-[color:var(--color-text)]",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile nav — horizontal scroll */}
        <div className="mb-[var(--space-4)] flex overflow-x-auto md:hidden">
          <div className="flex gap-[var(--space-1)] border-b border-[color:var(--color-border)] pb-[var(--space-1)]">
            {settingsNav.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "btn-press touch-target flex items-center gap-[var(--space-2)] whitespace-nowrap",
                    "rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
                    "text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]",
                    "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                    isActive
                      ? "bg-[color:var(--color-sidebar-active)] text-[color:var(--color-primary)]"
                      : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-sidebar)]",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
