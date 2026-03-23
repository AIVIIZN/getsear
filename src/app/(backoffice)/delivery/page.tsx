"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { DeliveryMap } from "@/components/delivery/DeliveryMap";
import {
  MapPin,
  Plus,
  Loader2,
  Truck,
  Clock,
  DollarSign,
  User,
  Pencil,
  Navigation,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeliveryZone {
  id: string;
  org_id: string;
  location_id: string | null;
  name: string;
  polygon: Record<string, unknown> | null;
  delivery_fee: string;
  min_order: string;
  estimated_minutes: number;
  is_active: boolean;
  created_at: string;
}

interface Delivery {
  id: string;
  org_id: string;
  order_id: string;
  driver_id: string | null;
  status: string;
  pickup_at: string | null;
  delivered_at: string | null;
  estimated_delivery_at: string | null;
  delivery_address: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(amount: string | null): string {
  if (!amount) return "$0.00";
  const num = parseFloat(amount);
  return `$${num.toFixed(2)}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAddress(addr: Record<string, unknown> | null): string {
  if (!addr) return "--";
  const parts: string[] = [];
  if (addr.street) parts.push(String(addr.street));
  if (addr.city) parts.push(String(addr.city));
  if (addr.state) parts.push(String(addr.state));
  if (addr.zip) parts.push(String(addr.zip));
  return parts.length > 0 ? parts.join(", ") : "--";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

const STATUS_ORDER = [
  "pending",
  "assigned",
  "picked_up",
  "en_route",
  "delivered",
  "cancelled",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  picked_up: "bg-orange-50 text-orange-700 border-orange-200",
  en_route: "bg-yellow-50 text-yellow-700 border-yellow-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DeliveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">
          Delivery Management
        </h2>
        <p className="page-subtitle">
          Manage active deliveries and delivery zones
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="h-11">
          <TabsTrigger value="dashboard" className="h-9 gap-2 touch-target">
            <MapPin className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="active" className="h-9 gap-2 touch-target">
            <Truck className="h-4 w-4" />
            Active Deliveries
          </TabsTrigger>
          <TabsTrigger value="zones" className="h-9 gap-2 touch-target">
            <MapPin className="h-4 w-4" />
            Zones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DeliveryMap />
        </TabsContent>
        <TabsContent value="active">
          <ActiveDeliveriesTab />
        </TabsContent>
        <TabsContent value="zones">
          <ZonesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Deliveries Tab
// ---------------------------------------------------------------------------

function ActiveDeliveriesTab() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignDialog, setAssignDialog] = useState<Delivery | null>(null);
  const [selectedDriver, setSelectedDriver] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const [deliveriesRes, staffRes] = await Promise.all([
        fetch(`/api/delivery/deliveries?${params}`),
        fetch("/api/staff?status=active"),
      ]);
      const [deliveriesJson, staffJson] = await Promise.all([
        deliveriesRes.json(),
        staffRes.json(),
      ]);
      if (deliveriesRes.ok) setDeliveries(deliveriesJson.data ?? []);
      if (staffRes.ok) setStaff(staffJson.data ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const drivers = staff.filter(
    (s) => s.role === "driver" || s.role === "manager" || s.role === "owner"
  );
  const staffMap = new Map(
    staff.map((s) => [
      s.id,
      s.display_name ?? `${s.first_name} ${s.last_name}`,
    ])
  );

  const handleAssign = async () => {
    if (!assignDialog || !selectedDriver) return;
    try {
      const res = await fetch(
        `/api/delivery/deliveries/${assignDialog.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driver_id: selectedDriver }),
        }
      );
      if (res.ok) {
        toast.success("Driver assigned");
        setAssignDialog(null);
        setSelectedDriver("");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to assign driver");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleStatusUpdate = async (
    deliveryId: string,
    status: string
  ) => {
    try {
      const res = await fetch(
        `/api/delivery/deliveries/${deliveryId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        toast.success(`Status updated to ${status.replace("_", " ")}`);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to update status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  // Summary
  const activeCount = deliveries.filter(
    (d) => !["delivered", "cancelled"].includes(d.status)
  ).length;
  const deliveredToday = deliveries.filter((d) => {
    if (d.status !== "delivered" || !d.delivered_at) return false;
    const today = new Date().toISOString().split("T")[0];
    return d.delivered_at.startsWith(today);
  }).length;

  return (
    <div className="space-y-4 mt-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivered Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-green-600">
              {deliveredToday}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {drivers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="en_route">En Route</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deliveries Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries"
          description="Delivery orders will appear here when created"
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-xs">
                    {delivery.order_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {formatAddress(delivery.delivery_address)}
                  </TableCell>
                  <TableCell>
                    {delivery.driver_id
                      ? staffMap.get(delivery.driver_id) ??
                        delivery.driver_id.slice(0, 8)
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium capitalize ${
                        STATUS_COLORS[delivery.status] ?? ""
                      }`}
                    >
                      {delivery.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {delivery.estimated_delivery_at
                      ? formatTime(delivery.estimated_delivery_at)
                      : "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {timeAgo(delivery.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {delivery.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAssignDialog(delivery);
                            setSelectedDriver("");
                          }}
                        >
                          <User className="h-3 w-3 mr-1" />
                          Assign
                        </Button>
                      )}
                      {delivery.status === "assigned" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleStatusUpdate(delivery.id, "picked_up")
                          }
                        >
                          Picked Up
                        </Button>
                      )}
                      {delivery.status === "picked_up" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleStatusUpdate(delivery.id, "en_route")
                          }
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          En Route
                        </Button>
                      )}
                      {delivery.status === "en_route" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() =>
                            handleStatusUpdate(delivery.id, "delivered")
                          }
                        >
                          Delivered
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Assign Driver Dialog */}
      <Dialog
        open={!!assignDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAssignDialog(null);
            setSelectedDriver("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver</DialogTitle>
            <DialogDescription>
              Select a driver for this delivery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Driver</Label>
              <Select
                value={selectedDriver}
                onValueChange={(v) => v && setSelectedDriver(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.display_name ??
                        `${d.first_name} ${d.last_name}`}
                    </SelectItem>
                  ))}
                  {drivers.length === 0 && (
                    <SelectItem value="_none" disabled>
                      No drivers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedDriver}
              className="btn-press"
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zones Tab
// ---------------------------------------------------------------------------

function ZonesTab() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editZone, setEditZone] = useState<DeliveryZone | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/delivery/zones");
      const json = await res.json();
      if (res.ok) setZones(json.data ?? []);
      else toast.error(json.error ?? "Failed to load zones");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const handleDeactivate = async (zoneId: string) => {
    try {
      const res = await fetch(`/api/delivery/zones/${zoneId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Zone deactivated");
        fetchZones();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to deactivate");
      }
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {zones.filter((z) => z.is_active).length} active zone
          {zones.filter((z) => z.is_active).length !== 1 ? "s" : ""}
        </h3>
        <Button onClick={() => setShowCreate(true)} className="btn-press gap-2">
          <Plus className="h-4 w-4" />
          Add Zone
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No delivery zones"
          description="Create delivery zones to define your delivery area and fees"
          actionLabel="Add Zone"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone Name</TableHead>
                <TableHead className="text-right">Delivery Fee</TableHead>
                <TableHead className="text-right">Min Order</TableHead>
                <TableHead className="text-right">Est. Minutes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(zone.delivery_fee)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(zone.min_order)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {zone.estimated_minutes} min
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={zone.is_active ? "active" : "inactive"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditZone(zone)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {zone.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(zone.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Zone Sheet */}
      <ZoneFormSheet
        open={showCreate || !!editZone}
        onClose={() => {
          setShowCreate(false);
          setEditZone(null);
        }}
        zone={editZone}
        onSaved={fetchZones}
      />
    </div>
  );
}

function ZoneFormSheet({
  open,
  onClose,
  zone,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  zone: DeliveryZone | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0.00");
  const [minOrder, setMinOrder] = useState("0.00");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (zone) {
      setName(zone.name);
      setDeliveryFee(zone.delivery_fee);
      setMinOrder(zone.min_order);
      setEstimatedMinutes(String(zone.estimated_minutes));
    } else {
      setName("");
      setDeliveryFee("0.00");
      setMinOrder("0.00");
      setEstimatedMinutes("30");
    }
  }, [zone, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        delivery_fee: deliveryFee,
        min_order: minOrder,
        estimated_minutes: parseInt(estimatedMinutes, 10) || 30,
      };
      const url = zone
        ? `/api/delivery/zones/${zone.id}`
        : "/api/delivery/zones";
      const method = zone ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(zone ? "Zone updated" : "Zone created");
        onSaved();
        onClose();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Save failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{zone ? "Edit Zone" : "New Delivery Zone"}</SheetTitle>
          <SheetDescription>
            {zone
              ? "Update delivery zone details"
              : "Define a new delivery area with fees and minimums"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div>
            <Label>Zone Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Delivery Fee ($)</Label>
              <Input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <Label>Min Order ($)</Label>
              <Input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
          </div>
          <div>
            <Label>Estimated Minutes</Label>
            <Input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              min={0}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="btn-press">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {zone ? "Save Changes" : "Create Zone"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

