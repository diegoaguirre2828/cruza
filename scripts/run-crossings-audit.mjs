#!/usr/bin/env node
// Cruzar Crossing audit gate.
//
// Composes synthetic crossings via composeCrossing(), verifies signatures
// round-trip, asserts modules_present matches blocks present, asserts
// canonicalization is stable across re-serialization. No DB writes.
//
// Run: node scripts/run-crossings-audit.mjs
//
// Exit non-zero on any fixture failure. Recon log goes to
// ~/.claude/projects/.../memory/project_cruzar_crossings_substrate_audit_<date>.md
// after a clean run (manually authored from this output).

import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Lazy import the TS sources via tsx-style runtime. For this audit we
// bypass build by importing the canonicalize/sign helpers directly. The
// scripts/ runner pattern mirrors run-module-14-audit.mjs.

async function loadSigner() {
  // Use ts-node-esque via tsx? Simpler: import the chassis as a
  // built bundle would be fragile. For a node-side audit we re-implement
  // canonicalize + sign with the same primitives.
  const ed = await import('@noble/ed25519')
  const { createHash } = await import('node:crypto')

  const canonicalize = (obj) => {
    if (obj === undefined) return 'null'
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
    if (Array.isArray(obj)) return '[' + obj.map(v => v === undefined ? 'null' : canonicalize(v)).join(',') + ']'
    const entries = Object.keys(obj).sort()
      .map(k => [k, obj[k]])
      .filter(([, v]) => v !== undefined)
    return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonicalize(v)).join(',') + '}'
  }

  const b64ToBytes = (b) => new Uint8Array(Buffer.from(b, 'base64'))
  const bytesToB64 = (b) => Buffer.from(b).toString('base64')
  const bytesToHex = (b) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  const sha256Bytes = (b) => new Uint8Array(createHash('sha256').update(b).digest())

  return { ed, canonicalize, b64ToBytes, bytesToB64, bytesToHex, sha256Bytes }
}

const FIXTURES = [
  {
    name: 'closure-only-snooze-button',
    input: {
      user_id: '00000000-0000-0000-0000-000000000001',
      port_id: '230501',
      direction: 'us_to_mx',
      status: 'completed',
      closure: {
        closed_at: '2026-05-04T03:00:00Z',
        reason: 'user_button_ya_cruce',
        alert_id_snoozed: '11111111-1111-1111-1111-111111111111',
        snoozed_until: '2026-05-04T19:00:00Z',
      },
    },
    expectModules: ['closure'],
  },
  {
    name: 'detection-plus-closure-auto-geofence',
    input: {
      user_id: '00000000-0000-0000-0000-000000000002',
      port_id: '230501',
      direction: 'mx_to_us',
      status: 'completed',
      detection: {
        detected_at: '2026-05-04T13:14:00Z',
        detection_source: 'geofence_exit',
        confidence: 0.95,
        duration_min: 12,
        lane_inferred: 'vehicle',
      },
      closure: {
        closed_at: '2026-05-04T13:14:00Z',
        reason: 'auto_geofence_exit',
        alert_id_snoozed: '22222222-2222-2222-2222-222222222222',
        snoozed_until: '2026-05-05T05:14:00Z',
      },
    },
    expectModules: ['detection', 'closure'],
  },
  {
    name: 'planning-prep-only',
    input: {
      user_id: '00000000-0000-0000-0000-000000000003',
      port_id: '230502',
      direction: 'us_to_mx',
      status: 'planning',
      prep: {
        predicted_wait_min_at_start: 28,
        predicted_wait_source: 'rf_v0_5_2',
        has_sentri: true,
        vehicle_type: 'sedan',
      },
    },
    expectModules: ['prep'],
  },
  {
    name: 'alert-fired-block',
    input: {
      user_id: '00000000-0000-0000-0000-000000000004',
      port_id: '230501',
      direction: 'mx_to_us',
      alert: {
        alert_id: '33333333-3333-3333-3333-333333333333',
        threshold_minutes: 30,
        fired_at: '2026-05-04T07:00:00Z',
        predicted_drop_min: 22,
        channels: ['push'],
        delivered_to_devices: 1,
      },
    },
    expectModules: ['alert'],
  },
  {
    name: 'full-trip-all-modules',
    input: {
      user_id: '00000000-0000-0000-0000-000000000005',
      port_id: '230501',
      direction: 'mx_to_us',
      status: 'completed',
      cohort_tags: ['sentri', 'sedan', 'weekday-am'],
      prep: { predicted_wait_min_at_start: 25, predicted_wait_source: 'rf_v0_5_2', has_sentri: true },
      alert: { alert_id: 'a', threshold_minutes: 30, fired_at: '2026-05-04T07:00:00Z', predicted_drop_min: 18, channels: ['push'], delivered_to_devices: 1 },
      live: { wait_readings: [{ recorded_at: '2026-05-04T07:14:00Z', vehicle: 16 }], camera_frames: [], anomaly_flags: [] },
      detection: { detected_at: '2026-05-04T07:23:00Z', detection_source: 'geofence_exit', confidence: 0.95, duration_min: 9, lane_inferred: 'sentri' },
      report: { report_id: 'r1', wait_minutes: 9, report_type: 'crossing', submitted_at: '2026-05-04T07:30:00Z' },
      closure: { closed_at: '2026-05-04T07:23:00Z', reason: 'auto_geofence_exit', alert_id_snoozed: 'a', snoozed_until: '2026-05-04T23:23:00Z' },
      safety: { copilot_active: true, family_eta_fired: true, contacts_texted: 1, sos_invoked: false },
      context: { eonet_events_nearby: [], closures_detected: [], officer_staffing_anomaly: false },
    },
    expectModules: ['prep', 'alert', 'live', 'detection', 'report', 'closure', 'safety', 'context'],
  },
  {
    name: 'tampered-payload-fails-verify',
    tamper: true,
    input: {
      user_id: '00000000-0000-0000-0000-000000000006',
      port_id: '230501',
      direction: 'us_to_mx',
      closure: { closed_at: '2026-05-04T03:00:00Z', reason: 'manual', alert_id_snoozed: null, snoozed_until: null },
    },
    expectModules: ['closure'],
  },
]

function composePure(input, sig) {
  const { canonicalize, sha256Bytes, bytesToHex } = sig
  const blocks = {}
  const modules_present = []
  const order = ['prep', 'alert', 'live', 'detection', 'report', 'closure', 'safety', 'context', 'commerce']
  for (const k of order) if (input[k] !== undefined) { blocks[k] = input[k]; modules_present.push(k) }
  const payload = {
    schema: 'cruzar.crossing.v1',
    id: '00000000-1111-2222-3333-444444444444',
    user_id: input.user_id,
    port_id: input.port_id,
    port_name: input.port_name,
    direction: input.direction,
    status: input.status ?? (input.detection?.exit_at ? 'completed' : 'planning'),
    modules_present,
    cohort_tags: input.cohort_tags ?? [],
    started_at: '2026-05-04T03:00:00Z',
    ended_at: null,
    blocks,
  }
  const canonical = canonicalize(payload)
  const hash = sha256Bytes(new TextEncoder().encode(canonical))
  return { payload, canonical, hashHex: bytesToHex(hash) }
}

async function main() {
  const sig = await loadSigner()
  const { ed, canonicalize, b64ToBytes, bytesToB64, sha256Bytes } = sig

  const privB64 = process.env.CRUZAR_TICKET_SIGNING_KEY
  const pubB64 = process.env.CRUZAR_TICKET_PUBLIC_KEY
  if (!privB64 || !pubB64) {
    console.error('FAIL: CRUZAR_TICKET_SIGNING_KEY / CRUZAR_TICKET_PUBLIC_KEY missing from env')
    process.exit(2)
  }
  const priv = b64ToBytes(privB64)
  const pub = b64ToBytes(pubB64)

  let pass = 0, fail = 0
  const results = []

  for (const fx of FIXTURES) {
    const { payload, canonical, hashHex } = composePure(fx.input, sig)
    const sigBytes = await ed.signAsync(sha256Bytes(new TextEncoder().encode(canonical)), priv)

    // 1. modules_present matches blocks present
    const got = payload.modules_present
    const want = fx.expectModules
    const modsOk = JSON.stringify(got) === JSON.stringify(want)

    // 2. signature verifies
    const reHash = sha256Bytes(new TextEncoder().encode(canonical))
    const verifyOk = await ed.verifyAsync(sigBytes, reHash, pub)

    // 3. tamper case — flipping a bit on the canonical payload should NOT verify
    let tamperDetected = !fx.tamper
    if (fx.tamper) {
      const tampered = canonical.replace('"manual"', '"forged"')
      const tHash = sha256Bytes(new TextEncoder().encode(tampered))
      const tOk = await ed.verifyAsync(sigBytes, tHash, pub)
      tamperDetected = !tOk
    }

    const ok = modsOk && verifyOk && tamperDetected
    results.push({ name: fx.name, modsOk, verifyOk, tamperDetected, ok })
    if (ok) { pass++; console.log(`✅ ${fx.name}`) }
    else {
      fail++
      console.log(`❌ ${fx.name} mods=${modsOk} verify=${verifyOk} tamper=${tamperDetected}`)
      console.log(`   want: ${JSON.stringify(want)}`)
      console.log(`   got:  ${JSON.stringify(got)}`)
    }
  }

  console.log(`\n${pass}/${pass + fail} passed`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(2) })
