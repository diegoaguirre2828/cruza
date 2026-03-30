'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { User, Moon, Sun } from 'lucide-react'

export function NavBar() {
  const { user, loading } = useAuth()
  const { lang, t, toggle } = useLang()
  const { theme, toggle: toggleTheme } = useTheme()
  if (loading) return null

  return (
    <div className="flex items-center gap-2 mt-1">
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={toggle}
        className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {lang === 'en' ? 'ES' : 'EN'}
      </button>
      <Link href="/advertise" className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors">
        {t.localBusiness}
      </Link>
      {user ? (
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          <User className="w-3 h-3" /> {t.me}
        </Link>
      ) : (
        <Link
          href="/signup"
          className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          {t.signUpFree}
        </Link>
      )}
    </div>
  )
}
