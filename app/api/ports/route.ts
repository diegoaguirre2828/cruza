import { NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ports = await fetchRgvWaitTimes()
    // Use the CBP timestamp from the first port for accuracy
    const cbpUpdatedAt = ports[0]?.recordedAt ?? null
    return NextResponse.json({
      ports,
      fetchedAt: new Date().toISOString(),
      cbpUpdatedAt,
    })
  } catch (err) {
    console.error('CBP fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch wait times' }, { status: 502 })
  }
}
