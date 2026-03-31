'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  {
    id: 'auto',
    emoji: '🔧',
    en: 'Auto Repair',
    es: 'Talleres Mecánicos',
    descEn: 'Body shops, mechanics, tires, oil changes — often 50–70% cheaper than the US.',
    descEs: 'Hojalatería, mecánicos, llantas, cambios de aceite — hasta 70% más barato que en EE.UU.',
    color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
  },
  {
    id: 'dental',
    emoji: '🦷',
    en: 'Dental',
    es: 'Dental',
    descEn: 'Cleanings, fillings, crowns, implants. Same quality, fraction of the price.',
    descEs: 'Limpiezas, empastes, coronas, implantes. Misma calidad, mucho menor precio.',
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
  },
  {
    id: 'medical',
    emoji: '🏥',
    en: 'Medical & Clinics',
    es: 'Médicos y Clínicas',
    descEn: 'General practitioners, specialists, labs, and urgent care at accessible prices.',
    descEs: 'Médicos generales, especialistas, laboratorios y urgencias a precios accesibles.',
    color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
  },
  {
    id: 'pharmacy',
    emoji: '💊',
    en: 'Pharmacy',
    es: 'Farmacias',
    descEn: 'Many medications available without a prescription and at a lower cost.',
    descEs: 'Muchos medicamentos disponibles sin receta y a menor costo.',
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
  },
  {
    id: 'vision',
    emoji: '👁️',
    en: 'Vision & Optical',
    es: 'Ópticas',
    descEn: 'Eye exams, glasses, contact lenses — quality frames at a fraction of US prices.',
    descEs: 'Exámenes visuales, lentes, anteojos — armazones de calidad a precios accesibles.',
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
  },
  {
    id: 'beauty',
    emoji: '💇',
    en: 'Hair & Beauty',
    es: 'Estética y Belleza',
    descEn: 'Salons, barbershops, spas, nails. Popular destination for daily crossers.',
    descEs: 'Salones, barberías, spas, uñas. Destino popular para cruzantes frecuentes.',
    color: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
    iconBg: 'bg-pink-100 dark:bg-pink-900/40',
  },
  {
    id: 'food',
    emoji: '🌮',
    en: 'Restaurants & Food',
    es: 'Restaurantes y Comida',
    descEn: 'Authentic Mexican food, tacos, birria, seafood — the real thing.',
    descEs: 'Comida mexicana auténtica, tacos, birria, mariscos — lo verdadero.',
    color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
  },
  {
    id: 'insurance',
    emoji: '🛡️',
    en: 'Mexico Auto Insurance',
    es: 'Seguro de Auto para México',
    descEn: 'Required by law to drive in Mexico. Get covered before you cross.',
    descEs: 'Obligatorio por ley para manejar en México. Asegúrate antes de cruzar.',
    color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    link: '/insurance',
  },
]

const TIPS = {
  en: [
    '🚗 Mexican auto insurance is legally required — get covered before you cross.',
    '💵 Bring cash (pesos or USD) — many small shops don\'t accept US cards.',
    '🪪 Always carry your passport or passport card.',
    '📋 Keep your vehicle title if driving across — CBP may ask.',
    '⏰ Aim for mid-morning on weekdays to avoid long return waits.',
  ],
  es: [
    '🚗 El seguro de auto para México es obligatorio — asegúrate antes de cruzar.',
    '💵 Lleva efectivo (pesos o dólares) — muchos negocios no aceptan tarjetas.',
    '🪪 Siempre lleva tu pasaporte o tarjeta de pasaporte.',
    '📋 Lleva el título de tu vehículo si cruzas en auto.',
    '⏰ Entre semana por la mañana suele tener menor tiempo de espera al regresar.',
  ],
}

export default function ServicesPage() {
  const { lang } = useLang()
  const [showListForm, setShowListForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '', category: 'auto', city: '', address: '',
    phone: '', website: '', description: '', email: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        side: 'mexico',
        source: 'services_page',
      }),
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Header */}
        <div className="pt-6 pb-2">
          <Link href="/guide" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3 transition-colors">
            <ArrowLeft className="w-3 h-3" />
            {lang === 'es' ? 'Guía fronteriza' : 'Border Guide'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {lang === 'es' ? '🇲🇽 Servicios en México' : '🇲🇽 Cross for Services'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'es'
              ? 'Aprovecha tu cruce — servicios de calidad a precios accesibles del otro lado.'
              : 'Make your crossing count — quality services at a fraction of US prices, just across the bridge.'}
          </p>
        </div>

        {/* Insurance urgent banner */}
        <Link href="/insurance" className="flex items-center gap-3 bg-indigo-600 dark:bg-indigo-700 rounded-2xl px-4 py-3.5 mt-4 mb-5 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors">
          <span className="text-2xl">🛡️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">
              {lang === 'es' ? '¿Llevas seguro para México?' : 'Do you have Mexico auto insurance?'}
            </p>
            <p className="text-xs text-indigo-200">
              {lang === 'es' ? 'Es obligatorio por ley. Evita multas — asegúrate antes de cruzar.' : 'It\'s required by law. Avoid fines — get covered before you cross.'}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-indigo-200 flex-shrink-0" />
        </Link>

        {/* Categories grid */}
        <div className="space-y-3 mb-6">
          {CATEGORIES.filter(c => c.id !== 'insurance').map(cat => (
            <div key={cat.id} className={`rounded-2xl border p-4 ${cat.color}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${cat.iconBg}`}>
                  {cat.emoji}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {lang === 'es' ? cat.es : cat.en}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {lang === 'es' ? cat.descEs : cat.descEn}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Crossing tips */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {lang === 'es' ? '💡 Consejos para cruzar' : '💡 Tips before you cross'}
          </h2>
          <ul className="space-y-2">
            {TIPS[lang].map((tip, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tip}</li>
            ))}
          </ul>
        </div>

        {/* List your business CTA */}
        {!showListForm && !submitted && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-4">
            <h2 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1">
              {lang === 'es' ? '¿Tienes un negocio en México?' : 'Do you own a business in Mexico?'}
            </h2>
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
              {lang === 'es'
                ? 'Llega a miles de cruzantes que buscan exactamente lo que ofreces. Listado gratuito, sin compromisos.'
                : 'Reach thousands of crossers actively looking for services like yours. Free listing, no commitment.'}
            </p>
            <button
              onClick={() => setShowListForm(true)}
              className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl transition-colors"
            >
              {lang === 'es' ? 'Listar mi negocio gratis →' : 'List my business free →'}
            </button>
          </div>
        )}

        {/* Business listing form */}
        {showListForm && !submitted && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">
              {lang === 'es' ? 'Listar mi negocio' : 'List my business'}
            </h2>
            <div className="space-y-3">
              <input
                required
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder={lang === 'es' ? 'Nombre del negocio *' : 'Business name *'}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={formData.category}
                onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.filter(c => c.id !== 'insurance').map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {lang === 'es' ? c.es : c.en}</option>
                ))}
              </select>
              <input
                required
                value={formData.city}
                onChange={e => setFormData(f => ({ ...f, city: e.target.value }))}
                placeholder={lang === 'es' ? 'Ciudad (ej. Reynosa, Matamoros) *' : 'City (e.g. Reynosa, Matamoros) *'}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={formData.address}
                onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                placeholder={lang === 'es' ? 'Dirección (opcional)' : 'Address (optional)'}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={formData.phone}
                onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                placeholder={lang === 'es' ? 'Teléfono / WhatsApp (opcional)' : 'Phone / WhatsApp (optional)'}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder={lang === 'es' ? 'Descripción breve (opcional)' : 'Short description (optional)'}
                rows={2}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <input
                required
                type="email"
                value={formData.email}
                onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                placeholder={lang === 'es' ? 'Tu correo electrónico *' : 'Your email *'}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowListForm(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors"
              >
                {submitting ? '...' : lang === 'es' ? 'Enviar' : 'Submit'}
              </button>
            </div>
          </form>
        )}

        {submitted && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 text-center mb-4">
            <p className="text-sm font-bold text-green-800 dark:text-green-300">
              {lang === 'es' ? '✅ ¡Recibido!' : '✅ Got it!'}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {lang === 'es'
                ? 'Revisaremos tu negocio y lo publicaremos pronto. Te avisamos por correo.'
                : "We'll review your business and get it listed soon. We'll email you when it's live."}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
