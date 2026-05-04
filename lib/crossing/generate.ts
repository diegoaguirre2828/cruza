// lib/crossing/generate.ts
//
// Compose a Cruzar Crossing from optional per-module blocks. Mirrors the
// pattern of lib/ticket/generate.ts. Pure function — db writes happen at
// the API route layer; this just assembles + signs the payload.

import { signCrossing } from './json-signer';
import type {
  CruzarCrossingV1,
  CrossingComposeInput,
  CrossingModule,
  SignedCrossing,
} from './types';

export async function composeCrossing(
  input: CrossingComposeInput,
  opts?: { id?: string; started_at?: string; ended_at?: string | null }
): Promise<{ payload: CruzarCrossingV1; signed: SignedCrossing }> {
  const id = opts?.id ?? crypto.randomUUID();
  const started_at = opts?.started_at ?? new Date().toISOString();
  const ended_at = opts?.ended_at ?? null;

  const blocks: CruzarCrossingV1['blocks'] = {};
  const modules_present: CrossingModule[] = [];

  if (input.prep) { blocks.prep = input.prep; modules_present.push('prep'); }
  if (input.alert) { blocks.alert = input.alert; modules_present.push('alert'); }
  if (input.live) { blocks.live = input.live; modules_present.push('live'); }
  if (input.detection) { blocks.detection = input.detection; modules_present.push('detection'); }
  if (input.report) { blocks.report = input.report; modules_present.push('report'); }
  if (input.closure) { blocks.closure = input.closure; modules_present.push('closure'); }
  if (input.safety) { blocks.safety = input.safety; modules_present.push('safety'); }
  if (input.context) { blocks.context = input.context; modules_present.push('context'); }
  if (input.commerce) { blocks.commerce = input.commerce; modules_present.push('commerce'); }

  const payload: CruzarCrossingV1 = {
    schema: 'cruzar.crossing.v1',
    id,
    user_id: input.user_id,
    port_id: input.port_id,
    port_name: input.port_name,
    direction: input.direction,
    status: input.status ?? (input.detection?.exit_at ? 'completed' : 'planning'),
    modules_present,
    cohort_tags: input.cohort_tags ?? [],
    started_at,
    ended_at,
    blocks,
  };

  const signed = await signCrossing(payload);
  return { payload, signed };
}

// Merge a new block onto an existing crossing payload. Used when a
// crossing is updated incrementally (e.g., alert block first, then
// detection block when geofence fires, then closure block when alert
// auto-snoozes). Returns a fresh signature.
export async function extendCrossing(
  existing: CruzarCrossingV1,
  patch: Partial<CrossingComposeInput>,
  opts?: { ended_at?: string | null; status?: CruzarCrossingV1['status'] }
): Promise<{ payload: CruzarCrossingV1; signed: SignedCrossing }> {
  const blocks = { ...existing.blocks };
  const modules_present = new Set<CrossingModule>(existing.modules_present);

  (['prep', 'alert', 'live', 'detection', 'report', 'closure', 'safety', 'context', 'commerce'] as const)
    .forEach(k => {
      const v = patch[k];
      if (v !== undefined) {
        // typed-narrow assignment per key
        (blocks as Record<string, unknown>)[k] = v;
        modules_present.add(k);
      }
    });

  const payload: CruzarCrossingV1 = {
    ...existing,
    status: opts?.status ?? existing.status,
    ended_at: opts?.ended_at !== undefined ? opts.ended_at : existing.ended_at,
    modules_present: Array.from(modules_present),
    blocks,
  };

  const signed = await signCrossing(payload);
  return { payload, signed };
}
