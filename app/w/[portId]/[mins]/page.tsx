import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPortMeta, PORT_META } from '@/lib/portMeta'
import { hasCamera } from '@/lib/bridgeCameras'
import { ShareSnapshotLive } from '@/components/ShareSnapshotLive'
import type { Metadata } from 'next'

interface RouteParams {
  params: Promise<{ portId: string; mins: string }>
}

function parseMins(raw: string): number | null {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 240) return null
  return n
}

function levelLabel(mins: number, es: boolean): { text: string; color: string } {
  if (mins <= 20) return { text: es ? 'Rápido' : 'Fast', color: '#22c55e' }
  if (mins <= 45) return { text: es ? 'Moderado' : 'Moderate', color: '#f59e0b' }
  return { text: es ? 'Lento' : 'Slow', color: '#ef4444' }
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { portId, mins } = await params
  const minsNum = parseMins(mins)
  const meta = PORT_META[portId]
  if (!meta || minsNum === null) {
    return { title: 'Compartir · Cruzar' }
  }
  const name = meta.localName || meta.city
  const title = `${name}: ${minsNum} min · Cruzar`
  const description = `Tiempo de espera compartido en ${name}. Mira el número en vivo ahorita mismo en cruzar.app — sin abrir Facebook.`
  const ogUrl = `https://cruzar.app/w/${portId}/${minsNum}/opengraph-image`
  const pageUrl = `https://cruzar.app/w/${portId}/${minsNum}`
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'Cruzar',
      type: 'website',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  }
}

export default async function ShareSnapshotPage({ params }: RouteParams) {
  const { portId, mins } = await params
  const minsNum = parseMins(mins)
  const meta = PORT_META[portId]
  if (!meta || minsNum === null) return notFound()

  const name = meta.localName || meta.city
  const level = levelLabel(minsNum, true)
  const hasCam = hasCamera(portId)

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-8 text-center">
          <Link href="/" className="inline-block text-2xl font-black text-white tracking-tight lowercase">
            cruzar
          </Link>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2">
            Compartido contigo
          </div>
          <h1 className="text-2xl font-black text-white leading-tight">{name}</h1>
          <p className="text-xs text-white/50 mt-1">{meta.region}</p>

          <div className="mt-6 inline-flex flex-col items-center">
            <div
              className="text-7xl font-black tabular-nums tracking-tight"
              style={{ color: level.color }}
            >
              {minsNum}
            </div>
            <div className="text-sm font-bold text-white/70 -mt-1">minutos</div>
            <div
              className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: `${level.color}22`,
                color: level.color,
                border: `1px solid ${level.color}4d`,
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: level.color }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: level.color }}
                />
              </span>
              {level.text}
            </div>
          </div>

          <div className="mt-6 text-xs text-white/50 leading-relaxed">
            Este número fue tomado al momento de compartir.
            <br />
            <span className="text-white/70 font-bold">El tiempo cambia cada 15 minutos.</span>
          </div>
        </div>

        <ShareSnapshotLive portId={portId} sharedMins={minsNum} />

        <Link
          href={`/port/${portId}`}
          className="mt-4 block w-full text-center py-4 rounded-2xl bg-green-500 hover:bg-green-400 text-black font-black text-base transition-colors"
        >
          Ver ahora en vivo →
        </Link>

        {hasCam && (
          <Link
            href={`/port/${portId}`}
            className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] text-white/80 hover:text-white text-sm font-bold transition-colors"
          >
            📹 Ver cámara en vivo del puente
          </Link>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs font-bold text-white/70 mb-1">¿Qué es cruzar.app?</div>
          <p className="text-xs text-white/50 leading-relaxed">
            Tiempos de espera en vivo para todos los puentes US-México. Con cámaras, historial y alertas. Gratis, en español.
          </p>
          <Link href="/" className="inline-block mt-2 text-xs font-bold text-green-400 hover:text-green-300">
            Abrir cruzar.app →
          </Link>
        </div>
      </div>
    </main>
  )
}
