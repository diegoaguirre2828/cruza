'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Prominent entry point to Cruz, the bilingual AI chat at /chat.
//
// Product rationale: border Facebook groups are constantly full of
// genuine questions — "¿necesito FMM si voy por 2 horas?", "¿qué hago
// si se me olvidó entregar mi I-94?", "¿cuánto efectivo puedo traer?"
// The infrastructure to answer these already exists (Haiku 4.5 fine-
// tuned on border procedures at /api/chat), it's just buried under a
// nav item. This card surfaces it as a tap magnet with three example
// prompts that pre-fill the chat to reduce friction.

const SUGGESTED = [
  {
    emoji: '🛂',
    es: '¿Necesito FMM si voy solo por el día?',
    en: 'Do I need an FMM for a day trip?',
  },
  {
    emoji: '💵',
    es: '¿Cuánto efectivo puedo traer sin declarar?',
    en: 'How much cash can I bring without declaring?',
  },
  {
    emoji: '🐕',
    es: '¿Qué hago si el K9 marca mi carro?',
    en: 'What do I do if K9 flags my car?',
  },
]

export function CruzAskCard() {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <div className="mt-3 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 rounded-3xl p-4 shadow-xl relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-pink-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-xl font-black text-indigo-700 shadow-lg">
            C
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-white leading-tight">
              {es ? '¿Alguna duda del puente?' : 'Any border questions?'}
            </p>
            <p className="text-[11px] text-indigo-100 leading-snug">
              {es
                ? 'Pregúntale a Cruz — sabe de FMM, aduana, SENTRI, todo'
                : 'Ask Cruz — knows FMM, customs, SENTRI, all of it'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {SUGGESTED.map((s, i) => (
            <Link
              key={i}
              href={`/chat?q=${encodeURIComponent(es ? s.es : s.en)}`}
              className="flex items-center gap-2.5 w-full bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl px-3 py-2.5 text-left active:scale-[0.98] transition-all border border-white/10"
            >
              <span className="text-base leading-none flex-shrink-0">{s.emoji}</span>
              <span className="text-[12px] font-semibold text-white leading-snug flex-1 min-w-0 truncate">
                {es ? s.es : s.en}
              </span>
              <span className="text-white/60 text-[11px] flex-shrink-0">→</span>
            </Link>
          ))}
        </div>

        <Link
          href="/chat"
          className="mt-2.5 flex items-center justify-center gap-1 text-[11px] font-bold text-white/90 hover:text-white py-2"
        >
          {es ? 'O pregunta lo que quieras →' : 'Or ask anything →'}
        </Link>
      </div>
    </div>
  )
}
