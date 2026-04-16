'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { PORT_META } from '@/lib/portMeta'
import {
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react'

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

interface Props {
  dateEN: string
  dateES: string
  report: ReportData | null
  date: string
  prevDate: string
  nextDate: string | null
  cityNames: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatHour(h: number, es: boolean): string {
  if (es) return `${h.toString().padStart(2, '0')}:00`
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

function waitColor(minutes: number | null): string {
  if (minutes === null) return 'text-gray-400'
  if (minutes <= 20) return 'text-emerald-400'
  if (minutes <= 45) return 'text-amber-400'
  return 'text-red-400'
}

function waitBg(minutes: number | null): string {
  if (minutes === null) return 'bg-gray-500/10 border-gray-500/20'
  if (minutes <= 20) return 'bg-emerald-500/10 border-emerald-500/20'
  if (minutes <= 45) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

function waitDot(minutes: number | null): string {
  if (minutes === null) return 'bg-gray-400'
  if (minutes <= 20) return 'bg-emerald-400'
  if (minutes <= 45) return 'bg-amber-400'
  return 'bg-red-400'
}

function borderLeftColor(minutes: number | null): string {
  if (minutes === null) return 'border-l-gray-500'
  if (minutes <= 20) return 'border-l-emerald-500'
  if (minutes <= 45) return 'border-l-amber-500'
  return 'border-l-red-500'
}

// ─── Component ───────────────────────────────────────────────────────
export function DailyReportClient({
  dateEN,
  dateES,
  report,
  date,
  prevDate,
  nextDate,
  cityNames,
}: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  const dateDisplay = es ? dateES : dateEN

  // No data state
  if (!report || report.ports.length === 0) {
    return (
      <div className="text-center py-16">
        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h1 className="text-2xl font-black mb-2">
          {es ? 'Reporte del' : 'Border Report -'} {dateDisplay}
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          {es
            ? 'No hay datos de espera disponibles para esta fecha.'
            : 'No wait time data available for this date.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href={`/data/${prevDate}`}
            className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {es ? 'Dia anterior' : 'Previous day'}
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white"
          >
            {es ? 'Ver tiempos en vivo' : 'See live times'}
          </Link>
        </div>
      </div>
    )
  }

  // Group ports by mega region for organized display
  const regionGroups = new Map<string, PortStats[]>()
  for (const port of report.ports) {
    const meta = PORT_META[port.port_id]
    const region = meta?.region ?? 'Other'
    if (!regionGroups.has(region)) regionGroups.set(region, [])
    regionGroups.get(region)!.push(port)
  }

  // Overall summary stats
  const busiestPort = report.ports[0]
  const fastestPort = [...report.ports].sort(
    (a, b) => (a.avg_wait ?? 999) - (b.avg_wait ?? 999)
  )[0]

  return (
    <div>
      {/* Title area */}
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
          {es ? 'Reporte diario de la frontera' : 'Daily border report'}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black leading-tight">
          {es ? 'Tiempos de Espera' : 'Border Wait Times'}
        </h1>
        <p className="text-lg text-gray-300 mt-1">{dateDisplay}</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/data/${prevDate}`}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4" />
          {es ? 'Anterior' : 'Previous'}
        </Link>
        <Link
          href="/"
          className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold"
        >
          {es ? 'En vivo ahora' : 'Live now'}
        </Link>
        {nextDate ? (
          <Link
            href={`/data/${nextDate}`}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10"
          >
            {es ? 'Siguiente' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="text-sm text-gray-600 px-3 py-2">
            {es ? 'Hoy' : 'Today'}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
          <BarChart3 className="w-4 h-4 text-gray-500 mb-1" />
          <p className="text-2xl font-black">
            {report.global_avg_wait != null ? `${report.global_avg_wait}` : '--'}
            <span className="text-sm font-normal text-gray-400 ml-1">min</span>
          </p>
          <p className="text-[11px] text-gray-500">
            {es ? 'Promedio general' : 'Overall average'}
          </p>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
          <Clock className="w-4 h-4 text-gray-500 mb-1" />
          <p className="text-2xl font-black">{report.total_ports}</p>
          <p className="text-[11px] text-gray-500">
            {es ? 'Puertos activos' : 'Active ports'}
          </p>
        </div>

        {busiestPort && (
          <div className="bg-red-500/10 rounded-2xl border border-red-500/20 p-4">
            <TrendingUp className="w-4 h-4 text-red-400 mb-1" />
            <p className="text-sm font-bold text-red-400 truncate">
              {PORT_META[busiestPort.port_id]?.localName || busiestPort.port_name}
            </p>
            <p className="text-[11px] text-gray-400">
              {es ? 'Mas lento' : 'Slowest'}: {busiestPort.avg_wait} min
            </p>
          </div>
        )}

        {fastestPort && (
          <div className="bg-emerald-500/10 rounded-2xl border border-emerald-500/20 p-4">
            <TrendingDown className="w-4 h-4 text-emerald-400 mb-1" />
            <p className="text-sm font-bold text-emerald-400 truncate">
              {PORT_META[fastestPort.port_id]?.localName || fastestPort.port_name}
            </p>
            <p className="text-[11px] text-gray-400">
              {es ? 'Mas rapido' : 'Fastest'}: {fastestPort.avg_wait} min
            </p>
          </div>
        )}
      </div>

      {/* Port cards */}
      <h2 className="text-lg font-black mb-4">
        {es ? 'Todos los puertos' : 'All ports'}{' '}
        <span className="text-gray-500 font-normal text-sm">({report.ports.length})</span>
      </h2>

      <div className="space-y-3">
        {report.ports.map((port) => {
          const meta = PORT_META[port.port_id]
          const localName = meta?.localName || port.port_name
          const city = meta?.city || ''

          return (
            <Link
              key={port.port_id}
              href={`/port/${port.port_id}`}
              className={`block rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors border-l-4 ${borderLeftColor(port.avg_wait)} p-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${waitDot(port.avg_wait)}`} />
                    <h3 className="font-bold text-sm truncate">{localName}</h3>
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  </div>
                  {city && (
                    <p className="text-[11px] text-gray-500 mb-2 ml-4">{city}</p>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-4">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                        {es ? 'Promedio' : 'Average'}
                      </p>
                      <p className={`text-sm font-bold ${waitColor(port.avg_wait)}`}>
                        {port.avg_wait != null ? `${port.avg_wait} min` : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                        {es ? 'Rango' : 'Range'}
                      </p>
                      <p className="text-sm font-bold text-gray-300">
                        {port.min_wait != null && port.max_wait != null
                          ? `${port.min_wait}-${port.max_wait}`
                          : '--'}
                        <span className="text-xs font-normal text-gray-500 ml-0.5">min</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                        {es ? 'Peor hora' : 'Peak hour'}
                      </p>
                      <p className="text-sm font-bold text-red-400">
                        {port.peak_hour != null
                          ? `${formatHour(port.peak_hour, es)} (${port.peak_wait}m)`
                          : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                        {es ? 'Mejor hora' : 'Best hour'}
                      </p>
                      <p className="text-sm font-bold text-emerald-400">
                        {port.best_hour != null
                          ? `${formatHour(port.best_hour, es)} (${port.best_wait}m)`
                          : '--'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Large avg number */}
                <div className={`rounded-xl px-3 py-2 border ${waitBg(port.avg_wait)} text-center flex-shrink-0`}>
                  <p className={`text-xl font-black ${waitColor(port.avg_wait)}`}>
                    {port.avg_wait ?? '--'}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {es ? 'prom' : 'avg'}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* SEO-friendly text block — hidden from casual scroll but indexed by Google */}
      <section className="mt-10 space-y-4 text-sm text-gray-400 leading-relaxed">
        <h2 className="text-base font-bold text-gray-300">
          {es
            ? `Resumen de tiempos de espera en la frontera - ${dateDisplay}`
            : `Border crossing wait time summary - ${dateDisplay}`}
        </h2>
        <p>
          {es
            ? `Este reporte cubre ${report.total_ports} puertos fronterizos entre Estados Unidos y Mexico con un total de ${report.total_readings.toLocaleString()} lecturas de tiempo de espera registradas el ${dateDisplay}. El tiempo de espera promedio general fue de ${report.global_avg_wait ?? '--'} minutos para vehiculos particulares.`
            : `This report covers ${report.total_ports} US-Mexico border ports with a total of ${report.total_readings.toLocaleString()} wait time readings recorded on ${dateDisplay}. The overall average vehicle wait time was ${report.global_avg_wait ?? '--'} minutes.`}
        </p>
        {busiestPort && (
          <p>
            {es
              ? `El cruce mas lento del dia fue ${busiestPort.port_name} con un promedio de ${busiestPort.avg_wait} minutos y un maximo de ${busiestPort.max_wait} minutos.`
              : `The slowest crossing of the day was ${busiestPort.port_name} with an average of ${busiestPort.avg_wait} minutes and a maximum of ${busiestPort.max_wait} minutes.`}
          </p>
        )}
        {fastestPort && (
          <p>
            {es
              ? `El cruce mas rapido fue ${fastestPort.port_name} con un promedio de solo ${fastestPort.avg_wait} minutos.`
              : `The fastest crossing was ${fastestPort.port_name} with an average of just ${fastestPort.avg_wait} minutes.`}
          </p>
        )}
        <p>
          {es
            ? `Los datos provienen del API oficial de CBP (Customs and Border Protection) y se actualizan cada 15 minutos. Cruzar captura y almacena esta informacion para analisis historico y predicciones.`
            : `Data sourced from the official CBP (Customs and Border Protection) API, updated every 15 minutes. Cruzar captures and stores this data for historical analysis and predictions.`}
        </p>
        <p>
          {es
            ? `Ciudades cubiertas: ${cityNames.join(', ')}.`
            : `Cities covered: ${cityNames.join(', ')}.`}
        </p>
      </section>

      {/* Legend + links */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 mb-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {es ? '0-20 min' : '0-20 min'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {es ? '21-45 min' : '21-45 min'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            {es ? '45+ min' : '45+ min'}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300">
            {es ? 'Tiempos en vivo' : 'Live wait times'}
          </Link>
          <Link href="/datos" className="text-gray-400 hover:text-white">
            {es ? 'Datos y estadisticas' : 'Data & analytics'}
          </Link>
          <Link href="/pricing" className="text-gray-400 hover:text-white">
            {es ? 'Precios' : 'Pricing'}
          </Link>
        </div>
      </div>

      {/* Footer credit */}
      <footer className="mt-6 text-center text-[11px] text-gray-600">
        Cruzar · cruzar.app · {es ? 'Datos de CBP' : 'CBP data'}
      </footer>
    </div>
  )
}
