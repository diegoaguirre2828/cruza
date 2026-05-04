import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

interface Props {
  portIds?: string[];
  lang?: 'en' | 'es';
}

export async function CalibrationScoreboard({ portIds, lang = 'en' }: Props) {
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('calibration_log')
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
    if (portIds && !portIds.includes(pid)) continue;
    const cur = accByPort.get(pid) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (typeof row.loss === 'number' && row.loss <= 15) cur.hits += 1;
    accByPort.set(pid, cur);
  }
  const rows = Array.from(accByPort.entries())
    .filter(([, v]) => v.total >= 5)
    .map(([pid, v]) => ({
      pid,
      name: PORT_META[pid]?.localName ?? PORT_META[pid]?.city ?? pid,
      pct: Math.round((v.hits / v.total) * 100),
      n: v.total,
    }))
    .sort((a, b) => b.pct - a.pct);
  const median = rows.length > 0 ? rows[Math.floor(rows.length / 2)].pct : 0;
  const es = lang === 'es';

  return (
    <div className="border border-border bg-card/30 p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
            {es ? 'Recibos' : 'Receipts'}
          </div>
          <h3 className="font-serif text-[22px] text-foreground mt-1">
            {es ? 'Precisión por puerto · 30 días' : 'Accuracy by port · 30 days'}
          </h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
            {es ? 'Mediana' : 'Median'}
          </div>
          <div className="font-mono text-[28px] tabular-nums text-accent">{median}%</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground/60">
          {es ? 'Aún acumulando datos. Vuelve después.' : 'Still accumulating data. Check back soon.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
          {rows.map((r) => (
            <li
              key={r.pid}
              className="flex items-baseline justify-between border-b border-border/60 pb-1.5"
            >
              <span className="text-foreground">{r.name}</span>
              <span className="font-mono tabular-nums text-accent">
                {r.pct}%<span className="text-muted-foreground/50 ml-1.5">/n={r.n}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground/50 leading-snug">
        {es
          ? '"Acierto" = error ≤ 15 min vs lo observado. n = predicciones evaluadas.'
          : '"Hit" = within 15 min of observed. n = predictions evaluated.'}
      </p>
    </div>
  );
}
