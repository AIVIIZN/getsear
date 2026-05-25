export const CRM_FOUNDATION_VERSION = 'CRM-V0' as const

export const crmCanonicalEntities = [
  'guest',
  'guest_contact_point',
  'guest_identifier',
  'visit',
  'guest_lifecycle_stage',
  'crm_segment',
  'crm_campaign',
  'crm_automation',
  'crm_metric',
  'crm_dashboard',
  'crm_recovery_case',
] as const

export type CrmCanonicalEntity = (typeof crmCanonicalEntities)[number]

export const crmRouteContract = {
  nativeNamespace: '/api/crm',
  compatibilityNamespaces: ['/api/customers', '/api/loyalty', '/api/marketing'] as const,
  rule: 'New CRM-native routes use /api/crm/*; legacy customer, loyalty, and marketing routes remain compatibility surfaces until migrated.',
} as const

export const crmEventNames = [
  'crm.guest.created',
  'crm.guest.merged',
  'crm.consent.updated',
  'crm.segment.materialized',
  'crm.campaign.sent',
  'crm.recovery.opened',
] as const

export type CrmEventName = (typeof crmEventNames)[number]

export const crmRoleVisibilityMatrix = {
  owner: {
    surfaces: ['guest_360', 'analytics', 'segments', 'campaigns', 'automations', 'reports', 'privacy', 'ai_actions'] as const,
    mayViewOwnerAnalytics: true,
    mayViewSensitiveNotes: true,
    mayManageConsent: true,
    mayExportGuestData: true,
  },
  admin: {
    surfaces: ['guest_360', 'analytics', 'segments', 'campaigns', 'automations', 'reports', 'privacy', 'ai_actions'] as const,
    mayViewOwnerAnalytics: true,
    mayViewSensitiveNotes: true,
    mayManageConsent: true,
    mayExportGuestData: true,
  },
  gm: {
    surfaces: ['guest_360', 'service_alerts', 'segments', 'campaigns', 'recovery', 'ai_actions'] as const,
    mayViewOwnerAnalytics: false,
    mayViewSensitiveNotes: true,
    mayManageConsent: true,
    mayExportGuestData: false,
  },
  staff: {
    surfaces: ['pos_guest_memory', 'hospitality_warnings', 'visit_context'] as const,
    mayViewOwnerAnalytics: false,
    mayViewSensitiveNotes: false,
    mayManageConsent: false,
    mayExportGuestData: false,
  },
  marketing: {
    surfaces: ['guest_360_limited', 'segments', 'campaigns', 'templates', 'reachability'] as const,
    mayViewOwnerAnalytics: false,
    mayViewSensitiveNotes: false,
    mayManageConsent: true,
    mayExportGuestData: false,
  },
  analyst: {
    surfaces: ['crm_metrics', 'crm_dashboards', 'report_builder', 'segment_performance'] as const,
    mayViewOwnerAnalytics: true,
    mayViewSensitiveNotes: false,
    mayManageConsent: false,
    mayExportGuestData: false,
  },
} as const

export type CrmVisibilityRole = keyof typeof crmRoleVisibilityMatrix

export const crmExistingSurfaceMap = {
  customers: {
    status: 'compatibility_surface',
    routes: [
      'src/app/api/customers/route.ts',
      'src/app/api/customers/[id]/route.ts',
      'src/app/api/customers/[id]/loyalty/route.ts',
      'src/app/api/customers/[id]/orders/route.ts',
      'src/app/api/customers/lookup/route.ts',
      'src/app/api/customers/merge/route.ts',
    ] as const,
    ui: ['src/app/(backoffice)/customers/page.tsx'] as const,
    schemas: ['src/lib/schemas/customers.ts'] as const,
    existingTables: ['customers', 'customer_addresses', 'customer_payment_methods'] as const,
    reuseGuidance: 'Reuse auth, org scoping, duplicate lookup, order history, and merge behavior; do not add new CRM profile state back onto customers.',
  },
  loyalty: {
    status: 'compatibility_surface',
    routes: [
      'src/app/api/loyalty/accounts/route.ts',
      'src/app/api/loyalty/accounts/[id]/route.ts',
      'src/app/api/loyalty/accounts/[id]/adjust/route.ts',
      'src/app/api/loyalty/accounts/[id]/earn/route.ts',
      'src/app/api/loyalty/accounts/[id]/redeem/route.ts',
      'src/app/api/loyalty/accounts/[id]/transactions/route.ts',
      'src/app/api/loyalty/dashboard/route.ts',
      'src/app/api/loyalty/enroll/route.ts',
      'src/app/api/loyalty/lookup/route.ts',
      'src/app/api/loyalty/programs/route.ts',
      'src/app/api/loyalty/programs/[id]/route.ts',
    ] as const,
    ui: ['src/app/(backoffice)/loyalty/page.tsx', 'src/components/loyalty'] as const,
    schemas: ['src/lib/schemas/loyalty.ts'] as const,
    existingTables: ['loyalty_accounts', 'loyalty_programs', 'loyalty_transactions'] as const,
    reuseGuidance: 'Reuse ledger and enrollment behavior; future rewards and fraud controls should reference guest_id through CRM joins instead of duplicating loyalty members.',
  },
  marketing: {
    status: 'compatibility_surface',
    routes: [
      'src/app/api/marketing/analytics/route.ts',
      'src/app/api/marketing/campaigns/route.ts',
      'src/app/api/marketing/campaigns/[id]/route.ts',
      'src/app/api/marketing/campaigns/[id]/send/route.ts',
      'src/app/api/marketing/segments/route.ts',
      'src/app/api/marketing/segments/count/route.ts',
      'src/app/api/marketing/templates/route.ts',
      'src/app/api/marketing/track/click/route.ts',
      'src/app/api/marketing/track/open/route.ts',
      'src/app/api/marketing/unsubscribe/route.ts',
    ] as const,
    ui: ['src/app/(backoffice)/marketing/page.tsx'] as const,
    schemas: ['src/lib/schemas/marketing.ts'] as const,
    workers: ['src/workers/campaign-email-worker.ts'] as const,
    existingTables: ['campaigns', 'campaign_recipients'] as const,
    reuseGuidance: 'Reuse Resend webhook, tracking, status constraints, and campaign worker; CRM campaigns must add consent/suppression gates before any send expansion.',
  },
  reservations: {
    status: 'guest_signal_source',
    routes: [
      'src/app/api/reservations/route.ts',
      'src/app/api/reservations/[id]/route.ts',
      'src/app/api/reservations/[id]/confirm/route.ts',
      'src/app/api/reservations/[id]/seat/route.ts',
      'src/app/api/reservations/availability/route.ts',
      'src/app/api/reservations/waitlist/route.ts',
      'src/app/api/reservations/waitlist/[id]/route.ts',
    ] as const,
    schemas: ['src/lib/schemas/reservations.ts'] as const,
    existingTables: ['reservations'] as const,
    reuseGuidance: 'Treat reservation guest_name/guest_phone/guest_email as identity signals; do not fork reservation workflows into CRM-only copies.',
  },
  reports: {
    status: 'analytics_source',
    routes: ['src/app/api/reports/**'] as const,
    ui: ['src/app/(backoffice)/reports/**', 'src/components/reports'] as const,
    services: ['src/lib/reports/queries.ts', 'src/lib/reports/aggregation.ts'] as const,
    reuseGuidance: 'CRM metrics and dashboards should use report query patterns and owner/admin role gates; staff-facing CRM surfaces must not expose owner analytics.',
  },
  ai: {
    status: 'existing_ai_platform',
    workers: ['src/workers/ai-insights.worker.ts', 'src/workers/ai-predictions.worker.ts'] as const,
    existingTables: ['ai_conversations', 'ai_insights', 'ai_predictions', 'ai_settings', 'ai_usage'] as const,
    reuseGuidance: 'GuestBrain must use Gemini or OpenAI providers already present in package dependencies; no Anthropic/Claude provider should be added for CRM AI.',
  },
  audit: {
    status: 'shared_control_plane',
    service: ['src/lib/audit/log.ts'] as const,
    existingTables: ['audit_log'] as const,
    reuseGuidance: 'CRM writes affecting guests, consent, privacy, campaigns, merge decisions, or recovery cases must append audit records through the shared audit helper or its extended vocabulary.',
  },
} as const

export const crmSchemaPlan = {
  existingTables: [
    'customers',
    'customer_addresses',
    'customer_payment_methods',
    'loyalty_accounts',
    'loyalty_programs',
    'loyalty_transactions',
    'campaigns',
    'campaign_recipients',
    'reservations',
    'audit_log',
    'ai_conversations',
    'ai_insights',
    'ai_predictions',
    'ai_settings',
    'ai_usage',
  ] as const,
  crmV1NewTables: [
    'guests',
    'guest_contact_points',
    'guest_identifiers',
    'guest_notes',
    'guest_preferences',
    'guest_allergies',
    'guest_tags',
    'crm_tags',
    'guest_timeline_events',
  ] as const,
  laterNewTables: [
    'guest_merge_candidates',
    'guest_merge_decisions',
    'guest_households',
    'guest_relationships',
    'guest_consents',
    'consent_policy_versions',
    'suppression_entries',
    'privacy_requests',
    'data_export_jobs',
    'data_deletion_jobs',
    'data_access_logs',
    'crm_segments',
    'crm_campaigns',
    'crm_automations',
    'crm_metrics',
    'crm_dashboards',
    'crm_recovery_cases',
  ] as const,
} as const

export const crmDesignContract = {
  guest360: {
    surfaceType: 'owner-analysis',
    scanPath: ['identity', 'hospitality_warnings', 'next_best_action', 'timeline'] as const,
    layout: 'Three-column split pane: searchable guest rail, dense profile/timeline center, contextual action rail that hides when no backed action data exists.',
    densityRule: 'Owner/admin views may show metrics, spend, frequency, and attribution; staff mode replaces analytics with hospitality facts only.',
  },
  posGuestMemoryCard: {
    surfaceType: 'service-speed',
    scanPath: ['name', 'warnings', 'preferences', 'loyalty_or_visit_hint'] as const,
    layout: 'Compact inline card sized for checkout/order flow with no owner-only analytics, no campaign metrics, and 44px minimum actions.',
    densityRule: 'Show only facts useful during service with no owner-only analytics: allergies, VIP flags, last visit note, consent-safe contact hints, and loyalty prompt state.',
  },
  setupReviewSplitPane: {
    surfaceType: 'setup-review',
    scanPath: ['source', 'mapping_or_rules', 'preview', 'issues'] as const,
    layout: 'Left configuration rail, center preview table/canvas, right issue queue with fix-forward actions.',
    densityRule: 'Use for imports, segment builder, campaign review, automation review, and report builder so risky sends/exports always have a preview before commit.',
  },
  crmHealthIssueQueue: {
    surfaceType: 'setup-review',
    scanPath: ['severity', 'affected_guests', 'blocked_workflow', 'recommended_fix'] as const,
    layout: 'Operational queue grouped by severity with owner/admin remediation actions and staff-invisible analytics.',
    densityRule: 'Every health issue must cite the blocked CRM workflow and the exact remediation target.',
  },
  aiActionCard: {
    surfaceType: 'owner-analysis',
    scanPath: ['recommendation', 'evidence', 'risk_or_consent', 'commit_action'] as const,
    layout: 'Evidence-first card with a single explicit action, consent warning area, and audit-friendly confirmation state.',
    densityRule: 'Never render an AI action unless backed by persisted recommendation data and permission/consent checks.',
  },
} as const

export const crmDoNotDuplicateMap = [
  {
    concern: 'Auth and tenant scope',
    reuse: ['src/lib/api/auth.ts', 'createAdminClient plus explicit .eq("org_id", user.org_id) filters'] as const,
  },
  {
    concern: 'Audit trail',
    reuse: ['src/lib/audit/log.ts', 'public.audit_log'] as const,
  },
  {
    concern: 'Customer compatibility',
    reuse: ['src/app/api/customers/**', 'customers', 'customer_addresses', 'customer_payment_methods'] as const,
  },
  {
    concern: 'Loyalty ledger',
    reuse: ['src/app/api/loyalty/**', 'loyalty_accounts', 'loyalty_programs', 'loyalty_transactions'] as const,
  },
  {
    concern: 'Campaign delivery and tracking',
    reuse: ['src/app/api/marketing/**', 'src/workers/campaign-email-worker.ts', 'campaigns', 'campaign_recipients'] as const,
  },
  {
    concern: 'Reservations as identity signals',
    reuse: ['src/app/api/reservations/**', 'reservations.customer_id and guest contact fields'] as const,
  },
  {
    concern: 'Owner reports',
    reuse: ['src/lib/reports/**', 'src/app/api/reports/**', 'src/components/reports'] as const,
  },
  {
    concern: 'UI primitives',
    reuse: ['src/components/ui-v2/**', 'src/components/shared/EmptyState.tsx', 'src/components/shared/LoadingSkeleton.tsx'] as const,
  },
] as const
