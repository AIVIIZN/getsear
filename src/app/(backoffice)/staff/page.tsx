"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Clock,
  DollarSign,
  Loader2,
  Check,
  Pencil,
  UserX,
  ChevronRight,
  Calendar,
  Search,
  Banknote,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { USER_ROLES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffMember {
  id: string;
  org_id: string;
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  location_ids: string[];
  hire_date: string | null;
  hourly_rate: string | null;
  is_active: boolean;
  is_clocked_in: boolean;
  last_clock_in: string | null;
  created_at: string;
  updated_at: string;
}

interface TimeEntryRow {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_pay: string | null;
  cash_tips: string;
  credit_tips: string;
  is_approved: boolean;
  approved_by: string | null;
  notes: string | null;
  // joined
  staff_name?: string;
}

interface TipSummary {
  total_cash_tips: string;
  total_credit_tips: string;
  combined_total: string;
  by_staff: Array<{
    user_id: string;
    name: string;
    cash_tips: string;
    credit_tips: string;
    total_tips: string;
    hours_worked: string;
    tips_per_hour: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-pink-500",
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length];
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return "--";
  return `${hours.toFixed(1)}h`;
}

function formatMoney(amount: string | null): string {
  if (!amount) return "$0.00";
  const num = parseFloat(amount);
  return `$${num.toFixed(2)}`;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function weekAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Staff Management</h2>
        <p className="page-subtitle">
          Manage your team, time clock, and tips
        </p>
      </div>

      <Tabs defaultValue="roster" className="w-full">
        <TabsList className="h-11">
          <TabsTrigger value="roster" className="h-9 gap-2 touch-target">
            <Users className="h-4 w-4" />
            Roster
          </TabsTrigger>
          <TabsTrigger value="timeclock" className="h-9 gap-2 touch-target">
            <Clock className="h-4 w-4" />
            Time Clock
          </TabsTrigger>
          <TabsTrigger value="tips" className="h-9 gap-2 touch-target">
            <DollarSign className="h-4 w-4" />
            Tips
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-6">
          <RosterTab />
        </TabsContent>
        <TabsContent value="timeclock" className="mt-6">
          <TimeClockTab />
        </TabsContent>
        <TabsContent value="tips" className="mt-6">
          <TipsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROSTER TAB
// ---------------------------------------------------------------------------

function RosterTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("server");
  const [formRate, setFormRate] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formHireDate, setFormHireDate] = useState("");

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setStaff(json.data ?? []);
    } catch {
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  function resetForm() {
    setFormFirst("");
    setFormLast("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("server");
    setFormRate("");
    setFormPin("");
    setFormHireDate("");
    setEditingStaff(null);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(member: StaffMember) {
    setEditingStaff(member);
    setFormFirst(member.first_name);
    setFormLast(member.last_name);
    setFormEmail(member.email ?? "");
    setFormPhone(member.phone ?? "");
    setFormRole(member.role);
    setFormRate(member.hourly_rate ?? "");
    setFormPin("");
    setFormHireDate(member.hire_date ?? "");
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!formFirst.trim() || !formLast.trim()) {
      toast.error("First and last name are required");
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        first_name: formFirst,
        last_name: formLast,
        email: formEmail || null,
        phone: formPhone || null,
        role: formRole,
        hourly_rate: formRate || null,
        hire_date: formHireDate || null,
      };

      if (formPin) {
        payload.pin = formPin;
      }

      if (editingStaff) {
        const res = await fetch(`/api/staff/${editingStaff.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update");
        }
        toast.success("Staff member updated");
      } else {
        const res = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create");
        }
        toast.success("Staff member created");
      }

      setSheetOpen(false);
      resetForm();
      fetchStaff();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!editingStaff) return;
    if (!confirm(`Deactivate ${editingStaff.first_name} ${editingStaff.last_name}? They will no longer be able to log in.`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/staff/${editingStaff.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to deactivate");
      toast.success("Staff member deactivated");
      setSheetOpen(false);
      resetForm();
      fetchStaff();
    } catch {
      toast.error("Failed to deactivate staff member");
    } finally {
      setSaving(false);
    }
  }

  const filtered = staff.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      (s.email?.toLowerCase().includes(q) ?? false) ||
      s.role.toLowerCase().includes(q)
    );
  });

  if (loading) return <RosterSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button onClick={openCreate} className="h-11 gap-2 btn-press touch-target">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? "No results" : "No staff members yet"}
          description={
            searchQuery
              ? "Try adjusting your search."
              : "Add your first team member to get started."
          }
          actionLabel={searchQuery ? undefined : "Add Staff"}
          onAction={searchQuery ? undefined : openCreate}
        />
      ) : (
        <Card className="shadow-warm-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => (
                <TableRow
                  key={member.id}
                  className="cursor-pointer h-14 hover:bg-muted/40"
                  onClick={() => openEdit(member)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          {member.avatar_url ? (
                            <AvatarImage src={member.avatar_url} alt={member.first_name} />
                          ) : null}
                          <AvatarFallback
                            className={`text-white text-sm font-medium ${getAvatarColor(
                              member.first_name + member.last_name
                            )}`}
                          >
                            {getInitials(member.first_name, member.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        {member.is_clocked_in && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 animate-pulse" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {member.first_name} {member.last_name}
                        </p>
                        {member.hire_date && (
                          <p className="text-xs text-muted-foreground">
                            Since {formatDate(member.hire_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.email || "--"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.phone || "--"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={member.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingStaff ? "Edit Staff Member" : "New Staff Member"}
            </SheetTitle>
            <SheetDescription>
              {editingStaff
                ? "Update this staff member's information."
                : "Add a new team member to your roster."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 py-6">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-first">First Name *</Label>
                <Input
                  id="staff-first"
                  className="h-12"
                  placeholder="John"
                  value={formFirst}
                  onChange={(e) => setFormFirst(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-last">Last Name *</Label>
                <Input
                  id="staff-last"
                  className="h-12"
                  placeholder="Doe"
                  value={formLast}
                  onChange={(e) => setFormLast(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  className="h-12"
                  placeholder="john@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  className="h-12"
                  placeholder="(555) 123-4567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formRole} onValueChange={(v) => v && setFormRole(v)}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.filter((r) => r.value !== "platform_admin").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-rate">Hourly Rate ($)</Label>
                <Input
                  id="staff-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-12"
                  placeholder="15.00"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-hire">Hire Date</Label>
                <Input
                  id="staff-hire"
                  type="date"
                  className="h-12"
                  value={formHireDate}
                  onChange={(e) => setFormHireDate(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="staff-pin">
                PIN {editingStaff ? "(leave blank to keep current)" : "(4-6 digits)"}
              </Label>
              <Input
                id="staff-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="h-12"
                placeholder={editingStaff ? "****" : "0000"}
                value={formPin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setFormPin(v);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Used for clock-in and POS login
              </p>
            </div>

            {editingStaff && editingStaff.is_active && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  onClick={handleDeactivate}
                  disabled={saving}
                  className="h-11 w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 touch-target"
                >
                  <UserX className="h-4 w-4" />
                  Deactivate Staff Member
                </Button>
              </>
            )}
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
              {editingStaff ? "Save Changes" : "Create Staff"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TIME CLOCK TAB
// ---------------------------------------------------------------------------

function TimeClockTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, entriesRes] = await Promise.all([
        fetch("/api/staff"),
        fetch(`/api/staff/tips?start=${selectedDate}&end=${selectedDate}`),
      ]);

      if (staffRes.ok) {
        const staffJson = await staffRes.json();
        setStaff(staffJson.data ?? []);
      }

      // We need to fetch all time entries for the date across all staff
      // Use the staff list to fetch individually or get from active entries
      // For simplicity, fetch all staff and their time entries for the date
      const staffJson = await (await fetch("/api/staff")).json();
      const allStaff: StaffMember[] = staffJson.data ?? [];

      const allEntries: TimeEntryRow[] = [];
      const staffMap = new Map(allStaff.map((s) => [s.id, s]));

      // Fetch time entries for each staff member for the selected date
      const entryPromises = allStaff.slice(0, 50).map(async (s) => {
        const res = await fetch(
          `/api/staff/${s.id}/time-entries?start=${selectedDate}&end=${selectedDate}`
        );
        if (res.ok) {
          const json = await res.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (json.data ?? []).map((e: any) => ({
            ...e,
            staff_name: `${s.first_name} ${s.last_name}`,
          }));
        }
        return [];
      });

      const results = await Promise.all(entryPromises);
      for (const r of results) {
        allEntries.push(...r);
      }

      // Sort by clock_in desc
      allEntries.sort(
        (a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()
      );

      setEntries(allEntries);
      setStaff(allStaff);
    } catch {
      toast.error("Failed to load time clock data");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleClockOut(staffId: string) {
    setActionLoading(staffId);
    try {
      const res = await fetch(`/api/staff/${staffId}/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clock out");
      }
      toast.success("Clocked out successfully");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clock out");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(entryId: string) {
    setActionLoading(entryId);
    try {
      const res = await fetch(`/api/staff/time-entries/${entryId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast.success("Time entry approved");
      fetchData();
    } catch {
      toast.error("Failed to approve time entry");
    } finally {
      setActionLoading(null);
    }
  }

  function openEditEntry(entry: TimeEntryRow) {
    setEditingEntry(entry);
    // Convert ISO to datetime-local format
    setEditClockIn(entry.clock_in ? entry.clock_in.slice(0, 16) : "");
    setEditClockOut(entry.clock_out ? entry.clock_out.slice(0, 16) : "");
    setEditNotes(entry.notes ?? "");
    setEditSheetOpen(true);
  }

  async function handleEditSave() {
    if (!editingEntry) return;
    setEditSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {};
      if (editClockIn) payload.clock_in = new Date(editClockIn).toISOString();
      if (editClockOut) payload.clock_out = new Date(editClockOut).toISOString();
      if (editNotes !== (editingEntry.notes ?? "")) payload.notes = editNotes || null;

      const res = await fetch(`/api/staff/time-entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Time entry updated");
      setEditSheetOpen(false);
      fetchData();
    } catch {
      toast.error("Failed to update time entry");
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) return <TimeClockSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-11 w-44"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No time entries"
          description="No clock-in records found for this date."
        />
      ) : (
        <Card className="shadow-warm-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead className="text-right">Break</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isActive = !entry.clock_out;
                const totalHours =
                  (entry.regular_hours ?? 0) + (entry.overtime_hours ?? 0);

                return (
                  <TableRow key={entry.id} className="h-14">
                    <TableCell className="font-medium text-sm">
                      {entry.staff_name ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatTime(entry.clock_in)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {isActive ? (
                        <span className="text-green-600 font-medium">In progress</span>
                      ) : (
                        formatTime(entry.clock_out)
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">--</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {isActive ? (
                        <RunningTimer clockIn={entry.clock_in} />
                      ) : (
                        formatHours(totalHours)
                      )}
                    </TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          Active
                        </Badge>
                      ) : entry.is_approved ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-1.5 touch-target"
                            disabled={actionLoading === entry.user_id}
                            onClick={() => handleClockOut(entry.user_id)}
                          >
                            {actionLoading === entry.user_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                            Clock Out
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 touch-target"
                              onClick={() => openEditEntry(entry)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!entry.is_approved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 touch-target"
                                disabled={actionLoading === entry.id}
                                onClick={() => handleApprove(entry.id)}
                              >
                                {actionLoading === entry.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Time Entry Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Time Entry</SheetTitle>
            <SheetDescription>
              {editingEntry?.staff_name ?? "Staff member"} &mdash;{" "}
              {formatDate(editingEntry?.clock_in ?? null)}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="edit-clock-in">Clock In</Label>
              <Input
                id="edit-clock-in"
                type="datetime-local"
                className="h-12"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clock-out">Clock Out</Label>
              <Input
                id="edit-clock-out"
                type="datetime-local"
                className="h-12"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                className="h-12"
                placeholder="Reason for edit..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setEditSheetOpen(false)}
              className="h-11 touch-target"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving}
              className="h-11 gap-2 btn-press touch-target"
            >
              {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TIPS TAB
// ---------------------------------------------------------------------------

function TipsTab() {
  const [tipData, setTipData] = useState<TipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(weekAgoISO());
  const [endDate, setEndDate] = useState(todayISO());

  const fetchTips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/tips?start=${startDate}&end=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setTipData(json.data ?? null);
    } catch {
      toast.error("Failed to load tip data");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchTips();
  }, [fetchTips]);

  if (loading) return <TipsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 w-44"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-warm-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Cash Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(tipData?.total_cash_tips ?? "0")}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-warm-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Card Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(tipData?.total_credit_tips ?? "0")}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-warm-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Combined Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {formatMoney(tipData?.combined_total ?? "0")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-server breakdown */}
      {!tipData?.by_staff?.length ? (
        <EmptyState
          icon={DollarSign}
          title="No tip data"
          description="No tips recorded for this date range."
        />
      ) : (
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="text-base">Per-Server Breakdown</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Cash Tips</TableHead>
                <TableHead className="text-right">Card Tips</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">$/hr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipData.by_staff.map((s) => (
                <TableRow key={s.user_id} className="h-12">
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatMoney(s.cash_tips)}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatMoney(s.credit_tips)}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium tabular-nums">
                    {formatMoney(s.total_tips)}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {parseFloat(s.hours_worked).toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatMoney(s.tips_per_hour)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running Timer Component
// ---------------------------------------------------------------------------

function RunningTimer({ clockIn }: { clockIn: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    function update() {
      const diff = Date.now() - new Date(clockIn).getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${hours}h ${mins}m`);
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [clockIn]);

  return (
    <span className="text-green-600 font-medium tabular-nums">{elapsed}</span>
  );
}

// ---------------------------------------------------------------------------
// Role Badge
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-200",
  admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  server: "bg-green-50 text-green-700 border-green-200",
  bartender: "bg-amber-50 text-amber-700 border-amber-200",
  host: "bg-teal-50 text-teal-700 border-teal-200",
  kitchen: "bg-orange-50 text-orange-700 border-orange-200",
  cashier: "bg-cyan-50 text-cyan-700 border-cyan-200",
  driver: "bg-rose-50 text-rose-700 border-rose-200",
  kiosk: "bg-gray-100 text-gray-600 border-gray-200",
  readonly: "bg-gray-100 text-gray-500 border-gray-200",
};

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const label =
    USER_ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <Badge variant="outline" className={`capitalize text-xs font-medium ${style}`}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RosterSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-11 w-64" />
        <Skeleton className="h-11 w-32" />
      </div>
      <Card className="shadow-warm-sm">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TimeClockSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-44" />
      </div>
      <Card className="shadow-warm-sm">
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TipsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-44" />
        <Skeleton className="h-11 w-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-warm-sm">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
