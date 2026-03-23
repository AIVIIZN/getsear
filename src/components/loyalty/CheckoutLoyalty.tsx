'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Star, Phone, Gift, Loader2, UserPlus, Check, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface LoyaltyMemberData {
  account_id: string
  customer_id: string
  customer_name: string
  phone: string
  points_balance: number
  tier: string
  total_earned: number
  total_redeemed: number
  available_rewards: Array<{
    id: string
    name: string
    points_cost: number
    type: string
    value: number
  }>
  recent_transactions: Array<{
    id: string
    type: string
    points: number
    description: string
    created_at: string
  }>
}

interface CheckoutLoyaltyProps {
  orderTotal: number // cents
  onApplyReward?: (reward: { id: string; name: string; type: string; value: number }) => void
  onMemberFound?: (member: LoyaltyMemberData) => void
}

const TIER_COLORS: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  Silver: 'bg-gray-100 text-gray-700 border-gray-300',
  Gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Platinum: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function CheckoutLoyalty({ orderTotal, onApplyReward, onMemberFound }: CheckoutLoyaltyProps) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<LoyaltyMemberData | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [appliedReward, setAppliedReward] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length >= 7) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length >= 4) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    }
    return digits
  }

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value))
    setMember(null)
    setNotFound(false)
    setIsNew(false)
  }

  const lookupMember = useCallback(async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      toast.error('Enter a 10-digit phone number')
      return
    }

    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch('/api/loyalty/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      })
      const json = await res.json()

      if (json.enrolled && json.data) {
        setMember(json.data)
        setEnrolled(true)
        onMemberFound?.(json.data)
      } else if (json.found) {
        // Customer exists but not enrolled
        setNotFound(false)
        setEnrolled(false)
        setMember(null)
      } else {
        setNotFound(true)
        setEnrolled(false)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [phone, onMemberFound])

  const handleEnroll = async () => {
    const digits = phone.replace(/\D/g, '')
    setEnrolling(true)
    try {
      const res = await fetch('/api/loyalty/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          order_total: orderTotal,
        }),
      })
      const json = await res.json()

      if (res.ok) {
        setIsNew(true)
        toast.success(
          json.data.is_new
            ? `Enrolled! ${json.data.points_earned ?? 0} points earned`
            : 'Member found!'
        )
        // Re-lookup to get full data
        await lookupMember()
      } else {
        toast.error(json.error ?? 'Failed to enroll')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setEnrolling(false)
    }
  }

  const handleApplyReward = (reward: LoyaltyMemberData['available_rewards'][0]) => {
    setAppliedReward(reward.id)
    onApplyReward?.({
      id: reward.id,
      name: reward.name,
      type: reward.type,
      value: reward.value,
    })
    toast.success(`Applied: ${reward.name}`)
  }

  const handleDismiss = () => {
    setPhone('')
    setMember(null)
    setNotFound(false)
    setIsNew(false)
    setEnrolled(false)
    setAppliedReward(null)
  }

  return (
    <Card className="border-warm shadow-warm">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold">Loyalty</span>
          </div>
          {member && (
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-7 w-7 p-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Phone Input */}
        {!member && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupMember()}
                placeholder="(555) 123-4567"
                className="pl-9 h-11"
                inputMode="tel"
              />
            </div>
            <Button onClick={lookupMember} disabled={loading} className="h-11">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look Up'}
            </Button>
          </div>
        )}

        {/* Not Found / Enroll */}
        {(notFound || (!enrolled && phone.replace(/\D/g, '').length >= 10 && !loading)) &&
          !member && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-sm font-medium text-orange-800">
                {notFound ? 'Not a member yet' : 'Not enrolled in loyalty'}
              </p>
              <p className="text-xs text-orange-600 mt-0.5 mb-2">
                Enroll now and earn points on this order
              </p>
              <Button
                size="sm"
                onClick={handleEnroll}
                disabled={enrolling}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {enrolling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                )}
                Enroll Now
              </Button>
            </div>
          )}

        {/* Member Found */}
        {member && (
          <div className="space-y-3">
            {/* Member Info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{member.customer_name}</p>
                <p className="text-xs text-muted-foreground">{member.phone}</p>
              </div>
              <Badge variant="outline" className={TIER_COLORS[member.tier] ?? ''}>
                {member.tier}
              </Badge>
            </div>

            {isNew && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-center">
                <Check className="h-4 w-4 text-green-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-green-800">Just enrolled!</p>
              </div>
            )}

            {/* Points Balance */}
            <div className="rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-3 text-center">
              <p className="text-xs text-orange-600 font-medium">Points Balance</p>
              <p className="text-3xl font-bold text-orange-600">
                {member.points_balance.toLocaleString()}
              </p>
            </div>

            {/* Available Rewards */}
            {member.available_rewards.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Available Rewards
                </p>
                {member.available_rewards.map((reward) => (
                  <button
                    key={reward.id}
                    onClick={() => handleApplyReward(reward)}
                    disabled={appliedReward === reward.id}
                    className={`w-full flex items-center justify-between rounded-lg border p-2.5 transition-all touch-target ${
                      appliedReward === reward.id
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-border hover:border-orange-300 hover:bg-orange-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-green-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{reward.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {reward.points_cost.toLocaleString()} points
                        </p>
                      </div>
                    </div>
                    {appliedReward === reward.id ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-xs font-medium text-orange-600">Apply</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
