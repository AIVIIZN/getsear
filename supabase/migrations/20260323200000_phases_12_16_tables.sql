-- Phase 12-16 Migration: New tables for AI, Demo Requests, Setup Progress
-- Run against Supabase project: lbekiyxqemxozmghgmtp

-- ============================================================
-- Phase 14: AI Intelligence Layer
-- ============================================================

-- AI Settings (per-org configuration)
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ask_enabled boolean NOT NULL DEFAULT true,
  insights_enabled boolean NOT NULL DEFAULT true,
  predict_enabled boolean NOT NULL DEFAULT true,
  insight_delivery text NOT NULL DEFAULT 'dashboard' CHECK (insight_delivery IN ('dashboard', 'email', 'both')),
  insight_frequency text NOT NULL DEFAULT 'daily' CHECK (insight_frequency IN ('daily', 'weekly')),
  daily_query_limit integer NOT NULL DEFAULT 50,
  monthly_cost_alert_cents integer NOT NULL DEFAULT 5000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

-- AI Insights (proactive recommendations)
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('menu', 'labor', 'waste', 'sales', 'speed', 'voids', 'general')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  summary text NOT NULL,
  details text DEFAULT '',
  metric_value text DEFAULT '',
  comparison_text text DEFAULT '',
  is_dismissed boolean NOT NULL DEFAULT false,
  feedback text CHECK (feedback IN ('helpful', 'not_helpful')),
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_insights_org_location ON ai_insights (org_id, location_id, is_dismissed, generated_at DESC);
CREATE INDEX idx_ai_insights_dedup ON ai_insights (org_id, location_id, category, title, generated_at DESC);

-- AI Usage (token tracking and cost)
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  estimated_cost numeric(10,4) NOT NULL DEFAULT 0,
  query_type text NOT NULL DEFAULT 'ask' CHECK (query_type IN ('ask', 'insights', 'predict', 'menu_photo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_org_date ON ai_usage (org_id, created_at DESC);
CREATE INDEX idx_ai_usage_user_date ON ai_usage (org_id, user_id, created_at DESC);

-- AI Predictions (demand forecasting)
CREATE TABLE IF NOT EXISTS ai_predictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  prediction_date date NOT NULL,
  predicted_revenue integer,          -- cents
  predicted_covers integer,
  predicted_labor_hours numeric(6,1),
  actual_revenue integer,             -- cents, filled after day completes
  actual_covers integer,              -- filled after day completes
  confidence numeric(4,3) DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, location_id, prediction_date)
);

CREATE INDEX idx_ai_predictions_lookup ON ai_predictions (org_id, location_id, prediction_date);
CREATE INDEX idx_ai_predictions_accuracy ON ai_predictions (org_id, location_id, prediction_date) WHERE actual_revenue IS NOT NULL;

-- AI Conversations (for future use — conversation history persistence)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text DEFAULT 'New conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations (org_id, user_id, updated_at DESC);

-- ============================================================
-- Phase 15: Public Website & Pricing
-- ============================================================

-- Demo Requests (lead capture from marketing site)
CREATE TABLE IF NOT EXISTS demo_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  locations_count integer DEFAULT 1,
  current_pos text,
  source_page text,
  utm_params jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_requests_email ON demo_requests (email);
CREATE INDEX idx_demo_requests_date ON demo_requests (created_at DESC);

-- ============================================================
-- Phase 16: Self-Service Onboarding
-- ============================================================

-- Setup Wizard Progress (per-org, persists wizard state)
CREATE TABLE IF NOT EXISTS setup_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_progress ENABLE ROW LEVEL SECURITY;
-- demo_requests is public insert, admin-only read
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

-- AI Settings: org members can read/write their own org's settings
CREATE POLICY ai_settings_org_access ON ai_settings
  FOR ALL USING (org_id IN (
    SELECT org_id FROM user_locations WHERE user_id = auth.uid()
  ));

-- AI Insights: org members can read/update their own org's insights
CREATE POLICY ai_insights_org_access ON ai_insights
  FOR ALL USING (org_id IN (
    SELECT org_id FROM user_locations WHERE user_id = auth.uid()
  ));

-- AI Usage: org members can read their own org's usage
CREATE POLICY ai_usage_org_read ON ai_usage
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM user_locations WHERE user_id = auth.uid()
  ));

-- AI Usage: service role can insert (from API routes)
CREATE POLICY ai_usage_insert ON ai_usage
  FOR INSERT WITH CHECK (true);

-- AI Predictions: org members can read their own org's predictions
CREATE POLICY ai_predictions_org_access ON ai_predictions
  FOR ALL USING (org_id IN (
    SELECT org_id FROM user_locations WHERE user_id = auth.uid()
  ));

-- AI Conversations: users can access their own conversations
CREATE POLICY ai_conversations_user_access ON ai_conversations
  FOR ALL USING (user_id = auth.uid());

-- Demo Requests: anyone can insert (public form), no read access via RLS
CREATE POLICY demo_requests_public_insert ON demo_requests
  FOR INSERT WITH CHECK (true);

-- Setup Progress: org members can access their own org's progress
CREATE POLICY setup_progress_org_access ON setup_progress
  FOR ALL USING (org_id IN (
    SELECT org_id FROM user_locations WHERE user_id = auth.uid()
  ));
