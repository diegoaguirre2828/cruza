'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { Check, ArrowLeft } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    color: 'border-gray-200',
    badge: null,
    desc: 'Everything you need to stop guessing and start crossing smarter. No credit card. No catch.',
    features: [
      'Live wait times — all 52 crossings',
      'Interactive map with color-coded wait levels',
      'Filter by city or region',
      'Crowdsourced driver reports',
      'Save your favorite crossings',
      'No ads when signed in',
    ],
    cta: 'Get Started Free',
    href: '/signup',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$2.99',
    period: '/month',
    color: 'border-blue-500',
    badge: 'Most Popular',
    desc: 'For daily commuters who can\'t afford to guess. Get notified the moment your crossing clears up.',
    features: [
      'Everything in Free',
      'AI wait time predictions by day & hour',
      'Custom alerts — get notified when wait drops below your threshold',
      'Full route optimizer — find the fastest crossing right now',
      'Unlimited saved crossings',
      '7-day free trial, cancel anytime',
    ],
    cta: 'Start Free Trial',
    tier: 'pro',
  },
  {
    id: 'business',
    name: 'Business',
    price: '$49',
    period: '/month',
    color: 'border-gray-900',
    badge: 'For Freight & Logistics',
    desc: 'Built for operators moving freight across the border daily. Save hours, cut fuel costs, keep your fleet moving.',
    features: [
      'Everything in Pro',
      'Fleet manager panel — track multiple drivers at once',
      'Commercial & FAST lane focus',
      'Historical CSV data exports',
      'API access for your own systems',
      '90-day trend analysis',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    tier: 'business',
  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const { tier: currentTier } = useTier()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planTier: string) {
    if (!user) {
      window.location.href = '/signup'
      return
    }
    setLoading(planTier)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: planTier }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> Back to map
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h1>
          <p className="text-gray-500 mt-2">Start free. Upgrade when you need more.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isCurrent = currentTier === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-6 shadow-sm relative flex flex-col ${plan.color}`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    plan.id === 'pro' ? 'bg-blue-500 text-white' : 'bg-gray-900 text-white'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{plan.desc}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-500">
                    Current Plan
                  </div>
                ) : plan.href ? (
                  <Link
                    href={plan.href}
                    className="w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier!)}
                    disabled={loading === plan.tier}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                      plan.id === 'pro'
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-900 text-white hover:bg-gray-700'
                    }`}
                  >
                    {loading === plan.tier ? 'Redirecting...' : plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Business advertise CTA */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <h3 className="font-bold text-gray-900 text-lg">Own a local business near the border?</h3>
          <p className="text-gray-600 text-sm mt-1">
            Advertise to thousands of daily cross-border commuters. Starting at $49/month.
          </p>
          <Link
            href="/advertise"
            className="inline-block mt-4 bg-amber-500 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-amber-600 transition-colors text-sm"
          >
            Advertise Your Business →
          </Link>
        </div>
      </div>
    </main>
  )
}
