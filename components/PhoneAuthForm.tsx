'use client'

import { useState } from 'react'
import { createClient } from '@/lib/auth'
import { useLang } from '@/lib/LangContext'

// Two-step phone OTP form shared by /signup and /login.
// Step 1: user enters phone → we call signInWithOtp({ phone })
// Step 2: user enters 6-digit code → we call verifyOtp({ phone, token, type: 'sms' })
// On success, onComplete fires with a boolean indicating whether this
// was a brand-new account (true → route to /welcome) or existing
// (false → honor ?next= / default).

interface Props {
  onComplete: (isNewUser: boolean) => void
  shouldCreateUser: boolean
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, '')
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  // Assume US if 10 digits — most users are in the RGV
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

function friendlyPhoneError(raw: string, lang: 'es' | 'en'): string {
  const msg = raw.toLowerCase()
  const es = lang === 'es'
  if (msg.includes('invalid phone') || msg.includes('invalid format')) {
    return es
      ? 'Número inválido. Usa el formato +1 956 123 4567.'
      : 'Invalid number. Use format +1 956 123 4567.'
  }
  if (msg.includes('token') || msg.includes('otp') || msg.includes('expired')) {
    return es
      ? 'Código incorrecto o vencido. Pídelo de nuevo.'
      : 'Code is wrong or expired. Ask for a new one.'
  }
  if (msg.includes('rate limit')) {
    return es
      ? 'Demasiados intentos. Espera un momento antes de volver a intentar.'
      : 'Too many attempts. Wait a moment before trying again.'
  }
  if (msg.includes('sms') || msg.includes('twilio')) {
    return es
      ? 'No pudimos mandar el SMS. Intenta con correo.'
      : "Couldn't send the SMS. Try email instead."
  }
  return raw
}

export function PhoneAuthForm({ onComplete, shouldCreateUser }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const normalized = normalizePhone(phone)
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser },
    })
    setLoading(false)
    if (err) {
      setError(friendlyPhoneError(err.message, lang))
      return
    }
    setStep('code')
    setResendCooldown(30)
    const interval = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const normalized = normalizePhone(phone)
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code.trim(),
      type: 'sms',
    })
    setLoading(false)
    if (err) {
      setError(friendlyPhoneError(err.message, lang))
      return
    }
    // Detect new-vs-returning via created_at vs last_sign_in_at
    const user = data?.user
    const isNew = !!user && user.created_at === user.last_sign_in_at
    onComplete(isNew)
  }

  if (step === 'phone') {
    return (
      <form onSubmit={requestCode} className="space-y-3">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          autoFocus
          autoComplete="tel"
          inputMode="tel"
          placeholder={es ? '+1 956 123 4567' : '+1 956 123 4567'}
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {es
            ? 'Te mandamos un código por SMS. Tu número no se comparte.'
            : "We'll text you a code. Your number is never shared."}
        </p>
        <button
          type="submit"
          disabled={loading || phone.length < 7}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading
            ? (es ? 'Mandando código…' : 'Sending code…')
            : (es ? '📱 Mandarme código' : '📱 Text me a code')}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={verifyCode} className="space-y-3">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <div className="text-center mb-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {es ? 'Código enviado a' : 'Code sent to'}
        </p>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{normalizePhone(phone)}</p>
      </div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        autoFocus
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
        placeholder="123456"
        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
      >
        {loading
          ? (es ? 'Verificando…' : 'Verifying…')
          : (es ? 'Verificar →' : 'Verify →')}
      </button>
      <div className="flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => { setStep('phone'); setCode(''); setError('') }}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← {es ? 'Cambiar número' : 'Change number'}
        </button>
        <button
          type="button"
          disabled={resendCooldown > 0 || loading}
          onClick={() => requestCode()}
          className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          {resendCooldown > 0
            ? (es ? `Reenviar en ${resendCooldown}s` : `Resend in ${resendCooldown}s`)
            : (es ? 'Reenviar código' : 'Resend code')}
        </button>
      </div>
    </form>
  )
}
