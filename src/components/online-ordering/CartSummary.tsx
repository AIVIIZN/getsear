'use client'

import { ShoppingBag, Trash2, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  modifiers: Array<{ option_name: string; option_price: number }>
  subtotal: number
}

interface CartSummaryProps {
  items: CartItem[]
  onUpdateQuantity: (cartItemId: string, quantity: number) => void
  onRemove: (cartItemId: string) => void
  onCheckout: () => void
}

export function CartSummary({ items, onUpdateQuantity, onRemove, onCheckout }: CartSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg safe-area-bottom">
      <div className="max-w-lg mx-auto px-4 py-3">
        {/* Expandable cart items */}
        <div className="max-h-40 overflow-y-auto mb-3 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                    className="h-6 w-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="font-medium w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="h-6 w-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="font-medium">${(item.subtotal / 100).toFixed(2)}</span>
                <button
                  onClick={() => onRemove(item.id)}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout Button */}
        <Button
          onClick={onCheckout}
          className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base rounded-xl"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Checkout ({itemCount} item{itemCount !== 1 ? 's' : ''}) &mdash; ${(total / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  )
}
