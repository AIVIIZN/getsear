"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Loader2,
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
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

function statusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-warning/10 text-warning border-warning/20";
    case "accepted":
      return "bg-info/10 text-info border-info/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "preparing":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    default:
      return "bg-muted text-muted-foreground";
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Online Ordering
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage incoming online orders, menus, and throttle settings
          </p>
        </div>
        {settings && (
          <Badge
            variant="outline"
            className={
              settings.is_paused
                ? "border-destructive text-destructive"
                : "border-success text-success"
            }
          >
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
      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="queue" className="touch-target-lg gap-2">
            <ShoppingCart className="h-4 w-4" />
            Order Queue
          </TabsTrigger>
          <TabsTrigger value="menus" className="touch-target-lg gap-2">
            <Globe className="h-4 w-4" />
            Menu Config
          </TabsTrigger>
          <TabsTrigger value="settings" className="touch-target-lg gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ==================== ORDER QUEUE ==================== */}
        <TabsContent value="queue" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select
              value={queueFilter}
              onValueChange={(v) => v && setQueueFilter(v)}
            >
              <SelectTrigger className="w-[180px] touch-target-lg">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchQueue}
              className="touch-target-lg"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              {queue.length} order{queue.length !== 1 ? "s" : ""}
            </div>
          </div>

          {queueLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
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
                <Card key={order.id} className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {order.customer_name || "Guest"}
                          </span>
                          <Badge
                            variant="outline"
                            className={statusColor(order.status)}
                          >
                            {order.status}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {order.channel || "web"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {order.customer_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {order.customer_phone}
                            </span>
                          )}
                          {order.customer_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {order.customer_email}
                            </span>
                          )}
                          {order.pickup_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Pickup: {formatTime(order.pickup_time)}
                            </span>
                          )}
                          {order.delivery_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Delivery
                            </span>
                          )}
                        </div>
                        {order.notes && (
                          <p className="text-sm text-muted-foreground italic">
                            {order.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(order.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      {order.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="touch-target-lg btn-press"
                            onClick={() => handleAccept(order)}
                            disabled={acceptingId === order.id}
                          >
                            {acceptingId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="touch-target-lg btn-press"
                            onClick={() => {
                              setRejectOrder(order);
                              setRejectReason("");
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {order.status === "rejected" && order.rejection_reason && (
                        <p className="text-sm text-destructive max-w-[200px]">
                          {order.rejection_reason}
                        </p>
                      )}
                      {order.status === "accepted" && (
                        <p className="text-sm text-info">
                          Accepted {formatDateTime(order.accepted_at)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== MENU CONFIG ==================== */}
        <TabsContent value="menus" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Configure menus available for online ordering
            </p>
            <Button
              className="touch-target-lg btn-press"
              onClick={() => setShowCreateMenu(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Menu
            </Button>
          </div>

          {menusLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg" />
              ))}
            </div>
          ) : menus.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No online menus"
              description="Create an online menu to start accepting orders."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {menus.map((menu) => (
                <Card
                  key={menu.id}
                  className="shadow-warm-sm cursor-pointer hover:shadow-warm-md transition-shadow"
                  onClick={() => setSelectedMenu(menu)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{menu.name}</CardTitle>
                      <Switch
                        checked={menu.is_active}
                        onCheckedChange={(e) => {
                          e; // prevent propagation used by parent onClick
                          toggleMenuActive(menu);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">/{menu.slug}</Badge>
                      <Badge variant={menu.is_active ? "default" : "secondary"}>
                        {menu.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <span>Click to manage items</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </CardContent>
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
            <SheetContent className="sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>{selectedMenu?.name} — Items</SheetTitle>
                <SheetDescription>
                  Toggle availability and set online pricing
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
                {menuItemsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : menuItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No items linked to this menu yet.
                  </p>
                ) : (
                  menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {item.is_available ? (
                          <Eye className="h-4 w-4 text-success" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">
                          Item {item.menu_item_id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.online_price !== null && (
                          <Badge variant="outline" className="tabular-nums">
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            {item.online_price.toFixed(2)}
                          </Badge>
                        )}
                        <Badge variant={item.is_available ? "default" : "secondary"}>
                          {item.is_available ? "Available" : "Hidden"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Create Menu Sheet */}
          <Sheet open={showCreateMenu} onOpenChange={setShowCreateMenu}>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>New Online Menu</SheetTitle>
                <SheetDescription>
                  Create a new menu for your online ordering portal
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="menu-name">Menu Name</Label>
                  <Input
                    id="menu-name"
                    placeholder="e.g. Lunch Menu"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    className="touch-target-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-slug">URL Slug</Label>
                  <Input
                    id="menu-slug"
                    placeholder="e.g. lunch-menu"
                    value={newMenuSlug}
                    onChange={(e) =>
                      setNewMenuSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                      )
                    }
                    className="touch-target-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Appears in the URL: /order/{newMenuSlug || "your-slug"}
                  </p>
                </div>
              </div>
              <SheetFooter className="mt-6">
                <Button
                  className="w-full touch-target-lg btn-press"
                  onClick={handleCreateMenu}
                  disabled={creating || !newMenuName.trim() || !newMenuSlug.trim()}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Menu
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ==================== SETTINGS ==================== */}
        <TabsContent value="settings" className="space-y-6">
          {settingsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Current status card */}
              {settings && (
                <Card className="shadow-warm-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Current Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Orders (15 min)
                        </p>
                        <p className="text-xl font-semibold tabular-nums">
                          {settings.current_count_15min}
                          <span className="text-sm text-muted-foreground font-normal">
                            /{settings.max_orders_per_15_min}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Orders (1 hour)
                        </p>
                        <p className="text-xl font-semibold tabular-nums">
                          {settings.current_count_hour}
                          <span className="text-sm text-muted-foreground font-normal">
                            /{settings.max_orders_per_hour}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge
                          variant={settings.is_paused ? "destructive" : "default"}
                          className="mt-1"
                        >
                          {settings.is_paused ? "Paused" : "Accepting Orders"}
                        </Badge>
                      </div>
                      {settings.pause_reason && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Pause Reason
                          </p>
                          <p className="text-sm">{settings.pause_reason}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Throttle Settings */}
              <Card className="shadow-warm-sm">
                <CardHeader>
                  <CardTitle className="text-base">Throttle Limits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="max-15">Max orders per 15 minutes</Label>
                      <Input
                        id="max-15"
                        type="number"
                        min={1}
                        max={999}
                        value={settingsForm.max_orders_per_15_min}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            max_orders_per_15_min: parseInt(e.target.value, 10) || 1,
                          }))
                        }
                        className="touch-target-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-hour">Max orders per hour</Label>
                      <Input
                        id="max-hour"
                        type="number"
                        min={1}
                        max={9999}
                        value={settingsForm.max_orders_per_hour}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            max_orders_per_hour: parseInt(e.target.value, 10) || 1,
                          }))
                        }
                        className="touch-target-lg"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Pause Online Ordering</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Temporarily stop accepting online orders
                      </p>
                    </div>
                    <Switch
                      checked={settingsForm.is_paused}
                      onCheckedChange={(checked) =>
                        setSettingsForm((prev) => ({ ...prev, is_paused: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Accept Orders</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically accept incoming orders without manual review
                      </p>
                    </div>
                    <Switch
                      checked={settingsForm.auto_accept}
                      onCheckedChange={(checked) =>
                        setSettingsForm((prev) => ({ ...prev, auto_accept: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  className="touch-target-lg btn-press"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectOrder}
        onOpenChange={(open) => {
          if (!open) {
            setRejectOrder(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting the order from{" "}
              {rejectOrder?.customer_name || "Guest"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Kitchen closed, item out of stock..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="touch-target-lg"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectOrder(null);
                setRejectReason("");
              }}
              className="touch-target-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
              className="touch-target-lg btn-press"
            >
              {rejecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
