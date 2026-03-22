"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import type { TaxRate } from "@/types/database";

export default function TaxRatesPage() {
  const activeLocationId = useAuthStore((s) => s.activeLocationId);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsInclusive, setFormIsInclusive] = useState(false);

  const fetchTaxRates = useCallback(async () => {
    if (!activeLocationId) return;
    try {
      const res = await fetch(`/api/settings/tax-rates?location_id=${activeLocationId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setTaxRates(json.data ?? []);
    } catch {
      toast.error("Failed to load tax rates");
    } finally {
      setLoading(false);
    }
  }, [activeLocationId]);

  useEffect(() => {
    fetchTaxRates();
  }, [fetchTaxRates]);

  function resetForm() {
    setFormName("");
    setFormRate("");
    setFormIsDefault(false);
    setFormIsInclusive(false);
    setEditingRate(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(rate: TaxRate) {
    setEditingRate(rate);
    setFormName(rate.name);
    setFormRate(rate.rate);
    setFormIsDefault(rate.is_default);
    setFormIsInclusive(rate.is_inclusive);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formRate.trim()) {
      toast.error("Name and rate are required");
      return;
    }

    setSaving(true);
    try {
      if (editingRate) {
        const res = await fetch(`/api/settings/tax-rates/${editingRate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            rate: formRate,
            is_default: formIsDefault,
            is_inclusive: formIsInclusive,
          }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Tax rate updated");
      } else {
        const res = await fetch("/api/settings/tax-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location_id: activeLocationId,
            name: formName,
            rate: formRate,
            is_default: formIsDefault,
            is_inclusive: formIsInclusive,
          }),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("Tax rate created");
      }

      setDialogOpen(false);
      resetForm();
      fetchTaxRates();
    } catch {
      toast.error("Failed to save tax rate");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/settings/tax-rates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Tax rate removed");
      fetchTaxRates();
    } catch {
      toast.error("Failed to remove tax rate");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <TaxRatesSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tax Rates</h2>
          <p className="text-sm text-muted-foreground">
            Configure tax rates for your location.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 gap-2 btn-press touch-target">
          <Plus className="h-4 w-4" />
          Add Tax Rate
        </Button>
      </div>

      {/* Table */}
      {taxRates.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No tax rates configured"
          description="Add a tax rate to start collecting sales tax."
          actionLabel="Add Tax Rate"
          onAction={openCreate}
        />
      ) : (
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="sr-only">Tax rates table</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map((rate) => (
                  <TableRow key={rate.id} className="even:bg-muted/20">
                    <TableCell className="pl-4 font-medium">{rate.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {parseFloat(rate.rate).toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {rate.is_inclusive ? "Inclusive" : "Exclusive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rate.is_default && (
                        <Star className="h-4 w-4 fill-primary text-primary" />
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(rate)}
                          className="touch-target"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(rate.id)}
                          disabled={deleting === rate.id}
                          className="text-destructive hover:text-destructive touch-target"
                        >
                          {deleting === rate.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Tax Rate" : "New Tax Rate"}
            </DialogTitle>
            <DialogDescription>
              {editingRate
                ? "Update the tax rate configuration."
                : "Define a new tax rate for this location."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="tr-name">Name *</Label>
              <Input
                id="tr-name"
                className="h-12"
                placeholder="State Sales Tax"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tr-rate">Rate (%) *</Label>
              <Input
                id="tr-rate"
                className="h-12 tabular-nums"
                placeholder="8.25"
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Default rate</p>
                <p className="text-xs text-muted-foreground">
                  Applied to items without a specific tax rate
                </p>
              </div>
              <Switch
                checked={formIsDefault}
                onCheckedChange={setFormIsDefault}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Tax inclusive</p>
                <p className="text-xs text-muted-foreground">
                  Tax is included in the item price
                </p>
              </div>
              <Switch
                checked={formIsInclusive}
                onCheckedChange={setFormIsInclusive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 touch-target"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 gap-2 btn-press touch-target"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRate ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaxRatesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-11 w-36" />
      </div>
      <Card className="shadow-warm-sm">
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
