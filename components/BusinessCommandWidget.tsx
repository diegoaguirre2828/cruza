'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { Building2, Truck, ChevronRight, Wifi } from 'lucide-react'
import { isIOSAppClient } from '@/lib/platform'

interface Driver {
  id: string
  name: string
  current_status: string
  current_port_id: string | null
  last_checkin_at: string | null
}

const STATUS_DOT: Record<string, string> = {
  available:  'bg-gray-300',
  en_route:   'bg-blue-400',
  in_line:    'bg-yellow-400 animate-pulse',
  at_bridge:  'bg-orange-400 animate-pulse',
  cleared:    'bg-green-400',
  delivered:  'bg-gray-300',
}

const STATUS_LABEL_EN: Record<string, string> = {
  available:  'Available',
  en_route:   'En Route',
  in_line:    'In Line',
  at_bridge:  'At Bridge',
  cleared:    'Cleared',
  delivered:  'Delivered',
}

const STATUS_LABEL_ES: Record<string, string> = {
  available:  'Disponible',
  en_route:   'En camino',
  in_line:    'En fila',
  at_bridge:  'En el puente',
  cleared:    'Pasó',
  delivered:  'Entregado',
}

function timeAgo(iso: string | null, lang: string): string {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return lang === 'es' ? 'ahora mismo' : 'just now'
  if (mins < 60) return lang === 'es' ? `hace ${mins}m` : `${mins}m ago`
  return lang === 'es' ? `hace ${Math.round(mins / 60)}h` : `${Math.round(mins / 60)}h ago`
}

export function BusinessCommandWidget() {
  const { user, loading: authLoading } = useAuth()
  const { lang } = useLang()
  const [tier, setTier] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        const t = d.profile?.tier || 'free'
        setTier(t)
        if (t === 'business') {
          setLoadingDrivers(true)
          fetch('/api/business/drivers')
            .then(r => r.json())
            .then(d => { setDrivers(d.drivers || []); setLoadingDrivers(false) })
            .catch(() => setLoadingDrivers(false))
        }
      })
  }, [user])

  // Don't render for non-business users or while still loading auth
  if (authLoading || !user || tier === null || tier !== 'business' || isIOSAppClient()) return null

  const active = drivers.filter(d => ['en_route', 'in_line', 'at_bridge'].includes(d.current_status))
  const cleared = drivers.filter(d => d.current_status === 'cleared')
  const other = drivers.filter(d => !['en_route', 'in_line', 'at_bridge', 'cleared'].includes(d.current_status))

  const STATUS_LABEL = lang === 'es' ? STATUS_LABEL_ES : STATUS_LABEL_EN

  const txt = {
    title:        lang === 'es' ? 'Centro de Comando'          : 'Business Command Center',
    live:         lang === 'es' ? 'En vivo'                    : 'Live',
    fullPortal:   lang === 'es' ? 'Portal Completo'            : 'Full Portal',
    loading:      lang === 'es' ? 'Cargando estado de flota…'  : 'Loading fleet status...',
    noDrivers:    lang === 'es' ? 'No hay conductores aún.'    : 'No drivers added yet.',
    addFirst:     lang === 'es' ? 'Agrega tu primer conductor →' : 'Add your first driver →',
    active:       lang === 'es' ? 'Activos'                    : 'Active',
    cleared:      lang === 'es' ? 'Pasaron'                    : 'Cleared',
    total:        lang === 'es' ? 'Total'                      : 'Total',
    dispatch:     lang === 'es' ? 'Despacho'                   : 'Dispatch',
    loads:        lang === 'es' ? 'Cargas'                     : 'Loads',
    costs:        lang === 'es' ? 'Costos'                     : 'Costs',
    moreDrivers:  (n: number) => lang === 'es' ? `+${n} conductores más →` : `+${n} more drivers →`,
  }

  return (
    <div className="mb-4 bg-blue-600 dark:bg-blue-700 rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-100" />
          <span className="text-sm font-bold text-white">{txt.title}</span>
          <span className="flex items-center gap-1 text-xs text-blue-200">
            <Wifi className="w-2.5 h-2.5" /> {txt.live}
          </span>
        </div>
        <Link
          href="/business"
          className="flex items-center gap-1 text-xs font-semibold text-blue-100 hover:text-white transition-colors"
        >
          {txt.fullPortal} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Driver status strip */}
      <div className="bg-blue-700/50 dark:bg-blue-900/40 px-4 py-3">
        {loadingDrivers ? (
          <p className="text-xs text-blue-200">{txt.loading}</p>
        ) : drivers.length === 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-200">{txt.noDrivers}</p>
            <Link href="/business" className="text-xs font-semibold text-white underline underline-offset-2">
              {txt.addFirst}
            </Link>
          </div>
        ) : (
          <>
            {/* Summary counters */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-blue-500/40 rounded-xl px-2 py-1.5 text-center">
                <p className="text-lg font-bold text-white">{active.length}</p>
                <p className="text-xs text-blue-200">{txt.active}</p>
              </div>
              <div className="bg-blue-500/40 rounded-xl px-2 py-1.5 text-center">
                <p className="text-lg font-bold text-white">{cleared.length}</p>
                <p className="text-xs text-blue-200">{txt.cleared}</p>
              </div>
              <div className="bg-blue-500/40 rounded-xl px-2 py-1.5 text-center">
                <p className="text-lg font-bold text-white">{drivers.length}</p>
                <p className="text-xs text-blue-200">{txt.total}</p>
              </div>
            </div>

            {/* Driver list — show up to 4 */}
            <div className="space-y-1.5">
              {[...active, ...cleared, ...other].slice(0, 4).map(driver => (
                <div key={driver.id} className="flex items-center justify-between bg-blue-500/30 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[driver.current_status] || 'bg-gray-300'}`} />
                    <div>
                      <p className="text-xs font-semibold text-white">{driver.name}</p>
                      {driver.current_port_id && (
                        <p className="text-xs text-blue-200">{driver.current_port_id}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-blue-100">{STATUS_LABEL[driver.current_status] || driver.current_status}</p>
                    {driver.last_checkin_at && (
                      <p className="text-xs text-blue-300">{timeAgo(driver.last_checkin_at, lang)}</p>
                    )}
                  </div>
                </div>
              ))}
              {drivers.length > 4 && (
                <Link href="/business" className="block text-center text-xs text-blue-200 hover:text-white py-1">
                  {txt.moreDrivers(drivers.length - 4)}
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 divide-x divide-blue-500/40 border-t border-blue-500/30">
        <Link href="/business?tab=dispatch" className="flex flex-col items-center py-2.5 hover:bg-blue-700/40 transition-colors">
          <Truck className="w-3.5 h-3.5 text-blue-200 mb-0.5" />
          <span className="text-xs text-blue-100 font-medium">{txt.dispatch}</span>
        </Link>
        <Link href="/business?tab=shipments" className="flex flex-col items-center py-2.5 hover:bg-blue-700/40 transition-colors">
          <span className="text-sm mb-0.5">📦</span>
          <span className="text-xs text-blue-100 font-medium">{txt.loads}</span>
        </Link>
        <Link href="/business?tab=costs" className="flex flex-col items-center py-2.5 hover:bg-blue-700/40 transition-colors">
          <span className="text-sm mb-0.5">💰</span>
          <span className="text-xs text-blue-100 font-medium">{txt.costs}</span>
        </Link>
      </div>
    </div>
  )
}
