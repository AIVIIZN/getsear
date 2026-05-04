"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { WeeklyGrid } from "@/components/scheduling/WeeklyGrid";
import {
  CalendarDays,
  Plus,
  Clock,
  ArrowRightLeft,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui-v2/Button";
import { Card } from "@/components/ui-v2/Card";
import { Text } from "@/components/ui-v2/inputs/Text";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui-v2/Sheet";
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Shift {
  id: string;
  org_id: string;
  location_id: string | null;
  user_id: string;
  template_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: string;
}

interface Availability {
  id: string;
  org_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface SwapRequest {
  id: string;
  org_id: string;
  original_shift_id: string;
  requesting_user_id: string;
  target_user_id: string | null;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function getWeekDates(weekStart: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// Token-based role chip styles via color-mix on the primary token. Per-role
// hue comes from a small set of semantic accents already in tokens.css.
const ROLE_CHIP_BG: Record<string, string> = {
  server:
    "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
  bartender:
    "bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] text-[var(--color-primary)]",
  kitchen:
    "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  host:
    "bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]",
  manager:
    "bg-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] text-[var(--color-primary)]",
  cashier:
    "bg-[var(--color-success-bg)] text-[var(--color-success)]",
};

const ROLE_OPTIONS = [
  { value: "server", label: "Server" },
  { value: "bartender", label: "Bartender" },
  { value: "kitchen", label: "Kitchen" },
  { value: "host", label: "Host" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SchedulingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Staff Scheduling</h2>
        <p className="page-subtitle">
          Manage shifts, availability, and swap requests
        </p>
      </div>

      <Tabs defaultValue="weekly-grid" className="w-full">
        <TabsList className="h-11">
          <TabsTrigger value="weekly-grid" className="h-9 gap-2 touch-target">
            <CalendarDays className="h-4 w-4" />
            Weekly Grid
          </TabsTrigger>
          <TabsTrigger value="schedule" className="h-9 gap-2 touch-target">
            <CalendarDays className="h-4 w-4" />
            Shifts
          </TabsTrigger>
          <TabsTrigger value="availability" className="h-9 gap-2 touch-target">
            <Clock className="h-4 w-4" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="swaps" className="h-9 gap-2 touch-target">
            <ArrowRightLeft className="h-4 w-4" />
            Marketplace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly-grid">
          <WeeklyGrid />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab />
        </TabsContent>
        <TabsContent value="availability">
          <AvailabilityTab />
        </TabsContent>
        <TabsContent value="swaps">
          <SwapsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Tab — Week Grid
// ---------------------------------------------------------------------------

function ScheduleTab() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [showCreate, setShowCreate] = useState(false);

  // Shift creation state
  const [newUserId, setNewUserId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [newRole, setNewRole] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const weekDates = getWeekDates(weekStart);
  const dateFrom = weekDates[0];
  const dateTo = weekDates[6];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsRes, staffRes] = await Promise.all([
        fetch(
          `/api/scheduling/shifts?date_from=${dateFrom}&date_to=${dateTo}`,
        ),
        fetch("/api/staff?status=active"),
      ]);
      const [shiftsJson, staffJson] = await Promise.all([
        shiftsRes.json(),
        staffRes.json(),
      ]);
      if (shiftsRes.ok) setShifts(shiftsJson.data ?? []);
      if (staffRes.ok) setStaff(staffJson.data ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group shifts by user_id and date
  const shiftsByUserDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = `${shift.user_id}__${shift.date}`;
    if (!shiftsByUserDate.has(key)) shiftsByUserDate.set(key, []);
    shiftsByUserDate.get(key)!.push(shift);
  }

  const displayStaff = staff;

  const handleCreateShift = async () => {
    if (!newUserId || !newDate) {
      toast.error("Select a staff member and date");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/scheduling/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: newUserId,
          date: newDate,
          start_time: newStartTime,
          end_time: newEndTime,
          role: newRole || null,
          notes: newNotes || null,
          status: "draft",
        }),
      });
      if (res.ok) {
        toast.success("Shift created");
        setShowCreate(false);
        resetCreateForm();
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to create shift");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewUserId("");
    setNewDate("");
    setNewStartTime("09:00");
    setNewEndTime("17:00");
    setNewRole("");
    setNewNotes("");
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/scheduling/shifts/${shiftId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Shift deleted");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to delete shift");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const thisWeek = () => setWeekStart(getWeekStart(new Date()));

  // Count total hours
  const totalHours = shifts.reduce((sum, s) => {
    const start = s.start_time.split(":").map(Number);
    const end = s.end_time.split(":").map(Number);
    const hours = end[0] + end[1] / 60 - (start[0] + start[1] / 60);
    return sum + Math.max(0, hours);
  }, 0);

  const staffOptions = staff.map((s) => ({
    value: s.id,
    label: s.display_name ?? `${s.first_name} ${s.last_name}`,
  }));

  return (
    <div className="space-y-4 mt-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={prevWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="md" onClick={thisWeek}>
            This Week
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={nextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-[var(--space-2)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">
            {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
            {shifts.length} shifts | {totalHours.toFixed(1)}h total
          </span>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setShowCreate(true);
              setNewDate(weekDates[0]);
            }}
            leadingIcon={<Plus className="h-4 w-4" />}
          >
            Add Shift
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : displayStaff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members"
          description="Add staff members first, then create their schedule"
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  header
                  className="min-w-[140px] sticky left-0 bg-[var(--color-bg-subtle)] z-10"
                >
                  Staff
                </TableCell>
                {weekDates.map((date, i) => (
                  <TableCell
                    key={date}
                    header
                    align="center"
                    className="min-w-[120px]"
                  >
                    <div className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)] normal-case">
                      {DAY_NAMES[i]}
                    </div>
                    <div className="font-[var(--weight-medium)] normal-case text-[var(--color-text)]">
                      {formatDateShort(date)}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayStaff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-[var(--weight-medium)] sticky left-0 bg-[var(--color-surface)] z-10">
                    <div className="text-[length:var(--type-subhead-size)]">
                      {member.display_name ??
                        `${member.first_name} ${member.last_name}`}
                    </div>
                    <div className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)] capitalize">
                      {member.role}
                    </div>
                  </TableCell>
                  {weekDates.map((date) => {
                    const key = `${member.id}__${date}`;
                    const dayShifts = shiftsByUserDate.get(key) ?? [];
                    return (
                      <TableCell key={date} className="!p-1 align-top">
                        <div className="space-y-1">
                          {dayShifts.map((shift) => {
                            const chipCls =
                              ROLE_CHIP_BG[shift.role ?? ""] ??
                              "bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]";
                            return (
                              <div
                                key={shift.id}
                                className={`rounded-[var(--radius-xs)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-caption-1-size)] cursor-pointer group relative ${chipCls}`}
                              >
                                <div className="font-[var(--weight-medium)]">
                                  {formatTime(shift.start_time)} -{" "}
                                  {formatTime(shift.end_time)}
                                </div>
                                {shift.role && (
                                  <div className="capitalize opacity-75">
                                    {shift.role}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  aria-label="Remove shift"
                                  className="btn-press absolute -top-1 -right-1 h-4 w-4 bg-[var(--color-danger)] text-[var(--color-primary-fg)] rounded-[var(--radius-circle)] hidden group-hover:flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteShift(shift.id);
                                  }}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            );
                          })}
                          {dayShifts.length === 0 && (
                            <button
                              type="button"
                              aria-label="Add shift"
                              className="btn-press w-full h-8 rounded-[var(--radius-xs)] border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
                              onClick={() => {
                                setNewDate(date);
                                setNewUserId(member.id);
                                setShowCreate(true);
                              }}
                            >
                              <Plus className="h-3 w-3 text-[var(--color-text-muted)]" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Shift Sheet */}
      <Sheet
        open={showCreate}
        onOpenChange={(o) => {
          if (!o) {
            setShowCreate(false);
            resetCreateForm();
          }
        }}
      >
        <SheetContent width="md">
          <SheetHeader>
            <SheetTitle>New Shift</SheetTitle>
            <SheetDescription>
              Create a shift assignment for a staff member
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <Select
              label="Staff Member"
              required
              placeholder="Select staff"
              options={staffOptions}
              value={newUserId}
              onChange={(v) => setNewUserId(v)}
            />
            <Text
              label="Date"
              required
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Start Time"
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
              />
              <Text
                label="End Time"
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </div>
            <Select
              label="Role"
              placeholder="Select role"
              options={ROLE_OPTIONS}
              value={newRole}
              onChange={(v) => setNewRole(v)}
            />
            <Text
              label="Notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </SheetBody>
          <SheetFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateShift}
              loading={creating}
            >
              Create Shift
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Availability Tab
// ---------------------------------------------------------------------------

function AvailabilityTab() {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUser !== "all") params.set("user_id", selectedUser);
      const [availRes, staffRes] = await Promise.all([
        fetch(`/api/scheduling/availability?${params}`),
        fetch("/api/staff?status=active"),
      ]);
      const [availJson, staffJson] = await Promise.all([
        availRes.json(),
        staffRes.json(),
      ]);
      if (availRes.ok) setAvailability(availJson.data ?? []);
      if (staffRes.ok) setStaff(staffJson.data ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const staffMap = new Map(staff.map((s) => [s.id, s]));

  // Group by user_id
  const byUser = new Map<string, Availability[]>();
  for (const a of availability) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id)!.push(a);
  }

  const userFilterOptions = [
    { value: "all", label: "All Staff" },
    ...staff.map((s) => ({
      value: s.id,
      label: s.display_name ?? `${s.first_name} ${s.last_name}`,
    })),
  ];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-4">
        <div className="w-[240px]">
          <Select
            options={userFilterOptions}
            value={selectedUser}
            onChange={(v) => setSelectedUser(v)}
            ariaLabel="Filter by staff"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : availability.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No availability set"
          description="Staff members have not submitted their availability yet"
        />
      ) : (
        <Card padding="compact" className="!p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header className="min-w-[140px]">
                  Staff
                </TableCell>
                {DAY_NAMES_FULL.map((day) => (
                  <TableCell
                    key={day}
                    header
                    align="center"
                    className="min-w-[100px]"
                  >
                    {day}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(byUser.entries()).map(([userId, entries]) => {
                const member = staffMap.get(userId);
                return (
                  <TableRow key={userId}>
                    <TableCell className="font-[var(--weight-medium)]">
                      {member
                        ? (member.display_name ??
                          `${member.first_name} ${member.last_name}`)
                        : userId.slice(0, 8)}
                    </TableCell>
                    {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                      const dayEntries = entries.filter(
                        (e) => e.day_of_week === dow,
                      );
                      return (
                        <TableCell
                          key={dow}
                          align="center"
                          className="!p-[var(--space-1)]"
                        >
                          {dayEntries.length === 0 ? (
                            <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                              --
                            </span>
                          ) : (
                            dayEntries.map((e) => (
                              <div
                                key={e.id}
                                className={`text-[length:var(--type-caption-1-size)] rounded-[var(--radius-xs)] px-[var(--space-1)] py-[2px] mb-[2px] ${
                                  e.is_available
                                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                                    : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                                }`}
                              >
                                {formatTime(e.start_time)}-
                                {formatTime(e.end_time)}
                              </div>
                            ))
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Swap Requests Tab
// ---------------------------------------------------------------------------

function SwapsTab() {
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [swapsRes, staffRes] = await Promise.all([
        fetch("/api/scheduling/swap-requests"),
        fetch("/api/staff?status=active"),
      ]);
      const [swapsJson, staffJson] = await Promise.all([
        swapsRes.json(),
        staffRes.json(),
      ]);
      if (swapsRes.ok) setSwaps(swapsJson.data ?? []);
      if (staffRes.ok) setStaff(staffJson.data ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const staffMap = new Map(
    staff.map((s) => [
      s.id,
      s.display_name ?? `${s.first_name} ${s.last_name}`,
    ]),
  );

  const handleAction = async (
    swapId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      const res = await fetch(`/api/scheduling/swap-requests/${swapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Swap ${status}`);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error ?? `Failed to ${status} swap`);
      }
    } catch {
      toast.error("Network error");
    }
  };

  const pendingSwaps = swaps.filter((s) => s.status === "pending");
  const resolvedSwaps = swaps.filter((s) => s.status !== "pending");

  return (
    <div className="space-y-4 mt-4">
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : swaps.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="No swap requests"
          description="Staff swap requests will appear here when submitted"
        />
      ) : (
        <>
          {/* Pending */}
          {pendingSwaps.length > 0 && (
            <div>
              <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)] mb-[var(--space-2)]">
                Pending Requests ({pendingSwaps.length})
              </h3>
              <Card padding="compact" className="!p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell header>Requested By</TableCell>
                      <TableCell header>Shift</TableCell>
                      <TableCell header>Swap With</TableCell>
                      <TableCell header>Submitted</TableCell>
                      <TableCell header align="right">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSwaps.map((swap) => (
                      <TableRow key={swap.id}>
                        <TableCell className="font-[var(--weight-medium)]">
                          {staffMap.get(swap.requesting_user_id) ??
                            swap.requesting_user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-mono text-[length:var(--type-footnote-size)]">
                          {swap.original_shift_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {swap.target_user_id
                            ? (staffMap.get(swap.target_user_id) ??
                              swap.target_user_id.slice(0, 8))
                            : "Open"}
                        </TableCell>
                        <TableCell className="text-[var(--color-text-muted)]">
                          {new Date(swap.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleAction(swap.id, "approved")
                              }
                              leadingIcon={<Check className="h-3 w-3" />}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleAction(swap.id, "rejected")
                              }
                              leadingIcon={<X className="h-3 w-3" />}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Resolved */}
          {resolvedSwaps.length > 0 && (
            <div>
              <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)] mb-[var(--space-2)]">
                Resolved ({resolvedSwaps.length})
              </h3>
              <Card padding="compact" className="!p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell header>Requested By</TableCell>
                      <TableCell header>Shift</TableCell>
                      <TableCell header>Swap With</TableCell>
                      <TableCell header>Status</TableCell>
                      <TableCell header>Date</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedSwaps.map((swap) => (
                      <TableRow key={swap.id}>
                        <TableCell className="font-[var(--weight-medium)]">
                          {staffMap.get(swap.requesting_user_id) ??
                            swap.requesting_user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-mono text-[length:var(--type-footnote-size)]">
                          {swap.original_shift_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {swap.target_user_id
                            ? (staffMap.get(swap.target_user_id) ??
                              swap.target_user_id.slice(0, 8))
                            : "Open"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={swap.status} />
                        </TableCell>
                        <TableCell className="text-[var(--color-text-muted)]">
                          {new Date(swap.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
