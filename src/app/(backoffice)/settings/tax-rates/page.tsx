"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui-v2/Button";
import { Card } from "@/components/ui-v2/Card";
import { Text } from "@/components/ui-v2/inputs/Text";
import { Toggle } from "@/components/ui-v2/inputs/Toggle";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Badge } from "@/components/ui-v2/data/Badge";
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
} from "@/components/ui-v2/Modal";
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
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Tax Rates
          </h2>
          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Configure tax rates for your location.
          </p>
        </div>
        <Button onClick={openCreate} size="lg" leadingIcon={<Plus className="h-4 w-4" />}>
          Add Tax Rate
        </Button>
      </div>

      {/* Table */}
      {taxRates.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No tax rates configured"
          description="Add a tax rate to start collecting sales tax."
          action={{ label: "Add Tax Rate", onClick: openCreate }}
        />
      ) : (
        <Card variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Name</TableCell>
                <TableCell header>Rate</TableCell>
                <TableCell header>Type</TableCell>
                <TableCell header>Default</TableCell>
                <TableCell header align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-[var(--weight-medium)]">
                    {rate.name}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {parseFloat(rate.rate).toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">
                      {rate.is_inclusive ? "Inclusive" : "Exclusive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rate.is_default && (
                      <Star className="h-4 w-4 fill-[color:var(--color-primary)] text-[color:var(--color-primary)]" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-[var(--space-1)]">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => openEdit(rate)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => handleDelete(rate.id)}
                        loading={deleting === rate.id}
                        aria-label="Delete"
                        className="text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-bg)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal open={dialogOpen} onOpenChange={setDialogOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>
              {editingRate ? "Edit Tax Rate" : "New Tax Rate"}
            </ModalTitle>
            <ModalDescription>
              {editingRate
                ? "Update the tax rate configuration."
                : "Define a new tax rate for this location."}
            </ModalDescription>
          </ModalHeader>

          <ModalBody className="gap-[var(--space-5)]">
            <Text
              size="lg"
              label="Name"
              required
              placeholder="State Sales Tax"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Text
              size="lg"
              label="Rate (%)"
              required
              placeholder="8.25"
              className="tabular-nums"
              value={formRate}
              onChange={(e) => setFormRate(e.target.value)}
            />

            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-[var(--space-4)]">
              <Toggle
                checked={formIsDefault}
                onChange={setFormIsDefault}
                label="Default rate"
                helper="Applied to items without a specific tax rate"
              />
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-[var(--space-4)]">
              <Toggle
                checked={formIsInclusive}
                onChange={setFormIsInclusive}
                label="Tax inclusive"
                helper="Tax is included in the item price"
              />
            </div>
          </ModalBody>

          <ModalFooter>
            <ModalClose
              render={
                <Button variant="secondary" size="lg">
                  Cancel
                </Button>
              }
            />
            <Button onClick={handleSave} size="lg" loading={saving}>
              {editingRate ? "Save Changes" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function TaxRatesSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-36" />
      </div>
      <Skeleton variant="table-row" />
      <Skeleton variant="table-row" />
      <Skeleton variant="table-row" />
    </div>
  );
}
