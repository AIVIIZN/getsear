"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Grid3x3,
  Receipt,
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
  CreditCard,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  collapsed: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const posItems: NavItem[] = [
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Tables", href: "/tables", icon: Grid3x3 },
  { label: "Checks", href: "/checks", icon: Receipt },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "KDS", href: "/kds", icon: MonitorPlay },
];

const managementItems: NavItem[] = [
  { label: "Menu", href: "/menu", icon: UtensilsCrossed },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Customers", href: "/customers", icon: Contact },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

const moduleItems: NavItem[] = [
  { label: "Online Ordering", href: "/online-ordering", icon: Globe },
  { label: "Reservations", href: "/reservations", icon: CalendarDays },
  { label: "Loyalty", href: "/loyalty", icon: Heart },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Scheduling", href: "/scheduling", icon: CalendarClock },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "Delivery", href: "/delivery", icon: Truck },
  { label: "Catering", href: "/catering", icon: ChefHat },
  { label: "House Accounts", href: "/house-accounts", icon: Wallet },
  { label: "Drive-Thru", href: "/drive-thru", icon: Car },
  { label: "Franchise", href: "/franchise", icon: Building },
];

const adminItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavSection({
  items,
  label,
  collapsed,
  pathname,
}: {
  items: NavItem[];
  label: string;
  collapsed: boolean;
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && (
        <span className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
      )}
      {collapsed && <div className="pt-2" />}
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "touch-target-lg flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              "hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
              isActive &&
                "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] hover:text-[var(--primary-foreground)]",
              !isActive && "text-[var(--sidebar-foreground)]",
              collapsed && "justify-center px-0"
            )}
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out)",
            }}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "no-select flex h-full flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]",
        "transition-[width]"
      )}
      style={{
        width: collapsed
          ? "var(--sidebar-collapsed)"
          : "var(--sidebar-expanded)",
        transitionDuration: "var(--duration-normal)",
        transitionTimingFunction: "var(--ease-out)",
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-[var(--sidebar-border)]",
          collapsed ? "justify-center px-2" : "px-4"
        )}
        style={{ height: "var(--topbar-height)" }}
      >
        <span
          className={cn(
            "font-bold tracking-tight text-[var(--primary)]",
            collapsed ? "text-lg" : "text-xl"
          )}
        >
          {collapsed ? "S" : "SEAR"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2 scrollbar-hide">
        <NavSection
          items={posItems}
          label="POS"
          collapsed={collapsed}
          pathname={pathname}
        />
        <Separator className="my-1.5 bg-[var(--sidebar-border)]" />
        <NavSection
          items={managementItems}
          label="Management"
          collapsed={collapsed}
          pathname={pathname}
        />
        <Separator className="my-1.5 bg-[var(--sidebar-border)]" />
        <NavSection
          items={moduleItems}
          label="Modules"
          collapsed={collapsed}
          pathname={pathname}
        />
        <Separator className="my-1.5 bg-[var(--sidebar-border)]" />
        <NavSection
          items={adminItems}
          label="Admin"
          collapsed={collapsed}
          pathname={pathname}
        />
      </nav>

      {/* Clock in/out indicator */}
      <div
        className={cn(
          "shrink-0 border-t border-[var(--sidebar-border)] p-2",
          collapsed ? "flex justify-center" : "px-3"
        )}
      >
        <div
          className={cn(
            "touch-target flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--sidebar-foreground)]",
            collapsed && "justify-center px-0"
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-[var(--success)]" />
          {!collapsed && (
            <span className="text-xs text-[var(--muted-foreground)]">
              Clocked In
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
