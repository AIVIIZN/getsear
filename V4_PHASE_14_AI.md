# Sear POS v4 — Phase 14: AI Intelligence Layer

**Build Brief (MASTER_TEMPLATE Part 1)**
**Date:** 2026-03-23
**Priority:** HIGH — competitive differentiator
**Estimated Sessions:** 3-4
**Depends On:** Phase 7 (Reports — real data queries), Phase 4 (Menu — pricing/cost data), Phase 6 (Staff — labor data)

---

## 1.1 What is this?

An AI intelligence layer that gives restaurant owners and managers instant, actionable insights by connecting sales, labor, food cost, and waste data into one brain. Toast launched ToastIQ in 2025 — a natural-language AI assistant that queries sales data and makes recommendations. This is now table stakes for 2026. But ToastIQ only sees transaction data. Sear's advantage is that we own the full stack — POS + inventory + labor + scheduling — so our AI can deliver **holistic profitability intelligence** that Toast cannot.

This phase builds three capabilities:
1. **Sear Ask** — Natural-language conversational interface for querying any business data ("How did we do last Saturday vs this Saturday?", "Who's my best server on Fridays?", "What's my food cost this month?")
2. **Sear Insights** — Proactive AI-generated recommendations pushed to the owner dashboard (menu profitability, labor optimization, waste reduction, sales trends)
3. **Sear Predict** — Demand forecasting for labor scheduling, inventory prep, and revenue projections

The AI layer uses Claude API (Anthropic) as the LLM backbone, with structured tool calls that query Sear's own database. No customer data leaves the system except as anonymized prompts to the LLM.

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, tech stack
- `SCHEMA.md` — all tables (orders, order_items, payments, time_entries, menu_items, inventory_counts, waste_entries)
- `API_SPEC.md` — existing report routes
- `BUSINESS_RULES.md` — operational logic
- `V4_PHASE_07_REPORTS.md` — report queries (AI builds on these)
- `V4_PHASE_06_STAFF.md` — labor data structures


## 1.2 Tech stack

New additions for this phase:
- **LLM:** Claude API via `@anthropic-ai/sdk` (Anthropic TypeScript SDK)
- **Tool Calling:** Claude tool_use for structured database queries
- **Background:** BullMQ for scheduled insight generation (daily at 5 AM)
- **Caching:** Redis for caching frequent queries (TTL: 15 minutes for real-time, 1 hour for trends)
- **Charts:** Recharts (already installed) for inline AI response visualizations


## 1.3 User roles

| Role | AI Access |
|------|-----------|
| **Owner** | Full access — all queries, all insights, all predictions, configure AI settings |
| **General Manager** | Full access for their location — same as owner but location-scoped |
| **Shift Manager** | Limited — can ask about current shift metrics, today's sales, labor for current shift. Cannot see payroll, P&L, or other locations |
| **Server/Bartender** | Minimal — can ask about their own sales and tips for current shift only |
| **Kitchen** | No AI access |


## 1.4 Pages and features

### Feature: Sear Ask — Conversational AI Interface
- **Who:** Owner, GM, Shift Manager (scoped)
- **Where:** Floating "Ask Sear" button (bottom-right corner) on every back-office page + dedicated `/ask` page
- **Layout:** Chat-style interface — user types question, AI responds with text + optional chart/table
- **How it works:**
  1. User types natural-language question
  2. Frontend sends to `/api/ai/ask` endpoint
  3. Backend constructs a Claude API call with system prompt containing the restaurant's schema context and available tools
  4. Claude decides which tools to call (SQL query generators, report functions, etc.)
  5. Tools execute against Supabase, return structured data
  6. Claude formats the response with explanation + data
  7. Frontend renders text + optional Recharts visualization

- **Available Tools (Claude tool_use definitions):**
  - `query_sales` — Sales by date range, by category, by server, by order type, by daypart, comparisons
  - `query_labor` — Hours worked, labor cost, labor %, overtime, by employee, by role, by date range
  - `query_menu_performance` — Item sales count, revenue, food cost %, margin, modifier attach rates
  - `query_food_cost` — Theoretical vs actual, variance by item/category, waste totals
  - `query_speed_of_service` — Ticket times by station, daypart, outliers
  - `query_voids_comps` — Void/comp/discount totals, by employee, by reason, trends
  - `query_customer_data` — Visit frequency, average spend, loyalty status, top customers
  - `query_inventory` — Current stock levels, items below par, waste trends, purchase history
  - `query_tips` — Tip totals, tip %, by server, by daypart, pool distributions
  - `compare_periods` — Compare any metric across two date ranges

- **Example conversations:**
  - "How did we do last Saturday?" → Sales summary with comparison to prior Saturday
  - "Who's my best server on Friday nights?" → Server ranking by sales, tips, speed
  - "What should I 86 from the menu?" → Low-margin, low-volume items with recommendation
  - "Am I overstaffed on Tuesdays?" → Labor % by hour on Tuesdays vs sales, with specific cut recommendations
  - "What's my food cost trending?" → 13-week food cost % trend with variance callouts

- **Conversation history:** Last 10 conversations saved per user for quick re-access
- **Suggested questions:** When empty, show 6 contextual question suggestions based on current page and time of day
- **Response format:** Markdown text + optional inline chart (bar, line, pie) + optional data table

### Feature: Sear Insights — Proactive AI Recommendations
- **Who:** Owner, GM
- **Where:** Dashboard cards on back-office home page (`/backoffice`), daily email digest
- **Schedule:** Generated daily at 5 AM via BullMQ job
- **How it works:**
  1. BullMQ job runs at 5 AM
  2. Queries yesterday's sales, labor, food cost, waste, voids, speed-of-service
  3. Compares to same day last week, same day last year, 13-week rolling average
  4. Sends structured data to Claude API with insight-generation system prompt
  5. Claude generates 3-5 actionable insights with priority levels
  6. Insights stored in `ai_insights` table
  7. Dashboard shows top 3 insights, "View All" links to full list
  8. Optional: included in daily email summary (Phase 8 SendGrid)

- **Insight categories:**
  - **Menu Profitability:** "Your Wagyu Burger has 62% margin and sells 18/day. Your Caesar Salad has 38% margin and sells 22/day. Consider promoting the burger as a featured item."
  - **Labor Optimization:** "You're scheduling 2 extra servers on Tuesday afternoons. Last 8 Tuesdays averaged $1,200 in sales 2-4 PM — 1 server can handle this volume. Savings: ~$120/week."
  - **Waste Reduction:** "Salmon waste spiked 40% this week ($380 in waste). Check: are portions too large? Is the walk-in temp stable? Consider reducing par level from 20 to 15."
  - **Sales Trends:** "Saturday dinner revenue dropped 12% vs 4-week average. Weather was clear, no holidays. Investigate: new competition? Menu fatigue? Service issues?"
  - **Speed Issues:** "Average ticket time on the grill station jumped to 18 min (was 12 min). Check: staffing? Equipment? New menu items causing slowdowns?"
  - **Void/Comp Alerts:** "Server Maria had 8 voids yesterday (avg for servers is 2). Manager review recommended."

- **Insight display:** Card with icon (color-coded by category), title, 2-line summary, "Details" expand, "Dismiss" button, "Helpful?" thumbs up/down for feedback loop

### Feature: Sear Predict — Demand Forecasting
- **Who:** Owner, GM
- **Where:** Integrated into scheduling (Phase 6), inventory (Phase 11), and dashboard
- **How it works:**
  1. Analyzes 13 weeks of historical sales data by: day of week, hour, weather (if API available), local events (manual input), holidays
  2. Generates predictions for: expected covers, expected revenue, expected labor hours needed, expected inventory usage
  3. Predictions feed into: scheduling (suggested staff levels), inventory (suggested prep quantities), dashboard (expected vs actual live comparison)

- **Prediction models (rule-based + LLM-enhanced):**
  - **Sales forecast:** Weighted average of same-day-of-week over 13 weeks, adjusted for trends (growing/declining) and seasonality
  - **Labor forecast:** Predicted sales → covers → required staff hours using configurable covers-per-labor-hour ratio
  - **Inventory forecast:** Predicted sales → menu item quantities → ingredient quantities → prep list

- **Display:**
  - Dashboard: "Today's Forecast: ~$8,200 revenue, ~180 covers" with confidence band
  - Scheduling: "Suggested: 3 servers, 2 line cooks, 1 expo for Saturday dinner based on projected 95 covers"
  - Inventory: "Suggested prep: 25 salmon portions, 40 burger patties, 15 desserts based on forecast"

- **Accuracy tracking:** Compare predictions to actuals daily, display accuracy % on dashboard, use actuals to improve future predictions

### Page: AI Settings (`/settings/ai`)
- **Who:** Owner
- **Features:**
  - Enable/disable Sear Ask, Insights, Predict (toggle switches)
  - API key configuration (Anthropic API key — stored encrypted in Supabase vault or env var)
  - Insight delivery preferences: dashboard only, email digest, both
  - Insight frequency: daily, weekly summary
  - Data privacy notice: "Your business data is sent to Claude AI for analysis. No personally identifiable customer data is included. Queries are not stored by Anthropic."
  - Usage tracking: queries this month, estimated API cost
  - Feedback history: view all thumbs up/down on insights


## 1.5 Look and feel

- **Sear Ask button:** 48px floating circle, ember orange (#F06B18), white chat icon, bottom-right with 24px offset
- **Chat interface:** Clean white background, user messages right-aligned (light gray bubble), AI responses left-aligned (white, full-width), inline charts rendered in-message
- **Insight cards:** White card, subtle warm shadow, left color bar (green=opportunity, amber=warning, red=alert, blue=info), 16px icon, 14px body text
- **Prediction display:** Line chart with confidence band (shaded area), actual vs predicted with clear legend
- **Loading state:** Typing indicator dots (3 dots, animated) while AI generates response
- **Empty state:** "Ask me anything about your restaurant" with 6 suggested question buttons


## 1.6 Business rules

- **Rate limiting:** Max 50 AI queries per user per day (configurable). Prevents runaway API costs.
- **Data scoping:** Every query is scoped to the user's org_id and location_id. A GM at Location A cannot query Location B data.
- **No PII in prompts:** Customer names, emails, phone numbers are NEVER sent to Claude API. Use anonymized IDs only. Employee names can be included (they are internal staff).
- **Caching:** Identical queries within 15 minutes return cached response. Trend/forecast queries cached for 1 hour.
- **Cost control:** Track token usage per query. Display estimated monthly cost in settings. Alert owner if projected cost exceeds configurable threshold (default $50/month).
- **Insight deduplication:** Don't generate the same insight two days in a row. Mark as "seen" when dismissed.
- **Prediction minimum data:** Require at least 4 weeks of sales data before enabling predictions. Show "Not enough data yet — predictions will be available after [date]" message.
- **Fallback:** If Claude API is unavailable, Sear Ask shows "AI assistant is temporarily unavailable. Try again in a few minutes." Insights and predictions skip that day and retry next cycle.


## 1.7 Integrations

- **Claude API (Anthropic):** Primary LLM for natural language understanding, insight generation, and prediction enhancement
- **Supabase:** All data queries run against Supabase PostgreSQL via existing typed client
- **BullMQ + Redis:** Scheduled insight generation (5 AM daily), prediction updates (4 AM daily)
- **SendGrid:** Insight email digest (if enabled, piggybacks on Phase 8 email infrastructure)
- **Phase 7 Reports:** AI queries reuse the same SQL patterns built for reports
- **Phase 6 Staff:** Labor data queries for scheduling recommendations
- **Phase 11 Inventory:** Food cost and waste data for profitability insights


## 1.8 Modules planned but not for this phase

- Voice interface ("Hey Sear, how are we doing today?") — future
- AI-powered menu pricing optimization (automatically suggest price changes) — future
- AI-generated marketing copy and campaigns — future
- Predictive customer churn (loyalty members at risk) — future
- Multi-location comparative intelligence — future (Phase 11 Franchise module first)


## 1.9 Files to create or modify

### New Files
| File | Purpose |
|------|---------|
| `src/app/api/ai/ask/route.ts` | Sear Ask endpoint — receives question, calls Claude, returns response |
| `src/app/api/ai/insights/route.ts` | GET insights for dashboard, POST dismiss/feedback |
| `src/app/api/ai/insights/generate/route.ts` | Trigger manual insight generation (admin only) |
| `src/app/api/ai/predict/route.ts` | GET predictions for date range |
| `src/app/api/ai/predict/accuracy/route.ts` | GET prediction accuracy metrics |
| `src/app/api/ai/settings/route.ts` | GET/PUT AI configuration |
| `src/app/api/ai/usage/route.ts` | GET token usage and cost tracking |
| `src/app/(backoffice)/ask/page.tsx` | Full-page Sear Ask chat interface |
| `src/app/(backoffice)/settings/ai/page.tsx` | AI settings configuration page |
| `src/components/ai/SearAskButton.tsx` | Floating "Ask Sear" button (bottom-right) |
| `src/components/ai/SearAskChat.tsx` | Chat interface component (used in floating panel + full page) |
| `src/components/ai/ChatMessage.tsx` | Individual message bubble (user or AI) |
| `src/components/ai/ChatSuggestions.tsx` | Suggested question buttons |
| `src/components/ai/InlineChart.tsx` | Renders Recharts visualization within a chat message |
| `src/components/ai/InlineTable.tsx` | Renders data table within a chat message |
| `src/components/ai/InsightCard.tsx` | Dashboard insight card with color bar, icon, dismiss, feedback |
| `src/components/ai/InsightsList.tsx` | List of insight cards for dashboard |
| `src/components/ai/PredictionChart.tsx` | Forecast vs actual line chart with confidence band |
| `src/components/ai/PredictionSummary.tsx` | Today's forecast KPI cards |
| `src/components/ai/AIUsageMeter.tsx` | Token usage and cost display for settings |
| `src/lib/ai/claude-client.ts` | Anthropic SDK client wrapper with error handling, retry, cost tracking |
| `src/lib/ai/system-prompts.ts` | System prompts for Ask, Insights, Predict contexts |
| `src/lib/ai/tools.ts` | Claude tool_use definitions (query_sales, query_labor, etc.) |
| `src/lib/ai/tool-handlers.ts` | Tool execution handlers — each tool maps to a Supabase query |
| `src/lib/ai/query-builders.ts` | Parameterized SQL query builders for each data domain |
| `src/lib/ai/insight-generator.ts` | Daily insight generation logic — queries data, sends to Claude, stores results |
| `src/lib/ai/prediction-engine.ts` | Demand forecasting — weighted historical analysis + LLM enhancement |
| `src/lib/ai/cost-tracker.ts` | Token usage tracking and cost estimation |
| `src/lib/ai/cache.ts` | Redis caching layer for AI responses |
| `src/stores/ai-store.ts` | Zustand store for AI chat state, insights, predictions |
| `src/workers/ai-insights.worker.ts` | BullMQ worker for scheduled insight generation |
| `src/workers/ai-predictions.worker.ts` | BullMQ worker for scheduled prediction updates |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(backoffice)/backoffice/page.tsx` | Add InsightsList component to dashboard |
| `src/app/(backoffice)/layout.tsx` | Add SearAskButton floating component |
| `src/app/(backoffice)/settings/page.tsx` | Add AI settings card to settings hub |
| `src/app/(backoffice)/scheduling/page.tsx` | Add PredictionSummary for suggested staff levels |
| `src/workers/index.ts` | Register AI insight and prediction workers |
| `package.json` | Add `@anthropic-ai/sdk` dependency |

### Database Migrations
| Migration | Changes |
|-----------|---------|
| `add_ai_conversations` | Create `ai_conversations` table (id, user_id, org_id, messages jsonb, created_at, updated_at) |
| `add_ai_insights` | Create `ai_insights` table (id, org_id, location_id, category, title, body, priority, is_dismissed, feedback, generated_at) |
| `add_ai_predictions` | Create `ai_predictions` table (id, org_id, location_id, prediction_date, predicted_revenue, predicted_covers, predicted_labor_hours, actual_revenue, actual_covers, confidence, created_at) |
| `add_ai_usage` | Create `ai_usage` table (id, org_id, user_id, tokens_in, tokens_out, estimated_cost, query_type, created_at) |


## Acceptance Criteria

### Sear Ask
- [ ] User types "How did we do last Saturday?" → AI responds with sales total, comparison to prior Saturday, cover count, average check — with bar chart
- [ ] User types "Who's my best server on Friday nights?" → AI responds with ranked server list by revenue for Friday dinner shifts — with table
- [ ] User types "What should I 86 from the menu?" → AI responds with low-margin, low-volume items with specific recommendations
- [ ] User types "Am I overstaffed on Tuesdays?" → AI responds with labor % by hour for Tuesdays, identifies overstaffed windows, estimates savings
- [ ] GM at Location A asks about Location B data → response is empty/denied ("I only have data for [Location A]")
- [ ] 50 queries in a day → 51st query returns rate limit message
- [ ] Claude API is down → graceful error: "AI assistant is temporarily unavailable"
- [ ] Same question asked twice within 15 minutes → second response is instant (cached)
- [ ] Suggested questions appear when chat is empty, change based on time of day and current page

### Sear Insights
- [ ] Dashboard shows 3 insight cards after 5 AM job runs
- [ ] Each insight has: colored category bar, icon, title, 2-line summary, expandable details, dismiss button, helpful thumbs
- [ ] Tapping "Dismiss" removes the insight from dashboard (persists — doesn't reappear)
- [ ] Thumbs up/down saves feedback to `ai_insights.feedback` column
- [ ] Same insight does not appear two days in a row
- [ ] Insights include at least one from each category when data supports it: menu, labor, waste, sales, speed

### Sear Predict
- [ ] Dashboard shows "Today's Forecast" with predicted revenue and covers
- [ ] Scheduling page shows suggested staff levels based on predicted covers
- [ ] After 4 weeks of data, predictions activate. Before that: "Need more data" message
- [ ] Prediction accuracy % displayed — compare predicted vs actual for completed days
- [ ] Forecast chart shows predicted line + actual line + confidence band (shaded)

### Settings & Privacy
- [ ] AI features can be toggled on/off individually in settings
- [ ] API key is stored securely (encrypted or env var, never exposed in client)
- [ ] No customer PII (name, email, phone) appears in Claude API request logs
- [ ] Token usage and estimated monthly cost displayed in settings
- [ ] Cost alert triggers when projected monthly spend exceeds threshold


## Workflow Tests

### Workflow 1: Owner Morning Check-In
1. Owner opens Sear back-office dashboard at 8 AM
2. Sees 3 AI insight cards: "Tuesday labor is 4% over target — cut 1 server 2-4 PM", "Wagyu Burger margin up 8% after price increase — maintain", "Salmon waste trending up — investigate walk-in temp"
3. Taps "Details" on labor insight → sees hour-by-hour labor chart for Tuesdays
4. Dismisses salmon insight (already handled)
5. Taps "Ask Sear" floating button
6. Types "Give me yesterday's numbers"
7. AI responds: revenue, covers, average check, labor %, food cost %, comparison to same day last week — with summary chart
8. Types "Break that down by daypart"
9. AI responds with lunch vs dinner split — revenue, covers, avg check for each

### Workflow 2: Manager Scheduling with Predictions
1. Manager opens scheduling page for next Saturday
2. Sees "Sear Predict" banner: "Forecast: 210 covers, $12,400 revenue. Suggested: 5 servers, 3 line cooks, 1 expo, 1 dishwasher"
3. Manager adjusts schedule to match suggestion
4. After Saturday, prediction accuracy page shows: predicted 210 covers, actual 195 covers (93% accuracy)

### Workflow 3: Menu Profitability Deep Dive
1. Owner opens Sear Ask, types "Show me my top 10 items by profit margin"
2. AI returns table: item name, units sold (30 days), revenue, food cost, margin %, ranked by margin
3. Owner types "Now show me the bottom 10"
4. AI returns low-margin items with recommendations: "Consider raising price on Caesar Salad ($12 → $14) or reducing portion size. Current margin: 28% vs target 35%."
5. Owner types "What if I raise Caesar to $14?"
6. AI estimates impact: "At current volume (22/day), that's +$44/day, +$1,320/month in revenue. Price elasticity risk: moderate — salads are price-sensitive."
