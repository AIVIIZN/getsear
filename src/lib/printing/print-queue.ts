/**
 * Print Queue Manager
 *
 * Client-side print queue with IndexedDB persistence for offline resilience.
 * All print jobs flow through this queue which handles:
 * - Ordered processing (FIFO with priority boost)
 * - Retry logic: immediate -> 5s -> 15s -> mark failed
 * - IndexedDB persistence so jobs survive page reloads
 * - Event emitters for UI state updates
 *
 * This runs in the browser, not on the server. The actual print delivery
 * happens via HTTP to a local print relay service or WebSocket to CloudPRNT.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrintJobStatus = 'queued' | 'printing' | 'printed' | 'failed' | 'cancelled'
export type PrintJobType = 'receipt' | 'kitchen_ticket' | 'cash_drawer' | 'test_page' | 'label'

export interface PrintJob {
  id: string
  printer_id: string
  printer_name: string
  job_type: PrintJobType
  data: Uint8Array
  status: PrintJobStatus
  priority: number
  attempts: number
  max_attempts: number
  error_message: string | null
  created_at: string
  completed_at: string | null
  next_retry_at: string | null
}

export interface EnqueueOptions {
  printer_id: string
  printer_name: string
  job_type: PrintJobType
  data: Uint8Array
  /** Higher priority jobs print first. Default 0. RE-FIRE tickets use 10. */
  priority?: number
}

type QueueEventType = 'jobCompleted' | 'jobFailed' | 'queueEmpty' | 'jobAdded' | 'jobRetrying'
type QueueEventCallback = (job: PrintJob) => void

// ---------------------------------------------------------------------------
// Retry timing (milliseconds)
// ---------------------------------------------------------------------------

const RETRY_DELAYS = [0, 5000, 15000] // immediate, 5s, 15s
const MAX_ATTEMPTS = 3

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'sear-print-queue'
const DB_VERSION = 1
const STORE_NAME = 'jobs'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('priority_created', ['priority', 'created_at'], { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbPut(job: PrintJob): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    // IndexedDB cannot store Uint8Array directly in all browsers;
    // convert to a plain array for storage and reconstruct on read.
    const serializable = {
      ...job,
      data: Array.from(job.data),
    }
    tx.objectStore(STORE_NAME).put(serializable)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

interface StoredPrintJob extends Omit<PrintJob, 'data'> {
  data: number[]
}

async function idbGetAll(): Promise<PrintJob[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      db.close()
      const stored = request.result as StoredPrintJob[]
      resolve(
        stored.map((j) => ({
          ...j,
          data: new Uint8Array(j.data),
        }))
      )
    }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

async function idbClearCompleted(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('status')
    const request = index.openCursor(IDBKeyRange.only('printed'))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    // Also clear cancelled
    const cancelledReq = index.openCursor(IDBKeyRange.only('cancelled'))
    cancelledReq.onsuccess = () => {
      const cursor = cancelledReq.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ---------------------------------------------------------------------------
// UUID generation helper (v7-like for sorting)
// ---------------------------------------------------------------------------

function generateId(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0')
  const random = Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${random.slice(0, 3)}-${random.slice(3, 7)}-${random.slice(7, 19)}`
}

// ---------------------------------------------------------------------------
// Print delivery (sends job to print relay or CloudPRNT)
// ---------------------------------------------------------------------------

export type PrintDeliveryFn = (job: PrintJob) => Promise<boolean>

/**
 * Default delivery function: posts job to the local print relay HTTP endpoint.
 * Returns true on success, false on failure.
 */
async function defaultPrintDelivery(job: PrintJob): Promise<boolean> {
  try {
    const response = await fetch('/api/printing/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerId: job.printer_id,
        jobType: job.job_type,
        documentData: btoa(String.fromCharCode(...job.data)),
        priority: job.priority,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// PrintQueueManager class
// ---------------------------------------------------------------------------

export class PrintQueueManager {
  private jobs: Map<string, PrintJob> = new Map()
  private listeners: Map<QueueEventType, Set<QueueEventCallback>> = new Map()
  private processing = false
  private deliveryFn: PrintDeliveryFn
  private processTimer: ReturnType<typeof setTimeout> | null = null

  constructor(deliveryFn?: PrintDeliveryFn) {
    this.deliveryFn = deliveryFn ?? defaultPrintDelivery
  }

  /**
   * Initialize: load any persisted jobs from IndexedDB.
   */
  async init(): Promise<void> {
    try {
      const persisted = await idbGetAll()
      for (const job of persisted) {
        this.jobs.set(job.id, job)
      }
      // Restart processing for any queued/retrying jobs
      this.scheduleProcessing()
    } catch {
      // IndexedDB may not be available (SSR, incognito). That's OK.
    }
  }

  /**
   * Add a new print job to the queue.
   */
  async enqueue(options: EnqueueOptions): Promise<PrintJob> {
    const job: PrintJob = {
      id: generateId(),
      printer_id: options.printer_id,
      printer_name: options.printer_name,
      job_type: options.job_type,
      data: options.data,
      status: 'queued',
      priority: options.priority ?? 0,
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
      error_message: null,
      created_at: new Date().toISOString(),
      completed_at: null,
      next_retry_at: null,
    }

    this.jobs.set(job.id, job)
    await this.persistJob(job)
    this.emit('jobAdded', job)
    this.scheduleProcessing()

    return job
  }

  /**
   * Get the next job to process: highest priority first, then oldest.
   */
  private getNextJob(): PrintJob | null {
    const now = Date.now()
    let best: PrintJob | null = null

    for (const job of this.jobs.values()) {
      if (job.status !== 'queued') continue

      // Check if retry delay has passed
      if (job.next_retry_at && new Date(job.next_retry_at).getTime() > now) {
        continue
      }

      if (
        !best ||
        job.priority > best.priority ||
        (job.priority === best.priority && job.created_at < best.created_at)
      ) {
        best = job
      }
    }

    return best
  }

  /**
   * Process the queue: take next job, attempt delivery, handle result.
   */
  private async processNext(): Promise<void> {
    if (this.processing) return

    const job = this.getNextJob()
    if (!job) {
      this.processing = false
      if (this.getQueuedCount() === 0) {
        this.emit('queueEmpty', { id: '', printer_id: '', printer_name: '', job_type: 'receipt', data: new Uint8Array(), status: 'printed', priority: 0, attempts: 0, max_attempts: 0, error_message: null, created_at: '', completed_at: null, next_retry_at: null } as PrintJob)
      }
      return
    }

    this.processing = true
    job.status = 'printing'
    job.attempts += 1
    await this.persistJob(job)

    const success = await this.deliveryFn(job)

    if (success) {
      job.status = 'printed'
      job.completed_at = new Date().toISOString()
      job.error_message = null
      await this.persistJob(job)
      this.emit('jobCompleted', job)
    } else {
      if (job.attempts >= MAX_ATTEMPTS) {
        job.status = 'failed'
        job.error_message = `Failed after ${MAX_ATTEMPTS} attempts`
        await this.persistJob(job)
        this.emit('jobFailed', job)
      } else {
        // Schedule retry
        const delayMs = RETRY_DELAYS[job.attempts] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]
        job.status = 'queued'
        job.next_retry_at = new Date(Date.now() + delayMs).toISOString()
        job.error_message = `Attempt ${job.attempts} failed, retrying...`
        await this.persistJob(job)
        this.emit('jobRetrying', job)
      }
    }

    this.processing = false
    // Continue processing remaining jobs
    this.scheduleProcessing()
  }

  /**
   * Schedule the next processing cycle.
   */
  private scheduleProcessing(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer)
    }

    // Find the soonest retry time
    const now = Date.now()
    let soonestDelay = 0

    for (const job of this.jobs.values()) {
      if (job.status === 'queued' && job.next_retry_at) {
        const retryAt = new Date(job.next_retry_at).getTime()
        if (retryAt > now) {
          const delay = retryAt - now
          soonestDelay = soonestDelay === 0 ? delay : Math.min(soonestDelay, delay)
        }
      }
    }

    this.processTimer = setTimeout(() => {
      this.processNext()
    }, soonestDelay)
  }

  /**
   * Retry a failed job.
   */
  async retry(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) {
      return false
    }

    job.status = 'queued'
    job.attempts = 0
    job.error_message = null
    job.next_retry_at = null
    await this.persistJob(job)
    this.scheduleProcessing()
    return true
  }

  /**
   * Cancel a pending or failed job.
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job || job.status === 'printed' || job.status === 'printing') {
      return false
    }

    job.status = 'cancelled'
    job.completed_at = new Date().toISOString()
    await this.persistJob(job)
    return true
  }

  /**
   * Get all jobs in the queue.
   */
  getQueue(): PrintJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => {
        // Sort: pending first, then by priority desc, then by created_at asc
        const statusOrder: Record<PrintJobStatus, number> = {
          printing: 0,
          queued: 1,
          failed: 2,
          cancelled: 3,
          printed: 4,
        }
        const sDiff = statusOrder[a.status] - statusOrder[b.status]
        if (sDiff !== 0) return sDiff
        const pDiff = b.priority - a.priority
        if (pDiff !== 0) return pDiff
        return a.created_at.localeCompare(b.created_at)
      })
  }

  /**
   * Get pending (queued + printing) jobs.
   */
  getPendingJobs(): PrintJob[] {
    return this.getQueue().filter(
      (j) => j.status === 'queued' || j.status === 'printing'
    )
  }

  /**
   * Get failed jobs.
   */
  getFailedJobs(): PrintJob[] {
    return this.getQueue().filter((j) => j.status === 'failed')
  }

  /**
   * Get recently completed jobs (last 20).
   */
  getRecentCompletedJobs(): PrintJob[] {
    return this.getQueue()
      .filter((j) => j.status === 'printed')
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      .slice(0, 20)
  }

  /**
   * Clear all completed and cancelled jobs from the queue and IndexedDB.
   */
  async clearCompleted(): Promise<void> {
    const toRemove: string[] = []
    for (const job of this.jobs.values()) {
      if (job.status === 'printed' || job.status === 'cancelled') {
        toRemove.push(job.id)
      }
    }
    for (const id of toRemove) {
      this.jobs.delete(id)
    }
    try {
      await idbClearCompleted()
    } catch {
      // Ignore IndexedDB errors
    }
  }

  /**
   * Count of queued jobs (for badge display).
   */
  private getQueuedCount(): number {
    let count = 0
    for (const job of this.jobs.values()) {
      if (job.status === 'queued' || job.status === 'printing') {
        count++
      }
    }
    return count
  }

  /**
   * Check if the queue is currently processing.
   */
  get isProcessing(): boolean {
    return this.processing
  }

  // ---------------------------------------------------------------------------
  // Event emitter
  // ---------------------------------------------------------------------------

  on(event: QueueEventType, callback: QueueEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: QueueEventType, callback: QueueEventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: QueueEventType, job: PrintJob): void {
    const cbs = this.listeners.get(event)
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(job)
        } catch {
          // Don't let listener errors break the queue
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private async persistJob(job: PrintJob): Promise<void> {
    try {
      await idbPut(job)
    } catch {
      // IndexedDB may not be available. Queue still works in-memory.
    }
  }

  /**
   * Destroy the queue manager: stop processing, clear timers.
   */
  destroy(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer)
      this.processTimer = null
    }
    this.listeners.clear()
  }
}

// ---------------------------------------------------------------------------
// Singleton instance (lazily created on the client)
// ---------------------------------------------------------------------------

let _instance: PrintQueueManager | null = null

/**
 * Get the singleton PrintQueueManager instance.
 * Initializes on first call (loads persisted jobs from IndexedDB).
 */
export function getPrintQueueManager(): PrintQueueManager {
  if (!_instance) {
    _instance = new PrintQueueManager()
    // Fire-and-forget init — loads IndexedDB jobs in the background
    _instance.init()
  }
  return _instance
}
