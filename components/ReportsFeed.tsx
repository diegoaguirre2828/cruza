'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Truck, ShieldAlert, HelpCircle, Clock, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'

const TYPE_CONFIG: Record<string, { label: string; labelEs: string; icon: typeof AlertTriangle; color: string; bg: string }> = {
  delay:      { label: 'Long Delay',   labelEs: 'Demora larga',  icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  inspection: { label: 'Inspection',   labelEs: 'Inspección',    icon: ShieldAlert,   color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  accident:   { label: 'Accident',     labelEs: 'Accidente',     icon: Truck,         color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  clear:      { label: 'Moving Fast',  labelEs: 'Fluye rápido',  icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  other:      { label: 'Update',       labelEs: 'Actualización', icon: HelpCircle,    color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-800' },
}

interface Report {
  id: string
  report_type: string
  description: string | null
  severity: string
  upvotes: number
  created_at: string
  wait_minutes: number | null
  username: string | null
}

interface Props {
  portId: string
  refresh: number
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export function ReportsFeed({ portId, refresh }: Props) {
  const { user } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set())
  const [upvoting, setUpvoting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?portId=${encodeURIComponent(portId)}`)
      .then(r => r.json())
      .then(d => setReports(d.reports || []))
      .finally(() => setLoading(false))
  }, [portId, refresh])

  async function handleUpvote(reportId: string) {
    if (!user || upvoting) return
    setUpvoting(reportId)
    const res = await fetch('/api/reports/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId }),
    })
    if (res.ok) {
      const { upvoted: nowUpvoted } = await res.json()
      setUpvoted(prev => {
        const next = new Set(prev)
        nowUpvoted ? next.add(reportId) : next.delete(reportId)
        return next
      })
      setReports(prev => prev.map(r => r.id === reportId
        ? { ...r, upvotes: r.upvotes + (nowUpvoted ? 1 : -1) }
        : r
      ))
    }
    setUpvoting(null)
  }

  if (loading) return <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />

  if (reports.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">No reports in the last 24 hours.</p>
        <p className="text-xs text-gray-400 mt-0.5">Be the first to report! · ¡Sé el primero!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reports.map(r => {
        const config = TYPE_CONFIG[r.report_type] ?? TYPE_CONFIG.other
        const Icon = config.icon
        const hasUpvoted = upvoted.has(r.id)

        return (
          <div key={r.id} className={`rounded-xl p-3 ${config.bg}`}>
            <div className="flex items-start gap-2.5">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                    {r.wait_minutes !== null && (
                      <span className="text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                        {r.wait_minutes} min actual
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock className="w-3 h-3" />{timeAgo(r.created_at)}
                  </div>
                </div>

                {r.description && r.description !== 'Reported via Just Crossed prompt' && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{r.description}</p>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-400">
                    {r.username ? `@${r.username}` : 'Anonymous'}
                  </span>
                  <button
                    onClick={() => handleUpvote(r.id)}
                    disabled={!user || upvoting === r.id}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                      hasUpvoted
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    } ${!user ? 'cursor-default' : 'cursor-pointer'}`}
                    title={!user ? 'Sign in to upvote' : ''}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{r.upvotes || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
