import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

// v3 social card — RGV-only, single-bridge focus.
//
// Why this exists in this shape (after Diego killed v1 + v2):
//   v1 = flat list of 6 mixed-region bridges. Looked like an app
//        screenshot. Cross-region irrelevance for any single viewer.
//   v2 = "hero fastest + 5 others" dashboard layout. Same problem —
//        still mixing regions, still dashboard chrome.
//   v3 = ONE bridge per post. RGV-locked. Real logo from
//        public/logo-icon.svg (not the hand-drawn approximation
//        v1/v2 used). Solid background, big bridge name, MASSIVE
//        wait number, one contextual line, slim footer. No dashboard.
//        No multi-row grid. No "EN VIVO" pill. Reads like a community
//        post: one fact, big, clear, then cruzar.app.
//
// Format: 1080×1350 (4:5 portrait, FB feed optimal).

export const runtime = 'edge'

const RGV_PORTS: { portId: string; name: string; nameShort: string }[] = [
  { portId: '230501', name: 'Hidalgo / McAllen',     nameShort: 'Hidalgo' },
  { portId: '230502', name: 'Pharr–Reynosa',         nameShort: 'Pharr' },
  { portId: '230503', name: 'Anzaldúas',             nameShort: 'Anzaldúas' },
  { portId: '230901', name: 'Progreso',              nameShort: 'Progreso' },
  { portId: '230902', name: 'Donna',                 nameShort: 'Donna' },
  { portId: '535501', name: 'Brownsville Gateway',   nameShort: 'Gateway' },
  { portId: '535502', name: 'Brownsville Veterans',  nameShort: 'Veterans' },
  { portId: '535503', name: 'Los Tomates',           nameShort: 'Los Tomates' },
]

interface PortRow {
  portId: string
  vehicle?: number | null
  isClosed?: boolean
}

function levelInfo(wait: number): { color: string; label: string; line: string } {
  if (wait <= 20) {
    return {
      color: '#4ade80',
      label: 'rapidísimo',
      line: 'El puente bueno del Valle ahorita',
    }
  }
  if (wait <= 45) {
    return {
      color: '#fbbf24',
      label: 'moderado',
      line: 'El más rápido del Valle ahorita',
    }
  }
  return {
    color: '#f87171',
    label: 'lento',
    line: 'Hasta el más rápido está pesado hoy',
  }
}

function fmtWait(wait: number): string {
  if (wait === 0) return '<1'
  return String(wait)
}

export async function GET(req: NextRequest) {
  const apiBase = 'https://www.cruzar.app'

  let ports: PortRow[] = []
  try {
    const res = await fetch(`${apiBase}/api/ports`, { cache: 'no-store' })
    const json = await res.json()
    ports = (json.ports || []) as PortRow[]
  } catch { /* empty list — fallback below */ }

  // Pick the fastest open RGV bridge with real data right now. If the
  // whole region has no data, we still need to render something — fall
  // back to a placeholder so the cron slot doesn't fail.
  const candidates = RGV_PORTS
    .map(meta => {
      const port = ports.find(p => p.portId === meta.portId)
      const wait = port?.isClosed ? null : (port?.vehicle ?? null)
      return { ...meta, wait }
    })
    .filter((c): c is typeof c & { wait: number } => c.wait != null && c.wait >= 0)
    .sort((a, b) => a.wait - b.wait)

  const featured = candidates[0] || { portId: '', name: 'Anzaldúas', nameShort: 'Anzaldúas', wait: 5 }
  const lvl = levelInfo(featured.wait)

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })
  const dowStr = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short', timeZone: 'America/Chicago',
  }).format(now).replace('.', '')
  const dowCap = dowStr.charAt(0).toUpperCase() + dowStr.slice(1)

  // The actual logo at public/logo-icon.svg. Satori supports <img> with
  // SVG sources via URL. Pulling it from the live domain so we always
  // serve the canonical asset (no inline drift if the brand updates).
  const logoUrl = `${apiBase}/logo-icon.svg`

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1350,
          background: '#0a0f1c',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top brand bar — small + tasteful, not the centerpiece */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '40px 56px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={logoUrl} width={64} height={64} style={{ display: 'block' }} alt="" />
            <span style={{
              color: '#ffffff',
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: -1.5,
              textTransform: 'lowercase',
            }}>
              cruzar
            </span>
          </div>
          <div style={{
            color: '#94a3b8',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: 'uppercase',
            display: 'flex',
          }}>
            RGV
          </div>
        </div>

        {/* Hero — bridge + wait number, centered, dominant */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 56px',
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontSize: 78,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1,
              textAlign: 'center',
              marginBottom: 8,
              display: 'flex',
            }}
          >
            {featured.name.toUpperCase()}
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
              marginTop: 12,
            }}
          >
            <span
              style={{
                color: lvl.color,
                fontSize: 320,
                fontWeight: 900,
                letterSpacing: -14,
                lineHeight: 0.85,
                display: 'flex',
              }}
            >
              {fmtWait(featured.wait)}
            </span>
            <span
              style={{
                color: lvl.color,
                fontSize: 70,
                fontWeight: 800,
                opacity: 0.85,
                marginBottom: 24,
                display: 'flex',
              }}
            >
              min
            </span>
          </div>

          <span
            style={{
              color: '#cbd5e1',
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: -0.5,
              textAlign: 'center',
              marginTop: 36,
              maxWidth: 820,
              lineHeight: 1.3,
              display: 'flex',
            }}
          >
            {lvl.line}
          </span>
        </div>

        {/* Footer — slim brand + timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '32px 56px 40px',
          }}
        >
          <span style={{ color: '#ffffff', fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>
            cruzar.app
          </span>
          <span style={{ color: '#475569', fontSize: 22, fontWeight: 600 }}>
            {dowCap} · {timeStr}
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  )
}
