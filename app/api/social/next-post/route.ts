import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Peak-hour aware caption generator for the Cruzar FB page.
//
// Called by Make.com on a cron schedule. The `peak` query param tunes
// the tone and opener for the commute window so each post feels
// time-relevant instead of a generic data dump. Defaults to the
// nearest peak window based on CST if `peak` isn't passed.
//
// Pipeline:
//   Make.com cron (4x/day at 6am/11am/3pm/7pm CST) →
//   GET /api/social/next-post?secret=X&peak=morning →
//   Returns { caption, regions, peak } →
//   Make.com pipes caption into FB Page "Create a Post" module
//
// Every caption ends with a page-follow CTA — the whole point of
// frequent posts is to train FB's push-notification algorithm so
// followers get pinged when the page posts. That only works if
// people follow the page, so every post asks for it.

function getLevel(wait: number | null): 'low' | 'medium' | 'high' {
  if (!wait || wait === 0) return 'low'
  if (wait <= 20) return 'low'
  if (wait <= 45) return 'medium'
  return 'high'
}

function emoji(level: string) {
  if (level === 'low') return '🟢'
  if (level === 'medium') return '🟡'
  return '🔴'
}

type PeakWindow = 'morning' | 'midday' | 'afternoon' | 'evening'

// Teaser captions: the opener is a short time-stamped headline, the
// featurePitch rotates a different app feature per peak so readers
// see the value prop across the day, and followHook is the primary
// CTA pushing followers to the FB page. Short body is the goal —
// readers should see two fastest crossings, get hooked on "the rest
// of the 52", and follow to get the full picture.
const PEAK_COPY: Record<PeakWindow, {
  opener: string
  featurePitch: string
  followHook: string
  hashtag: string
}> = {
  morning: {
    opener: '🌅 BUENOS DÍAS',
    featurePitch: '🔔 La app también te avisa cuando baja la espera de TU puente',
    followHook: "👉 Dale seguir 👆 pa' la notificación cada mañana",
    hashtag: '#cruzar #madrugada #commute',
  },
  midday: {
    opener: '☀️ MEDIODÍA',
    featurePitch: "📊 La app tiene historial por hora pa\' saber cuándo cruzar",
    followHook: '👉 Dale seguir 👆 pa\' los updates 4 veces al día',
    hashtag: '#cruzar #mediodia',
  },
  afternoon: {
    opener: '🌤️ TARDE',
    featurePitch: '📹 La app tiene cámaras en vivo + reportes de la gente en la fila',
    followHook: "👉 Dale seguir 👆 pa' la notificación directo a tu feed",
    hashtag: '#cruzar #tarde #commute',
  },
  evening: {
    opener: '🌙 NOCHE',
    featurePitch: '⚠️ La app te alerta cuando hay accidentes o inspecciones fuertes',
    followHook: "👉 Dale seguir 👆 pa' no perderte ningún update",
    hashtag: '#cruzar #noche',
  },
}

// REGION_TAG / portRegion helpers removed — the per-region section
// structure means we don't need inline region tags on port lines
// anymore, and portRegion was only used by the old flattening logic.

// Pick the nearest peak window based on current time in CST — used
// as a fallback when Make.com doesn't pass ?peak explicitly.
function defaultPeak(): PeakWindow {
  const cstHour = parseInt(
    new Date().toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/Chicago' }),
    10,
  )
  if (cstHour < 10) return 'morning'
  if (cstHour < 13) return 'midday'
  if (cstHour < 17) return 'afternoon'
  return 'evening'
}

const REGIONS = [
  {
    key: 'rgv', label: '🌵 RGV / McAllen', tz: 'America/Chicago',
    hashtags: '#RGV #McAllen #Hidalgo #Pharr #Progreso #Donna #Anzalduas #Reynosa',
    ports: ['230501','230502','230503','230901','230902'],
  },
  {
    key: 'brownsville', label: '🏙️ Matamoros / Brownsville', tz: 'America/Chicago',
    hashtags: '#Brownsville #Matamoros #ValleDeTexas',
    ports: ['535501','535502','535503'],
  },
  {
    key: 'laredo', label: '🛣️ Laredo / Nuevo Laredo', tz: 'America/Chicago',
    hashtags: '#Laredo #NuevoLaredo #Tamaulipas',
    ports: ['230401','230402'],
  },
  {
    key: 'eagle_pass', label: '🦅 Eagle Pass / Piedras Negras', tz: 'America/Chicago',
    hashtags: '#EaglePass #PiedrasNegras #Coahuila',
    ports: ['230301'],
  },
  {
    key: 'el_paso', label: '⛰️ El Paso / Juárez', tz: 'America/Denver',
    hashtags: '#ElPaso #Juarez #Chihuahua #JRZELP',
    ports: ['240201'],
  },
]

const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo / McAllen',
  '230502': 'Pharr–Reynosa',
  '230503': 'Anzaldúas',
  '230901': 'Progreso',
  '230902': 'Donna',
  '535501': 'Brownsville Gateway',
  '535502': 'Brownsville Veterans',
  '535503': 'Los Tomates',
  '230401': 'Laredo I',
  '230402': 'Laredo II',
  '230301': 'Eagle Pass',
  '240201': 'El Paso / Juárez',
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pick the peak window either from the query param or auto-detect
  // from current CST hour. Make.com scenarios should pass ?peak=X
  // explicitly so each scheduled post has a stable identity.
  const peakParam = req.nextUrl.searchParams.get('peak') as PeakWindow | null
  const peak: PeakWindow = peakParam && peakParam in PEAK_COPY ? peakParam : defaultPeak()
  const peakMeta = PEAK_COPY[peak]

  const portsRes = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
  const { ports } = await portsRes.json()

  const now = new Date()
  const timeStrCST = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })

  // Build a per-region section. Someone in Brownsville doesn't care
  // that Tijuana is fast — they want to see THEIR region's bridges.
  // So instead of the old "top 2 fastest border-wide" teaser, we show
  // the top N per region, skip regions with nothing to report, and
  // cap the post length so FB doesn't truncate. Regions are processed
  // in geographic order (RGV → Brownsville → Laredo → Eagle Pass → El Paso).
  interface RegionSection {
    key: string
    label: string
    lines: string[]
  }
  const TOP_PER_REGION = 3
  const sections: RegionSection[] = []
  let totalCrossings = 0
  for (const region of REGIONS) {
    const regionCrossings: Array<{ name: string; wait: number; level: string }> = []
    for (const portId of region.ports) {
      const port = ports?.find((p: { portId: string; isClosed?: boolean; vehicle?: number | null }) => p.portId === portId)
      if (!port || port.isClosed) continue
      const wait = port.vehicle
      if (wait == null || wait < 0) continue
      regionCrossings.push({
        name: PORT_NAMES[portId] || portId,
        wait,
        level: getLevel(wait),
      })
    }
    regionCrossings.sort((a, b) => a.wait - b.wait)
    if (regionCrossings.length === 0) continue
    const top = regionCrossings.slice(0, TOP_PER_REGION)
    const lines = top.map((c) => {
      const waitStr = c.wait === 0 ? '<1' : String(c.wait)
      return `  ${emoji(c.level)} ${c.name} · ${waitStr} min`
    })
    sections.push({ key: region.key, label: region.label, lines })
    totalCrossings += top.length
  }

  // Fallback caption when no port data is available in ANY region.
  // NEVER return null for `caption` — Make.com pipes this field into
  // Facebook's "Create a Post" Message field, and FB rejects empty
  // posts, which auto-deactivates the scenario after 3 failed runs.
  if (sections.length === 0) {
    const fallbackCaption = `${peakMeta.opener} · ${timeStrCST.toUpperCase()}

CBP no está reportando datos en vivo ahorita — sucede a veces cuando CBP reinicia su sistema. Los datos vuelven solos en pocos minutos.

📱 Mientras tanto, los reportes de la comunidad siguen en vivo — cruzar.app

${peakMeta.followHook}

${peakMeta.hashtag}`
    return NextResponse.json({ caption: fallbackCaption, peak, regions: 0, fallback: true })
  }

  const sectionBlocks = sections
    .map((s) => `${s.label}\n${s.lines.join('\n')}`)
    .join('\n\n')

  // Per-region breakdown caption. Longer than the old teaser but
  // actually useful to cross-regional readers. Ends with the same
  // follow hook + pitch + hashtag tail so page-growth mechanics
  // don't change.
  const caption = `${peakMeta.opener} · ${timeStrCST.toUpperCase()}

⚡ Tiempos por región ahorita:

${sectionBlocks}

${peakMeta.featurePitch} — cruzar.app

${peakMeta.followHook}

${peakMeta.hashtag}`

  return NextResponse.json({ caption, regions: sections.length, totalCrossings, peak })
}
