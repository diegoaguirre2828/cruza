'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, MapPin, Users, TrendingUp } from 'lucide-react'

export default function AdvertisePage() {
  const [form, setForm] = useState({ businessName: '', phone: '', email: '', crossing: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const CROSSINGS = [
    'McAllen / Hidalgo', 'Progreso', 'Donna', 'Rio Grande City', 'Roma',
    'Brownsville', 'Laredo', 'Eagle Pass', 'Del Rio', 'El Paso',
    'Nogales, AZ', 'San Diego / Tijuana', 'Other',
  ]

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
          <h2 className="text-xl font-bold text-gray-900">Got it — we'll be in touch!</h2>
          <p className="text-gray-600 mt-2 text-sm">
            We'll call or text you within 24 hours to talk about getting your business in front of border crossers.
          </p>
          <p className="text-gray-500 mt-1 text-xs">No commitment required.</p>
          <Link href="/" className="inline-block mt-6 bg-gray-900 text-white font-medium px-6 py-2.5 rounded-xl text-sm hover:bg-gray-700 transition-colors">
            Back to Cruza
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
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Advertise on Cruza</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Reach people waiting at the border — right when they have time to browse and need something nearby.
          </p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <Users className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">1,000+</p>
            <p className="text-xs text-gray-500">daily users</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <MapPin className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">Local</p>
            <p className="text-xs text-gray-500">targeted ads</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">$49+</p>
            <p className="text-xs text-gray-500">starting/mo</p>
          </div>
        </div>

        {/* Who it's for */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-900 mb-2">Perfect for businesses near the border:</p>
          <div className="grid grid-cols-2 gap-1">
            {['Insurance agencies', 'Money exchange', 'Restaurants & food', 'Tire & auto shops', 'Tramites & notary', 'Hotels & motels', 'Pharmacies', 'Freight brokers'].map(b => (
              <div key={b} className="flex items-center gap-1.5 text-xs text-amber-800">
                <Check className="w-3 h-3 text-amber-500 flex-shrink-0" /> {b}
              </div>
            ))}
          </div>
        </div>

        {/* Simple contact form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">Let's talk — no commitment</h2>
          <p className="text-xs text-gray-500 mb-4">Leave your info and we'll reach out to find the right fit for your business.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Business name *</label>
              <input
                required
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. La Frontera Insurance"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="you@business.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nearest crossing *</label>
              <select
                required
                value={form.crossing}
                onChange={e => setForm(f => ({ ...f, crossing: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select a crossing...</option>
                {CROSSINGS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-white font-semibold py-3 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Get in touch →'}
            </button>
            <p className="text-xs text-gray-400 text-center">We'll reach out within 24 hours. No pressure, no commitment.</p>
          </form>
        </div>
      </div>
    </main>
  )
}
