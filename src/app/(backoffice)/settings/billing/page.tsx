"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, LockKeyhole, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui-v2/Button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui-v2/Card";
import { Badge } from "@/components/ui-v2/data/Badge";

interface BillingStatus {
  tier: string;
  organization: {
    plan: string;
    subscription_status: string;
    trial_ends_at: string | null;
  };
  plans: Record<string, { id: string; name: string; price: number | null; interval: string; description: string }>;
  features: Array<{ key: string; label: string; minimumTier: string; enabled: boolean }>;
}

function money(cents: number | null) {
  if (cents === null) return "Talk to us";
  return `$${(cents / 100).toFixed(0)}/mo`;
}

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => res.json())
      .then((json) => setStatus(json.data))
      .catch(() => toast.error("Unable to load billing status"));
  }, []);

  async function startCheckout(plan: string) {
    if (plan === "enterprise") {
      window.location.href = "mailto:sales@getsear.com?subject=Enterprise%20Sear%20POS%20plan";
      return;
    }

    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unable to start checkout");
      window.location.href = json.data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start checkout");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          Billing
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Manage trial, subscription tier, and feature access.
        </p>
      </div>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="flex items-center gap-[var(--space-2)]">
            <CreditCard className="h-5 w-5 text-[color:var(--color-primary)]" />
            Current subscription
          </CardTitle>
          <CardDescription>
            {status
              ? `${status.organization.plan} · ${status.organization.subscription_status.replace(/_/g, " ")}`
              : "Loading billing status"}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-[var(--space-4)] lg:grid-cols-3">
        {status &&
          Object.values(status.plans).map((plan) => (
            <Card key={plan.id} variant="flat" className="justify-between">
              <CardHeader>
                <div className="flex items-center justify-between gap-[var(--space-3)]">
                  <CardTitle>{plan.name}</CardTitle>
                  {status.tier === plan.id ? <Badge variant="success">Current</Badge> : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardBody>
                <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  {money(plan.price)}
                </p>
                <Button
                  size="md"
                  variant={status.tier === plan.id ? "secondary" : "primary"}
                  loading={loadingPlan === plan.id}
                  trailingIcon={plan.id === "enterprise" ? <ExternalLink /> : undefined}
                  onClick={() => startCheckout(plan.id)}
                >
                  {plan.id === "enterprise" ? "Contact sales" : status.tier === plan.id ? "Manage plan" : "Choose plan"}
                </Button>
              </CardBody>
            </Card>
          ))}
      </div>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="flex items-center gap-[var(--space-2)]">
            <Sparkles className="h-5 w-5 text-[color:var(--color-primary)]" />
            Feature access
          </CardTitle>
          <CardDescription>Locked features return an upgrade prompt until the tier is active.</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
            {status?.features.map((feature) => (
              <div
                key={feature.key}
                className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-[var(--space-3)]"
              >
                <span className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text)]">
                  {!feature.enabled ? <LockKeyhole className="h-4 w-4 text-[color:var(--color-text-muted)]" /> : null}
                  {feature.label}
                </span>
                <Badge variant={feature.enabled ? "success" : "warning"}>
                  {feature.enabled ? "Enabled" : feature.minimumTier}
                </Badge>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
