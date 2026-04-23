import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Admin migration runner — executes SQL statements via the service role.
// Arbitrary-SQL endpoint; dual-factor auth: admin session cookie AND
// CRON_SECRET Bearer token. Either factor alone is NOT sufficient.
// Canonical migration path is `npm run apply-migration -- <path>`
// (Supabase Management API via SUPABASE_PAT); this route is a fallback.
//
// Usage:
//   POST /api/admin/migrate
//   Headers: Authorization: Bearer $CRON_SECRET
//   Cookie:  signed-in admin session
//   Body:    { "sql": "CREATE TABLE IF NOT EXISTS ..." }

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

const BOOTSTRAP_SQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;
`

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin session required' }, { status: 401 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Bearer token required' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const sql = body.sql as string | undefined

  if (!sql) {
    return NextResponse.json({ error: 'Missing sql field' }, { status: 400 })
  }

  const db = getServiceClient()

  // Try exec_sql first
  const { error: rpcError } = await db.rpc('exec_sql', { sql_text: sql })

  if (rpcError?.message?.includes('Could not find the function')) {
    // Bootstrap: create exec_sql, then retry
    console.log('[MIGRATE] Bootstrapping exec_sql function...')
    const { error: bootstrapErr } = await db.rpc('exec_sql', { sql_text: BOOTSTRAP_SQL })

    if (bootstrapErr) {
      // Can't even bootstrap — need manual intervention for the VERY FIRST time
      return NextResponse.json({
        error: 'Cannot bootstrap exec_sql. Run this ONE TIME in Supabase SQL Editor:',
        sql: BOOTSTRAP_SQL,
        originalError: bootstrapErr.message,
      }, { status: 500 })
    }

    // Retry original SQL
    const { error: retryErr } = await db.rpc('exec_sql', { sql_text: sql })
    if (retryErr) {
      return NextResponse.json({ error: retryErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, bootstrapped: true })
  }

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
