import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DailyReportClient } from './DailyReportClient'

export const revalidate = 3600 // 1 hour cache

// ─── Types ───────────────────────────────────────────────────────────
interface PortStats {
  port_id: string
  port_name: string
  crossing_name: string | null
  avg_wait: number | null
  min_wait: number | null
  max_wait: number | null
  peak_hour: number | null
  peak_wait: number | null
  best_hour: number | null
  best_wait: number | null
  readings_count: number
}

interface ReportData {
  date: string
  global_avg_wait: number | null
  total_ports: number
  total_readings: number
  ports: PortStats[]
}

// ─── Helpers ─────────────────────────────────────────────────────────
function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(str + 'T12:00:00Z')
  return !isNaN(d.getTime())
}

function formatDateEN(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatDateES(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('es-MX', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Build a set of prominent city names from the ports in the report
function getCityNames(ports: PortStats[]): string[] {
  const names = new Set<string>()
  for (const p of ports) {
    const meta = PORT_META[p.port_id]
    if (meta) names.add(meta.city)
  }
  // Return the most well-known border cities first
  const priority = ['McAllen', 'Brownsville', 'Laredo', 'El Paso', 'San Ysidro', 'Otay Mesa', 'Pharr', 'Hidalgo', 'Nogales', 'Calexico', 'Eagle Pass']
  const sorted = [...names].sort((a, b) => {
    const ai = priority.indexOf(a)
    const bi = priority.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return sorted
}

// ─── Data fetching ───────────────────────────────────────────────────
async function fetchReportData(dateStr: string): Promise<ReportData | null> {
  const supabase = getSupabase()

  // Try the precomputed daily_reports table first
  const { data: cached } = await supabase
    .from('daily_reports')
    .select('report_data')
    .eq('report_date', dateStr)
    .single()

  if (cached?.report_data) {
    return cached.report_data as ReportData
  }

  // Compute on the fly from wait_time_readings
  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay = `${dateStr}T23:59:59.999Z`

  const { data: readings, error } = await supabase
    .from('wait_time_readings')
    .select('port_id, port_name, crossing_name, vehicle_wait, hour_of_day, recorded_at')
    .gte('recorded_at', startOfDay)
    .lte('recorded_at', endOfDay)
    .not('vehicle_wait', 'is', null)
    .order('recorded_at', { ascending: true })

  if (error || !readings || readings.length === 0) return null

  // Group by port_id
  const byPort = new Map<string, typeof readings>()
  for (const r of readings) {
    if (!byPort.has(r.port_id)) byPort.set(r.port_id, [])
    byPort.get(r.port_id)!.push(r)
  }

  const portStats: PortStats[] = []
  for (const [portId, portReadings] of byPort) {
    const waits = portReadings
      .map((r) => r.vehicle_wait as number)
      .filter((w) => w != null && w >= 0)

    if (waits.length === 0) continue

    const avg = Math.round(waits.reduce((s, w) => s + w, 0) / waits.length)
    const min = Math.min(...waits)
    const max = Math.max(...waits)

    const hourMap = new Map<number, number[]>()
    for (const r of portReadings) {
      const h = r.hour_of_day as number
      const w = r.vehicle_wait as number
      if (h == null || w == null) continue
      if (!hourMap.has(h)) hourMap.set(h, [])
      hourMap.get(h)!.push(w)
    }

    let peakHour: number | null = null
    let peakWait: number | null = null
    let bestHour: number | null = null
    let bestWait: number | null = null

    for (const [hour, hourWaits] of hourMap) {
      const hourAvg = hourWaits.reduce((s, w) => s + w, 0) / hourWaits.length
      if (peakWait === null || hourAvg > peakWait) {
        peakHour = hour
        peakWait = Math.round(hourAvg)
      }
      if (bestWait === null || hourAvg < bestWait) {
        bestHour = hour
        bestWait = Math.round(hourAvg)
      }
    }

    portStats.push({
      port_id: portId,
      port_name: portReadings[0].port_name,
      crossing_name: portReadings[0].crossing_name ?? null,
      avg_wait: avg,
      min_wait: min,
      max_wait: max,
      peak_hour: peakHour,
      peak_wait: peakWait,
      best_hour: bestHour,
      best_wait: bestWait,
      readings_count: waits.length,
    })
  }

  portStats.sort((a, b) => (b.avg_wait ?? 0) - (a.avg_wait ?? 0))

  const allAvgs = portStats.map((p) => p.avg_wait).filter((a): a is number => a != null)
  const globalAvg = allAvgs.length > 0
    ? Math.round(allAvgs.reduce((s, a) => s + a, 0) / allAvgs.length)
    : null

  return {
    date: dateStr,
    global_avg_wait: globalAvg,
    total_ports: portStats.length,
    total_readings: readings.length,
    ports: portStats,
  }
}

// ─── Metadata (SEO) ─────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>
}): Promise<Metadata> {
  const { date } = await params
  if (!isValidDate(date)) return { title: 'Cruzar' }

  const report = await fetchReportData(date)
  const dateEN = formatDateEN(date)
  const dateES = formatDateES(date)

  const cityNames = report ? getCityNames(report.ports).slice(0, 5) : []
  const citiesStr = cityNames.length > 0 ? cityNames.join(', ') : 'All Ports'

  // Title includes city names + date for long-tail SEO
  const title = `Border Wait Times - ${dateEN} - ${citiesStr} | Cruzar`
  const description = `Live border crossing wait times for ${dateEN}. Average, peak, and best hours at ${citiesStr} and ${report?.total_ports ?? 50}+ US-Mexico border ports. Updated hourly.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://cruzar.app/data/${date}`,
    },
    openGraph: {
      title,
      description,
      url: `https://cruzar.app/data/${date}`,
      siteName: 'Cruzar',
      locale: 'en_US',
      type: 'article',
      images: [
        {
          url: 'https://cruzar.app/opengraph-image',
          width: 1200,
          height: 630,
          alt: `Border Wait Times - ${dateEN}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Border Wait Times - ${dateEN} | Cruzar`,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────
export default async function DailyReportPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  if (!isValidDate(date)) notFound()

  // Don't allow future dates
  const today = new Date().toISOString().split('T')[0]
  if (date > today) notFound()

  const report = await fetchReportData(date)

  const dateEN = formatDateEN(date)
  const dateES = formatDateES(date)
  const cityNames = report ? getCityNames(report.ports).slice(0, 5) : []

  // Previous / next date links
  const prevDate = new Date(date + 'T12:00:00Z')
  prevDate.setDate(prevDate.getDate() - 1)
  const prevStr = prevDate.toISOString().split('T')[0]

  const nextDate = new Date(date + 'T12:00:00Z')
  nextDate.setDate(nextDate.getDate() + 1)
  const nextStr = nextDate.toISOString().split('T')[0]
  const hasNext = nextStr <= today

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Border Wait Times - ${dateEN}`,
    description: `Daily border crossing wait time report for ${dateEN} covering ${report?.total_ports ?? 0} US-Mexico border ports.`,
    datePublished: `${date}T00:00:00-05:00`,
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'Cruzar',
      url: 'https://cruzar.app',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cruzar',
      url: 'https://cruzar.app',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://cruzar.app/data/${date}`,
    },
    about: {
      '@type': 'Thing',
      name: 'US-Mexico Border Wait Times',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto px-4 pb-20">
          {/* Back nav */}
          <div className="pt-6 pb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> cruzar.app
            </Link>
          </div>

          {/* Header */}
          <header className="pt-4 pb-6">
            <DailyReportClient
              dateEN={dateEN}
              dateES={dateES}
              report={report}
              date={date}
              prevDate={prevStr}
              nextDate={hasNext ? nextStr : null}
              cityNames={cityNames}
            />
          </header>
        </div>
      </main>
    </>
  )
}
