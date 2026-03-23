/**
 * TCP Printer Connection
 *
 * Manages TCP connections to network thermal printers (Star Micronics, Epson).
 * Printers listen on port 9100 (RAW protocol / AppSocket).
 * Supports connection pooling, timeouts, and auto-reconnect.
 */

import * as net from 'net'

const CONNECT_TIMEOUT_MS = 5000
const SEND_TIMEOUT_MS = 10000
const IDLE_TIMEOUT_MS = 30000 // Close idle connections after 30s

interface PrinterConnectionState {
  socket: net.Socket | null
  connected: boolean
  lastUsedAt: number
  ip: string
  port: number
}

export class TcpPrinter {
  private ip: string
  private port: number
  private socket: net.Socket | null = null
  private connected = false
  private connecting = false
  private lastUsedAt = 0
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(ip: string, port: number = 9100) {
    this.ip = ip
    this.port = port
  }

  /**
   * Connect to the printer. Resolves when connected, rejects on timeout/error.
   */
  async connect(): Promise<void> {
    if (this.connected && this.socket) return
    if (this.connecting) {
      // Wait for existing connection attempt
      await this.waitForConnection()
      return
    }

    this.connecting = true

    return new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()

      const connectTimer = setTimeout(() => {
        socket.destroy()
        this.connecting = false
        reject(new Error(`Connection to ${this.ip}:${this.port} timed out after ${CONNECT_TIMEOUT_MS}ms`))
      }, CONNECT_TIMEOUT_MS)

      socket.on('connect', () => {
        clearTimeout(connectTimer)
        this.socket = socket
        this.connected = true
        this.connecting = false
        this.lastUsedAt = Date.now()
        this.resetIdleTimer()
        resolve()
      })

      socket.on('error', (err) => {
        clearTimeout(connectTimer)
        this.connected = false
        this.connecting = false
        this.socket = null
        reject(new Error(`Connection to ${this.ip}:${this.port} failed: ${err.message}`))
      })

      socket.on('close', () => {
        this.connected = false
        this.socket = null
        this.clearIdleTimer()
      })

      socket.connect(this.port, this.ip)
    })
  }

  /**
   * Send data to the printer. Auto-connects if not connected.
   */
  async send(data: Buffer): Promise<void> {
    if (!this.connected || !this.socket) {
      await this.connect()
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('No socket connection'))
        return
      }

      const sendTimer = setTimeout(() => {
        reject(new Error(`Send to ${this.ip}:${this.port} timed out after ${SEND_TIMEOUT_MS}ms`))
      }, SEND_TIMEOUT_MS)

      this.socket.write(data, (err) => {
        clearTimeout(sendTimer)
        if (err) {
          this.connected = false
          reject(new Error(`Send to ${this.ip}:${this.port} failed: ${err.message}`))
        } else {
          this.lastUsedAt = Date.now()
          this.resetIdleTimer()
          resolve()
        }
      })
    })
  }

  /**
   * Disconnect from the printer.
   */
  disconnect(): void {
    this.clearIdleTimer()
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.connected = false
    this.connecting = false
  }

  /**
   * Whether the printer is currently connected.
   */
  get isConnected(): boolean {
    return this.connected
  }

  /**
   * Get connection state info.
   */
  getState(): PrinterConnectionState {
    return {
      socket: this.socket,
      connected: this.connected,
      lastUsedAt: this.lastUsedAt,
      ip: this.ip,
      port: this.port,
    }
  }

  private async waitForConnection(): Promise<void> {
    const startedAt = Date.now()
    while (this.connecting && Date.now() - startedAt < CONNECT_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (!this.connected) {
      throw new Error(`Timed out waiting for existing connection to ${this.ip}:${this.port}`)
    }
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      if (this.connected) {
        console.log(`[TcpPrinter] Closing idle connection to ${this.ip}:${this.port}`)
        this.disconnect()
      }
    }, IDLE_TIMEOUT_MS)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }
}

// ---------------------------------------------------------------------------
// Connection Pool
// ---------------------------------------------------------------------------

const connectionPool = new Map<string, TcpPrinter>()

/**
 * Get or create a pooled connection to a printer.
 */
export function getPooledPrinter(ip: string, port: number = 9100): TcpPrinter {
  const key = `${ip}:${port}`
  let printer = connectionPool.get(key)

  if (!printer) {
    printer = new TcpPrinter(ip, port)
    connectionPool.set(key, printer)
  }

  return printer
}

/**
 * Close all pooled connections.
 */
export function closeAllConnections(): void {
  for (const [key, printer] of connectionPool.entries()) {
    printer.disconnect()
    connectionPool.delete(key)
  }
}

/**
 * Get status of all pooled connections.
 */
export function getPoolStatus(): Array<{ ip: string; port: number; connected: boolean; lastUsedAt: number }> {
  const result: Array<{ ip: string; port: number; connected: boolean; lastUsedAt: number }> = []
  for (const printer of connectionPool.values()) {
    const state = printer.getState()
    result.push({
      ip: state.ip,
      port: state.port,
      connected: state.connected,
      lastUsedAt: state.lastUsedAt,
    })
  }
  return result
}
