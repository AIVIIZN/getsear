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
  ChefHat,
  Car,
  Building,
  ChevronDown,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
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
      { label: "Menu", href: "/menu", icon: UtensilsCrossed },
      { label: "Staff", href: "/staff", icon: Users },
      { label: "Customers", href: "/customers", icon: Contact },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Modules",
    items: [
      { label: "Online", href: "/online-ordering", icon: Globe },
      { label: "Reserve", href: "/reservations", icon: CalendarDays },
      { label: "Loyalty", href: "/loyalty", icon: Heart },
      { label: "Inventory", href: "/inventory", icon: Package },
      { label: "Schedule", href: "/scheduling", icon: CalendarClock },
      { label: "Marketing", href: "/marketing", icon: Megaphone },
      { label: "Delivery", href: "/delivery", icon: Truck },
      { label: "Catering", href: "/catering", icon: ChefHat },
      { label: "Accounts", href: "/house-accounts", icon: Wallet },
      { label: "Drive-Thru", href: "/drive-thru", icon: Car },
      { label: "Franchise", href: "/franchise", icon: Building },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

function CollapsedNavItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "btn-press flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-1",
        "transition-colors",
        isActive
          ? "bg-[var(--sidebar-primary)] text-white"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
      )}
      style={{
        minHeight: 56,
        transitionDuration: "var(--duration-fast)",
      }}
    >
      <Icon className="h-[22px] w-[22px] shrink-0" />
      <span className="text-caption-2 font-medium leading-tight">
        {item.label.length > 7 ? item.label.slice(0, 6) + "…" : item.label}
      </span>
    </Link>
  );
}

function ExpandedNavItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "btn-press flex items-center gap-3 rounded-xl px-3 text-subhead font-medium",
        "transition-colors",
        isActive
          ? "bg-[var(--sidebar-primary)] text-white"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
      )}
      style={{
        minHeight: 44,
        transitionDuration: "var(--duration-fast)",
      }}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SectionGroup({
  section,
  collapsed,
  pathname,
  defaultOpen = true,
}: {
  section: NavSection;
  collapsed: boolean;
  pathname: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 px-1.5">
        {section.items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <CollapsedNavItem key={item.href} item={item} isActive={isActive} />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-press flex items-center justify-between px-4 py-2 text-caption-1 font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]"
      >
        <span>{section.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            !isOpen && "-rotate-90"
          )}
          style={{ transitionDuration: "var(--duration-normal)" }}
        />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 px-2">
          {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <ExpandedNavItem
                key={item.href}
                item={item}
                isActive={isActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "no-select flex h-full flex-col bg-[var(--sidebar)] overflow-hidden"
      )}
      style={{
        width: collapsed
          ? "var(--sidebar-collapsed)"
          : "var(--sidebar-expanded)",
        transition: "width var(--duration-slow) var(--ease-spring)",
      }}
    >
      {/* Logo */}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          height: "var(--topbar-height)",
          borderBottom: "0.5px solid var(--sidebar-border)",
        }}
      >
        <span
          className={cn(
            "font-bold tracking-tight text-[var(--sidebar-primary)]",
            collapsed ? "text-[20px]" : "text-[22px]"
          )}
        >
          {collapsed ? "S" : "SEAR"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto py-3 scrollbar-hide scroll-container">
        {sections.map((section, i) => (
          <div key={section.label}>
            {i > 0 && (
              <div
                className="mx-3 mb-3"
                style={{
                  borderBottom: "0.5px solid var(--sidebar-border)",
                }}
              />
            )}
            <SectionGroup
              section={section}
              collapsed={collapsed}
              pathname={pathname}
              defaultOpen={section.label === "POS" || section.label === "Management"}
            />
          </div>
        ))}
      </nav>

      {/* Clock in/out indicator */}
      <div
        className="shrink-0 flex items-center justify-center px-2 py-3"
        style={{
          borderTop: "0.5px solid var(--sidebar-border)",
        }}
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2",
            collapsed ? "justify-center" : ""
          )}
        >
          <div className="relative">
            <Clock className="h-4 w-4 shrink-0 text-[var(--success)]" />
            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--success)] animate-pulse-dot" />
          </div>
          {!collapsed && (
            <span className="text-caption-1 font-medium text-[var(--sidebar-muted)]">
              Clocked In
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
