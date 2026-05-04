import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Persist user notification language preference. The send-alerts cron
// + any future server-composed notification reads `profiles.language`
// (column added in migration v84) to compose single-language copy.
// LangContext on the client fires PUT here whenever the user toggles
// language while authenticated. Body: { language: 'en' | 'es' }.

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const language = (body as { language?: unknown }).language
  if (language !== 'en' && language !== 'es') {
    return NextResponse.json({ error: 'language must be "en" or "es"' }, { status: 400 })
  }

  const db = getServiceClient()
  const { error } = await db
    .from('profiles')
    .update({ language })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, language })
}
