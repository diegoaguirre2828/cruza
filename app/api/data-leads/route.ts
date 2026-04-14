import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/data-leads — public endpoint that captures B2B inquiries
// from the /data landing page. Writes to the data_leads table.
// No auth required (it's a lead magnet) but we rate-limit by IP and
// validate the email format.

const RATE_LIMIT_WINDOW_MIN = 60
const RATE_LIMIT_MAX = 3
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MIN * 60 * 1000 })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many inquiries — try again later' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : ''
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const trimOrNull = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null
    const s = v.trim().slice(0, max)
    return s || null
  }

  const db = getServiceClient()
  const { error } = await db.from('data_leads').insert({
    email,
    name: trimOrNull(body.name, 120),
    company: trimOrNull(body.company, 200),
    role: trimOrNull(body.role, 120),
    use_case: trimOrNull(body.useCase, 800),
    estimated_volume: trimOrNull(body.estimatedVolume, 80),
    source_utm: trimOrNull(body.sourceUtm, 200),
    referer: req.headers.get('referer')?.slice(0, 300) || null,
  })

  if (error) {
    console.error('data-leads insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
