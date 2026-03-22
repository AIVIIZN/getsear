"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  MapPin,
  Receipt,
  Monitor,
  Shield,
  Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { href: "/settings/organization", label: "Organization", icon: Building2 },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/tax-rates", label: "Tax Rates", icon: Receipt },
  { href: "/settings/terminals", label: "Terminals", icon: Monitor },
  { href: "/settings/roles", label: "Roles & Permissions", icon: Shield },
  { href: "/settings/modules", label: "Modules", icon: Puzzle },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization, locations, and system configuration.
        </p>
      </div>

      {/* Settings body: sidebar + content */}
      <div className="flex gap-6">
        {/* Left nav */}
        <nav className="hidden w-56 shrink-0 md:block">
          <ul className="flex flex-col gap-1">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-target",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
        <div className="mb-4 flex overflow-x-auto md:hidden">
          <div className="flex gap-1 border-b border-border pb-1">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors touch-target",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary"
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
