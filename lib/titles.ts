// Identity-based contribution titles.
//
// Diego's call: no ranks, no points, no progression pressure — just a
// single quiet title that describes who the user is in the community
// based on contribution. Displayed as a small label next to the
// Reports/Shares pill in the NavBar (and wherever a user's name shows).
//
// Key design principles:
//   1. NO progression UI — users don't see "next tier in 3 reports"
//   2. Single title at a time — no badge collection
//   3. Identity-framed, not achievement-framed — "Cruzador Confiable"
//      reads as "who you are", not "what you've earned"
//   4. Silent promotion — title updates quietly as the user contributes
//   5. No label shown for brand-new users (0-2 contributions)

export type Title = {
  key: string
  es: string
  en: string
}

// Contribution score = reports + (shares * 0.5)
// Shares matter but reports are the more valuable action because they
// put data into the system — shares just distribute it.
export function computeContributionScore(reportsCount: number, sharesCount: number): number {
  return reportsCount + Math.floor(sharesCount * 0.5)
}

// Returns the user's current title, or null if they haven't contributed
// enough to earn one. Silent fail-null is intentional — new users don't
// need to see an empty label.
export function getTitle(reportsCount: number, sharesCount: number): Title | null {
  const score = computeContributionScore(reportsCount, sharesCount)

  if (score >= 50) {
    return { key: 'guardian', es: 'Guardián del Puente', en: 'Bridge Guardian' }
  }
  if (score >= 25) {
    return { key: 'confiable', es: 'Cruzador Confiable', en: 'Trusted Crosser' }
  }
  if (score >= 10) {
    return { key: 'frecuente', es: 'Cruzador Frecuente', en: 'Frequent Crosser' }
  }
  if (score >= 3) {
    return { key: 'cruzador', es: 'Cruzador', en: 'Crosser' }
  }
  return null
}

// Label color for visual distinction. Keeps to the neutral gray-blue
// family so nothing feels like a gold medal.
export function getTitleColor(title: Title | null): string {
  if (!title) return 'text-gray-400'
  switch (title.key) {
    case 'guardian':  return 'text-indigo-700 dark:text-indigo-300'
    case 'confiable': return 'text-blue-700 dark:text-blue-300'
    case 'frecuente': return 'text-cyan-700 dark:text-cyan-300'
    case 'cruzador':  return 'text-gray-600 dark:text-gray-400'
    default:          return 'text-gray-500'
  }
}
