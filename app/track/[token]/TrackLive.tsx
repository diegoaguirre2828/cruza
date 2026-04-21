'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Props {
  portId: string
  portName: string
  expectedAt: string | null
}

type PortsResponse = {
  ports?: Array<{
    portId: string
    portName: string
    vehicle: number | null
    commercial: number | null
    sentri: number | null
    pedestrian: number | null
  }>
}

function level(mins: number | null): { color: string; es: string; en: string } {
  if (mins == null) return { color: '#6b7280', es: 'Sin datos', en: 'No data' }
  if (mins <= 20) return { color: '#22c55e', es: 'Rápido', en: 'Fast' }
  if (mins <= 45) return { color: '#f59e0b', es: 'Moderado', en: 'Moderate' }
  return { color: '#ef4444', es: 'Lento', en: 'Slow' }
}

function computeEta(expectedAt: string | null, waitMinutes: number | null): string | null {
  if (!expectedAt) return null
  const base = new Date(expectedAt).getTime()
  if (Number.isNaN(base)) return null
  const extra = (waitMinutes ?? 0) * 60 * 1000
  const eta = new Date(base + extra)
  return eta.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function TrackLive({ portId, portName, expectedAt }: Props) {
  const { data } = useSWR<PortsResponse>('/api/ports', fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: true,
  })

  const port = data?.ports?.find(p => p.portId === portId)
  const wait = port?.commercial ?? port?.vehicle ?? null
  const lane = port?.commercial != null ? 'commercial' : 'vehicle'
  const lvl = level(wait)
  const eta = computeEta(expectedAt, wait)

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2">
        Puente · Bridge
      </div>
      <h2 className="text-xl font-black text-white">{portName}</h2>
      <p className="text-xs text-white/40 mt-0.5">
        {lane === 'commercial' ? 'Carril comercial · Commercial lane' : 'Carril vehicular · Vehicle lane'}
      </p>

      <div className="mt-4 flex items-baseline gap-3">
        <div className="text-6xl font-black tabular-nums" style={{ color: lvl.color }}>
          {wait ?? '—'}
        </div>
        <div className="text-sm font-bold text-white/70">min</div>
        <div
          className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full"
          style={{
            background: `${lvl.color}22`,
            color: lvl.color,
            border: `1px solid ${lvl.color}4d`,
          }}
        >
          {lvl.es} · {lvl.en}
        </div>
      </div>

      {eta && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-white/50">ETA estimada · Estimated ETA</span>
            <span className="text-sm font-bold text-white">{eta}</span>
          </div>
          <p className="text-[10px] text-white/30 mt-1 leading-snug">
            Basado en la espera actual del puente + hora prevista · Based on current bridge wait + expected crossing time
          </p>
        </div>
      )}
    </div>
  )
}
