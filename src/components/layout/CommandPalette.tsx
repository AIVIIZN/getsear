"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Grid3x3,
  Home,
  Megaphone,
  MonitorPlay,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { helpTopics } from "@/lib/help";
import { cn } from "@/lib/utils";

type CommandAction = {
  label: string;
  href: string;
  group: "Service" | "Manager workflows" | "Back office";
  shortcut?: string;
  keywords: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const actions: CommandAction[] = [
  { label: "Open home cockpit", href: "/home", group: "Service", shortcut: "G H", keywords: "home cockpit role start", icon: Home },
  { label: "Take orders", href: "/orders", group: "Service", shortcut: "G O", keywords: "pos order menu ring in", icon: ShoppingCart },
  { label: "Seat tables", href: "/tables", group: "Service", shortcut: "G T", keywords: "floor table seat section", icon: Grid3x3 },
  { label: "Review checks", href: "/checks", group: "Service", shortcut: "G C", keywords: "checks split close", icon: Receipt },
  { label: "Collect payments", href: "/payments", group: "Service", shortcut: "G P", keywords: "payment card cash tender", icon: CreditCard },
  { label: "Open kitchen display", href: "/kds", group: "Service", shortcut: "G K", keywords: "kds kitchen expo bump", icon: MonitorPlay },
  { label: "Run Friday Night Mode", href: "/friday-night", group: "Manager workflows", keywords: "manager rush recovery service health", icon: Gauge },
  { label: "Check hardware readiness", href: "/settings/hardware-readiness", group: "Manager workflows", keywords: "printer terminal readiness setup", icon: ClipboardCheck },
  { label: "Audit manager overrides", href: "/audit-log", group: "Manager workflows", keywords: "void comp pin audit manager", icon: ShieldCheck },
  { label: "Tune menu availability", href: "/menu", group: "Manager workflows", keywords: "86 menu item modifier price", icon: ChefHat },
  { label: "View reports", href: "/reports", group: "Back office", keywords: "sales labor reporting dashboard", icon: BarChart3 },
  { label: "Manage staff", href: "/staff", group: "Back office", keywords: "schedule role pin staff", icon: Users },
  { label: "Check inventory", href: "/inventory", group: "Back office", keywords: "stock waste count inventory", icon: Package },
  { label: "Reservations", href: "/reservations", group: "Back office", keywords: "book waitlist guest reservation", icon: CalendarDays },
  { label: "Marketing campaigns", href: "/marketing", group: "Back office", keywords: "campaign segment guest email", icon: Megaphone },
  { label: "House accounts", href: "/house-accounts", group: "Back office", keywords: "account balance charge customer", icon: Wallet },
  { label: "Settings", href: "/settings", group: "Back office", keywords: "admin configuration modules", icon: Settings },
];

const groups: CommandAction["group"][] = ["Service", "Manager workflows", "Back office"];

export function CommandPaletteButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden h-9 min-w-[220px] items-center gap-2 rounded-[10px] border px-3 text-left md:flex",
          "border-[var(--border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
          "transition-colors duration-100 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]"
        )}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" strokeWidth={1.8} />
        <span className="text-[14px] leading-5">Search or run command</span>
        <span className="ml-auto rounded-md bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-subtle)]">
          Cmd K
        </span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[8px] md:hidden",
          "text-[var(--color-text-muted)] transition-colors duration-100 hover:bg-black/[0.04] active:bg-black/[0.06]"
        )}
        aria-label="Open command palette"
      >
        <Search className="h-5 w-5" strokeWidth={1.8} />
      </button>
      <SearCommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

function SearCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const grouped = useMemo(
    () => groups.map((group) => ({ group, items: actions.filter((action) => action.group === group) })),
    []
  );

  function selectAction(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sear command palette"
      description="Search service screens, manager workflows, and back-office routes."
      className="max-w-[640px] border border-[var(--border)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)]"
    >
      <Command className="rounded-[16px] bg-[var(--color-surface)]">
        <CommandInput placeholder="Find a screen, workflow, or command..." />
        <CommandList className="max-h-[420px] p-2">
          <CommandEmpty className="py-10 text-[14px] text-[var(--color-text-muted)]">
            No matching screen or workflow.
          </CommandEmpty>
          {grouped.map(({ group, items }) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.keywords}`}
                    onSelect={() => selectAction(item.href)}
                    className="min-h-12 cursor-pointer rounded-[12px] px-3 py-2"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[var(--color-primary)]">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-semibold leading-5 text-[var(--color-text)]">
                        {item.label}
                      </span>
                      <span className="truncate text-[12px] leading-4 text-[var(--color-text-muted)]">
                        {item.href}
                      </span>
                    </span>
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
          <CommandGroup heading="Help topics">
            {helpTopics.map((topic) => (
              <CommandItem
                key={topic.href}
                value={`${topic.title} ${topic.summary} ${topic.categoryName} ${topic.content}`}
                onSelect={() => selectAction(topic.href)}
                className="min-h-12 cursor-pointer rounded-[12px] px-3 py-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--color-primary)]">
                  <Search className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
                    {topic.title}
                  </span>
                  <span className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
                    {topic.categoryName}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
