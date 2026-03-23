'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { MenuCategory } from '../CategoryPanel'

const STATION_OPTIONS = [
  'grill', 'saute', 'fry', 'expo', 'cold', 'pizza', 'bar', 'pastry',
] as const

const COURSE_OPTIONS = [
  'appetizer', 'soup', 'salad', 'entree', 'dessert', 'beverage',
] as const

const TAX_CLASS_OPTIONS = [
  { value: 'standard', label: 'Standard Rate' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'exempt', label: 'Tax Exempt' },
] as const

const REVENUE_CLASS_OPTIONS = [
  { value: 'food', label: 'Food' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' },
] as const

export interface GeneralFormData {
  name: string
  short_name: string
  description: string
  category_id: string
  tax_class: string
  revenue_class: string
  prep_station: string
  prep_time_minutes: string
  course: string
  plu_code: string
  barcode: string
  is_active: boolean
  is_online_visible: boolean
  is_kiosk_visible: boolean
}

interface GeneralTabProps {
  form: GeneralFormData
  categories: MenuCategory[]
  onUpdateField: <K extends keyof GeneralFormData>(field: K, value: GeneralFormData[K]) => void
}

const selectClassName = 'flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function GeneralTab({ form, categories, onUpdateField }: GeneralTabProps) {
  const handleStationToggle = useCallback(
    (station: string) => {
      const current = form.prep_station ? form.prep_station.split(',').filter(Boolean) : []
      const updated = current.includes(station)
        ? current.filter((s) => s !== station)
        : [...current, station]
      onUpdateField('prep_station', updated.join(','))
    },
    [form.prep_station, onUpdateField]
  )

  const selectedStations = form.prep_station ? form.prep_station.split(',').filter(Boolean) : []

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="item-name">Name *</Label>
        <Input
          id="item-name"
          placeholder="e.g. Grilled Salmon"
          value={form.name}
          onChange={(e) => onUpdateField('name', e.target.value)}
        />
      </div>

      {/* Short name */}
      <div className="space-y-1.5">
        <Label htmlFor="item-short-name">Short Name (KDS)</Label>
        <Input
          id="item-short-name"
          placeholder="e.g. GRL SALMN"
          value={form.short_name}
          onChange={(e) => onUpdateField('short_name', e.target.value)}
          maxLength={30}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="item-desc">Description</Label>
        <Textarea
          id="item-desc"
          placeholder="Item description shown on online ordering, menus..."
          value={form.description}
          onChange={(e) => onUpdateField('description', e.target.value)}
          rows={3}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="item-category">Category *</Label>
        <select
          id="item-category"
          value={form.category_id}
          onChange={(e) => onUpdateField('category_id', e.target.value)}
          className={selectClassName}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tax Class and Revenue Class */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-tax-class">Tax Class</Label>
          <select
            id="item-tax-class"
            value={form.tax_class}
            onChange={(e) => onUpdateField('tax_class', e.target.value)}
            className={selectClassName}
          >
            <option value="">Default</option>
            {TAX_CLASS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-revenue-class">Revenue Class</Label>
          <select
            id="item-revenue-class"
            value={form.revenue_class}
            onChange={(e) => onUpdateField('revenue_class', e.target.value)}
            className={selectClassName}
          >
            <option value="">Default</option>
            {REVENUE_CLASS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Station Routing */}
      <div className="space-y-1.5">
        <Label>Station Routing</Label>
        <div className="flex flex-wrap gap-1.5">
          {STATION_OPTIONS.map((station) => {
            const isActive = selectedStations.includes(station)
            return (
              <button
                key={station}
                type="button"
                onClick={() => handleStationToggle(station)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  isActive
                    ? 'border-[#F06B18] bg-[#F06B18]/10 text-[#F06B18]'
                    : 'border-border text-muted-foreground hover:border-border'
                }`}
              >
                {station}
              </button>
            )
          })}
        </div>
      </div>

      {/* Prep Time and Course */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-prep-time">Prep Time (min)</Label>
          <Input
            id="item-prep-time"
            type="number"
            placeholder="0"
            value={form.prep_time_minutes}
            onChange={(e) => onUpdateField('prep_time_minutes', e.target.value)}
            min={0}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-course">Course</Label>
          <select
            id="item-course"
            value={form.course}
            onChange={(e) => onUpdateField('course', e.target.value)}
            className={selectClassName}
          >
            <option value="">None</option>
            {COURSE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PLU and Barcode */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-plu">PLU Code</Label>
          <Input
            id="item-plu"
            placeholder="e.g. 1234"
            value={form.plu_code}
            onChange={(e) => onUpdateField('plu_code', e.target.value)}
            maxLength={20}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-barcode">Barcode</Label>
          <Input
            id="item-barcode"
            placeholder="e.g. 0123456789"
            value={form.barcode}
            onChange={(e) => onUpdateField('barcode', e.target.value)}
            maxLength={50}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">Item visible on POS</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateField('is_active', !form.is_active)}
            className="flex items-center"
          >
            <Switch checked={form.is_active} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Online Ordering</Label>
            <p className="text-xs text-muted-foreground">Show on online menu</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateField('is_online_visible', !form.is_online_visible)}
            className="flex items-center"
          >
            <Switch checked={form.is_online_visible} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Kiosk</Label>
            <p className="text-xs text-muted-foreground">Show on self-service kiosk</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateField('is_kiosk_visible', !form.is_kiosk_visible)}
            className="flex items-center"
          >
            <Switch checked={form.is_kiosk_visible} />
          </button>
        </div>
      </div>
    </div>
  )
}
