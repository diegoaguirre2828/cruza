import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { PORT_META } from '@/lib/portMeta';

export const runtime = 'nodejs';
export const maxDuration = 300;

const NON_RGV_MEGA_REGIONS = ['el-paso', 'sonora-az', 'baja', 'coahuila-tx', 'laredo', 'other'];
const NON_RGV_PORT_IDS = Object.entries(PORT_META)
  .filter(([, m]) => NON_RGV_MEGA_REGIONS.includes(m.megaRegion))
  .map(([id]) => id);

export async function POST(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let inserted = 0;
  let skipped = 0;

  for (const portId of NON_RGV_PORT_IDS) {
    // Build DOW×hour climatology from last 90 days
    const { data: hist } = await db
      .from('wait_time_readings')
      .select('day_of_week, hour_of_day, vehicle_wait')
      .eq('port_id', portId)
      .gte('recorded_at', since90d)
      .not('vehicle_wait', 'is', null)
      .limit(5000);

    if (!hist || hist.length < 50) { skipped++; continue; }

    const clim = new Map<string, { sum: number; n: number }>();
    for (const r of hist) {
      const key = `${r.day_of_week}:${r.hour_of_day}`;
      const cur = clim.get(key) ?? { sum: 0, n: 0 };
      cur.sum += r.vehicle_wait as number;
      cur.n += 1;
      clim.set(key, cur);
    }

    // For each reading in last 30d, generate a calibration receipt
    const { data: recent } = await db
      .from('wait_time_readings')
      .select('day_of_week, hour_of_day, vehicle_wait, recorded_at')
      .eq('port_id', portId)
      .gte('recorded_at', since30d)
      .not('vehicle_wait', 'is', null)
      .limit(2000);

    if (!recent || recent.length === 0) { skipped++; continue; }

    const rows = recent.flatMap((r) => {
      const key = `${r.day_of_week}:${r.hour_of_day}`;
      const cell = clim.get(key);
      if (!cell) return [];
      const predicted_wait = Math.round(cell.sum / cell.n);
      const actual_wait = r.vehicle_wait as number;
      const loss = Math.abs(actual_wait - predicted_wait);
      return [{
        project: 'cruzar' as const,
        sim_kind: 'forecast-climatology',
        sim_version: 'cbp-climatology-v1',
        predicted: { wait_min: predicted_wait },
        observed: { wait_min: actual_wait },
        observed_at: r.recorded_at,
        loss,
        tags: [`port:${portId}`, `mega:${PORT_META[portId]?.megaRegion ?? 'other'}`],
        created_at: r.recorded_at,
      }];
    });

    if (rows.length === 0) { skipped++; continue; }

    for (let i = 0; i < rows.length; i += 500) {
      await db.from('calibration_log').insert(rows.slice(i, i + 500));
    }
    inserted += rows.length;
  }

  return NextResponse.json({ ok: true, inserted, skipped, ports: NON_RGV_PORT_IDS.length });
}
