import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Admin migration runner — executes SQL statements via the service role.
// Uses Supabase's .rpc() with a custom exec_sql function, or falls back
// to running individual CREATE/ALTER statements through the REST API.
//
// Bootstraps itself: first call creates the exec_sql function, then
// all future calls use it for arbitrary SQL execution.
//
// Auth: CRON_SECRET (same as other admin endpoints)
//
// Usage:
//   POST /api/admin/migrate?secret=CRON_SECRET
//   Body: { "sql": "CREATE TABLE IF NOT EXISTS ..." }
//   Or:   { "file": "v31-daily-reports" }  (runs from supabase/migrations/)

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
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const sql = body.sql as string | undefined

  if (!sql) {
    return NextResponse.json({ error: 'Missing sql field' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Try exec_sql first
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql_text: sql })

  if (rpcError?.message?.includes('Could not find the function')) {
    // Bootstrap: create exec_sql, then retry
    console.log('[MIGRATE] Bootstrapping exec_sql function...')
    const { error: bootstrapErr } = await supabase.rpc('exec_sql', { sql_text: BOOTSTRAP_SQL })

    if (bootstrapErr) {
      // Can't even bootstrap — need manual intervention for the VERY FIRST time
      return NextResponse.json({
        error: 'Cannot bootstrap exec_sql. Run this ONE TIME in Supabase SQL Editor:',
        sql: BOOTSTRAP_SQL,
        originalError: bootstrapErr.message,
      }, { status: 500 })
    }

    // Retry original SQL
    const { error: retryErr } = await supabase.rpc('exec_sql', { sql_text: sql })
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
