"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Grid3x3,
  MonitorPlay,
  Package,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

type HomeRole = "owner" | "manager" | "server" | "kitchen" | "default";

type HomeAction = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "primary" | "success" | "warning" | "neutral";
};

type ManagerWorkflow = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  steps: string[];
};

const roleActions: Record<HomeRole, HomeAction[]> = {
  owner: [
    { title: "Open service cockpit", description: "See the floor, checks, and kitchen pressure before the rush.", href: "/friday-night", icon: Gauge, tone: "primary" },
    { title: "Review sales pulse", description: "Jump to reporting for revenue, labor, and day-part trends.", href: "/reports", icon: BarChart3, tone: "neutral" },
    { title: "Inspect overrides", description: "Audit voids, comps, and manager PIN activity.", href: "/audit-log", icon: ShieldCheck, tone: "warning" },
  ],
  manager: [
    { title: "Run dinner service", description: "Start with the live rush board and recovery cues.", href: "/friday-night", icon: Gauge, tone: "primary" },
    { title: "Tune menu availability", description: "Update items, modifiers, and 86 status before tickets stack up.", href: "/menu", icon: ChefHat, tone: "warning" },
    { title: "Check staff coverage", description: "Review staff, roles, and scheduling context.", href: "/staff", icon: Users, tone: "neutral" },
  ],
  server: [
    { title: "Start an order", description: "Ring items, attach guests, and send tickets to the kitchen.", href: "/orders", icon: ShoppingCart, tone: "primary" },
    { title: "Seat a table", description: "Move through the floor plan and keep turns visible.", href: "/tables", icon: Grid3x3, tone: "success" },
    { title: "Close checks", description: "Split, tender, and receipt checks without leaving service.", href: "/checks", icon: Receipt, tone: "neutral" },
  ],
  kitchen: [
    { title: "Open KDS", description: "Work tickets by station, aging, refires, and all-day counts.", href: "/kds", icon: MonitorPlay, tone: "primary" },
    { title: "Review menu status", description: "Confirm availability before service hits peak volume.", href: "/menu", icon: ChefHat, tone: "warning" },
    { title: "Check inventory risk", description: "Look at low-stock and waste signals.", href: "/inventory", icon: Package, tone: "neutral" },
  ],
  default: [
    { title: "Take orders", description: "Go straight to the fastest dinner-service entry point.", href: "/orders", icon: ShoppingCart, tone: "primary" },
    { title: "Watch the floor", description: "Seat tables, move checks, and protect turns.", href: "/tables", icon: Grid3x3, tone: "success" },
    { title: "Collect payment", description: "Close the check and keep the line moving.", href: "/payments", icon: CreditCard, tone: "neutral" },
  ],
};

const managerWorkflows: ManagerWorkflow[] = [
  {
    title: "Rush rescue",
    description: "Find the pressure point, recover tables, and verify the fix.",
    href: "/friday-night",
    icon: Gauge,
    steps: ["Open Friday Night Mode", "Check who needs help now", "Move to tables or KDS"],
  },
  {
    title: "Printer and terminal readiness",
    description: "Confirm hardware health before service starts.",
    href: "/settings/hardware-readiness",
    icon: ClipboardCheck,
    steps: ["Review device status", "Run readiness checks", "Confirm receipt path"],
  },
  {
    title: "Void and comp audit",
    description: "Review manager PIN decisions while the shift is still fresh.",
    href: "/audit-log",
    icon: ShieldCheck,
    steps: ["Filter manager overrides", "Inspect void and comp reasons", "Follow up with staff"],
  },
  {
    title: "Low-stock menu response",
    description: "Connect inventory risk to menu availability.",
    href: "/inventory",
    icon: AlertTriangle,
    steps: ["Check inventory dashboard", "Update menu availability", "Return to service"],
  },
];

const dinnerPath: HomeAction[] = [
  { title: "Orders", description: "Ring and send", href: "/orders", icon: ShoppingCart, tone: "primary" },
  { title: "Tables", description: "Seat and turn", href: "/tables", icon: Grid3x3, tone: "success" },
  { title: "KDS", description: "Cook and bump", href: "/kds", icon: MonitorPlay, tone: "warning" },
  { title: "Checks", description: "Split and close", href: "/checks", icon: Receipt, tone: "neutral" },
];

function getHomeRole(role?: string): HomeRole {
  const normalized = role?.toLowerCase() ?? "";
  if (["owner", "admin"].includes(normalized)) return "owner";
  if (["manager", "gm", "shift_lead"].includes(normalized)) return "manager";
  if (["server", "bartender", "cashier"].includes(normalized)) return "server";
  if (["kitchen", "cook", "expo"].includes(normalized)) return "kitchen";
  return "default";
}

function toneClass(tone: HomeAction["tone"]) {
  return {
    primary: "bg-[var(--accent)] text-[var(--color-primary)]",
    success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
    warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
    neutral: "bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]",
  }[tone];
}

function ActionCard({ action, compact = false }: { action: HomeAction; compact?: boolean }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className={cn(
        "group flex min-h-[124px] flex-col justify-between rounded-[8px] border border-[var(--border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]",
        "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        compact && "min-h-[104px] p-4"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-[8px]", toneClass(action.tone))}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <ArrowRight className="h-5 w-5 text-[var(--color-text-subtle)] transition-transform duration-150 group-hover:translate-x-1" />
      </div>
      <div className="mt-4">
        <h2 className="text-[16px] font-semibold leading-6 text-[var(--color-text)]">{action.title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-muted)]">{action.description}</p>
      </div>
    </Link>
  );
}

function WorkflowCard({ workflow }: { workflow: ManagerWorkflow }) {
  const Icon = workflow.icon;

  return (
    <Link
      href={workflow.href}
      className="group rounded-[8px] border border-[var(--border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-all duration-150 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-bg-muted)] text-[var(--color-text)]">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold leading-6 text-[var(--color-text)]">{workflow.title}</h2>
            <ArrowRight className="h-5 w-5 shrink-0 text-[var(--color-text-subtle)] transition-transform duration-150 group-hover:translate-x-1" />
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-muted)]">{workflow.description}</p>
        </div>
      </div>
      <ol className="mt-4 grid gap-2">
        {workflow.steps.map((step, index) => (
          <li key={step} className="flex items-center gap-3 text-[13px] leading-5 text-[var(--color-text-secondary)]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-[var(--color-primary)]">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </Link>
  );
}

export default function HomeCockpitPage() {
  const user = useAuthStore((s) => s.user);
  const homeRole = getHomeRole(user?.role);
  const actions = roleActions[homeRole];
  const roleLabel = homeRole === "default" ? "service" : homeRole;

  return (
    <div className="space-y-6">
      <section className="rounded-[8px] border border-[var(--border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
              One cockpit
            </p>
            <h1 className="mt-2 text-[28px] font-semibold leading-9 text-[var(--color-text)]">
              {user?.display_name ? `${user.display_name}'s home screen` : "Role-based home screen"}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[var(--color-text-muted)]">
              A {roleLabel} start point for dinner service: the fastest service routes stay visible, manager workflows stay guided, and the command palette keeps the rest searchable.
            </p>
          </div>
          <div className="flex min-h-12 items-center gap-3 rounded-[8px] bg-[var(--color-bg-muted)] px-4">
            <Search className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-semibold leading-5 text-[var(--color-text)]">Command palette</p>
              <p className="text-[12px] leading-4 text-[var(--color-text-muted)]">Press Command-K from any service screen.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {actions.map((action) => (
          <ActionCard key={action.href} action={action} />
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold leading-7 text-[var(--color-text)]">Dinner-service path</h2>
            <p className="text-[14px] leading-5 text-[var(--color-text-muted)]">
              The sidebar mirrors this sequence so servers avoid module hunting during the rush.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dinnerPath.map((action) => (
            <ActionCard key={action.href} action={action} compact />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[20px] font-semibold leading-7 text-[var(--color-text)]">Guided manager workflows</h2>
          <p className="text-[14px] leading-5 text-[var(--color-text-muted)]">
            Each workflow lands on a real operational screen with the next check already named.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {managerWorkflows.map((workflow) => (
            <WorkflowCard key={workflow.href} workflow={workflow} />
          ))}
        </div>
      </section>
    </div>
  );
}
