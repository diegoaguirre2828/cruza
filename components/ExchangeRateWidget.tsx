'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

interface CommunityRate {
  house_name: string
  sell_rate: number
  city: string | null
  reported_at: string
}

interface ExchangeData {
  rate: number | null
  updatedAt: string | null
  communityRates: CommunityRate[]
  communityAvgSell: number | null
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export function ExchangeRateWidget() {
  const { lang } = useLang()
  const [data, setData] = useState<ExchangeData>({ rate: null, updatedAt: null, communityRates: [], communityAvgSell: null })
  const [loading, setLoading] = useState(true)
  const [usd, setUsd] = useState('')
  const [showCommunity, setShowCommunity] = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [houseName, setHouseName] = useState('')
  const [reportedSellRate, setReportedSellRate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch('/api/exchange')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const displayRate = data.communityAvgSell ?? data.rate
  const converted = displayRate && usd !== '' ? (parseFloat(usd) * displayRate).toFixed(2) : null

  async function submitRate() {
    if (!houseName.trim() || !reportedSellRate) return
    setSubmitting(true)
    await fetch('/api/exchange/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ house_name: houseName, sell_rate: reportedSellRate }),
    })
    setSubmitting(false)
    setSubmitted(true)
    setShowReportForm(false)
    setHouseName('')
    setReportedSellRate('')
    // Refresh data
    fetch('/api/exchange').then(r => r.json()).then(d => setData(d))
  }

  if (loading) return null

  const t = {
    todayRate: lang === 'es' ? 'Tipo de cambio hoy' : 'Exchange rate today',
    midMarket: lang === 'es' ? 'tasa interbancaria' : 'mid-market rate',
    communityLabel: lang === 'es' ? 'Tasas reportadas por la comunidad' : 'Community-reported rates',
    avgSell: lang === 'es' ? 'Promedio real:' : 'Real avg:',
    reportRate: lang === 'es' ? '+ Reportar tasa real' : '+ Report real rate',
    housePlaceholder: lang === 'es' ? 'Nombre de la casa de cambio' : 'Exchange house name',
    ratePlaceholder: lang === 'es' ? 'Tasa de venta (MXN por $1 USD)' : 'Sell rate (MXN per $1 USD)',
    submit: lang === 'es' ? 'Enviar' : 'Submit',
    cancel: lang === 'es' ? 'Cancelar' : 'Cancel',
    thanks: lang === 'es' ? '¡Gracias! +3 pts' : 'Thanks! +3 pts',
    noRates: lang === 'es' ? 'Sin reportes recientes.' : 'No recent reports.',
    hideRates: lang === 'es' ? 'Ocultar' : 'Hide',
    showRates: lang === 'es' ? `Ver tasas reales (${data.communityRates.length})` : `Real rates (${data.communityRates.length})`,
    servicesLink: lang === 'es' ? 'Servicios en MX →' : 'Popular services in MX →',
    youGet: lang === 'es' ? 'Recibes' : 'You get',
    usingCommunity: lang === 'es' ? 'Usando tasa real reportada' : 'Using community-reported rate',
    usingOfficial: lang === 'es' ? 'Tasa interbancaria (puede ser menor al cambiar)' : 'Mid-market rate (actual may be lower)',
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 mb-4 shadow-sm">
      {/* Rate row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">💱</span>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.todayRate}</p>
            {displayRate ? (
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                $1 USD = <span className="text-green-600 dark:text-green-400">${displayRate.toFixed(2)} MXN</span>
                {data.communityAvgSell && (
                  <span className="ml-1.5 text-[10px] font-normal bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                    {lang === 'es' ? 'real' : 'real'}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {lang === 'es' ? 'No disponible' : 'Unavailable'}
              </p>
            )}
            {displayRate && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {data.communityAvgSell ? t.usingCommunity : t.usingOfficial}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/services"
          className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline flex-shrink-0 ml-3"
        >
          {t.servicesLink}
        </Link>
      </div>

      {/* Converter */}
      {displayRate && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 gap-1.5">
            <span className="text-xs font-semibold text-gray-400">$</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={usd}
              onChange={e => setUsd(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-gray-100 outline-none w-0"
            />
            <span className="text-xs font-bold text-gray-400">USD</span>
          </div>
          <span className="text-gray-400 text-sm">=</span>
          <div className="flex-1 flex items-center bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2 justify-between">
            <span className="text-sm font-bold text-green-700 dark:text-green-400">
              {converted ? `$${parseFloat(converted).toLocaleString()}` : '—'}
            </span>
            <span className="text-xs font-bold text-green-500">MXN</span>
          </div>
        </div>
      )}

      {/* Community rates section */}
      <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowCommunity(v => !v)}
            className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            {showCommunity ? t.hideRates : t.showRates}
          </button>
          {submitted ? (
            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">{t.thanks}</span>
          ) : (
            <button
              onClick={() => setShowReportForm(v => !v)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            >
              {t.reportRate}
            </button>
          )}
        </div>

        {/* Report form */}
        {showReportForm && !submitted && (
          <div className="mt-2 flex flex-col gap-2">
            <input
              type="text"
              placeholder={t.housePlaceholder}
              value={houseName}
              onChange={e => setHouseName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 gap-1.5">
                <input
                  type="number"
                  placeholder={t.ratePlaceholder}
                  value={reportedSellRate}
                  onChange={e => setReportedSellRate(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none w-0"
                />
                <span className="text-xs font-bold text-gray-400">MXN</span>
              </div>
              <button
                onClick={submitRate}
                disabled={submitting || !houseName.trim() || !reportedSellRate}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {submitting ? '…' : t.submit}
              </button>
              <button
                onClick={() => setShowReportForm(false)}
                className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Community rates list */}
        {showCommunity && (
          <div className="mt-2 space-y-1.5">
            {data.communityRates.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">{t.noRates}</p>
            ) : (
              data.communityRates.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-1.5">
                  <div>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{r.house_name}</span>
                    {r.city && <span className="text-[10px] text-gray-400 ml-1">{r.city}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">${Number(r.sell_rate).toFixed(2)}</span>
                    <span className="block text-[10px] text-gray-400">{timeAgo(r.reported_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
