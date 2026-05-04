"use client";

import { useEffect, useState, useCallback } from "react";
import { Users } from "lucide-react";
import { Tabs } from "@/components/ui-v2/navigation/Tabs";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { StaffRoster } from "@/components/staff/StaffRoster";
import { TimeClock } from "@/components/staff/TimeClock";
import { PermissionsTab } from "@/components/staff/PermissionsTab";
import { TipsTab } from "@/components/staff/TipsTab";
import { CashDrawersTab } from "@/components/staff/CashDrawersTab";
import { ScheduleTab } from "@/components/staff/ScheduleTab";
import { PayrollTab } from "@/components/staff/PayrollTab";
import type { StaffMember } from "@/stores/staff-store";

const TABS = [
  { value: "roster", label: "Roster" },
  { value: "time-clock", label: "Time Clock" },
  { value: "permissions", label: "Permissions" },
  { value: "tips", label: "Tips" },
  { value: "cash-drawers", label: "Cash Drawers" },
  { value: "schedule", label: "Schedule" },
  { value: "payroll", label: "Payroll" },
];

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

  const activeCount = staff.filter((s) => s.is_active).length;
  const onDutyCount = staff.filter((s) => s.is_clocked_in).length;

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center gap-[var(--space-3)] px-[var(--space-6)] pt-[var(--space-6)] pb-[var(--space-4)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-sidebar-active)]">
          <Users className="h-5 w-5 text-[color:var(--color-primary)]" />
        </div>
        <div>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Staff & Labor
          </h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            {activeCount} active employee{activeCount !== 1 ? "s" : ""}
            {onDutyCount > 0 && ` — ${onDutyCount} on duty`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-[var(--space-6)]">
        <Tabs
          variant="line"
          size="md"
          items={TABS}
          value={activeTab}
          onValueChange={setActiveTab}
          ariaLabel="Staff sections"
        />
      </div>

      <div className="scroll-container flex-1 overflow-y-auto px-[var(--space-6)] py-[var(--space-6)]">
        {activeTab === "roster" && (
          <StaffRoster staff={staff} loading={loading} onRefresh={loadStaff} />
        )}
        {activeTab === "time-clock" && <TimeClock />}
        {activeTab === "permissions" && (
          loading ? (
            <div className="flex flex-col gap-[var(--space-3)]">
              <Skeleton variant="table-row" />
              <Skeleton variant="table-row" />
              <Skeleton variant="table-row" />
              <Skeleton variant="table-row" />
            </div>
          ) : (
            <PermissionsTab staff={staff} />
          )
        )}
        {activeTab === "tips" && <TipsTab staff={staff} />}
        {activeTab === "cash-drawers" && <CashDrawersTab />}
        {activeTab === "schedule" && <ScheduleTab staff={staff} />}
        {activeTab === "payroll" && <PayrollTab />}
      </div>
    </div>
  );
}
