import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const revalidate = 3600

// Facebook Page cover photo. Rendered at 1640×624 (2× the 820×312
// FB recommended size) for retina sharpness. FB mobile crops to a
// narrower center band, so all important content stays inside a
// centered safe zone. Visit /fb-cover to save the PNG, then upload
// as FB page cover.

const ACCENT_GREEN = '#22c55e'
const ACCENT_AMBER = '#f59e0b'
const ACCENT_RED = '#ef4444'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1640,
          height: 624,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle radial-ish glow using a semi-transparent blob */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(ellipse at center, rgba(37,99,235,0.12) 0%, rgba(15,23,42,0) 60%)',
            display: 'flex',
          }}
        />

        {/* Logo + wordmark row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            marginBottom: 28,
          }}
        >
          {/* Logo icon — dark navy rounded square with white arch
              bridge. Mirrors public/logo-icon.svg at 140px. */}
          <div
            style={{
              width: 140,
              height: 140,
              background: '#0f172a',
              border: '2px solid rgba(255,255,255,0.08)',
              borderRadius: 30,
              position: 'relative',
              display: 'flex',
            }}
          >
            <div style={{ position: 'absolute', left: 20, top: 95, width: 100, height: 5, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 24, top: 100, width: 3, height: 9, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 113, top: 100, width: 3, height: 9, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 31, top: 78, width: 3, height: 17, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 42, top: 57, width: 3, height: 38, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 56, top: 42, width: 3, height: 53, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 70, top: 36, width: 4, height: 59, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 84, top: 42, width: 3, height: 53, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 98, top: 57, width: 3, height: 38, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
            <div style={{ position: 'absolute', left: 106, top: 78, width: 3, height: 17, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
          </div>

          <span
            style={{
              color: '#ffffff',
              fontSize: 150,
              fontWeight: 800,
              letterSpacing: -5,
              textTransform: 'lowercase',
              lineHeight: 1,
            }}
          >
            cruzar
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: '#e2e8f0',
            fontSize: 48,
            fontWeight: 500,
            marginBottom: 32,
            display: 'flex',
          }}
        >
          Tiempos de espera en vivo
        </div>

        {/* Wait level legend chips */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            marginBottom: 28,
          }}
        >
          {[
            { color: ACCENT_GREEN, label: 'Rápido' },
            { color: ACCENT_AMBER, label: 'Moderado' },
            { color: ACCENT_RED, label: 'Lento' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                padding: '12px 24px',
                borderRadius: 100,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: item.color,
                  display: 'flex',
                }}
              />
              <span style={{ color: '#e2e8f0', fontSize: 30, fontWeight: 600 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Cities row */}
        <div
          style={{
            color: '#64748b',
            fontSize: 28,
            fontWeight: 500,
            display: 'flex',
            gap: 16,
          }}
        >
          <span>McAllen</span>
          <span>·</span>
          <span>Brownsville</span>
          <span>·</span>
          <span>Laredo</span>
          <span>·</span>
          <span>El Paso</span>
        </div>

        {/* cruzar.app footer tag */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 48,
            color: '#475569',
            fontSize: 24,
            fontWeight: 600,
            display: 'flex',
          }}
        >
          cruzar.app
        </div>
      </div>
    ),
    { width: 1640, height: 624 }
  )
}
