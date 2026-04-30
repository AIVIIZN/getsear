# V10 — AI Moat (Where Toast Cannot Follow)

## Theme
Five AI features that cannot be retrofitted into Toast within a year. Each is concrete, measurable, and saves a real restaurant ≥1 hour per week or ≥1% revenue.

## Exit criteria
- ✅ All 5 main AI features in production, tier-gated to pro+.
- ✅ Each has a measured proof point from at least one paying customer.
- ✅ AI cost per restaurant per month < $20 (margin-positive at $199/mo pro tier).
- ✅ Zero AI hallucinations affecting customer-visible output (every AI write goes through deterministic validation before persisting).

## Batch 10.0 — Foundation (sequential, ~5 hours)

### 10.0.1 — LLM gateway
**Files:** `src/lib/ai/gateway.ts`, `src/lib/ai/cost-tracker.ts`
**Acceptance:** Tenant-aware Anthropic client with per-org cost tracking; soft cap $20/session, hard cap $50.
**Needs:** ANTHROPIC_API_KEY.

### 10.0.2 — Prompt cache + canonical context
**Files:** `src/lib/ai/context.ts`
**Acceptance:** Prompt caching hit rate >70%.

### 10.0.3 — Tier gate
**Files:** `src/lib/billing/features.ts` extension
**Acceptance:** All AI features locked to pro+.

## Batch 10.1 — AI Menu Engineering (parallel, ~10 hours)

### 10.1.1 — Weekly aggregation pipeline
**Files:** `src/lib/ai/menu-engineering/aggregate.ts`, BullMQ scheduled
**Acceptance:** Weekly snapshot per item lands in `menu_engineering_snapshots`.

### 10.1.2 — LLM analyzer
**Files:** `src/lib/ai/menu-engineering/analyzer.ts`, prompt template
**Acceptance:** Output is structured JSON; passes deterministic validator (recs reference real items, deltas within sane bounds).

### 10.1.3 — Owner UI
**Files:** `src/app/(backoffice)/menu/ai-recommendations/page.tsx`, weekly digest email
**Acceptance:** Monday 9am email with 5 recs; one-click apply or modify.

### 10.1.4 — Audit + rollback
**Files:** `src/lib/ai/menu-engineering/apply.ts`
**Acceptance:** Every applied rec reversible for 7 days via undo.

## Batch 10.2 — Voice Drive-Thru (parallel, ~12 hours)

### 10.2.1 — Whisper streaming STT
**Files:** `src/lib/ai/voice/stt.ts`, `src/app/api/voice/transcribe/route.ts`
**Acceptance:** Live mic stream → text with <500ms latency.
**Needs:** OPENAI_API_KEY.

### 10.2.2 — Order parser
**Files:** `src/lib/ai/voice/parse-order.ts`
**Acceptance:** "Two cheeseburgers no pickle one with bacon and a large fries" → 3 line items, correctly modified, all valid menu IDs.

### 10.2.3 — TTS confirmation
**Files:** `src/lib/ai/voice/tts.ts`, `src/app/api/voice/speak/route.ts`
**Acceptance:** Confirmation plays in <2s via ElevenLabs or AWS Polly.

### 10.2.4 — Lane orchestrator
**Files:** `src/lib/ai/voice/orchestrator.ts`, `src/app/(fullscreen)/voice-lane/page.tsx`
**Acceptance:** Full lane cycle on demo hardware; failover to human box on confidence < threshold.

## Batch 10.3 — Predictive Scheduling (parallel, ~8 hours)

### 10.3.1 — Feature ingest
**Files:** `src/lib/ai/scheduling/features.ts`, scheduled jobs
**Acceptance:** Daily snapshot of weather + events + historical sales per location.
**Needs:** OPENWEATHER_API_KEY.

### 10.3.2 — Demand forecast model
**Files:** `src/lib/ai/scheduling/forecast.ts`
**Acceptance:** Predicts hourly cover counts for next 14 days; MAPE < 15% on backtest.

### 10.3.3 — Schedule optimizer
**Files:** `src/lib/ai/scheduling/optimizer.ts`
**Acceptance:** Minimum staffing rules + labor budget → proposed shift assignments.

### 10.3.4 — Side-by-side UI
**Files:** `src/app/(backoffice)/scheduling/ai-proposed/page.tsx`
**Acceptance:** Manager reviews proposed schedule, edits, publishes.

## Batch 10.4 — Customer Concierge (SMS) (parallel, ~6 hours)

### 10.4.1 — Inbound router
**Files:** `src/lib/ai/concierge/router.ts`, Twilio webhook
**Acceptance:** Each test message gets correct intent (loyalty, reservation, order, FAQ, escalate).

### 10.4.2 — Per-intent handlers
**Files:** `src/lib/ai/concierge/handlers/{loyalty,reservation,order,faq}.ts`
**Acceptance:** Each completes the action and replies confirming.

### 10.4.3 — Conversation memory
**Files:** `src/lib/ai/concierge/memory.ts`
**Acceptance:** "Make it 5 not 4" mid-reservation flow works.

### 10.4.4 — Owner approval queue
**Files:** `src/app/(backoffice)/concierge/queue/page.tsx`
**Acceptance:** First 30 days require owner OK; auto-mode after threshold.

## Batch 10.5 — Computer Vision Plate-Up (OPTIONAL — most experimental, parallel, ~10h)

### 10.5.1 — Camera ingest
**Files:** `src/lib/ai/vision/ingest.ts`
**Acceptance:** 1fps frames flowing.

### 10.5.2 — Plate matching via vision LLM
**Files:** `src/lib/ai/vision/match.ts`
**Acceptance:** When plate leaves, model identifies which ticket.

### 10.5.3 — Auto-bump with confidence threshold
**Files:** `src/lib/ai/vision/auto-bump.ts`
**Acceptance:** High-confidence auto-bump; low-confidence prompts cook.

### 10.5.4 — Setup wizard
**Files:** `src/app/(backoffice)/settings/integrations/kitchen-camera/page.tsx`
**Acceptance:** Owner sets up in 5 minutes.

## Bonus batches

### Bonus Batch 10.6 — Sear Pulse (real-time anomaly alerts) (parallel, ~6h)

#### 10.6.1 — Anomaly detection
**Files:** `src/lib/ai/pulse/detect.ts`
**Acceptance:** Tracks 20+ metrics rolling; flags z-score > 2.5; FP rate < 1/day per location.

#### 10.6.2 — Mobile push
**Files:** `src/lib/notifications/push.ts`
**Acceptance:** Owner gets notification within 60s of anomaly.

#### 10.6.3 — Pulse Center mobile dashboard
**Files:** `src/app/(customer)/owner/pulse/page.tsx`
**Acceptance:** Live sales delta, top movers, alerts. Mobile-first.

### Bonus Batch 10.7 — AI Allergen/Dietary Filter (parallel, ~3h)

#### 10.7.1 — Filter UI
**Files:** `src/app/(customer)/menu/page.tsx`
**Acceptance:** One-tap filter (allergens, dietary, spice); menu reshuffles.

#### 10.7.2 — Ingredient inference
**Files:** `src/lib/ai/allergen-inference.ts`
**Acceptance:** Owner reviews + approves AI-inferred allergen tags.

### Bonus Batch 10.8 — AI Manager Insights (parallel, ~5h)

#### 10.8.1 — Weekly digest
**Files:** `src/lib/ai/insights/weekly.ts`, BullMQ scheduled
**Acceptance:** Monday 7am email with 5 actionable bullets.

#### 10.8.2 — In-app Q&A
**Files:** `src/app/(backoffice)/insights/page.tsx`
**Acceptance:** Manager asks "why did revenue drop Tuesday" → real answer.

### Bonus Batch 10.9 — Drive-thru LPR (parallel, ~4h)

#### 10.9.1 — License plate recognition
**Files:** `src/lib/ai/vision/lpr.ts`
**Acceptance:** Customer opt-in; plate matches profile.

#### 10.9.2 — "Your usual" reorder
**Files:** `src/app/(fullscreen)/drive-thru/lane/page.tsx`
**Acceptance:** One-tap repeat order pre-loaded.

### Bonus Batch 10.10 — AI training simulator (parallel, ~5h)

#### 10.10.1 — Scenario library
**Files:** `src/lib/ai/training/`, `src/app/(backoffice)/training/page.tsx`
**Acceptance:** 50+ branching scenarios + LLM scoring.

#### 10.10.2 — Custom scenarios per restaurant
**Files:** Scenario builder UI
**Acceptance:** Owner creates 3 custom scenarios specific to concept.

### Bonus Batch 10.11 — Real-time peer benchmarking (parallel, ~4h)

#### 10.11.1 — Anonymized aggregation
**Files:** `src/workers/peer-benchmark.ts`, BullMQ
**Acceptance:** Nightly export per-restaurant percentile metrics; no PII.

#### 10.11.2 — Benchmarking dashboard
**Files:** `src/app/(backoffice)/insights/peer-benchmark/page.tsx`
**Acceptance:** 8 KPIs vs cuisine + ZIP peers; clear "improve here" CTAs.

## Batch 10.99 — Demo + ship + LAUNCH (sequential, ~3 hours)

### 10.99.1
- Live demo all 5 main AI features (skip 10.5 if it slipped to optional-deferred).
- Tag `v10.0.0` — this is the MAIN release.
- Public launch announcement (post to logs/V10_DELIVERY.md).
- Mark V10 status: complete in STATE.yaml.
- Pipeline halts gracefully — runner outputs final report and stops loop.
