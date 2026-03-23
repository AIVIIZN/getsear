'use client'

import { Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TipPoolModel } from '@/lib/staff/tip-pool-calculator'

interface TipPoolModelCardProps {
  model: TipPoolModel
  title: string
  description: string
  isSelected: boolean
  onSelect: () => void
}

const MODEL_DIAGRAMS: Record<TipPoolModel, React.ReactNode> = {
  direct: (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="w-16 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
        Tips
      </div>
      <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
        <path d="M0 6h20m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="w-16 h-8 rounded bg-green-100 flex items-center justify-center text-green-700 font-medium">
        Server
      </div>
    </div>
  ),
  tipout_sales: (
    <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <div className="w-16 h-7 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs">
        Server
      </div>
      <div className="flex items-center gap-3">
        {['Busser', 'Bar', 'Runner'].map((r) => (
          <div key={r} className="flex flex-col items-center gap-0.5">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M6 0v6m-3 0l3 3 3-3" stroke="currentColor" strokeWidth="1" />
            </svg>
            <div className="w-12 h-5 rounded bg-purple-100 flex items-center justify-center text-purple-700 font-medium text-[10px]">
              {r}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  pool_hours: (
    <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <div className="w-20 h-7 rounded bg-amber-100 flex items-center justify-center text-amber-700 font-medium text-xs">
        Tip Pool
      </div>
      <svg width="80" height="12" viewBox="0 0 80 12" fill="none">
        <path d="M40 0v8M20 8l20 0M60 8l-20 0M20 8v3M40 8v3M60 8v3" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="flex gap-2">
        {['A', 'B', 'C'].map((n) => (
          <div key={n} className="w-10 h-5 rounded bg-green-100 flex items-center justify-center text-green-700 font-medium text-[10px]">
            {n}
          </div>
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">By hours worked</span>
    </div>
  ),
  hybrid_points: (
    <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <div className="w-20 h-7 rounded bg-amber-100 flex items-center justify-center text-amber-700 font-medium text-xs">
        Tip Pool
      </div>
      <div className="flex gap-1.5">
        {[{ r: 'Svr', pts: '10pt' }, { r: 'Bar', pts: '8pt' }, { r: 'Bus', pts: '5pt' }].map((item) => (
          <div key={item.r} className="flex flex-col items-center gap-0.5">
            <div className="w-11 h-5 rounded bg-green-100 flex items-center justify-center text-green-700 font-medium text-[10px]">
              {item.r}
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">{item.pts}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

export function TipPoolModelCard({
  model,
  title,
  description,
  isSelected,
  onSelect,
}: TipPoolModelCardProps) {
  return (
    <Card
      className={cn(
        'relative cursor-pointer transition-all hover:shadow-md',
        isSelected
          ? 'ring-2 ring-primary border-primary'
          : 'hover:border-primary/30'
      )}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
        </div>
      )}
      <CardContent className="p-4">
        <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <div className="flex justify-center py-2">
          {MODEL_DIAGRAMS[model]}
        </div>
      </CardContent>
    </Card>
  )
}
