// app/api/refunds/claims/[id]/upload-ace-csv/route.ts
// Upload broker's ACE CSV → parse → compose → persist entries → store CAPE CSV in Vercel Blob.
// Updates claim status to 'validated'.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { put } from '@vercel/blob';
import { parseAceCsv } from '@/lib/chassis/refunds/ace-parser';
import { composeRefund } from '@/lib/chassis/refunds/composer';
import { getServiceClient } from '@/lib/supabase';
import { logRefundComposition } from '@/lib/calibration-refunds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const claimId = Number(id);
  if (!Number.isFinite(claimId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: claim } = await sb
    .from('refund_claims')
    .select('id, ior_name, ior_id_number, filer_code, language, status')
    .eq('id', claimId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (claim.status !== 'draft' && claim.status !== 'validated') {
    return NextResponse.json({ error: 'claim_locked', detail: `cannot re-upload after status=${claim.status}` }, { status: 409 });
  }

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required with field "csv"' }, { status: 400 });
  }
  const fd = await req.formData();
  const file = fd.get('csv');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing csv file' }, { status: 400 });
  }
  const csvText = await file.text();
  const { entries, errors: parseErrors } = parseAceCsv(csvText);
  if (parseErrors.length > 0) {
    return NextResponse.json({ error: 'parse_failed', detail: parseErrors }, { status: 400 });
  }

  const composition = await composeRefund(entries, {
    ior_name: claim.ior_name,
    ior_id_number: claim.ior_id_number,
    filer_code: claim.filer_code ?? undefined,
    language: (claim.language as 'en' | 'es') ?? 'en',
  });

  const blob = await put(
    `refunds/${user.id}/${claimId}/cape-${Date.now()}.csv`,
    composition.cape_csv,
    { access: 'public', contentType: 'text/csv', addRandomSuffix: false, allowOverwrite: true },
  );

  let form19Url: string | null = null;
  if (composition.form19_packet_pdf) {
    const f19 = await put(
      `refunds/${user.id}/${claimId}/form19-${Date.now()}.pdf`,
      Buffer.from(composition.form19_packet_pdf),
      { access: 'public', contentType: 'application/pdf', addRandomSuffix: false, allowOverwrite: true },
    );
    form19Url = f19.url;
  }

  const service = getServiceClient();
  await service.from('refund_claim_entries').delete().eq('claim_id', claimId);
  if (entries.length > 0) {
    const rows = entries.map(e => {
      const eo = composition.cape_csv.includes(e.entry_number) ? 'cape_eligible' : 'unknown';
      return {
        claim_id: claimId,
        entry_number: e.entry_number,
        entry_date: e.entry_date,
        liquidation_date: e.liquidation_date,
        liquidation_status: e.liquidation_status,
        country_of_origin: e.country_of_origin,
        htsus_chapter_99_code: e.htsus_codes.find(c => c.startsWith('9903.')) ?? null,
        ieepa_principal_paid_usd: 0,
        refund_amount_usd: 0,
        cliff_status: eo,
      };
    });
    await service.from('refund_claim_entries').insert(rows);
  }

  await service
    .from('refund_claims')
    .update({
      total_entries: composition.total_entries,
      total_principal_owed_usd: composition.total_principal_recoverable_usd,
      total_interest_owed_usd: composition.total_interest_recoverable_usd,
      cape_eligible_count: composition.cape_eligible_count,
      protest_required_count: composition.protest_required_count,
      past_protest_window_count: composition.past_protest_window_count,
      cape_csv_url: blob.url,
      form19_packet_url: form19Url,
      cruzar_fee_usd: composition.estimated_cruzar_fee_usd,
      status: 'validated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  await logRefundComposition(user.id, claimId, composition);

  return NextResponse.json({
    claim_id: claimId,
    summary: {
      total_entries: composition.total_entries,
      cape_eligible_count: composition.cape_eligible_count,
      protest_required_count: composition.protest_required_count,
      past_protest_window_count: composition.past_protest_window_count,
      ineligible_count: composition.ineligible_count,
      total_principal_recoverable_usd: composition.total_principal_recoverable_usd,
      total_interest_recoverable_usd: composition.total_interest_recoverable_usd,
      total_recoverable_usd: composition.total_recoverable_usd,
      estimated_cruzar_fee_usd: composition.estimated_cruzar_fee_usd,
      registry_version: composition.registry_version,
    },
    cape_csv_url: blob.url,
    form19_packet_url: form19Url,
    validation_errors: composition.validation_errors,
  });
}
