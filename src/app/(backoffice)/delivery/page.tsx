"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { DeliveryMap } from "@/components/delivery/DeliveryMap";
import {
  MapPin,
  Plus,
  Truck,
  User,
  Pencil,
  Navigation,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui-v2/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui-v2/Card";
import { Text } from "@/components/ui-v2/inputs/Text";
import { NumberInput } from "@/components/ui-v2/inputs/Number";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Badge } from "@/components/ui-v2/data/Badge";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
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
import { StatusBadge } from "@/components/shared/StatusBadge";

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

function deliveryStatusVariant(
  status: string,
): "default" | "primary" | "warning" | "success" | "danger" {
  switch (status) {
    case "pending":
      return "default";
    case "assigned":
      return "primary";
    case "picked_up":
      return "warning";
    case "en_route":
      return "warning";
    case "delivered":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "picked_up", label: "Picked Up" },
  { value: "en_route", label: "En Route" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DeliveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Delivery Management</h2>
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
  const [assigning, setAssigning] = useState(false);

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
    (s) => s.role === "driver" || s.role === "manager" || s.role === "owner",
  );
  const staffMap = new Map(
    staff.map((s) => [
      s.id,
      s.display_name ?? `${s.first_name} ${s.last_name}`,
    ]),
  );

  const handleAssign = async () => {
    if (!assignDialog || !selectedDriver) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/delivery/deliveries/${assignDialog.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driver_id: selectedDriver }),
        },
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
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusUpdate = async (deliveryId: string, status: string) => {
    try {
      const res = await fetch(
        `/api/delivery/deliveries/${deliveryId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
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

  const activeCount = deliveries.filter(
    (d) => !["delivered", "cancelled"].includes(d.status),
  ).length;
  const deliveredToday = deliveries.filter((d) => {
    if (d.status !== "delivered" || !d.delivered_at) return false;
    const today = new Date().toISOString().split("T")[0];
    return d.delivered_at.startsWith(today);
  }).length;

  const driverOptions = drivers.map((d) => ({
    value: d.id,
    label: d.display_name ?? `${d.first_name} ${d.last_name}`,
  }));

  return (
    <div className="space-y-4 mt-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="default">
          <CardHeader>
            <CardTitle className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
              Active Deliveries
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
              {activeCount}
            </div>
          </CardBody>
        </Card>
        <Card padding="default">
          <CardHeader>
            <CardTitle className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
              Delivered Today
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-success)]">
              {deliveredToday}
            </div>
          </CardBody>
        </Card>
        <Card padding="default">
          <CardHeader>
            <CardTitle className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
              Available Drivers
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
              {drivers.length}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="w-[200px]">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            ariaLabel="Filter by status"
          />
        </div>
      </div>

      {/* Deliveries Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries"
          description="Delivery orders will appear here when created"
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Order</TableCell>
                <TableCell header>Address</TableCell>
                <TableCell header>Driver</TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header>ETA</TableCell>
                <TableCell header>Created</TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-[length:var(--type-footnote-size)]">
                    {delivery.order_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {formatAddress(delivery.delivery_address)}
                  </TableCell>
                  <TableCell>
                    {delivery.driver_id
                      ? (staffMap.get(delivery.driver_id) ??
                        delivery.driver_id.slice(0, 8))
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={deliveryStatusVariant(delivery.status)}
                      className="capitalize"
                    >
                      {delivery.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {delivery.estimated_delivery_at
                      ? formatTime(delivery.estimated_delivery_at)
                      : "--"}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)] text-[length:var(--type-caption-1-size)]">
                    {timeAgo(delivery.created_at)}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      {delivery.status === "pending" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setAssignDialog(delivery);
                            setSelectedDriver("");
                          }}
                          leadingIcon={<User className="h-3 w-3" />}
                        >
                          Assign
                        </Button>
                      )}
                      {delivery.status === "assigned" && (
                        <Button
                          variant="secondary"
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
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleStatusUpdate(delivery.id, "en_route")
                          }
                          leadingIcon={<Navigation className="h-3 w-3" />}
                        >
                          En Route
                        </Button>
                      )}
                      {delivery.status === "en_route" && (
                        <Button
                          variant="primary"
                          size="sm"
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

      {/* Assign Driver Modal — short confirmation */}
      <Modal
        open={!!assignDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAssignDialog(null);
            setSelectedDriver("");
          }
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Assign Driver</ModalTitle>
            <ModalDescription>
              Select a driver for this delivery
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <Select
              label="Driver"
              placeholder={
                drivers.length === 0 ? "No drivers available" : "Select driver"
              }
              options={driverOptions}
              value={selectedDriver}
              onChange={(v) => setSelectedDriver(v)}
              disabled={drivers.length === 0}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setAssignDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleAssign}
              disabled={!selectedDriver}
              loading={assigning}
            >
              Assign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
        <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
          {zones.filter((z) => z.is_active).length} active zone
          {zones.filter((z) => z.is_active).length !== 1 ? "s" : ""}
        </h3>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(true)}
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          Add Zone
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No delivery zones"
          description="Create delivery zones to define your delivery area and fees"
          action={{ label: "Add Zone", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Zone Name</TableCell>
                <TableCell header align="right">
                  Delivery Fee
                </TableCell>
                <TableCell header align="right">
                  Min Order
                </TableCell>
                <TableCell header align="right">
                  Est. Minutes
                </TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-[var(--weight-medium)]">
                    {zone.name}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatMoney(zone.delivery_fee)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatMoney(zone.min_order)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {zone.estimated_minutes} min
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={zone.is_active ? "active" : "inactive"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${zone.name}`}
                        onClick={() => setEditZone(zone)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {zone.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Deactivate ${zone.name}`}
                          onClick={() => handleDeactivate(zone.id)}
                        >
                          <X className="h-4 w-4 text-[var(--color-danger)]" />
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
      <SheetContent width="md">
        <SheetHeader>
          <SheetTitle>{zone ? "Edit Zone" : "New Delivery Zone"}</SheetTitle>
          <SheetDescription>
            {zone
              ? "Update delivery zone details"
              : "Define a new delivery area with fees and minimums"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Text
            label="Zone Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Delivery Fee ($)"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              min={0}
              step="0.01"
            />
            <NumberInput
              label="Min Order ($)"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              min={0}
              step="0.01"
            />
          </div>
          <NumberInput
            label="Estimated Minutes"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            min={0}
          />
        </SheetBody>
        <SheetFooter>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={saving}
          >
            {zone ? "Save Changes" : "Create Zone"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
