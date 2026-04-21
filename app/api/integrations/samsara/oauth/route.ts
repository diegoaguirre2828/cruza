import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Samsara OAuth 2.0 Connect flow.
//
// GET  /api/integrations/samsara/oauth         — redirect user to Samsara consent
// GET  /api/integrations/samsara/oauth?code=…  — callback: exchange code for tokens
//
// ENV required (Diego provisions in Samsara Partner portal once a
// Samsara-using fleet signs up):
//   SAMSARA_CLIENT_ID
//   SAMSARA_CLIENT_SECRET
//   SAMSARA_REDIRECT_URI  (default: https://cruzar.app/api/integrations/samsara/oauth)
//
// Scaffold-only: no fleet has signed up yet. When the first one does,
// set env vars on Vercel prod + register the redirect URI in Samsara,
// and this route handles the rest.

export const dynamic = 'force-dynamic'

const SAMSARA_AUTH = 'https://api.samsara.com/oauth2/authorize'
const SAMSARA_TOKEN = 'https://api.samsara.com/oauth2/token'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const errorParam = req.nextUrl.searchParams.get('error')
  if (errorParam) {
    return NextResponse.redirect(new URL(`/business?samsara_error=${encodeURIComponent(errorParam)}`, req.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login?next=/business', req.url))

  const db = getServiceClient()
  const { data: profile } = await db.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'business') {
    return NextResponse.redirect(new URL('/pricing?upgrade=samsara', req.url))
  }

  const clientId = process.env.SAMSARA_CLIENT_ID
  const clientSecret = process.env.SAMSARA_CLIENT_SECRET
  const redirectUri = process.env.SAMSARA_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'}/api/integrations/samsara/oauth`

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: 'Samsara integration not configured on this deployment',
      action: 'Set SAMSARA_CLIENT_ID + SAMSARA_CLIENT_SECRET in Vercel env',
    }, { status: 503 })
  }

  // Step 2 — callback exchange
  if (code) {
    const tokenRes = await fetch(SAMSARA_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })
    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return NextResponse.redirect(new URL(`/business?samsara_error=${encodeURIComponent('token_exchange_failed')}`, req.url))
        || NextResponse.json({ error: `Samsara token exchange failed: ${text}` }, { status: 500 })
    }
    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
      scope?: string
    }
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    await db.from('fleet_integrations').upsert({
      user_id: user.id,
      provider: 'samsara',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type ?? 'Bearer',
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    return NextResponse.redirect(new URL('/business?samsara=connected', req.url))
  }

  // Step 1 — redirect to consent
  const state = user.id
  const authUrl = new URL(SAMSARA_AUTH)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  return NextResponse.redirect(authUrl.toString())
}
