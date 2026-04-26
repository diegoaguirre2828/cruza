#!/usr/bin/env node
// Quick: dump full profile state for the PWA users Diego is questioning.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) { console.error('missing env'); process.exit(1) }
const db = createClient(url, serviceKey, { auth: { persistSession: false } })

const handles = [
  'danteyaelmx',
  'vpina6845',
  'joselinvidal717',
  'vivipineiro6',
  'jorgeleon10479',
  'jocazares',
  'odalisarredondo10',
  'arturozayas88',
  'alejandramendoza1799',
  'areliresendez8',     // backfilled earlier
  'ramosmarcela576',    // backfilled earlier
]

const { data, error } = await db
  .from('profiles')
  .select('display_name, tier, pwa_installed_at, pro_via_pwa_until, promo_first_1000_until, created_at')
  .in('display_name', handles)
  .order('created_at', { ascending: false })

if (error) { console.error(error); process.exit(1) }

const now = Date.now()
const rows = (data || []).map((p) => {
  const installedAgo = p.pwa_installed_at
    ? Math.round((now - new Date(p.pwa_installed_at).getTime()) / (60 * 60 * 1000) * 10) / 10
    : null
  const promoActive = p.promo_first_1000_until && new Date(p.promo_first_1000_until).getTime() > now
  const pwaActive = p.pro_via_pwa_until && new Date(p.pro_via_pwa_until).getTime() > now
  return {
    name: p.display_name,
    db_tier: p.tier,
    installed_h_ago: installedAgo,
    pwa_grant: pwaActive ? 'ACTIVE' : (p.pro_via_pwa_until ? 'expired' : 'none'),
    promo_first1000: promoActive ? 'ACTIVE' : 'none',
    effective: pwaActive || promoActive ? 'PRO' : p.tier,
  }
})
console.table(rows)
