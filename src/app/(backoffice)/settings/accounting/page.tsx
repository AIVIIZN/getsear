"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Unplug,
  Zap,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Badge } from "@/components/ui-v2/data/Badge";
import { Text } from "@/components/ui-v2/inputs/Text";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Alert } from "@/components/ui-v2/feedback/Alert";
import { ConfirmDialog } from "@/components/ui-v2/feedback/ConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table";

interface AccountingStatus {
  is_connected: boolean;
  realm_id: string | null;
  last_sync_at: string | null;
  settings: AccountMappings;
}

interface AccountMappings {
  sales_account?: string;
  tax_account?: string;
  tips_account?: string;
  cash_account?: string;
  card_account?: string;
  gift_card_account?: string;
  discount_account?: string;
  cogs_account?: string;
  labor_account?: string;
}

interface SyncLogEntry {
  sync_id: string;
  status: string;
  sync_type: string;
  created_at: string;
}

type SyncType = "daily_sales" | "payments" | "labor";

const ACCOUNT_FIELDS: {
  key: keyof AccountMappings;
  label: string;
  placeholder: string;
}[] = [
  { key: "sales_account", label: "Sales Revenue Account", placeholder: "e.g. 4000 - Sales Revenue" },
  { key: "tax_account", label: "Sales Tax Payable Account", placeholder: "e.g. 2100 - Sales Tax Payable" },
  { key: "tips_account", label: "Tips Payable Account", placeholder: "e.g. 2200 - Tips Payable" },
  { key: "cash_account", label: "Cash on Hand Account", placeholder: "e.g. 1010 - Cash on Hand" },
  { key: "card_account", label: "Credit Card Clearing Account", placeholder: "e.g. 1050 - CC Clearing" },
  { key: "gift_card_account", label: "Gift Card Liability Account", placeholder: "e.g. 2300 - Gift Card Liability" },
  { key: "discount_account", label: "Discounts Account", placeholder: "e.g. 4900 - Discounts Given" },
  { key: "cogs_account", label: "Cost of Goods Sold Account", placeholder: "e.g. 5000 - COGS" },
  { key: "labor_account", label: "Labor / Payroll Account", placeholder: "e.g. 6000 - Payroll Expense" },
];

const SYNC_TYPE_LABELS: Record<SyncType, string> = {
  daily_sales: "Daily Sales",
  payments: "Payments",
  labor: "Labor",
};

const SYNC_OPTIONS: { value: SyncType; label: string }[] = [
  { value: "daily_sales", label: "Daily Sales" },
  { value: "payments", label: "Payments" },
  { value: "labor", label: "Labor" },
];

export default function AccountingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-[var(--space-6)]">
          <Skeleton className="h-7 w-64" />
          <Skeleton variant="card" />
        </div>
      }
    >
      <AccountingPage />
    </Suspense>
  );
}

function AccountingPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<AccountingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncType, setSyncType] = useState<SyncType>("daily_sales");
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [mappings, setMappings] = useState<AccountMappings>({});

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) {
      toast.success(success);
      window.history.replaceState({}, "", "/settings/accounting");
    }
    if (error) {
      toast.error(error);
      window.history.replaceState({}, "", "/settings/accounting");
    }
  }, [searchParams]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting/status");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const data = json.data as AccountingStatus;
      setStatus(data);
      setMappings(data.settings ?? {});
    } catch {
      toast.error("Failed to load accounting status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/accounting/connect");
      if (!res.ok) throw new Error("Failed to get connect URL");
      const json = await res.json();
      window.location.href = json.url;
    } catch {
      toast.error("Failed to initiate QuickBooks connection");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/accounting/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("Disconnected from QuickBooks");
      fetchStatus();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/accounting/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappings),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Account mappings saved");
    } catch {
      toast.error("Failed to save account mappings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/accounting/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_type: syncType }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Sync failed");
      }
      const json = await res.json();
      toast.success(`${SYNC_TYPE_LABELS[syncType]} sync completed`);
      setSyncHistory((prev) => [
        {
          sync_id: json.sync_id,
          status: json.status,
          sync_type: json.sync_type,
          created_at: json.created_at,
        },
        ...prev,
      ]);
      fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  function updateMapping(key: keyof AccountMappings, value: string) {
    setMappings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return <AccountingSkeleton />;
  }

  const isConnected = status?.is_connected ?? false;

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          QuickBooks Online Integration
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Sync daily sales, payments, and labor data to your accounting system.
        </p>
      </div>

      {/* Connection status card */}
      <Card variant="flat" padding="default">
        <CardHeader>
          <div className="flex items-start justify-between gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-success-bg)]">
                <BookOpen className="h-6 w-6 text-[color:var(--color-success)]" />
              </div>
              <div>
                <CardTitle>QuickBooks Online</CardTitle>
                <CardDescription className="mt-[2px]">
                  {isConnected
                    ? "Your account is connected and syncing."
                    : "Connect to automatically sync sales, payments, and labor data."}
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="success" shape="pill">
                <CheckCircle2 className="mr-[var(--space-1)] h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="default" shape="pill">
                Disconnected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {isConnected ? (
            <div className="flex flex-wrap items-center gap-x-[var(--space-6)] gap-y-[var(--space-2)] text-[length:var(--type-subhead-size)]">
              {status?.realm_id && (
                <div className="text-[color:var(--color-text-muted)]">
                  Company ID:{" "}
                  <span className="font-mono text-[color:var(--color-text)]">{status.realm_id}</span>
                </div>
              )}
              {status?.last_sync_at && (
                <div className="text-[color:var(--color-text-muted)]">
                  Last sync:{" "}
                  <span className="text-[color:var(--color-text)]">
                    {new Date(status.last_sync_at).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="ml-auto">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setDisconnectOpen(true)}
                  leadingIcon={<Unplug className="h-4 w-4" />}
                  className="text-[color:var(--color-danger)]"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                onClick={handleConnect}
                size="lg"
                loading={connecting}
                leadingIcon={<ExternalLink className="h-4 w-4" />}
              >
                Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Account mappings */}
      {isConnected && (
        <Card variant="flat" padding="default">
          <CardHeader>
            <CardTitle>Account Mappings</CardTitle>
            <CardDescription>
              Map Sear POS data to your QuickBooks chart of accounts. Enter the
              account name or number as it appears in QuickBooks.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
              {ACCOUNT_FIELDS.map((field) => (
                <Text
                  key={field.key}
                  size="md"
                  label={field.label}
                  id={field.key}
                  value={mappings[field.key] ?? ""}
                  onChange={(e) => updateMapping(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              ))}
            </div>
            <div className="mt-[var(--space-6)] flex justify-end">
              <Button onClick={handleSaveSettings} size="lg" loading={savingSettings}>
                Save Mappings
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sync section */}
      {isConnected && (
        <Card variant="flat" padding="default">
          <CardHeader>
            <CardTitle>Manual Sync</CardTitle>
            <CardDescription>
              Trigger a sync to push data to QuickBooks immediately.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-end gap-[var(--space-3)]">
              <div className="w-48">
                <Select
                  size="md"
                  label="Sync Type"
                  options={SYNC_OPTIONS}
                  value={syncType}
                  onChange={(v) => setSyncType(v as SyncType)}
                />
              </div>
              <Button
                onClick={handleSync}
                size="lg"
                loading={syncing}
                leadingIcon={<RefreshCw className="h-4 w-4" />}
              >
                Sync Now
              </Button>
            </div>

            {syncHistory.length > 0 && (
              <div className="mt-[var(--space-6)]">
                <h4 className="mb-[var(--space-2)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]">
                  Recent Syncs
                </h4>
                <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell header>Date</TableCell>
                        <TableCell header>Type</TableCell>
                        <TableCell header>Status</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.map((entry) => (
                        <TableRow key={entry.sync_id}>
                          <TableCell>
                            {new Date(entry.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {SYNC_TYPE_LABELS[entry.sync_type as SyncType] ?? entry.sync_type}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                entry.status === "completed"
                                  ? "success"
                                  : entry.status === "failed"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {entry.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Info section */}
      <Card variant="flat" padding="default">
        <CardHeader>
          <div className="flex items-center gap-[var(--space-2)]">
            <BookOpen className="h-4 w-4 text-[color:var(--color-text-muted)]" />
            <CardTitle>What Gets Synced</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <ul className="grid gap-[var(--space-2)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] sm:grid-cols-2">
            {[
              "Daily sales totals by category",
              "Payment method breakdown (cash, card, gift card)",
              "Tax collected",
              "Tips collected and distributed",
              "Labor hours and cost",
              "Discounts and comps",
            ].map((item) => (
              <li key={item} className="flex items-center gap-[var(--space-2)]">
                <Zap className="h-3.5 w-3.5 text-[color:var(--color-primary)]" />
                {item}
              </li>
            ))}
          </ul>
          <Alert variant="info" className="mt-[var(--space-4)]">
            Syncs automatically at end-of-day close. Use manual sync for on-demand updates.
          </Alert>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect QuickBooks?"
        description="This will stop all automatic syncing. Your existing data in QuickBooks will not be affected. You can reconnect at any time."
        confirmLabel="Disconnect"
        variant="destructive"
        loading={disconnecting}
        onConfirm={handleDisconnect}
      />
    </div>
  );
}

function AccountingSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-[var(--space-2)] h-4 w-96" />
      </div>
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
