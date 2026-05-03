'use client'

import Link from 'next/link'
import { Map } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

interface Props {
  port: PortWaitTime
  portId: string
}

// Client-side header block so we can read useLang() — the parent
// /cruzar/[slug]/page.tsx is a server component and can't access the
// language context. Diego 2026-05-03: "the planifica tu cruce is
// showing in spanish when im on english mode."

export function BridgePageHeader({ port, portId }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight truncate font-display">{port.portName}</h1>
          {port.crossingName && (
            <p className="text-sm text-gray-400 dark:text-gray-500 truncate">{port.crossingName}</p>
          )}
        </div>
        {port.vehicle != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-4xl font-black font-display tabular-nums leading-none text-gray-900 dark:text-gray-100">
              {port.vehicle}<span className="text-base opacity-70 ml-1 font-bold">m</span>
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-gray-500 dark:text-gray-400 mt-1">
              {es ? 'Ahora · CBP' : 'Now · CBP'}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-3">
        {([
          { lane: 'SENTRI', value: port.sentri },
          { lane: es ? 'Auto' : 'Car', value: port.vehicle },
          { lane: es ? 'A pie' : 'Walk', value: port.pedestrian },
          { lane: es ? 'Camión' : 'Truck', value: port.commercial },
        ]).map((l) => (
          <div
            key={l.lane}
            className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-center"
          >
            <p className="text-[9px] uppercase tracking-wider opacity-60 font-bold text-gray-700 dark:text-gray-300">{l.lane}</p>
            <p className="text-[13px] font-black tabular-nums mt-0.5 text-gray-900 dark:text-gray-100">
              {l.value != null ? `${l.value}m` : '—'}
            </p>
          </div>
        ))}
      </div>

      <Link
        href={`/smart-route?from=${encodeURIComponent(portId)}`}
        className="mt-3 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
            <Map className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </span>
          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
            {es ? 'Planifica tu cruce' : 'Plan your crossing'}
            <span className="font-medium text-gray-500 dark:text-gray-400 ml-1">
              · {es ? 'puentes cercanos + tiempo manejo' : 'nearby bridges + drive time'}
            </span>
          </span>
        </span>
        <span className="text-xs font-black text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">→</span>
      </Link>
    </>
  )
}
