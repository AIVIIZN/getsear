'use client'

import { useState } from 'react'
import { ShoppingCart, Plus, Minus, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'

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

interface PublicMenuGridProps {
  items: MenuItem[]
  categories: Array<{ id: string; name: string }>
  onAddToCart: (item: MenuItem, quantity: number, selectedModifiers: Array<{ modifier_id: string; modifier_name: string; option_id: string; option_name: string; option_price: number }>, instructions: string) => void
}

export function PublicMenuGrid({ items, categories, onAddToCart }: PublicMenuGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, { option_id: string; option_name: string; price: number }>>(new Map())
  const [instructions, setInstructions] = useState('')

  const filteredItems = activeCategory
    ? items.filter((i) => i.category_name === activeCategory)
    : items

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

  const handleSelectItem = (item: MenuItem) => {
    setSelectedItem(item)
    setQuantity(1)
    setSelectedModifiers(new Map())
    setInstructions('')
  }

  const handleModifierSelect = (modifierId: string, modifierName: string, optionId: string, optionName: string, price: number) => {
    const newMods = new Map(selectedModifiers)
    newMods.set(modifierId, { option_id: optionId, option_name: optionName, price })
    setSelectedModifiers(newMods)
  }

  const handleAddToCart = () => {
    if (!selectedItem) return
    const mods = Array.from(selectedModifiers.entries()).map(([modId, opt]) => {
      const mod = selectedItem.modifiers.find((m) => m.id === modId)
      return {
        modifier_id: modId,
        modifier_name: mod?.name ?? '',
        option_id: opt.option_id,
        option_name: opt.option_name,
        option_price: opt.price,
      }
    })
    onAddToCart(selectedItem, quantity, mods, instructions)
    setSelectedItem(null)
  }

  const itemTotal = selectedItem
    ? (selectedItem.price + Array.from(selectedModifiers.values()).reduce((sum, m) => sum + m.price, 0)) * quantity
    : 0

  return (
    <div>
      {/* Category Tabs */}
      <div className="overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !activeCategory
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.name
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Item Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className={`border shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${
              !item.is_available ? 'opacity-50' : ''
            }`}
            onClick={() => item.is_available && handleSelectItem(item)}
          >
            <CardContent className="p-3 flex gap-3">
              {item.image_url && (
                <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-1">{item.name}</h3>
                  <span className="font-bold text-sm text-orange-600 flex-shrink-0">
                    {formatPrice(item.price)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.description}</p>
                )}
                {!item.is_available && (
                  <Badge variant="outline" className="mt-1 text-[10px] bg-red-50 text-red-600 border-red-200">
                    Sold Out
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Item Customization Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">{selectedItem.name}</SheetTitle>
                {selectedItem.description && (
                  <p className="text-sm text-gray-500 text-left">{selectedItem.description}</p>
                )}
              </SheetHeader>

              <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto">
                {/* Modifiers */}
                {selectedItem.modifiers.map((mod) => (
                  <div key={mod.id}>
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      {mod.name}
                      {mod.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    <div className="space-y-1.5">
                      {mod.options.map((opt) => {
                        const isSelected = selectedModifiers.get(mod.id)?.option_id === opt.id
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleModifierSelect(mod.id, mod.name, opt.id, opt.name, opt.price)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-sm">{opt.name}</span>
                            {opt.price > 0 && (
                              <span className="text-sm text-gray-500">+{formatPrice(opt.price)}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Special Instructions */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Special Instructions</p>
                  <Input
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Allergies, preferences, etc."
                    className="h-11"
                  />
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-10 w-10 p-0 rounded-full"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-10 w-10 p-0 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <SheetFooter>
                <Button
                  onClick={handleAddToCart}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart &mdash; {formatPrice(itemTotal)}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
