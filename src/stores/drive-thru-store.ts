'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface Car {
  id: string
  lane_id: string
  order_id: string | null
  position: 'ordering' | 'payment' | 'pickup'
  entered_at: string
  order_placed_at: string | null
  payment_at: string | null
  pickup_at: string | null
  exited_at: string | null
  total_time_seconds: number | null
  order_total: number | null
}

export interface Lane {
  id: string
  number: number
  name: string
  is_active: boolean
  cars: Car[]
  cars_per_hour: number
  avg_total_time: number // seconds
}

export interface SpeedMetrics {
  avg_total_time: number
  avg_menu_time: number
  avg_payment_time: number
  avg_pickup_time: number
  cars_per_hour: number
  target_total_time: number
  by_daypart: Array<{
    daypart: string
    avg_time: number
    count: number
  }>
  by_lane: Array<{
    lane_id: string
    lane_name: string
    avg_time: number
    count: number
  }>
}

interface DriveThruState {
  lanes: Lane[]
  metrics: SpeedMetrics | null
  isLoading: boolean
  selectedCar: Car | null
}

interface DriveThruActions {
  setLanes: (lanes: Lane[]) => void
  setMetrics: (metrics: SpeedMetrics | null) => void
  setIsLoading: (loading: boolean) => void
  setSelectedCar: (car: Car | null) => void
  addCarToLane: (laneId: string, car: Car) => void
  updateCarPosition: (carId: string, position: Car['position']) => void
  removeCarFromLane: (carId: string) => void
}

export const useDriveThruStore = create<DriveThruState & DriveThruActions>()(
  immer((set) => ({
    lanes: [],
    metrics: null,
    isLoading: false,
    selectedCar: null,

    setLanes: (lanes) => set((s) => { s.lanes = lanes }),
    setMetrics: (metrics) => set((s) => { s.metrics = metrics }),
    setIsLoading: (loading) => set((s) => { s.isLoading = loading }),
    setSelectedCar: (car) => set((s) => { s.selectedCar = car }),
    addCarToLane: (laneId, car) => set((s) => {
      const lane = s.lanes.find((l) => l.id === laneId)
      if (lane) lane.cars.push(car)
    }),
    updateCarPosition: (carId, position) => set((s) => {
      for (const lane of s.lanes) {
        const car = lane.cars.find((c) => c.id === carId)
        if (car) {
          car.position = position
          const now = new Date().toISOString()
          if (position === 'payment') car.payment_at = now
          if (position === 'pickup') car.pickup_at = now
          break
        }
      }
    }),
    removeCarFromLane: (carId) => set((s) => {
      for (const lane of s.lanes) {
        lane.cars = lane.cars.filter((c) => c.id !== carId)
      }
    }),
  }))
)
