#!/usr/bin/env node
// One-shot: grant Pro to any user who's actually installed the PWA
// but is currently sitting on free tier. Companion to the 24h-gate
// removal in /api/user/claim-pwa-pro on 2026-04-26.
//
// Eligibility:
//   - install_state IN ('pwa', 'twa', 'capacitor') OR pwa_installed_at IS NOT NULL
//   - AND tier = 'free'
//   - AND no active pro_via_pwa_until
//   - AND no active promo_first_1000_until
//
// Action:
//   - tier = 'pro'
//   - pro_via_pwa_until = now + 90 days
//   - promo_first_1000_until = now + 100 years (if global cap < 1000)
//
// Run from cruzar root:  node scripts/backfill-stuck-pwa-users.mjs
// Add --dry to preview.

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) { console.error('missing env'); process.exit(1) }

const dry = process.argv.includes('--dry')
const db = createClient(url, serviceKey, { auth: { persistSession: false } })

const now = Date.now()
const grantExpiresAt = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString()
const promoExpiresAt = new Date(now + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()

const { data: candidates, error } = await db
  .from('profiles')
  .select('id, display_name, tier, install_state, pwa_installed_at, pro_via_pwa_until, promo_first_1000_until')
  .eq('tier', 'free')

if (error) { console.error(error); process.exit(1) }

const eligible = (candidates || []).filter((p) => {
  const installedSignal = (p.install_state && p.install_state !== 'web') || !!p.pwa_installed_at
  if (!installedSignal) return false
  const pwaActive = p.pro_via_pwa_until && new Date(p.pro_via_pwa_until).getTime() > now
  const promoActive = p.promo_first_1000_until && new Date(p.promo_first_1000_until).getTime() > now
  return !pwaActive && !promoActive
})

console.log(`\nstuck PWA users on free tier: ${eligible.length}\n`)

if (eligible.length > 0) {
  console.table(eligible.slice(0, 12).map((p) => ({
    name: p.display_name,
    install_state: p.install_state || '—',
    pwa_installed_at: p.pwa_installed_at,
  })))
  if (eligible.length > 12) console.log(`... and ${eligible.length - 12} more`)
}

if (dry) { console.log('\n--dry: nothing written.'); process.exit(0) }
if (eligible.length === 0) { console.log('nothing to do.'); process.exit(0) }

// Check global promo cap
const { count: globalPromoCount } = await db
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .not('promo_first_1000_until', 'is', null)

const remainingSlots = Math.max(0, 1000 - (globalPromoCount ?? 0))
console.log(`promo slots open: ${remainingSlots} / 1000\n`)

let granted = 0
let promoGranted = 0
let failed = 0
let slotsLeft = remainingSlots
for (const p of eligible) {
  const updates = {
    tier: 'pro',
    pro_via_pwa_until: grantExpiresAt,
  }
  if (slotsLeft > 0) {
    updates.promo_first_1000_until = promoExpiresAt
    slotsLeft -= 1
    promoGranted += 1
  }
  const { error } = await db.from('profiles').update(updates).eq('id', p.id)
  if (error) { failed += 1; console.error(`failed ${p.display_name}:`, error.message) }
  else granted += 1
}

console.log(`\ngranted Pro to ${granted} users (lifetime promo to ${promoGranted}). failures: ${failed}`)
