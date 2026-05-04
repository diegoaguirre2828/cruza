// app/api/workspace/summary/route.ts
// Cross-module summary for the /workspace hub. Aggregates per-user counts
// across every Cruzar B2B module so the hub can render the operator-level
// "what do I have" view without N round-trips.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

interface ModuleSummary {
  refunds: {
    open_claims: number;
    pending_principal_usd: number;
    pending_interest_usd: number;
    refund_received_count: number;
    total_received_usd: number;
  };
  eudamed: {
    actors_registered: number;
    actors_submission_ready: number;
    udi_records_total: number;
    udi_records_ready: number;
  };
  paperwork: {
    extractions_last_30d: number;
    blocking_issues: number;
  };
  drivers: {
    compliance_runs_last_30d: number;
    flagged: number;
  };
  customs: {
    validations_last_30d: number;
  };
  regulatory: {
    submissions_last_30d: number;
  };
  tickets: {
    issued_total: number;
    issued_last_30d: number;
  };
  insights: {
    subscription_tier: string | null;
    watched_ports: number;
  };
}

interface ActivityItem {
  module: 'refunds' | 'eudamed' | 'paperwork' | 'drivers' | 'customs' | 'regulatory' | 'tickets';
  label: string;
  detail: string;
  ts: string;
  href?: string;
}

export async function GET() {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = user.id;
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Run all module queries in parallel — 8 concurrent reads.
  const [
    refundClaimsRes,
    eudamedActorsRes,
    eudamedUdiRes,
    paperworkRes,
    driversRes,
    customsRes,
    regulatoryRes,
    ticketsRes,
    insightsSubRes,
    recentRefundsRes,
    recentEudamedRes,
    recentTicketsRes,
  ] = await Promise.all([
    sb.from('refund_claims').select('status, total_principal_owed_usd, total_interest_owed_usd, refund_received_amount_usd').eq('user_id', userId),
    sb.from('eudamed_actor_registrations').select('id, is_submission_ready').eq('user_id', userId),
    sb.from('eudamed_udi_records').select('id, is_eudamed_ready').eq('user_id', userId),
    sb.from('doc_extractions').select('id, flags').gte('created_at', since30d),
    sb.from('driver_compliance').select('id, status').gte('created_at', since30d),
    sb.from('customs_validations').select('id').gte('created_at', since30d),
    sb.from('regulatory_submissions').select('id').gte('created_at', since30d),
    sb.from('tickets').select('ticket_id, issued_at').eq('created_by_user_id', userId).order('issued_at', { ascending: false }),
    sb.from('insights_subscribers').select('tier, watched_port_ids').eq('user_id', userId).maybeSingle(),
    sb.from('refund_claims').select('id, status, ior_name, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5),
    sb.from('eudamed_udi_records').select('id, brand_name, udi_di, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    sb.from('tickets').select('ticket_id, modules_present, issued_at').eq('created_by_user_id', userId).order('issued_at', { ascending: false }).limit(5),
  ]);

  const refundClaims = refundClaimsRes.data ?? [];
  const eudamedActors = eudamedActorsRes.data ?? [];
  const eudamedUdis = eudamedUdiRes.data ?? [];
  const paperwork = paperworkRes.data ?? [];
  const drivers = driversRes.data ?? [];
  const customs = customsRes.data ?? [];
  const regulatory = regulatoryRes.data ?? [];
  const tickets = ticketsRes.data ?? [];
  const insightsSub = insightsSubRes.data;

  const open_claims = refundClaims.filter((c) => ['draft', 'validated', 'submitted_to_ace', 'refund_in_transit'].includes(c.status)).length;
  const pending_principal_usd = refundClaims
    .filter((c) => c.status !== 'refund_received' && c.status !== 'rejected')
    .reduce((s, c) => s + Number(c.total_principal_owed_usd ?? 0), 0);
  const pending_interest_usd = refundClaims
    .filter((c) => c.status !== 'refund_received' && c.status !== 'rejected')
    .reduce((s, c) => s + Number(c.total_interest_owed_usd ?? 0), 0);
  const refund_received_count = refundClaims.filter((c) => c.status === 'refund_received').length;
  const total_received_usd = refundClaims.reduce((s, c) => s + Number(c.refund_received_amount_usd ?? 0), 0);

  const ticketsLast30 = tickets.filter((t) => t.issued_at && t.issued_at >= since30d).length;

  const summary: ModuleSummary = {
    refunds: { open_claims, pending_principal_usd, pending_interest_usd, refund_received_count, total_received_usd },
    eudamed: {
      actors_registered: eudamedActors.length,
      actors_submission_ready: eudamedActors.filter((a) => a.is_submission_ready).length,
      udi_records_total: eudamedUdis.length,
      udi_records_ready: eudamedUdis.filter((u) => u.is_eudamed_ready).length,
    },
    paperwork: {
      extractions_last_30d: paperwork.length,
      blocking_issues: paperwork.filter((p) => {
        const f = (p.flags as Record<string, unknown>) ?? {};
        return Boolean(f.blocking_issues_count) || Boolean(f.handwriting_detected);
      }).length,
    },
    drivers: {
      compliance_runs_last_30d: drivers.length,
      flagged: drivers.filter((d) => d.status === 'flagged' || d.status === 'non_compliant').length,
    },
    customs: { validations_last_30d: customs.length },
    regulatory: { submissions_last_30d: regulatory.length },
    tickets: { issued_total: tickets.length, issued_last_30d: ticketsLast30 },
    insights: {
      subscription_tier: insightsSub?.tier ?? null,
      watched_ports: Array.isArray(insightsSub?.watched_port_ids) ? insightsSub.watched_port_ids.length : 0,
    },
  };

  // Build cross-module recent activity feed (last 10 items by timestamp).
  const activity: ActivityItem[] = [];
  for (const r of recentRefundsRes.data ?? []) {
    activity.push({
      module: 'refunds',
      label: `Refund claim #${r.id} · ${r.status}`,
      detail: r.ior_name,
      ts: r.updated_at,
      href: `/refunds/claims/${r.id}`,
    });
  }
  for (const u of recentEudamedRes.data ?? []) {
    activity.push({
      module: 'eudamed',
      label: `UDI captured · ${u.brand_name}`,
      detail: u.udi_di,
      ts: u.created_at,
    });
  }
  for (const t of recentTicketsRes.data ?? []) {
    activity.push({
      module: 'tickets',
      label: `Ticket issued · ${t.ticket_id}`,
      detail: Array.isArray(t.modules_present) ? t.modules_present.join(', ') : '',
      ts: t.issued_at,
      href: `/ticket/${t.ticket_id}`,
    });
  }
  activity.sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''));
  const activity_recent = activity.slice(0, 10);

  // Cross-module aggregates — the substrate composing across this user's tickets.
  // Counts how many of their tickets carry multi-module compositions (the "talking"
  // surface at the operator dashboard level). Also sums recoverable across refunds
  // + drawback blocks where present.
  const ticketsWithModules = await sb
    .from('tickets')
    .select('ticket_id, modules_present, payload_canonical')
    .eq('created_by_user_id', userId)
    .order('issued_at', { ascending: false })
    .limit(500);

  let multi_module_ticket_count = 0;
  let total_recoverable_across_tickets_usd = 0;
  let total_at_risk_count = 0;
  const module_co_occurrence: Record<string, number> = {};

  for (const t of ticketsWithModules.data ?? []) {
    const modules = Array.isArray(t.modules_present) ? (t.modules_present as string[]) : [];
    if (modules.length >= 2) multi_module_ticket_count++;
    // Sort + join for co-occurrence key (e.g. "drawback+refunds")
    const key = [...modules].sort().join('+');
    if (key) module_co_occurrence[key] = (module_co_occurrence[key] ?? 0) + 1;

    const p = (t.payload_canonical as Record<string, unknown>) ?? {};
    const refundsBlock = p.refunds as { total_recoverable_usd?: number } | undefined;
    const drawbackBlock = p.drawback as { total_drawback_recoverable_usd?: number } | undefined;
    const uflpaBlock = p.uflpa as { rebuttable_presumption_triggered?: boolean } | undefined;
    if (refundsBlock?.total_recoverable_usd) total_recoverable_across_tickets_usd += refundsBlock.total_recoverable_usd;
    if (drawbackBlock?.total_drawback_recoverable_usd) total_recoverable_across_tickets_usd += drawbackBlock.total_drawback_recoverable_usd;
    if (uflpaBlock?.rebuttable_presumption_triggered) total_at_risk_count++;
  }

  // Top 5 module co-occurrences for the dashboard "patterns" surface
  const top_co_occurrences = Object.entries(module_co_occurrence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ modules: key.split('+'), count }));

  const cross_module = {
    total_tickets: tickets.length,
    multi_module_ticket_count,
    total_recoverable_across_tickets_usd: Math.round(total_recoverable_across_tickets_usd * 100) / 100,
    total_at_risk_count,
    top_co_occurrences,
    has_data: tickets.length > 0,
  };

  return NextResponse.json({ summary, activity_recent, cross_module });
}
