'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Store, Clock, MapPin, Loader2 } from 'lucide-react'
import { PublicMenuGrid } from '@/components/online-ordering/PublicMenuGrid'
import { CartSummary } from '@/components/online-ordering/CartSummary'

interface LocationData {
  id: string
  name: string
  slug: string
  address: string
  phone: string
}

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category_name: string
  image_url: string | null
  modifiers: Array<{
    id: string
    name: string
    options: Array<{ id: string; name: string; price: number }>
    required: boolean
  }>
  is_available: boolean
}

interface CartItem {
  id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  modifiers: Array<{
    modifier_id: string
    modifier_name: string
    option_id: string
    option_name: string
    option_price: number
  }>
  subtotal: number
  special_instructions: string
}

export default function PublicOrderPage() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params?.slug ?? '')

  const [location, setLocation] = useState<LocationData | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch(`/api/online-ordering/public/menu?slug=${slug}`)
      const json = await res.json()
      if (res.ok) {
        setLocation(json.data.location)
        setItems(json.data.items)
        setCategories(json.data.categories)
      } else {
        setError(json.error ?? 'Restaurant not found')
      }
    } catch {
      setError('Unable to load menu')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchMenu()
  }, [fetchMenu])

  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    modifiers: CartItem['modifiers'],
    instructions: string
  ) => {
    const modTotal = modifiers.reduce((sum, m) => sum + m.option_price, 0)
    const subtotal = (item.price + modTotal) * quantity
    const cartItem: CartItem = {
      id: `${item.id}-${Date.now()}`,
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      quantity,
      modifiers,
      subtotal,
      special_instructions: instructions,
    }
    setCart((prev) => [...prev, cartItem])
  }

  const handleUpdateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== cartItemId))
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.id === cartItemId
            ? {
                ...item,
                quantity,
                subtotal: (item.price + item.modifiers.reduce((s, m) => s + m.option_price, 0)) * quantity,
              }
            : item
        )
      )
    }
  }

  const handleRemove = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== cartItemId))
  }

  const handleCheckout = () => {
    // Store cart in sessionStorage for checkout page
    sessionStorage.setItem('sear-cart', JSON.stringify(cart))
    sessionStorage.setItem('sear-location', JSON.stringify(location))
    router.push(`/order/${slug}/cart`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading menu...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <Store className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Restaurant Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-32">
      {/* Restaurant Header */}
      <div className="bg-gradient-to-b from-orange-50 to-white px-4 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{location?.name}</h1>
        {location?.address && (
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {location.address}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            Open
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~30 min
          </span>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-2">
        <PublicMenuGrid
          items={items}
          categories={categories}
          onAddToCart={handleAddToCart}
        />
      </div>

      {/* Cart */}
      <CartSummary
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />
    </div>
  )
}
