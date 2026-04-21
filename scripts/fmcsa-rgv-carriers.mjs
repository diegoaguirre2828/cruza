#!/usr/bin/env node
// Pull FMCSA SAFER public-database carriers based in the Rio Grande
// Valley + Laredo + Eagle Pass zip clusters — the RGV trucking
// ecosystem that crosses the US-Mexico border daily.
//
// Output: scripts/output/fmcsa-rgv-carriers.csv
//
// Uses the FMCSA QCMobile public endpoint. No API key required
// (public data). The full SAFER dataset is available as a monthly
// zip download; for fast/targeted extraction we hit the by-state +
// by-city search endpoints.
//
// Run: node scripts/fmcsa-rgv-carriers.mjs
//
// Notes:
// - FMCSA rate-limits aggressive scraping. Sleeps 500ms between requests.
// - Results include: legal_name, dba, usdot, mc, address, city, zip,
//   phone, power_units, drivers.
// - Dispatcher/owner email is NOT in the public database — the cold
//   outreach step uses the carrier's public contact form or mailed
//   letter. (Or you buy it from a carrier-contacts reseller for
//   ~$200/10k records — separate step, not this script.)

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output')
const OUT_FILE = resolve(OUT_DIR, 'fmcsa-rgv-carriers.csv')

// Primary RGV border cities — known trucking clusters near the
// commercial crossings. Pharr and Laredo dominate; Brownsville +
// McAllen have smaller but notable fleet populations.
const RGV_CITIES = [
  { city: 'LAREDO', state: 'TX' },
  { city: 'PHARR', state: 'TX' },
  { city: 'MCALLEN', state: 'TX' },
  { city: 'BROWNSVILLE', state: 'TX' },
  { city: 'HIDALGO', state: 'TX' },
  { city: 'EDINBURG', state: 'TX' },
  { city: 'MISSION', state: 'TX' },
  { city: 'WESLACO', state: 'TX' },
  { city: 'HARLINGEN', state: 'TX' },
  { city: 'EAGLE PASS', state: 'TX' },
  { city: 'DEL RIO', state: 'TX' },
  { city: 'RIO GRANDE CITY', state: 'TX' },
  { city: 'ROMA', state: 'TX' },
]

const BASE = 'https://mobile.fmcsa.dot.gov/qc/services'

async function fetchCarriersForCity(city, state) {
  // QCMobile's company search. Public endpoint, no auth. Returns
  // JSON array of carrier summaries; we fetch the detail for each.
  const url = `${BASE}/carriers/search?name=&city=${encodeURIComponent(city)}&state=${state}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'cruzar-research/1.0 (hello@cruzar.app)' },
  })
  if (!res.ok) {
    console.warn(`[${city}] ${res.status} ${res.statusText}`)
    return []
  }
  const data = await res.json().catch(() => null)
  if (!Array.isArray(data?.content)) return []
  return data.content
    .map((c) => ({
      legal_name: (c?.carrier?.legalName ?? '').trim(),
      dba: (c?.carrier?.dbaName ?? '').trim(),
      usdot: c?.carrier?.dotNumber ?? '',
      mc: c?.carrier?.mcNumber ?? '',
      street: (c?.carrier?.phyStreet ?? '').trim(),
      city: (c?.carrier?.phyCity ?? '').trim(),
      state: (c?.carrier?.phyState ?? '').trim(),
      zip: (c?.carrier?.phyZipcode ?? '').trim(),
      phone: (c?.carrier?.phone ?? '').trim(),
      power_units: c?.carrier?.totalPowerUnits ?? '',
      drivers: c?.carrier?.totalDrivers ?? '',
    }))
    .filter((c) => c.usdot && c.city)
}

function toCSV(rows) {
  const headers = [
    'legal_name', 'dba', 'usdot', 'mc', 'street', 'city', 'state', 'zip',
    'phone', 'power_units', 'drivers',
  ]
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n')
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const seen = new Set()
  const all = []
  for (const { city, state } of RGV_CITIES) {
    const carriers = await fetchCarriersForCity(city, state)
    let added = 0
    for (const c of carriers) {
      const key = c.usdot
      if (seen.has(key)) continue
      seen.add(key)
      all.push(c)
      added++
    }
    console.log(`[${city}, ${state}] ${carriers.length} fetched, ${added} new (total ${all.length})`)
    await new Promise((r) => setTimeout(r, 500))
  }
  // Bias the output toward small fleets (2-10 trucks) — the $19.99/mo
  // Business tier target. Put them first, then everyone else.
  const small = all.filter((c) => {
    const pu = Number(c.power_units) || 0
    return pu >= 2 && pu <= 10
  })
  const rest = all.filter((c) => !small.includes(c))
  const ordered = [...small, ...rest]
  const csv = toCSV(ordered)
  await writeFile(OUT_FILE, csv, 'utf8')
  console.log(`\n✓ Wrote ${ordered.length} carriers → ${OUT_FILE}`)
  console.log(`  Small-fleet (2-10 power units) first: ${small.length}`)
  console.log(`  Larger / unknown: ${rest.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
