/**
 * Kitchen Ticket Formatter
 *
 * Generates ESC/POS commands for kitchen tickets. These tickets use large text,
 * NO prices, and emphasize allergen warnings, course/fire status, and cook
 * preferences so line cooks can read them at a glance.
 *
 * 80mm thermal paper = 42 characters per line at normal width.
 * Double-width text = 21 characters per line.
 */

// ---------------------------------------------------------------------------
// Type stubs for the ESC/POS builder from Worker 5.1
// These match the shared interface contract. Once the real module lands,
// these stubs will be replaced by the actual imports.
// ---------------------------------------------------------------------------

interface ESCPOSBuilder {
  text(content: string): ESCPOSBuilder
  bold(on: boolean): ESCPOSBuilder
  align(alignment: 'left' | 'center' | 'right'): ESCPOSBuilder
  doubleHeight(on: boolean): ESCPOSBuilder
  doubleWidth(on: boolean): ESCPOSBuilder
  fontSize(width: number, height: number): ESCPOSBuilder
  underline(on: boolean): ESCPOSBuilder
  lineFeed(lines?: number): ESCPOSBuilder
  cut(partial?: boolean): ESCPOSBuilder
  cashDrawerKick(pin: 2 | 5, duration: number): ESCPOSBuilder
  build(): Uint8Array
}

/**
 * Lazy-import helper. Falls back to a minimal stub if the real module
 * is not yet available (parallel worker build scenario).
 */
async function getESCPOSBuilder(): Promise<new () => ESCPOSBuilder> {
  try {
    const mod = await import('@/lib/printing/escpos')
    return (mod as { ESCPOSBuilder: new () => ESCPOSBuilder }).ESCPOSBuilder
  } catch {
    throw new Error(
      'ESCPOSBuilder not available. Ensure @/lib/printing/escpos is built first.'
    )
  }
}

// ---------------------------------------------------------------------------
// Kitchen Ticket Data Types
// ---------------------------------------------------------------------------

export interface KitchenTicketModifier {
  name: string
  /** If true, rendered bold with ** delimiters (e.g. temperature) */
  is_cook_preference: boolean
}

export interface KitchenTicketItem {
  id: string
  name: string
  quantity: number
  seat_number: number | null
  course: number
  modifiers: KitchenTicketModifier[]
  special_instructions: string
  /** Allergens associated with this item */
  allergens: string[]
  /** Whether this item has been voided */
  voided: boolean
  void_reason: string | null
}

export interface KitchenTicketOrder {
  id: string
  order_number: string
  table_name: string | null
  server_name: string
  guest_count: number
  created_at: string
  /** Whether the order is flagged as RUSH */
  is_rush: boolean
  /** Whether the guest is VIP */
  is_vip: boolean
  order_type: string
}

export interface KitchenStation {
  name: string
}

export interface KitchenTicketConfig {
  /** Width in characters (default 42 for 80mm) */
  line_width: number
}

export type KitchenTicketVariant =
  | 'new_order'
  | 're_fire'
  | 'void'
  | 'modification'

export interface KitchenTicketOptions {
  variant: KitchenTicketVariant
  /** Reason for re-fire (only used when variant is 're_fire') */
  refire_reason?: string
  /** Items that changed (only used when variant is 'modification') */
  modified_items?: ModifiedItem[]
}

export interface ModifiedItem {
  item_name: string
  change_description: string
}

interface CourseGroup {
  course: number
  fire: boolean
  items: KitchenTicketItem[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LINE_WIDTH = 42
const SEPARATOR_THIN = '\u2500' // ─
const SEPARATOR_THICK = '\u2550' // ═

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function repeatChar(char: string, count: number): string {
  return char.repeat(count)
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate)
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes} ${period}`
}

function groupItemsByCourse(items: KitchenTicketItem[]): CourseGroup[] {
  const courseMap = new Map<number, KitchenTicketItem[]>()

  for (const item of items) {
    const course = item.course || 1
    if (!courseMap.has(course)) {
      courseMap.set(course, [])
    }
    courseMap.get(course)!.push(item)
  }

  const sorted = Array.from(courseMap.entries()).sort(([a], [b]) => a - b)

  return sorted.map(([course, courseItems], index) => ({
    course,
    // First course fires immediately, subsequent courses hold
    fire: index === 0,
    items: courseItems,
  }))
}

function collectAllergens(items: KitchenTicketItem[]): Map<string, number[]> {
  const allergenSeats = new Map<string, number[]>()
  for (const item of items) {
    for (const allergen of item.allergens) {
      const upper = allergen.toUpperCase()
      if (!allergenSeats.has(upper)) {
        allergenSeats.set(upper, [])
      }
      if (item.seat_number !== null) {
        const seats = allergenSeats.get(upper)!
        if (!seats.includes(item.seat_number)) {
          seats.push(item.seat_number)
        }
      }
    }
  }
  return allergenSeats
}

// ---------------------------------------------------------------------------
// Main Formatter
// ---------------------------------------------------------------------------

/**
 * Formats a kitchen ticket as ESC/POS binary data ready to send to a printer.
 *
 * @param order - The order header data
 * @param items - The order items to print on this ticket (pre-filtered by station)
 * @param station - The kitchen station this ticket is destined for
 * @param config - Printer configuration (paper width etc.)
 * @param options - Ticket variant (new order, re-fire, void, modification)
 * @returns Promise<Uint8Array> - The ESC/POS binary command sequence
 */
export async function formatKitchenTicket(
  order: KitchenTicketOrder,
  items: KitchenTicketItem[],
  station: KitchenStation,
  config: KitchenTicketConfig = { line_width: DEFAULT_LINE_WIDTH },
  options: KitchenTicketOptions = { variant: 'new_order' }
): Promise<Uint8Array> {
  const Builder = await getESCPOSBuilder()
  const builder = new Builder()
  const width = config.line_width

  const thinLine = repeatChar(SEPARATOR_THIN, width)
  const thickLine = repeatChar(SEPARATOR_THICK, width)

  // === HEADER ===
  builder.align('center')

  // Variant-specific header
  switch (options.variant) {
    case 'new_order':
      builder
        .bold(true)
        .doubleHeight(true)
        .text('** NEW ORDER **')
        .lineFeed()
      break
    case 're_fire':
      builder
        .bold(true)
        .doubleHeight(true)
        .text('** RE-FIRE **')
        .lineFeed()
      if (options.refire_reason) {
        builder
          .doubleHeight(false)
          .text(`Reason: ${options.refire_reason}`)
          .lineFeed()
      }
      break
    case 'void':
      builder
        .bold(true)
        .doubleHeight(true)
        .text('** VOID **')
        .lineFeed()
        .text('STOP PREPARING')
        .lineFeed()
      break
    case 'modification':
      builder
        .bold(true)
        .doubleHeight(true)
        .text('** MODIFIED **')
        .lineFeed()
      break
  }

  // Station name
  builder
    .doubleHeight(false)
    .bold(true)
    .text(station.name.toUpperCase())
    .lineFeed()
    .bold(false)

  builder.text(thickLine).lineFeed()

  // === RUSH / VIP flags ===
  if (order.is_rush || order.is_vip) {
    builder.bold(true).doubleHeight(true).align('center')
    if (order.is_rush) {
      builder.text('!!! RUSH !!!').lineFeed()
    }
    if (order.is_vip) {
      builder.text('*** VIP ***').lineFeed()
    }
    builder.doubleHeight(false).bold(false)
    builder.text(thinLine).lineFeed()
  }

  // === Order Info ===
  builder.align('left')
  const orderNum = `Order: #${order.order_number}`
  const tablePart = order.table_name ? `Table: ${order.table_name}` : order.order_type.toUpperCase()
  builder.text(`${orderNum.padEnd(Math.floor(width / 2))}${tablePart}`).lineFeed()

  const serverPart = `Server: ${order.server_name}`
  const guestPart = `Guests: ${order.guest_count}`
  builder.text(`${serverPart.padEnd(Math.floor(width / 2))}${guestPart}`).lineFeed()

  builder.text(`Time: ${formatTime(order.created_at)}`).lineFeed()

  builder.text(thinLine).lineFeed()

  // === MODIFICATION variant: show changes and cut ===
  if (options.variant === 'modification' && options.modified_items) {
    builder.align('left')
    for (const mod of options.modified_items) {
      builder
        .bold(true)
        .doubleHeight(true)
        .text(mod.item_name.toUpperCase())
        .lineFeed()
        .doubleHeight(false)
        .bold(false)
        .text(`  Changed: ${mod.change_description}`)
        .lineFeed()
        .lineFeed()
    }
    builder.text(thickLine).lineFeed()
    builder.lineFeed(3)
    builder.cut(true)
    return builder.build()
  }

  // === ITEMS grouped by course ===
  const courseGroups = groupItemsByCourse(items)
  const showCourses = courseGroups.length > 1 || courseGroups[0]?.course > 1

  for (const group of courseGroups) {
    if (showCourses) {
      builder.lineFeed()
      builder
        .bold(true)
        .align('left')
        .text(`COURSE ${group.course} ${SEPARATOR_THIN} ${group.fire ? 'FIRE' : 'HOLD'}`)
        .lineFeed()
        .bold(false)
      builder.lineFeed()
    }

    for (const item of group.items) {
      // Quantity + item name in BOLD DOUBLE HEIGHT
      const qtyPrefix = item.quantity > 1 ? `${item.quantity}x ` : '1x '

      builder
        .bold(true)
        .doubleHeight(true)
        .align('left')

      // If voided, show strikethrough-style indicator
      if (item.voided) {
        builder.text(`VOID: ${qtyPrefix}${item.name.toUpperCase()}`)
      } else {
        builder.text(`${qtyPrefix}${item.name.toUpperCase()}`)
      }
      builder.lineFeed()
      builder.doubleHeight(false).bold(false)

      // Seat number (when coursing is active and seat is assigned)
      if (item.seat_number !== null && showCourses) {
        builder.text(`   Seat ${item.seat_number}`).lineFeed()
      }

      // Modifiers
      for (const mod of item.modifiers) {
        if (mod.is_cook_preference) {
          // Temperature / cook preferences in bold with stars
          builder
            .bold(true)
            .text(`   ** ${mod.name.toUpperCase()} **`)
            .lineFeed()
            .bold(false)
        } else {
          // Normal modifiers indented
          builder.text(`   ${mod.name}`).lineFeed()
        }
      }

      // Special instructions underlined
      if (item.special_instructions) {
        builder
          .underline(true)
          .text(`   ${item.special_instructions}`)
          .lineFeed()
          .underline(false)
      }

      // Void reason
      if (item.voided && item.void_reason) {
        builder.text(`   Reason: ${item.void_reason}`).lineFeed()
      }

      builder.lineFeed()
    }
  }

  // === ALLERGEN WARNINGS ===
  const allergenSeats = collectAllergens(items)
  if (allergenSeats.size > 0) {
    builder.text(thickLine).lineFeed()
    builder.align('center').bold(true).doubleHeight(true)

    for (const [allergen, seats] of allergenSeats) {
      const seatStr = seats.length > 0
        ? ` ${SEPARATOR_THIN} SEAT ${seats.join(', ')}`
        : ''
      builder.text(`*** ALLERGY: ${allergen}${seatStr} ***`).lineFeed()
    }

    builder.doubleHeight(false).bold(false)
    builder.text(thickLine).lineFeed()
  } else {
    builder.text(thickLine).lineFeed()
  }

  // === FOOTER ===
  builder.lineFeed(3)
  builder.cut(true)

  return builder.build()
}

/**
 * Convenience: format a re-fire kitchen ticket.
 */
export async function formatRefireTicket(
  order: KitchenTicketOrder,
  items: KitchenTicketItem[],
  station: KitchenStation,
  reason: string,
  config?: KitchenTicketConfig
): Promise<Uint8Array> {
  return formatKitchenTicket(order, items, station, config, {
    variant: 're_fire',
    refire_reason: reason,
  })
}

/**
 * Convenience: format a void kitchen ticket.
 */
export async function formatVoidTicket(
  order: KitchenTicketOrder,
  items: KitchenTicketItem[],
  station: KitchenStation,
  config?: KitchenTicketConfig
): Promise<Uint8Array> {
  return formatKitchenTicket(order, items, station, config, {
    variant: 'void',
  })
}

/**
 * Convenience: format a modification kitchen ticket.
 */
export async function formatModificationTicket(
  order: KitchenTicketOrder,
  items: KitchenTicketItem[],
  station: KitchenStation,
  modifications: ModifiedItem[],
  config?: KitchenTicketConfig
): Promise<Uint8Array> {
  return formatKitchenTicket(order, items, station, config, {
    variant: 'modification',
    modified_items: modifications,
  })
}
