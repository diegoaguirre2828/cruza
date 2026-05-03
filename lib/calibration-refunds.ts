// lib/calibration-refunds.ts
// Module 14 calibration logger — predicted (refund composition) → observed (actual refund received).
// Mirrors lib/calibration.ts (M2-M5) pattern: every composition gets a calibration_log row.

import { getServiceClient } from './supabase';
import type { RefundComposition } from './chassis/refunds/types';

export async function logRefundComposition(
  userId: string,
  claimId: number,
  comp: RefundComposition,
): Promise<void> {
  const sb = getServiceClient();
  await sb.from('calibration_log').insert({
    project: 'cruzar',
    sim_kind: 'refund_composition',
    sim_version: comp.registry_version,
    predicted: {
      claim_id: claimId,
      total_recoverable_usd: comp.total_recoverable_usd,
      total_principal_usd: comp.total_principal_recoverable_usd,
      total_interest_usd: comp.total_interest_recoverable_usd,
      cape_eligible_count: comp.cape_eligible_count,
      protest_required_count: comp.protest_required_count,
      past_protest_window_count: comp.past_protest_window_count,
      ineligible_count: comp.ineligible_count,
      estimated_cruzar_fee_usd: comp.estimated_cruzar_fee_usd,
    },
    context: {
      user_id: userId,
      ior_name: comp.ior_name,
      total_entries: comp.total_entries,
      composed_at: comp.composed_at,
    },
    tags: [
      `module:14`,
      `entries:${comp.total_entries}`,
      `cape:${comp.cape_eligible_count}`,
      `protest:${comp.protest_required_count}`,
    ],
  });
}

export async function recordRefundObserved(
  claimId: number,
  receivedAmountUsd: number,
  receivedAt: string,
): Promise<void> {
  const sb = getServiceClient();
  const { data: rows } = await sb
    .from('calibration_log')
    .select('id, predicted')
    .eq('project', 'cruzar')
    .eq('sim_kind', 'refund_composition')
    .filter('predicted->>claim_id', 'eq', String(claimId))
    .order('created_at', { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) return;
  const row = rows[0];
  const predicted = (row.predicted as { total_recoverable_usd?: number }) ?? {};
  const predictedAmount = Number(predicted.total_recoverable_usd ?? 0);
  const loss = predictedAmount > 0
    ? Math.abs(predictedAmount - receivedAmountUsd) / predictedAmount
    : null;

  await sb
    .from('calibration_log')
    .update({
      observed: { received_amount_usd: receivedAmountUsd, received_at: receivedAt },
      observed_at: receivedAt,
      loss,
    })
    .eq('id', row.id);
}
