/**
 * Conflict detection and resolution for sync operations.
 * Last-write-wins for most entities. Manual resolution for table conflicts.
 */

import { offlineDB, type CachedConflict, type SyncEntityType } from './db'
import { useOfflineStore } from '@/stores/offline-store'

/**
 * Create a conflict record for manual resolution.
 */
export async function createConflict(params: {
  entity_type: SyncEntityType
  entity_id: string
  local_data: Record<string, unknown>
  server_data: Record<string, unknown>
  description: string
  location_id: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const conflict: CachedConflict = {
    id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    local_data: params.local_data,
    server_data: params.server_data,
    description: params.description,
    resolved: false,
    resolution: null,
    created_at: new Date().toISOString(),
    location_id: params.location_id,
  }

  await offlineDB.conflicts.put(conflict)

  // Update the offline store
  const store = useOfflineStore.getState()
  store.actions.addConflict(conflict)

  return id
}

/**
 * Get all unresolved conflicts.
 */
export async function getUnresolvedConflicts(locationId?: string): Promise<CachedConflict[]> {
  let query = offlineDB.conflicts.filter((c) => !c.resolved)
  if (locationId) {
    query = offlineDB.conflicts
      .where('location_id')
      .equals(locationId)
      .filter((c) => !c.resolved)
  }
  return query.toArray()
}

/**
 * Resolve a conflict with the chosen resolution.
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'keep_local' | 'keep_server' | 'merge',
  mergeData?: Record<string, unknown>
): Promise<void> {
  const conflict = await offlineDB.conflicts.get(conflictId)
  if (!conflict) throw new Error(`Conflict ${conflictId} not found`)

  // Apply the resolution
  switch (resolution) {
    case 'keep_local':
      await applyLocalData(conflict)
      break
    case 'keep_server':
      // Server data is already on the server; just accept it
      await acceptServerData(conflict)
      break
    case 'merge':
      if (mergeData) {
        await applyMergeData(conflict, mergeData)
      }
      break
  }

  // Mark as resolved
  await offlineDB.conflicts.update(conflictId, {
    resolved: true,
    resolution,
  })

  // Update store
  const store = useOfflineStore.getState()
  store.actions.removeConflict(conflictId)
}

/**
 * Apply local data to the server (user chose "Keep Mine").
 */
async function applyLocalData(conflict: CachedConflict): Promise<void> {
  const endpoint = getEndpoint(conflict.entity_type, conflict.entity_id)
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...conflict.local_data,
      force: true, // Override server version
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to apply local data: ${response.status}`)
  }
}

/**
 * Accept server data (user chose "Keep Server").
 * Update local cache to match server state.
 */
async function acceptServerData(conflict: CachedConflict): Promise<void> {
  switch (conflict.entity_type) {
    case 'table':
      await offlineDB.restaurant_tables.update(conflict.entity_id, {
        ...conflict.server_data,
        synced_at: new Date().toISOString(),
      })
      break
    case 'order':
      await offlineDB.orders.update(conflict.entity_id, {
        ...conflict.server_data,
        sync_status: 'synced',
        synced_at: new Date().toISOString(),
      })
      break
  }
}

/**
 * Apply merged data to both server and local cache.
 */
async function applyMergeData(conflict: CachedConflict, mergeData: Record<string, unknown>): Promise<void> {
  const endpoint = getEndpoint(conflict.entity_type, conflict.entity_id)
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...mergeData, force: true }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to apply merge data: ${response.status}`)
  }

  // Update local cache with merge result
  switch (conflict.entity_type) {
    case 'table':
      await offlineDB.restaurant_tables.update(conflict.entity_id, {
        ...mergeData,
        synced_at: new Date().toISOString(),
      })
      break
    case 'order':
      await offlineDB.orders.update(conflict.entity_id, {
        ...mergeData,
        sync_status: 'synced',
        synced_at: new Date().toISOString(),
      })
      break
  }
}

/**
 * Get the API endpoint for an entity type.
 */
function getEndpoint(entityType: SyncEntityType, entityId: string): string {
  switch (entityType) {
    case 'order':
      return `/api/orders/${entityId}`
    case 'payment':
      return `/api/payments/${entityId}`
    case 'time_entry':
      return `/api/staff/time-entries/${entityId}`
    case 'table':
      return `/api/tables/${entityId}`
    case 'kds_ticket':
      return `/api/kds/tickets/${entityId}`
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}
