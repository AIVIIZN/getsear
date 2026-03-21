# Agent Build Framework

One document. Fill in the blanks. Let the AI handle the technical details.

---

## HOW THIS WORKS

1. You fill in **Part 1** (your project description, in plain English)
2. You paste this whole document into Claude Code
3. The AI generates the technical plan (database, files, routes) and shows it to you
4. You approve or adjust
5. It builds everything, tests it, reviews it, and fixes anything it missed

You don't need to know database schemas, API design, or file structure.
You just need to know what your app should DO.

---

## PART 1: YOUR PROJECT (fill this in)

### What is this?
<!--
Describe the app in 2-3 sentences. Who is it for? What problem does it solve?
Example: "A client portal for a landscaping company. Customers log in to see
their project status, approve estimates, view before/after photos, and pay
invoices. The owner has an admin panel to manage everything."
-->

[Write your description here]


### Tech stack (pick one per line, or write "you decide")
- **Language/Framework:** [e.g., Python/Flask, Next.js, "you decide"]
- **Database:** [e.g., Supabase, "you decide"]
- **CSS/Styling:** [e.g., Tailwind, Bootstrap, "dark theme, modern look"]
- **Hosting:** [e.g., Railway, Vercel, "you decide"]
- **Auth method:** [e.g., email/password, Google OAuth, "basic login"]


### User roles
<!--
Who uses this app? What can each type of person do?
Example:
- Admin (the business owner): can do everything - manage projects, clients, invoices
- Client: can view their projects, approve estimates, pay invoices
- Public (not logged in): can see a landing page and contact form
-->

[List your user roles and what each can do]


### Pages and features
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

<!--
Repeat for every page. Common pages to consider:
- Login / Register / Forgot Password
- Dashboard (what does each role see?)
- List pages (projects, clients, invoices, etc.)
- Detail pages (single project view, single client view, etc.)
- Create/Edit forms
- Settings / Profile
- Admin panel (if different from regular dashboard)
- Landing page (if there's a public-facing side)
- Any other feature-specific pages
-->


### Look and feel
<!--
Describe the visual style. Reference sites you like if that helps.
Example: "Dark theme, professional, like a modern SaaS dashboard. Steel blue
accents, clean typography, card-based layout. Similar to Linear or Vercel's
dashboard."
-->

[Describe the visual style]


### Business rules and special behavior
<!--
Anything that isn't obvious from the page descriptions.
Example:
- "When a project is marked complete, automatically email the client"
- "Invoices overdue by 30+ days should show a red warning"
- "Only the admin can delete projects, and it should be a soft delete"
- "Photos should be compressed on upload, max 5MB each"
Leave blank if nothing comes to mind - the AI will make reasonable defaults.
-->

[List any special rules, or write "use sensible defaults"]


### Integrations
<!--
Any external services the app needs to connect to.
Example:
- "Stripe for payments"
- "SendGrid or Gmail for email"
- "AWS S3 for file uploads"
Leave blank if none.
-->

[List integrations, or write "none"]


### Anything else
<!--
Anything that doesn't fit above. Reference apps you want it to feel like.
Specific things you definitely want or definitely don't want.
Example: "I want it to feel as polished as a real SaaS product, not a demo."
-->

[Anything else, or leave blank]


---

## PART 2: BUILD RULES (do not modify — this is what makes it work)

### CRITICAL RULES — ACTIVE FOR THE ENTIRE BUILD

1. **PLAN BEFORE YOU CODE.** Before writing a single line of code, generate a complete build plan that includes:
   - Every database table with columns and types
   - Every page/route with URL and what's on it
   - Every file that will be created
   - A testable checklist of what "done" looks like for every feature
   Output this plan and get the user's approval before proceeding. This plan becomes the source of truth.

2. **IMPLEMENT EVERY ITEM IN THE PLAN.** Not most. Not the important ones. Every single item. If the plan says a page has 4 cards, there are 4 cards with real data. If there are 5 CRUD resources, all 5 are fully written.

3. **ZERO stubs, ZERO TODOs, ZERO placeholders, ZERO "pass" function bodies, ZERO "implement later" comments.** Every function has a real implementation. Every template has real content. Every route returns a real response.

4. **ZERO "similar to above" or "repeat this pattern" shortcuts.** Do not write 2 of 5 things and say "follow the same pattern for the rest." The code does not exist until it is written.

5. **ZERO "and so on" or "etc." in code output.** If there are 10 menu items, write all 10. If there are 8 form fields, write all 8. Never truncate.

6. **Self-check after every major component.** After finishing a feature, re-read your plan and verify you built everything listed for that feature before moving on.

7. **If running low on context or turns, STOP AND REPORT.** Do not silently stop. Do not declare victory with work remaining. List every incomplete item with enough detail that the next agent (or conversation) can pick up exactly where you left off.

8. **Build what was asked for.** No bonus features, no unsolicited refactoring, no "while I'm here" improvements. Match the spec exactly.

9. **Run tests and verify the app starts.** Don't just write code and hope. Actually run it.

10. **If something fails twice, rethink the approach.** Don't brute-force. Don't retry the same thing. Step back and try a different angle.


### AGENT ORCHESTRATION

Execute these phases in order. Do not skip or combine phases.

#### PHASE 1: Discovery
Read Part 1 carefully. If anything is ambiguous or underspecified, ask clarifying
questions BEFORE proceeding. Better to ask 5 questions now than to guess wrong
on 5 features.

#### PHASE 2: Technical Plan
Generate the complete build plan:

**A. Database schema** — every table, every column, types, constraints, relationships.
**B. Page inventory** — every page with URL, access rules, and every component on it.
**C. File manifest** — every file that will exist in the final project.
**D. Acceptance checklist** — testable checkbox for every feature (written as "[ ] user can do X and sees Y").

Output the full plan. Wait for user approval. Revise if needed.
This plan is now the contract. Everything in it gets built.

#### PHASE 3: Research (parallel Explore agents)
Launch 2-3 read-only Explore agents in parallel to research:
- Tech stack best practices, correct imports, version-specific gotchas
- Any third-party integration docs (APIs, auth flows, webhooks)
- Existing codebase patterns (if building on existing code)
No code changes in this phase.

#### PHASE 4: Task Decomposition (Plan agent)
Break the build plan into ordered, parallelizable task batches.

Each task must be:
- **Self-contained** — includes all context needed (paste the relevant plan sections into the task, don't reference "see above")
- **Scoped to specific files** — lists exactly which files from the manifest it creates/modifies
- **Scoped to specific criteria** — lists exactly which acceptance checkboxes it must satisfy
- **Sized for one agent** — completable in one session

Group tasks into batches. Tasks within a batch have no dependencies on each other
and can run in parallel. Batches run sequentially (Batch 2 depends on Batch 1).

#### PHASE 5: Implementation (parallel Opus agents per batch)
For each batch, launch parallel Opus agents. Each agent receives:
1. Its full task packet (all context included, not references)
2. The critical rules above
3. Instruction: "After implementation, verify your acceptance criteria. Do not report done until they pass."

- Complete Batch 1 (parallel) before starting Batch 2
- If any agent reports incomplete work, investigate and resolve before moving on
- Never proceed with known gaps

#### PHASE 6: Integration (single Opus agent)
One agent reads every file, checks for:
- Import errors, missing references, naming inconsistencies between files
- App starts without errors
- All tests pass
- Conflicts between parallel agents' work (duplicate function names, incompatible patterns)
Fix everything found.

#### PHASE 7: Adversarial Review (fresh Opus agent)
A new agent that did NOT build anything reviews the entire project. Its only job is to find gaps.

It receives the full plan from Phase 2 and checks:
- [ ] Every file in the manifest exists with complete, working code
- [ ] Every page has ALL components listed in the plan
- [ ] Every acceptance checkbox can be verified as passing
- [ ] No TODO, FIXME, stub, placeholder, or "implement later" anywhere
- [ ] No hardcoded secrets that should be env vars
- [ ] All navigation links and buttons work (no dead ends)
- [ ] All forms validate and show errors
- [ ] Consistent styling across all pages

Output: numbered list of every issue, with file path and line number.

#### PHASE 8: Fix and Re-review
If issues were found:
1. Launch Opus agents to fix every issue (parallel where possible)
2. Run Phase 7 again with a fresh agent
3. Repeat until clean (max 3 rounds)

#### PHASE 9: Final Delivery
- Run all tests
- Verify app starts and key flows work
- Report: what was built, what needs manual setup (env vars, migrations, DNS, etc.)


---

## TIPS FOR FILLING IN PART 1

### The more detail you give, the better the output
"A dashboard" gets you a generic dashboard. "A dashboard with 4 stat cards showing
revenue this month, active projects, pending invoices, and average review rating,
plus a table of recent activity" gets you exactly that.

### You don't need to be technical
Instead of "a REST endpoint with pagination," just say "a page that shows all
projects in a list, 20 at a time, with a button to load more."

### Think about what each user role sees
Walk through the app as each type of user. What do they see first? What can
they click? What can't they access?

### Mention what you DON'T want
"No dark mode toggle" or "don't add a chat feature" helps prevent scope creep.

### Reference real apps
"I want the settings page to work like GitHub's settings" communicates more
than a paragraph of description.

### Common things people forget to mention
- What happens when there's no data yet? (empty states)
- What does the email look like? (subject, body, when it sends)
- What should error messages say?
- Can users delete things? Is it permanent?
- Is there search? What can you search by?
- Are there file uploads? What types? What size limit?
- Mobile — does it need to work on phones?
