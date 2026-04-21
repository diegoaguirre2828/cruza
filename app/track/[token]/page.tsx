import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'
import type { Metadata } from 'next'
import { TrackLive } from './TrackLive'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RouteParams {
  params: Promise<{ token: string }>
}

type ShipmentRow = {
  id: string
  reference_id: string
  description: string | null
  origin: string | null
  destination: string | null
  port_id: string | null
  carrier: string | null
  driver_name: string | null
  expected_crossing_at: string | null
  actual_crossing_at: string | null
  status: string
  delay_minutes: number | null
  updated_at: string
}

async function lookup(token: string): Promise<ShipmentRow | null> {
  const db = getServiceClient()
  const { data: tok } = await db
    .from('shipment_tokens')
    .select('shipment_id, expires_at, viewed_count')
    .eq('token', token)
    .maybeSingle()
  if (!tok) return null
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) return null

  const { data: shipment } = await db
    .from('shipments')
    .select('id, reference_id, description, origin, destination, port_id, carrier, driver_name, expected_crossing_at, actual_crossing_at, status, delay_minutes, updated_at')
    .eq('id', tok.shipment_id)
    .maybeSingle()

  if (shipment) {
    // Fire-and-forget view counter — no await
    db.from('shipment_tokens')
      .update({
        viewed_count: (tok.viewed_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('token', token)
      .then(() => {}, () => {})
  }
  return (shipment as ShipmentRow) ?? null
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { token } = await params
  const shipment = await lookup(token)
  if (!shipment) return { title: 'Tracking · Cruzar' }

  const meta = shipment.port_id ? getPortMeta(shipment.port_id) : null
  const portName = meta?.localName || meta?.city || ''
  const title = `${shipment.reference_id} · ${portName || 'Cruzar tracking'}`
  const description = `Sigue tu carga en vivo · Live shipment tracking — ${shipment.reference_id}`
  const ogUrl = `https://cruzar.app/track/${token}/opengraph-image`
  const pageUrl = `https://cruzar.app/track/${token}`
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'Cruzar',
      type: 'website',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  }
}

function statusColor(s: string): string {
  switch (s) {
    case 'delivered': return '#22c55e'
    case 'cleared': return '#22c55e'
    case 'crossing':
    case 'in_line':
    case 'at_bridge': return '#f59e0b'
    case 'delayed': return '#ef4444'
    case 'canceled': return '#6b7280'
    default: return '#2563eb'
  }
}

function statusLabel(s: string, es: boolean): string {
  const labels: Record<string, [string, string]> = {
    scheduled:         ['Programado', 'Scheduled'],
    driver_dispatched: ['Chofer en camino', 'Driver dispatched'],
    en_route:          ['En ruta', 'En route'],
    at_bridge:         ['En el puente', 'At the bridge'],
    in_line:           ['En la fila', 'In line'],
    crossing:          ['Cruzando', 'Crossing'],
    cleared:           ['Cruzado', 'Cleared'],
    delivered:         ['Entregado', 'Delivered'],
    delayed:           ['Con demora', 'Delayed'],
    canceled:          ['Cancelado', 'Canceled'],
  }
  const pair = labels[s] || [s, s]
  return es ? pair[0] : pair[1]
}

export default async function TrackPage({ params }: RouteParams) {
  const { token } = await params
  const shipment = await lookup(token)
  if (!shipment) return notFound()

  const portMeta = shipment.port_id ? getPortMeta(shipment.port_id) : null
  const portName = portMeta?.localName || portMeta?.city || null

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-8 text-center">
          <Link href="/" className="inline-block text-2xl font-black text-white tracking-tight lowercase">
            cruzar
          </Link>
          <p className="text-[11px] text-white/40 mt-1">
            Tracking privado · Private tracking
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2">
            Envío · Shipment
          </div>
          <h1 className="text-2xl font-black text-white leading-tight">{shipment.reference_id}</h1>
          {shipment.description && (
            <p className="text-sm text-white/70 mt-1">{shipment.description}</p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold"
              style={{
                background: `${statusColor(shipment.status)}22`,
                color: statusColor(shipment.status),
                border: `1px solid ${statusColor(shipment.status)}4d`,
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: statusColor(shipment.status) }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: statusColor(shipment.status) }}
                />
              </span>
              <span>{statusLabel(shipment.status, true)}</span>
              <span className="text-white/30">·</span>
              <span>{statusLabel(shipment.status, false)}</span>
            </span>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            {shipment.carrier && (
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Transportista · Carrier</dt>
                <dd className="text-white/90 font-medium text-right">{shipment.carrier}</dd>
              </div>
            )}
            {shipment.driver_name && (
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Chofer · Driver</dt>
                <dd className="text-white/90 font-medium text-right">{shipment.driver_name}</dd>
              </div>
            )}
            {shipment.origin && (
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Origen · Origin</dt>
                <dd className="text-white/90 font-medium text-right">{shipment.origin}</dd>
              </div>
            )}
            {shipment.destination && (
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Destino · Destination</dt>
                <dd className="text-white/90 font-medium text-right">{shipment.destination}</dd>
              </div>
            )}
          </dl>
        </div>

        {shipment.port_id && portName && (
          <TrackLive portId={shipment.port_id} portName={portName} expectedAt={shipment.expected_crossing_at} />
        )}

        <div className="mt-6 text-center">
          <p className="text-[11px] text-white/40">
            Actualizado cada 2 min · Updates every 2 min
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-xs font-bold text-green-400 hover:text-green-300"
          >
            ¿Qué es cruzar.app? · What is cruzar.app? →
          </Link>
        </div>
      </div>
    </main>
  )
}
