import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const budgetKb = Number(process.env.POS_FIRST_LOAD_BUDGET_KB ?? 200)
const routeManifests = [
  {
    label: '/orders',
    route: '/(pos)/orders/page',
    entry: '[project]/src/app/(pos)/orders/page',
    file: '.next/server/app/(pos)/orders/page_client-reference-manifest.js',
  },
]

if (!routeManifests.every(({ file }) => existsSync(join(process.cwd(), file)))) {
  console.error('Missing app route client manifests. Run npm run build first.')
  process.exit(1)
}

function assetSize(asset) {
  const path = join(process.cwd(), '.next', asset)
  return existsSync(path) ? gzipSync(readFileSync(path)).length : 0
}

function readRouteManifest({ route, file }) {
  const source = readFileSync(join(process.cwd(), file), 'utf8')
  const prefix = `globalThis.__RSC_MANIFEST[${JSON.stringify(route)}] = `
  const start = source.indexOf(prefix)
  if (start === -1) throw new Error(`Unable to find RSC manifest payload for ${route}`)

  return JSON.parse(source.slice(start + prefix.length).replace(/;\s*$/, ''))
}

const failures = []

for (const routeManifest of routeManifests) {
  const manifest = readRouteManifest(routeManifest)
  const jsAssets = manifest.entryJSFiles?.[routeManifest.entry] ?? []
  const totalKb = jsAssets.reduce((sum, asset) => sum + assetSize(asset), 0) / 1024

  if (totalKb > budgetKb) {
    failures.push(`${routeManifest.label}: ${totalKb.toFixed(1)}kb gzip > ${budgetKb}kb`)
  }
}

if (failures.length > 0) {
  console.error(`POS first-load JS budget failed:\n${failures.join('\n')}`)
  process.exit(1)
}

console.log(`POS first-load JS budget passed for ${routeManifests.length} routes at <= ${budgetKb}kb gzip.`)
