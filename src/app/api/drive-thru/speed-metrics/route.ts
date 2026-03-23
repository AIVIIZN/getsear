import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'today'
  const targetTotalTime = parseInt(searchParams.get('target') ?? '210') // 3:30 default

  let startDate: Date
  const now = new Date()

  switch (period) {
    case 'week':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
      break
    case 'month':
      startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - 1)
      break
    default: // today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }

  const { data: cars } = await db
    .from('drive_thru_cars')
    .select('id, lane_id, entered_at, order_placed_at, payment_at, pickup_at, exited_at, total_time_seconds, drive_thru_lanes(name)')
    .eq('org_id', user.org_id)
    .not('exited_at', 'is', null)
    .gte('entered_at', startDate.toISOString())
    .order('entered_at', { ascending: false })

  const completedCars = cars ?? []

  if (completedCars.length === 0) {
    return NextResponse.json({
      data: {
        avg_total_time: 0,
        avg_menu_time: 0,
        avg_payment_time: 0,
        avg_pickup_time: 0,
        cars_per_hour: 0,
        target_total_time: targetTotalTime,
        total_cars: 0,
        by_daypart: [],
        by_lane: [],
      },
    })
  }

  // Calculate averages
  let totalTimeSum = 0
  let menuTimeSum = 0
  let paymentTimeSum = 0
  let pickupTimeSum = 0
  let validCount = 0

  const byLane = new Map<string, { name: string; times: number[]; count: number }>()
  const byHour = new Map<number, { times: number[]; count: number }>()

  for (const car of completedCars) {
    const totalTime = car.total_time_seconds as number
    if (!totalTime) continue

    totalTimeSum += totalTime
    validCount++

    // Calculate stage times
    const entered = new Date(car.entered_at as string).getTime()
    const ordered = car.order_placed_at ? new Date(car.order_placed_at as string).getTime() : entered
    const paid = car.payment_at ? new Date(car.payment_at as string).getTime() : ordered
    const picked = car.pickup_at ? new Date(car.pickup_at as string).getTime() : paid

    const menuTime = Math.round((ordered - entered) / 1000)
    const paymentTime = Math.round((paid - ordered) / 1000)
    const pickupTime = Math.round((picked - paid) / 1000)

    menuTimeSum += menuTime
    paymentTimeSum += paymentTime
    pickupTimeSum += pickupTime

    // By lane
    const laneObj = car.drive_thru_lanes as unknown as Record<string, unknown> | null
    const laneName = (laneObj?.name as string) ?? 'Unknown'
    const laneData = byLane.get(car.lane_id as string) ?? { name: laneName, times: [], count: 0 }
    laneData.times.push(totalTime)
    laneData.count++
    byLane.set(car.lane_id as string, laneData)

    // By hour
    const hour = new Date(car.entered_at as string).getHours()
    const hourData = byHour.get(hour) ?? { times: [], count: 0 }
    hourData.times.push(totalTime)
    hourData.count++
    byHour.set(hour, hourData)
  }

  // Hours in period for cars/hour
  const hoursInPeriod = Math.max(1, (now.getTime() - startDate.getTime()) / 3600000)
  const carsPerHour = Math.round((validCount / hoursInPeriod) * 10) / 10

  // Daypart mapping
  const daypartLabels: Record<string, string> = {}
  for (let h = 5; h < 11; h++) daypartLabels[h.toString()] = 'Breakfast'
  for (let h = 11; h < 15; h++) daypartLabels[h.toString()] = 'Lunch'
  for (let h = 15; h < 17; h++) daypartLabels[h.toString()] = 'Afternoon'
  for (let h = 17; h < 21; h++) daypartLabels[h.toString()] = 'Dinner'
  for (let h = 21; h < 24; h++) daypartLabels[h.toString()] = 'Late Night'

  const daypartMap = new Map<string, { times: number[]; count: number }>()
  for (const [hour, data] of byHour.entries()) {
    const daypart = daypartLabels[hour.toString()] ?? 'Other'
    const existing = daypartMap.get(daypart) ?? { times: [], count: 0 }
    existing.times.push(...data.times)
    existing.count += data.count
    daypartMap.set(daypart, existing)
  }

  return NextResponse.json({
    data: {
      avg_total_time: Math.round(totalTimeSum / validCount),
      avg_menu_time: Math.round(menuTimeSum / validCount),
      avg_payment_time: Math.round(paymentTimeSum / validCount),
      avg_pickup_time: Math.round(pickupTimeSum / validCount),
      cars_per_hour: carsPerHour,
      target_total_time: targetTotalTime,
      total_cars: validCount,
      by_daypart: Array.from(daypartMap.entries()).map(([daypart, data]) => ({
        daypart,
        avg_time: Math.round(data.times.reduce((s, t) => s + t, 0) / data.count),
        count: data.count,
      })),
      by_lane: Array.from(byLane.entries()).map(([laneId, data]) => ({
        lane_id: laneId,
        lane_name: data.name,
        avg_time: Math.round(data.times.reduce((s, t) => s + t, 0) / data.count),
        count: data.count,
      })),
    },
  })
}
