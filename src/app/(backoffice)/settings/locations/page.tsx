"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Phone, Mail, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Text } from "@/components/ui-v2/inputs/Text";
import { Email } from "@/components/ui-v2/inputs/Email";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Badge } from "@/components/ui-v2/data/Badge";
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui-v2/Sheet";
import type { Location } from "@/types/database";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

const TZ_OPTIONS = TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }));

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAddress2, setFormAddress2] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formZip, setFormZip] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTimezone, setFormTimezone] = useState<string>("America/New_York");

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/locations");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setLocations(json.data ?? []);
    } catch {
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  function resetForm() {
    setFormName("");
    setFormAddress("");
    setFormAddress2("");
    setFormCity("");
    setFormState("");
    setFormZip("");
    setFormPhone("");
    setFormEmail("");
    setFormTimezone("America/New_York");
    setEditingLocation(null);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(loc: Location) {
    setEditingLocation(loc);
    setFormName(loc.name);
    setFormAddress(loc.address_line1 ?? "");
    setFormAddress2(loc.address_line2 ?? "");
    setFormCity(loc.city ?? "");
    setFormState(loc.state ?? "");
    setFormZip(loc.zip ?? "");
    setFormPhone(loc.phone ?? "");
    setFormEmail(loc.email ?? "");
    setFormTimezone(loc.timezone ?? "America/New_York");
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Location name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        address_line1: formAddress || undefined,
        address_line2: formAddress2 || undefined,
        city: formCity || undefined,
        state: formState || undefined,
        zip: formZip || undefined,
        phone: formPhone || undefined,
        email: formEmail || undefined,
        timezone: formTimezone,
      };

      if (editingLocation) {
        const res = await fetch(`/api/settings/locations/${editingLocation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Location updated");
      } else {
        const slug = formName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const res = await fetch("/api/settings/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, slug }),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("Location created");
      }

      setSheetOpen(false);
      resetForm();
      fetchLocations();
    } catch {
      toast.error("Failed to save location");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LocationsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Locations
          </h2>
          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            {locations.length} location{locations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={openCreate}
          size="lg"
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          Add Location
        </Button>
      </div>

      {/* Location cards */}
      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your first restaurant location to get started."
          action={{ label: "Add Location", onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
          {locations.map((loc) => (
            <Card
              key={loc.id}
              variant="interactive"
              padding="default"
              onClick={() => openEdit(loc)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-[var(--space-3)]">
                  <div className="min-w-0 flex-1">
                    <CardTitle>{loc.name}</CardTitle>
                    <CardDescription className="mt-[var(--space-1)]">
                      {[loc.address_line1, loc.city, loc.state, loc.zip]
                        .filter(Boolean)
                        .join(", ") || "No address set"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Badge variant={loc.is_active ? "success" : "default"}>
                      {loc.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                  </div>
                </div>
              </CardHeader>
              <div className="flex flex-wrap items-center gap-x-[var(--space-4)] gap-y-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                {loc.phone && (
                  <span className="flex items-center gap-[var(--space-1)]">
                    <Phone className="h-3.5 w-3.5" />
                    {loc.phone}
                  </span>
                )}
                {loc.email && (
                  <span className="flex items-center gap-[var(--space-1)]">
                    <Mail className="h-3.5 w-3.5" />
                    {loc.email}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" width="lg">
          <SheetHeader>
            <SheetTitle>
              {editingLocation ? "Edit Location" : "New Location"}
            </SheetTitle>
            <SheetDescription>
              {editingLocation
                ? "Update location details and settings."
                : "Add a new restaurant location."}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-[var(--space-5)]">
            <Text
              size="lg"
              label="Location Name"
              required
              placeholder="Downtown"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Text
              size="lg"
              label="Address Line 1"
              placeholder="123 Main St"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />
            <Text
              size="lg"
              label="Address Line 2"
              placeholder="Suite 100"
              value={formAddress2}
              onChange={(e) => setFormAddress2(e.target.value)}
            />
            <div className="grid gap-[var(--space-4)] grid-cols-3">
              <Text
                size="lg"
                label="City"
                placeholder="Austin"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
              <Text
                size="lg"
                label="State"
                placeholder="TX"
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
              />
              <Text
                size="lg"
                label="ZIP"
                placeholder="78701"
                value={formZip}
                onChange={(e) => setFormZip(e.target.value)}
              />
            </div>
            <div className="grid gap-[var(--space-4)] grid-cols-2">
              <Text
                size="lg"
                label="Phone"
                placeholder="(512) 555-0100"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
              <Email
                size="lg"
                label="Email"
                placeholder="downtown@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <Select
              size="lg"
              label="Timezone"
              options={TZ_OPTIONS}
              value={formTimezone}
              onChange={setFormTimezone}
            />
          </SheetBody>

          <SheetFooter>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} size="lg" loading={saving}>
              {editingLocation ? "Save Changes" : "Create Location"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LocationsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}
