'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TipDistribution } from './TipDistribution'
import { TipPoolConfig } from './TipPoolConfig'
import { ServerCheckout } from './ServerCheckout'
import type { StaffMember } from '@/stores/staff-store'

interface TipsTabProps {
  staff: StaffMember[]
}

export function TipsTab({ staff }: TipsTabProps) {
  return (
    <Tabs defaultValue="distribution" className="space-y-4">
      <TabsList>
        <TabsTrigger value="distribution">Distribution</TabsTrigger>
        <TabsTrigger value="pool-config">Pool Config</TabsTrigger>
        <TabsTrigger value="server-checkout">Server Checkout</TabsTrigger>
      </TabsList>

      <TabsContent value="distribution">
        <TipDistribution />
      </TabsContent>

      <TabsContent value="pool-config">
        <TipPoolConfig />
      </TabsContent>

      <TabsContent value="server-checkout">
        <ServerCheckout staff={staff} />
      </TabsContent>
    </Tabs>
  )
}
