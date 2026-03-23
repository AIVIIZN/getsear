import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleShift {
  id: string
  userId: string | null
  employeeName: string | null
  role: string
  date: string
  startTime: string
  endTime: string
  isPublished: boolean
  notes: string | null
  hourlyRateCents: number
}

export interface SwapRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterShift: { date: string; startTime: string; endTime: string; role: string }
  targetId: string | null
  targetName: string | null
  targetShift: { date: string; startTime: string; endTime: string; role: string } | null
  type: 'swap' | 'drop' | 'pickup'
  status: 'pending' | 'approved' | 'denied'
  reason: string | null
  createdAt: string
}

export interface ScheduleTemplate {
  id: string
  name: string
  shiftCount: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ScheduleState {
  // Calendar state
  weekStartDate: string
  setWeekStartDate: (date: string) => void

  // Shifts
  shifts: ScheduleShift[]
  shiftsLoading: boolean
  setShifts: (shifts: ScheduleShift[]) => void
  setShiftsLoading: (loading: boolean) => void

  // Drag state
  draggedShiftId: string | null
  setDraggedShiftId: (id: string | null) => void

  // Open shifts
  openShifts: ScheduleShift[]
  setOpenShifts: (shifts: ScheduleShift[]) => void

  // Swap requests
  swapRequests: SwapRequest[]
  setSwapRequests: (requests: SwapRequest[]) => void

  // Templates
  templates: ScheduleTemplate[]
  setTemplates: (templates: ScheduleTemplate[]) => void

  // Marketplace sidebar
  isMarketplaceOpen: boolean
  setMarketplaceOpen: (open: boolean) => void

  // Shift edit
  editingShiftId: string | null
  isShiftModalOpen: boolean
  setEditingShiftId: (id: string | null) => void
  setShiftModalOpen: (open: boolean) => void

  // Template dialog
  isTemplateDialogOpen: boolean
  setTemplateDialogOpen: (open: boolean) => void

  // Availability overlay
  showAvailability: boolean
  setShowAvailability: (show: boolean) => void
}

export const useScheduleStore = create<ScheduleState>()(
  immer((set) => {
    // Default to Monday of current week
    const now = new Date()
    const day = now.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    const defaultWeekStart = monday.toISOString().split('T')[0]

    return {
      weekStartDate: defaultWeekStart,
      setWeekStartDate: (date) => set((s) => { s.weekStartDate = date }),

      shifts: [],
      shiftsLoading: false,
      setShifts: (shifts) => set((s) => { s.shifts = shifts }),
      setShiftsLoading: (loading) => set((s) => { s.shiftsLoading = loading }),

      draggedShiftId: null,
      setDraggedShiftId: (id) => set((s) => { s.draggedShiftId = id }),

      openShifts: [],
      setOpenShifts: (shifts) => set((s) => { s.openShifts = shifts }),

      swapRequests: [],
      setSwapRequests: (requests) => set((s) => { s.swapRequests = requests }),

      templates: [],
      setTemplates: (templates) => set((s) => { s.templates = templates }),

      isMarketplaceOpen: false,
      setMarketplaceOpen: (open) => set((s) => { s.isMarketplaceOpen = open }),

      editingShiftId: null,
      isShiftModalOpen: false,
      setEditingShiftId: (id) => set((s) => { s.editingShiftId = id }),
      setShiftModalOpen: (open) => set((s) => { s.isShiftModalOpen = open }),

      isTemplateDialogOpen: false,
      setTemplateDialogOpen: (open) => set((s) => { s.isTemplateDialogOpen = open }),

      showAvailability: false,
      setShowAvailability: (show) => set((s) => { s.showAvailability = show }),
    }
  })
)
