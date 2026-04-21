#!/usr/bin/env node
// Generate a bilingual cold-email template Diego pastes into
// Gmail/Outlook, personalized per-carrier from the FMCSA CSV.
//
// Produces scripts/output/cold-emails/<usdot>.txt — one file per
// carrier, ready to paste. Subject line included at top.
//
// Run order:
//   1. node scripts/fmcsa-rgv-carriers.mjs       (produce the carrier list)
//   2. node scripts/business-tier-cold-email.mjs (produce per-carrier emails)

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_IN = resolve(__dirname, 'output', 'fmcsa-rgv-carriers.csv')
const OUT_DIR = resolve(__dirname, 'output', 'cold-emails')

const HOURLY_LOSS = 85
const AVG_BORDER_DELAY_MIN_PER_WEEK = 180 // conservative RGV avg

function parseCSV(text) {
  const lines = text.split('\n').filter(Boolean)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const vals = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { vals.push(cur); cur = ''; continue }
      cur += ch
    }
    vals.push(cur)
    const row = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

function firstName(fullName) {
  if (!fullName) return ''
  return fullName.split(/\s+/)[0]
}

function weeklyLossFor(powerUnits) {
  const pu = Math.max(1, Math.min(50, Number(powerUnits) || 2))
  const perTruckWeekly = (AVG_BORDER_DELAY_MIN_PER_WEEK / 60) * HOURLY_LOSS
  return Math.round(perTruckWeekly * pu)
}

function emailFor(carrier) {
  const name = carrier.dba || carrier.legal_name
  const pu = carrier.power_units || '2'
  const estLoss = weeklyLossFor(pu)
  const subject = `${name}: ~$${estLoss.toLocaleString()}/week lost to border delays`

  const body = [
    `Subject: ${subject}`,
    '',
    `Hola ${firstName(name)},`,
    '',
    `Soy Diego, hice Cruzar — app de tiempos de espera en vivo para los puentes US-México. Construida en el Valle.`,
    ``,
    `Rápido y sin vueltas: basado en tus ${pu} unidades saliendo de ${(carrier.city || 'RGV').toLowerCase()}, calculo que ${name} pierde alrededor de **$${estLoss.toLocaleString()} cada semana** en demoras de puente ($85/hr × demora promedio de 3 hrs/unidad/semana).`,
    ``,
    `Cruzar Business tracks por cada carga:`,
    ` • tiempo de espera en vivo del puente que vas a cruzar`,
    ` • ETA al consignatario (link que les mandas por WhatsApp, ven el status en vivo)`,
    ` • reporte semanal con el $ que perdiste por demora, por puente, por chofer`,
    ` • reportes comunitarios del sur (southbound — nadie más tiene esto, CBP es solo norte)`,
    ``,
    `$19.99/mes. Sin contrato. 14 días de prueba. Si no ves las demoras reducirse en 30 días, te regreso el dinero.`,
    ``,
    `¿Te pongo en la prueba esta semana? Contesta con "sí" y te mando el link de setup.`,
    ``,
    `— Diego Aguirre`,
    `   hello@cruzar.app · cruzar.app`,
    ``,
    `---`,
    ``,
    `Hi ${firstName(name)},`,
    ``,
    `I built Cruzar — the live US-Mexico border wait-time app, built in the RGV.`,
    ``,
    `Quick math: with ${pu} power units running from ${carrier.city || 'RGV'}, I estimate ${name} is losing around **$${estLoss.toLocaleString()} per week** to border delays ($85/hr × avg 3 hrs/unit/week of delay).`,
    ``,
    `Cruzar Business tracks, per shipment:`,
    ` • live wait at the bridge your truck is about to hit`,
    ` • consignee tracking link (paste in WhatsApp, customer sees live status)`,
    ` • weekly report — $ you lost to delays, by bridge, by driver`,
    ` • southbound community reports (nobody else has this — CBP is northbound-only)`,
    ``,
    `$19.99/mo. No contract. 14-day trial. If delays don't drop in 30 days I refund it.`,
    ``,
    `Want to try it this week? Reply "yes" and I'll send the setup link.`,
    ``,
    `— Diego Aguirre`,
    `   hello@cruzar.app · cruzar.app`,
  ].join('\n')

  return body
}

async function main() {
  const csv = await readFile(CSV_IN, 'utf8').catch(() => {
    console.error(`Run scripts/fmcsa-rgv-carriers.mjs first — missing ${CSV_IN}`)
    process.exit(1)
  })
  const rows = parseCSV(csv)
  await mkdir(OUT_DIR, { recursive: true })
  let wrote = 0
  for (const row of rows) {
    const usdot = row.usdot?.trim()
    if (!usdot) continue
    const file = resolve(OUT_DIR, `${usdot}.txt`)
    await writeFile(file, emailFor(row), 'utf8')
    wrote++
  }
  console.log(`✓ Wrote ${wrote} cold-email drafts → ${OUT_DIR}`)
  console.log(`  Subject + bilingual body per carrier.`)
  console.log(`  Phones are in the CSV; emails are NOT (FMCSA doesn't publish). Use the carrier's public contact form + USPS for no-email carriers.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
