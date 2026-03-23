'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface LoyaltyMember {
  id: string
  org_id: string
  customer_id: string
  customer_name: string
  phone: string
  program_id: string
  points_balance: number
  tier: string
  total_earned: number
  total_redeemed: number
  visit_count: number
  enrolled_at: string
}

export interface LoyaltyTier {
  name: string
  min_points: number
  earn_multiplier: number
  benefits: string[]
  color: string
}

export interface LoyaltyReward {
  id: string
  name: string
  description: string
  points_cost: number
  type: 'free_item' | 'discount_pct' | 'dollar_off'
  value: number
  is_active: boolean
}

export interface LoyaltyDashboardData {
  active_members: number
  points_issued_today: number
  rewards_redeemed_today: number
  program_roi: number
  member_growth: Array<{ date: string; count: number }>
  top_members: LoyaltyMember[]
}

interface LoyaltyState {
  dashboard: LoyaltyDashboardData | null
  members: LoyaltyMember[]
  tiers: LoyaltyTier[]
  rewards: LoyaltyReward[]
  activeTab: string
  isLoading: boolean
  selectedMember: LoyaltyMember | null
  checkoutPhone: string
  checkoutMember: LoyaltyMember | null
}

interface LoyaltyActions {
  setDashboard: (data: LoyaltyDashboardData) => void
  setMembers: (members: LoyaltyMember[]) => void
  setTiers: (tiers: LoyaltyTier[]) => void
  setRewards: (rewards: LoyaltyReward[]) => void
  setActiveTab: (tab: string) => void
  setIsLoading: (loading: boolean) => void
  setSelectedMember: (member: LoyaltyMember | null) => void
  setCheckoutPhone: (phone: string) => void
  setCheckoutMember: (member: LoyaltyMember | null) => void
}

export const useLoyaltyStore = create<LoyaltyState & LoyaltyActions>()(
  immer((set) => ({
    dashboard: null,
    members: [],
    tiers: [
      { name: 'Bronze', min_points: 0, earn_multiplier: 1.0, benefits: ['Earn 1 point per dollar'], color: '#CD7F32' },
      { name: 'Silver', min_points: 500, earn_multiplier: 1.5, benefits: ['Earn 1.5x points', 'Birthday reward'], color: '#C0C0C0' },
      { name: 'Gold', min_points: 1500, earn_multiplier: 2.0, benefits: ['Earn 2x points', 'Birthday reward', 'Early access'], color: '#FFD700' },
      { name: 'Platinum', min_points: 5000, earn_multiplier: 3.0, benefits: ['Earn 3x points', 'Birthday reward', 'Early access', 'VIP events'], color: '#E5E4E2' },
    ],
    rewards: [],
    activeTab: 'dashboard',
    isLoading: false,
    selectedMember: null,
    checkoutPhone: '',
    checkoutMember: null,

    setDashboard: (data) => set((state) => { state.dashboard = data }),
    setMembers: (members) => set((state) => { state.members = members }),
    setTiers: (tiers) => set((state) => { state.tiers = tiers }),
    setRewards: (rewards) => set((state) => { state.rewards = rewards }),
    setActiveTab: (tab) => set((state) => { state.activeTab = tab }),
    setIsLoading: (loading) => set((state) => { state.isLoading = loading }),
    setSelectedMember: (member) => set((state) => { state.selectedMember = member }),
    setCheckoutPhone: (phone) => set((state) => { state.checkoutPhone = phone }),
    setCheckoutMember: (member) => set((state) => { state.checkoutMember = member }),
  }))
)
