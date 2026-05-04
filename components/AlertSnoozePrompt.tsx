'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Sticky prompt that surfaces on /port/[id] when the user lands there
// from a wait-drop alert push. iOS Web Push silently drops action
// buttons (Apple's limitation, not ours), so we can't deliver
// "Ya crucé" as an inline notification action for iOS PWAs. Instead,
// the cron-composed push URL carries `?just_crossed=<alert_id>`. When
// the user taps the push, the page opens with that param, this
// component detects it, and shows a one-tap card to confirm + snooze.
//
// On confirmation: POST /api/alerts/[id]/snooze (same endpoint the
// notification action used) → sets snoozed_until ~16h forward + writes
// a closure block to the Cruzar Crossing. The page strips the param
// after the user acts so it doesn't re-show on refresh.
//
// Distinct from the existing JustCrossedPrompt component (which is the
// post-crossing report-submission flow). This one is the alert snooze
// confirmation only.

export function AlertSnoozePrompt() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { lang } = useLang()
  const es = lang === 'es'

  const alertId = searchParams.get('just_crossed')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'snoozed' | 'kept' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function clearParam() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('just_crossed')
    const next = params.toString() ? `${pathname}?${params}` : pathname
    router.replace(next, { scroll: false })
  }

  async function handleSnooze() {
    if (!alertId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/alerts/${alertId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_button_ya_cruce' }),
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setDone('snoozed')
      setTimeout(clearParam, 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeep() {
    setDone('kept')
    setTimeout(clearParam, 1200)
  }

  useEffect(() => {
    if (!alertId) setDone(null)
  }, [alertId])

  if (!alertId) return null

  if (done === 'snoozed') {
    return (
      <div
        className="fixed left-3 right-3 z-40 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-2xl"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <p className="text-sm font-bold">
          {es ? '✅ Listo — alerta apagada hasta mañana' : '✅ Done — alert off until tomorrow'}
        </p>
        <p className="text-[11px] text-emerald-100 mt-0.5 leading-snug">
          {es ? 'Si quieres reactivarla antes, ve a Mi panel.' : 'To turn it back on sooner, head to Dashboard.'}
        </p>
      </div>
    )
  }

  if (done === 'kept') {
    return (
      <div
        className="fixed left-3 right-3 z-40 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <p className="text-sm font-bold">
          {es ? 'Sigue avisándote — perfecto' : 'Still alerting — got it'}
        </p>
      </div>
    )
  }

  return (
    <div
      className="fixed left-3 right-3 z-40 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl overflow-hidden"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      role="dialog"
    >
      <div className="p-4">
        <p className="text-sm font-black leading-tight">
          {es ? '¿Ya cruzaste?' : 'Already crossed?'}
        </p>
        <p className="text-[11px] text-blue-100 mt-0.5 leading-snug">
          {es
            ? 'Apaga la alerta hasta mañana — o que siga avisándote si todavía no.'
            : "Mute the alert until tomorrow — or keep it on if you haven't crossed yet."}
        </p>
        {error && (
          <p className="mt-2 text-[11px] text-red-200 bg-red-900/30 rounded px-2 py-1">{error}</p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSnooze}
            disabled={submitting}
            className="flex-1 bg-white text-indigo-700 text-sm font-black py-2.5 rounded-xl shadow-lg active:scale-[0.98] disabled:opacity-60 transition-transform"
          >
            {submitting
              ? (es ? 'Apagando…' : 'Muting…')
              : (es ? 'Sí, apaga la alerta' : 'Yes, mute it')}
          </button>
          <button
            type="button"
            onClick={handleKeep}
            disabled={submitting}
            className="px-4 bg-white/15 hover:bg-white/25 text-white text-sm font-bold rounded-xl border border-white/25 disabled:opacity-50 transition-colors"
          >
            {es ? 'Aún no' : 'Not yet'}
          </button>
        </div>
      </div>
    </div>
  )
}
