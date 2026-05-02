import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ports = url.searchParams.get('ports')?.split(',').filter(Boolean) ?? [];
  if (ports.length === 0) return NextResponse.json({ median_pct: null });
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db.from('calibration_log')
    .select('tags, loss')
    .like('sim_kind', '%forecast%')
    .gte('created_at', cutoff)
    .not('observed', 'is', null)
    .limit(10000);
  const accByPort = new Map<string, { hits: number; total: number }>();
  for (const row of data ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const portTag = tags.find((t) => t.startsWith('port:'));
    if (!portTag) continue;
    const pid = portTag.slice(5);
    if (!ports.includes(pid)) continue;
    const cur = accByPort.get(pid) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(pid, cur);
  }
  const pcts = Array.from(accByPort.values())
    .filter((v) => v.total >= 5)
    .map((v) => Math.round((v.hits / v.total) * 100))
    .sort((a, b) => a - b);
  const median_pct = pcts.length > 0 ? pcts[Math.floor(pcts.length / 2)] : null;
  return NextResponse.json({ median_pct, n_ports: pcts.length });
}
