"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
] as const;

const CURRENCIES = ["USD", "CAD", "MXN", "EUR", "GBP"] as const;

const orgSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(200),
  legal_name: z.string().max(200).optional(),
  owner_name: z.string().max(200).optional(),
  owner_email: z.string().email("Invalid email").optional().or(z.literal("")),
  owner_phone: z.string().max(20).optional(),
  primary_color: z.string().max(7).optional(),
});

type OrgFormValues = z.infer<typeof orgSchema>;

interface OrgData {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  logo_url: string | null;
  primary_color: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  settings: Record<string, unknown>;
}

export default function OrganizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");
  const [currency, setCurrency] = useState("USD");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
  });

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/organization");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const org = json.data as OrgData;
      setOrgData(org);
      reset({
        name: org.name ?? "",
        legal_name: (org.settings?.legal_name as string) ?? "",
        owner_name: org.owner_name ?? "",
        owner_email: org.owner_email ?? "",
        owner_phone: org.owner_phone ?? "",
        primary_color: org.primary_color ?? "#007AFF",
      });
      setTimezone((org.settings?.default_timezone as string) ?? "America/New_York");
      setCurrency((org.settings?.default_currency as string) ?? "USD");
    } catch {
      toast.error("Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const onSubmit = async (values: OrgFormValues) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          owner_name: values.owner_name || null,
          owner_email: values.owner_email || null,
          owner_phone: values.owner_phone || null,
          primary_color: values.primary_color || null,
          settings: {
            ...(orgData?.settings ?? {}),
            legal_name: values.legal_name || null,
            default_timezone: timezone,
            default_currency: currency,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      toast.success("Organization settings saved");
      fetchOrg();
    } catch {
      toast.error("Failed to save organization settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <OrgSkeleton />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Business Info */}
      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Business Information
          </CardTitle>
          <CardDescription>
            Core details about your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                className="h-12"
                placeholder="My Restaurant"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_name">Legal Name</Label>
              <Input
                id="legal_name"
                className="h-12"
                placeholder="My Restaurant LLC"
                {...register("legal_name")}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner Name</Label>
              <Input
                id="owner_name"
                className="h-12"
                placeholder="John Doe"
                {...register("owner_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_email">Owner Email</Label>
              <Input
                id="owner_email"
                type="email"
                className="h-12"
                placeholder="john@example.com"
                {...register("owner_email")}
              />
              {errors.owner_email && (
                <p className="text-xs text-destructive">{errors.owner_email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_phone">Owner Phone</Label>
              <Input
                id="owner_phone"
                className="h-12"
                placeholder="(555) 123-4567"
                {...register("owner_phone")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>
            Timezone and currency affect all locations by default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue placeholder="Select timezone" />
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
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_color">Brand Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="primary_color"
                  type="color"
                  className="h-12 w-16 cursor-pointer p-1"
                  {...register("primary_color")}
                />
                <Input
                  className="h-12 flex-1 font-mono"
                  placeholder="#007AFF"
                  {...register("primary_color")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Info (read-only) */}
      {orgData && (
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="text-sm font-medium capitalize">{orgData.plan}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm font-medium capitalize">
                  {orgData.subscription_status.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 rounded-xl border border-border bg-card p-4 shadow-warm-sm">
        <Button
          type="button"
          variant="outline"
          onClick={() => fetchOrg()}
          disabled={saving || !isDirty}
          className="h-11 touch-target"
        >
          Discard Changes
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-11 gap-2 touch-target btn-press"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

function OrgSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="shadow-warm-sm">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-warm-sm">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
