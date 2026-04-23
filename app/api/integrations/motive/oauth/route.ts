import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getServiceClient } from '@/lib/supabase'

const STATE_COOKIE = 'cruzar_motive_oauth_state'

// Motive (formerly KeepTruckin) OAuth 2.0 Connect flow.
//
// Same shape as /api/integrations/samsara/oauth — scaffold-only until
// first Motive-using fleet signs up.
//
// ENV (Vercel): MOTIVE_CLIENT_ID, MOTIVE_CLIENT_SECRET, MOTIVE_REDIRECT_URI

export const dynamic = 'force-dynamic'

const MOTIVE_AUTH = 'https://api.gomotive.com/oauth/authorize'
const MOTIVE_TOKEN = 'https://api.gomotive.com/oauth/token'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const errorParam = req.nextUrl.searchParams.get('error')
  if (errorParam) {
    return NextResponse.redirect(new URL(`/business?motive_error=${encodeURIComponent(errorParam)}`, req.url))
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
    return NextResponse.redirect(new URL('/pricing?upgrade=motive', req.url))
  }

  const clientId = process.env.MOTIVE_CLIENT_ID
  const clientSecret = process.env.MOTIVE_CLIENT_SECRET
  const redirectUri = process.env.MOTIVE_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'}/api/integrations/motive/oauth`

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: 'Motive integration not configured on this deployment',
      action: 'Set MOTIVE_CLIENT_ID + MOTIVE_CLIENT_SECRET in Vercel env',
    }, { status: 503 })
  }

  if (code) {
    const incomingState = req.nextUrl.searchParams.get('state') || ''
    const [stateUserId, stateNonce] = incomingState.split(':')
    const cookieNonce = req.cookies.get(STATE_COOKIE)?.value
    if (!cookieNonce || !stateNonce || stateNonce !== cookieNonce || stateUserId !== user.id) {
      const res = NextResponse.redirect(new URL('/business?motive_error=state_mismatch', req.url))
      res.cookies.delete(STATE_COOKIE)
      return res
    }

    const tokenRes = await fetch(MOTIVE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    })
    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL('/business?motive_error=token_exchange_failed', req.url))
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
      provider: 'motive',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type ?? 'Bearer',
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    const res = NextResponse.redirect(new URL('/business?motive=connected', req.url))
    res.cookies.delete(STATE_COOKIE)
    return res
  }

  const nonce = randomBytes(16).toString('hex')
  const state = `${user.id}:${nonce}`
  const authUrl = new URL(MOTIVE_AUTH)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  const res = NextResponse.redirect(authUrl.toString())
  res.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
