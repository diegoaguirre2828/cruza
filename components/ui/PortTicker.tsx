// components/ui/PortTicker.tsx
// Live port-status row — Bloomberg-terminal-flavored ticker showing current
// vehicle wait at the 7 RGV-region ports. Server-fetches from /api/ports.
// This is the "geographic spine" made literal — the actual border, with
// live data, across the page.

import { headers } from 'next/headers';

interface PortRow {
  code: string;     // 3-letter port code
  port_id: string;
  name: string;     // city
  wait: number | null;
  is_stale: boolean;
}

const RGV_PORTS: Array<{ port_id: string; code: string; name: string }> = [
  { port_id: '535503', code: 'BRO', name: 'Brownsville' },
  { port_id: '230501', code: 'HID', name: 'Hidalgo' },
  { port_id: '230502', code: 'PHA', name: 'Pharr' },
  { port_id: '230702', code: 'RIO', name: 'Rio Grande City' },
  { port_id: '230401', code: 'LAR', name: 'Laredo' },
  { port_id: '230301', code: 'EAG', name: 'Eagle Pass' },
  { port_id: '231101', code: 'DR1', name: 'Del Rio' },
];

async function fetchPorts(): Promise<PortRow[]> {
  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'www.cruzar.app';
    const res = await fetch(`${proto}://${host}/api/ports`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('failed');
    const json = await res.json();
    const ports = (json?.ports ?? []) as Array<{ portId: string; vehicle: number | null; recordedAt: string | null }>;
    const map = new Map(ports.map((p) => [p.portId, p]));
    return RGV_PORTS.map((p) => {
      const live = map.get(p.port_id);
      const recorded = live?.recordedAt ? new Date(live.recordedAt).getTime() : 0;
      const stale = recorded === 0 ? true : (Date.now() - recorded) > 30 * 60 * 1000;
      return {
        code: p.code,
        port_id: p.port_id,
        name: p.name,
        wait: live?.vehicle ?? null,
        is_stale: stale,
      };
    });
  } catch {
    // fallback: empty rows
    return RGV_PORTS.map((p) => ({ code: p.code, port_id: p.port_id, name: p.name, wait: null, is_stale: true }));
  }
}

function tone(wait: number | null): string {
  if (wait === null) return 'text-muted-foreground';
  if (wait <= 20) return 'text-foreground';
  if (wait <= 45) return 'text-foreground/80';
  return 'text-foreground';
}

export async function PortTicker() {
  const rows = await fetchPorts();
  return (
    <div className="border-y border-border bg-card/40 overflow-x-auto">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="flex items-stretch divide-x divide-border">
          {rows.map((r) => (
            <div key={r.port_id} className="flex flex-col gap-0.5 py-3 px-4 sm:px-6 first:pl-0 last:pr-0 min-w-[110px]">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                {r.code}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono tabular-nums text-[20px] font-medium ${tone(r.wait)}`}>
                  {r.wait !== null ? r.wait : '—'}
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  min
                </span>
              </div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {r.is_stale ? 'stale' : 'live'} · {r.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
