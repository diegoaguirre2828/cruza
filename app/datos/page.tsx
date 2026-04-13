'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { getPortMeta } from '@/lib/portMeta'
import { formatWaitLabel } from '@/lib/formatWait'
import type { PortWaitTime } from '@/types'

// Analytics tab. Pro-gated. Houses everything we used to stack on
// the home page for every user: hourly patterns, peak-vs-best hour,
// weather-aware predictions. Free users see a preview + upgrade wall.
// Pro users get the full analytics hub.
//
// MVP content: port picker + hourly chart for the chosen bridge,
// with peak/best/now callouts and the current cadence disclosure.
// Future: weather correlation, multi-bridge compare, export.

interface HourlyResponse {
  peak: { hour: number; avgWait: number } | null
  best: { hour: number; avgWait: number } | null
  hours: Array<{ hour: number; avgWait: number }>
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

export default function DatosPage() {
  const { lang } = useLang()
  const { tier } = useTier()
  const es = lang === 'es'
  const isPro = tier === 'pro' || tier === 'business'

  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [hourly, setHourly] = useState<HourlyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const list: PortWaitTime[] = (d.ports || []).filter((p: PortWaitTime) => !p.isClosed && p.vehicle != null)
        setPorts(list)
        if (list.length > 0 && !selectedPortId) setSelectedPortId(list[0].portId)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }, [selectedPortId])

  useEffect(() => {
    if (!selectedPortId || !isPro) return
    fetch(`/api/ports/${encodeURIComponent(selectedPortId)}/hourly`)
      .then((r) => r.json())
      .then((d) => setHourly(d))
      .catch(() => setHourly(null))
  }, [selectedPortId, isPro])

  const selectedPort = useMemo(
    () => ports.find((p) => p.portId === selectedPortId),
    [ports, selectedPortId],
  )
  const selectedName = selectedPort
    ? (selectedPort.localNameOverride || getPortMeta(selectedPort.portId).localName || selectedPort.portName)
    : ''

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
              📊 {es ? 'Datos del puente' : 'Border insights'}
            </h1>
            <span className="text-[10px] font-black text-white bg-gradient-to-br from-amber-400 to-orange-500 px-2 py-0.5 rounded-full">
              PRO
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {es
              ? 'Patrones históricos, horas pico y mejores horas pa\' cruzar.'
              : 'Historical patterns, peak hours, and best times to cross.'}
          </p>
        </div>

        {!isPro ? (
          <UpgradeWall es={es} />
        ) : (
          <>
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
                {es ? 'Puente' : 'Crossing'}
              </label>
              <select
                value={selectedPortId || ''}
                onChange={(e) => { setSelectedPortId(e.target.value); setHourly(null) }}
                className="mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                {ports.map((p) => {
                  const meta = getPortMeta(p.portId)
                  const name = p.localNameOverride || meta.localName || p.portName
                  return (
                    <option key={p.portId} value={p.portId}>
                      {name} — {meta.city}
                    </option>
                  )
                })}
              </select>
            </div>

            {selectedPort && (
              <div className="mt-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg">
                <p className="text-[10px] uppercase tracking-widest font-bold text-blue-100">
                  {es ? 'Ahorita' : 'Right now'}
                </p>
                <p className="text-2xl font-black mt-0.5">
                  {selectedName}
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums">
                  {formatWaitLabel(selectedPort.vehicle ?? null, es ? 'es' : 'en')}
                </p>
              </div>
            )}

            {hourly && hourly.peak && hourly.best && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 dark:text-red-300">
                    {es ? 'Hora pico' : 'Peak hour'}
                  </p>
                  <p className="text-xl font-black text-red-800 dark:text-red-200 mt-0.5 tabular-nums">
                    {formatHour(hourly.peak.hour)}
                  </p>
                  <p className="text-[11px] text-red-700 dark:text-red-300 font-semibold">
                    ~{formatWaitLabel(hourly.peak.avgWait, es ? 'es' : 'en')}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700 dark:text-emerald-300">
                    {es ? 'Mejor hora' : 'Best hour'}
                  </p>
                  <p className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5 tabular-nums">
                    {formatHour(hourly.best.hour)}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    ~{formatWaitLabel(hourly.best.avgWait, es ? 'es' : 'en')}
                  </p>
                </div>
              </div>
            )}

            {hourly && hourly.hours && hourly.hours.length > 0 && (
              <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-2">
                  {es ? 'Patrón por hora' : 'Hourly pattern'}
                </p>
                <HourlyBarChart data={hourly.hours} />
              </div>
            )}

            {!hourly && selectedPortId && (
              <p className="mt-6 text-center text-xs text-gray-400">
                {loading ? (es ? 'Cargando…' : 'Loading…') : (es ? 'Sin datos históricos pa\' este puente' : 'No historical data for this crossing')}
              </p>
            )}

            {selectedPortId && <SentriBreakevenCard portId={selectedPortId} es={es} />}
            {selectedPortId && <AccidentImpactCard portId={selectedPortId} es={es} />}
          </>
        )}
      </div>
    </main>
  )
}

function HourlyBarChart({ data }: { data: Array<{ hour: number; avgWait: number }> }) {
  const max = Math.max(...data.map((d) => d.avgWait), 1)
  return (
    <div className="flex items-end gap-0.5 h-28">
      {data.map((d) => {
        const h = Math.max(4, (d.avgWait / max) * 100)
        const color = d.avgWait <= 20 ? 'bg-green-500' : d.avgWait <= 45 ? 'bg-amber-500' : 'bg-red-500'
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-1" title={`${d.hour}:00 — ${d.avgWait} min`}>
            <div className="w-full rounded-t bg-gray-100 dark:bg-gray-700 flex-1 flex items-end">
              <div className={`w-full ${color} rounded-t`} style={{ height: `${h}%` }} />
            </div>
            <span className="text-[8px] text-gray-400 font-mono">{d.hour}</span>
          </div>
        )
      })}
    </div>
  )
}

// SENTRI break-even card — shows users whether SENTRI is worth the
// $122 TTP fee for the bridge they're viewing, based on actual
// wait-time data from the last 30 days. Pulls from
// /api/ports/[id]/sentri-breakeven.
function SentriBreakevenCard({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    samples: number
    avgSavingsMin: number | null
    savingsUsdPerCrossing: number | null
    breakEvenCrossings: number | null
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/sentri-breakeven`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
  }, [portId])

  if (!data || data.samples < 10 || data.avgSavingsMin == null || data.avgSavingsMin < 1) return null

  return (
    <div className="mt-3 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-amber-700 dark:text-amber-400">
        ⚡ {es ? '¿Vale la pena SENTRI aquí?' : 'Is SENTRI worth it here?'}
      </p>
      <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1 leading-tight">
        {es
          ? `SENTRI te ahorra ~${data.avgSavingsMin} min en promedio`
          : `SENTRI saves you ~${data.avgSavingsMin} min on average`}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-2.5">
          <p className="text-[9px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">
            {es ? 'Ahorro por cruce' : 'Savings / crossing'}
          </p>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
            ${data.savingsUsdPerCrossing?.toFixed(2) || '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-2.5">
          <p className="text-[9px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">
            {es ? 'Se paga en' : 'Breaks even at'}
          </p>
          <p className="text-lg font-black text-blue-700 dark:text-blue-300 tabular-nums">
            {data.breakEvenCrossings != null ? `${data.breakEvenCrossings} ${es ? 'cruces' : 'uses'}` : '—'}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2 leading-snug">
        {es
          ? `Calculado con tu tiempo a $40/hr y la tarifa TTP de $122.25. Basado en ${data.samples} lecturas de los últimos 30 días.`
          : `Calculated at $40/hr for your time and the $122.25 TTP fee. Based on ${data.samples} readings from the last 30 days.`}
      </p>
      <a
        href="https://ttp.cbp.dhs.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full text-center py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl active:scale-95 transition-transform"
      >
        {es ? 'Aplicar pa\' SENTRI →' : 'Apply for SENTRI →'}
      </a>
    </div>
  )
}

// Accident impact card — computed from crossing_reports + wait_time_readings
// for the last 60 days at this port. "When an accident is reported,
// wait typically jumps +35 min and recovers in ~80 min."
function AccidentImpactCard({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    samples: number
    avgJumpMin: number | null
    avgRecoveryMin: number | null
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/accident-impact`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
  }, [portId])

  if (!data || data.samples < 3 || !data.avgJumpMin) return null

  return (
    <div className="mt-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-800 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-red-700 dark:text-red-400">
        🚨 {es ? 'Impacto de incidentes' : 'Incident impact'}
      </p>
      <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1 leading-tight">
        {es
          ? `Cuando reportan un incidente aquí, la espera típicamente sube +${data.avgJumpMin} min`
          : `When an incident is reported here, wait typically jumps +${data.avgJumpMin} min`}
      </p>
      {data.avgRecoveryMin != null && (
        <p className="text-[12px] text-red-800 dark:text-red-300 mt-1 font-semibold">
          {es
            ? `y se recupera en ~${data.avgRecoveryMin} min`
            : `and recovers in ~${data.avgRecoveryMin} min`}
        </p>
      )}
      <p className="text-[10px] text-red-700 dark:text-red-300 mt-2 leading-snug">
        {es
          ? `Modelo basado en ${data.samples} incidentes reportados en los últimos 60 días cruzados con las lecturas de espera.`
          : `Model based on ${data.samples} reported incidents over the last 60 days cross-referenced with wait readings.`}
      </p>
    </div>
  )
}

function UpgradeWall({ es }: { es: boolean }) {
  return (
    <div className="mt-4 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-rose-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-3xl p-6 text-center">
      <p className="text-4xl mb-2">📊</p>
      <p className="text-lg font-black text-gray-900 dark:text-gray-100 leading-tight">
        {es ? 'Datos son del plan Pro' : 'Insights are a Pro feature'}
      </p>
      <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 leading-snug">
        {es
          ? 'Los que cruzan diario lo usan pa\' saber la hora pico, la mejor hora pa\' cruzar y los patrones del día.'
          : 'Daily crossers use this to know peak hours, best times to cross, and daily patterns.'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        {[
          { es: 'Hora pico del día', en: 'Peak hour of the day' },
          { es: 'Mejor hora pa\' cruzar', en: 'Best time to cross' },
          { es: 'Patrón por hora', en: 'Hourly pattern' },
          { es: 'Alertas ilimitadas', en: 'Unlimited alerts' },
        ].map((f) => (
          <div key={f.en} className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/40 rounded-xl px-2.5 py-2">
            <span className="text-amber-600 dark:text-amber-400 text-sm">✓</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 leading-tight">
              {es ? f.es : f.en}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/pricing"
        className="mt-5 block w-full py-3.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-black rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
      >
        {es ? 'Activar Pro — $2.99/mes' : 'Unlock Pro — $2.99/mo'}
      </Link>
      <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        {es ? 'Instala la app y los primeros 3 meses son gratis' : 'Install the app and get the first 3 months free'}
      </p>
    </div>
  )
}
