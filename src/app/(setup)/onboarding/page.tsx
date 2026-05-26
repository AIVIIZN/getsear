'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, Flame, MapPin, Monitor, Pencil, Store, User, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tour } from '@/components/onboarding/Tour'
import { MENU_SEED_TEMPLATES } from '@/lib/onboarding/menu-templates'
import {
  DEFAULT_ONBOARDING_PROGRESS,
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY,
  buildOnboardingSummary,
  markStepComplete,
  normalizePriceCents,
  type OnboardingLocation,
  type OnboardingMenuItem,
  type OnboardingOrg,
  type OnboardingProgress,
  type OnboardingTerminal,
} from '@/lib/onboarding/state-machine'
import { cn } from '@/lib/utils'

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Pacific/Honolulu',
]

const DEFAULT_SECTIONS = ['Dining Room', 'Bar', 'Patio']

export default function OnboardingPage() {
  const [progress, setProgress] = useState<OnboardingProgress>(DEFAULT_ONBOARDING_PROGRESS)
  const [saving, setSaving] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const summary = buildOnboardingSummary(progress)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (saved) setProgress(JSON.parse(saved) as OnboardingProgress)
    } catch {
      setProgress(DEFAULT_ONBOARDING_PROGRESS)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progress))
    void fetch('/api/setup/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    }).catch(() => undefined)
  }, [progress])

  const updateProgress = useCallback((stepIndex: number, data: Partial<OnboardingProgress['data']>) => {
    setProgress((current) => markStepComplete(current, stepIndex, data))
  }, [])

  const goToStep = useCallback((stepIndex: number) => {
    setProgress((current) => ({ ...current, current_step: stepIndex }))
  }, [])

  const commitOnboarding = useCallback(async () => {
    setSaving(true)
    setCommitError(null)
    try {
      const response = await fetch('/api/onboarding/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org: progress.data.org,
          location: progress.data.location,
          menu_template_id: progress.data.menu_template_id,
          menu_items: progress.data.menu_items,
          terminals: progress.data.terminals,
          first_user_confirmed: progress.data.first_user_confirmed,
          tour_completed: true,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Onboarding could not be completed.')
      }
      updateProgress(5, { tour_completed: true, tour_replay_enabled: true })
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : 'Onboarding could not be completed.')
    } finally {
      setSaving(false)
    }
  }, [progress.data, updateProgress])

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]">
              <Flame className="h-5 w-5 text-[var(--primary-foreground)]" />
            </div>
            <div>
              <h1 className="text-title-3 font-semibold text-[var(--foreground)]">Sear launch onboarding</h1>
              <p className="text-footnote text-[var(--muted-foreground)]">
                {summary.percent}% ready · {summary.menu_items} menu items · {summary.terminals} terminals
              </p>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {ONBOARDING_STEPS.map((step, index) => {
              const active = progress.current_step === index
              const complete = progress.completed_steps.includes(index)
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={cn(
                    'flex h-10 min-w-10 items-center justify-center rounded-xl text-footnote font-semibold transition-colors',
                    active && 'bg-[var(--primary)] text-[var(--primary-foreground)]',
                    complete && !active && 'bg-[var(--success-bg)] text-[var(--success)]',
                    !active && !complete && 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                  aria-label={step.label}
                >
                  {complete ? <Check className="h-4 w-4" /> : index + 1}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[280px_1fr] md:px-8">
        <aside className="space-y-3">
          {ONBOARDING_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(index)}
              className={cn(
                'w-full rounded-2xl border p-4 text-left transition-all',
                progress.current_step === index
                  ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-sm'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hover)]',
              )}
            >
              <div className="flex items-center gap-3">
                <StepIcon index={index} />
                <div>
                  <p className="text-callout font-semibold text-[var(--foreground)]">{step.label}</p>
                  <p className="text-caption-1 text-[var(--muted-foreground)]">{step.description}</p>
                </div>
              </div>
            </button>
          ))}
        </aside>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-warm-md md:p-8">
          {progress.current_step === 0 && <OrgStep value={progress.data.org} onNext={(org) => updateProgress(0, { org })} />}
          {progress.current_step === 1 && (
            <LocationStep value={progress.data.location} onBack={() => goToStep(0)} onNext={(location) => updateProgress(1, { location })} />
          )}
          {progress.current_step === 2 && (
            <MenuSeedStep
              selectedId={progress.data.menu_template_id}
              items={progress.data.menu_items}
              onBack={() => goToStep(1)}
              onNext={(menu_template_id, menu_items) => updateProgress(2, { menu_template_id, menu_items })}
            />
          )}
          {progress.current_step === 3 && (
            <TerminalStep value={progress.data.terminals} onBack={() => goToStep(2)} onNext={(terminals) => updateProgress(3, { terminals })} />
          )}
          {progress.current_step === 4 && (
            <FirstUserStep org={progress.data.org} onBack={() => goToStep(3)} onNext={() => updateProgress(4, { first_user_confirmed: true })} />
          )}
          {progress.current_step === 5 && (
            <TourStep saving={saving} error={commitError} committed={Boolean(progress.data.tour_completed)} onBack={() => goToStep(4)} onCommit={commitOnboarding} />
          )}
        </div>
      </section>
    </main>
  )
}

function StepIcon({ index }: { index: number }) {
  const icons = [Store, MapPin, UtensilsCrossed, Monitor, User, Pencil]
  const Icon = icons[index] ?? Store
  return <Icon className="h-5 w-5 text-[var(--primary)]" />
}

function OrgStep({ value, onNext }: { value?: Partial<OnboardingOrg>; onNext: (value: OnboardingOrg) => void }) {
  const [form, setForm] = useState<OnboardingOrg>({
    name: value?.name ?? '',
    owner_name: value?.owner_name ?? '',
    owner_email: value?.owner_email ?? '',
    owner_phone: value?.owner_phone ?? '',
  })
  const valid = form.name && form.owner_name && form.owner_email.includes('@') && form.owner_phone.length >= 7
  return (
    <StepShell title="Name the restaurant" description="This becomes the organization record owners see across settings, receipts, and reports.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Restaurant name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <TextInput label="Owner name" value={form.owner_name} onChange={(owner_name) => setForm({ ...form, owner_name })} />
        <TextInput label="Owner email" value={form.owner_email} onChange={(owner_email) => setForm({ ...form, owner_email })} />
        <TextInput label="Owner phone" value={form.owner_phone} onChange={(owner_phone) => setForm({ ...form, owner_phone })} />
      </div>
      <FooterNav nextDisabled={!valid} onNext={() => onNext(form)} />
    </StepShell>
  )
}

function LocationStep({ value, onBack, onNext }: { value?: Partial<OnboardingLocation>; onBack: () => void; onNext: (value: OnboardingLocation) => void }) {
  const [form, setForm] = useState<OnboardingLocation>({
    name: value?.name ?? 'Main Location',
    address_line1: value?.address_line1 ?? '',
    city: value?.city ?? '',
    state: value?.state ?? '',
    zip: value?.zip ?? '',
    timezone: value?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    sections: value?.sections ?? DEFAULT_SECTIONS,
  })
  const valid = form.name && form.address_line1 && form.city && form.state && form.zip && form.sections.length > 0
  return (
    <StepShell title="Configure the first location" description="Dining sections seed the first floor-plan defaults and help new operators understand service zones.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Location name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <TextInput label="Street address" value={form.address_line1} onChange={(address_line1) => setForm({ ...form, address_line1 })} />
        <TextInput label="City" value={form.city} onChange={(city) => setForm({ ...form, city })} />
        <TextInput label="State" value={form.state} onChange={(state) => setForm({ ...form, state: state.toUpperCase().slice(0, 2) })} />
        <TextInput label="ZIP" value={form.zip} onChange={(zip) => setForm({ ...form, zip })} />
        <label className="space-y-1.5">
          <span className="text-footnote font-medium text-[var(--foreground)]">Timezone</span>
          <select className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-body text-[var(--foreground)]" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>
            {US_TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
          </select>
        </label>
      </div>
      <SectionEditor sections={form.sections} onChange={(sections) => setForm({ ...form, sections })} />
      <FooterNav onBack={onBack} nextDisabled={!valid} onNext={() => onNext(form)} />
    </StepShell>
  )
}

function MenuSeedStep({ selectedId, items, onBack, onNext }: { selectedId?: string; items?: OnboardingMenuItem[]; onBack: () => void; onNext: (id: string, items: OnboardingMenuItem[]) => void }) {
  const initial = selectedId ?? MENU_SEED_TEMPLATES[0].id
  const [templateId, setTemplateId] = useState(initial)
  const template = MENU_SEED_TEMPLATES.find((entry) => entry.id === templateId) ?? MENU_SEED_TEMPLATES[0]
  const [draftItems, setDraftItems] = useState<OnboardingMenuItem[]>(items ?? template.items)
  const categories = new Set(draftItems.map((item) => item.category))

  const chooseTemplate = useCallback((id: string) => {
    const next = MENU_SEED_TEMPLATES.find((entry) => entry.id === id) ?? MENU_SEED_TEMPLATES[0]
    setTemplateId(next.id)
    setDraftItems(next.items)
  }, [])

  return (
    <StepShell title="Seed a real launch menu" description="Pick one of six editable restaurant templates. Every template includes at least 40 priced items with modifiers.">
      <div className="grid gap-3 md:grid-cols-3">
        {MENU_SEED_TEMPLATES.map((entry) => (
          <button key={entry.id} type="button" onClick={() => chooseTemplate(entry.id)} className={cn('rounded-2xl border p-4 text-left transition-all', entry.id === templateId ? 'border-[var(--primary)] bg-[var(--accent)]' : 'border-[var(--border)] bg-[var(--secondary)] hover:bg-[var(--card)]')}>
            <p className="text-callout font-semibold text-[var(--foreground)]">{entry.name}</p>
            <p className="mt-1 text-caption-1 text-[var(--muted-foreground)]">{entry.items.length} items · {new Set(entry.items.map((item) => item.category)).size} categories</p>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <p className="text-callout font-semibold text-[var(--foreground)]">{draftItems.length} editable items</p>
          <p className="text-footnote text-[var(--muted-foreground)]">{categories.size} categories</p>
        </div>
        <div className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto">
          {draftItems.map((item, index) => (
            <div key={`${item.name}-${index}`} className="grid gap-3 p-4 md:grid-cols-[1fr_120px]">
              <TextInput label="Item" value={item.name} onChange={(name) => setDraftItems((current) => replaceItem(current, index, { ...item, name }))} />
              <TextInput label="Price" value={(item.price_cents / 100).toFixed(2)} onChange={(price) => setDraftItems((current) => replaceItem(current, index, { ...item, price_cents: normalizePriceCents(Number(price) * 100) }))} />
              <TextInput label="Category" value={item.category} onChange={(category) => setDraftItems((current) => replaceItem(current, index, { ...item, category }))} />
              <TextInput label="First modifier" value={item.modifiers[0]?.name ?? ''} onChange={(name) => setDraftItems((current) => replaceItem(current, index, { ...item, modifiers: [{ name, price_cents: item.modifiers[0]?.price_cents ?? 0 }, ...item.modifiers.slice(1)] }))} />
            </div>
          ))}
        </div>
      </div>
      <FooterNav onBack={onBack} onNext={() => onNext(template.id, draftItems)} />
    </StepShell>
  )
}

function TerminalStep({ value, onBack, onNext }: { value?: OnboardingTerminal[]; onBack: () => void; onNext: (value: OnboardingTerminal[]) => void }) {
  const [terminals, setTerminals] = useState<OnboardingTerminal[]>(value?.length ? value : DEFAULT_ONBOARDING_PROGRESS.data.terminals ?? [])
  return (
    <StepShell title="Register starter terminals" description="Create named stations now. Devices can pair later without blocking first service.">
      <div className="space-y-3">
        {terminals.map((terminal, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--secondary)] p-4 md:grid-cols-[1fr_180px_120px]">
            <TextInput label="Terminal name" value={terminal.name} onChange={(name) => setTerminals((current) => replaceItem(current, index, { ...terminal, name }))} />
            <label className="space-y-1.5">
              <span className="text-footnote font-medium text-[var(--foreground)]">Type</span>
              <select className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-body" value={terminal.terminal_type} onChange={(event) => setTerminals((current) => replaceItem(current, index, { ...terminal, terminal_type: event.target.value as OnboardingTerminal['terminal_type'], default_view: event.target.value === 'kds' ? 'kds' : 'pos' }))}>
                <option value="server_station">Server station</option>
                <option value="bar">Bar</option>
                <option value="host">Host</option>
                <option value="cashier">Cashier</option>
                <option value="kds">KDS</option>
              </select>
            </label>
            <Button type="button" variant="outline" className="mt-6 h-12 rounded-xl" onClick={() => setTerminals((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={terminals.length === 1}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setTerminals((current) => [...current, { name: `Terminal ${current.length + 1}`, terminal_type: 'server_station', default_view: 'pos' }])}>Add terminal</Button>
      <FooterNav onBack={onBack} nextDisabled={terminals.some((terminal) => !terminal.name.trim())} onNext={() => onNext(terminals)} />
    </StepShell>
  )
}

function FirstUserStep({ org, onBack, onNext }: { org?: Partial<OnboardingOrg>; onBack: () => void; onNext: () => void }) {
  return (
    <StepShell title="Confirm the first owner user" description="The signed-in account becomes the owner who can invite managers, adjust billing, and replay onboarding.">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)] p-5">
        <p className="text-footnote font-semibold uppercase text-[var(--muted-foreground)]">Owner profile</p>
        <p className="mt-2 text-title-3 font-semibold text-[var(--foreground)]">{org?.owner_name || 'Current owner'}</p>
        <p className="text-body text-[var(--muted-foreground)]">{org?.owner_email || 'Signed-in account'}</p>
      </div>
      <FooterNav onBack={onBack} onNext={onNext} nextLabel="Confirm owner" />
    </StepShell>
  )
}

function TourStep({ saving, error, committed, onBack, onCommit }: { saving: boolean; error: string | null; committed: boolean; onBack: () => void; onCommit: () => void }) {
  return (
    <StepShell title="Learn the first order" description="Run the owner through the same eight-step tour they can replay later from Help.">
      <Tour onComplete={onCommit} />
      {error && <p className="rounded-xl bg-[var(--error-bg)] p-3 text-footnote text-[var(--error)]">{error}</p>}
      {committed && <p className="rounded-xl bg-[var(--success-bg)] p-3 text-footnote text-[var(--success)]">Onboarding is saved. The first-order tour is available for replay.</p>}
      <div className="flex justify-between">
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onBack}><ChevronLeft className="h-4 w-4" />Back</Button>
        <Button type="button" className="h-11 rounded-xl" disabled={saving || committed} onClick={onCommit}>{saving ? 'Saving...' : 'Save onboarding'}<ArrowRight className="h-4 w-4" /></Button>
      </div>
    </StepShell>
  )
}

function StepShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title-1 font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </div>
  )
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5">
      <span className="text-footnote font-medium text-[var(--foreground)]">{label}</span>
      <input className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-body text-[var(--foreground)] outline-none transition-shadow placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)]" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SectionEditor({ sections, onChange }: { sections: string[]; onChange: (sections: string[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-footnote font-medium text-[var(--foreground)]">Dining sections</p>
      <div className="flex flex-wrap gap-2">
        {sections.map((section, index) => (
          <input key={index} className="h-10 w-36 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 text-footnote" value={section} onChange={(event) => onChange(replaceItem(sections, index, event.target.value))} />
        ))}
        <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => onChange([...sections, 'New Section'])}>Add section</Button>
      </div>
    </div>
  )
}

function FooterNav({ onBack, onNext, nextDisabled = false, nextLabel = 'Continue' }: { onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="flex justify-between border-t border-[var(--border)] pt-5">
      <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onBack} disabled={!onBack}>
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>
      <Button type="button" className="h-11 rounded-xl" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function replaceItem<T>(items: T[], index: number, item: T): T[] {
  return items.map((current, currentIndex) => (currentIndex === index ? item : current))
}
