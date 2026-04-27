'use client'

import { getWaitLevel, waitLevelColor } from '@/lib/cbp'
import { useLang } from '@/lib/LangContext'

interface Props {
  minutes: number | null
  label: string
  lanesOpen?: number | null
  isClosed?: boolean
  // Officer staffing — passed by callers that have CBP officer-count data
  // for this lane type (currently pedestrian only). When typical is set
  // and differs by 2+ from open, the badge surfaces it as a leading-
  // indicator of imminent wait change ("fewer officers than usual at
  // this hour" → wait is about to spike even if current number is OK).
  lanesTypical?: number | null
}

export function WaitBadge({ minutes, label, lanesOpen, isClosed, lanesTypical }: Props) {
  const { t, lang } = useLang()
  const level = getWaitLevel(minutes)
  const colors = isClosed
    ? 'text-gray-400 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
    : waitLevelColor(level)

  const display = isClosed
    ? (lang === 'es' ? 'Cerrado' : 'Closed')
    : minutes === null ? '—'
    : minutes === 0 ? t.lessThanMin
    : `${minutes} min`

  const lanesLabel = !isClosed && lanesOpen != null && lanesOpen > 0
    ? lang === 'es'
      ? `${lanesOpen} ${lanesOpen === 1 ? 'carril' : 'carriles'}`
      : `${lanesOpen} ${lanesOpen === 1 ? 'lane' : 'lanes'}`
    : null

  const staffingDelta = !isClosed && lanesOpen != null && lanesTypical != null
    ? lanesOpen - lanesTypical
    : null
  const staffingLabel = staffingDelta != null && Math.abs(staffingDelta) >= 2
    ? lang === 'es'
      ? (staffingDelta < 0 ? `${Math.abs(staffingDelta)} menos que normal` : `${staffingDelta} más que normal`)
      : (staffingDelta < 0 ? `${Math.abs(staffingDelta)} fewer than typical` : `${staffingDelta} more than typical`)
    : null
  const staffingColor = staffingDelta != null && staffingDelta < 0
    ? 'text-red-500 dark:text-red-400'
    : 'text-green-600 dark:text-green-400'

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm text-gray-500 font-semibold">{label}</span>
      <span className={`text-base font-bold px-3 py-1.5 rounded-full border whitespace-nowrap ${colors}`}>
        {display}
      </span>
      {lanesLabel && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{lanesLabel}</span>
      )}
      {staffingLabel && (
        <span className={`text-[10px] font-semibold ${staffingColor}`}>{staffingLabel}</span>
      )}
    </div>
  )
}
