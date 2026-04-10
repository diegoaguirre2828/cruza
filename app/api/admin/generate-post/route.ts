import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const region = req.nextUrl.searchParams.get('region') || 'all'
  const email = req.nextUrl.searchParams.get('email') || 'false'

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.cruzar.app'
  const res = await fetch(`${appUrl}/api/generate-post?secret=${secret}&email=${email}&region=${region}`, {
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
