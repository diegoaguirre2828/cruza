import { headers } from 'next/headers'
import Link from 'next/link'
import { isIOSAppUserAgent } from '@/lib/platform'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PortHealth {
  port_id: string
  port_name: string
  region: string
  sample_count: number
  avg_duration_min: number
  p50_duration_min: number
  p90_duration_min: number
  anomaly_rate: number
  health_score: number
}

interface HealthResponse {
  window_days: number
  generated_at: string
  ports: PortHealth[]
}

async function fetchHealth(origin: string): Promise<HealthResponse> {
  try {
    const res = await fetch(`${origin}/api/health`, { cache: 'no-store' })
    if (!res.ok) return { window_days: 7, generated_at: new Date().toISOString(), ports: [] }
    return await res.json()
  } catch {
    return { window_days: 7, generated_at: new Date().toISOString(), ports: [] }
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
  if (score >= 60) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
  if (score >= 40) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
}

export default async function PublicBridgeHealthPage() {
  const h = await headers()
  const host = h.get('host') ?? 'cruzar.app'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`
  const isIosApp = isIOSAppUserAgent(h.get('user-agent') || '')
  const data = await fetchHealth(origin)

  const generated = new Date(data.generated_at)

  return (
    <main className={`min-h-screen ${isIosApp ? 'pt-safe' : ''} bg-gray-50 dark:bg-gray-950 px-4 py-6`}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <Link href="/" className="text-xs text-blue-600 hover:underline">← Cruzar</Link>
        </div>

        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight">
          Bridge Health · Salud de los puentes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Last 7 days · derived from confirmed Cruzar crossings · {data.ports.length} bridges
        </p>
        <p className="mt-0.5 text-xs text-gray-400 font-mono">
          Generated {generated.toUTCString()}
        </p>

        {data.ports.length === 0 ? (
          <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No confirmed crossings in the last 7 days yet.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Sin cruces confirmados en los últimos 7 días.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {data.ports.map(p => (
              <div
                key={p.port_id}
                className={`rounded-2xl border p-4 ${scoreBg(p.health_score)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{p.port_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.region}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black tabular-nums ${scoreColor(p.health_score)}`}>
                      {p.health_score}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">
                      / 100
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">Avg</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{p.avg_duration_min}m</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">P50</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{p.p50_duration_min}m</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">P90</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{p.p90_duration_min}m</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">Anom</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {Math.round(p.anomaly_rate * 100)}%
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                  n = {p.sample_count}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Health score weighting: 60 pts low anomaly rate (≤5% optimal), 30 pts sample density
          (≥50 samples optimal), 10 pts low average duration. Anomalies = crossings whose actual
          duration exceeded 1.5× the port&apos;s 7-day median.
        </p>
      </div>
    </main>
  )
}
