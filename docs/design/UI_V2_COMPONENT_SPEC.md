# Sear POS UI v2 Component Spec

**Source of truth for shipped and future Sear UI components.** Tokens live in `src/styles/tokens.css`; component and app code must consume semantic or component tokens only.

## Enforcement Contract

1. **No raw color values outside token source.** Component, app, story, and spec examples must use `var(--color-*)`, `var(--space-*)`, `var(--type-*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--ease-*)`, and `var(--duration-*)`.
2. **Token layers are load-bearing.** Primitive tokens define values, semantic tokens define purpose, and component tokens define local overrides. Components must not reference primitives unless a semantic alias does not exist yet.
3. **State coverage is mandatory.** Every interactive component documents default, hover, focus-visible, active, disabled, and loading where relevant.
4. **Touch targets are real constraints.** POS, KDS, and tablet controls use `min-height: var(--touch-min)` or an equivalent tokenized size. Compact back-office controls may be smaller only when they are not primary touch actions.
5. **Focus cannot disappear.** Focus-visible treatment uses `var(--color-border-focus)` in light surfaces and the KDS focus token mapping inside `.kds-dark`.
6. **Motion uses timing tokens.** Hover/focus use `var(--duration-quick) var(--ease-out)`. Press feedback uses `var(--duration-instant) var(--ease-out)`. Modal, sheet, toast, and menu entrances use `var(--duration-base) var(--ease-spring)`.
7. **No placeholder behavior.** If a component exposes an action state, the action must either perform real work or be absent. Loading and disabled states must represent actual async or permission conditions.
8. **Dark mode is KDS-only.** KDS roots use `.kds-dark`; normal POS and back-office surfaces stay light-first.

## Token Governance for Queue Agents

- Treat `scripts/validate-no-raw-hex.mjs` as a shipping gate, not advisory output. A feature is incomplete if the guard reports any new violation in `src/components/**` or `src/app/**`.
- Add new raw values only in `src/styles/tokens.css`, then expose them through semantic or component tokens before using them in UI code.
- Do not work around the guard by moving colors into local constants, comments, chart arrays, inline style objects, or generated class strings. Those are still UI color decisions and must use tokens.
- Keep visual intent when migrating colors. KDS urgency, table status, report series, marketing gradients, and destructive/success states need distinct semantic tokens rather than a generic primary fallback.
- Before opening a PR that touches UI, run `npm run lint:raw-hex` and inspect at least the affected surface in a browser or screenshot pass.

## Universal State Matrix

| State | Required treatment | Token pattern |
| --- | --- | --- |
| Default | Stable base surface, text, border, and elevation | `var(--color-surface)`, `var(--color-text)`, `var(--color-border)` |
| Hover | Visible color or elevation shift without layout movement | `var(--color-surface-hover)` or component hover token |
| Focus-visible | 2px outline or ring with 2px offset | `var(--color-border-focus)` |
| Active | Pressed color or scale feedback | `var(--color-surface-active)` and `.btn-press` when applicable |
| Disabled | Reduced affordance, no pointer events, no hover override | disabled token pattern, not ad hoc opacity |
| Loading | Spinner, skeleton, or progress affordance; label remains stable | status or component loading token |
| Error | Border, text, and helper copy reflect the error | `var(--color-danger)`, `var(--color-danger-bg)` |
| Empty | Designed empty message and next valid action | surface, muted text, optional icon token |

## Component Contracts

### Button

| Variant | Default | Hover | Active | Disabled | Loading |
| --- | --- | --- | --- | --- | --- |
| Primary | `--color-primary` background, `--color-text-on-primary` text | `--color-primary-hover` | `--color-primary-active` | muted surface and muted text | spinner plus unchanged label |
| Secondary | transparent or surface background, strong border | surface hover | surface active | muted border and text | spinner in leading slot |
| Ghost | transparent, text color | surface hover | surface active | muted text | spinner replaces leading icon |
| Destructive | `--color-danger-strong` background | danger hover semantic token | danger active semantic token | muted danger affordance | spinner plus unchanged label |

- Sizes: `sm` for dense back-office, `md` for default back-office, `lg` for POS default, `xl` for primary POS CTAs.
- Icon-only buttons must have accessible labels and square tokenized dimensions.
- Focus ring is always visible and outside the visual border.

Example:

```tsx
<Button
  className="bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)]"
  isLoading={isSaving}
>
  Save order
</Button>
```

### Card

| Variant | Default | Hover | Active | Disabled or inactive |
| --- | --- | --- | --- | --- |
| Flat | surface plus border | surface hover | surface active | muted text |
| Elevated | surface plus low shadow | mid shadow | low shadow plus active surface | reduced affordance |
| Interactive | flat or elevated plus button semantics | hover surface and focus ring | press feedback | no pointer events |

- Radius: `var(--radius-md)` unless the component has a documented shape token.
- Padding: compact, default, and spacious map to spacing tokens only.
- Cards are for individual records, repeated items, modals, and framed tools. Page sections must not be styled as nested cards.

### Modal and Sheet

| Part | Modal contract | Sheet contract |
| --- | --- | --- |
| Backdrop | `.frosted-backdrop` tokenized blur and surface fill | same as modal |
| Container | radius `var(--radius-lg)`, `var(--shadow-modal)` | radius on exposed corners, `var(--shadow-modal)` |
| Entry | scale and fade using spring timing | slide from anchor using spring timing |
| Header | title, optional description, close icon button | title, optional description, close icon button |
| Body | scrollable when content exceeds viewport | scrollable, safe-area aware |
| Footer | secondary then primary action order | sticky only when long content needs it |

States:

- Default: surface background, strong text, border where required.
- Focus-visible: first actionable control receives focus on open.
- Disabled: blocked submit action remains visible only with a reason.
- Loading: primary action shows loading while body remains readable.
- Error: inline alert appears above footer or near the affected field.

### Input Family

Applies to text, email, number, select, textarea, checkbox, radio, toggle, segmented control, and slider.

| State | Text/select/textarea | Checkbox/radio/toggle | Slider |
| --- | --- | --- | --- |
| Default | surface background, border, label, helper slot | border plus checked semantic token | muted track and primary filled range |
| Hover | stronger border | stronger border or thumb emphasis | thumb emphasis |
| Focus-visible | focus ring and border focus token | focus ring around control | focus ring around thumb |
| Error | danger border, danger helper text | danger border, error helper | danger helper below control group |
| Disabled | muted surface, muted label | muted control, no pointer events | muted range, no pointer events |
| Read-only | normal text with non-editable cursor | not applicable | not applicable |

- Required indicator uses `var(--color-danger)`.
- Placeholder text uses muted text tokens, KDS placeholder tokens inside `.kds-dark`.
- Segmented controls must expose active, hover, focus-visible, disabled, and loading states for async mode changes.

### Tabs and Segmented Navigation

| Variant | Default | Hover | Active | Disabled |
| --- | --- | --- | --- | --- |
| Line tabs | muted text, transparent background | surface hover | primary underline and strong text | muted text |
| Segmented | muted container background | surface hover | active pill with low shadow | muted text |
| KDS station tabs | KDS surface, KDS muted text | KDS hover surface | KDS active surface and strong text | KDS disabled text |

- Underlines and pills animate with tokenized duration.
- Active state cannot rely on color alone; include position, underline, pill, or border treatment.

### Badge and Status Pill

| Variant | Background | Text | Border | Use |
| --- | --- | --- | --- | --- |
| Neutral | muted surface | muted or strong text | border token | metadata |
| Success | success background | success text | optional success border | healthy states |
| Warning | warning background | warning text | optional warning border | attention states |
| Danger | danger background | danger text | optional danger border | blocking states |
| Primary | primary soft background | primary text | optional primary border | selected or featured states |
| KDS priority | KDS priority token | KDS text token | KDS border token | rush, refire, VIP |

- Pills must remain legible at caption size.
- Status copy must be explicit; color alone is not sufficient.

### Toast and Notification

| Variant | Role | Background | Text | Duration |
| --- | --- | --- | --- | --- |
| Success | `status` | success background | success text | short |
| Info | `status` | primary soft background | primary text | short |
| Warning | `alert` | warning background | warning text | medium |
| Danger | `alert` | danger background | danger text | medium |

- Desktop position: top-right. Mobile position: top-center.
- Max visible stack: three. Older toasts queue.
- Dismiss control is an icon button with focus-visible state.
- No toast may replace a real implementation.

### Table and Data Grid

| Element | Default | Hover | Selected | Error or warning |
| --- | --- | --- | --- | --- |
| Header | muted surface, strong text | not applicable | not applicable | not applicable |
| Row | surface background | surface hover | primary soft background plus selected border | status background plus icon/copy |
| Cell | body text | inherited | inherited | status text where relevant |
| Empty state | designed message and primary action | not applicable | not applicable | not applicable |

- Numeric cells align consistently and use tabular figures when available.
- Sorting, filtering, pagination, and row actions must have keyboard-visible focus states.
- Skeleton rows use the shared skeleton token pattern.

## Surface-Specific Component Specs

### KDS Ticket and Card

KDS components run only under `.kds-dark` and must use `--color-kds-*` tokens.

| Part | Default | Aging | Late | Critical |
| --- | --- | --- | --- | --- |
| Ticket surface | `--color-kds-ticket-bg` | `--color-kds-ticket-bg-aging` | `--color-kds-ticket-bg-late` | `--color-kds-ticket-bg-critical` |
| Aging accent | `--color-kds-aging-fresh` | `--color-kds-aging-aging` | `--color-kds-aging-late` | `--color-kds-aging-critical` |
| Text | `--color-kds-text` | same | same | same |
| Metadata | `--color-kds-text-muted` | same | same | same |
| Border | `--color-kds-border` | age accent | age accent | age accent |

Priority and event states:

- Refire: `var(--color-kds-priority-refire)`.
- Rush: `var(--color-kds-priority-rush)`.
- VIP: `var(--color-kds-priority-vip)` with `var(--color-kds-priority-vip-fg)`.
- Allergen: `var(--color-kds-priority-allergen)`.
- Input fields: `var(--color-kds-input-bg)` and `var(--color-kds-placeholder)`.

Example:

```tsx
<article className="border bg-[var(--color-kds-ticket-bg-critical)] text-[var(--color-kds-text)]">
  <span className="text-[var(--color-kds-aging-critical)]">Critical</span>
</article>
```

### Marketing CTA Modules

| Part | Default | Hover | Active | Disabled or unavailable |
| --- | --- | --- | --- | --- |
| CTA container | marketing background token | no layout shift | no layout shift | muted treatment |
| Primary CTA | marketing accent token | marketing accent hover token | marketing accent active token | muted surface |
| Secondary CTA | surface or transparent | surface hover | surface active | muted border |
| Proof badge | primary or success soft token | none unless clickable | none unless clickable | muted text |

- Marketing surfaces may use marketing semantic tokens but never hue-named primitives.
- Gradients must be composed from semantic marketing tokens.
- CTA copy and buttons must map to live routes or working forms.

### Report and Chart Cards

| Part | Default | Hover | Active/selected | Empty |
| --- | --- | --- | --- | --- |
| Card surface | report/card surface token or shared surface | surface hover | selected border and shadow | designed empty state |
| KPI status | success, warning, danger, or primary semantic token | no layout shift | selected token state | muted text |
| Chart series | chart semantic token set | highlighted series token | selected series token | skeleton or empty chart message |
| Legend | muted text plus series swatch token | row hover when interactive | selected series emphasis | hidden if no data |

- Chart color arrays must be defined as semantic token references or CSS variable lookups.
- Do not encode business meaning only in color; include label, trend arrow, or status text.
- Loading charts use skeleton containers with stable dimensions.

### Floor-Plan and Table Surfaces

| Table state | Surface token | Border token | Text token |
| --- | --- | --- | --- |
| Available | table/floor neutral token or shared surface | table neutral border | text |
| Seated | table active or primary soft token | primary border | text |
| Needs attention | warning background | warning border | warning text |
| Blocked or dirty | danger background | danger border | danger text |
| Selected | selected table surface | focus or primary border | strong text |

- Floor-plan sections use semantic section tokens, not inline swatches.
- Drag handles, resize handles, and selected rings must remain visible on tablet.
- Status color must be paired with table label, icon, or status text.

## File Conventions

- One component per file. Filename matches component name.
- Default export the component; named exports are allowed for sub-parts.
- Co-locate stories in `<Component>.stories.tsx` where the component family already uses stories.
- Compound components use subfolders such as `inputs/Text.tsx`.
- Public props are typed, ref-forwarded when wrapping native elements, and accept `className`.
- Use `cn()` from `src/lib/utils` for composition.

## Scanner-Safe Example Pattern

Use semantic variables in CSS, class strings, and inline style objects:

```tsx
const style = {
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text)',
  borderColor: 'var(--color-border)',
} satisfies React.CSSProperties
```

Do not include raw color literals in examples, comments, story args, or markdown snippets. If a new color is required, add it to `src/styles/tokens.css` as a semantic token first, then reference the token here.
