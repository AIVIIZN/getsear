'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Gift, Plus, Pencil, Trash2, Loader2, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Reward {
  id: string
  name: string
  description: string
  points_cost: number
  type: 'free_item' | 'discount_pct' | 'dollar_off'
  value: number
  is_active: boolean
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  free_item: 'Free Item',
  discount_pct: 'Discount %',
  dollar_off: 'Dollar Off',
}

export function RewardsCatalog() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editReward, setEditReward] = useState<Reward | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPoints, setFormPoints] = useState('')
  const [formType, setFormType] = useState<string>('free_item')
  const [formValue, setFormValue] = useState('')
  const [formActive, setFormActive] = useState(true)

  const fetchRewards = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/loyalty/programs')
      const json = await res.json()
      // Extract rewards from program data
      const programData = json.data?.[0] ?? json.data
      if (programData?.rewards) {
        setRewards(programData.rewards)
      }
    } catch {
      toast.error('Failed to load rewards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRewards()
  }, [fetchRewards])

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormPoints('')
    setFormType('free_item')
    setFormValue('')
    setFormActive(true)
  }

  const openEdit = (reward: Reward) => {
    setEditReward(reward)
    setFormName(reward.name)
    setFormDesc(reward.description)
    setFormPoints(reward.points_cost.toString())
    setFormType(reward.type)
    setFormValue(reward.value.toString())
    setFormActive(reward.is_active)
    setShowCreate(true)
  }

  const handleSave = async () => {
    if (!formName || !formPoints) {
      toast.error('Name and points cost are required')
      return
    }

    setSaving(true)
    try {
      const body = {
        name: formName,
        description: formDesc,
        points_cost: parseInt(formPoints),
        type: formType,
        value: parseFloat(formValue) || 0,
        is_active: formActive,
      }

      const url = editReward
        ? `/api/loyalty/programs/${editReward.id}/rewards`
        : '/api/loyalty/programs/rewards'
      const method = editReward ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editReward ? 'Reward updated' : 'Reward created')
        setShowCreate(false)
        setEditReward(null)
        resetForm()
        fetchRewards()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to save reward')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Gift className="h-4 w-4 text-green-500" />
          Rewards Catalog
        </h3>
        <Button
          size="sm"
          onClick={() => {
            resetForm()
            setEditReward(null)
            setShowCreate(true)
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Reward
        </Button>
      </div>

      {rewards.length === 0 ? (
        <Card className="border-warm shadow-warm">
          <CardContent className="py-12 text-center">
            <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No rewards configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create rewards that members can redeem with their points
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                resetForm()
                setShowCreate(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Reward
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => (
            <Card
              key={reward.id}
              className={`border-warm shadow-warm transition-all hover:shadow-md ${
                !reward.is_active ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <Star className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{reward.name}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {REWARD_TYPE_LABELS[reward.type] ?? reward.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(reward)}
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {reward.description && (
                  <p className="text-xs text-muted-foreground mb-3">{reward.description}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-sm font-bold text-orange-600">
                      {reward.points_cost.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    {reward.type === 'free_item'
                      ? 'Free Item'
                      : reward.type === 'discount_pct'
                        ? `${reward.value}% off`
                        : `$${reward.value.toFixed(2)} off`}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editReward ? 'Edit Reward' : 'Create Reward'}</SheetTitle>
            <SheetDescription>
              {editReward ? 'Update this reward' : 'Add a new reward to your catalog'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reward Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Free appetizer"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Get any appetizer for free"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Points Cost *</Label>
              <Input
                type="number"
                min="1"
                value={formPoints}
                onChange={(e) => setFormPoints(e.target.value)}
                placeholder="500"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reward Type</Label>
              <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_item">Free Item</SelectItem>
                  <SelectItem value="discount_pct">Discount Percentage</SelectItem>
                  <SelectItem value="dollar_off">Dollar Amount Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType !== 'free_item' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {formType === 'discount_pct' ? 'Discount %' : 'Dollar Amount'}
                </Label>
                <Input
                  type="number"
                  step={formType === 'discount_pct' ? '1' : '0.01'}
                  min="0"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={formType === 'discount_pct' ? '10' : '5.00'}
                  className="h-11"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-medium">Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false)
                setEditReward(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editReward ? 'Update' : 'Create'} Reward
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
