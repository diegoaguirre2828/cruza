'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Shared back-affordance + title for every non-home route. Previously
// each page rolled its own back-link shape (some had "All crossings",
// some had "Back to map", some had nothing) which meant a user landing
// on a deep route from a share link had no predictable exit. This
// locks one pattern across the app: arrow + last-screen-or-home label.
//
// backHref: if the user came from within the app, backHref="auto"
// walks history back one step. If they came cold (share link, push
// notification, FB post), history is empty and we fall back to home.
// Explicit href overrides history — use when "back" has a semantic
// meaning ("Back to port list", "Back to dashboard") distinct from
// browser history.

interface Props {
  title: string
  subtitle?: string
  backHref?: string          // literal path like "/" or "/dashboard"
  backLabelEs?: string       // override default ES label
  backLabelEn?: string       // override default EN label
  rightSlot?: React.ReactNode  // optional action control (share, edit, etc.)
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabelEs,
  backLabelEn,
  rightSlot,
}: Props) {
  const { lang } = useLang()
  const router = useRouter()
  const es = lang === 'es'

  const defaultLabel = es ? 'Volver' : 'Back'
  const label = es ? (backLabelEs ?? defaultLabel) : (backLabelEn ?? defaultLabel)

  // If no explicit href, use router.back() so we honor in-app nav
  // history. Fall back to home if history has no in-app entry (cold
  // share landing).
  function handleBack(e: React.MouseEvent) {
    if (backHref) return   // Link handles it
    e.preventDefault()
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const backEl = backHref ? (
    <Link
      href={backHref}
      className="flex items-center gap-1 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors active:scale-95"
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </Link>
  ) : (
    <button
      onClick={handleBack}
      type="button"
      className="flex items-center gap-1 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors active:scale-95"
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  )

  return (
    <div className="pt-6 pb-3">
      <div className="mb-3">{backEl}</div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}
