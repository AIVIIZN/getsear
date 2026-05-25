"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Grid3x3,
  Receipt,
  CreditCard,
  MonitorPlay,
  UtensilsCrossed,
  Users,
  Contact,
  BarChart3,
  Settings,
  Globe,
  Heart,
  CalendarDays,
  Wallet,
  Package,
  CalendarClock,
  Truck,
  Megaphone,
  Send,
  Filter,
  HandHeart,
  ChefHat,
  Car,
  Building,
  ChevronRight,
  Clock,
  ShieldCheck,
  Gauge,
  DatabaseZap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

interface NavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface NavSectionData {
  label: string;
  items: NavItem[];
}

const sections: NavSectionData[] = [
  {
    label: "POS",
    items: [
      { label: "Orders", href: "/orders", icon: ShoppingCart },
      { label: "Tables", href: "/tables", icon: Grid3x3 },
      { label: "Checks", href: "/checks", icon: Receipt },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "KDS", href: "/kds", icon: MonitorPlay },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Friday Night", shortLabel: "Friday", href: "/friday-night", icon: Gauge },
      { label: "Menu", href: "/menu", icon: UtensilsCrossed },
      { label: "Staff", href: "/staff", icon: Users },
      { label: "Guests", href: "/guests", icon: Contact },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Modules",
    items: [
      { label: "Online Ordering", shortLabel: "Online", href: "/online-ordering", icon: Globe },
      { label: "Reservations", shortLabel: "Reserve", href: "/reservations", icon: CalendarDays },
      { label: "Loyalty", href: "/loyalty", icon: Heart },
      { label: "Inventory", href: "/inventory", icon: Package },
      { label: "Scheduling", shortLabel: "Schedule", href: "/scheduling", icon: CalendarClock },
      { label: "Marketing", href: "/marketing", icon: Megaphone },
      { label: "Segments", href: "/segments", icon: Filter },
      { label: "Campaigns", href: "/campaigns", icon: Send },
      { label: "Recovery", href: "/recovery", icon: HandHeart },
      { label: "CRM Health", shortLabel: "Health", href: "/crm-health", icon: DatabaseZap },
      { label: "Delivery", href: "/delivery", icon: Truck },
      { label: "Catering", href: "/catering", icon: ChefHat },
      { label: "House Accounts", shortLabel: "Accounts", href: "/house-accounts", icon: Wallet },
      { label: "Drive-Thru", href: "/drive-thru", icon: Car },
      { label: "Franchise", href: "/franchise", icon: Building },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Audit Log", shortLabel: "Audit", href: "/audit-log", icon: ShieldCheck },
    ],
  },
];

/* ─── Apple-style sidebar row (expanded) ─── */
function SidebarRow({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-[10px] px-3 py-[9px]",
        "transition-colors duration-100",
        isActive
          ? "bg-[var(--primary)]/[0.12] text-[var(--primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-black/[0.04] active:bg-black/[0.06]"
      )}
    >
      <Icon
        className={cn(
          "h-[20px] w-[20px] shrink-0",
          isActive ? "text-[var(--primary)]" : "text-[var(--color-text-muted)]"
        )}
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      <span
        className={cn(
          "text-[15px] leading-[20px] truncate",
          isActive ? "font-semibold" : "font-normal"
        )}
      >
        {item.label}
      </span>
      {isActive && (
        <ChevronRight className="ml-auto h-[14px] w-[14px] shrink-0 text-[var(--primary)]/60" />
      )}
    </Link>
  );
}

/* ─── Apple-style sidebar icon (collapsed) ─── */
function SidebarIcon({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center justify-center gap-[2px] rounded-[10px] py-[6px] px-1",
        "transition-colors duration-100",
        isActive
          ? "bg-[var(--primary)]/[0.12] text-[var(--primary)]"
          : "text-[var(--color-text-muted)] hover:bg-black/[0.04] active:bg-black/[0.06]"
      )}
      style={{ minHeight: 48 }}
      title={item.label}
    >
      <Icon
        className="h-[22px] w-[22px] shrink-0"
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      <span
        className={cn(
          "text-[10px] leading-[12px] font-medium",
          isActive ? "text-[var(--primary)]" : "text-[var(--color-text-muted)]"
        )}
      >
        {(item.shortLabel ?? item.label).length > 8
          ? (item.shortLabel ?? item.label).slice(0, 7) + "…"
          : (item.shortLabel ?? item.label)}
      </span>
    </Link>
  );
}

/* ─── Section (collapsible in expanded, flat in collapsed) ─── */
function SidebarSection({
  section,
  collapsed,
  pathname,
  defaultOpen = true,
}: {
  section: NavSectionData;
  collapsed: boolean;
  pathname: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="flex flex-col gap-[2px] px-[6px]">
        {section.items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return <SidebarIcon key={item.href} item={item} isActive={active} />;
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Section header — Apple style: small gray uppercase */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 pb-1 pt-2"
      >
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
          {section.label}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-[1px] px-2">
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return <SidebarRow key={item.href} item={item} isActive={active} />;
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Sidebar ─── */
export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="no-select flex h-full flex-col overflow-hidden"
      style={{
        width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-expanded)",
        transition: "width 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        background: "var(--color-bg-muted)",
        borderRight: "0.5px solid rgba(60, 60, 67, 0.12)",
      }}
    >
      {/* Logo area */}
      <div
        className="flex shrink-0 items-center px-4"
        style={{
          height: "var(--topbar-height)",
          borderBottom: "0.5px solid rgba(60, 60, 67, 0.12)",
        }}
      >
        {collapsed ? (
          <div className="flex w-full justify-center">
            <span className="text-[18px] font-bold tracking-tight text-[var(--primary)]">
              S
            </span>
          </div>
        ) : (
          <span className="text-[18px] font-bold tracking-tight text-[var(--primary)]">
            SEAR
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto py-2 scrollbar-hide">
        {sections.map((section) => (
          <SidebarSection
            key={section.label}
            section={section}
            collapsed={collapsed}
            pathname={pathname}
            defaultOpen={true}
          />
        ))}
      </nav>

      {/* Clock status — bottom */}
      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: "0.5px solid rgba(60, 60, 67, 0.12)" }}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "justify-center" : "px-1"
          )}
        >
          <div className="relative">
            <Clock className="h-4 w-4 shrink-0 text-[var(--color-success-strong)]" />
            <div
              className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-[var(--color-success-strong)]"
              style={{ boxShadow: "0 0 0 2px var(--color-bg-muted)" }}
            />
          </div>
          {!collapsed && (
            <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
              Clocked In
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
