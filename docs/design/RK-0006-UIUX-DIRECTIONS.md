# RK-0006 — Three Premium Redesign Directions

**Verdict being answered:** Ian — "the current UI looks childish."
**Ask:** three genuinely different, fully-rendered visual directions on the real
high-traffic surfaces, screenshotted on real demo data, so Ian picks one at the
5pm checkpoint. The winner becomes the enforced standard for a screen-by-screen
elevation sweep.

**Status:** `needs_decision`. Nothing is merged or deployed. All three ship as a
flag-OFF theme layer (`src/styles/themes.css`) that re-skins the whole app via a
single `data-theme` attribute over the existing ui-v2 tokens — no component
edits. With no attribute set, the app is byte-for-byte the current design.

---

## What each direction is

| | **A — Refined Professional** | **B — Apple iPadOS Light** | **C — High-Contrast Operational** |
|---|---|---|---|
| `data-theme` | `refined` | `ipados` | `operational` |
| Feel | Toast-tier hospitality; warm, editorial, confident | The design-reviewer's codified standard, done with discipline | Rush-hour glanceability first |
| Surface | Warm cream / sand (`#FBF8F3`) | Layered cool whites on `#F2F2F7` | Pure white on cool gray, near-black text |
| Primary | Terracotta `#B24A22` | iOS systemBlue `#0A84FF` | High-vis blue `#0B63E5` |
| Sidebar | Warm sand, ink labels | Translucent light (frosted, never dark) | **Bold ink navy `#0E1B2E`**, light labels |
| Type | Tight editorial tracking | Tight SF discipline, more air | ~6% larger base, heavier headings |
| Radius / shadow | 10px, soft warm | 14px squircle, soft diffuse | 8px crisp, deeper defined |

## Screenshots (real demo data — Marcus Rivera / Downtown Austin)

Per surface, four files: `__baseline` (current), `__A-refined`, `__B-ipados`,
`__C-operational` in `.rakow/evidence/RK-0006/`.

- `login__*` — sign-in card
- `pos-orders__*` — main POS order screen (order panel + full menu grid)
- `kds__*` — kitchen display (station rail loaded)
- `owner-dashboard__*` — role-based home / owner cockpit

**Note on KDS:** the kitchen display is intentionally **dark-locked** in the
token system (kitchen legibility under heat-lamp glare). All three directions
therefore leave KDS essentially unchanged apart from accent color — this is
correct, not a miss. The directions differentiate the *light* surfaces, which is
where "childish" lives.

## Tradeoffs

- **A — Refined Professional** is the boldest answer to "childish." Warm neutrals
  + terracotta + editorial type read grown-up and premium in a way blue-on-white
  cannot. Risk: it is the largest departure from today's palette, and warm tones
  must be checked against the status colors (success/danger) for contrast — done
  here, but a full sweep should re-verify on data-dense tables.
- **B — Apple iPadOS Light** is the safest and most on-brand: it *is* the stated
  house standard, aligns 1:1 with the existing token intent, and needs the least
  QA. Risk: because today's UI already reaches for iPadOS, B can read as "the
  same thing but tidier" rather than a visible reset — it fixes the execution,
  not the identity.
- **C — High-Contrast Operational** wins on the floor: bigger type, saturated
  states, and the ink sidebar make hierarchy unmistakable during a rush. Risk: it
  optimizes for the line, not for the owner/marketing surfaces, and can feel
  utilitarian rather than premium on the dashboard.

## Recommendation

**Lead: A (Refined Professional)** — it most directly retires the "childish"
read and gives Sear a premium identity of its own instead of a cleaner blue.
**Safe alternative: B**, the codified standard, if Ian wants elevation without a
palette shift. **Strongest hybrid if there's appetite:** A's warmth + B's SF
type discipline — keep the terracotta/cream identity but adopt B's tighter
tracking and hairline restraint.

C is best reserved as an *operational mode* (a POS/KDS-only skin) rather than the
whole-app standard.

**Decision needed from Ian at 5pm:** pick A, B, C, or "A-warmth + B-discipline."
The winner is then promoted from `[data-theme]` to `:root` and drives the
screen-by-screen elevation sweep.

## How to preview live

With the flag-OFF layer merged, in any browser console on a logged-in session:

```js
document.documentElement.setAttribute('data-theme', 'refined')     // A
document.documentElement.setAttribute('data-theme', 'ipados')      // B
document.documentElement.setAttribute('data-theme', 'operational') // C
document.documentElement.removeAttribute('data-theme')             // back to baseline
```
