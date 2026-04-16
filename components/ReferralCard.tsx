'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Copy, Share2, Check, MessageCircle } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

interface ReferralData {
  referral_code: string | null
  completed_count: number
  earned_pro: boolean
  pro_active: boolean
  pro_until: string | null
}

const GOAL = 3

export function ReferralCard() {
  const { user, loading: authLoading } = useAuth()
  const { lang, t } = useLang()
  const es = lang === 'es'
  const [data, setData] = useState<ReferralData | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Fetch or generate referral code on mount
  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/referral')
        if (!res.ok) return
        const json = await res.json()

        if (!cancelled) {
          if (!json.referral_code) {
            // Auto-generate if they don't have one yet
            setGenerating(true)
            const genRes = await fetch('/api/referral', { method: 'POST' })
            if (genRes.ok) {
              const genJson = await genRes.json()
              setData({
                referral_code: genJson.referral_code,
                completed_count: 0,
                earned_pro: false,
                pro_active: false,
                pro_until: null,
              })
            }
            setGenerating(false)
          } else {
            setData(json)
          }
        }
      } catch {
        // Silent
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, authLoading])

  const shareUrl = data?.referral_code
    ? `https://cruzar.app/r/${data.referral_code}`
    : null

  const whatsappMessage = shareUrl ? t.referralWhatsAppMsg(shareUrl) : ''

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
    : null

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareUrl])

  const handleNativeShare = useCallback(async () => {
    if (!shareUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: es ? 'Cruzar — tiempos de frontera en vivo' : 'Cruzar — live border wait times',
          text: whatsappMessage,
          url: shareUrl,
        })
      } catch {
        // User cancelled or share failed — fallback to copy
        handleCopy()
      }
    } else {
      handleCopy()
    }
  }, [shareUrl, es, whatsappMessage, handleCopy])

  if (authLoading || !user) return null
  if (generating) return null
  if (!data?.referral_code) return null

  const progress = Math.min(data.completed_count, GOAL)
  const pct = Math.max(4, (progress / GOAL) * 100)
  const remaining = Math.max(0, GOAL - progress)

  return (
    <div className="mt-3 bg-gradient-to-br from-violet-900/30 via-indigo-900/30 to-blue-900/30 border-2 border-violet-500/30 rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-violet-400">
            {t.referralTitle}
          </p>
          <p className="text-sm font-black text-gray-100 leading-tight">
            {t.referralSubtitle}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-gray-300">
            {t.referralProgress(progress)}
          </span>
          {data.pro_active && (
            <span className="text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
              {t.referralProActive}
            </span>
          )}
          {data.earned_pro && !data.pro_active && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
              {t.referralProEarned}
            </span>
          )}
        </div>
        <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 font-medium leading-snug">
          {data.earned_pro
            ? t.referralEarnedMsg
            : remaining === 1
              ? t.referralOneMore
              : t.referralNMore(remaining)}
        </p>
      </div>

      {/* Share link */}
      <div className="mt-3 bg-white/5 rounded-xl p-3 border border-white/10">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
          {t.referralYourLink}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-black/30 rounded-lg px-3 py-2 text-[12px] text-violet-300 font-mono truncate select-all">
            cruzar.app/r/{data.referral_code}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center active:scale-95 transition-all"
            title={t.referralCopy}
          >
            {copied
              ? <Check className="w-4 h-4 text-white" />
              : <Copy className="w-4 h-4 text-white" />}
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center active:scale-95 transition-all"
            title={t.referralShare}
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* WhatsApp share */}
      <a
        href={whatsappUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-3 rounded-xl active:scale-[0.98] transition-all"
      >
        <MessageCircle className="w-4 h-4" />
        {t.referralWhatsApp}
      </a>

      {/* Pre-formatted WhatsApp message preview */}
      <div className="mt-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
          {t.referralMsgPreview}
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed italic">
          &ldquo;{whatsappMessage}&rdquo;
        </p>
      </div>
    </div>
  )
}
