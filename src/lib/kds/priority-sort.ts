/**
 * KDS Ticket Priority Sorting
 *
 * Sort order: RE-FIRE (1) > RUSH (2) > VIP (3) > Normal (4)
 * Within same priority, oldest first.
 */

export type TicketPriority = 'refire' | 'rush' | 'vip' | 'normal'

const PRIORITY_RANK: Record<TicketPriority, number> = {
  refire: 1,
  rush: 2,
  vip: 3,
  normal: 4,
}

interface SortableTicket {
  priority: TicketPriority
  created_at: string
  is_rush?: boolean
}

/**
 * Get the numeric rank for a priority level.
 * Lower number = higher priority.
 */
export function getPriorityRank(priority: TicketPriority): number {
  return PRIORITY_RANK[priority] ?? 4
}

/**
 * Sort tickets by priority tier, then by age (oldest first within same tier).
 * Returns a new sorted array.
 */
export function sortTicketsByPriority<T extends SortableTicket>(tickets: T[]): T[] {
  return [...tickets].sort((a, b) => {
    const rankA = getPriorityRank(a.priority)
    const rankB = getPriorityRank(b.priority)

    if (rankA !== rankB) return rankA - rankB

    // Same priority tier - oldest first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

/**
 * Determine the effective priority from ticket attributes.
 * Re-fire trumps rush, rush trumps VIP, etc.
 */
export function resolveTicketPriority(ticket: {
  priority?: TicketPriority | string
  is_rush?: boolean
  is_refire?: boolean
  is_vip?: boolean
}): TicketPriority {
  if (ticket.is_refire || ticket.priority === 'refire') return 'refire'
  if (ticket.is_rush || ticket.priority === 'rush') return 'rush'
  if (ticket.is_vip || ticket.priority === 'vip') return 'vip'
  return 'normal'
}
