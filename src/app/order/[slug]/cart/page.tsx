'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ShoppingBag, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CartItem {
  id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  modifiers: Array<{
    modifier_id: string
    option_id: string
    option_name: string
    option_price: number
  }>
  subtotal: number
  special_instructions: string
}

interface LocationData {
  id: string
  name: string
  slug: string
}

export default function CartPage() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params?.slug ?? '')

  const [cart, setCart] = useState<CartItem[]>([])
  const [location, setLocation] = useState<LocationData | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cartData = sessionStorage.getItem('sear-cart')
    const locationData = sessionStorage.getItem('sear-location')
    if (cartData) setCart(JSON.parse(cartData))
    if (locationData) setLocation(JSON.parse(locationData))
  }, [])

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length >= 7) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    if (digits.length >= 4) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return digits
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (phone.replace(/\D/g, '').length < 10) { setError('Valid phone number required'); return }
    if (cart.length === 0) { setError('Cart is empty'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/online-ordering/public/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_slug: slug,
          customer_name: name,
          customer_phone: phone.replace(/\D/g, ''),
          order_type: orderType,
          items: cart.map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            modifiers: item.modifiers.map((m) => ({
              modifier_id: m.modifier_id,
              option_id: m.option_id,
            })),
            special_instructions: item.special_instructions || undefined,
          })),
          notes: notes || undefined,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        sessionStorage.setItem('sear-order-confirmation', JSON.stringify(json.data))
        sessionStorage.removeItem('sear-cart')
        router.push(`/order/${slug}/confirmation`)
      } else if (res.status === 429) {
        setError(json.error)
      } else {
        setError(json.error ?? 'Failed to place order')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold">Checkout</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Order Items */}
        <div>
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Your Order</h2>
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between py-2 border-b border-gray-100">
              <div>
                <p className="font-medium text-sm">{item.quantity}x {item.name}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {item.modifiers.map((m) => m.option_name).join(', ')}
                  </p>
                )}
              </div>
              <span className="font-medium text-sm">${(item.subtotal / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between py-3 font-bold">
            <span>Total</span>
            <span className="text-blue-600">${(total / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Order Type */}
        <div>
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Order Type</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['pickup', 'delivery'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`p-3 rounded-xl border text-center capitalize font-medium transition-colors ${
                  orderType === type
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Your Info</h2>
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-12 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Phone *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 123-4567"
              className="h-12 mt-1"
              inputMode="tel"
            />
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests?"
              className="mt-1 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          className="w-full h-14 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg rounded-xl"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <ShoppingBag className="h-5 w-5 mr-2" />
          )}
          Place Order &mdash; ${(total / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  )
}
