'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Crown, Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface Tier {
  name: string
  min_points: number
  earn_multiplier: number
  benefits: string[]
  color: string
}

const DEFAULT_TIERS: Tier[] = [
  { name: 'Bronze', min_points: 0, earn_multiplier: 1.0, benefits: ['Earn 1 point per dollar'], color: '#CD7F32' },
  { name: 'Silver', min_points: 500, earn_multiplier: 1.5, benefits: ['Earn 1.5x points', 'Birthday reward'], color: '#C0C0C0' },
  { name: 'Gold', min_points: 1500, earn_multiplier: 2.0, benefits: ['Earn 2x points', 'Birthday reward', 'Early access'], color: '#FFD700' },
  { name: 'Platinum', min_points: 5000, earn_multiplier: 3.0, benefits: ['Earn 3x points', 'Birthday reward', 'Early access', 'VIP events'], color: '#E5E4E2' },
]

export function TierEditor() {
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS)
  const [saving, setSaving] = useState(false)
  const [newBenefit, setNewBenefit] = useState<Map<number, string>>(new Map())

  const updateTier = (index: number, field: keyof Tier, value: string | number) => {
    const updated = [...tiers]
    if (field === 'benefits') return
    updated[index] = { ...updated[index], [field]: value }
    setTiers(updated)
  }

  const addBenefit = (tierIndex: number) => {
    const benefit = newBenefit.get(tierIndex)
    if (!benefit?.trim()) return
    const updated = [...tiers]
    updated[tierIndex] = {
      ...updated[tierIndex],
      benefits: [...updated[tierIndex].benefits, benefit.trim()],
    }
    setTiers(updated)
    const nb = new Map(newBenefit)
    nb.set(tierIndex, '')
    setNewBenefit(nb)
  }

  const removeBenefit = (tierIndex: number, benefitIndex: number) => {
    const updated = [...tiers]
    updated[tierIndex] = {
      ...updated[tierIndex],
      benefits: updated[tierIndex].benefits.filter((_, i) => i !== benefitIndex),
    }
    setTiers(updated)
  }

  const addTier = () => {
    const maxPoints = Math.max(...tiers.map((t) => t.min_points))
    setTiers([
      ...tiers,
      {
        name: 'New Tier',
        min_points: maxPoints + 1000,
        earn_multiplier: tiers.length + 1,
        benefits: [],
        color: '#888888',
      },
    ])
  }

  const removeTier = (index: number) => {
    if (tiers.length <= 1) {
      toast.error('Must have at least one tier')
      return
    }
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/loyalty/programs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      })
      if (res.ok) {
        toast.success('Tiers saved successfully')
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to save tiers')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          Tier Management
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Tier
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save Tiers
          </Button>
        </div>
      </div>

      {/* Visual Tier Progress */}
      <Card className="border-warm shadow-warm">
        <CardContent className="p-4">
          <div className="flex items-center gap-0">
            {tiers.map((tier, i) => {
              const nextTier = tiers[i + 1]
              const width = `${100 / tiers.length}%`
              return (
                <div key={i} className="flex-1 relative" style={{ width }}>
                  <div
                    className="h-3 rounded-full"
                    style={{
                      backgroundColor: tier.color,
                      opacity: 0.7,
                      marginRight: i < tiers.length - 1 ? '2px' : '0',
                    }}
                  />
                  <div className="mt-2 text-center">
                    <p className="text-xs font-semibold" style={{ color: tier.color }}>
                      {tier.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {tier.min_points.toLocaleString()} pts
                    </p>
                  </div>
                  {nextTier && (
                    <div className="absolute -right-1 top-0 w-px h-3 bg-white" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier, index) => (
          <Card key={index} className="border-warm shadow-warm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tier.color }} />
                  {tier.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTier(index)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tier Name</Label>
                  <Input
                    value={tier.name}
                    onChange={(e) => updateTier(index, 'name', e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tier.color}
                      onChange={(e) => updateTier(index, 'color', e.target.value)}
                      className="h-9 w-9 rounded border cursor-pointer"
                    />
                    <Input
                      value={tier.color}
                      onChange={(e) => updateTier(index, 'color', e.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tier.min_points}
                    onChange={(e) => updateTier(index, 'min_points', parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Earn Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={tier.earn_multiplier}
                    onChange={(e) => updateTier(index, 'earn_multiplier', parseFloat(e.target.value) || 1)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Benefits</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tier.benefits.map((benefit, bi) => (
                    <Badge
                      key={bi}
                      variant="outline"
                      className="text-xs pr-1 cursor-pointer hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeBenefit(index, bi)}
                    >
                      {benefit}
                      <span className="ml-1 text-[10px]">x</span>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newBenefit.get(index) ?? ''}
                    onChange={(e) => {
                      const nb = new Map(newBenefit)
                      nb.set(index, e.target.value)
                      setNewBenefit(nb)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addBenefit(index)}
                    placeholder="Add benefit..."
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addBenefit(index)}
                    className="h-8 px-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
