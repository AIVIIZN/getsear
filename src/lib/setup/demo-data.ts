/**
 * Complete demo restaurant seed data for Sear POS.
 * 50 menu items, 12 modifier groups, 24 tables, 8 staff, 3 dayparts,
 * sample tax rates, 5 orders, 1 floor plan.
 * All items flagged with is_demo: true for easy cleanup.
 */

export interface DemoCategory {
  name: string
  color: string
  sort_order: number
  items: DemoMenuItem[]
}

export interface DemoMenuItem {
  name: string
  description: string
  price_cents: number
  is_taxable: boolean
  is_alcoholic?: boolean
  modifier_group_names?: string[]
}

export interface DemoModifierGroup {
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: DemoModifier[]
}

export interface DemoModifier {
  name: string
  price_cents: number
  is_default?: boolean
}

export interface DemoTable {
  name: string
  section: string
  seats: number
  x: number
  y: number
  shape: 'square' | 'round' | 'rectangle'
}

export interface DemoStaffMember {
  first_name: string
  last_name: string
  role: string
  pin: string
  email: string
}

export interface DemoDaypart {
  name: string
  start_time: string
  end_time: string
  days: number[]
}

export interface DemoOrderItem {
  item_name: string
  quantity: number
  price_cents: number
}

export interface DemoOrder {
  order_type: string
  status: string
  table_name?: string
  items: DemoOrderItem[]
}

// ----- CATEGORIES & MENU ITEMS -----

export const DEMO_CATEGORIES: DemoCategory[] = [
  {
    name: 'Appetizers',
    color: '#FF9500',
    sort_order: 0,
    items: [
      { name: 'Crispy Calamari', description: 'Lightly battered squid rings with marinara and aioli', price_cents: 1495, is_taxable: true },
      { name: 'Bruschetta', description: 'Grilled ciabatta with heirloom tomatoes, basil, and balsamic reduction', price_cents: 1295, is_taxable: true },
      { name: 'Mozzarella Sticks', description: 'Hand-breaded with house marinara', price_cents: 1195, is_taxable: true },
      { name: 'Spinach Artichoke Dip', description: 'Creamy dip served with tortilla chips and crostini', price_cents: 1395, is_taxable: true },
      { name: 'Chicken Wings', description: 'Choice of Buffalo, BBQ, or Garlic Parmesan. Served with celery and ranch', price_cents: 1595, is_taxable: true, modifier_group_names: ['Wing Sauce'] },
      { name: 'Loaded Nachos', description: 'Tortilla chips with cheese, jalapenos, sour cream, pico de gallo', price_cents: 1495, is_taxable: true },
    ],
  },
  {
    name: 'Salads',
    color: '#34C759',
    sort_order: 1,
    items: [
      { name: 'Caesar Salad', description: 'Romaine, shaved parmesan, croutons, house Caesar dressing', price_cents: 1295, is_taxable: true, modifier_group_names: ['Add Protein'] },
      { name: 'House Garden Salad', description: 'Mixed greens, cherry tomatoes, cucumbers, red onion, balsamic vinaigrette', price_cents: 1095, is_taxable: true, modifier_group_names: ['Dressing'] },
      { name: 'Cobb Salad', description: 'Grilled chicken, bacon, avocado, hard-boiled egg, blue cheese crumbles', price_cents: 1695, is_taxable: true, modifier_group_names: ['Dressing'] },
      { name: 'Greek Salad', description: 'Romaine, feta, kalamata olives, cucumbers, peppers, red onion', price_cents: 1395, is_taxable: true, modifier_group_names: ['Dressing'] },
      { name: 'Wedge Salad', description: 'Iceberg wedge, bacon, tomatoes, blue cheese dressing', price_cents: 1295, is_taxable: true },
    ],
  },
  {
    name: 'Entrees',
    color: '#007AFF',
    sort_order: 2,
    items: [
      { name: 'Grilled Ribeye', description: '14oz USDA Choice ribeye, garlic herb butter, mashed potatoes, asparagus', price_cents: 3895, is_taxable: true, modifier_group_names: ['Temperature'] },
      { name: 'Chicken Parmesan', description: 'Breaded chicken breast, house marinara, mozzarella, spaghetti', price_cents: 2195, is_taxable: true },
      { name: 'Pan-Seared Pork Chop', description: 'Double-cut pork chop, apple chutney, roasted vegetables', price_cents: 2495, is_taxable: true, modifier_group_names: ['Temperature'] },
      { name: 'Mushroom Risotto', description: 'Arborio rice, wild mushrooms, parmesan, truffle oil', price_cents: 1995, is_taxable: true },
      { name: 'BBQ Baby Back Ribs', description: 'Full rack, house BBQ glaze, coleslaw, cornbread', price_cents: 2795, is_taxable: true },
      { name: 'Roasted Half Chicken', description: 'Herb-roasted, lemon jus, roasted fingerling potatoes, green beans', price_cents: 2295, is_taxable: true },
    ],
  },
  {
    name: 'Seafood',
    color: '#007AFF',
    sort_order: 3,
    items: [
      { name: 'Grilled Atlantic Salmon', description: 'Dill cream sauce, wild rice, seasonal vegetables', price_cents: 2695, is_taxable: true, modifier_group_names: ['Temperature'] },
      { name: 'Fish & Chips', description: 'Beer-battered cod, hand-cut fries, tartar sauce, coleslaw', price_cents: 1895, is_taxable: true },
      { name: 'Shrimp Scampi', description: 'Sauteed shrimp, garlic, white wine, butter, linguine', price_cents: 2395, is_taxable: true },
      { name: 'Lobster Mac & Cheese', description: 'Maine lobster, three-cheese sauce, panko crust', price_cents: 2895, is_taxable: true },
      { name: 'Seared Ahi Tuna', description: 'Sesame-crusted, wasabi aioli, seaweed salad, pickled ginger', price_cents: 2595, is_taxable: true, modifier_group_names: ['Temperature'] },
      { name: 'Crab Cakes', description: 'Two jumbo lump crab cakes, remoulade, roasted corn salad', price_cents: 2795, is_taxable: true },
    ],
  },
  {
    name: 'Burgers',
    color: '#FF3B30',
    sort_order: 4,
    items: [
      { name: 'Classic Burger', description: 'Angus beef, lettuce, tomato, onion, pickles, sesame bun', price_cents: 1595, is_taxable: true, modifier_group_names: ['Temperature', 'Toppings'] },
      { name: 'Bacon Cheddar Burger', description: 'Applewood bacon, aged cheddar, caramelized onions, brioche bun', price_cents: 1795, is_taxable: true, modifier_group_names: ['Temperature', 'Toppings'] },
      { name: 'Mushroom Swiss Burger', description: 'Sauteed mushrooms, Swiss cheese, garlic aioli', price_cents: 1795, is_taxable: true, modifier_group_names: ['Temperature', 'Toppings'] },
      { name: 'BBQ Burger', description: 'Cheddar, onion rings, BBQ sauce, pickled jalapenos', price_cents: 1895, is_taxable: true, modifier_group_names: ['Temperature', 'Toppings'] },
      { name: 'Veggie Burger', description: 'Black bean patty, avocado, sprouts, whole grain bun', price_cents: 1495, is_taxable: true, modifier_group_names: ['Toppings'] },
      { name: 'Turkey Burger', description: 'Ground turkey, avocado, Swiss, sprouts, wheat bun', price_cents: 1595, is_taxable: true, modifier_group_names: ['Temperature', 'Toppings'] },
    ],
  },
  {
    name: 'Sides',
    color: '#AF52DE',
    sort_order: 5,
    items: [
      { name: 'French Fries', description: 'Hand-cut, sea salt', price_cents: 595, is_taxable: true },
      { name: 'Sweet Potato Fries', description: 'With chipotle aioli', price_cents: 695, is_taxable: true },
      { name: 'Onion Rings', description: 'Beer-battered with ranch', price_cents: 795, is_taxable: true },
      { name: 'Mac & Cheese', description: 'Three-cheese blend, panko crust', price_cents: 795, is_taxable: true },
      { name: 'Seasonal Vegetables', description: 'Roasted with olive oil and herbs', price_cents: 595, is_taxable: true },
      { name: 'Mashed Potatoes', description: 'Yukon Gold, butter, cream', price_cents: 595, is_taxable: true },
    ],
  },
  {
    name: 'Desserts',
    color: '#5856D6',
    sort_order: 6,
    items: [
      { name: 'New York Cheesecake', description: 'Graham cracker crust, strawberry compote', price_cents: 1095, is_taxable: true },
      { name: 'Chocolate Lava Cake', description: 'Warm molten center, vanilla ice cream, raspberry coulis', price_cents: 1195, is_taxable: true },
      { name: 'Tiramisu', description: 'Espresso-soaked ladyfingers, mascarpone, cocoa', price_cents: 1095, is_taxable: true },
      { name: 'Apple Pie a la Mode', description: 'Warm spiced apple pie, vanilla bean ice cream, caramel drizzle', price_cents: 995, is_taxable: true },
      { name: 'Creme Brulee', description: 'Classic vanilla custard, caramelized sugar top', price_cents: 1095, is_taxable: true },
    ],
  },
  {
    name: 'Beverages',
    color: '#5AC8FA',
    sort_order: 7,
    items: [
      { name: 'Soft Drinks', description: 'Coca-Cola, Diet Coke, Sprite, Ginger Ale', price_cents: 395, is_taxable: true },
      { name: 'Iced Tea', description: 'Freshly brewed, sweetened or unsweetened', price_cents: 395, is_taxable: true },
      { name: 'Fresh Lemonade', description: 'House-made with real lemons', price_cents: 495, is_taxable: true },
      { name: 'Coffee', description: 'Regular or decaf', price_cents: 395, is_taxable: true },
      { name: 'Craft Beer', description: 'Ask your server about today\u2019s draft selections', price_cents: 795, is_taxable: true, is_alcoholic: true },
      { name: 'House Wine', description: 'Red or white, by the glass', price_cents: 1195, is_taxable: true, is_alcoholic: true },
      { name: 'Classic Margarita', description: 'Tequila, triple sec, fresh lime, salt rim', price_cents: 1395, is_taxable: true, is_alcoholic: true },
      { name: 'Old Fashioned', description: 'Bourbon, bitters, sugar, orange peel', price_cents: 1495, is_taxable: true, is_alcoholic: true },
      { name: 'Sparkling Water', description: 'San Pellegrino or Topo Chico', price_cents: 495, is_taxable: true },
    ],
  },
]

// ----- MODIFIER GROUPS -----

export const DEMO_MODIFIER_GROUPS: DemoModifierGroup[] = [
  {
    name: 'Temperature',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'Rare', price_cents: 0 },
      { name: 'Medium Rare', price_cents: 0, is_default: true },
      { name: 'Medium', price_cents: 0 },
      { name: 'Medium Well', price_cents: 0 },
      { name: 'Well Done', price_cents: 0 },
    ],
  },
  {
    name: 'Dressing',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'Ranch', price_cents: 0, is_default: true },
      { name: 'Balsamic Vinaigrette', price_cents: 0 },
      { name: 'Caesar', price_cents: 0 },
      { name: 'Blue Cheese', price_cents: 0 },
      { name: 'Honey Mustard', price_cents: 0 },
      { name: 'Italian', price_cents: 0 },
      { name: 'Oil & Vinegar', price_cents: 0 },
    ],
  },
  {
    name: 'Add Protein',
    is_required: false,
    min_selections: 0,
    max_selections: 1,
    modifiers: [
      { name: 'Grilled Chicken', price_cents: 500 },
      { name: 'Grilled Salmon', price_cents: 800 },
      { name: 'Grilled Shrimp', price_cents: 700 },
      { name: 'Steak Tips', price_cents: 900 },
    ],
  },
  {
    name: 'Toppings',
    is_required: false,
    min_selections: 0,
    max_selections: 5,
    modifiers: [
      { name: 'Bacon', price_cents: 200 },
      { name: 'Avocado', price_cents: 200 },
      { name: 'Fried Egg', price_cents: 150 },
      { name: 'Extra Cheese', price_cents: 150 },
      { name: 'Mushrooms', price_cents: 100 },
      { name: 'Jalapenos', price_cents: 100 },
      { name: 'Caramelized Onions', price_cents: 100 },
    ],
  },
  {
    name: 'Wing Sauce',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'Buffalo', price_cents: 0, is_default: true },
      { name: 'BBQ', price_cents: 0 },
      { name: 'Garlic Parmesan', price_cents: 0 },
      { name: 'Honey Sriracha', price_cents: 0 },
      { name: 'Lemon Pepper', price_cents: 0 },
    ],
  },
  {
    name: 'Size',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'Regular', price_cents: 0, is_default: true },
      { name: 'Large', price_cents: 300 },
    ],
  },
  {
    name: 'Side Choice',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'French Fries', price_cents: 0, is_default: true },
      { name: 'Sweet Potato Fries', price_cents: 100 },
      { name: 'Side Salad', price_cents: 0 },
      { name: 'Onion Rings', price_cents: 200 },
      { name: 'Mac & Cheese', price_cents: 200 },
      { name: 'Seasonal Vegetables', price_cents: 0 },
    ],
  },
  {
    name: 'Bread Choice',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'White', price_cents: 0, is_default: true },
      { name: 'Wheat', price_cents: 0 },
      { name: 'Sourdough', price_cents: 0 },
      { name: 'Rye', price_cents: 0 },
      { name: 'Gluten-Free Bun', price_cents: 200 },
    ],
  },
  {
    name: 'Egg Style',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'Scrambled', price_cents: 0, is_default: true },
      { name: 'Over Easy', price_cents: 0 },
      { name: 'Over Medium', price_cents: 0 },
      { name: 'Over Hard', price_cents: 0 },
      { name: 'Sunny Side Up', price_cents: 0 },
      { name: 'Poached', price_cents: 0 },
    ],
  },
  {
    name: 'Spice Level',
    is_required: false,
    min_selections: 0,
    max_selections: 1,
    modifiers: [
      { name: 'Mild', price_cents: 0, is_default: true },
      { name: 'Medium', price_cents: 0 },
      { name: 'Hot', price_cents: 0 },
      { name: 'Extra Hot', price_cents: 0 },
    ],
  },
  {
    name: 'Milk Choice',
    is_required: true,
    min_selections: 1,
    max_selections: 1,
    modifiers: [
      { name: 'Whole Milk', price_cents: 0, is_default: true },
      { name: 'Skim Milk', price_cents: 0 },
      { name: 'Oat Milk', price_cents: 75 },
      { name: 'Almond Milk', price_cents: 75 },
      { name: 'Soy Milk', price_cents: 50 },
      { name: 'Half & Half', price_cents: 0 },
    ],
  },
  {
    name: 'Ice Level',
    is_required: false,
    min_selections: 0,
    max_selections: 1,
    modifiers: [
      { name: 'Regular Ice', price_cents: 0, is_default: true },
      { name: 'Light Ice', price_cents: 0 },
      { name: 'No Ice', price_cents: 0 },
      { name: 'Extra Ice', price_cents: 0 },
    ],
  },
]

// ----- TABLES -----

export const DEMO_TABLES: DemoTable[] = [
  // Dining Room (14 tables)
  { name: 'D1', section: 'Dining Room', seats: 2, x: 80, y: 80, shape: 'square' },
  { name: 'D2', section: 'Dining Room', seats: 2, x: 200, y: 80, shape: 'square' },
  { name: 'D3', section: 'Dining Room', seats: 4, x: 320, y: 80, shape: 'square' },
  { name: 'D4', section: 'Dining Room', seats: 4, x: 440, y: 80, shape: 'square' },
  { name: 'D5', section: 'Dining Room', seats: 4, x: 80, y: 220, shape: 'round' },
  { name: 'D6', section: 'Dining Room', seats: 4, x: 200, y: 220, shape: 'round' },
  { name: 'D7', section: 'Dining Room', seats: 6, x: 320, y: 220, shape: 'rectangle' },
  { name: 'D8', section: 'Dining Room', seats: 6, x: 440, y: 220, shape: 'rectangle' },
  { name: 'D9', section: 'Dining Room', seats: 4, x: 80, y: 360, shape: 'square' },
  { name: 'D10', section: 'Dining Room', seats: 4, x: 200, y: 360, shape: 'square' },
  { name: 'D11', section: 'Dining Room', seats: 2, x: 320, y: 360, shape: 'square' },
  { name: 'D12', section: 'Dining Room', seats: 8, x: 440, y: 360, shape: 'rectangle' },
  { name: 'D13', section: 'Dining Room', seats: 4, x: 80, y: 500, shape: 'round' },
  { name: 'D14', section: 'Dining Room', seats: 4, x: 200, y: 500, shape: 'round' },
  // Bar (5 seats)
  { name: 'B1', section: 'Bar', seats: 2, x: 80, y: 80, shape: 'square' },
  { name: 'B2', section: 'Bar', seats: 2, x: 200, y: 80, shape: 'square' },
  { name: 'B3', section: 'Bar', seats: 2, x: 320, y: 80, shape: 'square' },
  { name: 'B4', section: 'Bar', seats: 4, x: 80, y: 220, shape: 'round' },
  { name: 'B5', section: 'Bar', seats: 4, x: 200, y: 220, shape: 'round' },
  // Patio (5 tables)
  { name: 'P1', section: 'Patio', seats: 4, x: 80, y: 80, shape: 'round' },
  { name: 'P2', section: 'Patio', seats: 4, x: 200, y: 80, shape: 'round' },
  { name: 'P3', section: 'Patio', seats: 6, x: 320, y: 80, shape: 'rectangle' },
  { name: 'P4', section: 'Patio', seats: 2, x: 80, y: 220, shape: 'square' },
  { name: 'P5', section: 'Patio', seats: 2, x: 200, y: 220, shape: 'square' },
]

// ----- STAFF -----

export const DEMO_STAFF: DemoStaffMember[] = [
  { first_name: 'Sarah', last_name: 'Mitchell', role: 'manager', pin: '1234', email: 'sarah@demo.sear.pos' },
  { first_name: 'James', last_name: 'Rodriguez', role: 'server', pin: '2345', email: 'james@demo.sear.pos' },
  { first_name: 'Emily', last_name: 'Chen', role: 'server', pin: '3456', email: 'emily@demo.sear.pos' },
  { first_name: 'Marcus', last_name: 'Johnson', role: 'bartender', pin: '4567', email: 'marcus@demo.sear.pos' },
  { first_name: 'Lisa', last_name: 'Patel', role: 'host', pin: '5678', email: 'lisa@demo.sear.pos' },
  { first_name: 'Carlos', last_name: 'Rivera', role: 'line_cook', pin: '6789', email: 'carlos@demo.sear.pos' },
  { first_name: 'David', last_name: 'Kim', role: 'line_cook', pin: '7890', email: 'david@demo.sear.pos' },
  { first_name: 'Amanda', last_name: 'Brooks', role: 'expo', pin: '8901', email: 'amanda@demo.sear.pos' },
]

// ----- DAYPARTS -----

export const DEMO_DAYPARTS: DemoDaypart[] = [
  { name: 'Lunch', start_time: '11:00', end_time: '15:00', days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Happy Hour', start_time: '15:00', end_time: '18:00', days: [1, 2, 3, 4, 5] },
  { name: 'Dinner', start_time: '17:00', end_time: '22:00', days: [0, 1, 2, 3, 4, 5, 6] },
]

// ----- TAX RATES -----

export const DEMO_TAX_RATES = {
  food: 8.875,
  alcohol: 8.875,
  takeout: 8.875,
}

// ----- SAMPLE ORDERS -----

export const DEMO_ORDERS: DemoOrder[] = [
  {
    order_type: 'dine_in',
    status: 'open',
    table_name: 'D1',
    items: [
      { item_name: 'Caesar Salad', quantity: 1, price_cents: 1295 },
      { item_name: 'Grilled Ribeye', quantity: 1, price_cents: 3895 },
      { item_name: 'House Wine', quantity: 2, price_cents: 1195 },
    ],
  },
  {
    order_type: 'dine_in',
    status: 'in_progress',
    table_name: 'D5',
    items: [
      { item_name: 'Bruschetta', quantity: 1, price_cents: 1295 },
      { item_name: 'Chicken Parmesan', quantity: 2, price_cents: 2195 },
      { item_name: 'Mushroom Risotto', quantity: 1, price_cents: 1995 },
      { item_name: 'Soft Drinks', quantity: 3, price_cents: 395 },
    ],
  },
  {
    order_type: 'dine_in',
    status: 'completed',
    table_name: 'B2',
    items: [
      { item_name: 'Classic Burger', quantity: 1, price_cents: 1595 },
      { item_name: 'French Fries', quantity: 1, price_cents: 595 },
      { item_name: 'Craft Beer', quantity: 2, price_cents: 795 },
    ],
  },
  {
    order_type: 'takeout',
    status: 'in_progress',
    items: [
      { item_name: 'Bacon Cheddar Burger', quantity: 2, price_cents: 1795 },
      { item_name: 'Onion Rings', quantity: 1, price_cents: 795 },
      { item_name: 'New York Cheesecake', quantity: 1, price_cents: 1095 },
    ],
  },
  {
    order_type: 'dine_in',
    status: 'completed',
    table_name: 'P1',
    items: [
      { item_name: 'Cobb Salad', quantity: 2, price_cents: 1695 },
      { item_name: 'Grilled Atlantic Salmon', quantity: 1, price_cents: 2695 },
      { item_name: 'Classic Margarita', quantity: 2, price_cents: 1395 },
      { item_name: 'Chocolate Lava Cake', quantity: 1, price_cents: 1195 },
    ],
  },
]

// ----- FLOOR PLAN TEMPLATES -----

export interface FloorPlanTemplate {
  name: string
  description: string
  sections: string[]
  total_seats: number
  tables: DemoTable[]
}

export const FLOOR_PLAN_TEMPLATES: FloorPlanTemplate[] = [
  {
    name: 'Fine Dining',
    description: '20-seat intimate restaurant with spacious table spacing',
    sections: ['Main Dining'],
    total_seats: 20,
    tables: [
      { name: 'T1', section: 'Main Dining', seats: 2, x: 100, y: 100, shape: 'round' },
      { name: 'T2', section: 'Main Dining', seats: 2, x: 280, y: 100, shape: 'round' },
      { name: 'T3', section: 'Main Dining', seats: 2, x: 460, y: 100, shape: 'round' },
      { name: 'T4', section: 'Main Dining', seats: 4, x: 100, y: 280, shape: 'round' },
      { name: 'T5', section: 'Main Dining', seats: 4, x: 280, y: 280, shape: 'round' },
      { name: 'T6', section: 'Main Dining', seats: 6, x: 460, y: 280, shape: 'rectangle' },
    ],
  },
  {
    name: 'Casual Dining',
    description: '40-seat neighborhood restaurant with bar area',
    sections: ['Dining Room', 'Bar'],
    total_seats: 40,
    tables: [
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `D${i + 1}`,
        section: 'Dining Room',
        seats: i < 4 ? 4 : 2,
        x: 80 + (i % 4) * 130,
        y: 80 + Math.floor(i / 4) * 160,
        shape: (i % 3 === 0 ? 'round' : 'square') as 'round' | 'square',
      })),
      { name: 'B1', section: 'Bar', seats: 2, x: 80, y: 400, shape: 'square' as const },
      { name: 'B2', section: 'Bar', seats: 2, x: 200, y: 400, shape: 'square' as const },
      { name: 'B3', section: 'Bar', seats: 4, x: 320, y: 400, shape: 'round' as const },
      { name: 'B4', section: 'Bar', seats: 2, x: 440, y: 400, shape: 'square' as const },
    ],
  },
  {
    name: 'Bar',
    description: '15-seat bar-focused space with high-tops',
    sections: ['Bar'],
    total_seats: 15,
    tables: [
      { name: 'B1', section: 'Bar', seats: 2, x: 80, y: 80, shape: 'square' },
      { name: 'B2', section: 'Bar', seats: 2, x: 200, y: 80, shape: 'square' },
      { name: 'B3', section: 'Bar', seats: 2, x: 320, y: 80, shape: 'square' },
      { name: 'B4', section: 'Bar', seats: 2, x: 440, y: 80, shape: 'square' },
      { name: 'B5', section: 'Bar', seats: 3, x: 80, y: 220, shape: 'round' },
      { name: 'B6', section: 'Bar', seats: 2, x: 200, y: 220, shape: 'round' },
    ],
  },
  {
    name: 'Quick-Service',
    description: 'Counter-service setup with no table numbers',
    sections: ['Counter'],
    total_seats: 0,
    tables: [],
  },
]

/**
 * Count total menu items in demo data.
 */
export function getDemoItemCount(): number {
  return DEMO_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0)
}
