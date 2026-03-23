/**
 * Barcode Scanner Engine
 *
 * Detects rapid keystroke sequences from USB/Bluetooth barcode scanners
 * connected in HID (keyboard wedge) mode. Distinguishes scanner input
 * from normal typing by timing: if 5+ characters arrive within 100ms
 * followed by Enter, it's treated as a barcode scan.
 */

type ScanCallback = (barcode: string) => void

interface BarcodeScannerConfig {
  /** Minimum characters for a valid scan (default: 5) */
  minLength: number
  /** Maximum time (ms) between first and last character (default: 100) */
  maxScanDurationMs: number
  /** Optional prefix character sent by scanner (e.g., ASCII STX \x02) */
  prefix: string | null
  /** Optional suffix character sent by scanner (e.g., ASCII ETX \x03) */
  suffix: string | null
  /** Keys that trigger scan evaluation (default: ['Enter']) */
  terminatorKeys: string[]
  /** Whether to prevent default on scanned input (default: true) */
  preventDefault: boolean
}

const DEFAULT_CONFIG: BarcodeScannerConfig = {
  minLength: 5,
  maxScanDurationMs: 100,
  prefix: null,
  suffix: null,
  terminatorKeys: ['Enter'],
  preventDefault: true,
}

interface KeystrokeEntry {
  key: string
  timestamp: number
}

export class BarcodeScannerEngine {
  private config: BarcodeScannerConfig
  private buffer: KeystrokeEntry[] = []
  private callbacks: ScanCallback[] = []
  private listening = false
  private boundHandler: ((e: KeyboardEvent) => void) | null = null
  private bufferResetTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: Partial<BarcodeScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Register a callback for successful barcode scans.
   */
  onScan(callback: ScanCallback): () => void {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * Start listening for barcode scans via global keyboard events.
   */
  start(): void {
    if (this.listening || typeof window === 'undefined') return

    this.boundHandler = this.handleKeyDown.bind(this)
    window.addEventListener('keydown', this.boundHandler, { capture: true })
    this.listening = true
  }

  /**
   * Stop listening for barcode scans.
   */
  stop(): void {
    if (!this.listening || typeof window === 'undefined') return

    if (this.boundHandler) {
      window.removeEventListener('keydown', this.boundHandler, { capture: true })
      this.boundHandler = null
    }

    this.clearBuffer()
    this.listening = false
  }

  /**
   * Whether the scanner engine is currently listening.
   */
  get isListening(): boolean {
    return this.listening
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<BarcodeScannerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const now = performance.now()
    const key = event.key

    // If the active element is a contenteditable or specific input types
    // that should not be intercepted (like password fields), skip
    const target = event.target as HTMLElement | null
    if (target?.getAttribute('data-barcode-ignore') === 'true') {
      return
    }

    // Check if this is a terminator key (usually Enter)
    if (this.config.terminatorKeys.includes(key)) {
      this.evaluateBuffer(event)
      return
    }

    // Only buffer printable characters (single char keys)
    if (key.length !== 1) {
      // Non-printable key that isn't a terminator — clear buffer
      // since a real scanner wouldn't send arrow keys etc. mid-scan
      this.clearBuffer()
      return
    }

    // Add to buffer
    this.buffer.push({ key, timestamp: now })

    // Set a safety reset timer — if no terminator arrives within a
    // generous window, clear the buffer (handles partial scans)
    if (this.bufferResetTimer) {
      clearTimeout(this.bufferResetTimer)
    }
    this.bufferResetTimer = setTimeout(() => {
      this.clearBuffer()
    }, 500)
  }

  private evaluateBuffer(event: KeyboardEvent): void {
    if (this.buffer.length === 0) return

    const chars = this.buffer
    const duration = chars[chars.length - 1].timestamp - chars[0].timestamp

    // Build the raw scanned string
    let rawValue = chars.map((entry) => entry.key).join('')

    // Strip prefix if configured and present
    if (this.config.prefix && rawValue.startsWith(this.config.prefix)) {
      rawValue = rawValue.slice(this.config.prefix.length)
    }

    // Strip suffix if configured and present
    if (this.config.suffix && rawValue.endsWith(this.config.suffix)) {
      rawValue = rawValue.slice(0, -this.config.suffix.length)
    }

    const isValidScan =
      rawValue.length >= this.config.minLength &&
      duration <= this.config.maxScanDurationMs

    if (isValidScan) {
      // This is a barcode scan — prevent Enter from submitting forms
      if (this.config.preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }

      // Fire callbacks
      for (const cb of this.callbacks) {
        try {
          cb(rawValue)
        } catch (err) {
          console.error('[BarcodeScannerEngine] Callback error:', err)
        }
      }
    }
    // If not a valid scan, do nothing — let Enter propagate normally

    this.clearBuffer()
  }

  private clearBuffer(): void {
    this.buffer = []
    if (this.bufferResetTimer) {
      clearTimeout(this.bufferResetTimer)
      this.bufferResetTimer = null
    }
  }
}
