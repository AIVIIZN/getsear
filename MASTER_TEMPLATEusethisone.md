# Agent Build Framework v2

One document. Fill in the blanks. Let the AI build the entire application autonomously.

This framework has been battle-tested on a 169-route, 72-table production POS system. Version 2 adds design system generation, visual quality assurance, module completeness verification, and guardrails against the most common autonomous build failures.

---

## HOW THIS WORKS

1. You fill in **Part 1** (your project description, in plain English)
2. You paste this whole document into Claude Code (Opus recommended)
3. The AI generates a technical plan AND a visual design system, then shows both to you
4. You approve or adjust
5. It builds everything — code, styling, seed data, tests — reviews it with adversarial agents, fixes issues, and delivers a polished product
6. You verify the final result looks and works like a real product, not a prototype

You don't need to know database schemas, API design, or file structure.
You just need to know what your app should DO and what it should FEEL LIKE.

---

## PART 1: YOUR PROJECT (fill this in)

### 1.1 What is this?
<!--
Describe the app in 2-3 sentences. Who is it for? What problem does it solve?
Example: "A client portal for a landscaping company. Customers log in to see
their project status, approve estimates, view before/after photos, and pay
invoices. The owner has an admin panel to manage everything."
-->

[Write your description here]


### 1.2 Tech stack (pick one per line, or write "you decide")
- **Language/Framework:** [e.g., Python/Flask, Next.js, Ruby/Rails, "you decide"]
- **Database:** [e.g., Supabase, PostgreSQL, MongoDB, "you decide"]
- **CSS/Styling:** [e.g., Tailwind CSS, shadcn/ui, "you decide"]
- **Hosting target:** [e.g., Railway, Vercel, GCP, AWS, "you decide"]
- **Auth method:** [e.g., email/password, Google OAuth, PIN login, "basic login"]


### 1.3 User roles
<!--
Who uses this app? What can each type of person do?
Example:
- Admin (the business owner): can do everything — manage projects, clients, invoices
- Client: can view their projects, approve estimates, pay invoices
- Public (not logged in): can see a landing page and contact form
-->

[List your user roles and what each can do]


### 1.4 Pages and features
<!--
This is the most important section. Walk through every screen a user would see.
The more detail you put here, the better the output.

Don't worry about technical terms. Just describe it like you're showing someone
a wireframe: "On this page, there's a sidebar with navigation, a header with
the company logo, and the main area shows a list of all projects with their
status, client name, and deadline. There's a button to create a new project."

USE THIS FORMAT for each page:
-->

**Page: [Name]**
- Who can access it: [role]
- What's on it: [describe everything you'd see]
- What can you do: [buttons, forms, actions]
- Where does it link to: [what pages connect to/from here]
- What does it look like with no data yet: [empty state — what message, illustration, or call-to-action appears?]

<!--
Repeat for every page. Common pages to consider:
- Login / Register / Forgot Password
- Dashboard (what does each role see first?)
- List pages (projects, clients, invoices, etc.)
- Detail pages (single project view, single client view, etc.)
- Create/Edit forms
- Settings / Profile
- Admin panel (if different from regular dashboard)
- Landing page (if there's a public-facing side)
- Any other feature-specific pages

IMPORTANT: For each page, describe the EMPTY STATE — what the user sees before
any data exists. "No projects yet — create your first one" is better than a
blank white screen. This is critical for first impressions.
-->


### 1.5 Look and feel
<!--
This section directly controls the visual quality of your application.
Vague input ("make it look nice") produces generic output.
Specific input produces a specific, polished result.

Fill in as many fields as you can. Leave any blank for smart defaults.
-->

- **Mode:** [Dark-first / Light-first / Both with toggle / "you decide"]
- **Vibe (3-5 adjectives):** [e.g., "premium, minimal, fast, warm, confident"]
- **Reference products:** [Name 2-3 apps whose visual style you admire. e.g., "Linear's dark mode, Stripe's dashboard clarity, Notion's clean typography"]
- **Color direction:** [e.g., "dark charcoal base with warm amber accents" or "clean white with navy and coral" or "you decide"]
- **Typography:** [e.g., "Inter for UI, monospace for data" or "you decide"]
- **Animation quality:** [e.g., "fluid native-iOS feel with spring physics" or "minimal, functional only" or "you decide"]
- **Quality bar:** [e.g., "must feel like a $50M startup's shipped product" or "clean and professional" or "better than [competitor name]"]
- **Device target:** [e.g., "iPad landscape primary, desktop secondary" or "mobile-first responsive" or "desktop only"]
- **Specific visual elements you want:** [e.g., "glassmorphism on modals, gradient accents on CTAs, skeleton loading states everywhere"]
- **Things you do NOT want:** [e.g., "no bright colors, no rounded bubbly buttons, no generic Bootstrap look"]

<!--
The more specific you are here, the more polished the result.
"Dark theme" → you get default dark Tailwind.
"Dark charcoal (#0f1117) base, warm amber (#f59e0b) accent, frosted glass modals
with backdrop-blur, spring-physics animations on all transitions, skeleton loaders
on every async load, 48px minimum touch targets, Inter 400/500/600/700" → you get
exactly that, consistently, on every screen.
-->


### 1.6 Business rules and special behavior
<!--
Anything that isn't obvious from the page descriptions.
Example:
- "When a project is marked complete, automatically email the client"
- "Invoices overdue by 30+ days should show a red warning"
- "Only the admin can delete projects, and it should be a soft delete"
- "Photos should be compressed on upload, max 5MB each"
Leave blank if nothing comes to mind — the AI will make reasonable defaults.
-->

[List any special rules, or write "use sensible defaults"]


### 1.7 Integrations
<!--
Any external services the app needs to connect to.
Example:
- "Stripe for payments"
- "SendGrid for email"
- "AWS S3 for file uploads"
- "Twilio for SMS"
Leave blank if none.
-->

[List integrations, or write "none"]


### 1.8 Modules and features planned but not for v1
<!--
NEW IN V2: If your app has features you want to build later (not now), list
them here. This prevents the AI from building empty scaffolding for future
features. Only what's in section 1.4 gets built. Everything here is documented
for future reference but NOT implemented.

Example:
- "Inventory management (v2)"
- "Mobile app (v3)"
- "AI-powered recommendations (v2)"
-->

[List future features, or write "none — build everything in 1.4"]


### 1.9 Anything else
<!--
Anything that doesn't fit above. Reference apps you want it to feel like.
Specific things you definitely want or definitely don't want.
Example: "I want it to feel as polished as a real SaaS product, not a demo."
-->

[Anything else, or leave blank]


---

## PART 2: BUILD RULES (do not modify — this is what makes it work)

### ABSOLUTE RULES — ACTIVE FOR THE ENTIRE BUILD

These rules are non-negotiable. They apply to every phase, every agent, every file.

1. **PLAN BEFORE YOU CODE.** Before writing a single line of code, generate a complete build plan (Phase 2) AND a complete design system (Phase 3). Get user approval on both before proceeding. These become the contract.

2. **IMPLEMENT EVERY ITEM IN THE PLAN.** Not most. Not the important ones. Every single item. If the plan says a page has 4 cards, there are 4 cards with real data. If there are 5 CRUD resources, all 5 are fully built with create, read, update, and delete.

3. **ZERO stubs, ZERO TODOs, ZERO placeholders, ZERO "pass" function bodies, ZERO "implement later" comments, ZERO empty directories, ZERO empty files.** Every function has a real implementation. Every template has real content. Every route returns a real response. If a module is not being built in this version, it does not exist in the codebase — no empty folders, no skeleton files, no "coming soon" comments.

4. **ZERO "similar to above" or "repeat this pattern" shortcuts.** Do not write 2 of 5 things and say "follow the same pattern for the rest." Write all 5. The code does not exist until every character is written.

5. **ZERO "and so on" or "etc." in code output.** If there are 10 menu items, write all 10. If there are 8 form fields, write all 8. Never truncate output.

6. **Self-check after every major component.** After finishing a feature, re-read the plan and verify you built everything listed for that feature — including the UI, the empty states, the loading states, the error states, and the styling — before moving on.

7. **If running low on context or turns, STOP AND REPORT.** Do not silently stop. Do not declare victory with work remaining. Output a numbered list of every incomplete item with enough detail (file paths, acceptance criteria, current state) that the next agent or conversation can pick up exactly where you left off.

8. **Build what was asked for.** No bonus features, no unsolicited refactoring, no "while I'm here" improvements. Match the spec exactly. If section 1.8 lists future features, do NOT build them, scaffold them, or create empty directories for them.

9. **Run it and verify.** Don't just write code and hope. Actually start the app, load it in a browser, verify pages render with real data. Run all tests. Check that the login flow works end-to-end.

10. **If something fails twice, rethink the approach.** Don't brute-force. Don't retry the same thing. Step back and try a fundamentally different angle.

11. **DESIGN IS NOT OPTIONAL.** Every page must look professionally designed — not just functional. Apply the design system from Phase 3 consistently to every template. A page that works but looks like default HTML with utility classes is not done.

12. **EVERY PAGE MUST WORK WITH DATA AND WITHOUT DATA.** Every list, grid, table, and dashboard must have a designed empty state (with helpful message and call-to-action). Every async load must have a skeleton or shimmer loader. Every error must show a clear, styled error message. A blank white screen is never acceptable.

13. **SEED DATA IS MANDATORY.** The delivered application must include a seed script that populates realistic demo data. The first user who logs in must see a populated, functional application — not empty screens. Seed data must be version-controlled and reproducible.

14. **NAMING CONSISTENCY IS MANDATORY.** Before implementation begins, define a canonical glossary of entity names, column names, route prefixes, and CSS class prefixes. Use this glossary everywhere. `org_id` in one file and `organization_id` in another is a bug.

15. **NEVER create code that depends on CDN availability without a local fallback.** If loading libraries from a CDN, include local copies as fallback. The app must work if the CDN is down.

16. **ALL SECRETS IN ENVIRONMENT VARIABLES.** Never hardcode API keys, database URLs, passwords, or tokens in source code. Use .env files (gitignored) with a .env.example documenting every required variable.


### ARCHITECTURE RULES — HOW TO STRUCTURE THE SPEC

When the user provides a large architecture document (over 5,000 lines), break it into focused reference documents before implementation:

| Document | Contains | Used By |
|----------|----------|---------|
| `SCHEMA.md` | Database tables, columns, types, constraints, relationships | Phase 2A, implementation agents building data layer |
| `API_SPEC.md` | Every route with method, path, request/response shape, auth | Phase 2B, implementation agents building routes |
| `DESIGN_SYSTEM.md` | Color tokens, component styles, spacing scale, animations | Phase 3, all implementation agents building UI |
| `BUSINESS_RULES.md` | Domain logic, workflows, state machines, validation rules | Implementation agents building business logic |
| `MODULES.md` | Module specs (one section per module, what's in-scope vs future) | Phase 4 task decomposition |

This prevents any single agent from needing to hold the entire spec in context. Each agent reads only the documents relevant to its task.


### DESIGN SYSTEM RULES — HOW TO BUILD VISUAL QUALITY

These rules ensure the output looks like a shipped product, not a hackathon project.

1. **Design tokens are the single source of truth.** Define all colors, spacing, typography, shadows, border radii, and z-indexes as CSS custom properties (variables) in one file. Reference these tokens everywhere — never hardcode a hex color, pixel value, or font weight in a template.

2. **Build a component library before building pages.** Before any page template is written, create styled components for: buttons (4 sizes, 4 variants), inputs (text, select, textarea, checkbox, radio), cards, modals, slide-overs, dropdowns, tables, badges/pills, toasts/notifications, skeleton loaders, and empty states. Every page assembles from these components.

3. **Every interactive element needs 4 states:** default, hover/focus, active/pressed, and disabled. Touch targets must be minimum 44x44px (48px preferred). All buttons must show loading state during async operations.

4. **Animations must be purposeful and consistent.** Define a global animation system: transition duration (fast: 150ms, normal: 250ms, slow: 400ms), easing curves (ease-out for enters, ease-in for exits), and specific animations for common actions (item added, item removed, page transition, modal open/close, toast appear/dismiss). Store all timing values as CSS custom properties.

5. **Typography hierarchy must be explicit.** Define exactly 6-8 text styles (e.g., h1, h2, h3, body, body-small, caption, overline, mono) with specific font-size, font-weight, line-height, and letter-spacing for each. Use these consistently — never ad-hoc font sizes.

6. **Color must be semantic.** Define colors by purpose (primary, secondary, success, warning, error, info, surface, background, text-primary, text-secondary, text-muted, border), not by hue name. Support both light and dark modes even if only one is used initially.

7. **Spacing follows an 8px grid.** All padding, margin, and gap values should be multiples of 4px or 8px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96). No arbitrary spacing values.

8. **Loading states use skeleton screens, not spinners.** Show the shape of content before it arrives. Spinners block the UI and feel slow. Skeleton loaders feel instant.

9. **Empty states guide action.** When a list/grid/table has no data, show: (a) an illustration or icon, (b) a clear message explaining what would be here, (c) a primary call-to-action button. Example: "No projects yet" with a "Create your first project" button.

10. **Shadows and elevation create hierarchy.** Define 4-5 shadow levels (none, sm, md, lg, xl) and use them consistently: cards get sm, dropdowns get md, modals get lg. Never mix shadow approaches.


### AGENT ORCHESTRATION

Execute these phases in order. Do not skip or combine phases. Each phase has a defined input, output, and gate condition that must pass before proceeding.

---

#### PHASE 1: Discovery
**Input:** Part 1 of this document
**Output:** Clarifying questions OR confirmation that the spec is clear
**Gate:** All ambiguities resolved

Read Part 1 carefully. If anything is ambiguous or underspecified, ask clarifying questions BEFORE proceeding. Better to ask 5 questions now than to guess wrong on 5 features.

Pay special attention to:
- Undefined empty states (what does each page look like with no data?)
- Unclear user flows (what happens after a form submit? where does the user go?)
- Missing error scenarios (what if payment fails? what if upload is too large?)
- Ambiguous "you decide" choices (pick the best option and state your choice clearly)

If everything is clear, state your interpretation of each section and confirm with the user.

---

#### PHASE 2: Technical Plan
**Input:** Approved Part 1 spec
**Output:** Complete technical plan document
**Gate:** User approves the plan

Generate the complete build plan with these sections:

**A. Naming glossary** — canonical names for every entity, column pattern, route prefix, and CSS class prefix. Example: "Organization is always `org` (not `organization`). ID columns are always `entity_id` (e.g., `org_id`, `user_id`). Route prefix is always `/api/v1/`. CSS components use `btn-`, `input-`, `card-` prefixes."

**B. Database schema** — every table, every column, types, constraints, relationships, indexes. Include ONLY tables needed for features in section 1.4. Do NOT create tables for section 1.8 (future) features.

**C. Page inventory** — every page with URL, access rules, layout type (sidebar, fullscreen, etc.), and every component on it. Include the empty state for each page.

**D. API route manifest** — every route with HTTP method, path, request shape, response shape, auth requirement, and which page(s) call it.

**E. File manifest** — every file that will exist in the final project, organized by directory. Include ONLY files needed for features being built.

**F. Seed data plan** — what demo data will be created, how much, and what the user will see on first login.

**G. Acceptance checklist** — testable checkbox for every feature, written as:
- `[ ] User can [action] and sees [result]`
- `[ ] Page [name] shows [content] when data exists`
- `[ ] Page [name] shows [empty state] when no data exists`
- `[ ] [Integration] successfully [action] when [trigger]`

Every module, every page, every API route must have at least one acceptance checkbox. If the plan says it exists, there's a checkbox that verifies it.

Output the full plan. Wait for user approval. Revise if needed. **This plan is now the contract. Everything in it gets built. Nothing outside it gets built.**

---

#### PHASE 3: Design System (use frontend-design and ui-ux-pro-max skills if available)
**Input:** Approved technical plan + section 1.5 (Look and Feel)
**Output:** Complete design system document and files
**Gate:** User approves the visual direction

This phase produces the visual foundation for the entire application. Do NOT skip it. Do NOT fold it into implementation.

Generate:

**A. Design tokens file** — CSS custom properties for:
- Color palette (primary, secondary, accent, semantic colors, surface/background, text hierarchy) with both light and dark mode values
- Typography scale (6-8 named text styles with size, weight, line-height, letter-spacing)
- Spacing scale (based on 8px grid)
- Shadow/elevation scale (4-5 levels)
- Border radius scale (none, sm, md, lg, full)
- Z-index scale (base, dropdown, sticky, overlay, modal, popover, toast, tooltip)
- Animation timing (fast, normal, slow durations + easing curves)
- Layout constants (sidebar width, topbar height, content max-width, etc.)

**B. Component library** — styled implementations of:
- Buttons (sizes: sm, md, lg, xl; variants: primary, secondary, ghost, danger; states: default, hover, active, disabled, loading)
- Form inputs (text, email, password, number, select, textarea, checkbox, radio, toggle; states: default, focus, error, disabled)
- Cards (basic, interactive, selected)
- Modals and slide-overs (with backdrop blur, enter/exit animations)
- Dropdowns and popovers
- Data tables (with sorting, pagination indicators)
- Badges and pills (status colors)
- Toast notifications (success, error, warning, info; with enter/exit animations)
- Skeleton loaders (text, card, table row, avatar, chart)
- Empty state component (icon + message + CTA button)
- Navigation (sidebar, topbar, breadcrumbs, tabs)

**C. Page layout templates** — base layouts for each page type identified in Phase 2C (e.g., sidebar+content, fullscreen, centered-card for login). These define the structural grid that pages fill.

**D. Animation system** — defined transitions for:
- Page/view transitions
- Modal/slide-over open and close
- Item added/removed from lists
- Button press feedback
- Loading state transitions
- Toast appear/dismiss
- Skeleton-to-content reveal

Show the user a preview of the design direction (describe 2-3 key screens in detail with color, layout, and component choices). Wait for approval before proceeding.

---

#### PHASE 4: Research (parallel Explore agents)
**Input:** Approved plan + approved design system
**Output:** Research findings document
**Gate:** No blocking unknowns remain

Launch 2-4 read-only Explore agents in parallel to research:
- Tech stack best practices, correct import paths, version-specific gotchas
- Third-party integration docs (APIs, auth flows, SDKs, webhooks)
- Existing codebase patterns (if building on existing code)
- CSS framework capabilities and limitations for the design system
- Font loading strategy, icon library options
No code changes in this phase.

---

#### PHASE 5: Task Decomposition (Plan agent)
**Input:** Approved plan + design system + research findings
**Output:** Ordered, parallelizable task batches
**Gate:** Every acceptance checkbox is assigned to exactly one task

Break the build plan into ordered, parallelizable task batches.

**Batch ordering must follow this sequence:**
1. Configuration, environment, app factory
2. Database migrations and schema
3. Design system files (tokens, components, base layouts)
4. Shared utilities (auth, validators, decorators, response helpers)
5. Core business logic (services and routes, one domain per task)
6. Page templates (wired to working endpoints, using design system components)
7. Seed data script
8. Integration wiring (real-time, webhooks, background tasks)
9. Tests

Each task must be:
- **Self-contained** — includes ALL context needed. Paste the relevant plan sections, naming glossary, and design token references directly into the task. Never reference "see above" or "see Phase 2."
- **Scoped to specific files** — lists exactly which files from the manifest it creates/modifies
- **Scoped to specific acceptance criteria** — lists exactly which checkboxes it must satisfy
- **Includes the design system** — every task that creates UI must include the design tokens and relevant component definitions
- **Sized for one agent** — completable in one session

Group tasks into batches. Tasks within a batch have no dependencies on each other and can run in parallel. Batches run sequentially (Batch 2 depends on Batch 1 completing).

**Verify:** Every acceptance checkbox from Phase 2G must be assigned to exactly one task. If any checkbox is unassigned, the decomposition is incomplete.

---

#### PHASE 6: Implementation (parallel Opus agents per batch)
**Input:** Task batches from Phase 5
**Output:** Complete, working codebase
**Gate:** All tasks report done, all acceptance criteria satisfied

For each batch, launch parallel Opus agents. Each agent receives:
1. Its full task packet (all context included — plan sections, naming glossary, design tokens, component definitions)
2. The absolute rules from Part 2
3. The design system rules
4. Instruction: **"After implementation, verify your acceptance criteria by reading your output files and confirming they match the spec. Check that UI code uses design tokens (not hardcoded values), empty states are implemented, loading states exist, and the styling matches the design system. Do not report done until everything passes."**

Execution rules:
- Complete Batch 1 (parallel) before starting Batch 2
- If any agent reports incomplete work, investigate and resolve before moving on
- Never proceed with known gaps
- If an agent runs low on context, it must output a handoff document (Rule 7)

---

#### PHASE 7: Integration Verification (single Opus agent)
**Input:** Complete codebase from Phase 6
**Output:** List of integration issues (or clean bill)
**Gate:** App starts, all pages render, no import errors

One agent reads every file and verifies:
- All imports resolve (no missing modules, no circular imports)
- All routes are registered with the app (check route manifest against app factory)
- All templates extend the correct base layout and use design system components
- App starts without errors
- All tests pass
- No conflicts between parallel agents' work (duplicate function names, incompatible patterns, naming glossary violations)
- Design tokens file is imported/referenced by all templates
- Seed data script runs without errors and populates all expected data

Fix everything found before proceeding.

---

#### PHASE 8: Adversarial Code Review (fresh Opus agent)
**Input:** Working codebase + Phase 2 plan
**Output:** Numbered issue list with file paths and line numbers
**Gate:** Issue list is empty or all issues are resolved

A NEW agent that did NOT build anything reviews the entire project. It has never seen this code before. Its only job is to find gaps between the plan and the implementation.

It receives the full plan from Phase 2 and the design system from Phase 3, and checks:

**Completeness:**
- [ ] Every file in the manifest exists with complete, working code
- [ ] Every page has ALL components listed in the plan
- [ ] Every API route in the manifest is implemented and registered
- [ ] Every acceptance checkbox can be verified as passing
- [ ] No TODO, FIXME, stub, placeholder, "implement later", or "coming soon" anywhere
- [ ] No empty directories or empty files
- [ ] No hardcoded secrets that should be env vars
- [ ] Seed data script exists and creates all planned demo data

**Functionality:**
- [ ] All navigation links and buttons work (no dead ends, no 404s)
- [ ] All forms validate input and show clear error messages
- [ ] All async operations have loading states
- [ ] All lists/grids/tables have empty states
- [ ] Login flow works end-to-end
- [ ] Auth guards prevent unauthorized access

**Visual quality:**
- [ ] Design tokens are used consistently (no hardcoded colors, spacing, font sizes)
- [ ] All pages follow the design system (same buttons, same cards, same inputs everywhere)
- [ ] Dark/light mode works correctly (if specified)
- [ ] Typography hierarchy is consistent across all pages
- [ ] Spacing follows the 8px grid (no arbitrary pixel values)
- [ ] Animations and transitions work as specified
- [ ] No default/unstyled HTML elements visible (no browser-default buttons, inputs, selects)
- [ ] No layout shifts, overflow issues, or misaligned elements

**Security:**
- [ ] All routes that should require auth have auth decorators
- [ ] CSRF protection on all form submissions
- [ ] No SQL injection vectors (parameterized queries only)
- [ ] No XSS vectors (output encoding on all user-generated content)
- [ ] Passwords hashed with bcrypt or argon2 (never SHA-256, never plaintext)
- [ ] Rate limiting on auth endpoints

**Naming consistency:**
- [ ] Entity names match the Phase 2A glossary everywhere (code, DB, API, UI)
- [ ] No naming drift between files (e.g., `org_id` in one file, `organization_id` in another)

Output: numbered list of every issue, with file path, line number, and severity (critical / medium / low).

---

#### PHASE 9: Visual QA (fresh Opus agent)
**Input:** Working codebase with seed data loaded
**Output:** Visual issue list with page names and descriptions
**Gate:** Every page passes visual inspection

A NEW agent loads every page in the application (using WebFetch or by reading the rendered template output) and evaluates visual quality.

For each page, verify:
- [ ] Page renders with seed data (not empty/broken)
- [ ] Layout matches the Phase 2C page inventory description
- [ ] Empty state renders correctly when data is removed
- [ ] Colors, fonts, and spacing match the design system
- [ ] The page looks like it belongs to the same application as every other page
- [ ] Touch targets are properly sized (if touch device is the target)
- [ ] No visual regressions from default/unstyled elements
- [ ] Page is responsive at the target device size(s)
- [ ] Loading states appear during async operations
- [ ] Error states display correctly when operations fail

Output: numbered list of every visual issue with page name, description, and screenshot reference (if possible).

---

#### PHASE 10: Fix and Re-review
**Input:** Issues from Phase 8 and Phase 9
**Output:** Clean codebase
**Gate:** Re-review finds zero issues

If issues were found:
1. Launch Opus agents to fix every issue (parallel where possible — group fixes by file)
2. Run Phase 8 again with a fresh agent (not the one that found issues, not the one that fixed them)
3. Run Phase 9 again with a fresh agent
4. Repeat until both reviews come back clean (max 3 rounds)
5. If issues persist after 3 rounds, output a detailed report of remaining issues for the user

---

#### PHASE 11: Final Delivery
**Input:** Clean codebase that passed all reviews
**Output:** Delivery report

Final verification:
- Run all tests
- Verify app starts and key user flows work end-to-end (login, create data, view data, edit data, delete data)
- Verify seed data renders correctly on first load
- Verify the first-run experience (what a new user sees after login)

Deliver to the user:
1. **What was built** — summary of features, pages, routes, database tables
2. **How to run it** — exact commands to start the app locally
3. **How to deploy it** — step-by-step deployment instructions for the target host
4. **Environment variables needed** — list every required env var with description and example value
5. **Seed data** — how to load demo data, how to reset to clean state
6. **Login credentials** — demo account(s) with email/password
7. **What was NOT built** — anything from section 1.8 (future features), explicitly listed so there's no confusion
8. **Known limitations** — anything that requires external setup (DNS, SSL, API keys from third parties)


---

## PART 3: FAILURE PREVENTION (lessons from real builds)

These are specific failure modes observed in production autonomous builds. Each rule exists because the failure actually happened.

### Failure: "Database schemas exist but no routes"
**What happened:** The AI created database tables for 14 modules but only built routes for 2. The schemas passed the "no stubs" check because they were real SQL — but the modules were unusable without routes.
**Prevention:** Rule 3 now bans empty directories and skeleton files. Section 1.8 separates future features from current scope. Phase 2G requires acceptance checkboxes for every module. Phase 5 requires every checkbox assigned to a task.

### Failure: "The app works but looks terrible"
**What happened:** Every route returned correct data. Every template rendered valid HTML. But the visual design was default Tailwind utility classes with no cohesive design language. It looked like a homework assignment, not a product.
**Prevention:** Phase 3 (Design System) now generates a complete visual foundation before any page is built. Rule 11 makes design non-optional. Phase 9 (Visual QA) catches styling gaps.

### Failure: "First login shows empty screens"
**What happened:** The app had no seed data. A user who logged in saw "No items found" on every page. It appeared broken even though the code was correct.
**Prevention:** Rule 13 makes seed data mandatory. Phase 2F plans the seed data. The acceptance checklist includes "page shows [content] when data exists."

### Failure: "Naming inconsistency across files"
**What happened:** Parallel agents used different names for the same concept. One agent wrote `org_id`, another wrote `organization_id`. One used `user_id`, another used `staff_id` for the same field.
**Prevention:** Phase 2A creates a naming glossary. Rule 14 requires using it. Phase 8 checks for naming drift.

### Failure: "CDN goes down, app breaks"
**What happened:** JavaScript libraries loaded from CDN. CDN had an outage. The entire app stopped working.
**Prevention:** Rule 15 requires local fallbacks for all CDN dependencies.

### Failure: "12 optional modules scaffolded as empty directories"
**What happened:** The architecture doc described 14 modules. The AI created directories for all 14 but only implemented 2. The 12 empty directories confused users and violated the "no stubs" rule in spirit if not letter.
**Prevention:** Rule 3 explicitly bans empty directories. Section 1.8 separates future features from current scope. Rule 8 says "build what was asked for" — if it's not in 1.4, it doesn't exist in the codebase.

### Failure: "Bugs found late, after full build"
**What happened:** 22 bugs were discovered by adversarial review agents after the entire codebase was written. Fixes required touching files across multiple domains, creating cascading changes.
**Prevention:** Phase 6 now includes per-agent self-verification. Phase 7 (Integration) catches wiring issues before the adversarial review. The sequential batch ordering in Phase 5 ensures foundations are solid before features are built on top.

### Failure: "Architecture doc too large for effective reasoning"
**What happened:** A 17,935-line architecture document was provided. The AI read it but couldn't reason about all of it simultaneously. It optimized for the most concrete parts (schemas, routes) and underweighted visual design and UX.
**Prevention:** The Architecture Rules section now instructs agents to break large specs into focused, per-concern reference documents. Each agent reads only what it needs.


---

## PART 4: TIPS FOR FILLING IN PART 1

### The more detail you give, the better the output
"A dashboard" gets you a generic dashboard. "A dashboard with 4 stat cards showing
revenue this month, active projects, pending invoices, and average review rating,
plus a table of recent activity with time-relative dates" gets you exactly that.

### You don't need to be technical
Instead of "a REST endpoint with pagination," just say "a page that shows all
projects in a list, 20 at a time, with a button to load more."

### Think about what each user role sees
Walk through the app as each type of user. What do they see first? What can
they click? What can't they access?

### The Look and Feel section is the highest-leverage input
Spend extra time on section 1.5. The difference between "dark theme" and a
detailed visual brief is the difference between a prototype and a product.
Reference specific apps. Name specific colors. Describe specific animations.
The AI will match your level of specificity.

### Describe the empty state for every page
What does the dashboard look like when there are zero projects? What does the
inbox look like with no messages? "No data yet — create your first one" with
a button is infinitely better than a blank white screen.

### Mention what you DON'T want
"No dark mode toggle" or "don't add a chat feature" or "no rounded bubbly
buttons" helps prevent scope creep and unwanted design choices.

### Reference real apps
"I want the settings page to work like GitHub's settings" communicates more
than a paragraph of description.

### Separate "build now" from "build later"
Put only what you want built NOW in section 1.4 (Pages and features).
Put everything else in section 1.8 (Modules planned but not for v1).
This prevents the AI from creating empty scaffolding for features that
don't exist yet.

### Keep your architecture doc under control
If you're providing a separate architecture document (database schemas, API specs,
business rules), consider keeping it under 10,000 lines or splitting it into
focused documents (SCHEMA.md, API_SPEC.md, etc.). The AI reasons better over
smaller, focused documents than over one massive file.

### Common things people forget to mention
- What happens when there's no data yet? (empty states)
- What does the email look like? (subject, body, when it sends)
- What should error messages say?
- Can users delete things? Is it permanent?
- Is there search? What can you search by?
- Are there file uploads? What types? What size limit?
- Mobile — does it need to work on phones, tablets, or desktop only?
- What does the loading state look like? (skeleton loaders, spinners, progress bars?)
- What animations or transitions exist? (page transitions, modal opens, item adds?)
- What sounds or haptic feedback exist? (notification sounds, button clicks?)


---

## CHANGELOG

### v2.0 (2026-03-22)
- Added Phase 3: Design System (visual design before implementation)
- Added Phase 9: Visual QA (every page inspected for visual quality)
- Added section 1.5 expanded Look and Feel (structured design brief, not one-liner)
- Added section 1.8 Modules planned but not for v1 (prevents empty scaffolding)
- Added Rule 11: Design is not optional
- Added Rule 12: Every page works with data and without data
- Added Rule 13: Seed data is mandatory
- Added Rule 14: Naming consistency is mandatory
- Added Rule 15: CDN fallback required
- Added Rule 16: All secrets in environment variables
- Added Design System Rules section (10 rules for visual quality)
- Added Architecture Rules section (how to break large specs into focused docs)
- Added Part 3: Failure Prevention (7 documented failure modes from real builds)
- Added Phase 2A naming glossary requirement
- Added Phase 2F seed data plan
- Expanded Phase 2G acceptance checklist to cover empty states and visual quality
- Expanded Phase 5 task decomposition with mandatory batch ordering
- Expanded Phase 8 adversarial review with visual quality, security, and naming checks
- Expanded tips section with empty states, look-and-feel guidance, and architecture doc sizing
- Renumbered phases: 9 phases → 11 phases (added Design System, Visual QA)

### v1.0
- Original 9-phase build framework
- 10 critical rules
- Basic Part 1 template
