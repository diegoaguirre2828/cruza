#!/usr/bin/env node
// Seed the App Review demo account.
//
// Apple Review (build 1.0.19, 2026-04-27) flagged Issue 3 — no demo
// account in App Store Connect → reviewer can't see Pro features. This
// script creates an idempotent demo:
//   - email: appreview@cruzar.app
//   - password: <generated, printed at end — paste into ASC>
//   - tier: pro (so reviewer can verify Pro alerts + cameras + insights)
//   - 2 saved crossings + 1 active alert preference (so the dashboard
//     isn't empty when reviewer logs in)
//
// Usage:
//   node scripts/seed-app-review-demo.mjs
//
// Re-running is safe: looks up the existing user by email and resets
// the password + reseeds the rows. Reviewer-friendly.

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

const DEMO_EMAIL = 'appreview@cruzar.app'
// Friendly format that's easy to type into ASC's App Review Information.
// Mixed case + 12 chars = strong enough; this is a low-value account
// scoped to demo content only.
const password = `Cruzar-${randomBytes(4).toString('hex')}!`

// 1. Resolve / create user
let userId
{
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find((u) => u.email === DEMO_EMAIL)
  if (existing) {
    userId = existing.id
    const { error } = await sb.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (error) { console.error('updateUser failed', error); process.exit(1) }
    console.log(`reused existing demo user ${userId}`)
  } else {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'App Review Demo' },
    })
    if (error || !created?.user) { console.error('createUser failed', error); process.exit(1) }
    userId = created.user.id
    console.log(`created demo user ${userId}`)
  }
}

// 2. Profile — pro tier so reviewer sees Pro features
{
  const { error } = await sb.from('profiles').upsert({
    id: userId,
    display_name: 'app_review_demo',
    tier: 'pro',
    role: 'driver',
    full_name: 'App Review Demo',
    points: 24,
    reports_count: 3,
  }, { onConflict: 'id' })
  if (error) { console.warn('profile upsert warn', error.message) }
}

// 3. Two saved crossings (Hidalgo + Brownsville Vets) — sample content
//    so the /dashboard saved list isn't empty.
const SAVED_PORTS = ['230501', '535502']
{
  for (const port_id of SAVED_PORTS) {
    const { error } = await sb
      .from('saved_crossings')
      .upsert({ user_id: userId, port_id }, { onConflict: 'user_id,port_id' })
    if (error) { console.warn(`saved ${port_id} warn`, error.message) }
  }
}

// 4. One active alert preference at Hidalgo, threshold 30 min — so
//    /alerts shows a Pro feature in active state. The legacy
//    alert_preferences table predates the committed migrations and
//    we don't know its unique-constraint shape; safe pattern is to
//    delete-then-insert for the demo user.
{
  await sb.from('alert_preferences').delete().eq('user_id', userId)
  const { error } = await sb
    .from('alert_preferences')
    .insert({
      user_id: userId,
      port_id: '230501',
      lane_type: 'vehicle',
      threshold_minutes: 30,
      active: true,
    })
  if (error) { console.warn('alert pref warn', error.message) }
}

console.log('---')
console.log('App Review demo account ready.')
console.log('Paste these into App Store Connect → App Review Information:')
console.log(`  Username: ${DEMO_EMAIL}`)
console.log(`  Password: ${password}`)
console.log('---')
