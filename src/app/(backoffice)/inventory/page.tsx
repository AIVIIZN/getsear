"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Loader2,
  Search,
  AlertTriangle,
  Truck,
  FileText,
  BookOpen,
  Pencil,
  Trash2,
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

function stockStatus(item: InventoryItem): "critical" | "warning" | "good" {
  if (item.current_stock <= item.reorder_point) return "critical";
  if (item.current_stock <= item.par_level) return "warning";
  return "good";
}

function stockBadgeClass(status: "critical" | "warning" | "good"): string {
  switch (status) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "good":
      return "bg-green-50 text-green-700 border-green-200";
  }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">
          Inventory Management
        </h2>
        <p className="page-subtitle">
          Track stock levels, vendors, purchase orders, and recipes
        </p>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="h-11">
          <TabsTrigger value="items" className="h-9 gap-2 touch-target">
            <Package className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="vendors" className="h-9 gap-2 touch-target">
            <Truck className="h-4 w-4" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="h-9 gap-2 touch-target">
            <FileText className="h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="recipes" className="h-9 gap-2 touch-target">
            <BookOpen className="h-4 w-4" />
            Recipes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <ItemsTab />
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
    }
  };

  const lowStockCount = items.filter(
    (i) => i.is_active && i.current_stock <= i.reorder_point
  ).length;
  const totalValue = items
    .filter((i) => i.is_active)
    .reduce((sum, i) => sum + i.current_stock * parseFloat(i.unit_cost || "0"), 0);

  return (
    <div className="space-y-4 mt-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {items.filter((i) => i.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-red-600">
              {lowStockCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              ${totalValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowCreate(true)} className="btn-press gap-2">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No inventory items"
          description="Add your first inventory item to start tracking stock levels"
          actionLabel="Add Item"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Par</TableHead>
                <TableHead className="text-right">Reorder Pt</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.filter((i) => i.is_active).map((item) => {
                const ss = stockStatus(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category ?? "--"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.current_stock} {item.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.par_level}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.reorder_point}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(item.unit_cost)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium capitalize ${stockBadgeClass(ss)}`}
                      >
                        {ss === "critical" && (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        )}
                        {ss}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                          size="icon"
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

      {/* Quick Count Dialog */}
      <Dialog
        open={!!countItem}
        onOpenChange={(open) => {
          if (!open) {
            setCountItem(null);
            setCountQty("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Count: {countItem?.name}</DialogTitle>
            <DialogDescription>
              Current system stock: {countItem?.current_stock} {countItem?.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Counted Quantity</Label>
              <Input
                type="number"
                value={countQty}
                onChange={(e) => setCountQty(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleCount} className="btn-press">
              Save Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item ? "Edit Item" : "New Inventory Item"}</SheetTitle>
          <SheetDescription>
            {item ? "Update inventory item details" : "Add a new item to your inventory"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["each", "oz", "lb", "gal", "case", "bag", "bottle"].map(
                    (u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Produce"
              />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Current Stock</Label>
              <Input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <Label>Par Level</Label>
              <Input
                type="number"
                value={parLevel}
                onChange={(e) => setParLevel(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <Label>Reorder Point</Label>
              <Input
                type="number"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
          </div>
          <div>
            <Label>Unit Cost ($)</Label>
            <Input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              min={0}
              step="0.01"
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="btn-press">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
        <h3 className="text-sm font-medium text-muted-foreground">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
        </h3>
        <Button onClick={() => setShowCreate(true)} className="btn-press gap-2">
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vendors"
          description="Add your first vendor to start managing suppliers"
          actionLabel="Add Vendor"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendor.contact_name ?? "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendor.email ?? "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendor.phone ?? "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendor.payment_terms ?? "--"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={vendor.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vendor ? "Edit Vendor" : "New Vendor"}</SheetTitle>
          <SheetDescription>
            {vendor ? "Update vendor details" : "Add a new supplier"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Contact Name</Label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Payment Terms</Label>
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g. Net 30"
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="btn-press">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
    // Simple: mark all items as fully received
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
        }
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

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="reconciled">Reconciled</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreate(true)} className="btn-press gap-2">
          <Plus className="h-4 w-4" />
          New PO
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No purchase orders"
          description="Create your first purchase order to start ordering from vendors"
          actionLabel="New PO"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-xs">
                    {po.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium">
                    {vendorMap.get(po.vendor_id) ?? "--"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(po.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(po.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {po.status === "draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSubmitPO(po.id)}
                        >
                          Submit
                        </Button>
                      )}
                      {po.status === "submitted" && (
                        <Button
                          variant="outline"
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
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Purchase Order</SheetTitle>
            <SheetDescription>
              Create a PO to order from a vendor
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div>
              <Label>Vendor *</Label>
              <Select
                value={newVendorId}
                onValueChange={(v) => v && setNewVendorId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors
                    .filter((v) => v.is_active)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewItems([
                      ...newItems,
                      { inventory_item_id: "", quantity_ordered: "1", unit_cost: "0.00" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>
              {newItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Select
                      value={item.inventory_item_id}
                      onValueChange={(v) => {
                        if (!v) return;
                        const updated = [...newItems];
                        updated[idx] = { ...updated[idx], inventory_item_id: v };
                        const inv = items.find((i) => i.id === v);
                        if (inv) {
                          updated[idx].unit_cost = inv.unit_cost;
                        }
                        setNewItems(updated);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items
                          .filter((i) => i.is_active)
                          .map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      placeholder="Qty"
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
                    <Input
                      type="number"
                      placeholder="Cost"
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
                    size="icon"
                    onClick={() =>
                      setNewItems(newItems.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePO}
              disabled={creating}
              className="btn-press"
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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

  // Create recipe state
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

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {recipes.length} recipe link{recipes.length !== 1 ? "s" : ""}
        </h3>
        <Button onClick={() => setShowCreate(true)} className="btn-press gap-2">
          <Plus className="h-4 w-4" />
          Link Ingredient
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No recipes"
          description="Link menu items to inventory ingredients to track food cost"
          actionLabel="Link Ingredient"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu Item ID</TableHead>
                <TableHead>Ingredient</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="font-mono text-xs">
                      {recipe.menu_item_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-medium">
                      {inv?.name ?? recipe.inventory_item_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {recipe.quantity}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {recipe.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${cost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(recipe.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Link Ingredient to Menu Item</SheetTitle>
            <SheetDescription>
              Define how much of an ingredient a menu item uses
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div>
              <Label>Menu Item ID *</Label>
              <Input
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                placeholder="Paste menu item UUID"
              />
            </div>
            <div>
              <Label>Inventory Item *</Label>
              <Select
                value={inventoryItemId}
                onValueChange={(v) => v && setInventoryItemId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient" />
                </SelectTrigger>
                <SelectContent>
                  {items
                    .filter((i) => i.is_active)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={0}
                  step="0.001"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["each", "oz", "lb", "gal", "cup", "tbsp", "tsp"].map(
                      (u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="btn-press">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Link
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
