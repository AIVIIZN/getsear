"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Truck,
  FileText,
  BookOpen,
  Pencil,
  Trash2,
  LayoutDashboard,
  Trash,
  TrendingDown,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import { InventoryDashboard } from "@/components/inventory/InventoryDashboard";
import { WasteLogForm } from "@/components/inventory/WasteLogForm";
import { FoodCostReport } from "@/components/inventory/FoodCostReport";
import { PrepListView } from "@/components/inventory/PrepListView";
import { InventoryCountSheet } from "@/components/inventory/InventoryCountSheet";
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

interface InventoryItem {
  id: string;
  org_id: string;
  location_id: string | null;
  name: string;
  unit: string;
  par_level: number;
  reorder_point: number;
  current_stock: number;
  unit_cost: string;
  category: string | null;
  supplier_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Vendor {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  payment_terms: string | null;
  is_active: boolean;
}

interface PurchaseOrder {
  id: string;
  org_id: string;
  vendor_id: string;
  location_id: string | null;
  status: string;
  total: string;
  notes: string | null;
  created_by: string;
  submitted_at: string | null;
  received_at: string | null;
  created_at: string;
}

interface Recipe {
  id: string;
  org_id: string;
  menu_item_id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(amount: string | null): string {
  if (!amount) return "$0.00";
  const num = parseFloat(amount);
  return `$${num.toFixed(2)}`;
}

type StockStatus = "critical" | "warning" | "good";

function stockStatus(item: InventoryItem): StockStatus {
  if (item.current_stock <= item.reorder_point) return "critical";
  if (item.current_stock <= item.par_level) return "warning";
  return "good";
}

function stockBadgeVariant(
  status: StockStatus,
): "danger" | "warning" | "success" {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  return "success";
}

const UNIT_OPTIONS = ["each", "oz", "lb", "gal", "case", "bag", "bottle"].map(
  (u) => ({ value: u, label: u }),
);

const RECIPE_UNIT_OPTIONS = [
  "each",
  "oz",
  "lb",
  "gal",
  "cup",
  "tbsp",
  "tsp",
].map((u) => ({ value: u, label: u }));

const PO_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "received", label: "Received" },
  { value: "reconciled", label: "Reconciled" },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Inventory Management</h2>
        <p className="page-subtitle">
          Track stock levels, vendors, purchase orders, and recipes
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="h-11 w-max">
            <TabsTrigger value="dashboard" className="h-9 gap-2 touch-target">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="items" className="h-9 gap-2 touch-target">
              <Package className="h-4 w-4" />
              Items
            </TabsTrigger>
            <TabsTrigger value="waste" className="h-9 gap-2 touch-target">
              <Trash className="h-4 w-4" />
              Waste
            </TabsTrigger>
            <TabsTrigger value="food-cost" className="h-9 gap-2 touch-target">
              <TrendingDown className="h-4 w-4" />
              Food Cost
            </TabsTrigger>
            <TabsTrigger value="prep-list" className="h-9 gap-2 touch-target">
              <ClipboardList className="h-4 w-4" />
              Prep List
            </TabsTrigger>
            <TabsTrigger value="count" className="h-9 gap-2 touch-target">
              <ClipboardCheck className="h-4 w-4" />
              Count
            </TabsTrigger>
            <TabsTrigger value="vendors" className="h-9 gap-2 touch-target">
              <Truck className="h-4 w-4" />
              Vendors
            </TabsTrigger>
            <TabsTrigger
              value="purchase-orders"
              className="h-9 gap-2 touch-target"
            >
              <FileText className="h-4 w-4" />
              POs
            </TabsTrigger>
            <TabsTrigger value="recipes" className="h-9 gap-2 touch-target">
              <BookOpen className="h-4 w-4" />
              Recipes
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard">
          <InventoryDashboard />
        </TabsContent>
        <TabsContent value="items">
          <ItemsTab />
        </TabsContent>
        <TabsContent value="waste">
          <WasteLogForm />
        </TabsContent>
        <TabsContent value="food-cost">
          <FoodCostReport />
        </TabsContent>
        <TabsContent value="prep-list">
          <PrepListView />
        </TabsContent>
        <TabsContent value="count">
          <InventoryCountSheet />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorsTab />
        </TabsContent>
        <TabsContent value="purchase-orders">
          <PurchaseOrdersTab />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Items Tab
// ---------------------------------------------------------------------------

function ItemsTab() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [countItem, setCountItem] = useState<InventoryItem | null>(null);
  const [countQty, setCountQty] = useState("");
  const [countSaving, setCountSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/inventory/items?${params}`);
      const json = await res.json();
      if (res.ok) setItems(json.data ?? []);
      else toast.error(json.error ?? "Failed to load items");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCount = async () => {
    if (!countItem || !countQty) return;
    setCountSaving(true);
    try {
      const res = await fetch(`/api/inventory/items/${countItem.id}/count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counted_quantity: parseFloat(countQty) }),
      });
      if (res.ok) {
        toast.success("Count recorded");
        setCountItem(null);
        setCountQty("");
        fetchItems();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to record count");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCountSaving(false);
    }
  };

  const lowStockCount = items.filter(
    (i) => i.is_active && i.current_stock <= i.reorder_point,
  ).length;
  const totalValue = items
    .filter((i) => i.is_active)
    .reduce(
      (sum, i) => sum + i.current_stock * parseFloat(i.unit_cost || "0"),
      0,
    );

  return (
    <div className="space-y-4 mt-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="default">
          <CardHeader>
            <CardTitle className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
              Total Items
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
              {items.filter((i) => i.is_active).length}
            </div>
          </CardBody>
        </Card>
        <Card padding="default">
          <CardHeader>
            <CardTitle className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-danger)]">
              {lowStockCount}
            </div>
          </CardBody>
        </Card>
        <Card padding="default">
          <CardHeader>
            <CardTitle className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
              Total Inventory Value
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
              ${totalValue.toFixed(2)}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <Text
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<Search className="h-4 w-4" />}
            aria-label="Search items"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(true)}
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          Add Item
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No inventory items"
          description="Add your first inventory item to start tracking stock levels"
          action={{ label: "Add Item", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Name</TableCell>
                <TableCell header>Category</TableCell>
                <TableCell header align="right">
                  Stock
                </TableCell>
                <TableCell header align="right">
                  Par
                </TableCell>
                <TableCell header align="right">
                  Reorder Pt
                </TableCell>
                <TableCell header align="right">
                  Unit Cost
                </TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items
                .filter((i) => i.is_active)
                .map((item) => {
                  const ss = stockStatus(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-[var(--weight-medium)]">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-muted)]">
                        {item.category ?? "--"}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {item.current_stock} {item.unit}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {item.par_level}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {item.reorder_point}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {formatMoney(item.unit_cost)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockBadgeVariant(ss)} className="capitalize">
                          {ss === "critical" && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {ss}
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCountItem(item);
                              setCountQty(String(item.current_stock));
                            }}
                          >
                            Count
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => setEditItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Quick Count Modal — short confirmation */}
      <Modal
        open={!!countItem}
        onOpenChange={(open) => {
          if (!open) {
            setCountItem(null);
            setCountQty("");
          }
        }}
      >
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Quick Count: {countItem?.name}</ModalTitle>
            <ModalDescription>
              Current system stock: {countItem?.current_stock} {countItem?.unit}
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <NumberInput
              label="Counted Quantity"
              value={countQty}
              onChange={(e) => setCountQty(e.target.value)}
              min={0}
              step="0.01"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCountItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCount}
              loading={countSaving}
            >
              Save Count
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create/Edit Item Sheet */}
      <ItemFormSheet
        open={showCreate || !!editItem}
        onClose={() => {
          setShowCreate(false);
          setEditItem(null);
        }}
        item={editItem}
        onSaved={fetchItems}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item Form Sheet
// ---------------------------------------------------------------------------

function ItemFormSheet({
  open,
  onClose,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("each");
  const [parLevel, setParLevel] = useState("0");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [currentStock, setCurrentStock] = useState("0");
  const [unitCost, setUnitCost] = useState("0.00");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setUnit(item.unit);
      setParLevel(String(item.par_level));
      setReorderPoint(String(item.reorder_point));
      setCurrentStock(String(item.current_stock));
      setUnitCost(item.unit_cost);
      setCategory(item.category ?? "");
    } else {
      setName("");
      setUnit("each");
      setParLevel("0");
      setReorderPoint("0");
      setCurrentStock("0");
      setUnitCost("0.00");
      setCategory("");
    }
  }, [item, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        unit,
        par_level: parseFloat(parLevel) || 0,
        reorder_point: parseFloat(reorderPoint) || 0,
        current_stock: parseFloat(currentStock) || 0,
        unit_cost: unitCost,
        category: category || null,
      };
      const url = item
        ? `/api/inventory/items/${item.id}`
        : "/api/inventory/items";
      const method = item ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(item ? "Item updated" : "Item created");
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
          <SheetTitle>{item ? "Edit Item" : "New Inventory Item"}</SheetTitle>
          <SheetDescription>
            {item
              ? "Update inventory item details"
              : "Add a new item to your inventory"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Text
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Unit"
              options={UNIT_OPTIONS}
              value={unit}
              onChange={(v) => setUnit(v)}
            />
            <Text
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Produce"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <NumberInput
              label="Current Stock"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              min={0}
              step="0.01"
            />
            <NumberInput
              label="Par Level"
              value={parLevel}
              onChange={(e) => setParLevel(e.target.value)}
              min={0}
              step="0.01"
            />
            <NumberInput
              label="Reorder Point"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              min={0}
              step="0.01"
            />
          </div>
          <NumberInput
            label="Unit Cost ($)"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            min={0}
            step="0.01"
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
            {item ? "Save Changes" : "Create Item"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Vendors Tab
// ---------------------------------------------------------------------------

function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/vendors");
      const json = await res.json();
      if (res.ok) setVendors(json.data ?? []);
      else toast.error(json.error ?? "Failed to load vendors");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
        </h3>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(true)}
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          Add Vendor
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vendors"
          description="Add your first vendor to start managing suppliers"
          action={{ label: "Add Vendor", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Name</TableCell>
                <TableCell header>Contact</TableCell>
                <TableCell header>Email</TableCell>
                <TableCell header>Phone</TableCell>
                <TableCell header>Terms</TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-[var(--weight-medium)]">
                    {vendor.name}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {vendor.contact_name ?? "--"}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {vendor.email ?? "--"}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {vendor.phone ?? "--"}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {vendor.payment_terms ?? "--"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={vendor.is_active ? "active" : "inactive"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${vendor.name}`}
                      onClick={() => setEditVendor(vendor)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <VendorFormSheet
        open={showCreate || !!editVendor}
        onClose={() => {
          setShowCreate(false);
          setEditVendor(null);
        }}
        vendor={editVendor}
        onSaved={fetchVendors}
      />
    </div>
  );
}

function VendorFormSheet({
  open,
  onClose,
  vendor,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setContactName(vendor.contact_name ?? "");
      setEmail(vendor.email ?? "");
      setPhone(vendor.phone ?? "");
      setPaymentTerms(vendor.payment_terms ?? "");
    } else {
      setName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setPaymentTerms("");
    }
  }, [vendor, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        payment_terms: paymentTerms || null,
      };
      const url = vendor
        ? `/api/inventory/vendors/${vendor.id}`
        : "/api/inventory/vendors";
      const method = vendor ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(vendor ? "Vendor updated" : "Vendor created");
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
          <SheetTitle>{vendor ? "Edit Vendor" : "New Vendor"}</SheetTitle>
          <SheetDescription>
            {vendor ? "Update vendor details" : "Add a new supplier"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Text
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Text
            label="Contact Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Text
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Text
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Text
            label="Payment Terms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="e.g. Net 30"
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
            {vendor ? "Save Changes" : "Create Vendor"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Purchase Orders Tab
// ---------------------------------------------------------------------------

function PurchaseOrdersTab() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  // PO creation state
  const [newVendorId, setNewVendorId] = useState("");
  const [newItems, setNewItems] = useState<
    { inventory_item_id: string; quantity_ordered: string; unit_cost: string }[]
  >([]);
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, vendorsRes, itemsRes] = await Promise.all([
        fetch("/api/inventory/purchase-orders"),
        fetch("/api/inventory/vendors"),
        fetch("/api/inventory/items"),
      ]);
      const [posJson, vendorsJson, itemsJson] = await Promise.all([
        posRes.json(),
        vendorsRes.json(),
        itemsRes.json(),
      ]);
      if (posRes.ok) setOrders(posJson.data ?? []);
      if (vendorsRes.ok) setVendors(vendorsJson.data ?? []);
      if (itemsRes.ok) setItems(itemsJson.data ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

  const filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const handleSubmitPO = async (poId: string) => {
    try {
      const res = await fetch(`/api/inventory/purchase-orders/${poId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        toast.success("PO submitted");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to submit");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleReceivePO = async (poId: string) => {
    try {
      const detailRes = await fetch(`/api/inventory/purchase-orders/${poId}`);
      const detailJson = await detailRes.json();
      if (!detailRes.ok) {
        toast.error("Failed to fetch PO details");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poItems = detailJson.data.items.map((item: any) => ({
        purchase_order_item_id: item.id,
        quantity_received: item.quantity_ordered - (item.quantity_received ?? 0),
      }));
      const res = await fetch(
        `/api/inventory/purchase-orders/${poId}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: poItems }),
        },
      );
      if (res.ok) {
        toast.success("PO received");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to receive");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleCreatePO = async () => {
    if (!newVendorId || newItems.length === 0) {
      toast.error("Select a vendor and add at least one item");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        vendor_id: newVendorId,
        notes: newNotes || null,
        items: newItems.map((i) => ({
          inventory_item_id: i.inventory_item_id,
          quantity_ordered: parseFloat(i.quantity_ordered) || 1,
          unit_cost: i.unit_cost || "0.00",
        })),
      };
      const res = await fetch("/api/inventory/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Purchase order created");
        setShowCreate(false);
        setNewVendorId("");
        setNewItems([]);
        setNewNotes("");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to create PO");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  };

  const vendorOptions = vendors
    .filter((v) => v.is_active)
    .map((v) => ({ value: v.id, label: v.name }));
  const itemOptions = items
    .filter((i) => i.is_active)
    .map((i) => ({ value: i.id, label: i.name }));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="w-[200px]">
          <Select
            options={PO_STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            ariaLabel="Filter by status"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(true)}
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          New PO
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No purchase orders"
          description="Create your first purchase order to start ordering from vendors"
          action={{ label: "New PO", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>PO ID</TableCell>
                <TableCell header>Vendor</TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header align="right">
                  Total
                </TableCell>
                <TableCell header>Created</TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-[length:var(--type-footnote-size)]">
                    {po.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-[var(--weight-medium)]">
                    {vendorMap.get(po.vendor_id) ?? "--"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatMoney(po.total)}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {new Date(po.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      {po.status === "draft" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSubmitPO(po.id)}
                        >
                          Submit
                        </Button>
                      )}
                      {po.status === "submitted" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReceivePO(po.id)}
                        >
                          Receive
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

      {/* Create PO Sheet */}
      <Sheet
        open={showCreate}
        onOpenChange={(o) => {
          if (!o) {
            setShowCreate(false);
            setNewVendorId("");
            setNewItems([]);
            setNewNotes("");
          }
        }}
      >
        <SheetContent width="lg">
          <SheetHeader>
            <SheetTitle>New Purchase Order</SheetTitle>
            <SheetDescription>
              Create a PO to order from a vendor
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <Select
              label="Vendor"
              required
              placeholder="Select vendor"
              options={vendorOptions}
              value={newVendorId}
              onChange={(v) => setNewVendorId(v)}
            />
            <div>
              <div className="flex items-center justify-between mb-[var(--space-2)]">
                <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">
                  Items
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setNewItems([
                      ...newItems,
                      {
                        inventory_item_id: "",
                        quantity_ordered: "1",
                        unit_cost: "0.00",
                      },
                    ])
                  }
                  leadingIcon={<Plus className="h-3 w-3" />}
                >
                  Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {newItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select
                        placeholder="Select item"
                        options={itemOptions}
                        value={item.inventory_item_id}
                        onChange={(v) => {
                          const updated = [...newItems];
                          updated[idx] = {
                            ...updated[idx],
                            inventory_item_id: v,
                          };
                          const inv = items.find((i) => i.id === v);
                          if (inv) {
                            updated[idx].unit_cost = inv.unit_cost;
                          }
                          setNewItems(updated);
                        }}
                      />
                    </div>
                    <div className="w-20">
                      <NumberInput
                        placeholder="Qty"
                        aria-label="Quantity"
                        value={item.quantity_ordered}
                        onChange={(e) => {
                          const updated = [...newItems];
                          updated[idx] = {
                            ...updated[idx],
                            quantity_ordered: e.target.value,
                          };
                          setNewItems(updated);
                        }}
                        min={0}
                        step="0.01"
                      />
                    </div>
                    <div className="w-24">
                      <NumberInput
                        placeholder="Cost"
                        aria-label="Unit cost"
                        value={item.unit_cost}
                        onChange={(e) => {
                          const updated = [...newItems];
                          updated[idx] = {
                            ...updated[idx],
                            unit_cost: e.target.value,
                          };
                          setNewItems(updated);
                        }}
                        min={0}
                        step="0.01"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="md"
                      aria-label="Remove item"
                      onClick={() =>
                        setNewItems(newItems.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Text
              label="Notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
          </SheetBody>
          <SheetFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreatePO}
              loading={creating}
            >
              Create PO
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipes Tab
// ---------------------------------------------------------------------------

function RecipesTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [menuItemId, setMenuItemId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recipesRes, itemsRes] = await Promise.all([
        fetch("/api/inventory/recipes"),
        fetch("/api/inventory/items"),
      ]);
      const [recipesJson, itemsJson] = await Promise.all([
        recipesRes.json(),
        itemsRes.json(),
      ]);
      if (recipesRes.ok) setRecipes(recipesJson.data ?? []);
      if (itemsRes.ok) setItems(itemsJson.data ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const itemMap = new Map(items.map((i) => [i.id, i]));

  const handleCreate = async () => {
    if (!menuItemId || !inventoryItemId) {
      toast.error("Select both a menu item ID and an inventory item");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_item_id: menuItemId,
          inventory_item_id: inventoryItemId,
          quantity: parseFloat(quantity) || 1,
          unit,
        }),
      });
      if (res.ok) {
        toast.success("Recipe entry created");
        setShowCreate(false);
        setMenuItemId("");
        setInventoryItemId("");
        setQuantity("1");
        setUnit("each");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to create recipe");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/recipes/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Recipe entry deleted");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Delete failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const ingredientOptions = items
    .filter((i) => i.is_active)
    .map((i) => ({ value: i.id, label: i.name }));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
          {recipes.length} recipe link{recipes.length !== 1 ? "s" : ""}
        </h3>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(true)}
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          Link Ingredient
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No recipes"
          description="Link menu items to inventory ingredients to track food cost"
          action={{
            label: "Link Ingredient",
            onClick: () => setShowCreate(true),
          }}
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Menu Item ID</TableCell>
                <TableCell header>Ingredient</TableCell>
                <TableCell header align="right">
                  Quantity
                </TableCell>
                <TableCell header>Unit</TableCell>
                <TableCell header align="right">
                  Est. Cost
                </TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => {
                const inv = itemMap.get(recipe.inventory_item_id);
                const cost = inv
                  ? recipe.quantity * parseFloat(inv.unit_cost || "0")
                  : 0;
                return (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-mono text-[length:var(--type-footnote-size)]">
                      {recipe.menu_item_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-[var(--weight-medium)]">
                      {inv?.name ?? recipe.inventory_item_id.slice(0, 8)}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {recipe.quantity}
                    </TableCell>
                    <TableCell className="text-[var(--color-text-muted)]">
                      {recipe.unit}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      ${cost.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete recipe link"
                        onClick={() => handleDelete(recipe.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Recipe Link Sheet */}
      <Sheet
        open={showCreate}
        onOpenChange={(o) => {
          if (!o) setShowCreate(false);
        }}
      >
        <SheetContent width="md">
          <SheetHeader>
            <SheetTitle>Link Ingredient to Menu Item</SheetTitle>
            <SheetDescription>
              Define how much of an ingredient a menu item uses
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <Text
              label="Menu Item ID"
              required
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              placeholder="Paste menu item UUID"
            />
            <Select
              label="Inventory Item"
              required
              placeholder="Select ingredient"
              options={ingredientOptions}
              value={inventoryItemId}
              onChange={(v) => setInventoryItemId(v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={0}
                step="0.001"
              />
              <Select
                label="Unit"
                options={RECIPE_UNIT_OPTIONS}
                value={unit}
                onChange={(v) => setUnit(v)}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              loading={saving}
            >
              Create Link
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

