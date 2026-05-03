import { fetchRgvWaitTimes } from '@/lib/cbp'
import { PortDetailClient } from '../../port/[portId]/PortDetailClient'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { getPortMeta } from '@/lib/portMeta'
import { portIdFromSlug, slugForPort, allSlugs } from '@/lib/portSlug'

// Human-readable port URLs for FB commenting + SEO.
// Mirrors app/port/[portId]/page.tsx but keyed by slug. Canonical URL
// for each port is the slug variant; numeric /port/[portId] stays as
// a working alias for backlinks + existing share URLs.

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return allSlugs().map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const portId = portIdFromSlug(slug)
  if (!portId) return {}
  const ports = await fetchRgvWaitTimes()
  const port = ports.find((p) => p.portId === portId)
  if (!port) return {}

  const wait = port.vehicle
  const waitStr = wait && wait > 0 ? `${wait} min` : 'Live'
  const level = !wait || wait === 0 ? 'green' : wait <= 20 ? 'green' : wait <= 45 ? 'yellow' : 'red'
  const emoji = level === 'green' ? '🟢' : level === 'yellow' ? '🟡' : '🔴'

  const canonicalSlug = slugForPort(portId)
  const title = `${emoji} ${port.portName} — ${waitStr} wait | Cruzar`
  const description = `Live border crossing wait at ${port.portName}${wait && wait > 0 ? ` — ${wait} min right now` : ''}. Updated every 15 min. Free for commuters and truckers.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://cruzar.app/cruzar/${canonicalSlug}`,
    },
    openGraph: {
      title: `${emoji} ${port.portName} — ${waitStr} wait`,
      description,
      url: `https://cruzar.app/cruzar/${canonicalSlug}`,
      siteName: 'Cruzar',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `${emoji} ${port.portName} — ${waitStr} wait`,
      description,
    },
  }
}

export default async function PortBySlug({ params }: Props) {
  const { slug } = await params
  const portId = portIdFromSlug(slug)
  if (!portId) notFound()

  const ports = await fetchRgvWaitTimes()
  const port = ports.find((p) => p.portId === portId)
  if (!port) notFound()

  const meta = getPortMeta(portId)
  const waitMin = port.vehicle
  const waitText = waitMin && waitMin > 0 ? `${waitMin} min wait` : 'live wait times available'
  const canonicalSlug = slugForPort(portId)
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${port.portName} — ${waitText} | Cruzar`,
    description: `Live US-Mexico border crossing wait time at ${port.portName}. ${waitText}. Updated every 15 min from CBP + community reports.`,
    url: `https://cruzar.app/cruzar/${canonicalSlug}`,
    inLanguage: ['en', 'es'],
    mainEntity: {
      '@type': 'Place',
      name: port.portName,
      ...(port.crossingName ? { alternateName: port.crossingName } : {}),
      ...(meta?.lat && meta?.lng
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: meta.lat,
              longitude: meta.lng,
            },
            address: {
              '@type': 'PostalAddress',
              addressCountry: 'US',
              addressLocality: meta.city,
            },
          }
        : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cruzar',
      url: 'https://cruzar.app',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-lg mx-auto px-4 pb-10">
          <div className="pt-6 pb-4">
            <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
              <ArrowLeft className="w-4 h-4" /> All crossings · Todos los cruces
            </Link>
            {/* Compact header: name + crossing on the left, live wait on
                the right. Replaces the prior 64px LiveWaitHero — Diego
                2026-05-02: "since users can see wait times before
                clicking on the main page, maybe instead of that big
                hero we can fit it on here? make room for the other
                features." */}
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
                    Ahora · CBP
                  </p>
                </div>
              )}
            </div>
            {/* 4-lane chip row — surfaces SENTRI / Auto / A pie / Camión
                inline so the user doesn't need a separate hero card to
                see lane breakdowns. */}
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {([
                { lane: 'SENTRI', value: port.sentri },
                { lane: 'Auto', value: port.vehicle },
                { lane: 'A pie', value: port.pedestrian },
                { lane: 'Camión', value: port.commercial },
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
          </div>

          <PortDetailClient port={port} portId={portId} />
        </div>
      </main>
    </>
  )
}
