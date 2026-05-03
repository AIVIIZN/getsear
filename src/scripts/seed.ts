/**
 * Seed script for Sear POS demo data.
 * Run with: npx tsx src/scripts/seed.ts
 *
 * Uses the Supabase admin client (service_role key) to bypass RLS.
 * Idempotent: checks if seed org already exists before inserting.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env.local from project root
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Fixed IDs (deterministic for reproducibility)
// ---------------------------------------------------------------------------
const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const LOCATION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const TAX_RATE_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012'
const FLOOR_PLAN_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123'

// Users
const MARCUS_AUTH_ID = '86a3ccb9-b8e5-4320-8660-a1ebfa258ff9' // existing auth user
const USER_IDS = {
  marcus: MARCUS_AUTH_ID,
  sarah: 'e5f6a7b8-c9d0-1234-efab-345678901234',
  james: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
  maria: 'a7b8c9d0-e1f2-3456-abcd-567890123456',
  david: 'b8c9d0e1-f2a3-4567-bcde-678901234567',
  emily: 'c9d0e1f2-a3b4-5678-cdef-789012345678',
  alex: 'd0e1f2a3-b4c5-6789-defa-890123456789',
}

// Categories
const CAT_IDS = {
  starters: '01010101-0101-0101-0101-010101010101',
  salads: '02020202-0202-0202-0202-020202020202',
  burgers: '03030303-0303-0303-0303-030303030303',
  entrees: '04040404-0404-0404-0404-040404040404',
  sides: '05050505-0505-0505-0505-050505050505',
  desserts: '06060606-0606-0606-0606-060606060606',
  beverages: '07070707-0707-0707-0707-070707070707',
  kids: '08080808-0808-0808-0808-080808080808',
}

// Modifier groups
const MOD_GROUP_IDS = {
  burgerTemp: '11111111-1111-1111-1111-111111111111',
  wingSauce: '22222222-2222-2222-2222-222222222222',
  addOns: '33333333-3333-3333-3333-333333333333',
}

// Tables
const TABLE_IDS = {
  T1: 'aaa00001-0000-0000-0000-000000000001',
  T2: 'aaa00002-0000-0000-0000-000000000002',
  T3: 'aaa00003-0000-0000-0000-000000000003',
  T4: 'aaa00004-0000-0000-0000-000000000004',
  T5: 'aaa00005-0000-0000-0000-000000000005',
  T6: 'aaa00006-0000-0000-0000-000000000006',
  B1: 'aaa00007-0000-0000-0000-000000000007',
  B2: 'aaa00008-0000-0000-0000-000000000008',
  P1: 'aaa00009-0000-0000-0000-000000000009',
  P2: 'aaa00010-0000-0000-0000-000000000010',
}

// KDS stations
const KDS_IDS = {
  grill: 'bbb00001-0000-0000-0000-000000000001',
  fry: 'bbb00002-0000-0000-0000-000000000002',
  cold: 'bbb00003-0000-0000-0000-000000000003',
  expo: 'bbb00004-0000-0000-0000-000000000004',
}

// Orders
const ORDER_IDS = {
  order1: 'ccc00001-0000-0000-0000-000000000001',
  order2: 'ccc00002-0000-0000-0000-000000000002',
  order3: 'ccc00003-0000-0000-0000-000000000003',
  order4: 'ccc00004-0000-0000-0000-000000000004',
  order5: 'ccc00005-0000-0000-0000-000000000005',
}

// Menu items (subset of IDs for orders reference)
const ITEM_IDS: Record<string, string> = {}
function itemId(name: string): string {
  if (!ITEM_IDS[name]) {
    ITEM_IDS[name] = randomUUID()
  }
  return ITEM_IDS[name]
}

// Modifier IDs
const MOD_IDS: Record<string, string> = {}
function modId(name: string): string {
  if (!MOD_IDS[name]) {
    MOD_IDS[name] = randomUUID()
  }
  return MOD_IDS[name]
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function checkExists(): Promise<boolean> {
  const { data } = await (supabase.from('organizations'))
    .select('id')
    .eq('id', ORG_ID)
    .maybeSingle()
  return !!data
}

async function seedOrganization() {
  const { error } = await (supabase.from('organizations')).insert({
    id: ORG_ID,
    name: 'Sear Demo Restaurant',
    slug: 'sear-demo',
    plan: 'professional',
    subscription_status: 'active',
    owner_name: 'Marcus Rivera',
    owner_email: 'demo@getsear.com',
    owner_phone: '+15125551234',
    primary_color: '#1a1a2e',
    settings: {
      default_currency: 'USD',
      default_timezone: 'America/Chicago',
      receipt_header: 'Sear Demo Restaurant',
      receipt_footer: 'Thank you for dining with us!',
      tip_percentages: [18, 20, 25],
    },
  })
  if (error) throw new Error(`Organization insert failed: ${error.message}`)
  console.log('  + Organization: Sear Demo Restaurant')
}

async function seedLocation() {
  const { error } = await (supabase.from('locations')).insert({
    id: LOCATION_ID,
    org_id: ORG_ID,
    name: 'Downtown Austin',
    slug: 'downtown-austin',
    address_line1: '401 Congress Ave',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'US',
    latitude: 30.2672,
    longitude: -97.7431,
    phone: '+15125551234',
    email: 'downtown@seardemo.com',
    timezone: 'America/Chicago',
    currency: 'USD',
    business_hours: [
      { day: 0, open: '11:00', close: '22:00' },
      { day: 1, open: '11:00', close: '22:00' },
      { day: 2, open: '11:00', close: '22:00' },
      { day: 3, open: '11:00', close: '22:00' },
      { day: 4, open: '11:00', close: '23:00' },
      { day: 5, open: '11:00', close: '23:00' },
      { day: 6, open: '10:00', close: '23:00' },
    ],
    settings: {},
    is_active: true,
  })
  if (error) throw new Error(`Location insert failed: ${error.message}`)
  console.log('  + Location: Downtown Austin')
}

async function seedTaxRate() {
  const { error } = await (supabase.from('tax_rates')).insert({
    id: TAX_RATE_ID,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    name: 'Texas Sales Tax',
    rate: 0.0825,
    is_inclusive: false,
    is_default: true,
    applies_to: [],
    is_active: true,
  })
  if (error) throw new Error(`Tax rate insert failed: ${error.message}`)
  console.log('  + Tax Rate: Texas Sales Tax 8.25%')
}

async function seedUsers() {
  const users = [
    {
      id: USER_IDS.marcus,
      email: 'demo@getsear.com',
      first_name: 'Marcus',
      last_name: 'Rivera',
      display_name: 'Marcus R.',
      role: 'owner',
      pin_hash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // 0000
    },
    {
      id: USER_IDS.sarah,
      email: 'sarah@seardemo.com',
      first_name: 'Sarah',
      last_name: 'Chen',
      display_name: 'Sarah C.',
      role: 'manager',
      pin_hash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // 1234
    },
    {
      id: USER_IDS.james,
      email: 'james@seardemo.com',
      first_name: 'James',
      last_name: 'Patterson',
      display_name: 'James P.',
      role: 'server',
      pin_hash: null,
    },
    {
      id: USER_IDS.maria,
      email: 'maria@seardemo.com',
      first_name: 'Maria',
      last_name: 'Santos',
      display_name: 'Maria S.',
      role: 'server',
      pin_hash: null,
    },
    {
      id: USER_IDS.david,
      email: 'david@seardemo.com',
      first_name: 'David',
      last_name: 'Kim',
      display_name: 'David K.',
      role: 'bartender',
      pin_hash: null,
    },
    {
      id: USER_IDS.emily,
      email: 'emily@seardemo.com',
      first_name: 'Emily',
      last_name: 'Johnson',
      display_name: 'Emily J.',
      role: 'host',
      pin_hash: null,
    },
    {
      id: USER_IDS.alex,
      email: 'alex@seardemo.com',
      first_name: 'Alex',
      last_name: 'Torres',
      display_name: 'Alex T.',
      role: 'kitchen',
      pin_hash: null,
    },
  ]

  const rows = users.map((u) => ({
    ...u,
    org_id: ORG_ID,
    location_ids: [LOCATION_ID],
    is_active: true,
    hire_date: '2025-01-15',
    hourly_rate: u.role === 'owner' ? null : u.role === 'manager' ? '25.00' : '15.00',
    settings: {},
  }))

  const { error } = await (supabase.from('users')).insert(rows)
  if (error) throw new Error(`Users insert failed: ${error.message}`)
  console.log(`  + Users: ${users.length} staff members`)
}

async function seedMenuCategories() {
  const categories = [
    { id: CAT_IDS.starters, name: 'Starters', sort_order: 0, color: '#EF4444' },
    { id: CAT_IDS.salads, name: 'Salads', sort_order: 1, color: '#22C55E' },
    { id: CAT_IDS.burgers, name: 'Burgers', sort_order: 2, color: '#F97316' },
    { id: CAT_IDS.entrees, name: 'Entrees', sort_order: 3, color: '#3B82F6' },
    { id: CAT_IDS.sides, name: 'Sides', sort_order: 4, color: '#EAB308' },
    { id: CAT_IDS.desserts, name: 'Desserts', sort_order: 5, color: '#EC4899' },
    { id: CAT_IDS.beverages, name: 'Beverages', sort_order: 6, color: '#06B6D4' },
    { id: CAT_IDS.kids, name: 'Kids Menu', sort_order: 7, color: '#A855F7' },
  ]

  const rows = categories.map((c) => ({
    ...c,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    is_active: true,
  }))

  const { error } = await (supabase.from('menu_categories')).insert(rows)
  if (error) throw new Error(`Categories insert failed: ${error.message}`)
  console.log(`  + Menu Categories: ${categories.length}`)
}

async function seedMenuItems() {
  const items = [
    // Starters
    { id: itemId('Wings'), category_id: CAT_IDS.starters, name: 'Crispy Wings', short_name: 'WINGS', price: '14.99', prep_station: 'fryer', course: 'appetizer', sort_order: 0 },
    { id: itemId('Nachos'), category_id: CAT_IDS.starters, name: 'Loaded Nachos', short_name: 'NACHOS', price: '13.99', prep_station: 'cold', course: 'appetizer', sort_order: 1 },
    { id: itemId('Calamari'), category_id: CAT_IDS.starters, name: 'Fried Calamari', short_name: 'CALMAR', price: '12.99', prep_station: 'fryer', course: 'appetizer', sort_order: 2 },
    { id: itemId('Spinach Dip'), category_id: CAT_IDS.starters, name: 'Spinach Artichoke Dip', short_name: 'SPDIP', price: '11.99', prep_station: 'cold', course: 'appetizer', sort_order: 3 },
    // Salads
    { id: itemId('Caesar'), category_id: CAT_IDS.salads, name: 'Caesar Salad', short_name: 'CAESAR', price: '12.99', prep_station: 'cold', course: 'appetizer', sort_order: 0 },
    { id: itemId('House Salad'), category_id: CAT_IDS.salads, name: 'House Salad', short_name: 'HOUSE', price: '10.99', prep_station: 'cold', course: 'appetizer', sort_order: 1 },
    { id: itemId('Wedge'), category_id: CAT_IDS.salads, name: 'Wedge Salad', short_name: 'WEDGE', price: '11.99', prep_station: 'cold', course: 'appetizer', sort_order: 2 },
    // Burgers
    { id: itemId('Classic Burger'), category_id: CAT_IDS.burgers, name: 'Classic Smash Burger', short_name: 'CLBURG', price: '16.99', prep_station: 'grill', course: 'entree', sort_order: 0 },
    { id: itemId('BBQ Burger'), category_id: CAT_IDS.burgers, name: 'Smoky BBQ Burger', short_name: 'BBQBRG', price: '18.99', prep_station: 'grill', course: 'entree', sort_order: 1 },
    { id: itemId('Mushroom Burger'), category_id: CAT_IDS.burgers, name: 'Wild Mushroom Burger', short_name: 'MUSHBRG', price: '18.99', prep_station: 'grill', course: 'entree', sort_order: 2 },
    { id: itemId('Veggie Burger'), category_id: CAT_IDS.burgers, name: 'Black Bean Veggie Burger', short_name: 'VEGBRG', price: '15.99', prep_station: 'grill', course: 'entree', sort_order: 3 },
    // Entrees
    { id: itemId('Ribeye'), category_id: CAT_IDS.entrees, name: '12oz Ribeye Steak', short_name: 'RIBEYE', price: '38.99', prep_station: 'grill', course: 'entree', sort_order: 0 },
    { id: itemId('Salmon'), category_id: CAT_IDS.entrees, name: 'Pan-Seared Salmon', short_name: 'SALMON', price: '28.99', prep_station: 'grill', course: 'entree', sort_order: 1 },
    { id: itemId('Chicken'), category_id: CAT_IDS.entrees, name: 'Grilled Chicken Breast', short_name: 'CHKBRST', price: '22.99', prep_station: 'grill', course: 'entree', sort_order: 2 },
    { id: itemId('Fish Tacos'), category_id: CAT_IDS.entrees, name: 'Baja Fish Tacos', short_name: 'FSHTAC', price: '19.99', prep_station: 'fryer', course: 'entree', sort_order: 3 },
    { id: itemId('Pasta'), category_id: CAT_IDS.entrees, name: 'Penne Arrabiata', short_name: 'PASTA', price: '18.99', prep_station: 'grill', course: 'entree', sort_order: 4 },
    // Sides
    { id: itemId('Fries'), category_id: CAT_IDS.sides, name: 'Seasoned Fries', short_name: 'FRIES', price: '5.99', prep_station: 'fryer', course: 'entree', sort_order: 0 },
    { id: itemId('Sweet Potato Fries'), category_id: CAT_IDS.sides, name: 'Sweet Potato Fries', short_name: 'SPFRIES', price: '6.99', prep_station: 'fryer', course: 'entree', sort_order: 1 },
    { id: itemId('Onion Rings'), category_id: CAT_IDS.sides, name: 'Crispy Onion Rings', short_name: 'RINGS', price: '7.99', prep_station: 'fryer', course: 'entree', sort_order: 2 },
    { id: itemId('Mac n Cheese'), category_id: CAT_IDS.sides, name: 'Truffle Mac & Cheese', short_name: 'MAC', price: '8.99', prep_station: 'grill', course: 'entree', sort_order: 3 },
    { id: itemId('Coleslaw'), category_id: CAT_IDS.sides, name: 'House Coleslaw', short_name: 'SLAW', price: '4.99', prep_station: 'cold', course: 'entree', sort_order: 4 },
    // Desserts
    { id: itemId('Brownie'), category_id: CAT_IDS.desserts, name: 'Warm Chocolate Brownie', short_name: 'BROWNIE', price: '9.99', prep_station: 'cold', course: 'dessert', sort_order: 0 },
    { id: itemId('Cheesecake'), category_id: CAT_IDS.desserts, name: 'NY Cheesecake', short_name: 'CHZCKE', price: '10.99', prep_station: 'cold', course: 'dessert', sort_order: 1 },
    { id: itemId('Ice Cream'), category_id: CAT_IDS.desserts, name: 'House Ice Cream', short_name: 'ICECR', price: '7.99', prep_station: 'cold', course: 'dessert', sort_order: 2 },
    // Beverages
    { id: itemId('Soda'), category_id: CAT_IDS.beverages, name: 'Fountain Soda', short_name: 'SODA', price: '3.49', prep_station: 'cold', course: 'drink', sort_order: 0 },
    { id: itemId('Iced Tea'), category_id: CAT_IDS.beverages, name: 'Fresh Iced Tea', short_name: 'TEA', price: '3.49', prep_station: 'cold', course: 'drink', sort_order: 1 },
    { id: itemId('Lemonade'), category_id: CAT_IDS.beverages, name: 'House Lemonade', short_name: 'LEMON', price: '4.49', prep_station: 'cold', course: 'drink', sort_order: 2 },
    // Kids
    { id: itemId('Kids Burger'), category_id: CAT_IDS.kids, name: 'Kids Cheeseburger', short_name: 'KBURG', price: '8.99', prep_station: 'grill', course: 'entree', sort_order: 0 },
    { id: itemId('Kids Nuggets'), category_id: CAT_IDS.kids, name: 'Chicken Nuggets', short_name: 'KNUGS', price: '7.99', prep_station: 'fryer', course: 'entree', sort_order: 1 },
    { id: itemId('Kids Mac'), category_id: CAT_IDS.kids, name: 'Kids Mac & Cheese', short_name: 'KMAC', price: '6.99', prep_station: 'grill', course: 'entree', sort_order: 2 },
  ]

  const rows = items.map((item, i) => ({
    ...item,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    tax_rate_id: TAX_RATE_ID,
    is_taxable: true,
    is_active: true,
    is_86d: false,
  }))

  const { error } = await (supabase.from('menu_items')).insert(rows)
  if (error) throw new Error(`Menu items insert failed: ${error.message}`)
  console.log(`  + Menu Items: ${items.length}`)
}

async function seedModifierGroups() {
  const groups = [
    {
      id: MOD_GROUP_IDS.burgerTemp,
      name: 'Burger Temperature',
      min_selections: 1,
      max_selections: 1,
      is_required_prompt: true,
      sort_order: 0,
    },
    {
      id: MOD_GROUP_IDS.wingSauce,
      name: 'Wing Sauce',
      min_selections: 1,
      max_selections: 1,
      is_required_prompt: true,
      sort_order: 1,
    },
    {
      id: MOD_GROUP_IDS.addOns,
      name: 'Add-Ons',
      min_selections: 0,
      max_selections: 4,
      is_required_prompt: false,
      sort_order: 2,
    },
  ]

  const rows = groups.map((g) => ({ ...g, org_id: ORG_ID }))
  const { error } = await (supabase.from('modifier_groups')).insert(rows)
  if (error) throw new Error(`Modifier groups insert failed: ${error.message}`)
  console.log(`  + Modifier Groups: ${groups.length}`)
}

async function seedModifiers() {
  const modifiers = [
    // Burger Temperature
    { id: modId('Rare'), modifier_group_id: MOD_GROUP_IDS.burgerTemp, name: 'Rare', price_adjustment: '0.00', sort_order: 0 },
    { id: modId('Medium Rare'), modifier_group_id: MOD_GROUP_IDS.burgerTemp, name: 'Medium Rare', price_adjustment: '0.00', sort_order: 1 },
    { id: modId('Medium'), modifier_group_id: MOD_GROUP_IDS.burgerTemp, name: 'Medium', price_adjustment: '0.00', is_default: true, sort_order: 2 },
    { id: modId('Medium Well'), modifier_group_id: MOD_GROUP_IDS.burgerTemp, name: 'Medium Well', price_adjustment: '0.00', sort_order: 3 },
    { id: modId('Well Done'), modifier_group_id: MOD_GROUP_IDS.burgerTemp, name: 'Well Done', price_adjustment: '0.00', sort_order: 4 },
    // Wing Sauce
    { id: modId('Buffalo'), modifier_group_id: MOD_GROUP_IDS.wingSauce, name: 'Buffalo', price_adjustment: '0.00', is_default: true, sort_order: 0 },
    { id: modId('BBQ'), modifier_group_id: MOD_GROUP_IDS.wingSauce, name: 'BBQ', price_adjustment: '0.00', sort_order: 1 },
    { id: modId('Garlic Parmesan'), modifier_group_id: MOD_GROUP_IDS.wingSauce, name: 'Garlic Parmesan', price_adjustment: '0.00', sort_order: 2 },
    { id: modId('Lemon Pepper'), modifier_group_id: MOD_GROUP_IDS.wingSauce, name: 'Lemon Pepper', price_adjustment: '0.00', sort_order: 3 },
    // Add-Ons
    { id: modId('Bacon'), modifier_group_id: MOD_GROUP_IDS.addOns, name: 'Bacon', price_adjustment: '2.50', sort_order: 0 },
    { id: modId('Avocado'), modifier_group_id: MOD_GROUP_IDS.addOns, name: 'Avocado', price_adjustment: '2.00', sort_order: 1 },
    { id: modId('Extra Cheese'), modifier_group_id: MOD_GROUP_IDS.addOns, name: 'Extra Cheese', price_adjustment: '1.50', sort_order: 2 },
    { id: modId('Fried Egg'), modifier_group_id: MOD_GROUP_IDS.addOns, name: 'Fried Egg', price_adjustment: '2.00', sort_order: 3 },
  ]

  // Total: 13 modifiers listed, but spec asks for 15. Add 2 more to Add-Ons:
  modifiers.push(
    { id: modId('Jalapenos'), modifier_group_id: MOD_GROUP_IDS.addOns, name: 'Jalapenos', price_adjustment: '1.00', sort_order: 4 },
    { id: modId('Sauteed Onions'), modifier_group_id: MOD_GROUP_IDS.addOns, name: 'Sauteed Onions', price_adjustment: '1.00', sort_order: 5 },
  )

  const rows = modifiers.map((m) => ({
    ...m,
    org_id: ORG_ID,
    is_active: true,
    is_default: ('is_default' in m ? m.is_default : false) ?? false,
  }))

  const { error } = await (supabase.from('modifiers')).insert(rows)
  if (error) throw new Error(`Modifiers insert failed: ${error.message}`)
  console.log(`  + Modifiers: ${modifiers.length}`)
}

async function seedMenuItemModifierGroups() {
  const links: { menu_item_id: string; modifier_group_id: string; sort_order: number }[] = []

  // Burger Temperature -> all burgers + ribeye
  const burgerItems = [
    itemId('Classic Burger'), itemId('BBQ Burger'),
    itemId('Mushroom Burger'), itemId('Veggie Burger'),
    itemId('Ribeye'),
  ]
  for (const id of burgerItems) {
    links.push({ menu_item_id: id, modifier_group_id: MOD_GROUP_IDS.burgerTemp, sort_order: 0 })
  }

  // Wing Sauce -> wings
  links.push({ menu_item_id: itemId('Wings'), modifier_group_id: MOD_GROUP_IDS.wingSauce, sort_order: 0 })

  // Add-Ons -> burgers
  const burgerOnlyItems = [
    itemId('Classic Burger'), itemId('BBQ Burger'),
    itemId('Mushroom Burger'), itemId('Veggie Burger'),
  ]
  for (const id of burgerOnlyItems) {
    links.push({ menu_item_id: id, modifier_group_id: MOD_GROUP_IDS.addOns, sort_order: 1 })
  }

  const { error } = await (supabase.from('menu_item_modifier_groups')).insert(links)
  if (error) throw new Error(`Item-modifier links insert failed: ${error.message}`)
  console.log(`  + Menu Item <-> Modifier Group links: ${links.length}`)
}

async function seedFloorPlan() {
  const { error } = await (supabase.from('floor_plans')).insert({
    id: FLOOR_PLAN_ID,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    name: 'Main Floor',
    sort_order: 0,
    is_active: true,
    canvas_width: 1200,
    canvas_height: 800,
  })
  if (error) throw new Error(`Floor plan insert failed: ${error.message}`)
  console.log('  + Floor Plan: Main Floor')
}

async function seedTables() {
  const tables = [
    // Main dining (T1-T6)
    { id: TABLE_IDS.T1, name: 'T1', capacity: 4, shape: 'square', pos_x: 100, pos_y: 100, section: 'Main', sort_order: 0 },
    { id: TABLE_IDS.T2, name: 'T2', capacity: 4, shape: 'square', pos_x: 250, pos_y: 100, section: 'Main', sort_order: 1 },
    { id: TABLE_IDS.T3, name: 'T3', capacity: 6, shape: 'rectangle', pos_x: 400, pos_y: 100, width: 120, height: 80, section: 'Main', sort_order: 2 },
    { id: TABLE_IDS.T4, name: 'T4', capacity: 4, shape: 'round', pos_x: 100, pos_y: 300, section: 'Main', sort_order: 3 },
    { id: TABLE_IDS.T5, name: 'T5', capacity: 8, shape: 'rectangle', pos_x: 300, pos_y: 300, width: 160, height: 80, section: 'Main', sort_order: 4 },
    { id: TABLE_IDS.T6, name: 'T6', capacity: 2, shape: 'round', pos_x: 550, pos_y: 300, section: 'Main', sort_order: 5 },
    // Bar (B1-B2)
    { id: TABLE_IDS.B1, name: 'B1', capacity: 2, shape: 'bar', pos_x: 800, pos_y: 100, section: 'Bar', sort_order: 6 },
    { id: TABLE_IDS.B2, name: 'B2', capacity: 2, shape: 'bar', pos_x: 800, pos_y: 200, section: 'Bar', sort_order: 7 },
    // Patio (P1-P2)
    { id: TABLE_IDS.P1, name: 'P1', capacity: 4, shape: 'round', pos_x: 900, pos_y: 500, section: 'Patio', sort_order: 8 },
    { id: TABLE_IDS.P2, name: 'P2', capacity: 6, shape: 'rectangle', pos_x: 1050, pos_y: 500, width: 120, height: 80, section: 'Patio', sort_order: 9 },
  ]

  const rows = tables.map((t) => ({
    width: 80,
    height: 80,
    rotation: 0,
    ...t,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    floor_plan_id: FLOOR_PLAN_ID,
    status: 'available',
    is_active: true,
  }))

  const { error } = await (supabase.from('tables')).insert(rows)
  if (error) throw new Error(`Tables insert failed: ${error.message}`)
  console.log(`  + Tables: ${tables.length}`)
}

async function seedKdsStations() {
  const stations = [
    { id: KDS_IDS.grill, name: 'Grill', station_type: 'prep', prep_stations: ['grill'], sort_order: 0 },
    { id: KDS_IDS.fry, name: 'Fry', station_type: 'prep', prep_stations: ['fryer'], sort_order: 1 },
    { id: KDS_IDS.cold, name: 'Cold', station_type: 'prep', prep_stations: ['cold'], sort_order: 2 },
    { id: KDS_IDS.expo, name: 'Expo', station_type: 'expo', prep_stations: ['grill', 'fryer', 'cold'], sort_order: 3 },
  ]

  const rows = stations.map((s) => ({
    ...s,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    is_active: true,
    display_settings: {},
  }))

  const { error } = await (supabase.from('kds_stations')).insert(rows)
  if (error) throw new Error(`KDS stations insert failed: ${error.message}`)
  console.log(`  + KDS Stations: ${stations.length}`)
}

async function seedOrders() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const orders = [
    {
      id: ORDER_IDS.order1,
      order_number: 1,
      display_number: 'A-001',
      order_type: 'dine_in',
      status: 'closed',
      server_id: USER_IDS.james,
      table_id: TABLE_IDS.T1,
      guest_count: 2,
      subtotal: '44.97',
      tax_total: '3.71',
      tip_total: '8.00',
      total: '56.68',
      amount_paid: '56.68',
      balance_due: '0.00',
      opened_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      source: 'pos',
    },
    {
      id: ORDER_IDS.order2,
      order_number: 2,
      display_number: 'A-002',
      order_type: 'dine_in',
      status: 'closed',
      server_id: USER_IDS.maria,
      table_id: TABLE_IDS.T3,
      guest_count: 4,
      subtotal: '89.96',
      tax_total: '7.42',
      tip_total: '18.00',
      total: '115.38',
      amount_paid: '115.38',
      balance_due: '0.00',
      opened_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString(),
      source: 'pos',
    },
    {
      id: ORDER_IDS.order3,
      order_number: 3,
      display_number: 'A-003',
      order_type: 'bar',
      status: 'open',
      server_id: USER_IDS.david,
      table_id: TABLE_IDS.B1,
      guest_count: 1,
      subtotal: '21.48',
      tax_total: '1.77',
      tip_total: '0.00',
      total: '23.25',
      amount_paid: '0.00',
      balance_due: '23.25',
      opened_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      source: 'pos',
    },
    {
      id: ORDER_IDS.order4,
      order_number: 4,
      display_number: 'A-004',
      order_type: 'takeout',
      status: 'closed',
      server_id: USER_IDS.james,
      guest_count: 1,
      guest_name: 'Mike',
      guest_phone: '+15125559876',
      subtotal: '25.98',
      tax_total: '2.14',
      tip_total: '5.00',
      total: '33.12',
      amount_paid: '33.12',
      balance_due: '0.00',
      opened_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 4.5 * 60 * 60 * 1000).toISOString(),
      source: 'pos',
    },
    {
      id: ORDER_IDS.order5,
      order_number: 5,
      display_number: 'A-005',
      order_type: 'dine_in',
      status: 'open',
      server_id: USER_IDS.maria,
      table_id: TABLE_IDS.T5,
      guest_count: 6,
      subtotal: '142.93',
      tax_total: '11.79',
      tip_total: '0.00',
      total: '154.72',
      amount_paid: '0.00',
      balance_due: '154.72',
      opened_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      source: 'pos',
    },
  ]

  const rows = orders.map((o) => ({
    ...o,
    org_id: ORG_ID,
    location_id: LOCATION_ID,
    discount_total: '0.00',
    notes: null,
    metadata: {},
    created_by: o.server_id,
  }))

  const { error } = await (supabase.from('orders')).insert(rows)
  if (error) throw new Error(`Orders insert failed: ${error.message}`)
  console.log(`  + Orders: ${orders.length}`)
}

async function seedOrderItems() {
  const items = [
    // Order 1: Caesar + Classic Burger + Fries
    { order_id: ORDER_IDS.order1, menu_item_id: itemId('Caesar'), name: 'Caesar Salad', unit_price: '12.99', quantity: 1, sort_order: 0, course: 1, prep_station: 'cold' },
    { order_id: ORDER_IDS.order1, menu_item_id: itemId('Classic Burger'), name: 'Classic Smash Burger', unit_price: '16.99', quantity: 1, sort_order: 1, course: 2, prep_station: 'grill' },
    { order_id: ORDER_IDS.order1, menu_item_id: itemId('Fries'), name: 'Seasoned Fries', unit_price: '5.99', quantity: 1, sort_order: 2, course: 2, prep_station: 'fryer' },
    // Order 2: 2x Wings + 2x Ribeye (big table)
    { order_id: ORDER_IDS.order2, menu_item_id: itemId('Wings'), name: 'Crispy Wings', unit_price: '14.99', quantity: 2, sort_order: 0, course: 1, prep_station: 'fryer' },
    { order_id: ORDER_IDS.order2, menu_item_id: itemId('Ribeye'), name: '12oz Ribeye Steak', unit_price: '38.99', quantity: 2, sort_order: 1, course: 2, prep_station: 'grill' },
    // Order 3: Nachos + 2x Soda (bar)
    { order_id: ORDER_IDS.order3, menu_item_id: itemId('Nachos'), name: 'Loaded Nachos', unit_price: '13.99', quantity: 1, sort_order: 0, course: 1, prep_station: 'cold' },
    { order_id: ORDER_IDS.order3, menu_item_id: itemId('Soda'), name: 'Fountain Soda', unit_price: '3.49', quantity: 2, sort_order: 1, course: 1, prep_station: 'cold' },
    // Order 4: BBQ Burger + Onion Rings (takeout)
    { order_id: ORDER_IDS.order4, menu_item_id: itemId('BBQ Burger'), name: 'Smoky BBQ Burger', unit_price: '18.99', quantity: 1, sort_order: 0, course: 1, prep_station: 'grill' },
    { order_id: ORDER_IDS.order4, menu_item_id: itemId('Onion Rings'), name: 'Crispy Onion Rings', unit_price: '7.99', quantity: 1, sort_order: 1, course: 1, prep_station: 'fryer' },
    // Order 5: Big party — Calamari, Salmon, Chicken, Pasta, Mac, Brownie, Cheesecake
    { order_id: ORDER_IDS.order5, menu_item_id: itemId('Calamari'), name: 'Fried Calamari', unit_price: '12.99', quantity: 1, sort_order: 0, course: 1, prep_station: 'fryer' },
    { order_id: ORDER_IDS.order5, menu_item_id: itemId('Salmon'), name: 'Pan-Seared Salmon', unit_price: '28.99', quantity: 2, sort_order: 1, course: 2, prep_station: 'grill' },
    { order_id: ORDER_IDS.order5, menu_item_id: itemId('Chicken'), name: 'Grilled Chicken Breast', unit_price: '22.99', quantity: 1, sort_order: 2, course: 2, prep_station: 'grill' },
    { order_id: ORDER_IDS.order5, menu_item_id: itemId('Pasta'), name: 'Penne Arrabiata', unit_price: '18.99', quantity: 1, sort_order: 3, course: 2, prep_station: 'grill' },
    { order_id: ORDER_IDS.order5, menu_item_id: itemId('Mac n Cheese'), name: 'Truffle Mac & Cheese', unit_price: '8.99', quantity: 2, sort_order: 4, course: 2, prep_station: 'grill' },
    { order_id: ORDER_IDS.order5, menu_item_id: itemId('Brownie'), name: 'Warm Chocolate Brownie', unit_price: '9.99', quantity: 1, sort_order: 5, course: 3, prep_station: 'cold' },
  ]

  const rows = items.map((item) => ({
    id: randomUUID(),
    ...item,
    org_id: ORG_ID,
    short_name: null,
    modifier_total: '0.00',
    discount_amount: '0.00',
    tax_amount: '0.00',
    line_total: (parseFloat(item.unit_price) * item.quantity).toFixed(2),
    seat_number: null,
    is_sent: true,
    is_fired: true,
    is_ready: false,
    is_served: false,
    is_voided: false,
    is_comped: false,
    notes: null,
  }))

  const { error } = await (supabase.from('order_items')).insert(rows)
  if (error) throw new Error(`Order items insert failed: ${error.message}`)
  console.log(`  + Order Items: ${items.length}`)
}

async function seedPayments() {
  const payments = [
    {
      id: randomUUID(),
      org_id: ORG_ID,
      order_id: ORDER_IDS.order1,
      payment_method: 'credit_card',
      status: 'settled',
      amount: '48.68',
      tip_amount: '8.00',
      total_amount: '56.68',
      card_brand: 'visa',
      card_last_four: '4242',
      auth_code: '123456',
      processed_by: USER_IDS.james,
      processed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: randomUUID(),
      org_id: ORG_ID,
      order_id: ORDER_IDS.order4,
      payment_method: 'cash',
      status: 'settled',
      amount: '28.12',
      tip_amount: '5.00',
      total_amount: '33.12',
      cash_tendered: '40.00',
      change_due: '6.88',
      processed_by: USER_IDS.james,
      processed_at: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const { error } = await (supabase.from('payments')).insert(payments)
  if (error) throw new Error(`Payments insert failed: ${error.message}`)
  console.log(`  + Payments: ${payments.length}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Sear POS — Seed Script')
  console.log('======================')
  console.log()

  const exists = await checkExists()
  if (exists) {
    console.log('Seed data already exists (org_id: ' + ORG_ID + '). Skipping.')
    console.log('Run `npm run reset` to drop and re-seed.')
    process.exit(0)
  }

  console.log('Seeding demo data...')
  console.log()

  await seedOrganization()
  await seedLocation()
  await seedTaxRate()
  await seedUsers()
  await seedMenuCategories()
  await seedMenuItems()
  await seedModifierGroups()
  await seedModifiers()
  await seedMenuItemModifierGroups()
  await seedFloorPlan()
  await seedTables()
  await seedKdsStations()
  await seedOrders()
  await seedOrderItems()
  await seedPayments()

  console.log()
  console.log('Seed complete!')
  console.log()
  console.log('Summary:')
  console.log('  - 1 organization (Sear Demo Restaurant)')
  console.log('  - 1 location (Downtown Austin)')
  console.log('  - 1 tax rate (TX 8.25%)')
  console.log('  - 7 users')
  console.log('  - 8 menu categories')
  console.log('  - 30 menu items')
  console.log('  - 3 modifier groups, 15 modifiers')
  console.log('  - 1 floor plan, 10 tables')
  console.log('  - 4 KDS stations')
  console.log('  - 5 orders with items')
  console.log('  - 2 payments')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
