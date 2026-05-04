/**
 * mDNS / Bonjour scanner — discovers Wi-Fi terminals and printers on the
 * local subnet by listening for advertised mDNS service types matching any
 * registered driver's `scanner_hints.mdns_service`.
 *
 * Runtime: Node.js (server-side). Uses dynamic import of `bonjour-service`
 * so the route handler doesn't crash if the dependency isn't installed yet
 * (Bonjour is optional infrastructure — V5.2.0 ships the framework before
 * the package is added to the lockfile in V5.2.1+).
 */

import type { Processor } from '../processor-binding'
import {
  listAvailableDrivers,
  getCertStatus,
  type TerminalDriverMeta,
} from '../terminal-registry'
import type { DiscoveredDevice } from '../auto-detect'

interface BonjourService {
  name: string
  type: string
  host: string
  addresses?: string[]
  port: number
  txt?: Record<string, string>
}

interface BonjourBrowser {
  on(event: 'up', cb: (svc: BonjourService) => void): void
  stop(): void
}

interface BonjourLike {
  find(opts: { type: string }): BonjourBrowser
  destroy(): void
}

/**
 * Try to load `bonjour-service`. Returns null when the package is missing —
 * caller treats that as "no devices available via mDNS in this environment".
 */
async function loadBonjour(): Promise<BonjourLike | null> {
  try {
    // Use string indirection so static analyzers (and the Next.js bundler)
    // don't try to resolve the package at build time.
    const moduleName = 'bonjour-service'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* webpackIgnore: true */ moduleName)
    const Bonjour = mod.Bonjour ?? mod.default?.Bonjour ?? mod.default
    if (!Bonjour) return null
    return new Bonjour() as BonjourLike
  } catch {
    return null
  }
}

/**
 * Build a quick lookup: mdns_service → driver meta. Multiple drivers can
 * share a service type (Valor's hardware all advertises `_valor-pos._tcp.`),
 * in which case a single match yields multiple candidate device classes;
 * we emit one DiscoveredDevice per (service, driver) pair.
 */
function buildServiceIndex(processor: Processor): Map<string, TerminalDriverMeta[]> {
  const index = new Map<string, TerminalDriverMeta[]>()
  for (const meta of listAvailableDrivers(processor)) {
    const svc = meta.scanner_hints.mdns_service
    if (!svc) continue
    const list = index.get(svc) ?? []
    list.push(meta)
    index.set(svc, list)
  }
  return index
}

function strip(serviceType: string): string {
  // bonjour-service expects 'pdl-datastream' for `_pdl-datastream._tcp.`.
  return serviceType.replace(/^_/, '').replace(/\._tcp\.?$/, '').replace(/\._udp\.?$/, '')
}

export async function scan(
  processor: Processor,
  timeoutMs: number
): Promise<DiscoveredDevice[]> {
  const bonjour = await loadBonjour()
  if (!bonjour) return []

  const serviceIndex = buildServiceIndex(processor)
  if (serviceIndex.size === 0) {
    bonjour.destroy()
    return []
  }

  const found: DiscoveredDevice[] = []
  const seen = new Set<string>() // dedupe key: device_class + identifier

  const browsers: BonjourBrowser[] = []
  for (const svc of serviceIndex.keys()) {
    const browser = bonjour.find({ type: strip(svc) })
    browsers.push(browser)
    browser.on('up', (s) => {
      const candidates = serviceIndex.get(svc) ?? []
      const addr = s.addresses?.[0] ?? s.host
      const identifier = `${addr}:${s.port}`
      for (const meta of candidates) {
        const dedupe = `${meta.device_class}|${identifier}`
        if (seen.has(dedupe)) continue
        seen.add(dedupe)
        const cert = getCertStatus(meta.device_class, processor) ?? meta.cert_status
        found.push({
          device_class: meta.device_class,
          mfg: meta.mfg,
          model: meta.model,
          identifier,
          supported: cert === 'live',
          cert_status: cert,
          reason_if_unsupported:
            cert === 'pending_cert'
              ? `${meta.mfg} ${meta.model} requires Valor EMV certification (in progress).`
              : cert === 'unsupported_until_psp_listed'
              ? `${meta.mfg} ${meta.model} requires Valor on the platform PSP allowlist.`
              : undefined,
        })
      }
    })
  }

  await new Promise((r) => setTimeout(r, timeoutMs))
  for (const b of browsers) {
    try {
      b.stop()
    } catch {
      /* ignore */
    }
  }
  bonjour.destroy()

  return found
}
