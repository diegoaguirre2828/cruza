import { NextRequest, NextResponse } from 'next/server'

// Multi-region social post generator. Fires 4x/day via cron-job.org.
// Generates region-specific posts for ALL regions, not just RGV.
// Each region's post goes to its Facebook groups + the Cruzar page.
//
// Schedule on cron-job.org:
//   5:30am CT, 11:30am CT, 3:30pm CT, 7pm CT
//   URL: https://www.cruzar.app/api/cron/social-post-all?secret=CRON_SECRET
//
// Returns all captions so Make.com or the FB poster can pick them up.

const REGIONS = ['rgv', 'brownsville', 'laredo', 'eagle_pass', 'el_paso', 'nogales', 'tijuana', 'mexicali']

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Array<{ region: string; caption: string; crossings: number }> = []

  for (const region of REGIONS) {
    try {
      const res = await fetch(
        `https://www.cruzar.app/api/generate-post?secret=${encodeURIComponent(secret || '')}&region=${region}`,
        { cache: 'no-store' },
      )
      const data = await res.json()
      if (data.success && data.pageCaption) {
        results.push({
          region,
          caption: data.pageCaption,
          crossings: data.crossings || 0,
        })
      }
    } catch {
      // Skip failed regions
    }
  }

  // Build a combined "all borders" mega-post for the FB page
  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })

  const megaCaption = `🌉 TODA LA FRONTERA — ${timeStr.toUpperCase()}

${results
  .filter(r => r.crossings > 0)
  .map(r => r.caption.split('\n').filter(l => l.startsWith('🟢') || l.startsWith('🟡') || l.startsWith('🔴') || l.startsWith('✅')).join('\n'))
  .join('\n\n')}

📱 Tiempos en vivo de TODOS los puentes → cruzar.app
Gratis · En vivo · Sin andar preguntando en grupos

#cruzar #frontera #tiemposdeespera #puente`

  return NextResponse.json({
    regions: results.length,
    posts: results,
    megaCaption,
    generatedAt: now.toISOString(),
  })
}
