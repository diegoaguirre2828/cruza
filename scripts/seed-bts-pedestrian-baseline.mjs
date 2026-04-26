#!/usr/bin/env node
// Seed bts_pedestrian_baseline with monthly pedestrian counts per port.
//
// Source: Bureau of Transportation Statistics — Border Crossing Entry
// Data dataset (https://data.bts.gov/Research-and-Statistics/...) which
// publishes monthly Pedestrian counts per US port of entry going back
// to 1996. Public domain.
//
// The constants below are SEED VALUES based on published BTS averages
// for 2023-2024 — round numbers, not month-by-month exact. Good enough
// for the "normalmente cruzan ~X peatones/h" context band on the hero
// card. To refresh from the live BTS Socrata API:
//
//   node scripts/seed-bts-pedestrian-baseline.mjs --from-bts
//
// (TODO — Socrata fetch path. Seed-only run is what ships today.)
//
// BTS reports per US port. When CBP BWT has multiple bridges per port
// (e.g. Brownsville has 3 bridges, all aggregate to "Brownsville, TX"
// in BTS), we apportion the BTS total across the bridges using public
// observation of which bridges actually carry pedestrian traffic.
//
// Usage:
//   node scripts/seed-bts-pedestrian-baseline.mjs

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Approximate monthly pedestrian crossings (northbound) per CBP BWT port,
// derived from BTS 2023-2024 averages. Rounded to nearest thousand for
// honest-precision. Bridges with effectively zero pedestrian traffic
// (Pharr, Anzalduas, Colombia, Laredo II/IV — vehicle/commercial only)
// are intentionally omitted; the absence of a row signals "not a
// pedestrian crossing" to the API.
//
// Source notes:
// - San Ysidro is by far the busiest pedestrian crossing in the world
//   (~25M/yr northbound)
// - Calexico West has dedicated PedWest facility (~9M/yr)
// - Brownsville total apportioned: Gateway 50%, B&M 30%, Vets 15%, Tomates 5%
// - Hidalgo total apportioned: Hidalgo 95%, Donna 5% (Donna minimal)
const MONTHLY_PEDESTRIANS = [
  // ─── RGV ──────────────────────────────────────
  { port_id: '230501', name: 'Hidalgo / McAllen',         monthly: 90000  },
  { port_id: '230901', name: 'Progreso',                  monthly: 45000  },
  { port_id: '230701', name: 'Rio Grande City',           monthly: 8000   },
  { port_id: '231001', name: 'Roma',                      monthly: 12000  },

  // ─── Brownsville cluster ──────────────────────
  { port_id: '535501', name: 'Brownsville Gateway',       monthly: 90000  },
  { port_id: '535502', name: 'Brownsville Veterans',      monthly: 25000  },
  { port_id: '535503', name: 'Brownsville Los Tomates',   monthly: 8000   },
  { port_id: '535504', name: 'Brownsville B&M',           monthly: 55000  },

  // ─── Laredo ───────────────────────────────────
  { port_id: '230401', name: 'Laredo I (Gateway)',        monthly: 70000  },

  // ─── Eagle Pass / Del Rio ─────────────────────
  { port_id: '250301', name: 'Eagle Pass I',              monthly: 22000  },
  { port_id: '250302', name: 'Eagle Pass II',             monthly: 12000  },
  { port_id: '250401', name: 'Del Rio',                   monthly: 18000  },

  // ─── El Paso ──────────────────────────────────
  { port_id: '240501', name: 'Bridge of the Americas',    monthly: 150000 },
  { port_id: '240502', name: 'Paso del Norte (Stanton)',  monthly: 280000 },
  { port_id: '240503', name: 'Ysleta',                    monthly: 95000  },

  // ─── Sonora ↔ Arizona ─────────────────────────
  { port_id: '260401', name: 'Nogales DeConcini',         monthly: 250000 },
  { port_id: '260402', name: 'Nogales Mariposa',          monthly: 35000  },

  // ─── Baja ↔ California ────────────────────────
  { port_id: '250401_caco', name: 'Calexico East',        monthly: 250000 },
  { port_id: '250404',      name: 'Calexico West',        monthly: 700000 },
  { port_id: '240202',      name: 'San Ysidro',           monthly: 2200000 },
  { port_id: '240203',      name: 'Otay Mesa',            monthly: 120000 },
  { port_id: '240204',      name: 'Tecate',               monthly: 35000  },
]

async function main() {
  const supa = createClient(url, key, { auth: { persistSession: false } })

  // Use the previous calendar month as the baseline reference. Real BTS
  // data lags ~2 months, so this is a sensible "what is normal" anchor
  // that refreshes if the script is re-run.
  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const year = prevMonth.getFullYear()
  const month = prevMonth.getMonth() + 1

  const rows = MONTHLY_PEDESTRIANS.map((r) => ({
    port_id: r.port_id,
    year,
    month,
    pedestrians_count: r.monthly,
    source: 'BTS Border Crossing Entry Data (seeded constants)',
    notes: `${r.name} — apportioned from US-port BTS total. Refresh via Socrata when port mapping is verified.`,
  }))

  // Upsert so re-running with updated numbers overwrites cleanly.
  const { error } = await supa
    .from('bts_pedestrian_baseline')
    .upsert(rows, { onConflict: 'port_id,year,month' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Seeded ${rows.length} pedestrian baseline rows for ${year}-${String(month).padStart(2, '0')}`)
  for (const r of MONTHLY_PEDESTRIANS) {
    const perDay = Math.round(r.monthly / 30)
    const perHour = Math.round(perDay / 24)
    console.log(`  ${r.port_id.padEnd(15)} ${r.name.padEnd(35)} ${r.monthly.toLocaleString().padStart(10)}/mo  ~${perHour}/h`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
