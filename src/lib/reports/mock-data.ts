/**
 * Mock data for reports when no real data exists.
 * Realistic restaurant data: Sear POS seed menu items,
 * peak lunch (12-1pm) and dinner (6-8pm) patterns.
 */

export interface HourlySalesPoint {
  hour: string
  sales: number
  orders: number
}

export interface PaymentMixPoint {
  method: string
  amount: number
  percentage: number
  color: string
}

export interface CategoryMixPoint {
  category: string
  sales: number
  percentage: number
}

export interface TopItemPoint {
  name: string
  quantity: number
  revenue: number
}

export interface DailySalesPoint {
  date: string
  gross_sales: number
  net_sales: number
  orders: number
  discounts: number
  tax: number
}

export interface LaborEntry {
  name: string
  role: string
  hours: number
  rate: number
  total_pay: number
  tips: number
  overtime_hours: number
}

export interface PMIXItem {
  name: string
  category: string
  quantity_sold: number
  revenue: number
  food_cost_pct: number
  margin_pct: number
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
  popularity: number
  profitability: number
}

export interface ServerPerformanceEntry {
  name: string
  total_sales: number
  orders: number
  avg_check: number
  avg_tip_pct: number
  covers: number
}

// Chart colors from Sear design system
export const CHART_COLORS = {
  chart1: '#F06B18', // ember orange
  chart2: '#2563EB', // blue
  chart3: '#16A34A', // green
  chart4: '#7C3AED', // purple
  chart5: '#D97706', // amber
} as const

export function getMockHourlySales(): HourlySalesPoint[] {
  return [
    { hour: '6 AM', sales: 120, orders: 4 },
    { hour: '7 AM', sales: 340, orders: 11 },
    { hour: '8 AM', sales: 580, orders: 18 },
    { hour: '9 AM', sales: 290, orders: 9 },
    { hour: '10 AM', sales: 410, orders: 13 },
    { hour: '11 AM', sales: 1250, orders: 38 },
    { hour: '12 PM', sales: 2180, orders: 62 },
    { hour: '1 PM', sales: 1890, orders: 54 },
    { hour: '2 PM', sales: 720, orders: 22 },
    { hour: '3 PM', sales: 380, orders: 12 },
    { hour: '4 PM', sales: 560, orders: 17 },
    { hour: '5 PM', sales: 1420, orders: 42 },
    { hour: '6 PM', sales: 2340, orders: 68 },
    { hour: '7 PM', sales: 2560, orders: 74 },
    { hour: '8 PM', sales: 1980, orders: 58 },
    { hour: '9 PM', sales: 1120, orders: 34 },
    { hour: '10 PM', sales: 540, orders: 16 },
    { hour: '11 PM', sales: 180, orders: 6 },
  ]
}

export function getMockPaymentMix(): PaymentMixPoint[] {
  return [
    { method: 'Card', amount: 12285, percentage: 65, color: CHART_COLORS.chart1 },
    { method: 'Cash', amount: 4725, percentage: 25, color: CHART_COLORS.chart3 },
    { method: 'Gift Card', amount: 1890, percentage: 10, color: CHART_COLORS.chart4 },
  ]
}

export function getMockCategoryMix(): CategoryMixPoint[] {
  return [
    { category: 'Entrees', sales: 6615, percentage: 35 },
    { category: 'Burgers', sales: 4725, percentage: 25 },
    { category: 'Starters', sales: 2835, percentage: 15 },
    { category: 'Beverages', sales: 2268, percentage: 12 },
    { category: 'Desserts', sales: 1323, percentage: 7 },
    { category: 'Sides', sales: 1134, percentage: 6 },
  ]
}

export function getMockTopItems(): TopItemPoint[] {
  return [
    { name: 'Ribeye Steak', quantity: 42, revenue: 1638 },
    { name: 'Classic Burger', quantity: 68, revenue: 1088 },
    { name: 'Buffalo Wings', quantity: 54, revenue: 810 },
    { name: 'Caesar Salad', quantity: 48, revenue: 624 },
    { name: 'Fish & Chips', quantity: 36, revenue: 612 },
    { name: 'Chicken Sandwich', quantity: 41, revenue: 574 },
    { name: 'Loaded Nachos', quantity: 38, revenue: 494 },
    { name: 'Margherita Pizza', quantity: 32, revenue: 480 },
    { name: 'Grilled Salmon', quantity: 28, revenue: 476 },
    { name: 'Onion Rings', quantity: 52, revenue: 416 },
  ]
}

export function getMockDailySales(days: number = 7): DailySalesPoint[] {
  const data: DailySalesPoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayOfWeek = d.getDay()
    // Weekend boost
    const baseOrders = dayOfWeek === 0 || dayOfWeek === 6 ? 180 : 145
    const variance = Math.round((Math.random() - 0.5) * 30)
    const orders = baseOrders + variance
    const avgCheck = 32 + Math.round((Math.random() - 0.5) * 8)
    const gross = orders * avgCheck
    const discounts = Math.round(gross * 0.04)
    const net = gross - discounts
    const tax = Math.round(net * 0.085)
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gross_sales: gross,
      net_sales: net,
      orders,
      discounts,
      tax,
    })
  }
  return data
}

export function getMockWeeklySales(): DailySalesPoint[] {
  const data: DailySalesPoint[] = []
  const now = new Date()
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const orders = 950 + Math.round((Math.random() - 0.5) * 150)
    const gross = orders * 34
    const discounts = Math.round(gross * 0.04)
    const net = gross - discounts
    const tax = Math.round(net * 0.085)
    data.push({
      date: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      gross_sales: gross,
      net_sales: net,
      orders,
      discounts,
      tax,
    })
  }
  return data
}

export function getMockMonthlySales(): DailySalesPoint[] {
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
  return months.map((month) => {
    const orders = 4200 + Math.round((Math.random() - 0.5) * 800)
    const gross = orders * 33
    const discounts = Math.round(gross * 0.04)
    const net = gross - discounts
    const tax = Math.round(net * 0.085)
    return { date: month, gross_sales: gross, net_sales: net, orders, discounts, tax }
  })
}

export function getMockLaborData(): {
  entries: LaborEntry[]
  total_labor_cost: number
  total_hours: number
  labor_percentage: number
  revenue: number
} {
  const entries: LaborEntry[] = [
    { name: 'Sarah Chen', role: 'Server', hours: 38, rate: 5.25, tips: 620, total_pay: 199.5, overtime_hours: 0 },
    { name: 'Marcus Johnson', role: 'Server', hours: 42, rate: 5.25, tips: 710, total_pay: 220.5, overtime_hours: 2 },
    { name: 'Emily Rodriguez', role: 'Bartender', hours: 36, rate: 7.50, tips: 880, total_pay: 270, overtime_hours: 0 },
    { name: 'James Kim', role: 'Line Cook', hours: 44, rate: 18.00, tips: 0, total_pay: 828, overtime_hours: 4 },
    { name: 'David Martinez', role: 'Line Cook', hours: 40, rate: 17.50, tips: 0, total_pay: 700, overtime_hours: 0 },
    { name: 'Lisa Thompson', role: 'Prep Cook', hours: 35, rate: 15.00, tips: 0, total_pay: 525, overtime_hours: 0 },
    { name: 'Omar Hassan', role: 'Dishwasher', hours: 40, rate: 14.00, tips: 0, total_pay: 560, overtime_hours: 0 },
    { name: 'Ashley Park', role: 'Host', hours: 30, rate: 14.50, tips: 0, total_pay: 435, overtime_hours: 0 },
    { name: 'Chris Brown', role: 'Expo', hours: 38, rate: 16.00, tips: 0, total_pay: 608, overtime_hours: 0 },
    { name: 'Mike Wilson', role: 'Manager', hours: 45, rate: 24.00, tips: 0, total_pay: 1140, overtime_hours: 5 },
  ]
  const total_labor_cost = entries.reduce((sum, e) => sum + e.total_pay, 0)
  const total_hours = entries.reduce((sum, e) => sum + e.hours, 0)
  const revenue = 18900
  const labor_percentage = Math.round((total_labor_cost / revenue) * 1000) / 10
  return { entries, total_labor_cost, total_hours, labor_percentage, revenue }
}

export function getMockPMIX(): PMIXItem[] {
  return [
    { name: 'Ribeye Steak', category: 'Entrees', quantity_sold: 42, revenue: 1638, food_cost_pct: 32, margin_pct: 68, classification: 'Star', popularity: 85, profitability: 78 },
    { name: 'Classic Burger', category: 'Burgers', quantity_sold: 68, revenue: 1088, food_cost_pct: 28, margin_pct: 72, classification: 'Star', popularity: 95, profitability: 72 },
    { name: 'Buffalo Wings', category: 'Starters', quantity_sold: 54, revenue: 810, food_cost_pct: 25, margin_pct: 75, classification: 'Star', popularity: 78, profitability: 75 },
    { name: 'Caesar Salad', category: 'Starters', quantity_sold: 48, revenue: 624, food_cost_pct: 22, margin_pct: 78, classification: 'Star', popularity: 72, profitability: 82 },
    { name: 'Fish & Chips', category: 'Entrees', quantity_sold: 36, revenue: 612, food_cost_pct: 35, margin_pct: 65, classification: 'Plowhorse', popularity: 62, profitability: 38 },
    { name: 'Chicken Sandwich', category: 'Burgers', quantity_sold: 41, revenue: 574, food_cost_pct: 30, margin_pct: 70, classification: 'Plowhorse', popularity: 68, profitability: 42 },
    { name: 'Loaded Nachos', category: 'Starters', quantity_sold: 38, revenue: 494, food_cost_pct: 26, margin_pct: 74, classification: 'Plowhorse', popularity: 60, profitability: 45 },
    { name: 'Grilled Salmon', category: 'Entrees', quantity_sold: 28, revenue: 476, food_cost_pct: 38, margin_pct: 62, classification: 'Puzzle', popularity: 35, profitability: 68 },
    { name: 'Lobster Tail', category: 'Entrees', quantity_sold: 12, revenue: 468, food_cost_pct: 42, margin_pct: 58, classification: 'Puzzle', popularity: 18, profitability: 72 },
    { name: 'Margherita Pizza', category: 'Entrees', quantity_sold: 32, revenue: 480, food_cost_pct: 24, margin_pct: 76, classification: 'Star', popularity: 55, profitability: 76 },
    { name: 'Onion Rings', category: 'Sides', quantity_sold: 52, revenue: 416, food_cost_pct: 18, margin_pct: 82, classification: 'Star', popularity: 70, profitability: 85 },
    { name: 'Mac & Cheese', category: 'Sides', quantity_sold: 24, revenue: 216, food_cost_pct: 20, margin_pct: 80, classification: 'Dog', popularity: 32, profitability: 48 },
    { name: 'Tiramisu', category: 'Desserts', quantity_sold: 18, revenue: 198, food_cost_pct: 28, margin_pct: 72, classification: 'Puzzle', popularity: 25, profitability: 62 },
    { name: 'Chocolate Cake', category: 'Desserts', quantity_sold: 15, revenue: 150, food_cost_pct: 30, margin_pct: 70, classification: 'Dog', popularity: 20, profitability: 35 },
    { name: 'House Lemonade', category: 'Beverages', quantity_sold: 65, revenue: 325, food_cost_pct: 12, margin_pct: 88, classification: 'Star', popularity: 88, profitability: 90 },
  ]
}

export function getMockServerPerformance(): ServerPerformanceEntry[] {
  return [
    { name: 'Sarah Chen', total_sales: 4280, orders: 38, avg_check: 112.63, avg_tip_pct: 19.2, covers: 82 },
    { name: 'Marcus Johnson', total_sales: 3940, orders: 34, avg_check: 115.88, avg_tip_pct: 21.5, covers: 76 },
    { name: 'Emily Rodriguez', total_sales: 5120, orders: 52, avg_check: 98.46, avg_tip_pct: 22.8, covers: 108 },
    { name: 'Ashley Park', total_sales: 2860, orders: 28, avg_check: 102.14, avg_tip_pct: 17.4, covers: 58 },
    { name: 'Chris Brown', total_sales: 3450, orders: 32, avg_check: 107.81, avg_tip_pct: 18.9, covers: 68 },
  ]
}

export function getMockKPIs(): {
  total_sales: number
  orders: number
  avg_check: number
  labor_pct: number
  prev_total_sales: number
  prev_orders: number
  prev_avg_check: number
  prev_labor_pct: number
} {
  return {
    total_sales: 18900,
    orders: 558,
    avg_check: 33.87,
    labor_pct: 28.4,
    prev_total_sales: 17200,
    prev_orders: 512,
    prev_avg_check: 33.59,
    prev_labor_pct: 29.1,
  }
}

export function getMockDiscounts(): {
  discounts: Array<{ name: string; count: number; amount: number }>
  total_discount: number
  total_comp: number
  total_void: number
} {
  return {
    discounts: [
      { name: 'Happy Hour 20%', count: 34, amount: 412 },
      { name: 'Employee 50%', count: 8, amount: 186 },
      { name: 'Manager Comp', count: 5, amount: 148 },
      { name: 'Loyalty Reward', count: 12, amount: 96 },
      { name: 'Birthday', count: 3, amount: 42 },
    ],
    total_discount: 884,
    total_comp: 148,
    total_void: 62,
  }
}

export function getMockTax(): Array<{
  rate_name: string
  rate_pct: number
  taxable_sales: number
  tax_collected: number
}> {
  return [
    { rate_name: 'State Sales Tax', rate_pct: 6.25, taxable_sales: 16850, tax_collected: 1053.13 },
    { rate_name: 'Local Sales Tax', rate_pct: 1.50, taxable_sales: 16850, tax_collected: 252.75 },
    { rate_name: 'Alcohol Tax', rate_pct: 8.50, taxable_sales: 4200, tax_collected: 357.00 },
  ]
}
