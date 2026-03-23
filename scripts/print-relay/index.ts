/**
 * Sear Print Relay Service
 *
 * Minimal Node.js HTTP server that runs on the restaurant's LAN.
 * Receives print jobs from the POS web app and sends them to network
 * thermal printers via TCP on port 9100 (RAW / AppSocket protocol).
 *
 * Endpoints:
 *   POST /print     — Send a print job to a network printer
 *   GET  /status    — Relay status and connected printer info
 *   GET  /discover  — Scan local network for printers on port 9100
 *   GET  /health    — Simple health check
 */

import * as http from 'http'
import * as net from 'net'
import { getPooledPrinter, getPoolStatus, closeAllConnections } from './tcp-printer'

const PORT = parseInt(process.env.RELAY_PORT ?? '8888', 10)
const HOST = process.env.RELAY_HOST ?? '0.0.0.0'
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(json)
}

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Route: POST /print
// ---------------------------------------------------------------------------

interface PrintRequest {
  printer_ip: string
  printer_port?: number
  data: string // base64 encoded binary data
  job_id?: string
}

async function handlePrint(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const raw = await parseBody(req)
  let body: PrintRequest

  try {
    body = JSON.parse(raw) as PrintRequest
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  if (!body.printer_ip || !body.data) {
    sendJson(res, 400, { error: 'Missing required fields: printer_ip, data' })
    return
  }

  const printerPort = body.printer_port ?? 9100

  try {
    const printer = getPooledPrinter(body.printer_ip, printerPort)
    const buffer = Buffer.from(body.data, 'base64')

    await printer.send(buffer)

    sendJson(res, 200, {
      success: true,
      printer_ip: body.printer_ip,
      printer_port: printerPort,
      bytes_sent: buffer.length,
      job_id: body.job_id ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[print-relay] Print failed for ${body.printer_ip}:${printerPort}: ${message}`)

    sendJson(res, 502, {
      success: false,
      error: message,
      printer_ip: body.printer_ip,
      printer_port: printerPort,
      job_id: body.job_id ?? null,
    })
  }
}

// ---------------------------------------------------------------------------
// Route: GET /status
// ---------------------------------------------------------------------------

function handleStatus(_req: http.IncomingMessage, res: http.ServerResponse): void {
  const poolStatus = getPoolStatus()

  sendJson(res, 200, {
    relay: {
      status: 'running',
      uptime_seconds: Math.floor(process.uptime()),
      host: HOST,
      port: PORT,
      pid: process.pid,
    },
    printers: poolStatus.map((p) => ({
      ip: p.ip,
      port: p.port,
      connected: p.connected,
      last_used_at: p.lastUsedAt > 0 ? new Date(p.lastUsedAt).toISOString() : null,
    })),
  })
}

// ---------------------------------------------------------------------------
// Route: GET /discover
// ---------------------------------------------------------------------------

async function handleDiscover(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // Discover printers by scanning common LAN ranges on port 9100
  // This is a simplified scan — checks a /24 subnet based on the relay's own IP
  const localIp = getLocalIp()
  if (!localIp) {
    sendJson(res, 200, {
      discovered: [],
      message: 'Could not determine local network. Scan unavailable.',
    })
    return
  }

  const subnet = localIp.split('.').slice(0, 3).join('.')
  const discovered: Array<{ ip: string; port: number; responsive: boolean }> = []

  // Scan in parallel batches to avoid overwhelming the network
  const scanPromises: Array<Promise<void>> = []
  const BATCH_SIZE = 50
  const SCAN_TIMEOUT_MS = 1500

  for (let i = 1; i <= 254; i++) {
    const targetIp = `${subnet}.${i}`
    scanPromises.push(
      scanPort(targetIp, 9100, SCAN_TIMEOUT_MS).then((responsive) => {
        if (responsive) {
          discovered.push({ ip: targetIp, port: 9100, responsive: true })
        }
      })
    )

    // Execute in batches
    if (scanPromises.length >= BATCH_SIZE || i === 254) {
      await Promise.all(scanPromises)
      scanPromises.length = 0
    }
  }

  sendJson(res, 200, {
    subnet: `${subnet}.0/24`,
    discovered,
    scanned_at: new Date().toISOString(),
  })
}

function scanPort(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()

    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)

    socket.on('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(false)
    })

    socket.connect(port, ip)
  })
}

function getLocalIp(): string | null {
  const os = require('os') as typeof import('os')
  const interfaces = os.networkInterfaces()

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]
    if (!iface) continue
    for (const entry of iface) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Route: GET /health
// ---------------------------------------------------------------------------

function handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): void {
  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  })
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = req.url ?? '/'

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    res.end()
    return
  }

  try {
    if (method === 'POST' && url === '/print') {
      await handlePrint(req, res)
    } else if (method === 'GET' && url === '/status') {
      handleStatus(req, res)
    } else if (method === 'GET' && url === '/discover') {
      await handleDiscover(req, res)
    } else if (method === 'GET' && url === '/health') {
      handleHealth(req, res)
    } else {
      sendJson(res, 404, { error: 'Not found' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error(`[print-relay] Unhandled error on ${method} ${url}: ${message}`)
    sendJson(res, 500, { error: message })
  }
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[print-relay] Shutting down...')
  closeAllConnections()
  server.close(() => {
    console.log('[print-relay] Server closed.')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('[print-relay] SIGTERM received, shutting down...')
  closeAllConnections()
  server.close(() => {
    process.exit(0)
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[print-relay] Sear Print Relay listening on http://${HOST}:${PORT}`)
  console.log(`[print-relay] Endpoints:`)
  console.log(`  POST /print     — Send print job`)
  console.log(`  GET  /status    — Relay status`)
  console.log(`  GET  /discover  — Discover network printers`)
  console.log(`  GET  /health    — Health check`)
})
