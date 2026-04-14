import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// CRUD for user-added Facebook groups that promoters can target.
// Merged with the hardcoded lib/facebookGroups.ts core list at render
// time in the promoter dashboard. Auth-gated to is_promoter or admin.
//
// Schema (run once in Supabase SQL editor):
//
//   CREATE TABLE IF NOT EXISTS facebook_groups (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     name TEXT NOT NULL,
//     url TEXT NOT NULL UNIQUE,
//     region TEXT NOT NULL,
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     created_by UUID REFERENCES auth.users(id)
//   );
//
//   ALTER TABLE facebook_groups ENABLE ROW LEVEL SECURITY;
//
//   CREATE POLICY "promoters can read facebook_groups" ON facebook_groups
//     FOR SELECT USING (
//       EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_promoter = true)
//     );

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

const VALID_REGIONS = new Set([
  'rgv', 'brownsville', 'laredo', 'eagle_pass', 'el_paso',
  'san_luis', 'nogales', 'tijuana', 'mexicali', 'other',
])

async function getPromoterUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = getServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('is_promoter')
    .eq('id', user.id)
    .single()

  if (user.email !== ADMIN_EMAIL && !profile?.is_promoter) return null
  return user
}

export async function GET() {
  const user = await getPromoterUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getServiceClient()
  const { data, error } = await db
    .from('facebook_groups')
    .select('id, name, url, region, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ groups: data || [] })
}

// Parse a textarea paste. Each line can be:
//   https://www.facebook.com/groups/123
//   Group name | https://www.facebook.com/groups/123
//   Group name, https://www.facebook.com/groups/123
// Empty lines ignored. Malformed lines dropped.
function parseBulkText(text: string): { name: string; url: string }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const results: { name: string; url: string }[] = []

  for (const line of lines) {
    // Try "name | url" or "name, url" first
    let name: string | null = null
    let url: string | null = null

    if (line.includes('|')) {
      const [n, u] = line.split('|').map(s => s.trim())
      if (n && u && u.startsWith('http')) { name = n; url = u }
    } else if (line.includes(',') && line.match(/,\s*https?:/)) {
      // Only split on comma if the part after is a URL — group names
      // sometimes contain commas, so we're careful here.
      const idx = line.search(/,\s*https?:/)
      name = line.slice(0, idx).trim()
      url = line.slice(idx + 1).trim()
    } else if (line.startsWith('http')) {
      // Plain URL — generate a placeholder name from the slug
      url = line
      const match = line.match(/facebook\.com\/groups\/([^/?#]+)/i)
      name = match ? `Grupo ${match[1]}` : 'Grupo sin nombre'
    }

    if (url && name) {
      // Normalize URL — strip query strings and trailing slash, force https
      url = url.replace(/\?.*$/, '').replace(/\/$/, '').replace(/^http:/, 'https:')
      results.push({ name: name.slice(0, 200), url })
    }
  }

  return results
}

export async function POST(req: NextRequest) {
  const user = await getPromoterUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { bulkText, region } = body

  if (typeof bulkText !== 'string' || !bulkText.trim()) {
    return NextResponse.json({ error: 'bulkText is required' }, { status: 400 })
  }
  if (typeof region !== 'string' || !VALID_REGIONS.has(region)) {
    return NextResponse.json({ error: 'invalid region' }, { status: 400 })
  }

  const parsed = parseBulkText(bulkText)
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'No valid URLs found in input' }, { status: 400 })
  }

  const db = getServiceClient()

  // Bulk upsert — ignore duplicates via the url unique constraint
  const rows = parsed.map(p => ({ ...p, region, created_by: user.id }))
  const { data, error } = await db
    .from('facebook_groups')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
    .select('id, name, url, region')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    added: data?.length || 0,
    skipped: parsed.length - (data?.length || 0),
    groups: data || [],
  })
}
