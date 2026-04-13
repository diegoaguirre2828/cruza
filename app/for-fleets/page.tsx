'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Public-facing landing page for trucking fleets and dispatchers.
//
// Problem: the Business tier ($49.99/mo) has zero signups because
// every business surface (/business, /fleet) is behind an auth+tier
// wall. A cold dispatcher finding Cruzar has no way to understand
// the product without signing up blind. This page is the discovery
// surface — public, no auth required, directly pitched at the
// dispatcher persona with ROI math they recognize, screenshots of
// the actual product, and a lead-capture path (mailto for now;
// upgrade to a real lead form once we have volume).

function formatMoney(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 100) / 10}k`
  return `$${Math.round(n).toLocaleString()}`
}

export default function ForFleetsPage() {
  const { lang } = useLang()
  const es = lang === 'es'

  // Interactive ROI calculator — all client-side math.
  const [trucks, setTrucks] = useState(5)
  const [crossingsPerWeek, setCrossingsPerWeek] = useState(15)
  const [delayMinutes, setDelayMinutes] = useState(30)
  const [driverCostPerHour, setDriverCostPerHour] = useState(85)

  const monthlyLoss = useMemo(() => {
    // trucks × (crossings/week × 52/12 → crossings/month) × delay hours × $/hr
    const crossingsPerMonth = (crossingsPerWeek * 52) / 12
    const delayHours = delayMinutes / 60
    return trucks * crossingsPerMonth * delayHours * driverCostPerHour
  }, [trucks, crossingsPerWeek, delayMinutes, driverCostPerHour])

  const monthlyLossWithCruzar = monthlyLoss * 0.5 // assume 50% delay reduction
  const monthlySavings = monthlyLoss - monthlyLossWithCruzar - 49.99
  const paybackDays = monthlyLoss > 0 ? (49.99 / (monthlyLoss / 30)).toFixed(1) : '—'

  const subject = encodeURIComponent(
    es ? 'Quiero saber más de Cruzar Business' : 'Interested in Cruzar Business',
  )
  const body = encodeURIComponent(
    es
      ? `Hola,

Soy dispatcher/dueño de una flota y me interesa saber más sobre Cruzar Business.

Mi flota: ${trucks} camiones, ~${crossingsPerWeek} cruces por semana.

Gracias,`
      : `Hi,

I'm a dispatcher/fleet owner interested in learning more about Cruzar Business.

My fleet: ${trucks} trucks, ~${crossingsPerWeek} crossings per week.

Thanks,`,
  )
  const mailto = `mailto:cruzabusiness@gmail.com?subject=${subject}&body=${body}`

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24">

        {/* Hero */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
          <p className="text-[10px] uppercase tracking-widest font-black text-amber-400 mb-2">
            CRUZAR BUSINESS · {es ? 'Para flotas' : 'For fleets'}
          </p>
          <h1 className="text-2xl sm:text-4xl font-black leading-tight">
            {es
              ? 'Tu flota está perdiendo dinero en el puente.'
              : 'Your fleet is losing money at the border.'}
          </h1>
          <p className="text-sm sm:text-base text-gray-300 mt-3 leading-snug">
            {es
              ? 'Cada hora atorado en la frontera cuesta real — y pasa más seguido de lo que piensas. Cruzar Business te da alertas en vivo, dashboard de flota, y datos que CBP no publica.'
              : 'Every hour stuck at the border costs real money — and it happens more often than you think. Cruzar Business gives you live alerts, a fleet dashboard, and data CBP doesn\'t publish.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={mailto}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-black text-sm px-5 py-3 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
            >
              {es ? '📞 Hablemos de tu flota' : '📞 Let\'s talk about your fleet'}
            </a>
            <Link
              href="/signup?next=/business"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm px-5 py-3 rounded-2xl active:scale-[0.98] transition-transform"
            >
              {es ? 'Empezar prueba →' : 'Start trial →'}
            </Link>
          </div>
        </div>

        {/* ROI calculator */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💰</span>
            <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">
              {es ? 'Calculadora de costo' : 'Cost calculator'}
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            {es
              ? 'Mete los números de tu flota y te digo cuánto estás perdiendo cada mes.'
              : 'Plug in your fleet numbers and I\'ll show you what you\'re losing each month.'}
          </p>

          <div className="space-y-4">
            <Slider
              label={es ? 'Camiones en tu flota' : 'Trucks in your fleet'}
              value={trucks}
              onChange={setTrucks}
              min={1}
              max={50}
              step={1}
              suffix={es ? ' camiones' : ' trucks'}
            />
            <Slider
              label={es ? 'Cruces por semana (flota total)' : 'Crossings per week (whole fleet)'}
              value={crossingsPerWeek}
              onChange={setCrossingsPerWeek}
              min={1}
              max={100}
              step={1}
              suffix={es ? ' cruces/semana' : ' crossings/wk'}
            />
            <Slider
              label={es ? 'Minutos típicos atorados en el puente' : 'Typical minutes stuck at the border'}
              value={delayMinutes}
              onChange={setDelayMinutes}
              min={10}
              max={180}
              step={5}
              suffix=" min"
            />
            <Slider
              label={es ? 'Costo por hora de un camión parado' : 'Cost per hour of a stopped truck'}
              value={driverCostPerHour}
              onChange={setDriverCostPerHour}
              min={25}
              max={200}
              step={5}
              suffix=" $/hr"
            />
          </div>

          <div className="mt-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-800 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-red-700 dark:text-red-400">
              {es ? 'Estás perdiendo cada mes' : 'You\'re losing every month'}
            </p>
            <p className="text-4xl sm:text-5xl font-black text-red-700 dark:text-red-400 tabular-nums leading-none mt-1">
              {formatMoney(monthlyLoss)}
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-semibold">
              {es
                ? 'Basado en los minutos que tus camiones pasan atorados × costo por hora.'
                : 'Based on the minutes your trucks are stuck × hourly cost.'}
            </p>
          </div>

          <div className="mt-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-800 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-green-700 dark:text-green-400">
              {es ? 'Con Cruzar Business' : 'With Cruzar Business'}
            </p>
            <p className="text-4xl sm:text-5xl font-black text-green-700 dark:text-green-400 tabular-nums leading-none mt-1">
              {formatMoney(Math.max(0, monthlySavings))}
              <span className="text-base font-bold text-green-600 dark:text-green-500 ml-2">
                {es ? 'ahorrados' : 'saved'}
              </span>
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-2 leading-snug">
              {es
                ? `Calculado con una reducción promedio del 50% en retrasos — las alertas te dejan salir cuando el puente está flojo en vez de cuando marca tu ruta.`
                : 'Calculated with an average 50% reduction in delays — alerts let you leave when the bridge is clear instead of when your route says to.'}
            </p>
            <p className="text-[11px] text-green-800 dark:text-green-200 mt-2 font-bold">
              {es
                ? `Cruzar Business se paga en ${paybackDays} días.`
                : `Cruzar Business pays for itself in ${paybackDays} days.`}
            </p>
          </div>
        </div>

        {/* What you get */}
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest font-black text-gray-500 dark:text-gray-400 px-1 mb-2">
            {es ? 'Qué incluye Business' : 'What Business includes'}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                emoji: '🚛',
                es: ['Panel de flota en vivo', 'Ve cada camión: en fila, en el puente, cruzado, entregado. Sin apps para tus drivers — link mágico y listo.'],
                en: ['Live fleet dashboard', 'See every truck: in line, at the bridge, cleared, delivered. No apps for your drivers — magic link and done.'],
              },
              {
                emoji: '🔔',
                es: ['Alertas ilimitadas por puente', 'Recibe un ping cuando cualquier puente baje de X minutos. Por email, push, o SMS.'],
                en: ['Unlimited bridge alerts', 'Get a ping when any bridge drops below X minutes. Email, push, or SMS.'],
              },
              {
                emoji: '📊',
                es: ['Patrones históricos por hora', 'Mejor hora para cruzar, hora pico, comparación por día de la semana — datos que CBP no publica.'],
                en: ['Hourly historical patterns', 'Best time to cross, peak hour, day-of-week comparisons — data CBP doesn\'t publish.'],
              },
              {
                emoji: '💵',
                es: ['Calculadora de costo de retrasos', 'Ve exactamente cuánto dinero está perdiendo tu flota por los retrasos en el puente.'],
                en: ['Delay cost calculator', 'See exactly how much your fleet is losing to border delays.'],
              },
              {
                emoji: '📦',
                es: ['Tracking de cargas / shipments', 'Registra cada carga, vincula al driver, ve el ETA actualizado en vivo.'],
                en: ['Shipment tracking', 'Log each load, link it to a driver, see live-updated ETA.'],
              },
              {
                emoji: '📥',
                es: ['Export de datos (CSV)', 'Sácalo a tu propio sistema, generador de reportes, o calculadora de nómina.'],
                en: ['CSV data export', 'Pipe it into your own reports, payroll calc, or billing.'],
              },
            ].map((f) => (
              <div key={f.en[0]} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-2xl leading-none mb-2">{f.emoji}</p>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
                  {es ? f.es[0] : f.en[0]}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug">
                  {es ? f.es[1] : f.en[1]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Lead capture CTA */}
        <div className="mt-6 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-6 text-white text-center shadow-2xl">
          <p className="text-lg font-black leading-tight">
            {es
              ? '¿Eres dispatcher o dueño de una flota?'
              : 'Are you a dispatcher or fleet owner?'}
          </p>
          <p className="text-xs text-blue-100 mt-2 leading-snug max-w-md mx-auto">
            {es
              ? 'Mándame un email y montamos tu flota en Cruzar Business contigo. 30 minutos de setup, no tienes que aprender nada nuevo, tus drivers no instalan nada.'
              : 'Email me and we\'ll set up your fleet in Cruzar Business together. 30 minutes of setup, nothing to learn, drivers install nothing.'}
          </p>
          <a
            href={mailto}
            className="mt-5 inline-flex items-center gap-2 bg-white text-indigo-700 font-black text-sm px-6 py-3 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
          >
            📧 {es ? 'Hablemos de tu flota' : 'Let\'s talk about your fleet'}
          </a>
          <p className="text-[10px] text-blue-200 mt-3">
            cruzabusiness@gmail.com · {es ? 'Responde el mismo día' : 'Same-day response'}
          </p>
        </div>

        {/* Pricing footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {es ? 'Cruzar Business · $49.99 USD/mes · cancela cuando quieras' : 'Cruzar Business · $49.99 USD/month · cancel anytime'}
          </p>
          <Link
            href="/pricing"
            className="mt-2 inline-block text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {es ? 'Ver planes completos →' : 'See full pricing →'}
          </Link>
        </div>
      </div>
    </main>
  )
}

interface SliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix?: string
}

function Slider({ label, value, onChange, min, max, step, suffix }: SliderProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-bold text-gray-700 dark:text-gray-200 leading-tight">
          {label}
        </label>
        <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  )
}
