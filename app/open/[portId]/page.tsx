import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPortHealth } from '@/lib/portHealth';
import { PORT_META } from '@/lib/portMeta';
import { getServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ portId: string }> }) {
  const { portId } = await params;
  const meta = PORT_META[portId];
  if (!meta) return {};
  const name = meta.localName ?? meta.city;
  return {
    title: `${name} Border Crossing — Live Data · Cruzar Open`,
    description: `Real-time and 30-day historical wait times for ${name} (port ${portId}). Free public data, updated every 15 minutes.`,
    alternates: { canonical: `https://www.cruzar.app/open/${portId}` },
  };
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-green-400';
  if (s >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreLabel(s: number) {
  if (s >= 70) return 'Fast';
  if (s >= 40) return 'Moderate';
  return 'Slow';
}

export default async function OpenPortPage({ params }: { params: Promise<{ portId: string }> }) {
  const { portId } = await params;
  const meta = PORT_META[portId];
  if (!meta) notFound();

  const [health, recentData] = await Promise.all([
    getPortHealth(portId),
    (async () => {
      const db = getServiceClient();
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await db
        .from('wait_time_readings')
        .select('vehicle_wait, recorded_at, sentri_wait, commercial_wait')
        .eq('port_id', portId)
        .gte('recorded_at', cutoff)
        .order('recorded_at', { ascending: false })
        .limit(500);
      return data ?? [];
    })(),
  ]);

  const name = meta.localName ?? meta.city;
  const latestWait = recentData[0]?.vehicle_wait as number | null ?? null;

  const ldjson = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${name} Port of Entry`,
    description: `US-Mexico border crossing at ${name}. Live wait times and 30-day historical data.`,
    geo: { '@type': 'GeoCoordinates', latitude: meta.lat, longitude: meta.lng },
    url: `https://www.cruzar.app/open/${portId}`,
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }}
      />

      <div className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
            <Link href="/open" className="hover:text-foreground transition">Open Data</Link>
            <span className="mx-2">·</span>
            <span>{meta.region}</span>
          </div>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="font-serif text-[clamp(2rem,4vw,3rem)] font-medium text-foreground leading-[1.05]">
                {name}
              </h1>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
                Port {portId} · {meta.lat.toFixed(4)}°N · {Math.abs(meta.lng).toFixed(4)}°W
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono text-[52px] tabular-nums leading-none ${scoreColor(health.score)}`}>
                {health.score}
              </div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/60 mt-1">
                Health · {scoreLabel(health.score)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border overflow-hidden mb-10">
          {[
            { label: 'Live wait',  value: latestWait != null ? `${latestWait} min` : 'No data' },
            { label: '30d median', value: health.medianWait > 0 ? `${health.medianWait} min` : '—' },
            { label: 'P75',        value: health.p75Wait > 0 ? `${health.p75Wait} min` : '—' },
            { label: 'Trend',      value: health.trend === 'improving' ? '↓ Improving' : health.trend === 'worsening' ? '↑ Worsening' : '→ Stable' },
          ].map((s) => (
            <div key={s.label} className="bg-background p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 mb-1">
                {s.label}
              </div>
              <div className="font-serif text-[22px] text-foreground">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Recent readings */}
        {recentData.length > 0 && (
          <div className="border border-border">
            <div className="border-b border-border px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Recent readings (7 days)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">Time</th>
                    <th className="text-right px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">Vehicle</th>
                    <th className="text-right px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">SENTRI</th>
                    <th className="text-right px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">Commercial</th>
                  </tr>
                </thead>
                <tbody>
                  {recentData.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-card/20">
                      <td className="px-5 py-2 text-muted-foreground/70 tabular-nums">
                        {new Date(r.recorded_at as string).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-foreground">{r.vehicle_wait ?? '—'}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-muted-foreground/70">{r.sentri_wait ?? '—'}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-muted-foreground/70">{r.commercial_wait ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.15em]">
          <Link href="/open" className="text-muted-foreground/60 hover:text-foreground transition">← All ports</Link>
          <Link href="/b2b" className="text-accent hover:text-accent/80 transition">B2B intelligence →</Link>
        </div>
      </div>
    </div>
  );
}
