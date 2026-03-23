"use client";

import { useEffect, useState, useCallback } from "react";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffRoster } from "@/components/staff/StaffRoster";
import { TimeClock } from "@/components/staff/TimeClock";
import { PermissionsTab } from "@/components/staff/PermissionsTab";
import { TipsTab } from "@/components/staff/TipsTab";
import { CashDrawersTab } from "@/components/staff/CashDrawersTab";
import { ScheduleTab } from "@/components/staff/ScheduleTab";
import { PayrollTab } from "@/components/staff/PayrollTab";
import type { StaffMember } from "@/stores/staff-store";

// ---------------------------------------------------------------------------
// Staff Management Hub — 7 tabs
// ---------------------------------------------------------------------------

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("roster");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const json = await res.json();
        setStaff(json.data ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Staff & Labor
          </h1>
          <p className="text-sm text-muted-foreground">
            {staff.filter((s) => s.is_active).length} active employees
            {staff.filter((s) => s.is_clocked_in).length > 0 &&
              ` — ${staff.filter((s) => s.is_clocked_in).length} on duty`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="border-b border-border px-6">
          <TabsList variant="line" className="h-10">
            <TabsTrigger value="roster" className="text-sm px-4">
              Roster
            </TabsTrigger>
            <TabsTrigger value="time-clock" className="text-sm px-4">
              Time Clock
            </TabsTrigger>
            <TabsTrigger value="permissions" className="text-sm px-4">
              Permissions
            </TabsTrigger>
            <TabsTrigger value="tips" className="text-sm px-4">
              Tips
            </TabsTrigger>
            <TabsTrigger value="cash-drawers" className="text-sm px-4">
              Cash Drawers
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-sm px-4">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="payroll" className="text-sm px-4">
              Payroll
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <TabsContent value="roster">
            <StaffRoster
              staff={staff}
              loading={loading}
              onRefresh={loadStaff}
            />
          </TabsContent>

          <TabsContent value="time-clock">
            <TimeClock />
          </TabsContent>

          <TabsContent value="permissions">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <PermissionsTab staff={staff} />
            )}
          </TabsContent>

          <TabsContent value="tips">
            <TipsTab staff={staff} />
          </TabsContent>

          <TabsContent value="cash-drawers">
            <CashDrawersTab />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTab staff={staff} />
          </TabsContent>

          <TabsContent value="payroll">
            <PayrollTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
