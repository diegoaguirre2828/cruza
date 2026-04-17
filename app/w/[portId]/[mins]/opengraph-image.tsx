import { ImageResponse } from 'next/og'
import { PORT_META } from '@/lib/portMeta'

export const runtime = 'edge'
export const alt = 'Cruzar — tiempo de espera compartido'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ portId: string; mins: string }>
}

function parseMins(raw: string): number | null {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 240) return null
  return n
}

function levelColor(mins: number): { bg: string; border: string; text: string; label: string } {
  if (mins <= 20) return { bg: '#14532d', border: '#22c55e', text: '#4ade80', label: 'RÁPIDO' }
  if (mins <= 45) return { bg: '#78350f', border: '#f59e0b', text: '#fbbf24', label: 'MODERADO' }
  return { bg: '#7f1d1d', border: '#ef4444', text: '#f87171', label: 'LENTO' }
}

export default async function ShareOG({ params }: Props) {
  const { portId, mins } = await params
  const minsNum = parseMins(mins)
  const meta = PORT_META[portId]

  if (!meta || minsNum === null) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          cruzar.app
        </div>
      ),
      { ...size }
    )
  }

  const name = meta.localName || meta.city
  const level = levelColor(minsNum)

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header — logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span
              style={{
                color: '#ffffff',
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: -2,
                textTransform: 'lowercase',
              }}
            >
              cruzar
            </span>
            <span
              style={{
                color: '#64748b',
                fontSize: 20,
                fontWeight: 700,
                marginLeft: 4,
                display: 'flex',
              }}
            >
              · tiempo de espera compartido
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.45)',
              padding: '8px 16px',
              borderRadius: 100,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 10,
                background: '#ef4444',
                display: 'flex',
              }}
            />
            <span style={{ color: '#fca5a5', fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>EN VIVO</span>
          </div>
        </div>

        {/* Port name — huge */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 38 }}>
          <div
            style={{
              color: '#94a3b8',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            {meta.region}
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 1.05,
              marginTop: 6,
              display: 'flex',
            }}
          >
            {name}
          </div>
        </div>

        {/* Main wait number — the whole point of the image */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 16,
            marginTop: 28,
            flex: 1,
          }}
        >
          <div
            style={{
              color: level.text,
              fontSize: 260,
              fontWeight: 900,
              letterSpacing: -12,
              lineHeight: 0.9,
              display: 'flex',
            }}
          >
            {minsNum}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 40,
              gap: 6,
            }}
          >
            <span style={{ color: '#ffffff', fontSize: 48, fontWeight: 800, letterSpacing: -1 }}>min</span>
            <div
              style={{
                background: level.bg,
                border: `2px solid ${level.border}`,
                color: level.text,
                fontSize: 22,
                fontWeight: 900,
                padding: '10px 22px',
                borderRadius: 100,
                letterSpacing: 2,
                display: 'flex',
              }}
            >
              {level.label}
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 18,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <span style={{ color: '#e2e8f0', fontSize: 26, fontWeight: 700, display: 'flex' }}>
            Ver el tiempo en vivo ahorita →
          </span>
          <span style={{ color: '#4ade80', fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>
            cruzar.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
