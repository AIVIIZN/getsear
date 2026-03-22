"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Types ---

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

// --- Constants ---

const ACCOUNT_FIELDS: {
  key: keyof AccountMappings;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "sales_account",
    label: "Sales Revenue Account",
    placeholder: "e.g. 4000 - Sales Revenue",
  },
  {
    key: "tax_account",
    label: "Sales Tax Payable Account",
    placeholder: "e.g. 2100 - Sales Tax Payable",
  },
  {
    key: "tips_account",
    label: "Tips Payable Account",
    placeholder: "e.g. 2200 - Tips Payable",
  },
  {
    key: "cash_account",
    label: "Cash on Hand Account",
    placeholder: "e.g. 1010 - Cash on Hand",
  },
  {
    key: "card_account",
    label: "Credit Card Clearing Account",
    placeholder: "e.g. 1050 - CC Clearing",
  },
  {
    key: "gift_card_account",
    label: "Gift Card Liability Account",
    placeholder: "e.g. 2300 - Gift Card Liability",
  },
  {
    key: "discount_account",
    label: "Discounts Account",
    placeholder: "e.g. 4900 - Discounts Given",
  },
  {
    key: "cogs_account",
    label: "Cost of Goods Sold Account",
    placeholder: "e.g. 5000 - COGS",
  },
  {
    key: "labor_account",
    label: "Labor / Payroll Account",
    placeholder: "e.g. 6000 - Payroll Expense",
  },
];

const SYNC_TYPE_LABELS: Record<SyncType, string> = {
  daily_sales: "Daily Sales",
  payments: "Payments",
  labor: "Labor",
};

// --- Page Component ---

export default function AccountingPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" /></div>}>
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

  // Show success/error messages from callback redirect
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) {
      toast.success(success);
      // Clean URL
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
      // Redirect to QBO OAuth page
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
      setDisconnectOpen(false);
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
      toast.success(
        `${SYNC_TYPE_LABELS[syncType]} sync completed`
      );
      setSyncHistory((prev) => [
        {
          sync_id: json.sync_id,
          status: json.status,
          sync_type: json.sync_type,
          created_at: json.created_at,
        },
        ...prev,
      ]);
      fetchStatus(); // Refresh last_sync_at
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sync failed";
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
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          QuickBooks Online Integration
        </h2>
        <p className="text-sm text-muted-foreground">
          Sync daily sales, payments, and labor data to your accounting system.
        </p>
      </div>

      {/* Connection status card */}
      <Card className="shadow-warm-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2CA01C]/10">
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" fill="#2CA01C" />
                  <path
                    d="M8 12c0-1.66 1.34-3 3-3h2c1.66 0 3 1.34 3 3s-1.34 3-3 3h-2c-1.66 0-3-1.34-3-3z"
                    fill="white"
                  />
                </svg>
              </div>
              <div>
                <CardTitle className="text-base">QuickBooks Online</CardTitle>
                <CardDescription className="mt-0.5">
                  {isConnected
                    ? "Your account is connected and syncing."
                    : "Connect to automatically sync sales, payments, and labor data."}
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-success/10 text-success border-success/20 shrink-0">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground shrink-0">
                Disconnected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {status?.realm_id && (
                <div className="text-muted-foreground">
                  Company ID:{" "}
                  <span className="font-mono text-foreground">
                    {status.realm_id}
                  </span>
                </div>
              )}
              {status?.last_sync_at && (
                <div className="text-muted-foreground">
                  Last sync:{" "}
                  <span className="text-foreground">
                    {new Date(status.last_sync_at).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="ml-auto">
                <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      />
                    }
                  >
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                    Disconnect
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disconnect QuickBooks?</DialogTitle>
                      <DialogDescription>
                        This will stop all automatic syncing. Your existing data
                        in QuickBooks will not be affected. You can reconnect at
                        any time.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDisconnectOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                      >
                        {disconnecting && (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        Disconnect
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-press"
            >
              {connecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-1.5 h-4 w-4" />
              )}
              Connect to QuickBooks
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Account mappings — only when connected */}
      {isConnected && (
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="text-base">Account Mappings</CardTitle>
            <CardDescription>
              Map Sear POS data to your QuickBooks chart of accounts. Enter the
              account name or number as it appears in QuickBooks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {ACCOUNT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key} className="text-sm">
                    {field.label}
                  </Label>
                  <Input
                    id={field.key}
                    value={mappings[field.key] ?? ""}
                    onChange={(e) => updateMapping(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-press"
              >
                {savingSettings && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Save Mappings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync section — only when connected */}
      {isConnected && (
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="text-base">Manual Sync</CardTitle>
            <CardDescription>
              Trigger a sync to push data to QuickBooks immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Sync Type</Label>
                <Select
                  value={syncType}
                  onValueChange={(v) =>
                    v && setSyncType(v as SyncType)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily_sales">Daily Sales</SelectItem>
                    <SelectItem value="payments">Payments</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="btn-press"
              >
                {syncing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                Sync Now
              </Button>
            </div>

            {/* Sync history */}
            {syncHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-2 text-sm font-medium text-foreground">
                  Recent Syncs
                </h4>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.map((entry) => (
                        <TableRow key={entry.sync_id}>
                          <TableCell className="text-sm">
                            {new Date(entry.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {SYNC_TYPE_LABELS[
                              entry.sync_type as SyncType
                            ] ?? entry.sync_type}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                entry.status === "completed"
                                  ? "bg-success/10 text-success border-success/20"
                                  : entry.status === "failed"
                                    ? "bg-error/10 text-error border-error/20"
                                    : "bg-warning/10 text-warning border-warning/20"
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
          </CardContent>
        </Card>
      )}

      {/* Info section */}
      <Card className="shadow-warm-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">What Gets Synced</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Daily sales totals by category
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Payment method breakdown (cash, card, gift card)
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Tax collected
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Tips collected and distributed
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Labor hours and cost
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Discounts and comps
            </li>
          </ul>
          <p className="mt-4 rounded-lg bg-info/5 px-3 py-2 text-sm text-info border border-info/10">
            Syncs automatically at end-of-day close. Use manual sync for
            on-demand updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <Card className="shadow-warm-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 mt-1" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
      <Card className="shadow-warm-sm">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
