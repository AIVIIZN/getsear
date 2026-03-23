'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TipPoolModelCard } from './TipPoolModelCard'
import type { TipPoolModel } from '@/lib/staff/tip-pool-calculator'

const MODELS: { model: TipPoolModel; title: string; description: string }[] = [
  { model: 'direct', title: 'Direct', description: 'Server keeps 100% of their tips. Simplest model.' },
  { model: 'tipout_sales', title: 'Tip-out by % of Sales', description: 'Servers tip out a percentage of net sales to support staff.' },
  { model: 'pool_hours', title: 'Tip Pool by Hours', description: 'All tips pooled and split proportionally by hours worked.' },
  { model: 'hybrid_points', title: 'Hybrid (Points)', description: 'Tips split by weighted point values per role.' },
]

const ELIGIBLE_ROLES = [
  { value: 'server', label: 'Server' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'host', label: 'Host' },
  { value: 'busser', label: 'Busser' },
  { value: 'runner', label: 'Runner' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'kitchen', label: 'Kitchen (BOH)' },
]

export function TipPoolConfig() {
  const [model, setModel] = useState<TipPoolModel>('direct')
  const [busserPct, setBusserPct] = useState(3)
  const [barPct, setBarPct] = useState(1)
  const [runnerPct, setRunnerPct] = useState(1)
  const [pointValues, setPointValues] = useState<Record<string, number>>({
    server: 10, bartender: 8, busser: 5, runner: 3, host: 2,
  })
  const [eligibleRoles, setEligibleRoles] = useState<string[]>([
    'server', 'bartender', 'host', 'busser', 'runner', 'cashier',
  ])
  const [includeBoh, setIncludeBoh] = useState(false)
  const [deductFee, setDeductFee] = useState(false)
  const [feePct, setFeePct] = useState(2.49)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/staff/tip-pool-config?location_id=default')
        if (res.ok) {
          const json = await res.json()
          const data = json.data
          if (data.model) setModel(data.model)
          if (data.tipoutPercentages) {
            setBusserPct(data.tipoutPercentages.busser ?? 3)
            setBarPct(data.tipoutPercentages.bar ?? 1)
            setRunnerPct(data.tipoutPercentages.runner ?? 1)
          }
          if (data.pointValues) setPointValues(data.pointValues)
          if (data.eligibleRoles) setEligibleRoles(data.eligibleRoles)
          if (data.includeBoh !== undefined) setIncludeBoh(data.includeBoh)
          if (data.deductProcessingFee !== undefined) setDeductFee(data.deductProcessingFee)
          if (data.processingFeePct !== undefined) setFeePct(data.processingFeePct)
        }
      } catch { /* silent */ }
      setLoaded(true)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/staff/tip-pool-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: 'default',
          model,
          tipout_busser_pct: busserPct,
          tipout_bar_pct: barPct,
          tipout_runner_pct: runnerPct,
          point_values: pointValues,
          eligible_roles: eligibleRoles,
          include_boh: includeBoh,
          deduct_processing_fee: deductFee,
          processing_fee_pct: feePct,
        }),
      })

      if (res.ok) {
        toast.success('Tip pool configuration saved')
      } else {
        toast.error('Failed to save')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (role: string) => {
    setEligibleRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  if (!loaded) {
    return <div className="animate-pulse space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Model selection */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Tip Distribution Model</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODELS.map((m) => (
            <TipPoolModelCard
              key={m.model}
              model={m.model}
              title={m.title}
              description={m.description}
              isSelected={model === m.model}
              onSelect={() => setModel(m.model)}
            />
          ))}
        </div>
      </div>

      {/* Model-specific config */}
      {model === 'tipout_sales' && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Tip-out Percentages (% of Net Sales)</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Busser %</Label>
              <Input
                type="number" step="0.5" min="0" max="100"
                value={busserPct} onChange={(e) => setBusserPct(parseFloat(e.target.value) || 0)}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bar %</Label>
              <Input
                type="number" step="0.5" min="0" max="100"
                value={barPct} onChange={(e) => setBarPct(parseFloat(e.target.value) || 0)}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Runner %</Label>
              <Input
                type="number" step="0.5" min="0" max="100"
                value={runnerPct} onChange={(e) => setRunnerPct(parseFloat(e.target.value) || 0)}
                className="h-10"
              />
            </div>
          </div>
        </div>
      )}

      {model === 'hybrid_points' && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Point Values per Role</h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {Object.entries(pointValues).map(([role, pts]) => (
              <div key={role} className="space-y-1">
                <Label className="text-xs capitalize">{role}</Label>
                <Input
                  type="number" step="1" min="0" max="100"
                  value={pts}
                  onChange={(e) =>
                    setPointValues((prev) => ({ ...prev, [role]: parseInt(e.target.value) || 0 }))
                  }
                  className="h-10"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eligible roles */}
      {model !== 'direct' && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Eligible Roles</h4>
          <div className="flex flex-wrap gap-2">
            {ELIGIBLE_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRole(r.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  eligibleRoles.includes(r.value)
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* FLSA Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Managers and owners cannot participate in tip pools under federal law (FLSA).
              They are automatically excluded.
            </p>
          </div>

          {/* BOH toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">Include Back-of-House</p>
              <p className="text-xs text-muted-foreground">
                Only legal if you do NOT take a tip credit
              </p>
            </div>
            <Switch checked={includeBoh} onCheckedChange={setIncludeBoh} />
          </div>
        </div>
      )}

      {/* Processing fee */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border">
        <div className="flex-1">
          <p className="text-sm font-medium">Deduct Processing Fee from Card Tips</p>
          <p className="text-xs text-muted-foreground">
            Deducts card processing fee before distribution
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deductFee && (
            <Input
              type="number" step="0.01" min="0" max="10"
              value={feePct}
              onChange={(e) => setFeePct(parseFloat(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
              placeholder="%"
            />
          )}
          <Switch checked={deductFee} onCheckedChange={setDeductFee} />
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Configuration
      </Button>
    </div>
  )
}
