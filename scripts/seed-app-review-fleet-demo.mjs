#!/usr/bin/env node
// Seed the App Review FLEET demo account.
//
// Apple Review (build 1.0.21, 2026-04-30) flagged Issue 3 — they need a
// demo account "flagged as fleet" so they can verify the Business-tier
// fleet/dispatcher dashboard. The pro demo at appreview@cruzar.app
// only exposes Pro features, not the /business and /fleet surfaces.
//
// This script creates an idempotent fleet demo:
//   - email: appreview-fleet@cruzar.app
//   - password: <generated, printed at end — paste into ASC>
//   - tier: business
//   - role: fleet_manager
//   - 2 saved crossings + 1 active alert preference
//   - 2 sample drivers
//   - 1 sample shipment
//
// Re-running is safe: looks up the existing user by email and resets
// the password + reseeds the rows.

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

const DEMO_EMAIL = 'appreview-fleet@cruzar.app'
const password = `Cruzar-Fleet-${randomBytes(4).toString('hex')}!`

let userId
{
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find((u) => u.email === DEMO_EMAIL)
  if (existing) {
    userId = existing.id
    const { error } = await sb.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (error) { console.error('updateUser failed', error); process.exit(1) }
    console.log(`reused existing fleet demo user ${userId}`)
  } else {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'App Review Fleet Demo' },
    })
    if (error || !created?.user) { console.error('createUser failed', error); process.exit(1) }
    userId = created.user.id
    console.log(`created fleet demo user ${userId}`)
  }
}

{
  const { error } = await sb.from('profiles').upsert({
    id: userId,
    display_name: 'app_review_fleet',
    tier: 'business',
    role: 'fleet_manager',
    full_name: 'App Review Fleet Demo',
    company: 'Cruzar Demo Logistics',
    points: 48,
    reports_count: 6,
  }, { onConflict: 'id' })
  if (error) { console.warn('profile upsert warn', error.message) }
}

const SAVED_PORTS = ['230501', '230402']
{
  for (const port_id of SAVED_PORTS) {
    const { error } = await sb
      .from('saved_crossings')
      .upsert({ user_id: userId, port_id }, { onConflict: 'user_id,port_id' })
    if (error) { console.warn(`saved ${port_id} warn`, error.message) }
  }
}

{
  await sb.from('alert_preferences').delete().eq('user_id', userId)
  const { error } = await sb
    .from('alert_preferences')
    .insert({
      user_id: userId,
      port_id: '230402',
      lane_type: 'commercial',
      threshold_minutes: 45,
      active: true,
    })
  if (error) { console.warn('alert pref warn', error.message) }
}

{
  await sb.from('drivers').delete().eq('owner_id', userId).then(() => null, () => null)
  const driverRows = [
    {
      owner_id: userId,
      name: 'Juan Martínez',
      phone: '+19561234001',
      carrier: 'Cruzar Demo Logistics',
      current_status: 'available',
      current_port_id: '230501',
      checkin_token: randomBytes(8).toString('hex'),
    },
    {
      owner_id: userId,
      name: 'Carlos Rivera',
      phone: '+19561234002',
      carrier: 'Cruzar Demo Logistics',
      current_status: 'at_bridge',
      current_port_id: '230402',
      checkin_token: randomBytes(8).toString('hex'),
    },
  ]
  for (const row of driverRows) {
    const { error } = await sb.from('drivers').insert(row)
    if (error) { console.warn('driver insert warn', error.message) }
  }
}

{
  await sb.from('shipments').delete().eq('user_id', userId).then(() => null, () => null)
  const { error } = await sb.from('shipments').insert({
    user_id: userId,
    reference_id: 'DEMO-001',
    description: 'Auto parts pallet — review demo',
    origin: 'Reynosa, MX',
    destination: 'McAllen, TX',
    port_id: '230501',
    carrier: 'Cruzar Demo Logistics',
    driver_name: 'Juan Martínez',
    driver_phone: '+19561234001',
    status: 'in_transit',
    expected_crossing_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  })
  if (error) { console.warn('shipment insert warn', error.message) }
}

console.log('---')
console.log('App Review FLEET demo ready.')
console.log('Paste these into App Store Connect → App Information → App Review Information:')
console.log(`  Username: ${DEMO_EMAIL}`)
console.log(`  Password: ${password}`)
console.log('---')
