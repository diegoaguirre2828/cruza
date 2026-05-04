// lib/crossing/cohort-tags.ts
//
// Cohort tagging — turns raw trip metadata into searchable string tags
// so the ML training pipeline can learn per-cohort distributions
// (e.g., "SENTRI users at Hidalgo on weekday mornings ≈ N(11, 3) min").
//
// Pure function. No DB access. Called by the composer + auto-crossings
// route + admin backfill BEFORE inserting into crossings.cohort_tags.
//
// Tag namespace (prefixes are intentional — let downstream filters do
// `.contains('sentri')` or `.startsWith('slot:')`):
//
//   port:<port_id>           every crossing
//   dir:<direction>          every crossing
//   dow:<sun|mon|...|sat>    UTC day-of-week of started_at
//   slot:<am-rush|midday|pm-rush|night>
//   weekday | weekend
//   sentri                   has_sentri === true
//   lane:<vehicle|commercial|pedestrian>
//   holiday:<holy-week|us-thanksgiving|christmas|new-year|us-memorial|us-labor>
//   payday-friday            15th-of-month or last Friday of month

export interface CohortTagInput {
  port_id: string
  direction: 'us_to_mx' | 'mx_to_us'
  started_at: string // ISO
  has_sentri?: boolean | null
  vehicle_type?: 'sedan' | 'pickup' | 'truck' | 'commercial' | 'pedestrian' | null
}

const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function timeSlot(hour: number): 'am-rush' | 'midday' | 'pm-rush' | 'night' {
  if (hour >= 5 && hour <= 9) return 'am-rush'
  if (hour >= 10 && hour <= 14) return 'midday'
  if (hour >= 15 && hour <= 19) return 'pm-rush'
  return 'night'
}

// US/MX shared holidays + the ones that materially shift border traffic.
// Keep the list small — only crossings that ML can detect-and-learn off
// of (we don't tag minor observances). Holy Week is computed from Easter.
function easterDate(year: number): Date {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
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
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function holidayTag(d: Date): string | null {
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() // 0-11
  const day = d.getUTCDate()
  const dow = d.getUTCDay()

  // Holy Week — Palm Sunday through Easter Sunday inclusive.
  const easter = easterDate(year)
  const palmSunday = new Date(easter.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (d >= palmSunday && d <= easter) return 'holy-week'

  // US Thanksgiving — 4th Thursday of November.
  if (month === 10) {
    const firstDow = new Date(Date.UTC(year, 10, 1)).getUTCDay()
    const firstThu = ((11 - firstDow) % 7) + 1
    const fourthThu = firstThu + 21
    if (day === fourthThu) return 'us-thanksgiving'
  }

  // Christmas — Dec 23-26 (the week border traffic surges).
  if (month === 11 && day >= 23 && day <= 26) return 'christmas'

  // New Year — Dec 31 + Jan 1.
  if ((month === 11 && day === 31) || (month === 0 && day === 1)) return 'new-year'

  // US Memorial Day — last Monday of May.
  if (month === 4) {
    const lastDayOfMay = new Date(Date.UTC(year, 4, 31)).getUTCDay()
    const offsetToMon = (lastDayOfMay - 1 + 7) % 7
    const lastMon = 31 - offsetToMon
    if (day === lastMon && dow === 1) return 'us-memorial'
  }

  // US Labor Day — first Monday of September.
  if (month === 8) {
    const firstDow = new Date(Date.UTC(year, 8, 1)).getUTCDay()
    const firstMon = ((1 - firstDow) % 7 + 7) % 7 + 1
    if (day === firstMon) return 'us-labor'
  }

  return null
}

function isPaydayFriday(d: Date): boolean {
  const day = d.getUTCDate()
  const dow = d.getUTCDay()
  if (dow !== 5) return false
  if (day === 15) return true
  // Last Friday of month: today is Friday and adding 7 days lands in next month.
  const next = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000)
  return next.getUTCMonth() !== d.getUTCMonth()
}

export function computeCohortTags(input: CohortTagInput): string[] {
  const tags = new Set<string>()
  tags.add(`port:${input.port_id}`)
  tags.add(`dir:${input.direction}`)

  const d = new Date(input.started_at)
  if (isNaN(d.getTime())) return Array.from(tags)

  const dow = d.getUTCDay()
  tags.add(`dow:${DOW_NAMES[dow]}`)
  tags.add(dow === 0 || dow === 6 ? 'weekend' : 'weekday')
  tags.add(`slot:${timeSlot(d.getUTCHours())}`)

  if (input.has_sentri) tags.add('sentri')
  if (input.vehicle_type) {
    const lane = input.vehicle_type === 'sedan' || input.vehicle_type === 'pickup'
      ? 'vehicle'
      : input.vehicle_type === 'truck' || input.vehicle_type === 'commercial'
        ? 'commercial'
        : input.vehicle_type === 'pedestrian'
          ? 'pedestrian'
          : null
    if (lane) tags.add(`lane:${lane}`)
  }

  const h = holidayTag(d)
  if (h) tags.add(`holiday:${h}`)
  if (isPaydayFriday(d)) tags.add('payday-friday')

  return Array.from(tags).sort()
}
