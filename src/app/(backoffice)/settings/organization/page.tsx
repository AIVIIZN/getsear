"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Text } from "@/components/ui-v2/inputs/Text";
import { Email } from "@/components/ui-v2/inputs/Email";
import { Field } from "@/components/ui-v2/inputs/Field";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";

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

const TZ_OPTIONS = TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }));
const CCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function OrganizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [timezone, setTimezone] = useState<string>("America/New_York");
  const [currency, setCurrency] = useState<string>("USD");

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[var(--space-6)]">
      {/* Page header */}
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          Organization
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Core business details, regional preferences, and subscription info.
        </p>
      </div>

      {/* Business Info */}
      <Card variant="flat" padding="default">
        <CardHeader>
          <CardTitle className="flex items-center gap-[var(--space-2)]">
            <Building2 className="h-5 w-5 text-[color:var(--color-primary)]" />
            Business Information
          </CardTitle>
          <CardDescription>Core details about your organization.</CardDescription>
        </CardHeader>
        <CardBody className="gap-[var(--space-5)]">
          <div className="grid gap-[var(--space-5)] sm:grid-cols-2">
            <Text
              size="lg"
              label="Organization Name"
              required
              placeholder="My Restaurant"
              {...register("name")}
              error={errors.name?.message}
            />
            <Text
              size="lg"
              label="Legal Name"
              placeholder="My Restaurant LLC"
              {...register("legal_name")}
            />
          </div>

          <div className="grid gap-[var(--space-5)] sm:grid-cols-3">
            <Text
              size="lg"
              label="Owner Name"
              placeholder="John Doe"
              {...register("owner_name")}
            />
            <Email
              size="lg"
              label="Owner Email"
              placeholder="john@example.com"
              {...register("owner_email")}
              error={errors.owner_email?.message}
            />
            <Text
              size="lg"
              label="Owner Phone"
              placeholder="(555) 123-4567"
              {...register("owner_phone")}
            />
          </div>
        </CardBody>
      </Card>

      {/* Regional Settings */}
      <Card variant="flat" padding="default">
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>
            Timezone and currency affect all locations by default.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid gap-[var(--space-5)] sm:grid-cols-3">
            <Select
              size="lg"
              label="Timezone"
              options={TZ_OPTIONS}
              value={timezone}
              onChange={(v) => setTimezone(v)}
            />
            <Select
              size="lg"
              label="Currency"
              options={CCY_OPTIONS}
              value={currency}
              onChange={(v) => setCurrency(v)}
            />
            <Field id="primary_color" label="Brand Color">
              <div className="flex items-center gap-[var(--space-3)]">
                <input
                  id="primary_color"
                  type="color"
                  className="h-[44px] w-[64px] cursor-pointer rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[2px]"
                  {...register("primary_color")}
                />
                <Text
                  size="lg"
                  className="flex-1 font-mono"
                  placeholder="#007AFF"
                  {...register("primary_color")}
                />
              </div>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Subscription Info (read-only) */}
      {orgData && (
        <Card variant="flat" padding="default">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid gap-[var(--space-5)] sm:grid-cols-2">
              <div>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  Plan
                </p>
                <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] capitalize text-[color:var(--color-text)]">
                  {orgData.plan}
                </p>
              </div>
              <div>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  Status
                </p>
                <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] capitalize text-[color:var(--color-text)]">
                  {orgData.subscription_status.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-end gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-low)]">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => fetchOrg()}
          disabled={saving || !isDirty}
        >
          Discard Changes
        </Button>
        <Button
          type="submit"
          size="lg"
          loading={saving}
          leadingIcon={<Save className="h-4 w-4" />}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}

function OrgSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <Skeleton variant="card" className="h-[260px]" />
      <Skeleton variant="card" className="h-[200px]" />
    </div>
  );
}
