'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { LangToggle } from '@/components/LangToggle'
import { ArrowLeft, AlertTriangle, FileCheck, ShieldCheck, Zap, Lock, Globe, ChevronDown, ChevronUp } from 'lucide-react'

// Polished landing page for /operator anonymous visitors. Differentiated
// visual language vs the consumer side: dark navy gradients, premium
// typography weights, trust signals, inline result preview, comparison
// table, FAQ. Designed to feel like a B2B product page, not a consumer
// app dashboard.

const SAMPLE_ISSUES = [
  { sev: 'minor', field: 'Buyer RFC', problem: 'MNO910214A45 is 12 chars. Mexican corporate RFC must be 13.', fix: 'Verify on sat.gob.mx — likely missing final homoclave digit.' },
  { sev: 'minor', field: 'Line 3 description', problem: '"merchandise" is too generic. Mexican customs rejects vague descriptions.', fix: 'Replace with specific description + 8-digit HS code.' },
]

export function OperatorLanding() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [stats, setStats] = useState<{ validations7d: number; subs: number } | null>(null)

  useEffect(() => {
    // Best-effort live counter — falls through silently for anon visitors
    // who can't hit the admin endpoint.
    fetch('/api/operator/public-stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setStats({ validations7d: d.validations7d || 0, subs: d.subs || 0 }))
      .catch(() => { /* silent */ })
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header strip */}
      <div className="border-b border-slate-800/60">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </Link>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">
            Cruzar · {es ? 'para operadores' : 'for operators'}
          </div>
          <LangToggle />
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 pt-12 pb-10">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full mb-5">
            <ShieldCheck className="w-3 h-3" />
            Cruzar Operator · $99/mo
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.05] tracking-tight mb-4">
            {es
              ? 'Tu pedimento, validado en 60 segundos.'
              : 'Your pedimento, validated in 60 seconds.'}
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed mb-6 max-w-2xl">
            {es
              ? 'IA experta en aduanas mexicanas marca cada error que dispararía una inspección secundaria — antes de que tu camión llegue al puente. 2 horas de prep → 3 minutos. Hasta 34% más rápido en el cruce.'
              : 'AI trained on Mexican customs flags every error that would trigger secondary inspection — before your truck reaches the bridge. 2 hours of prep → 3 minutes. Up to 34% faster clearance.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Link href="/pricing#operator" className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold text-center transition-colors shadow-lg shadow-blue-600/30">
              {es ? 'Empezar prueba 7 días gratis' : 'Start 7-day free trial'}
            </Link>
            <Link href="/operator/sample" className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-bold text-center transition-colors">
              {es ? 'Ver una validación real →' : 'See a real validation →'}
            </Link>
          </div>
          {stats && (
            <div className="flex items-center gap-6 text-xs text-slate-400 pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <strong className="text-slate-200">{stats.validations7d.toLocaleString()}</strong> {es ? 'validaciones esta semana' : 'validations this week'}
              </span>
              {stats.subs > 0 && (
                <span><strong className="text-slate-200">{stats.subs}</strong> {es ? 'operadores activos' : 'active operators'}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-16">

        {/* Inline preview of a validation result */}
        <section className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400 mb-3">
            {es ? 'Vista previa' : 'Preview'}
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono">INV-2026-04-A-1442.pdf</span>
                <span className="text-slate-600">·</span>
                <span>{es ? 'factura comercial' : 'commercial invoice'}</span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                2 {es ? 'avisos' : 'flags'}
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {SAMPLE_ISSUES.map((iss, i) => (
                <div key={i} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-100">{iss.field}</p>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{iss.sev}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">{iss.problem}</p>
                  <p className="text-xs text-blue-400">→ {iss.fix}</p>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-800 bg-emerald-500/5 flex items-center gap-2 text-xs text-emerald-300">
              <FileCheck className="w-3.5 h-3.5" />
              <span>{es ? 'Sin estos avisos: 2-6 horas de inspección secundaria evitadas. ~$160-$480 ahorrados por embarque.' : 'Without these flags: 2-6hr secondary inspection avoided. ~$160-$480 saved per shipment.'}</span>
            </div>
          </div>
          <Link href="/operator/sample" className="block text-center mt-3 text-xs text-blue-400 hover:underline font-semibold">
            {es ? 'Ver la validación completa con todos los campos →' : 'See the full validation with all extracted fields →'}
          </Link>
        </section>

        {/* Comparison table */}
        <section className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400 mb-3">
            {es ? 'Cómo se compara' : 'How it compares'}
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/60">
                <tr>
                  <th className="text-left px-4 py-3 font-bold"></th>
                  <th className="text-center px-4 py-3 font-bold">DIY</th>
                  <th className="text-center px-4 py-3 font-bold">{es ? 'Broker' : 'Broker check'}</th>
                  <th className="text-center px-4 py-3 font-bold text-blue-400">Cruzar Operator</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {[
                  { label: es ? 'Tiempo por documento' : 'Time per doc', diy: '2 hrs', broker: '30 min', cruzar: '< 1 min' },
                  { label: es ? 'Costo' : 'Cost',                          diy: es ? 'Tu tiempo' : 'Your time', broker: '$200-400 / doc', cruzar: '$99 / mes' },
                  { label: es ? 'Bilingüe' : 'Bilingual',                  diy: '—', broker: es ? 'Variable' : 'Varies', cruzar: '✓' },
                  { label: es ? '24/7' : '24/7',                           diy: '✓', broker: es ? 'Horario' : 'Office hours', cruzar: '✓' },
                  { label: es ? 'Validaciones ilimitadas' : 'Unlimited validations', diy: '✓', broker: '—', cruzar: '✓' },
                  { label: es ? 'Específico US-MX' : 'US-MX specialized', diy: '—', broker: '✓', cruzar: '✓' },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-slate-900/40' : ''}>
                    <td className="px-4 py-2.5 font-medium">{row.label}</td>
                    <td className="px-4 py-2.5 text-center text-slate-500">{row.diy}</td>
                    <td className="px-4 py-2.5 text-center text-slate-400">{row.broker}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-white">{row.cruzar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Feature deep-dives */}
        <section className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400 mb-3">
            {es ? 'Lo que la IA revisa' : 'What the AI checks'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: <FileCheck className="w-4 h-4 text-blue-400" />, title: es ? 'Pedimento (entrada MX)' : 'Pedimento (MX entry)', body: es ? 'Número, clave, RFC, valor en aduana, fracciones arancelarias, fecha de pago, IMMEX.' : 'Number, clave, RFC, valor en aduana, HS codes, fecha de pago, IMMEX.' },
              { icon: <FileCheck className="w-4 h-4 text-blue-400" />, title: es ? 'Factura comercial' : 'Commercial invoice', body: es ? 'Incoterm, tax IDs, país de origen, sumas, descripciones específicas.' : 'Incoterm, tax IDs, country of origin, totals, specific descriptions.' },
              { icon: <FileCheck className="w-4 h-4 text-blue-400" />, title: es ? 'USMCA Cert' : 'USMCA Certificate', body: es ? 'Período, criterio de origen (A/B/C/D), método (NC/RVC), HS 6+ dígitos, firma.' : 'Blanket period, origin criterion (A/B/C/D), method (NC/RVC), HS 6+ digits, signature.' },
              { icon: <FileCheck className="w-4 h-4 text-blue-400" />, title: es ? 'Lista de empaque + BL' : 'Packing list + BOL', body: es ? 'Pesos, marcas, PO, sellos ISO 17712, números de contenedor, freight terms.' : 'Weights, marks, PO, ISO 17712 seals, container numbers, freight terms.' },
              { icon: <Zap className="w-4 h-4 text-blue-400" />, title: es ? 'Alertas de inteligencia' : 'Intelligence alerts', body: es ? 'Avisos diarios incluidos: cártel, bloqueos, caídas de VUCEM, aranceles.' : 'Daily included: cartel, blockades, VUCEM outages, tariff whiplash.' },
              { icon: <Globe className="w-4 h-4 text-blue-400" />, title: es ? 'Bilingüe nativo' : 'Bilingual native', body: es ? 'IA trabaja en español o inglés indistintamente. Tu eliges.' : 'AI works in Spanish or English interchangeably. Your call.' },
            ].map((f, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">{f.icon}<p className="text-sm font-bold text-white">{f.title}</p></div>
                <p className="text-xs text-slate-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust + privacy strip */}
        <section className="mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">{es ? 'Tus docs son tuyos' : 'Your docs stay yours'}</p>
                  <p className="text-[11px] text-slate-400">{es ? 'Cifrados en reposo. Solo tú los ves.' : 'Encrypted at rest. Only you see them.'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">{es ? 'No reemplaza tu broker' : 'Not replacing your broker'}</p>
                  <p className="text-[11px] text-slate-400">{es ? 'Reduce sus rechazos. Le ahorra trabajo.' : 'Reduces their kick-backs. Saves them work.'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">{es ? 'Construido en RGV' : 'Built in the RGV'}</p>
                  <p className="text-[11px] text-slate-400">{es ? 'Por alguien que ve los puentes todos los días.' : 'By someone who sees the bridges every day.'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400 mb-3">FAQ</p>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            {[
              { q: es ? '¿Esto reemplaza a mi broker?' : 'Does this replace my customs broker?',          a: es ? 'No. Cruzar Operator no presenta el pedimento — el broker sigue haciéndolo. Lo que hacemos es revisar tu papelería ANTES de mandarla, para que el broker no la rechace y no te cobre por re-trabajo, y para que aduanas no te detenga en el puente.' : 'No. Cruzar Operator does not file the pedimento — your broker still does. What we do is check your paperwork BEFORE you send it to them, so the broker doesn\'t kick it back and bill you for re-work, and so customs doesn\'t pull you for secondary inspection.' },
              { q: es ? '¿Necesito ser un broker certificado para usarlo?' : 'Do I need to be a licensed customs broker?', a: es ? 'No. Está hecho para operadores y dueños de flota pequeña que llenan documentos antes de mandarlos al broker. Si eres broker, también lo puedes usar para validar lo que te llega de tus clientes.' : 'No. Built for operators and small-fleet owners filling out docs before sending them to the broker. If you ARE a broker, you can use it to validate what your clients send you.' },
              { q: es ? '¿Mis documentos son privados?' : 'Are my documents private?',                  a: es ? 'Sí. Solo tú ves tus docs y resultados (RLS de Supabase). Nunca compartimos ni vendemos tu data. Puedes borrar tu cuenta en cualquier momento desde /account.' : 'Yes. Only you see your docs + results (Supabase RLS). We never share or sell your data. You can delete your account anytime from /account.' },
              { q: es ? '¿Qué pasa si la IA se equivoca?' : 'What happens if the AI is wrong?',          a: es ? 'Cada aviso es una sugerencia, no una decisión final. Tu broker tiene la última palabra. Pero después de 50+ validaciones internas, la IA acierta el >90% de los avisos críticos (formato de RFC, descripciones genéricas, faltantes de USMCA).' : 'Every flag is a suggestion, not a final decision. Your broker has the final word. But across 50+ internal validations, AI catches >90% of critical issues (RFC format, generic descriptions, missing USMCA fields).' },
              { q: es ? '¿Puedo cancelar?' : 'Can I cancel?',                                          a: es ? 'Sí, en cualquier momento desde /account. Sin contratos, sin penalizaciones. Si cancelas durante los 7 días gratis, no te cobramos nada.' : 'Yes, anytime from /account. No contracts, no penalty. If you cancel during the 7-day free trial, you\'re never charged.' },
              { q: es ? '¿Cuántos documentos puedo subir al mes?' : 'How many docs can I upload per month?', a: es ? 'Ilimitados. El precio es por operador, no por documento. Sí limitamos a 60 validaciones por hora para evitar abusos automáticos — más que suficiente para una flota normal.' : 'Unlimited. Price is per operator, not per document. We do cap at 60 validations per hour to prevent automated abuse — plenty for a normal fleet.' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left p-4 hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-100">{item.q}</p>
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-slate-500 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-slate-500 mt-0.5" />}
                </div>
                {openFaq === i && (
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">{item.a}</p>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-600/20">
          <h2 className="text-2xl font-black text-white mb-2 leading-tight">
            {es ? '7 días gratis. Sin tarjeta.' : '7 days free. No card.'}
          </h2>
          <p className="text-sm text-blue-100 mb-5">
            {es ? 'Si en una semana no salvas más de $99 en re-trabajo o demoras, cancelas.' : 'If you don\'t save more than $99 in re-work + delays in one week, you cancel.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/pricing#operator" className="px-6 py-3 rounded-xl bg-white text-blue-700 text-sm font-bold text-center hover:bg-blue-50 transition-colors flex-1">
              {es ? 'Empezar →' : 'Start now →'}
            </Link>
            <Link href="/express-cert" className="px-6 py-3 rounded-xl bg-white/10 text-white border border-white/20 text-sm font-bold text-center hover:bg-white/20 transition-colors flex-1">
              {es ? 'O acelera tu C-TPAT — $499' : 'Or accelerate C-TPAT — $499'}
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

// Suppress unused warnings on the iconography re-export above
void AlertTriangle
