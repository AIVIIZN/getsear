export const ONBOARDING_STORAGE_KEY = 'sear_v8_onboarding_progress'

export const ONBOARDING_STEPS = [
  { id: 'org', label: 'Organization', description: 'Restaurant identity and ownership' },
  { id: 'location', label: 'Location', description: 'Address, timezone, and dining areas' },
  { id: 'menu', label: 'Menu seed', description: 'Pick and tune a launch menu' },
  { id: 'terminals', label: 'Terminals', description: 'Register first service stations' },
  { id: 'first-user', label: 'First user', description: 'Confirm owner access' },
  { id: 'tour', label: 'Tour', description: 'Ring the first order with guidance' },
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id']

export interface OnboardingOrg {
  name: string
  owner_name: string
  owner_email: string
  owner_phone: string
}

export interface OnboardingLocation {
  name: string
  address_line1: string
  city: string
  state: string
  zip: string
  timezone: string
  sections: string[]
}

export interface OnboardingMenuItem {
  name: string
  category: string
  description: string
  price_cents: number
  modifiers: Array<{ name: string; price_cents: number }>
}

export interface OnboardingTerminal {
  name: string
  terminal_type: 'server_station' | 'bar' | 'host' | 'cashier' | 'kds'
  default_view: 'pos' | 'kds'
}

export interface OnboardingProgress {
  current_step: number
  completed_steps: number[]
  data: {
    org?: Partial<OnboardingOrg>
    location?: Partial<OnboardingLocation>
    menu_template_id?: string
    menu_items?: OnboardingMenuItem[]
    terminals?: OnboardingTerminal[]
    first_user_confirmed?: boolean
    tour_completed?: boolean
    tour_replay_enabled?: boolean
  }
}

export const DEFAULT_ONBOARDING_PROGRESS: OnboardingProgress = {
  current_step: 0,
  completed_steps: [],
  data: {
    terminals: [
      { name: 'Front POS', terminal_type: 'server_station', default_view: 'pos' },
      { name: 'Kitchen Display', terminal_type: 'kds', default_view: 'kds' },
    ],
  },
}

export function markStepComplete(
  progress: OnboardingProgress,
  stepIndex: number,
  data: Partial<OnboardingProgress['data']> = {},
): OnboardingProgress {
  const completed = progress.completed_steps.includes(stepIndex)
    ? progress.completed_steps
    : [...progress.completed_steps, stepIndex].sort((a, b) => a - b)

  return {
    current_step: Math.min(stepIndex + 1, ONBOARDING_STEPS.length - 1),
    completed_steps: completed,
    data: { ...progress.data, ...data },
  }
}

export function getOnboardingPercent(progress: OnboardingProgress): number {
  return Math.round((progress.completed_steps.length / ONBOARDING_STEPS.length) * 100)
}

export function normalizePriceCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export function buildOnboardingSummary(progress: OnboardingProgress) {
  const menuItems = progress.data.menu_items ?? []
  const categories = new Set(menuItems.map((item) => item.category))

  return {
    percent: getOnboardingPercent(progress),
    menu_items: menuItems.length,
    menu_categories: categories.size,
    terminals: progress.data.terminals?.length ?? 0,
    sections: progress.data.location?.sections?.length ?? 0,
  }
}
