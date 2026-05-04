"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings,
  Loader2,
  ShoppingCart,
  Users,
  BarChart3,
  Utensils,
  Truck,
  Gift,
  Megaphone,
  CreditCard,
  Calendar,
  QrCode,
  Globe,
  Store,
  Wallet,
  UserCheck,
  type LucideIcon,
  Layers,
  ChefHat,
  MonitorSmartphone,
  SquareMenu,
  HeartHandshake,
  Building,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Toggle } from "@/components/ui-v2/inputs/Toggle";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Badge } from "@/components/ui-v2/data/Badge";
import { cn } from "@/lib/utils";

interface ModuleDefinition {
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: string;
  dependencies?: string[];
}

const ALL_MODULES: ModuleDefinition[] = [
  // Core
  { name: "pos", label: "Point of Sale", description: "Order entry, modifiers, and checkout flow", icon: ShoppingCart, category: "Core" },
  { name: "menu", label: "Menu Management", description: "Categories, items, modifiers, and 86 control", icon: SquareMenu, category: "Core" },
  { name: "tables", label: "Table Management", description: "Floor plans, sections, and table status tracking", icon: Layers, category: "Core" },
  { name: "payments", label: "Payment Processing", description: "Card, cash, gift card, and split payments via Valor", icon: CreditCard, category: "Core" },
  { name: "kds", label: "Kitchen Display", description: "Real-time ticket routing, aging alerts, and bump control", icon: ChefHat, category: "Core" },

  // Staff & Operations
  { name: "staff", label: "Staff Management", description: "Roster, roles, scheduling, and time clock", icon: Users, category: "Staff & Operations" },
  { name: "time_clock", label: "Time & Attendance", description: "Clock in/out, breaks, overtime, and payroll reports", icon: Calendar, category: "Staff & Operations", dependencies: ["staff"] },
  { name: "tips", label: "Tip Management", description: "Tip pooling, distribution, and Form 8027 tracking", icon: Wallet, category: "Staff & Operations", dependencies: ["staff"] },

  // Customer Engagement
  { name: "customers", label: "Customer CRM", description: "Guest profiles, visit history, and preferences", icon: UserCheck, category: "Customer Engagement" },
  { name: "loyalty", label: "Loyalty Program", description: "Points, rewards, tiers, and member cards", icon: Gift, category: "Customer Engagement", dependencies: ["customers"] },
  { name: "marketing", label: "Marketing", description: "Email campaigns, SMS blasts, and promotions", icon: Megaphone, category: "Customer Engagement", dependencies: ["customers", "loyalty"] },
  { name: "reservations", label: "Reservations", description: "Online booking, waitlist, and table assignment", icon: Calendar, category: "Customer Engagement" },

  // Ordering Channels
  { name: "online_ordering", label: "Online Ordering", description: "Web-based ordering with pickup and delivery", icon: Globe, category: "Ordering Channels" },
  { name: "kiosk", label: "Self-Order Kiosk", description: "Guest-facing ordering on dedicated tablets", icon: MonitorSmartphone, category: "Ordering Channels" },
  { name: "delivery", label: "Delivery Management", description: "Driver dispatch, tracking, and delivery zones", icon: Truck, category: "Ordering Channels", dependencies: ["online_ordering"] },
  { name: "qr_ordering", label: "QR Table Ordering", description: "Scan-to-order from the table", icon: QrCode, category: "Ordering Channels" },

  // Analytics & Reporting
  { name: "reports", label: "Reports & Analytics", description: "Sales, labor, product mix, and performance dashboards", icon: BarChart3, category: "Analytics" },
  { name: "inventory", label: "Inventory", description: "Stock tracking, low-stock alerts, and vendor orders", icon: Store, category: "Analytics" },

  // Advanced
  { name: "franchise", label: "Franchise / Multi-Unit", description: "Cross-location reporting, centralized menu, and benchmarks", icon: Building, category: "Advanced", dependencies: ["reports"] },
  { name: "catering", label: "Catering", description: "Large orders, event planning, and BEO generation", icon: Utensils, category: "Advanced" },
  { name: "integrations", label: "Third-Party Integrations", description: "DoorDash, UberEats, accounting, and more", icon: HeartHandshake, category: "Advanced" },
];

const CATEGORIES = [...new Set(ALL_MODULES.map((m) => m.category))];

interface OrgModule {
  id: string;
  module_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

const MODULE_PAGES: Record<string, string> = {
  pos: "/orders",
  menu: "/menu",
  tables: "/tables",
  payments: "/payments",
  kds: "/kds",
  staff: "/staff",
  time_clock: "/staff",
  tips: "/staff",
  customers: "/customers",
  loyalty: "/loyalty",
  marketing: "/marketing",
  reservations: "/reservations",
  online_ordering: "/online-ordering",
  kiosk: "/orders",
  delivery: "/delivery",
  qr_ordering: "/online-ordering",
  reports: "/reports",
  inventory: "/inventory",
  franchise: "/franchise",
  catering: "/catering",
  integrations: "/settings",
};

export default function ModulesPage() {
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState<OrgModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/modules");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setEnabledModules(json.data ?? []);
    } catch {
      toast.error("Failed to load modules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  function isModuleEnabled(moduleName: string): boolean {
    return enabledModules.some((m) => m.module_id === moduleName && m.is_enabled);
  }

  async function toggleModule(moduleName: string, enabled: boolean) {
    const def = ALL_MODULES.find((m) => m.name === moduleName);

    if (enabled && def?.dependencies) {
      const missingDeps = def.dependencies.filter((d) => !isModuleEnabled(d));
      if (missingDeps.length > 0) {
        const depLabels = missingDeps
          .map((d) => ALL_MODULES.find((m) => m.name === d)?.label ?? d)
          .join(", ");
        toast.error(`Enable required dependencies first: ${depLabels}`);
        return;
      }
    }

    if (!enabled) {
      const dependents = ALL_MODULES.filter(
        (m) => m.dependencies?.includes(moduleName) && isModuleEnabled(m.name)
      );
      if (dependents.length > 0) {
        const depLabels = dependents.map((d) => d.label).join(", ");
        toast.error(
          `Cannot disable: ${depLabels} depend${dependents.length === 1 ? "s" : ""} on this module`
        );
        return;
      }
    }

    setTogglingModule(moduleName);
    try {
      const res = await fetch("/api/settings/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_id: moduleName, enabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.detail ?? err.error ?? "Failed to update module");
        return;
      }
      toast.success(
        enabled ? `${def?.label ?? moduleName} enabled` : `${def?.label ?? moduleName} disabled`
      );
      fetchModules();
    } catch {
      toast.error("Network error — check your connection");
    } finally {
      setTogglingModule(null);
    }
  }

  if (loading) {
    return <ModulesSkeleton />;
  }

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          Modules
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Enable features for your organization.{" "}
          {enabledModules.filter((m) => m.is_enabled).length} of {ALL_MODULES.length} modules active.
        </p>
      </div>

      {CATEGORIES.map((category) => {
        const categoryModules = ALL_MODULES.filter((m) => m.category === category);

        return (
          <div key={category} className="flex flex-col gap-[var(--space-3)]">
            <h3 className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {category}
            </h3>
            <div className="grid gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
              {categoryModules.map((mod) => {
                const enabled = isModuleEnabled(mod.name);
                const toggling = togglingModule === mod.name;

                return (
                  <Card
                    key={mod.name}
                    variant="flat"
                    padding="default"
                    className={cn(
                      "transition-all",
                      enabled
                        ? "ring-1 ring-[color:var(--color-primary)]/20 bg-[color:var(--color-sidebar-active)]"
                        : "opacity-75 hover:opacity-100",
                    )}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-[var(--space-3)]">
                        <div className="flex items-center gap-[var(--space-3)]">
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-colors",
                              enabled
                                ? "bg-[color:var(--color-sidebar-active)] text-[color:var(--color-primary)]"
                                : "bg-[color:var(--color-bg-muted)] text-[color:var(--color-text-muted)]",
                            )}
                          >
                            <mod.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-[length:var(--type-subhead-size)]">
                              {mod.label}
                            </CardTitle>
                            {mod.dependencies && (
                              <div className="mt-[2px] flex flex-wrap gap-[var(--space-1)]">
                                {mod.dependencies.map((dep) => (
                                  <Badge key={dep} size="sm" variant="default">
                                    {ALL_MODULES.find((m) => m.name === dep)?.label ?? dep}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {toggling ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-primary)]" />
                        ) : (
                          <Toggle
                            checked={enabled}
                            onChange={(checked) => toggleModule(mod.name, checked)}
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardBody>
                      <CardDescription className="text-[length:var(--type-footnote-size)] leading-[var(--type-line-height-relaxed)]">
                        {mod.description}
                      </CardDescription>
                      {enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Settings className="h-4 w-4" />}
                          onClick={() => {
                            const page = MODULE_PAGES[mod.name];
                            if (page) {
                              router.push(page);
                            } else {
                              toast.info(`No configuration page for ${mod.label}`);
                            }
                          }}
                        >
                          Configure
                        </Button>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModulesSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-[var(--space-2)] h-4 w-72" />
      </div>
      {[1, 2, 3].map((cat) => (
        <div key={cat} className="flex flex-col gap-[var(--space-3)]">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        </div>
      ))}
    </div>
  );
}
