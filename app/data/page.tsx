'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Database, Shield, Clock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Public B2B data landing page. Pitch + lead capture form.
// The consumer app is Cruzar's user-acquisition funnel; this page
// is the commercial surface for buyers who Google "border crossing
// dataset" or "Mexico border freight data". Zero-effort lead magnet.
//
// Audience (in priority order): trucking fleets, cargo insurers, auto
// OEMs with maquiladoras, freight forwarders, gov research offices.
// See memory/project_cruzar_data_moat_buyers_20260414.md for the
// full buyer map.

export default function DataPage() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [form, setForm] = useState({
    email: '',
    name: '',
    company: '',
    role: '',
    useCase: '',
    estimatedVolume: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/data-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Submission failed')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> cruzar.app
          </Link>
        </div>

        {/* Hero */}
        <div className="pt-8 pb-12">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">
            {es ? 'Datos de la frontera US-México' : 'US-Mexico Border Data'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">
            {es
              ? 'La única red de sensores en la frontera'
              : 'The only sensor network on the border'}
          </h1>
          <p className="mt-4 text-lg text-gray-300 leading-relaxed">
            {es
              ? 'Cruzar es una app de espera en vivo — y también una red de sensores de crowdsourcing que captura datos al nivel de carril que nadie más publica: X-ray activo por carril, inspección secundaria, llegadas a tiempo, tipos de vehículo, detalles de carga, y fotos comunitarias con características estructuradas extraídas por AI.'
              : 'Cruzar is a live border wait time app — and a crowdsourced sensor network capturing lane-level data nobody else publishes: per-lane X-ray activation, secondary inspection rate, on-time arrivals, vehicle types, cargo breakdown, plus community photos with AI-extracted structured features.'}
          </p>
        </div>

        {/* What we capture */}
        <section className="bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-gray-800 p-6 mb-10">
          <h2 className="text-xl font-black mb-4">
            {es ? 'Lo que capturamos' : 'What we capture'}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { es: 'Tiempos de espera CBP cada 15 minutos', en: 'CBP wait times every 15 minutes' },
              { es: 'Reportes comunitarios con verificación GPS', en: 'GPS-verified community reports' },
              { es: 'X-ray activo por carril (nadie más publica esto)', en: 'Per-lane X-ray activation (nobody else publishes this)' },
              { es: 'Tasa de inspección secundaria por puente', en: 'Secondary inspection rate per port' },
              { es: '"¿Llegaste a tiempo?" — datos de confiabilidad de entrega', en: '"Did you arrive on time?" — delivery reliability data' },
              { es: 'Tipo de vehículo, propósito, carga', en: 'Vehicle type, trip purpose, cargo' },
              { es: 'Fotos comunitarias con características extraídas por AI', en: 'Community photos with AI-extracted features' },
              { es: 'Clima correlacionado con tiempos de espera', en: 'Weather correlated with wait times' },
              { es: 'Programas de cruzante (SENTRI/FAST/NEXUS/Ready)', en: 'Trusted traveler programs (SENTRI/FAST/NEXUS/Ready)' },
              { es: 'Conteo de cabinas abiertas, oficiales presentes, K9', en: 'Booth count, officer presence, K9 units' },
              { es: '53 puertos fronterizos de US-México', en: '53 US-Mexico border ports' },
              { es: 'Retención de 3+ años', en: '3+ year retention' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300 leading-snug">
                  {es ? item.es : item.en}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Who we serve */}
        <section className="mb-10">
          <h2 className="text-xl font-black mb-4">
            {es ? 'Para quién' : 'Who it serves'}
          </h2>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { emoji: '🚛', en: 'Trucking fleets', es: 'Flotas de camiones', sub: { en: 'Real-time alerts + predictive ETAs + route optimization', es: 'Alertas en vivo + ETAs predictivos + optimización de ruta' } },
              { emoji: '🏭', en: 'OEMs with MX maquiladoras', es: 'Armadoras con maquilas', sub: { en: 'Just-in-time supply chain monitoring', es: 'Monitoreo de cadena de suministro just-in-time' } },
              { emoji: '🛡️', en: 'Cargo & freight insurers', es: 'Aseguradoras de carga', sub: { en: 'Tail-risk distributions + catastrophic delay frequency', es: 'Distribuciones de riesgo + frecuencia de retrasos catastróficos' } },
              { emoji: '📦', en: 'Freight forwarders', es: 'Agentes de carga', sub: { en: 'Transit time promises + customer alerts', es: 'Promesas de tiempo de tránsito + alertas al cliente' } },
              { emoji: '🏢', en: 'Government / research', es: 'Gobierno / investigación', sub: { en: 'CBP performance validation + GAO reporting + academic studies', es: 'Validación de desempeño CBP + reportes GAO + estudios académicos' } },
              { emoji: '📊', en: 'Freight visibility platforms', es: 'Plataformas de visibilidad', sub: { en: 'White-label border module or raw API', es: 'Módulo fronterizo white-label o API directa' } },
            ].map((seg, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-2xl mb-1">{seg.emoji}</p>
                <p className="text-sm font-bold text-white">{es ? seg.es : seg.en}</p>
                <p className="text-[11px] text-gray-400 mt-1 leading-snug">{es ? seg.sub.es : seg.sub.en}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The moat framing */}
        <section className="mb-10 grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-800/50 rounded-2xl p-5">
            <Database className="w-5 h-5 text-amber-400 mb-2" />
            <p className="text-sm font-black text-white mb-1">
              {es ? 'Irreproducible' : 'Unreplicable'}
            </p>
            <p className="text-xs text-gray-300 leading-snug">
              {es
                ? 'La data granular requiere una base de usuarios físicamente en la frontera. Construirla es el problema — no tenemos competidores directos.'
                : 'Lane-level data requires a user base physically at the border. Bootstrapping the audience is the hard problem — no direct competitors.'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-800/50 rounded-2xl p-5">
            <Shield className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-sm font-black text-white mb-1">
              {es ? 'Verificado por GPS' : 'GPS-verified'}
            </p>
            <p className="text-xs text-gray-300 leading-snug">
              {es
                ? 'Cada reporte viene con coordenadas del usuario validadas dentro de 1km del puente. Cero reportes falsos de troles lejanos.'
                : 'Every report carries the user\'s coordinates, validated within 1km of the bridge. Zero noise from distant trolls.'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-800/50 rounded-2xl p-5">
            <Clock className="w-5 h-5 text-green-400 mb-2" />
            <p className="text-sm font-black text-white mb-1">
              {es ? 'Longitudinal 3+ años' : '3+ year longitudinal'}
            </p>
            <p className="text-xs text-gray-300 leading-snug">
              {es
                ? 'Retención política de 3+ años. La serie histórica crece con cada usuario que se inscribe, convirtiéndose en data de patrones que nadie puede recrear.'
                : '3+ year retention policy. Historical series grows with every new user, becoming pattern data nobody can recreate.'}
            </p>
          </div>
        </section>

        {/* Lead form */}
        <section className="bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-black mb-2">
            {es ? 'Solicita acceso al API' : 'Request API access'}
          </h2>
          <p className="text-sm text-blue-200 mb-6 leading-snug">
            {es
              ? 'Cuéntanos qué estás construyendo. Respondemos en 48h con un plan de acceso.'
              : "Tell us what you're building. We respond within 48h with an access plan."}
          </p>

          {done ? (
            <div className="bg-green-500/20 border border-green-400/40 rounded-2xl p-5 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-base font-black text-white">
                {es ? '¡Recibido!' : 'Got it!'}
              </p>
              <p className="text-sm text-green-200 mt-1">
                {es ? 'Te contactamos pronto.' : "We'll be in touch soon."}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  required
                  placeholder={es ? 'Correo *' : 'Email *'}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                <input
                  type="text"
                  placeholder={es ? 'Nombre' : 'Name'}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                <input
                  type="text"
                  placeholder={es ? 'Empresa' : 'Company'}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                <input
                  type="text"
                  placeholder={es ? 'Rol / puesto' : 'Role / title'}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
              <textarea
                placeholder={es ? 'Qué estás construyendo / qué datos necesitas' : 'What are you building / what data do you need'}
                value={form.useCase}
                onChange={(e) => setForm({ ...form, useCase: e.target.value })}
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <select
                value={form.estimatedVolume}
                onChange={(e) => setForm({ ...form, estimatedVolume: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <option value="" className="bg-gray-900">{es ? 'Volumen estimado (opcional)' : 'Estimated volume (optional)'}</option>
                <option value="research" className="bg-gray-900">{es ? 'Investigación / prototipo' : 'Research / prototype'}</option>
                <option value="small" className="bg-gray-900">{es ? '<100 queries/día' : '<100 queries/day'}</option>
                <option value="medium" className="bg-gray-900">{es ? '100-10k queries/día' : '100-10k queries/day'}</option>
                <option value="large" className="bg-gray-900">{es ? '10k+ queries/día' : '10k+ queries/day'}</option>
                <option value="full_feed" className="bg-gray-900">{es ? 'Feed completo' : 'Full data feed'}</option>
              </select>

              {error && (
                <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2 text-xs text-red-200">{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting || !form.email}
                className="w-full bg-white text-indigo-700 font-black py-3.5 rounded-2xl shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {submitting
                  ? (es ? 'Enviando…' : 'Sending…')
                  : (es ? 'Solicitar acceso →' : 'Request access →')}
              </button>
              <p className="text-[10px] text-center text-white/60">
                {es
                  ? 'Respondemos en 48h. No compartimos tu correo.'
                  : 'We respond within 48h. Your email stays private.'}
              </p>
            </form>
          )}
        </section>

        <footer className="mt-12 text-center text-[11px] text-gray-500">
          Cruzar · <Link href="/" className="hover:text-gray-300 underline underline-offset-2">cruzar.app</Link> ·{' '}
          <Link href="/privacy" className="hover:text-gray-300 underline underline-offset-2">privacy</Link>
        </footer>
      </div>
    </main>
  )
}
