/**
 * Tax rate lookup by US zip code.
 * Returns combined state + local tax rates for food, alcohol, and takeout.
 * Uses a hardcoded table of major metro areas. Falls back to state average.
 */

export interface TaxRates {
  state: string
  stateName: string
  foodRate: number
  alcoholRate: number
  takeoutRate: number
  combinedRate: number
  source: 'exact' | 'state_average'
}

interface StateInfo {
  name: string
  rate: number
  alcoholRate: number
  takeoutTaxable: boolean
}

const STATE_RATES: Record<string, StateInfo> = {
  AL: { name: 'Alabama', rate: 4.0, alcoholRate: 4.0, takeoutTaxable: true },
  AK: { name: 'Alaska', rate: 0, alcoholRate: 0, takeoutTaxable: false },
  AZ: { name: 'Arizona', rate: 5.6, alcoholRate: 5.6, takeoutTaxable: true },
  AR: { name: 'Arkansas', rate: 6.5, alcoholRate: 6.5, takeoutTaxable: true },
  CA: { name: 'California', rate: 7.25, alcoholRate: 7.25, takeoutTaxable: false },
  CO: { name: 'Colorado', rate: 2.9, alcoholRate: 2.9, takeoutTaxable: true },
  CT: { name: 'Connecticut', rate: 6.35, alcoholRate: 6.35, takeoutTaxable: true },
  DE: { name: 'Delaware', rate: 0, alcoholRate: 0, takeoutTaxable: false },
  FL: { name: 'Florida', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  GA: { name: 'Georgia', rate: 4.0, alcoholRate: 4.0, takeoutTaxable: true },
  HI: { name: 'Hawaii', rate: 4.0, alcoholRate: 4.0, takeoutTaxable: true },
  ID: { name: 'Idaho', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  IL: { name: 'Illinois', rate: 6.25, alcoholRate: 6.25, takeoutTaxable: true },
  IN: { name: 'Indiana', rate: 7.0, alcoholRate: 7.0, takeoutTaxable: true },
  IA: { name: 'Iowa', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  KS: { name: 'Kansas', rate: 6.5, alcoholRate: 6.5, takeoutTaxable: true },
  KY: { name: 'Kentucky', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  LA: { name: 'Louisiana', rate: 4.45, alcoholRate: 4.45, takeoutTaxable: true },
  ME: { name: 'Maine', rate: 5.5, alcoholRate: 5.5, takeoutTaxable: false },
  MD: { name: 'Maryland', rate: 6.0, alcoholRate: 9.0, takeoutTaxable: false },
  MA: { name: 'Massachusetts', rate: 6.25, alcoholRate: 6.25, takeoutTaxable: false },
  MI: { name: 'Michigan', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  MN: { name: 'Minnesota', rate: 6.875, alcoholRate: 6.875, takeoutTaxable: false },
  MS: { name: 'Mississippi', rate: 7.0, alcoholRate: 7.0, takeoutTaxable: true },
  MO: { name: 'Missouri', rate: 4.225, alcoholRate: 4.225, takeoutTaxable: true },
  MT: { name: 'Montana', rate: 0, alcoholRate: 0, takeoutTaxable: false },
  NE: { name: 'Nebraska', rate: 5.5, alcoholRate: 5.5, takeoutTaxable: true },
  NV: { name: 'Nevada', rate: 6.85, alcoholRate: 6.85, takeoutTaxable: true },
  NH: { name: 'New Hampshire', rate: 0, alcoholRate: 0, takeoutTaxable: false },
  NJ: { name: 'New Jersey', rate: 6.625, alcoholRate: 6.625, takeoutTaxable: false },
  NM: { name: 'New Mexico', rate: 5.0, alcoholRate: 5.0, takeoutTaxable: true },
  NY: { name: 'New York', rate: 4.0, alcoholRate: 4.0, takeoutTaxable: true },
  NC: { name: 'North Carolina', rate: 4.75, alcoholRate: 4.75, takeoutTaxable: true },
  ND: { name: 'North Dakota', rate: 5.0, alcoholRate: 5.0, takeoutTaxable: true },
  OH: { name: 'Ohio', rate: 5.75, alcoholRate: 5.75, takeoutTaxable: true },
  OK: { name: 'Oklahoma', rate: 4.5, alcoholRate: 4.5, takeoutTaxable: true },
  OR: { name: 'Oregon', rate: 0, alcoholRate: 0, takeoutTaxable: false },
  PA: { name: 'Pennsylvania', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: false },
  RI: { name: 'Rhode Island', rate: 7.0, alcoholRate: 7.0, takeoutTaxable: true },
  SC: { name: 'South Carolina', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  SD: { name: 'South Dakota', rate: 4.2, alcoholRate: 4.2, takeoutTaxable: true },
  TN: { name: 'Tennessee', rate: 7.0, alcoholRate: 7.0, takeoutTaxable: true },
  TX: { name: 'Texas', rate: 6.25, alcoholRate: 6.25, takeoutTaxable: false },
  UT: { name: 'Utah', rate: 6.1, alcoholRate: 6.1, takeoutTaxable: true },
  VT: { name: 'Vermont', rate: 6.0, alcoholRate: 10.0, takeoutTaxable: false },
  VA: { name: 'Virginia', rate: 5.3, alcoholRate: 5.3, takeoutTaxable: true },
  WA: { name: 'Washington', rate: 6.5, alcoholRate: 6.5, takeoutTaxable: true },
  WV: { name: 'West Virginia', rate: 6.0, alcoholRate: 6.0, takeoutTaxable: true },
  WI: { name: 'Wisconsin', rate: 5.0, alcoholRate: 5.0, takeoutTaxable: true },
  WY: { name: 'Wyoming', rate: 4.0, alcoholRate: 4.0, takeoutTaxable: true },
  DC: { name: 'District of Columbia', rate: 10.0, alcoholRate: 10.25, takeoutTaxable: true },
}

// Zip code prefix (first 3 digits) to state mapping + local rate addon
interface ZipEntry {
  state: string
  localAddon: number
  city?: string
}

const ZIP_PREFIX_MAP: Record<string, ZipEntry> = {
  // New York City
  '100': { state: 'NY', localAddon: 4.875, city: 'New York City' },
  '101': { state: 'NY', localAddon: 4.875, city: 'New York City' },
  '102': { state: 'NY', localAddon: 4.875, city: 'New York City' },
  '103': { state: 'NY', localAddon: 4.5, city: 'Staten Island' },
  '104': { state: 'NY', localAddon: 4.875, city: 'Bronx' },
  '110': { state: 'NY', localAddon: 4.875, city: 'Queens' },
  '111': { state: 'NY', localAddon: 4.875, city: 'Brooklyn' },
  '112': { state: 'NY', localAddon: 4.875, city: 'Brooklyn' },
  // Los Angeles
  '900': { state: 'CA', localAddon: 2.25, city: 'Los Angeles' },
  '901': { state: 'CA', localAddon: 2.25, city: 'Los Angeles' },
  '902': { state: 'CA', localAddon: 2.25, city: 'Inglewood' },
  '910': { state: 'CA', localAddon: 2.25, city: 'Pasadena' },
  '911': { state: 'CA', localAddon: 2.25, city: 'Pasadena' },
  // San Francisco
  '941': { state: 'CA', localAddon: 1.25, city: 'San Francisco' },
  // Chicago
  '606': { state: 'IL', localAddon: 4.5, city: 'Chicago' },
  '607': { state: 'IL', localAddon: 4.5, city: 'Chicago' },
  // Houston
  '770': { state: 'TX', localAddon: 2.0, city: 'Houston' },
  '771': { state: 'TX', localAddon: 2.0, city: 'Houston' },
  '772': { state: 'TX', localAddon: 2.0, city: 'Houston' },
  // Dallas
  '750': { state: 'TX', localAddon: 2.0, city: 'Dallas' },
  '751': { state: 'TX', localAddon: 2.0, city: 'Dallas' },
  '752': { state: 'TX', localAddon: 2.0, city: 'Dallas' },
  // Austin
  '787': { state: 'TX', localAddon: 2.0, city: 'Austin' },
  // Miami
  '331': { state: 'FL', localAddon: 1.0, city: 'Miami' },
  '332': { state: 'FL', localAddon: 1.0, city: 'Miami' },
  '333': { state: 'FL', localAddon: 1.0, city: 'Fort Lauderdale' },
  // Seattle
  '981': { state: 'WA', localAddon: 3.6, city: 'Seattle' },
  // Philadelphia
  '191': { state: 'PA', localAddon: 2.0, city: 'Philadelphia' },
  // Atlanta
  '303': { state: 'GA', localAddon: 4.0, city: 'Atlanta' },
  // Washington DC
  '200': { state: 'DC', localAddon: 0, city: 'Washington DC' },
  // Boston
  '021': { state: 'MA', localAddon: 0.75, city: 'Boston' },
  // Denver
  '802': { state: 'CO', localAddon: 5.65, city: 'Denver' },
  // Nashville
  '372': { state: 'TN', localAddon: 2.25, city: 'Nashville' },
  // Las Vegas
  '891': { state: 'NV', localAddon: 1.525, city: 'Las Vegas' },
  // San Diego
  '921': { state: 'CA', localAddon: 0.5, city: 'San Diego' },
  // Portland
  '972': { state: 'OR', localAddon: 0, city: 'Portland' },
  // Phoenix
  '850': { state: 'AZ', localAddon: 3.3, city: 'Phoenix' },
  // New Orleans
  '701': { state: 'LA', localAddon: 5.0, city: 'New Orleans' },
}

// Simple zip-to-state lookup by first digit ranges
function getStateFromZip(zip: string): string | null {
  const num = parseInt(zip.substring(0, 3), 10)
  if (isNaN(num)) return null

  // Rough zip to state mapping
  if (num >= 10 && num <= 69) return 'MA' // Northeast generalization
  if (num >= 100 && num <= 149) return 'NY'
  if (num >= 150 && num <= 196) return 'PA'
  if (num >= 197 && num <= 199) return 'DE'
  if (num >= 200 && num <= 205) return 'DC'
  if (num >= 206 && num <= 219) return 'MD'
  if (num >= 220 && num <= 246) return 'VA'
  if (num >= 247 && num <= 268) return 'WV'
  if (num >= 270 && num <= 289) return 'NC'
  if (num >= 290 && num <= 299) return 'SC'
  if (num >= 300 && num <= 319) return 'GA'
  if (num >= 320 && num <= 349) return 'FL'
  if (num >= 350 && num <= 369) return 'AL'
  if (num >= 370 && num <= 385) return 'TN'
  if (num >= 386 && num <= 397) return 'MS'
  if (num >= 400 && num <= 427) return 'KY'
  if (num >= 430 && num <= 459) return 'OH'
  if (num >= 460 && num <= 479) return 'IN'
  if (num >= 480 && num <= 499) return 'MI'
  if (num >= 500 && num <= 528) return 'IA'
  if (num >= 530 && num <= 549) return 'WI'
  if (num >= 550 && num <= 567) return 'MN'
  if (num >= 570 && num <= 577) return 'SD'
  if (num >= 580 && num <= 588) return 'ND'
  if (num >= 590 && num <= 599) return 'MT'
  if (num >= 600 && num <= 629) return 'IL'
  if (num >= 630 && num <= 658) return 'MO'
  if (num >= 660 && num <= 679) return 'KS'
  if (num >= 680 && num <= 693) return 'NE'
  if (num >= 700 && num <= 714) return 'LA'
  if (num >= 716 && num <= 729) return 'AR'
  if (num >= 730 && num <= 749) return 'OK'
  if (num >= 750 && num <= 799) return 'TX'
  if (num >= 800 && num <= 816) return 'CO'
  if (num >= 820 && num <= 831) return 'WY'
  if (num >= 832 && num <= 838) return 'ID'
  if (num >= 840 && num <= 847) return 'UT'
  if (num >= 850 && num <= 865) return 'AZ'
  if (num >= 870 && num <= 884) return 'NM'
  if (num >= 889 && num <= 898) return 'NV'
  if (num >= 900 && num <= 961) return 'CA'
  if (num >= 967 && num <= 968) return 'HI'
  if (num >= 970 && num <= 979) return 'OR'
  if (num >= 980 && num <= 994) return 'WA'
  if (num >= 995 && num <= 999) return 'AK'

  return null
}

/**
 * Look up tax rates by US zip code.
 * Returns food, alcohol, and takeout rates as percentages.
 */
export function lookupTaxRates(zipCode: string): TaxRates | null {
  const zip = zipCode.replace(/\s/g, '').substring(0, 5)
  if (zip.length < 3) return null

  const prefix = zip.substring(0, 3)

  // Check exact prefix match first
  const zipEntry = ZIP_PREFIX_MAP[prefix]
  if (zipEntry) {
    const stateInfo = STATE_RATES[zipEntry.state]
    if (!stateInfo) return null

    const combinedRate = stateInfo.rate + zipEntry.localAddon
    const alcoholCombined = stateInfo.alcoholRate + zipEntry.localAddon

    return {
      state: zipEntry.state,
      stateName: stateInfo.name,
      foodRate: parseFloat(combinedRate.toFixed(3)),
      alcoholRate: parseFloat(alcoholCombined.toFixed(3)),
      takeoutRate: stateInfo.takeoutTaxable
        ? parseFloat(combinedRate.toFixed(3))
        : 0,
      combinedRate: parseFloat(combinedRate.toFixed(3)),
      source: 'exact',
    }
  }

  // Fall back to state average
  const stateCode = getStateFromZip(zip)
  if (!stateCode) return null

  const stateInfo = STATE_RATES[stateCode]
  if (!stateInfo) return null

  return {
    state: stateCode,
    stateName: stateInfo.name,
    foodRate: stateInfo.rate,
    alcoholRate: stateInfo.alcoholRate,
    takeoutRate: stateInfo.takeoutTaxable ? stateInfo.rate : 0,
    combinedRate: stateInfo.rate,
    source: 'state_average',
  }
}

/**
 * Get all US states for a dropdown.
 */
export function getUSStates(): Array<{ code: string; name: string }> {
  return Object.entries(STATE_RATES)
    .map(([code, info]) => ({ code, name: info.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
