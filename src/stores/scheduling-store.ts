'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface Shift {
  id: string
  staff_id: string
  staff_name: string
  role: string
  date: string // YYYY-MM-DD
  start_time: string // HH:mm
  end_time: string // HH:mm
  hours: number
  hourly_rate: number // cents
  cost: number // cents
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'no_show'
  is_posted: boolean // on marketplace
  color: string
}

export interface StaffMember {
  id: string
  name: string
  role: string
  hourly_rate: number
  color: string
  availability: Record<string, { available: boolean; start: string; end: string }>
}

export interface MarketplaceShift {
  id: string
  shift_id: string
  posted_by: string
  posted_by_name: string
  date: string
  start_time: string
  end_time: string
  role: string
  reason: string
  status: 'available' | 'claimed' | 'approved'
  claimed_by: string | null
  claimed_by_name: string | null
}

export interface LaborForecast {
  total_hours: number
  total_cost: number // cents
  projected_sales: number // cents
  labor_pct: number
  target_pct: number
  is_over_target: boolean
  by_day: Array<{
    date: string
    hours: number
    cost: number
    projected_sales: number
    labor_pct: number
  }>
}

interface SchedulingState {
  weekStart: string // YYYY-MM-DD (Monday)
  shifts: Shift[]
  staff: StaffMember[]
  marketplace: MarketplaceShift[]
  forecast: LaborForecast | null
  activeTab: string
  isLoading: boolean
  selectedShift: Shift | null
}

interface SchedulingActions {
  setWeekStart: (date: string) => void
  setShifts: (shifts: Shift[]) => void
  setStaff: (staff: StaffMember[]) => void
  setMarketplace: (marketplace: MarketplaceShift[]) => void
  setForecast: (forecast: LaborForecast | null) => void
  setActiveTab: (tab: string) => void
  setIsLoading: (loading: boolean) => void
  setSelectedShift: (shift: Shift | null) => void
  addShift: (shift: Shift) => void
  updateShift: (id: string, updates: Partial<Shift>) => void
  removeShift: (id: string) => void
}

export const useSchedulingStore = create<SchedulingState & SchedulingActions>()(
  immer((set) => {
    // Default to this Monday
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    const weekStart = monday.toISOString().split('T')[0]

    return {
      weekStart,
      shifts: [],
      staff: [],
      marketplace: [],
      forecast: null,
      activeTab: 'schedule',
      isLoading: false,
      selectedShift: null,

      setWeekStart: (date) => set((s) => { s.weekStart = date }),
      setShifts: (shifts) => set((s) => { s.shifts = shifts }),
      setStaff: (staff) => set((s) => { s.staff = staff }),
      setMarketplace: (marketplace) => set((s) => { s.marketplace = marketplace }),
      setForecast: (forecast) => set((s) => { s.forecast = forecast }),
      setActiveTab: (tab) => set((s) => { s.activeTab = tab }),
      setIsLoading: (loading) => set((s) => { s.isLoading = loading }),
      setSelectedShift: (shift) => set((s) => { s.selectedShift = shift }),
      addShift: (shift) => set((s) => { s.shifts.push(shift) }),
      updateShift: (id, updates) => set((s) => {
        const idx = s.shifts.findIndex((sh) => sh.id === id)
        if (idx >= 0) Object.assign(s.shifts[idx], updates)
      }),
      removeShift: (id) => set((s) => { s.shifts = s.shifts.filter((sh) => sh.id !== id) }),
    }
  })
)
