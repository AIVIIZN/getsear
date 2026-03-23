import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffMember {
  id: string
  org_id: string
  email: string | null
  phone: string | null
  first_name: string
  last_name: string
  display_name: string | null
  avatar_url: string | null
  role: string
  location_ids: string[]
  hire_date: string | null
  hourly_rate: string | null
  is_active: boolean
  is_clocked_in: boolean
  last_clock_in: string | null
  created_at: string
  updated_at: string
}

export interface OnDutyEmployee {
  userId: string
  firstName: string
  lastName: string
  role: string
  clockIn: string
  timeEntryId: string
  isOnBreak: boolean
  breakStartedAt: string | null
  breakType: string | null
  hoursWorked: number
  isInOvertime: boolean
  isApproachingOt: boolean
  hoursUntilOt: number
}

export interface TimeEntryRow {
  id: string
  user_id: string
  location_id: string
  clock_in: string
  clock_out: string | null
  regular_hours: number | null
  overtime_hours: number | null
  total_pay: string | null
  hourly_rate: string | null
  cash_tips: string
  credit_tips: string
  tip_out_given: string
  tip_out_received: string
  is_approved: boolean
  approved_by: string | null
  notes: string | null
  role_during_shift: string | null
  staff_name?: string
  staff_role?: string
}

export type StaffTab = 'roster' | 'time-clock' | 'permissions' | 'tips' | 'cash-drawers' | 'schedule' | 'payroll'
export type TipsSubTab = 'distribution' | 'pool-config' | 'server-checkout'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface StaffState {
  // Navigation
  activeTab: StaffTab
  tipsSubTab: TipsSubTab
  setActiveTab: (tab: StaffTab) => void
  setTipsSubTab: (tab: TipsSubTab) => void

  // Staff list
  staff: StaffMember[]
  staffLoading: boolean
  setStaff: (staff: StaffMember[]) => void
  setStaffLoading: (loading: boolean) => void

  // Selected employee
  selectedEmployeeId: string | null
  setSelectedEmployeeId: (id: string | null) => void

  // On-duty board
  onDutyEmployees: OnDutyEmployee[]
  setOnDutyEmployees: (employees: OnDutyEmployee[]) => void

  // Time entries
  timeEntries: TimeEntryRow[]
  timeEntriesLoading: boolean
  setTimeEntries: (entries: TimeEntryRow[]) => void
  setTimeEntriesLoading: (loading: boolean) => void

  // Filters
  roleFilter: string
  statusFilter: string
  searchQuery: string
  setRoleFilter: (role: string) => void
  setStatusFilter: (status: string) => void
  setSearchQuery: (query: string) => void

  // Bulk selection
  selectedIds: Set<string>
  toggleSelected: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void

  // Sheets/dialogs
  isCreateSheetOpen: boolean
  isEditSheetOpen: boolean
  isDetailViewOpen: boolean
  setCreateSheetOpen: (open: boolean) => void
  setEditSheetOpen: (open: boolean) => void
  setDetailViewOpen: (open: boolean) => void
}

export const useStaffStore = create<StaffState>()(
  immer((set) => ({
    activeTab: 'roster',
    tipsSubTab: 'distribution',
    setActiveTab: (tab) => set((s) => { s.activeTab = tab }),
    setTipsSubTab: (tab) => set((s) => { s.tipsSubTab = tab }),

    staff: [],
    staffLoading: false,
    setStaff: (staff) => set((s) => { s.staff = staff }),
    setStaffLoading: (loading) => set((s) => { s.staffLoading = loading }),

    selectedEmployeeId: null,
    setSelectedEmployeeId: (id) => set((s) => { s.selectedEmployeeId = id }),

    onDutyEmployees: [],
    setOnDutyEmployees: (employees) => set((s) => { s.onDutyEmployees = employees }),

    timeEntries: [],
    timeEntriesLoading: false,
    setTimeEntries: (entries) => set((s) => { s.timeEntries = entries }),
    setTimeEntriesLoading: (loading) => set((s) => { s.timeEntriesLoading = loading }),

    roleFilter: 'all',
    statusFilter: 'active',
    searchQuery: '',
    setRoleFilter: (role) => set((s) => { s.roleFilter = role }),
    setStatusFilter: (status) => set((s) => { s.statusFilter = status }),
    setSearchQuery: (query) => set((s) => { s.searchQuery = query }),

    selectedIds: new Set(),
    toggleSelected: (id) =>
      set((s) => {
        if (s.selectedIds.has(id)) {
          s.selectedIds.delete(id)
        } else {
          s.selectedIds.add(id)
        }
      }),
    selectAll: (ids) => set((s) => { s.selectedIds = new Set(ids) }),
    clearSelection: () => set((s) => { s.selectedIds = new Set() }),

    isCreateSheetOpen: false,
    isEditSheetOpen: false,
    isDetailViewOpen: false,
    setCreateSheetOpen: (open) => set((s) => { s.isCreateSheetOpen = open }),
    setEditSheetOpen: (open) => set((s) => { s.isEditSheetOpen = open }),
    setDetailViewOpen: (open) => set((s) => { s.isDetailViewOpen = open }),
  }))
)
