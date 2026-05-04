// components/ui/PortTicker.tsx
// Adaptive live port-status row. Pulls the user's watched_port_ids from
// insights_subscribers when authenticated; falls back to top RGV defaults
// for anonymous viewers. Filters out ports with no live data so the row
// shows real signal, not empty placeholders.

import { headers, cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import { getPortMeta } from '@/lib/portMeta';

interface PortRow {
  code: string;
  port_id: string;
  name: string;
  wait: number;
  is_stale: boolean;
}

const RGV_DEFAULT_PORTS = ['535503', '230501', '230502', '230401', '230301'];

const PORT_CODE: Record<string, string> = {
  '535503': 'BRO', '535501': 'BRO', '535502': 'BRO',
  '230501': 'HID', '230502': 'PHA', '230503': 'ANZ',
  '230701': 'RIO', '230702': 'RIO',
  '230401': 'LAR', '230402': 'LAR', '230403': 'LAR', '230404': 'LAR',
  '230301': 'EAG', '230302': 'EAG',
  '231001': 'ROM', '231101': 'DR1',
  '230901': 'PRG', '230902': 'DON',
};

function codeFor(portId: string): string {
  return PORT_CODE[portId] ?? portId.slice(0, 3).toUpperCase();
}

async function fetchSubscriberPorts(): Promise<string[] | null> {
  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb
      .from('insights_subscribers')
      .select('watched_port_ids')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.watched_port_ids && Array.isArray(data.watched_port_ids) && data.watched_port_ids.length > 0) {
      return data.watched_port_ids as string[];
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPortsLive(portIds: string[]): Promise<PortRow[]> {
  if (portIds.length === 0) return [];
  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'www.cruzar.app';
    const res = await fetch(`${proto}://${host}/api/ports`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    const all = (json?.ports ?? []) as Array<{ portId: string; vehicle: number | null; recordedAt: string | null }>;
    const map = new Map(all.map((p) => [p.portId, p]));
    const rows: PortRow[] = [];
    for (const portId of portIds) {
      const live = map.get(portId);
      if (live?.vehicle === null || live?.vehicle === undefined) continue; // filter — adaptive: only show ports with data
      const recorded = live?.recordedAt ? new Date(live.recordedAt).getTime() : 0;
      const stale = recorded === 0 ? true : (Date.now() - recorded) > 30 * 60 * 1000;
      const meta = getPortMeta(portId);
      rows.push({
        code: codeFor(portId),
        port_id: portId,
        name: meta?.localName ?? meta?.city ?? portId,
        wait: live.vehicle as number,
        is_stale: stale,
      });
    }
    return rows.slice(0, 7);
  } catch {
    return [];
  }
}

function tone(wait: number): string {
  if (wait <= 20) return 'text-foreground';
  if (wait <= 45) return 'text-foreground/85';
  return 'text-foreground';
}

export async function PortTicker({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  const subscriberPorts = await fetchSubscriberPorts();
  const targetIds = subscriberPorts ?? RGV_DEFAULT_PORTS;
  const rows = await fetchPortsLive(targetIds);
  const isPersonalized = subscriberPorts !== null;
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  // Adaptive: if user has zero data ports, surface a configure CTA instead
  // of an empty row. Better than ghost "— MIN" placeholders.
  if (rows.length === 0) {
    return (
      <div className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
              {lang === 'es' ? 'PUERTOS VIGILADOS' : 'WATCHED PORTS'}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {lang === 'es' ? 'Configura tu lista para ver datos en vivo aquí.' : 'Configure your watchlist to see live data here.'}
            </span>
          </div>
          <Link
            href={`/dispatch${langSuffix}`}
            className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground hover:text-foreground/80 border border-border hover:border-foreground px-3 py-1.5 transition"
          >
            {lang === 'es' ? 'Configurar →' : 'Configure →'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-y border-border bg-card/40 overflow-x-auto">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        {/* Header line — adaptive label */}
        <div className="flex items-center gap-3 pt-3 pb-2 border-b border-border/40">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {isPersonalized
              ? (lang === 'es' ? 'TUS PUERTOS · EN VIVO' : 'YOUR PORTS · LIVE')
              : (lang === 'es' ? 'PUERTOS RGV · EN VIVO' : 'RGV PORTS · LIVE')}
          </span>
          <span className="h-px flex-1 bg-border" />
          {!isPersonalized && (
            <Link
              href={`/dispatch${langSuffix}`}
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
            >
              {lang === 'es' ? 'Personalizar →' : 'Customize →'}
            </Link>
          )}
        </div>

        <div className="flex items-stretch divide-x divide-border">
          {rows.map((r) => (
            <div key={r.port_id} className="flex flex-col gap-0.5 py-3 px-4 sm:px-6 first:pl-0 last:pr-0 min-w-[110px]">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                {r.code}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono tabular-nums text-[20px] font-medium ${tone(r.wait)}`}>
                  {r.wait}
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  min
                </span>
              </div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {r.is_stale ? (lang === 'es' ? 'STALE' : 'STALE') : (lang === 'es' ? 'EN VIVO' : 'LIVE')} · {r.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
