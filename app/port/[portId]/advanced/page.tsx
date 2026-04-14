import { redirect } from 'next/navigation'

// /port/[id]/advanced is a shortcut into /datos with the port
// pre-selected via the ?port= query param. Keeps /datos as the
// single source of truth for all the deep-stat cards (Sentri
// breakeven, accident impact, lane stats, weather impact, hourly
// pattern) without duplicating the component tree.
//
// Called by the "Deep stats →" link on PortDetailHero.

interface Props {
  params: Promise<{ portId: string }>
}

export default async function AdvancedStatsRedirect({ params }: Props) {
  const { portId } = await params
  redirect(`/datos?port=${encodeURIComponent(portId)}`)
}
