import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BRIDGE_CAMERAS } from '@/lib/bridgeCameras'
import { pickPrimaryFeed, analyzeSnapshot } from '@/lib/cameraVision'

// Runs every N min (scheduled externally via cron-job.org since Vercel
// free caps at daily). Iterates every port that has a snapshot-able
// camera feed, asks Claude Haiku to estimate the queue from one frame,
// writes the result to camera_wait_readings. /api/ports reads the
// latest row per port and fuses it with CBP + HERE + community.
//
// Auth: Authorization: Bearer CRON_SECRET OR ?secret=CRON_SECRET.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return new Response('CRON_SECRET not set', { status: 500 })

  const url = new URL(req.url)
  const qSecret = url.searchParams.get('secret')
  const auth = req.headers.get('authorization') || ''
  const bearerOk = auth === `Bearer ${secret}`
  if (qSecret !== secret && !bearerOk) return unauthorized()

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) {
    return new Response(JSON.stringify({ error: 'supabase env missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(supaUrl, supaKey, {
    auth: { persistSession: false },
  })

  const portIds = Object.keys(BRIDGE_CAMERAS)
  const results: Array<Record<string, unknown>> = []

  // Run sequentially to keep memory low + avoid rate-limiting the
  // vision API. 12 ports × ~3s per call = ~36s worst case, well under
  // the 300s maxDuration.
  for (const portId of portIds) {
    const picked = pickPrimaryFeed(portId)
    if (!picked) {
      results.push({ port_id: portId, skipped: 'no_snapshot_feed' })
      continue
    }

    const vision = await analyzeSnapshot(portId, picked.snapshotUrl)
    const { error: insertErr } = await supabase.from('camera_wait_readings').insert({
      port_id: portId,
      cars_estimated: vision.cars_estimated,
      minutes_estimated: vision.minutes_estimated,
      confidence: vision.confidence,
      pedestrians_estimated: vision.pedestrians_estimated,
      pedestrian_minutes_estimated: vision.pedestrian_minutes_estimated,
      pedestrian_confidence: vision.pedestrian_confidence,
      pedestrian_lanes_visible: vision.pedestrian_lanes_visible,
      camera_url: picked.snapshotUrl,
      model: 'claude-haiku-4-5-20251001',
      raw_response: vision.raw ?? null,
      error_code: vision.error_code ?? null,
    })

    results.push({
      port_id: portId,
      minutes_estimated: vision.minutes_estimated,
      confidence: vision.confidence,
      pedestrian_minutes_estimated: vision.pedestrian_minutes_estimated,
      pedestrian_confidence: vision.pedestrian_confidence,
      error_code: vision.error_code ?? null,
      insert_error: insertErr?.message ?? null,
    })
  }

  const ok = results.filter(r => !r.skipped && !r.error_code).length
  return new Response(JSON.stringify({
    scanned: portIds.length,
    analyzed: ok,
    skipped: results.filter(r => r.skipped).length,
    errored: results.filter(r => r.error_code).length,
    results,
    at: new Date().toISOString(),
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
