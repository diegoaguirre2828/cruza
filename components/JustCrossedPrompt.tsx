'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

interface Props {
  portId: string
  portName: string
  onSubmitted: () => void
  forceShow?: boolean
  onDismiss?: () => void
}

export function JustCrossedPrompt({ portId, portName, onSubmitted, forceShow, onDismiss }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<'ask' | 'time' | 'done'>('ask')
  const [actualMinutes, setActualMinutes] = useState('')
  const [condition, setCondition] = useState('')
  const [laneType, setLaneType] = useState<string>('vehicle')
  const [submitting, setSubmitting] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)

  useEffect(() => {
    if (forceShow) { setShow(true); return }
    const key = `crossed_${portId}_${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) return
    // Was 45s — we need reports badly, so push the prompt sooner.
    const timer = setTimeout(() => setShow(true), 8000)
    return () => clearTimeout(timer)
  }, [portId, forceShow])

  async function submit() {
    if (!condition) return
    setSubmitting(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portId,
        condition,
        laneType,
        waitMinutes: actualMinutes ? parseInt(actualMinutes, 10) : null,
        ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null,
      }),
    })
    const data = await res.json()
    setPointsEarned(data.pointsEarned || 0)
    sessionStorage.setItem(`crossed_${portId}_${new Date().toDateString()}`, '1')
    setStep('done')
    setSubmitting(false)
    setTimeout(() => { setShow(false); onSubmitted() }, 2500)
  }

  function dismiss() {
    sessionStorage.setItem(`crossed_${portId}_${new Date().toDateString()}`, 'dismissed')
    setShow(false)
    onDismiss?.()
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-x-0 px-3 z-50 flex justify-center animate-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl border-2 border-blue-500 dark:border-blue-600 shadow-2xl p-5 ring-4 ring-blue-500/10">
        {step === 'ask' && (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight">
                  {es ? `¿Cruzaste ${portName}?` : `Just crossed ${portName}?`}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  {es ? 'Dinos cómo estuvo · +puntos' : 'Tell us how it went · +points'}
                </p>
              </div>
              <button
                onClick={dismiss}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none ml-2 px-1"
                aria-label="Dismiss"
              >×</button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { value: 'fast',   emoji: '🟢', label: es ? 'Rápido' : 'Fast' },
                { value: 'normal', emoji: '🟡', label: 'Normal' },
                { value: 'slow',   emoji: '🔴', label: es ? 'Lento' : 'Slow' },
              ].map(r => (
                <button
                  key={r.value}
                  onClick={() => setCondition(r.value)}
                  className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                    condition === r.value
                      ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span className="text-3xl">{r.emoji}</span>
                  <span className={`text-sm font-bold ${condition === r.value ? 'text-white dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>{r.label}</span>
                </button>
              ))}
            </div>

            {/* How did you cross — lane type */}
            <p className="text-[11px] uppercase tracking-wide font-bold text-gray-400 mb-1.5">
              {es ? '¿Cómo cruzaste?' : 'How did you cross?'}
            </p>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {[
                { value: 'vehicle',    emoji: '🚗', label: es ? 'Auto' : 'Car' },
                { value: 'sentri',     emoji: '⚡',  label: 'SENTRI' },
                { value: 'pedestrian', emoji: '🚶', label: es ? 'A pie' : 'Walk' },
                { value: 'commercial', emoji: '🚛', label: es ? 'Camión' : 'Truck' },
              ].map(l => (
                <button
                  key={l.value}
                  onClick={() => setLaneType(l.value)}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border transition-all active:scale-95 ${
                    laneType === l.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span className="text-xl">{l.emoji}</span>
                  <span className={`text-[10px] font-semibold ${laneType === l.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>{l.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                inputMode="numeric"
                value={actualMinutes}
                onChange={e => setActualMinutes(e.target.value)}
                placeholder={es ? 'Minutos de espera' : 'Wait in minutes'}
                min={1} max={300}
                className="flex-1 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-2xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {user && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-3 text-center font-bold">
                +{actualMinutes ? '10' : '5'} {es ? 'puntos por reportar' : 'pts for reporting'}
              </p>
            )}

            <button
              onClick={submit}
              disabled={!condition || submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold py-4 rounded-2xl disabled:opacity-40 transition-colors active:scale-95"
            >
              {submitting
                ? (es ? 'Enviando...' : 'Submitting...')
                : (es ? 'Enviar reporte' : 'Submit Report')}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-3">
            <p className="text-3xl mb-2">🙌</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {es ? '¡Gracias!' : 'Thanks!'}
            </p>
            {pointsEarned > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mt-1">
                +{pointsEarned} {es ? 'puntos ganados' : 'points earned'}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {es ? 'Estás ayudando a los demás cruzar mejor.' : "You're helping fellow crossers."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
