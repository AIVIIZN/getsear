"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Plus,
  Phone,
  Mail,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
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
  const [formTimezone, setFormTimezone] = useState("America/New_York");

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
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Locations</h2>
          <p className="text-sm text-muted-foreground">
            {locations.length} location{locations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 gap-2 btn-press touch-target">
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      {/* Location cards */}
      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your first restaurant location to get started."
          actionLabel="Add Location"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((loc) => (
            <Card
              key={loc.id}
              className="cursor-pointer shadow-warm-sm transition-shadow hover:shadow-warm-md"
              onClick={() => openEdit(loc)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{loc.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {[loc.address_line1, loc.city, loc.state, loc.zip]
                        .filter(Boolean)
                        .join(", ") || "No address set"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={loc.is_active ? "active" : "inactive"} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {loc.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {loc.phone}
                    </span>
                  )}
                  {loc.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {loc.email}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
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

          <div className="space-y-5 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="loc-name">Location Name *</Label>
              <Input
                id="loc-name"
                className="h-12"
                placeholder="Downtown"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-addr">Address Line 1</Label>
              <Input
                id="loc-addr"
                className="h-12"
                placeholder="123 Main St"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-addr2">Address Line 2</Label>
              <Input
                id="loc-addr2"
                className="h-12"
                placeholder="Suite 100"
                value={formAddress2}
                onChange={(e) => setFormAddress2(e.target.value)}
              />
            </div>

            <div className="grid gap-4 grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="loc-city">City</Label>
                <Input
                  id="loc-city"
                  className="h-12"
                  placeholder="Austin"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-state">State</Label>
                <Input
                  id="loc-state"
                  className="h-12"
                  placeholder="TX"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-zip">ZIP</Label>
                <Input
                  id="loc-zip"
                  className="h-12"
                  placeholder="78701"
                  value={formZip}
                  onChange={(e) => setFormZip(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loc-phone">Phone</Label>
                <Input
                  id="loc-phone"
                  className="h-12"
                  placeholder="(512) 555-0100"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-email">Email</Label>
                <Input
                  id="loc-email"
                  type="email"
                  className="h-12"
                  placeholder="downtown@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={formTimezone} onValueChange={(v) => v && setFormTimezone(v)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="shadow-warm-sm">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
