/**
 * Integrations Zustand Store
 *
 * Client-side state for integration connection statuses and configuration.
 */

import { create } from 'zustand'

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'loading'

export interface IntegrationState {
  provider: string
  status: ConnectionStatus
  errorMessage?: string
  lastChecked?: string
}

interface IntegrationsStore {
  integrations: Record<string, IntegrationState>
  setStatus: (provider: string, status: ConnectionStatus, errorMessage?: string) => void
  setLoading: (provider: string) => void

  // SMS
  smsConfig: {
    accountSid: string
    authToken: string
    phoneNumber: string
    testPhone: string
    notifications: {
      order_ready: boolean
      reservation_reminder: boolean
      waitlist_alert: boolean
      marketing: boolean
    }
  } | null
  setSmsConfig: (config: IntegrationsStore['smsConfig']) => void

  // Email
  emailConfig: {
    apiKey: string
    senderEmail: string
    senderName: string
    replyTo: string
    notifications: {
      receipts: boolean
      daily_reports: boolean
      marketing: boolean
      password_reset: boolean
    }
  } | null
  setEmailConfig: (config: IntegrationsStore['emailConfig']) => void

  // QuickBooks
  qboConnection: {
    companyName: string
    connectedAt: string
    lastSyncAt: string | null
    isSandbox: boolean
    syncFrequency: 'daily' | 'manual'
  } | null
  setQboConnection: (conn: IntegrationsStore['qboConnection']) => void

  // Templates
  smsTemplates: Array<{
    id: string
    template_type: string
    name: string
    body: string
    is_active: boolean
  }>
  setSmsTemplates: (templates: IntegrationsStore['smsTemplates']) => void

  emailTemplates: Array<{
    id: string
    template_type: string
    name: string
    subject: string
    html_body: string
    is_active: boolean
  }>
  setEmailTemplates: (templates: IntegrationsStore['emailTemplates']) => void
}

export const useIntegrationsStore = create<IntegrationsStore>((set) => ({
  integrations: {},

  setStatus: (provider, status, errorMessage) =>
    set((state) => ({
      integrations: {
        ...state.integrations,
        [provider]: {
          provider,
          status,
          errorMessage,
          lastChecked: new Date().toISOString(),
        },
      },
    })),

  setLoading: (provider) =>
    set((state) => ({
      integrations: {
        ...state.integrations,
        [provider]: {
          provider,
          status: 'loading',
          lastChecked: new Date().toISOString(),
        },
      },
    })),

  smsConfig: null,
  setSmsConfig: (config) => set({ smsConfig: config }),

  emailConfig: null,
  setEmailConfig: (config) => set({ emailConfig: config }),

  qboConnection: null,
  setQboConnection: (conn) => set({ qboConnection: conn }),

  smsTemplates: [],
  setSmsTemplates: (templates) => set({ smsTemplates: templates }),

  emailTemplates: [],
  setEmailTemplates: (templates) => set({ emailTemplates: templates }),
}))
