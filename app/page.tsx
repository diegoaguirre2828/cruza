'use client'

import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'
import { GuestAds } from '@/components/GuestAds'
import { useLang } from '@/lib/LangContext'

export default function HomePage() {
  const { t } = useLang()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-8 pb-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🌉 {t.appName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t.subtitle}</p>
          </div>
          <NavBar />
        </div>

        <div className="flex gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {t.underMin}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> {t.midMin}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {t.overMin}
          </span>
        </div>

        <GuestAds />
        <PortList />
      </div>
    </main>
  )
}
