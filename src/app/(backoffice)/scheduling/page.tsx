"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { WeeklyGrid } from "@/components/scheduling/WeeklyGrid";
import {
  CalendarDays,
  Plus,
  Loader2,
  Clock,
  ArrowRightLeft,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Separator } from "@/components/ui/separator";

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

interface ScheduleTemplate {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
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

const ROLE_COLORS: Record<string, string> = {
  server: "bg-blue-100 text-blue-700 border-blue-200",
  bartender: "bg-purple-100 text-purple-700 border-purple-200",
  kitchen: "bg-orange-100 text-orange-700 border-orange-200",
  host: "bg-teal-100 text-teal-700 border-teal-200",
  manager: "bg-indigo-100 text-indigo-700 border-indigo-200",
  cashier: "bg-green-100 text-green-700 border-green-200",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SchedulingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">
          Staff Scheduling
        </h2>
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
  const [createDate, setCreateDate] = useState("");

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
          `/api/scheduling/shifts?date_from=${dateFrom}&date_to=${dateTo}`
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

  const staffMap = new Map(staff.map((s) => [s.id, s]));

  // Group shifts by user_id and date
  const shiftsByUserDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = `${shift.user_id}__${shift.date}`;
    if (!shiftsByUserDate.has(key)) shiftsByUserDate.set(key, []);
    shiftsByUserDate.get(key)!.push(shift);
  }

  // Get unique staff who have shifts this week
  const staffWithShifts = new Set(shifts.map((s) => s.user_id));
  const displayStaff = staff.filter(
    (s) => staffWithShifts.has(s.id) || true
  );

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
    const hours =
      (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
    return sum + Math.max(0, hours);
  }, 0);

  return (
    <div className="space-y-4 mt-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={thisWeek}>
            This Week
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {shifts.length} shifts | {totalHours.toFixed(1)}h total
          </span>
          <Button
            onClick={() => {
              setShowCreate(true);
              setNewDate(weekDates[0]);
            }}
            className="btn-press gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Shift
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : displayStaff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members"
          description="Add staff members first, then create their schedule"
        />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">
                  Staff
                </TableHead>
                {weekDates.map((date, i) => (
                  <TableHead key={date} className="min-w-[120px] text-center">
                    <div className="text-xs text-muted-foreground">
                      {DAY_NAMES[i]}
                    </div>
                    <div className="font-medium">{formatDateShort(date)}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayStaff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">
                    <div className="text-sm">
                      {member.display_name ??
                        `${member.first_name} ${member.last_name}`}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {member.role}
                    </div>
                  </TableCell>
                  {weekDates.map((date) => {
                    const key = `${member.id}__${date}`;
                    const dayShifts = shiftsByUserDate.get(key) ?? [];
                    return (
                      <TableCell key={date} className="p-1 align-top">
                        <div className="space-y-1">
                          {dayShifts.map((shift) => {
                            const roleClass =
                              ROLE_COLORS[shift.role ?? ""] ??
                              "bg-gray-100 text-gray-700 border-gray-200";
                            return (
                              <div
                                key={shift.id}
                                className={`rounded-md border px-2 py-1 text-xs cursor-pointer group relative ${roleClass}`}
                              >
                                <div className="font-medium">
                                  {formatTime(shift.start_time)} -{" "}
                                  {formatTime(shift.end_time)}
                                </div>
                                {shift.role && (
                                  <div className="capitalize opacity-75">
                                    {shift.role}
                                  </div>
                                )}
                                <button
                                  className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-white rounded-full hidden group-hover:flex items-center justify-center"
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
                              className="w-full h-8 rounded-md border border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/50 transition-colors flex items-center justify-center"
                              onClick={() => {
                                setNewDate(date);
                                setNewUserId(member.id);
                                setShowCreate(true);
                              }}
                            >
                              <Plus className="h-3 w-3 text-muted-foreground" />
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
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Shift</SheetTitle>
            <SheetDescription>
              Create a shift assignment for a staff member
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div>
              <Label>Staff Member *</Label>
              <Select
                value={newUserId}
                onValueChange={(v) => v && setNewUserId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name ??
                        `${s.first_name} ${s.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => v && setNewRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "server",
                    "bartender",
                    "kitchen",
                    "host",
                    "manager",
                    "cashier",
                  ].map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="capitalize">{r}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateShift}
              disabled={creating}
              className="btn-press"
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedUser}
          onValueChange={(v) => v && setSelectedUser(v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.display_name ?? `${s.first_name} ${s.last_name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : availability.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No availability set"
          description="Staff members have not submitted their availability yet"
        />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Staff</TableHead>
                {DAY_NAMES_FULL.map((day) => (
                  <TableHead key={day} className="text-center min-w-[100px]">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(byUser.entries()).map(([userId, entries]) => {
                const member = staffMap.get(userId);
                return (
                  <TableRow key={userId}>
                    <TableCell className="font-medium">
                      {member
                        ? member.display_name ??
                          `${member.first_name} ${member.last_name}`
                        : userId.slice(0, 8)}
                    </TableCell>
                    {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                      const dayEntries = entries.filter(
                        (e) => e.day_of_week === dow
                      );
                      return (
                        <TableCell key={dow} className="text-center p-1">
                          {dayEntries.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              --
                            </span>
                          ) : (
                            dayEntries.map((e) => (
                              <div
                                key={e.id}
                                className={`text-xs rounded px-1 py-0.5 mb-0.5 ${
                                  e.is_available
                                    ? "bg-green-50 text-green-700"
                                    : "bg-red-50 text-red-700"
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
  const [shifts, setShifts] = useState<Shift[]>([]);
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
    ])
  );

  const handleAction = async (swapId: string, status: "approved" | "rejected") => {
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
            <Skeleton key={i} className="h-12 w-full" />
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
              <h3 className="text-sm font-medium text-foreground mb-2">
                Pending Requests ({pendingSwaps.length})
              </h3>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Swap With</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSwaps.map((swap) => (
                      <TableRow key={swap.id}>
                        <TableCell className="font-medium">
                          {staffMap.get(swap.requesting_user_id) ??
                            swap.requesting_user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {swap.original_shift_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {swap.target_user_id
                            ? staffMap.get(swap.target_user_id) ??
                              swap.target_user_id.slice(0, 8)
                            : "Open"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(swap.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => handleAction(swap.id, "approved")}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleAction(swap.id, "rejected")}
                            >
                              <X className="h-3 w-3 mr-1" />
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
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Resolved ({resolvedSwaps.length})
              </h3>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Swap With</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedSwaps.map((swap) => (
                      <TableRow key={swap.id}>
                        <TableCell className="font-medium">
                          {staffMap.get(swap.requesting_user_id) ??
                            swap.requesting_user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {swap.original_shift_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {swap.target_user_id
                            ? staffMap.get(swap.target_user_id) ??
                              swap.target_user_id.slice(0, 8)
                            : "Open"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={swap.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
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
