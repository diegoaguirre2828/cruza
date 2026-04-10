'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, MapPin, Users, TrendingUp } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

export default function AdvertisePage() {
  const { lang } = useLang()
  const [form, setForm] = useState({ businessName: '', phone: '', email: '', crossing: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const CROSSINGS = [
    'McAllen / Hidalgo', 'Progreso', 'Donna', 'Rio Grande City', 'Roma',
    'Brownsville', 'Laredo', 'Eagle Pass', 'Del Rio', 'El Paso',
    'Nogales, AZ', 'San Diego / Tijuana',
    lang === 'es' ? 'Otro' : 'Other',
  ]

  const t = {
    back: lang === 'es' ? 'Regresar' : 'Back',
    successTitle: lang === 'es' ? '¡Recibido — te contactamos pronto!' : 'Got it — we\'ll be in touch!',
    successDesc: lang === 'es'
      ? 'Te llamamos o mandamos mensaje en menos de 24 horas para platicar cómo anunciar tu negocio con los que cruzan la frontera.'
      : 'We\'ll call or text you within 24 hours to talk about getting your business in front of border crossers.',
    noCommitment: lang === 'es' ? 'Sin compromiso.' : 'No commitment required.',
    backToApp: lang === 'es' ? 'Volver a Cruzar' : 'Back to Cruzar',
    title: lang === 'es' ? 'Anúnciate en Cruzar' : 'Advertise on Cruzar',
    subtitle: lang === 'es'
      ? 'Llega a personas esperando en la frontera — justo cuando tienen tiempo y necesitan algo cerca.'
      : 'Reach people waiting at the border — right when they have time to browse and need something nearby.',
    dailyUsers: lang === 'es' ? 'usuarios diarios' : 'daily users',
    local: lang === 'es' ? 'Anuncios locales' : 'Local',
    localSub: lang === 'es' ? 'segmentados' : 'targeted ads',
    startingAt: lang === 'es' ? 'desde/mes' : 'starting/mo',
    perfectFor: lang === 'es' ? 'Perfecto para negocios cerca de la frontera:' : 'Perfect for businesses near the border:',
    businesses: lang === 'es'
      ? ['Agencias de seguros', 'Casas de cambio', 'Restaurantes y comida', 'Llantas y talleres', 'Trámites y notaría', 'Hoteles y moteles', 'Farmacias', 'Brokers de carga']
      : ['Insurance agencies', 'Money exchange', 'Restaurants & food', 'Tire & auto shops', 'Tramites & notary', 'Hotels & motels', 'Pharmacies', 'Freight brokers'],
    formTitle: lang === 'es' ? 'Platicamos — sin compromiso' : 'Let\'s talk — no commitment',
    formDesc: lang === 'es'
      ? 'Déjanos tus datos y te contactamos para encontrar la mejor opción para tu negocio.'
      : 'Leave your info and we\'ll reach out to find the right fit for your business.',
    bizName: lang === 'es' ? 'Nombre del negocio *' : 'Business name *',
    bizPlaceholder: lang === 'es' ? 'ej. La Frontera Insurance' : 'e.g. La Frontera Insurance',
    phone: lang === 'es' ? 'Teléfono *' : 'Phone *',
    email: lang === 'es' ? 'Correo electrónico' : 'Email',
    emailPlaceholder: lang === 'es' ? 'tu@negocio.com' : 'you@business.com',
    crossing: lang === 'es' ? 'Puente más cercano *' : 'Nearest crossing *',
    crossingPlaceholder: lang === 'es' ? 'Selecciona un puente...' : 'Select a crossing...',
    submit: lang === 'es' ? 'Contáctame →' : 'Get in touch →',
    sending: lang === 'es' ? 'Enviando...' : 'Sending...',
    footer: lang === 'es'
      ? 'Te respondemos en menos de 24 horas. Sin presión ni compromiso.'
      : 'We\'ll reach out within 24 hours. No pressure, no commitment.',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/advertise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: form.businessName, email: form.email, phone: form.phone, nearestCrossing: form.crossing }),
    })
    if (res.ok) setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t.successTitle}</h2>
          <p className="text-gray-600 mt-2 text-sm">{t.successDesc}</p>
          <p className="text-gray-500 mt-1 text-xs">{t.noCommitment}</p>
          <Link href="/" className="inline-block mt-6 bg-gray-900 text-white font-medium px-6 py-2.5 rounded-xl text-sm hover:bg-gray-700 transition-colors">
            {t.backToApp}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> {t.back}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-600 mt-1 text-sm">{t.subtitle}</p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <Users className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">1,000+</p>
            <p className="text-xs text-gray-500">{t.dailyUsers}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <MapPin className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{t.local}</p>
            <p className="text-xs text-gray-500">{t.localSub}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">$49+</p>
            <p className="text-xs text-gray-500">{t.startingAt}</p>
          </div>
        </div>

        {/* Who it's for */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-900 mb-2">{t.perfectFor}</p>
          <div className="grid grid-cols-2 gap-1">
            {t.businesses.map(b => (
              <div key={b} className="flex items-center gap-1.5 text-xs text-amber-800">
                <Check className="w-3 h-3 text-amber-500 flex-shrink-0" /> {b}
              </div>
            ))}
          </div>
        </div>

        {/* Simple contact form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">{t.formTitle}</h2>
          <p className="text-xs text-gray-500 mb-4">{t.formDesc}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t.bizName}</label>
              <input
                required
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder={t.bizPlaceholder}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t.phone}</label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="(956) 555-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t.email}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder={t.emailPlaceholder}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t.crossing}</label>
              <select
                required
                value={form.crossing}
                onChange={e => setForm(f => ({ ...f, crossing: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">{t.crossingPlaceholder}</option>
                {CROSSINGS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-white font-semibold py-3 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {loading ? t.sending : t.submit}
            </button>
            <p className="text-xs text-gray-400 text-center">{t.footer}</p>
          </form>
        </div>
      </div>
    </main>
  )
}
