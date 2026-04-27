#!/usr/bin/env node
// Revoke first-1000 lifetime promo from users who have NOT actually
// installed the PWA. Companion to v57 (which gated future grants to
// install). Diego 2026-04-26: "revoke for those without pwa."
//
// Eligibility for revocation:
//   - promo_first_1000_until IS NOT NULL (currently holds the grant)
//   - AND pwa_installed_at IS NULL (never hit the claim-pwa-pro
//     endpoint — claim-pwa-pro stamps pwa_installed_at on the FIRST
//     call, even before the 24h gate, so this is a clean "never
//     installed" signal)
//   - AND install_state IN (NULL, 'web') (most recent device ping
//     says they're on the web, not standalone PWA / TWA / capacitor)
//
// Both signals must agree — a user with install_state='pwa' but
// pwa_installed_at=null could be a sign-out edge case (iOS storage
// partition); we keep their grant. A user with install_state='web'
// but pwa_installed_at SET could be checking from desktop while
// having the PWA installed on a phone; we keep their grant.
//
// Action: set promo_first_1000_until = NULL. tier flip is handled
// at runtime by useTier — the user immediately reverts to free in
// the next page load.
//
// Run from cruzar root:  node scripts/revoke-promo-without-pwa.mjs
// Add --dry to preview without writing.

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) { console.error('missing env'); process.exit(1) }

const dry = process.argv.includes('--dry')
const db = createClient(url, serviceKey, { auth: { persistSession: false } })

// Pull all users with the promo, then filter client-side. Supabase
// PostgREST doesn't let us cleanly express the (NULL OR 'web')
// install_state predicate in one filter — easier to do it locally.
const { data: candidates, error } = await db
  .from('profiles')
  .select('id, display_name, tier, install_state, pwa_installed_at, last_seen_at, last_seen_device, last_seen_os, promo_first_1000_until')
  .not('promo_first_1000_until', 'is', null)

if (error) { console.error(error); process.exit(1) }

const eligible = (candidates || []).filter((p) => {
  if (p.pwa_installed_at) return false
  const state = p.install_state
  return !state || state === 'web'
})

console.log(`\nfound ${eligible.length} promo holders without PWA install`)
console.log(`(${candidates?.length ?? 0} total promo holders before filter)\n`)

if (eligible.length > 0) {
  const preview = eligible.slice(0, 12).map((p) => ({
    name: p.display_name,
    install: p.install_state || '—',
    last_device: p.last_seen_device || '—',
    last_os: p.last_seen_os || '—',
    last_seen: p.last_seen_at,
  }))
  console.table(preview)
  if (eligible.length > 12) console.log(`... and ${eligible.length - 12} more`)
}

if (dry) {
  console.log('\n--dry: nothing written. re-run without --dry to revoke.')
  process.exit(0)
}

if (eligible.length === 0) {
  console.log('nothing to do.')
  process.exit(0)
}

let revoked = 0
let failed = 0
for (const p of eligible) {
  // Clear the promo. If their dbTier is 'pro' AND they have no other
  // active grant, they revert to free at runtime via useTier (no
  // explicit tier flip needed — useTier reads dbTier='free' for
  // these users since v51 set tier='free' and only flipped effective
  // tier via promo).
  const { error } = await db
    .from('profiles')
    .update({ promo_first_1000_until: null })
    .eq('id', p.id)
  if (error) {
    failed += 1
    console.error(`failed for ${p.display_name}:`, error.message)
  } else {
    revoked += 1
  }
}

console.log(`\nrevoked promo from ${revoked} users. failures: ${failed}`)

// Re-count remaining holders so Diego can see how many slots opened.
const { count: remaining } = await db
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .not('promo_first_1000_until', 'is', null)
console.log(`remaining first-1000 holders: ${remaining ?? '?'} / 1000`)
console.log(`open slots: ${1000 - (remaining ?? 0)}`)
