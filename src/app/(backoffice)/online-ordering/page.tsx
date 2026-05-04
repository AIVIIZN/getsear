"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Check,
  X,
  Clock,
  Pause,
  Play,
  Settings2,
  Globe,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  DollarSign,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { QRCodeGenerator } from "@/components/online-ordering/QRCodeGenerator";
import { OrderQueuePanel } from "@/components/online-ordering/OrderQueuePanel";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Text } from "@/components/ui-v2/inputs/Text";
import { NumberInput } from "@/components/ui-v2/inputs/Number";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Toggle } from "@/components/ui-v2/inputs/Toggle";
import { Textarea } from "@/components/ui-v2/inputs/Textarea";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Badge, type BadgeProps } from "@/components/ui-v2/data/Badge";
import { Tabs } from "@/components/ui-v2/navigation/Tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui-v2/Sheet";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui-v2/Modal";
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnlineMenu {
  id: string;
  org_id: string;
  location_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  settings: MenuSettings;
  created_at: string;
  updated_at: string;
}

interface MenuSettings {
  theme_color?: string;
  logo_url?: string | null;
  min_order_amount?: number;
  delivery_fee?: number;
  pickup_lead_time?: number;
  delivery_lead_time?: number;
  max_orders_per_hour?: number;
  auto_accept?: boolean;
}

interface OnlineMenuItem {
  id: string;
  online_menu_id: string;
  menu_item_id: string;
  is_available: boolean;
  online_price: number | null;
  sort_order: number;
}

interface QueueOrder {
  id: string;
  org_id: string;
  location_id: string;
  order_id: string;
  status: string;
  channel: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  pickup_time: string | null;
  delivery_address: Record<string, string> | null;
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

interface ThrottleSettings {
  max_orders_per_15_min: number;
  max_orders_per_hour: number;
  is_paused: boolean;
  pause_reason: string | null;
  current_count_15min: number;
  current_count_hour: number;
}

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "pending":
      return "warning";
    case "accepted":
      return "info";
    case "rejected":
      return "danger";
    case "preparing":
      return "primary";
    default:
      return "default";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnlineOrderingPage() {
  const [activeTab, setActiveTab] = useState("queue");

  // Queue state
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<string>("pending");

  // Menu config state
  const [menus, setMenus] = useState<OnlineMenu[]>([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<OnlineMenu | null>(null);
  const [menuItems, setMenuItems] = useState<OnlineMenuItem[]>([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<ThrottleSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSavingSettings] = useState(false);

  // Create menu sheet
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuSlug, setNewMenuSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // Reject dialog
  const [rejectOrder, setRejectOrder] = useState<QueueOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Accepting
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    max_orders_per_15_min: 10,
    max_orders_per_hour: 30,
    is_paused: false,
    auto_accept: false,
  });

  // ---------- Fetch Queue ----------
  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const params = new URLSearchParams();
      if (queueFilter) params.set("status", queueFilter);
      const res = await fetch(`/api/online-ordering/queue?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      const json = await res.json();
      setQueue(json.data ?? []);
    } catch {
      toast.error("Failed to load order queue");
    } finally {
      setQueueLoading(false);
    }
  }, [queueFilter]);

  // ---------- Fetch Menus ----------
  const fetchMenus = useCallback(async () => {
    setMenusLoading(true);
    try {
      const res = await fetch("/api/online-ordering/menus");
      if (!res.ok) throw new Error("Failed to fetch menus");
      const json = await res.json();
      setMenus(json.data ?? []);
    } catch {
      toast.error("Failed to load online menus");
    } finally {
      setMenusLoading(false);
    }
  }, []);

  // ---------- Fetch Settings ----------
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/online-ordering/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const json = await res.json();
      const s = json.data as ThrottleSettings;
      setSettings(s);
      setSettingsForm({
        max_orders_per_15_min: s.max_orders_per_15_min,
        max_orders_per_hour: s.max_orders_per_hour,
        is_paused: s.is_paused,
        auto_accept: false,
      });
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // ---------- Fetch menu items ----------
  const fetchMenuItems = useCallback(async (menuId: string) => {
    setMenuItemsLoading(true);
    try {
      const res = await fetch(`/api/online-ordering/menus/${menuId}/items`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const json = await res.json();
      setMenuItems(json.data ?? []);
    } catch {
      toast.error("Failed to load menu items");
    } finally {
      setMenuItemsLoading(false);
    }
  }, []);

  // ---------- Initial loads ----------
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (activeTab === "menus") fetchMenus();
  }, [activeTab, fetchMenus]);

  useEffect(() => {
    if (activeTab === "settings") fetchSettings();
  }, [activeTab, fetchSettings]);

  useEffect(() => {
    if (selectedMenu) fetchMenuItems(selectedMenu.id);
  }, [selectedMenu, fetchMenuItems]);

  // ---------- Accept Order ----------
  async function handleAccept(order: QueueOrder) {
    setAcceptingId(order.id);
    try {
      const res = await fetch(`/api/online-ordering/queue/${order.id}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to accept");
      }
      toast.success("Order accepted");
      fetchQueue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to accept order");
    } finally {
      setAcceptingId(null);
    }
  }

  // ---------- Reject Order ----------
  async function handleReject() {
    if (!rejectOrder || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/online-ordering/queue/${rejectOrder.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to reject");
      }
      toast.success("Order rejected");
      setRejectOrder(null);
      setRejectReason("");
      fetchQueue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject order");
    } finally {
      setRejecting(false);
    }
  }

  // ---------- Create Menu ----------
  async function handleCreateMenu() {
    if (!newMenuName.trim() || !newMenuSlug.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/online-ordering/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMenuName.trim(),
          slug: newMenuSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          location_id: "00000000-0000-0000-0000-000000000000", // placeholder
          is_active: false,
          settings: {},
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create");
      }
      toast.success("Online menu created");
      setShowCreateMenu(false);
      setNewMenuName("");
      setNewMenuSlug("");
      fetchMenus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create menu");
    } finally {
      setCreating(false);
    }
  }

  // ---------- Toggle menu active ----------
  async function toggleMenuActive(menu: OnlineMenu) {
    try {
      const res = await fetch(`/api/online-ordering/menus/${menu.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !menu.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(menu.is_active ? "Menu deactivated" : "Menu activated");
      fetchMenus();
    } catch {
      toast.error("Failed to toggle menu");
    }
  }

  // ---------- Save Settings ----------
  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/online-ordering/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Settings saved");
      fetchSettings();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Online Ordering</h1>
          <p className="page-subtitle">
            Manage incoming online orders, menus, and throttle settings
          </p>
        </div>
        {settings && (
          <Badge variant={settings.is_paused ? "danger" : "success"}>
            {settings.is_paused ? (
              <>
                <Pause className="mr-1 h-3 w-3" /> Paused
              </>
            ) : (
              <>
                <Play className="mr-1 h-3 w-3" /> Active
              </>
            )}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
        <Tabs
          variant="line"
          size="md"
          value={activeTab}
          onValueChange={setActiveTab}
          ariaLabel="Online ordering sections"
          items={[
            { value: "queue", label: "Live Queue", icon: <ShoppingBag /> },
            { value: "incoming", label: "Order Queue", icon: <ShoppingCart /> },
            { value: "qr-codes", label: "QR Codes", icon: <QrCode /> },
            { value: "menus", label: "Menu Config", icon: <Globe /> },
            { value: "settings", label: "Settings", icon: <Settings2 /> },
          ]}
        />
      </div>

      {/* ==================== LIVE QUEUE (New Component) ==================== */}
      {activeTab === "incoming" && (
        <div role="tabpanel" aria-label="Order Queue" className="space-y-4">
          <OrderQueuePanel />
        </div>
      )}

      {/* ==================== QR CODES ==================== */}
      {activeTab === "qr-codes" && (
        <div role="tabpanel" aria-label="QR Codes" className="space-y-4">
          <QRCodeGenerator locationId="" />
        </div>
      )}

      {/* ==================== ORDER QUEUE ==================== */}
      {activeTab === "queue" && (
        <div role="tabpanel" aria-label="Live Queue" className="space-y-4">
          <div className="flex items-center gap-[var(--space-3)]">
            <Select
              size="md"
              value={queueFilter}
              onChange={setQueueFilter}
              ariaLabel="Filter by status"
              className="w-[180px]"
              options={[
                { value: "pending", label: "Pending" },
                { value: "accepted", label: "Accepted" },
                { value: "rejected", label: "Rejected" },
                { value: "preparing", label: "Preparing" },
              ]}
            />
            <Button
              variant="secondary"
              size="md"
              aria-label="Refresh"
              onClick={fetchQueue}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="ml-auto text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
              {queue.length} order{queue.length !== 1 ? "s" : ""}
            </div>
          </div>

          {queueLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders in queue"
              description={`No ${queueFilter} orders at the moment.`}
            />
          ) : (
            <div className="space-y-3">
              {queue.map((order) => (
                <Card key={order.id} variant="elevated" padding="compact">
                  <div className="flex items-start justify-between gap-[var(--space-4)]">
                    {/* Left */}
                    <div className="flex-1 space-y-[var(--space-1)]">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <span className="font-[var(--weight-semibold)]">
                          {order.customer_name || "Guest"}
                        </span>
                        <Badge variant={statusVariant(order.status)}>
                          {order.status}
                        </Badge>
                        <Badge variant="default" size="sm">
                          {order.channel || "web"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-[var(--space-3)] text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
                        {order.customer_phone && (
                          <span className="flex items-center gap-[var(--space-1)]">
                            <Phone className="h-3 w-3" />
                            {order.customer_phone}
                          </span>
                        )}
                        {order.customer_email && (
                          <span className="flex items-center gap-[var(--space-1)]">
                            <Mail className="h-3 w-3" />
                            {order.customer_email}
                          </span>
                        )}
                        {order.pickup_time && (
                          <span className="flex items-center gap-[var(--space-1)]">
                            <Clock className="h-3 w-3" />
                            Pickup: {formatTime(order.pickup_time)}
                          </span>
                        )}
                        {order.delivery_address && (
                          <span className="flex items-center gap-[var(--space-1)]">
                            <MapPin className="h-3 w-3" />
                            Delivery
                          </span>
                        )}
                      </div>
                      {order.notes && (
                        <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] italic">
                          {order.notes}
                        </p>
                      )}
                      <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                        {timeAgo(order.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    {order.status === "pending" && (
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Button
                          size="md"
                          loading={acceptingId === order.id}
                          leadingIcon={<Check />}
                          onClick={() => handleAccept(order)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="destructive"
                          size="md"
                          leadingIcon={<X />}
                          onClick={() => {
                            setRejectOrder(order);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {order.status === "rejected" && order.rejection_reason && (
                      <p className="text-[length:var(--type-subhead-size)] text-[var(--color-danger)] max-w-[200px]">
                        {order.rejection_reason}
                      </p>
                    )}
                    {order.status === "accepted" && (
                      <p className="text-[length:var(--type-subhead-size)] text-[var(--color-primary)]">
                        Accepted {formatDateTime(order.accepted_at)}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== MENU CONFIG ==================== */}
      {activeTab === "menus" && (
        <div role="tabpanel" aria-label="Menu Config" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
              Configure menus available for online ordering
            </p>
            <Button size="md" leadingIcon={<Plus />} onClick={() => setShowCreateMenu(true)}>
              New Menu
            </Button>
          </div>

          {menusLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : menus.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No online menus"
              description="Create an online menu to start accepting orders."
              action={{ label: "New Menu", onClick: () => setShowCreateMenu(true) }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {menus.map((menu) => (
                <Card
                  key={menu.id}
                  variant="interactive"
                  padding="compact"
                  onClick={() => setSelectedMenu(menu)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[length:var(--type-headline-size)]">
                        {menu.name}
                      </CardTitle>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Toggle
                          checked={menu.is_active}
                          onChange={() => toggleMenuActive(menu)}
                        />
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="flex items-center gap-[var(--space-3)] text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
                      <Badge variant="default">/{menu.slug}</Badge>
                      <Badge variant={menu.is_active ? "success" : "default"}>
                        {menu.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-[var(--space-1)] mt-[var(--space-2)] text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                      <span>Click to manage items</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {/* Menu Items Sheet */}
          <Sheet
            open={!!selectedMenu}
            onOpenChange={(open) => {
              if (!open) setSelectedMenu(null);
            }}
          >
            <SheetContent width="lg">
              <SheetHeader>
                <SheetTitle>{selectedMenu?.name} — Items</SheetTitle>
                <SheetDescription>
                  Toggle availability and set online pricing
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                {menuItemsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-12 w-full rounded-[var(--radius-md)]"
                      />
                    ))}
                  </div>
                ) : menuItems.length === 0 ? (
                  <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] py-8 text-center">
                    No items linked to this menu yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {menuItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border)]"
                      >
                        <div className="flex items-center gap-[var(--space-3)]">
                          {item.is_available ? (
                            <Eye className="h-4 w-4 text-[var(--color-success)]" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-[var(--color-text-muted)]" />
                          )}
                          <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]">
                            Item {item.menu_item_id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-[var(--space-2)]">
                          {item.online_price !== null && (
                            <Badge variant="default" className="tabular-nums">
                              <DollarSign className="h-3 w-3 mr-0.5" />
                              {item.online_price.toFixed(2)}
                            </Badge>
                          )}
                          <Badge variant={item.is_available ? "success" : "default"}>
                            {item.is_available ? "Available" : "Hidden"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SheetBody>
            </SheetContent>
          </Sheet>

          {/* Create Menu Sheet */}
          <Sheet open={showCreateMenu} onOpenChange={setShowCreateMenu}>
            <SheetContent width="md">
              <SheetHeader>
                <SheetTitle>New Online Menu</SheetTitle>
                <SheetDescription>
                  Create a new menu for your online ordering portal
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <div className="space-y-4">
                  <Text
                    label="Menu Name"
                    placeholder="e.g. Lunch Menu"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                  />
                  <Text
                    label="URL Slug"
                    placeholder="e.g. lunch-menu"
                    value={newMenuSlug}
                    onChange={(e) =>
                      setNewMenuSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      )
                    }
                    helper={`Appears in the URL: /order/${newMenuSlug || "your-slug"}`}
                  />
                </div>
              </SheetBody>
              <div className="border-t border-[var(--color-border)] px-[var(--space-6)] py-[var(--space-4)] [padding-bottom:max(var(--space-4),env(safe-area-inset-bottom))]">
                <Button
                  size="lg"
                  className="w-full"
                  loading={creating}
                  disabled={!newMenuName.trim() || !newMenuSlug.trim()}
                  leadingIcon={<Plus />}
                  onClick={handleCreateMenu}
                >
                  Create Menu
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ==================== SETTINGS ==================== */}
      {activeTab === "settings" && (
        <div role="tabpanel" aria-label="Settings" className="space-y-6">
          {settingsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : (
            <>
              {/* Current status card */}
              {settings && (
                <Card variant="elevated" padding="default">
                  <CardHeader>
                    <CardTitle className="text-[length:var(--type-headline-size)]">
                      Current Status
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--space-4)]">
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Orders (15 min)
                        </p>
                        <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] tabular-nums">
                          {settings.current_count_15min}
                          <span className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] font-normal">
                            /{settings.max_orders_per_15_min}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Orders (1 hour)
                        </p>
                        <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] tabular-nums">
                          {settings.current_count_hour}
                          <span className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] font-normal">
                            /{settings.max_orders_per_hour}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Status
                        </p>
                        <Badge
                          variant={settings.is_paused ? "danger" : "success"}
                          className="mt-[var(--space-1)]"
                        >
                          {settings.is_paused ? "Paused" : "Accepting Orders"}
                        </Badge>
                      </div>
                      {settings.pause_reason && (
                        <div>
                          <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                            Pause Reason
                          </p>
                          <p className="text-[length:var(--type-subhead-size)]">
                            {settings.pause_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}

              <div className="border-t border-[var(--color-border)]" />

              {/* Throttle Settings */}
              <Card variant="elevated" padding="default">
                <CardHeader>
                  <CardTitle className="text-[length:var(--type-headline-size)]">
                    Throttle Limits
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-[var(--space-4)] md:grid-cols-2">
                    <NumberInput
                      label="Max orders per 15 minutes"
                      min={1}
                      max={999}
                      value={settingsForm.max_orders_per_15_min}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          max_orders_per_15_min: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                    />
                    <NumberInput
                      label="Max orders per hour"
                      min={1}
                      max={9999}
                      value={settingsForm.max_orders_per_hour}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          max_orders_per_hour: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                    />
                  </div>

                  <div className="border-t border-[var(--color-border)]" />

                  <Toggle
                    label="Pause Online Ordering"
                    helper="Temporarily stop accepting online orders"
                    checked={settingsForm.is_paused}
                    onChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, is_paused: checked }))
                    }
                  />

                  <Toggle
                    label="Auto-Accept Orders"
                    helper="Automatically accept incoming orders without manual review"
                    checked={settingsForm.auto_accept}
                    onChange={(checked) =>
                      setSettingsForm((prev) => ({ ...prev, auto_accept: checked }))
                    }
                  />
                </CardBody>
              </Card>

              <div className="flex justify-end">
                <Button
                  size="md"
                  loading={settingsSaving}
                  leadingIcon={<Check />}
                  onClick={handleSaveSettings}
                >
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        open={!!rejectOrder}
        onOpenChange={(open) => {
          if (!open) {
            setRejectOrder(null);
            setRejectReason("");
          }
        }}
      >
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Reject Order</ModalTitle>
            <ModalDescription>
              Provide a reason for rejecting the order from{" "}
              {rejectOrder?.customer_name || "Guest"}.
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <Textarea
              label="Reason"
              placeholder="e.g. Kitchen closed, item out of stock..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setRejectOrder(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              loading={rejecting}
              disabled={!rejectReason.trim()}
              leadingIcon={<X />}
              onClick={handleReject}
            >
              Reject Order
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
