'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface Delivery {
  id: string
  order_id: string
  status: 'pending' | 'assigned' | 'picked_up' | 'en_route' | 'delivered' | 'cancelled'
  driver_id: string | null
  driver_name: string | null
  customer_name: string
  customer_phone: string
  delivery_address: string
  lat: number | null
  lng: number | null
  estimated_time: string | null
  actual_time: string | null
  proof_photo_url: string | null
  order_total: number
  delivery_fee: number
  notes: string | null
  created_at: string
}

export interface Driver {
  id: string
  name: string
  phone: string
  status: 'available' | 'on_delivery' | 'offline'
  current_lat: number | null
  current_lng: number | null
  active_deliveries: number
  completed_today: number
}

interface DeliveryState {
  deliveries: Delivery[]
  drivers: Driver[]
  activeTab: string
  isLoading: boolean
  selectedDelivery: Delivery | null
}

interface DeliveryActions {
  setDeliveries: (deliveries: Delivery[]) => void
  setDrivers: (drivers: Driver[]) => void
  setActiveTab: (tab: string) => void
  setIsLoading: (loading: boolean) => void
  setSelectedDelivery: (delivery: Delivery | null) => void
  updateDeliveryStatus: (id: string, status: Delivery['status']) => void
  updateDriverLocation: (driverId: string, lat: number, lng: number) => void
}

export const useDeliveryStore = create<DeliveryState & DeliveryActions>()(
  immer((set) => ({
    deliveries: [],
    drivers: [],
    activeTab: 'queue',
    isLoading: false,
    selectedDelivery: null,

    setDeliveries: (deliveries) => set((s) => { s.deliveries = deliveries }),
    setDrivers: (drivers) => set((s) => { s.drivers = drivers }),
    setActiveTab: (tab) => set((s) => { s.activeTab = tab }),
    setIsLoading: (loading) => set((s) => { s.isLoading = loading }),
    setSelectedDelivery: (delivery) => set((s) => { s.selectedDelivery = delivery }),
    updateDeliveryStatus: (id, status) => set((s) => {
      const d = s.deliveries.find((d) => d.id === id)
      if (d) d.status = status
    }),
    updateDriverLocation: (driverId, lat, lng) => set((s) => {
      const d = s.drivers.find((d) => d.id === driverId)
      if (d) { d.current_lat = lat; d.current_lng = lng }
    }),
  }))
)
