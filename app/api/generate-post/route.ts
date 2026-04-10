import { NextRequest, NextResponse } from 'next/server'

function getLevel(wait: number | null): 'low' | 'medium' | 'high' {
  if (wait === null || wait === 0) return 'low'
  if (wait <= 20) return 'low'
  if (wait <= 45) return 'medium'
  return 'high'
}

function getLevelEmoji(level: string) {
  if (level === 'low') return '🟢'
  if (level === 'medium') return '🟡'
  return '🔴'
}

const ALL_PORTS = [
  { portId: '230501', name: 'Hidalgo / McAllen',       region: 'rgv' },
  { portId: '230502', name: 'Pharr–Reynosa',            region: 'rgv' },
  { portId: '230503', name: 'Anzaldúas',                region: 'rgv' },
  { portId: '230901', name: 'Progreso',                 region: 'rgv' },
  { portId: '230902', name: 'Donna',                    region: 'rgv' },
  { portId: '535501', name: 'Brownsville Gateway',      region: 'brownsville' },
  { portId: '535502', name: 'Brownsville Veterans',     region: 'brownsville' },
  { portId: '535503', name: 'Los Tomates',              region: 'brownsville' },
  { portId: '230401', name: 'Laredo I',                 region: 'laredo' },
  { portId: '230402', name: 'Laredo II',                region: 'laredo' },
  { portId: '230301', name: 'Eagle Pass',               region: 'eagle_pass' },
  { portId: '240201', name: 'El Paso / Juárez',         region: 'el_paso' },
]

// Each region's IANA timezone — used for correct local time in captions
const REGION_TIMEZONES: Record<string, string> = {
  rgv:         'America/Chicago',
  brownsville: 'America/Chicago',
  laredo:      'America/Chicago',
  eagle_pass:  'America/Chicago',
  el_paso:     'America/Denver',   // Mountain Time — 1 hr behind Texas
  san_luis:    'America/Phoenix',  // San Luis RC / Sonora — no DST, MST year-round (UTC-7 always)
  other:       'America/Chicago',
  all:         'America/Chicago',
}

const REGION_LABELS: Record<string, string> = {
  rgv:         'RGV / McAllen',
  brownsville: 'Matamoros / Brownsville',
  laredo:      'Laredo / Nuevo Laredo',
  eagle_pass:  'Eagle Pass / Piedras Negras',
  el_paso:     'El Paso / Juárez',
  san_luis:    'San Luis RC / Arizona',
}

const REGION_HASHTAGS: Record<string, string> = {
  rgv:         '#RGV #McAllen #Hidalgo #Pharr #Progreso #Donna #Anzalduas #Reynosa',
  brownsville: '#Brownsville #Matamoros #ValleDeTexas',
  laredo:      '#Laredo #NuevoLaredo #Tamaulipas',
  eagle_pass:  '#EaglePass #PiedrasNegras #Coahuila',
  el_paso:     '#ElPaso #Juarez #Chihuahua #JRZELP',
  san_luis:    '#SanLuisRC #Sonora #Arizona #YumaCrossing',
  all:         '#RGV #Brownsville #Laredo #McAllen #Hidalgo #puente #tiemposdeespera',
}

// Peak hour labels — matched against the region's local hour
const PEAK_LABELS: { hour: number; label: string }[] = [
  { hour: 5,  label: 'Morning commute' },
  { hour: 11, label: 'Midday' },
  { hour: 15, label: 'Afternoon rush' },
  { hour: 19, label: 'Evening crossing' },
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const sendEmail = req.nextUrl.searchParams.get('email') !== 'false'
  const regionFilter = req.nextUrl.searchParams.get('region') || 'all'

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch live wait times
  const portsRes = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
  const { ports } = await portsRes.json()

  const featured = regionFilter === 'all'
    ? ALL_PORTS
    : ALL_PORTS.filter(p => p.region === regionFilter)

  const crossings = featured.map(({ portId, name }) => {
    const port = ports?.find((p: { portId: string }) => p.portId === portId)
    const wait = port?.vehicle ?? null
    return { name, wait, level: getLevel(wait) }
  }).filter(c => c.wait !== null && c.wait > 0)

  // Use correct timezone for this region
  const tz = REGION_TIMEZONES[regionFilter] || 'America/Chicago'
  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz })

  // Local hour in region's timezone — for peak label matching
  const localHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz }), 10)
  const peak = PEAK_LABELS.find(p => p.hour === localHour) || { label: 'Scheduled post' }

  const fastest = crossings.filter(c => c.level === 'low')
  const bestName = fastest.length > 0 ? fastest[0].name : null

  const lines = crossings.map(c => `${getLevelEmoji(c.level)} ${c.name}: ${c.wait} min`)

  const regionLabel = regionFilter !== 'all' ? (REGION_LABELS[regionFilter] || '') : ''
  const regionLine = regionLabel ? `📍 ${regionLabel}\n` : ''
  const hashtags = REGION_HASHTAGS[regionFilter] || REGION_HASHTAGS.all

  const caption = `🌉 TIEMPOS DE ESPERA — ${timeStr.toUpperCase()}
${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
${regionLine}
${lines.join('\n')}

${bestName ? `✅ Más rápido ahorita: ${bestName}` : ''}

📱 Tiempos en vivo → cruzar.app
Reporta tu tiempo y ayuda a todos en la fila 🙌

#border #frontera #cruzar #espera ${hashtags}`

  // Send email to owner
  if (sendEmail && process.env.RESEND_API_KEY && process.env.OWNER_EMAIL) {
    const regionTitle = regionLabel || 'All Regions'

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Cruzar <onboarding@resend.dev>',
        to: [process.env.OWNER_EMAIL],
        subject: `📱 ${peak.label} — ${regionTitle} — ${timeStr}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 4px;color:#111827;">📱 Facebook Post Ready</h2>
            <p style="color:#6b7280;font-size:14px;margin:0 0 4px;">${peak.label} · ${timeStr}</p>
            <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">📍 ${regionTitle}</p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px;">
              <p style="font-size:13px;color:#374151;white-space:pre-wrap;margin:0;">${caption}</p>
            </div>

            <a href="https://cruzar.app/admin" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
              Open Admin Panel →
            </a>
          </div>
        `,
      }),
    })
  }

  return NextResponse.json({ success: true, caption, crossings, region: regionFilter })
}
