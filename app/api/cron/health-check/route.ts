import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Health monitor — runs every 15 min. Checks:
// 1. CBP data freshness (are we still getting readings?)
// 2. Railway FB automation status
// 3. Any system issues
//
// Sends an email alert if something is wrong.
// Schedule: every 15 min alongside fetch-wait-times
// URL: https://www.cruzar.app/api/cron/health-check?secret=CRON_SECRET

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const issues: string[] = []
  const db = getServiceClient()

  // Check 1: CBP data freshness
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count: recentReadings } = await db
    .from('wait_time_readings')
    .select('id', { count: 'exact', head: true })
    .gte('recorded_at', thirtyMinAgo)

  if ((recentReadings || 0) === 0) {
    issues.push('CBP data stale: no wait_time_readings in last 30 min. Check cron-job.org fetch-wait-times.')
  }

  // Check 2: Railway FB automation
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch('https://cruzar-production.up.railway.app/', {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      issues.push(`Railway health check failed: HTTP ${res.status}`)
    } else {
      const data = await res.json()
      if (data.status === 'paused') {
        issues.push('Railway FB automation is paused (FB_GROUP_AUTOMATION_ENABLED=false)')
      }
    }
  } catch {
    issues.push('Railway is DOWN — cannot reach cruzar-production.up.railway.app')
  }

  // Check 3: Recent user signups (growth pulse)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentSignups } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo)

  // Send alert if any issues found
  if (issues.length > 0) {
    const resendKey = process.env.RESEND_API_KEY
    const to = process.env.ALERT_EMAIL || process.env.OWNER_EMAIL
    if (resendKey && to) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Cruzar <onboarding@resend.dev>',
            to,
            subject: `[Cruzar Health] ${issues.length} issue(s) detected`,
            text: `Health check at ${new Date().toISOString()}:\n\n${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n\n')}\n\nRecent signups (24h): ${recentSignups || 0}`,
          }),
        })
      } catch { /* best effort */ }
    }
  }

  return NextResponse.json({
    healthy: issues.length === 0,
    issues,
    stats: {
      recentReadings: recentReadings || 0,
      recentSignups: recentSignups || 0,
    },
    checkedAt: new Date().toISOString(),
  })
}
