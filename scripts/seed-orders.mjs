/**
 * Seed realistic order + payment data via the app's API.
 *
 * Uses Playwright to log in (getting auth cookies), then calls the REST API
 * through page.evaluate(fetch(...)) so every request is authenticated.
 *
 * Run:  node scripts/seed-orders.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo@getsear.com';
const PASSWORD = 'demo1234';

const LOCATION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

// ── Helpers ────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Call a JSON API endpoint through page.evaluate so cookies are sent. */
async function api(page, method, path, body = null) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      const json = await res.json();
      if (!res.ok) {
        return { _error: true, status: res.status, ...json };
      }
      return json;
    },
    { method, url: `${BASE}${path}`, body }
  );
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('Seed Orders — Sear POS');
  console.log('======================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ── Step 1: Log in ──────────────────────────────────────────────────
  console.log('1. Logging in as demo@getsear.com ...');

  // Navigate to the app first so fetch() works in the page context
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const loginResult = await api(page, 'POST', '/api/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });

  if (loginResult._error) {
    console.error('   Login failed:', loginResult);
    await browser.close();
    process.exit(1);
  }
  console.log(`   Logged in as ${loginResult.user.display_name} (${loginResult.user.role})\n`);

  // ── Step 2: Fetch menu items ────────────────────────────────────────
  console.log('2. Fetching menu items ...');
  const menuResult = await api(page, 'GET', '/api/menu/items');

  if (menuResult._error || !menuResult.data || menuResult.data.length === 0) {
    console.error('   No menu items found. Run the base seed first (npx tsx src/scripts/seed.ts)');
    await browser.close();
    process.exit(1);
  }

  const menuItems = menuResult.data.filter((i) => i.is_active && !i.is_86d);
  console.log(`   Found ${menuItems.length} active menu items`);

  // Log a sample item to verify price format
  if (menuItems.length > 0) {
    const sample = menuItems[0];
    console.log(`   Sample: ${sample.name} price=${sample.price} (type: ${typeof sample.price})`);
  }
  console.log();

  // ── Step 3: Create orders ───────────────────────────────────────────
  const ORDER_COUNT = 10;
  const orderTypes = ['dine_in', 'dine_in', 'dine_in', 'dine_in', 'takeout', 'bar', 'dine_in', 'dine_in'];
  const guestNames = ['Mike', 'Sarah', 'Tom', 'Lisa', 'Jake', 'Emma', 'Carlos', 'Amy', 'Ben', 'Nina'];

  console.log(`3. Creating ${ORDER_COUNT} orders ...\n`);

  const createdOrders = [];

  for (let i = 0; i < ORDER_COUNT; i++) {
    const orderType = pick(orderTypes);
    const guestCount = orderType === 'dine_in' ? randInt(1, 6) : 1;

    const orderBody = {
      order_type: orderType,
      location_id: LOCATION_ID,
      guest_count: guestCount,
      source: 'pos',
    };

    // Do NOT send table_id — Zod UUID validation is strict and the table IDs
    // in the DB may not pass. The field is optional anyway.
    if (orderType === 'takeout') {
      orderBody.guest_name = pick(guestNames);
      orderBody.guest_phone = `+1512555${String(randInt(1000, 9999))}`;
    }

    // Create order
    const orderResult = await api(page, 'POST', '/api/orders', orderBody);
    if (orderResult._error) {
      console.error(`   Order ${i + 1} creation failed:`, orderResult);
      continue;
    }

    const order = orderResult.data;
    const orderId = order.id;
    console.log(`   Order ${i + 1}: ${order.display_number} (${orderType}, ${guestCount} guest${guestCount > 1 ? 's' : ''})`);

    // Add 3-5 items
    const itemCount = randInt(3, 5);
    const usedItemIds = new Set();
    let itemsAdded = 0;

    for (let j = 0; j < itemCount; j++) {
      // Pick a random item not already added
      let item;
      let attempts = 0;
      do {
        item = pick(menuItems);
        attempts++;
      } while (usedItemIds.has(item.id) && attempts < 20);

      if (usedItemIds.has(item.id)) {
        item = menuItems[j % menuItems.length]; // fallback
      }
      usedItemIds.add(item.id);

      const qty = j === 0 ? 1 : randInt(1, 2);

      // Ensure unit_price is always a string (the API uses z.string().regex())
      const priceStr = typeof item.price === 'number'
        ? item.price.toFixed(2)
        : String(item.price);

      const itemResult = await api(page, 'POST', `/api/orders/${orderId}/items`, {
        menu_item_id: item.id,
        name: item.name,
        unit_price: priceStr,
        quantity: qty,
        course: 1,
        notes: '',
      });

      if (itemResult._error) {
        console.error(`     Item add failed: ${item.name}`, JSON.stringify(itemResult.details || itemResult.error));
      } else {
        itemsAdded++;
        console.log(`     + ${qty}x ${item.name} @ $${priceStr}`);
      }
    }

    if (itemsAdded === 0) {
      console.log(`     No items added, skipping send`);
      console.log();
      continue;
    }

    // Send to kitchen
    const sendResult = await api(page, 'POST', `/api/orders/${orderId}/send`);
    if (sendResult._error) {
      console.error(`     Send failed:`, sendResult.error);
    } else {
      console.log(`     -> Sent to kitchen (status: ${sendResult.data?.status})`);
    }

    // Re-fetch order to get calculated totals
    const orderRefresh = await api(page, 'GET', `/api/orders/${orderId}`);
    const updatedOrder = orderRefresh._error ? order : orderRefresh.data;

    createdOrders.push({
      id: orderId,
      display_number: order.display_number,
      total: updatedOrder?.total || order.total,
      balance_due: updatedOrder?.balance_due || order.balance_due,
    });

    console.log(`     Total: $${updatedOrder?.total || '0.00'}`);
    console.log();
  }

  if (createdOrders.length === 0) {
    console.error('No orders were created. Exiting.');
    await browser.close();
    process.exit(1);
  }

  // ── Step 4: Process payments for most orders ────────────────────────
  console.log('4. Processing payments ...\n');

  const tipPercentages = [0, 15, 18, 20, 22, 25];

  // Pay for 7 out of 10 orders (leave 3 open for variety in reports)
  const ordersToPay = createdOrders.slice(0, Math.min(7, createdOrders.length));

  for (const order of ordersToPay) {
    const totalDollars = parseFloat(order.total || '0');
    if (totalDollars <= 0) {
      console.log(`   ${order.display_number}: $0 total, skipping payment`);
      continue;
    }

    const amountCents = Math.round(totalDollars * 100);
    const tipPct = pick(tipPercentages);
    const tipCents = Math.round(amountCents * tipPct / 100);

    // Use cash only — card payments will fail without a real processor
    const totalWithTip = amountCents + tipCents;
    const roundTo = totalWithTip > 5000 ? 1000 : 500;
    const cashTendered = Math.ceil(totalWithTip / roundTo) * roundTo;

    const paymentBody = {
      order_id: order.id,
      location_id: LOCATION_ID,
      payment_method: 'cash',
      amount_cents: amountCents,
      tip_cents: tipCents,
      mode: 'sale',
      cash_tendered_cents: cashTendered,
    };

    const payResult = await api(page, 'POST', '/api/payments/process', paymentBody);

    if (payResult._error) {
      console.error(`   ${order.display_number}: Payment failed:`, payResult.error);
    } else {
      const tipDollars = (tipCents / 100).toFixed(2);
      const changeDollars = ((cashTendered - totalWithTip) / 100).toFixed(2);
      console.log(`   ${order.display_number}: Paid $${totalDollars.toFixed(2)} + $${tipDollars} tip (cash, change $${changeDollars})`);
    }
  }

  const unpaidCount = createdOrders.length - ordersToPay.length;
  if (unpaidCount > 0) {
    console.log(`\n   Left ${unpaidCount} orders unpaid (open)\n`);
  } else {
    console.log();
  }

  // ── Step 5: Verify orders appear ────────────────────────────────────
  console.log('5. Verifying orders ...');

  const listResult = await api(
    page,
    'GET',
    `/api/orders?location_id=${LOCATION_ID}&limit=50`
  );

  if (listResult._error) {
    console.error('   Failed to list orders:', listResult);
  } else {
    const total = listResult.pagination?.total ?? listResult.data?.length ?? 0;
    console.log(`   Found ${total} total orders for this location`);

    // Show summary
    const statuses = {};
    let totalRevenue = 0;
    for (const o of listResult.data || []) {
      statuses[o.status] = (statuses[o.status] || 0) + 1;
      if (o.status === 'closed') {
        totalRevenue += parseFloat(o.total || '0');
      }
    }
    console.log('   Status breakdown:', statuses);
    console.log(`   Total revenue (closed orders): $${totalRevenue.toFixed(2)}`);
  }

  console.log('\nDone! Orders and payments have been seeded.');
  console.log('Visit http://localhost:3000/reports to see the data.\n');

  await browser.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
