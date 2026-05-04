import { getServiceClient } from '@/lib/supabase';

export interface PortHealthResult {
  portId: string;
  score: number;
  medianWait: number;
  p75Wait: number;
  dataPoints: number;
  lastReading: string | null;
  trend: 'improving' | 'stable' | 'worsening';
}

export async function getPortHealth(portId: string): Promise<PortHealthResult> {
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await db
    .from('wait_time_readings')
    .select('vehicle_wait, recorded_at')
    .eq('port_id', portId)
    .gte('recorded_at', cutoff)
    .not('vehicle_wait', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(3000);

  if (!data || data.length < 5) {
    return { portId, score: 0, medianWait: 0, p75Wait: 0, dataPoints: 0, lastReading: null, trend: 'stable' };
  }

  const waits = data.map((r) => r.vehicle_wait as number).sort((a, b) => a - b);
  const p25 = waits[Math.floor(waits.length * 0.25)];
  const p50 = waits[Math.floor(waits.length * 0.5)];
  const p75 = waits[Math.floor(waits.length * 0.75)];
  const iqr = p75 - p25;

  const score = Math.max(0, Math.min(100, 100 - Math.round(p50 * 0.7) - Math.round(iqr * 0.3)));

  const half = Math.floor(data.length / 2);
  const recentWaits = data.slice(0, half).map((r) => r.vehicle_wait as number).sort((a, b) => a - b);
  const olderWaits = data.slice(half).map((r) => r.vehicle_wait as number).sort((a, b) => a - b);
  const recentMedian = recentWaits[Math.floor(recentWaits.length / 2)] ?? p50;
  const olderMedian = olderWaits[Math.floor(olderWaits.length / 2)] ?? p50;
  const trend: PortHealthResult['trend'] =
    recentMedian < olderMedian - 3 ? 'improving' :
    recentMedian > olderMedian + 3 ? 'worsening' : 'stable';

  return {
    portId,
    score,
    medianWait: p50,
    p75Wait: p75,
    dataPoints: data.length,
    lastReading: data[0]?.recorded_at ?? null,
    trend,
  };
}

export async function getAllPortHealth(portIds: string[]): Promise<Map<string, PortHealthResult>> {
  const results = await Promise.all(portIds.map(getPortHealth));
  return new Map(results.map((r) => [r.portId, r]));
}
