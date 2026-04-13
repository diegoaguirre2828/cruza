'use client'

import { useMemo } from 'react'
import { useLang } from '@/lib/LangContext'

// Holiday / event overlay. Zero data dependencies — pure calendar
// math. Checks the next 14 days against a fixed list of US/Mexican
// border holidays and Spring Break / Easter windows, and surfaces
// a warning card when one is coming: "Heads up — Thanksgiving next
// week usually doubles wait times at every RGV crossing."
//
// This is one of the cheap-to-build data moats. Nobody else at the
// border is proactively warning users about upcoming surge days.
// Eventually this can be backed by real historical data from
// wait_time_readings to produce "last Thanksgiving Hidalgo peaked
// at 3h", but even the naive version adds genuine planning value.

interface Holiday {
  name: { es: string; en: string }
  // Either a fixed month/day, or a resolver that returns the start
  // date for a given year (used for movable feasts like Holy Week).
  month?: number // 1-indexed
  day?: number
  getDate?: (year: number) => Date
  impact: 'high' | 'extreme'
  note: { es: string; en: string }
}

// Meeus/Jones/Butcher Gregorian algorithm for Easter Sunday.
// Returns a local-timezone Date at midnight for the given year.
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// Palm Sunday = 7 days before Easter — the start of Holy Week.
function palmSunday(year: number): Date {
  const easter = easterSunday(year)
  return new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 7)
}

const HOLIDAYS: Holiday[] = [
  {
    name: { es: 'Año Nuevo', en: "New Year's Day" },
    month: 1, day: 1, impact: 'high',
    note: {
      es: 'Retorno post-fiestas. Puentes lentos todo el día, pico en la tarde.',
      en: 'Post-holiday return. Bridges slow all day, peak in the afternoon.',
    },
  },
  {
    name: { es: 'Día de la Constitución (MX)', en: 'Constitution Day (MX)' },
    month: 2, day: 3, impact: 'high',
    note: {
      es: 'Fin de semana largo en México. Esperas altas el domingo/lunes al regresar.',
      en: 'Long weekend in Mexico. High waits Sunday/Monday returning.',
    },
  },
  {
    name: { es: 'Semana Santa', en: 'Holy Week' },
    // Movable feast — Holy Week begins on Palm Sunday, 7 days before Easter.
    // Previously hardcoded to April 14 which was wrong every year.
    getDate: (year) => palmSunday(year),
    impact: 'extreme',
    note: {
      es: 'La semana más pesada del año. Evita cruzar entre 10am–6pm toda la semana.',
      en: 'The heaviest week of the year. Avoid crossing 10am–6pm all week.',
    },
  },
  {
    name: { es: 'Memorial Day', en: 'Memorial Day' },
    month: 5, day: 26, impact: 'high',
    note: {
      es: 'Fin de semana largo en EE.UU. Puentes muy lentos, sobre todo el lunes.',
      en: 'Long US weekend. Very slow bridges, especially Monday.',
    },
  },
  {
    name: { es: '4 de Julio', en: 'Independence Day' },
    month: 7, day: 4, impact: 'high',
    note: {
      es: 'Cruces pesados 3-5 de julio. El 4 en la tarde es el peor momento.',
      en: 'Heavy crossings July 3-5. Afternoon of the 4th is worst.',
    },
  },
  {
    name: { es: '16 de Septiembre', en: 'Mexican Independence Day' },
    month: 9, day: 16, impact: 'high',
    note: {
      es: 'Día muy pesado en todos los puentes. Retorno lento el 17.',
      en: 'Heavy day on every bridge. Slow return on the 17th.',
    },
  },
  {
    name: { es: 'Thanksgiving', en: 'Thanksgiving' },
    month: 11, day: 27, impact: 'extreme',
    note: {
      es: 'Uno de los días más lentos del año. Esperas de 2+ horas típicas.',
      en: 'One of the slowest days of the year. 2+ hour waits typical.',
    },
  },
  {
    name: { es: 'Navidad', en: 'Christmas' },
    month: 12, day: 25, impact: 'extreme',
    note: {
      es: 'Temporada alta. Del 20-30 de diciembre todos los puentes están saturados.',
      en: 'Peak season. Dec 20-30 every bridge is saturated.',
    },
  },
  {
    name: { es: 'Año Nuevo', en: "New Year's Eve" },
    month: 12, day: 31, impact: 'high',
    note: {
      es: 'Cruces pesados antes y después. El 31 tarde es el peor.',
      en: 'Heavy before and after. Afternoon of the 31st is worst.',
    },
  },
]

function resolveHolidayDate(h: Holiday, year: number): Date {
  if (h.getDate) return h.getDate(year)
  return new Date(year, (h.month ?? 1) - 1, h.day ?? 1)
}

function daysUntilHoliday(h: Holiday): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let target = resolveHolidayDate(h, today.getFullYear())
  // If the holiday already passed this year, look at next year.
  if (target.getTime() < today.getTime()) {
    target = resolveHolidayDate(h, today.getFullYear() + 1)
  }
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export function HolidayOverlay() {
  const { lang } = useLang()
  const es = lang === 'es'

  const upcoming = useMemo(() => {
    const withDays = HOLIDAYS.map((h) => ({ ...h, daysAway: daysUntilHoliday(h) }))
      .filter((h) => h.daysAway >= 0 && h.daysAway <= 14)
      .sort((a, b) => a.daysAway - b.daysAway)
    return withDays[0] || null
  }, [])

  if (!upcoming) return null

  const whenLabel =
    upcoming.daysAway === 0
      ? (es ? 'hoy' : 'today')
      : upcoming.daysAway === 1
        ? (es ? 'mañana' : 'tomorrow')
        : es
          ? `en ${upcoming.daysAway} días`
          : `in ${upcoming.daysAway} days`

  const isExtreme = upcoming.impact === 'extreme'

  return (
    <div
      className={`mt-3 rounded-2xl px-4 py-3 border-2 ${
        isExtreme
          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none flex-shrink-0">{isExtreme ? '🚨' : '📅'}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] uppercase tracking-widest font-black ${isExtreme ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {es ? 'Aviso de fecha pesada' : 'Heavy-day warning'}
          </p>
          <p className={`text-sm font-black leading-tight mt-0.5 ${isExtreme ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'}`}>
            {es ? upcoming.name.es : upcoming.name.en} · {whenLabel}
          </p>
          <p className={`text-[11px] leading-snug mt-1 ${isExtreme ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {es ? upcoming.note.es : upcoming.note.en}
          </p>
        </div>
      </div>
    </div>
  )
}
