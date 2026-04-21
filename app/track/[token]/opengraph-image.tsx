import { ImageResponse } from 'next/og'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OG({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = getServiceClient()

  const { data: tok } = await db
    .from('shipment_tokens')
    .select('shipment_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  let ref = 'Cruzar tracking'
  let portName = ''
  let statusText = 'Tracking'
  let waitText = ''

  if (tok && (!tok.expires_at || new Date(tok.expires_at) > new Date())) {
    const { data: s } = await db
      .from('shipments')
      .select('reference_id, port_id, status')
      .eq('id', tok.shipment_id)
      .maybeSingle()
    if (s) {
      ref = s.reference_id
      statusText = s.status.replace(/_/g, ' ')
      if (s.port_id) {
        const meta = getPortMeta(s.port_id)
        portName = meta?.localName || meta?.city || ''
        const { data: reading } = await db
          .from('wait_time_readings')
          .select('commercial_wait, vehicle_wait, recorded_at')
          .eq('port_id', s.port_id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (reading) {
          const w = reading.commercial_wait ?? reading.vehicle_wait
          if (w != null) waitText = `${w} min`
        }
      }
    }
  }

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: '#0f172a',
        color: 'white',
        padding: 64,
        fontFamily: 'system-ui',
      }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
          Cruzar · Shipment Tracking
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, marginTop: 16, lineHeight: 1.05 }}>
          {ref}
        </div>
        {portName && (
          <div style={{ fontSize: 44, fontWeight: 700, marginTop: 24, color: 'rgba(255,255,255,0.85)' }}>
            {portName}
          </div>
        )}
        <div style={{ display: 'flex', gap: 32, marginTop: 'auto', alignItems: 'baseline' }}>
          {waitText && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>Wait · Espera</span>
              <span style={{ fontSize: 84, fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>{waitText}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: waitText ? 48 : 0 }}>
            <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>Status · Estado</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: '#f59e0b', textTransform: 'capitalize' }}>
              {statusText}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', marginTop: 32 }}>
          cruzar.app
        </div>
      </div>
    ),
    { ...size }
  )
}
