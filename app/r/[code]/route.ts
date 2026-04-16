import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /r/[code] — redirect to /signup?ref=[code] and track the click.
// This is the short referral link: cruzar.app/r/abc12345
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!code || code.length < 4) {
    return NextResponse.redirect(new URL('/signup', _req.url))
  }

  // Track the referral click asynchronously — don't block the redirect
  try {
    const db = getServiceClient()
    await db.from('referral_clicks').insert({
      referral_code: code,
      user_agent: _req.headers.get('user-agent') || null,
      ip: _req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    })
  } catch {
    // Non-critical — don't block the redirect
  }

  const redirectUrl = new URL('/signup', _req.url)
  redirectUrl.searchParams.set('ref', code)
  return NextResponse.redirect(redirectUrl, 302)
}
