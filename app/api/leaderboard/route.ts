import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getServiceClient()

  const { data, error } = await db
    .from('community_leaderboard')
    .select('*')
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leaders: data || [] })
}
