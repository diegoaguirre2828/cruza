#!/usr/bin/env node
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
config({ path: '.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Find all profiles with install_state='pwa' but tier='free' and no active promo
const now = Date.now()
const { data } = await db
  .from('profiles')
  .select('display_name, tier, install_state, pwa_installed_at, pro_via_pwa_until, promo_first_1000_until, created_at, last_seen_at')
  .eq('install_state', 'pwa')
  .eq('tier', 'free')

const stuck = (data || []).filter((p) => {
  const pwaActive = p.pro_via_pwa_until && new Date(p.pro_via_pwa_until).getTime() > now
  const promoActive = p.promo_first_1000_until && new Date(p.promo_first_1000_until).getTime() > now
  return !pwaActive && !promoActive
})

console.log(`PWA install_state + tier='free' + no active grant: ${stuck.length}\n`)
console.table(stuck.map(p => ({
  name: p.display_name,
  installed_h_ago: p.pwa_installed_at ? Math.round((now - new Date(p.pwa_installed_at).getTime()) / 3600000 * 10) / 10 : null,
  signed_up_h_ago: p.created_at ? Math.round((now - new Date(p.created_at).getTime()) / 3600000 * 10) / 10 : null,
  last_seen_h_ago: p.last_seen_at ? Math.round((now - new Date(p.last_seen_at).getTime()) / 3600000 * 10) / 10 : null,
})))
