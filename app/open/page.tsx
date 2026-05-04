import Link from 'next/link';
import { getAllPortHealth } from '@/lib/portHealth';
import { PORT_META } from '@/lib/portMeta';
import type { MegaRegion } from '@/lib/portMeta';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cruzar Open Data — US-MX Border Wait Times',
  description:
    'Free, public US-Mexico border crossing wait-time data. Per-port health scores, 30-day historical averages, and real-time anomaly flags for every CBP port of entry. No account required.',
  alternates: { canonical: 'https://www.cruzar.app/open' },
};

const MEGA_LABELS: Record<MegaRegion, string> = {
  'rgv':         'Rio Grande Valley',
  'laredo':      'Laredo / Nuevo Laredo',
  'coahuila-tx': 'Eagle Pass / Del Rio',
  'el-paso':     'El Paso / Juárez',
  'sonora-az':   'Nogales / Sonora–Arizona',
  'baja':        'San Diego / Tijuana / Calexico',
  'other':       'Other',
};

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

export default async function OpenPage() {
  const allPortIds = Object.keys(PORT_META);
  const healthMap = await getAllPortHealth(allPortIds);

  const byRegion = new Map<MegaRegion, { id: string; name: string; score: number; median: number }[]>();
  for (const [id, meta] of Object.entries(PORT_META)) {
    const h = healthMap.get(id);
    if (!byRegion.has(meta.megaRegion)) byRegion.set(meta.megaRegion, []);
    byRegion.get(meta.megaRegion)!.push({
      id,
      name: meta.localName ?? meta.city,
      score: h?.score ?? 0,
      median: h?.medianWait ?? 0,
    });
  }

  const ldjson = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Cruzar Open Border Data',
    description: 'Per-port US-Mexico border crossing wait times, health scores, and anomaly flags. Free public data updated every 15 minutes.',
    url: 'https://www.cruzar.app/open',
    provider: { '@type': 'Organization', name: 'Cruzar' },
    spatialCoverage: { '@type': 'Place', name: 'US-Mexico land border' },
    temporalCoverage: 'P30D',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }}
      />

      <div className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
            CRUZAR · OPEN DATA
          </div>
          <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] font-medium text-foreground leading-[1.05]">
            US-MX border · every port · public record.
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.65] text-muted-foreground">
            Free, no account required. Wait-time health scores, 30-day historical patterns, and anomaly flags for every CBP port of entry. Updated every 15 minutes. Cite it, build on it, export it.
          </p>
          <div className="mt-5 flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.15em]">
            <Link href="/b2b" className="text-accent hover:text-accent/80 transition">B2B intelligence →</Link>
            <a href="/insights/accuracy" className="text-muted-foreground/70 hover:text-foreground transition">Calibration receipts →</a>
            <a href="/api/ports" className="text-muted-foreground/70 hover:text-foreground transition">Raw JSON →</a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12 space-y-12">
        {(Object.entries(MEGA_LABELS) as [MegaRegion, string][]).map(([mega, label]) => {
          const ports = byRegion.get(mega);
          if (!ports || ports.length === 0) return null;
          const sorted = [...ports].sort((a, b) => b.score - a.score);
          return (
            <div key={mega}>
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-5">
                {label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border overflow-hidden">
                {sorted.map((p) => (
                  <Link
                    key={p.id}
                    href={`/open/${p.id}`}
                    className="bg-background p-5 hover:bg-card/40 transition group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-serif text-[15px] text-foreground group-hover:text-accent transition leading-snug">
                        {p.name}
                      </span>
                      <span className={`font-mono text-[20px] tabular-nums shrink-0 ${scoreColor(p.score)}`}>
                        {p.score}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-muted-foreground/50">
                      {p.median > 0 ? `${p.median} min median · ` : ''}{p.id}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 font-mono text-[11px] text-muted-foreground/50">
          Data: CBP Border Wait Times API (public domain) · Updated every 15 min ·{' '}
          <Link href="/b2b" className="hover:text-foreground transition">Cruzar B2B</Link>
        </div>
      </footer>
    </div>
  );
}
