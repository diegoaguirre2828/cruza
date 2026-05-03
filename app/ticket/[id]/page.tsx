// app/ticket/[id]/page.tsx
import { createClient } from '@supabase/supabase-js';
import { verifyTicket, canonicalize } from '@/lib/ticket/json-signer';
import type { CruzarTicketV1, SignedTicket } from '@/lib/ticket/types';
import { TICKET_EN } from '@/lib/copy/ticket-en';
import { TICKET_ES } from '@/lib/copy/ticket-es';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketViewerPage({ params }: Props) {
  const { id } = await params;

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supa
    .from('tickets')
    .select('ticket_id,issued_at,modules_present,origin_country,destination_country,port_of_entry,payload_canonical,content_hash,signature_b64,signing_key_id,superseded_by')
    .eq('ticket_id', id)
    .maybeSingle();

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Ticket no encontrado / Ticket not found</h1>
        <p className="mt-2 text-sm text-white/60">ID: {id}</p>
      </main>
    );
  }

  const payload = data.payload_canonical as CruzarTicketV1;
  const signed: SignedTicket = {
    payload_canonical: canonicalize(payload),
    payload,
    content_hash: data.content_hash,
    signature_b64: data.signature_b64,
    signing_key_id: data.signing_key_id,
  };
  const verify = await verifyTicket(signed);

  return (
    <main className="mx-auto max-w-3xl p-6 text-white">
      <header className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-bold">Cruzar Ticket / Boleto</h1>
        <p className="mt-1 text-sm text-white/60">{payload.ticket_id}</p>
        <div className="mt-3 inline-flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${verify.valid ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            {verify.valid
              ? `OK Firma válida / Signature valid`
              : `X Verification failed: ${verify.reason ?? 'unknown'}`}
          </span>
        </div>
        {data.superseded_by && (
          <p className="mt-2 text-sm text-amber-400">
            Superseded by{' '}
            <a className="underline" href={`/ticket/${data.superseded_by}`}>{data.superseded_by}</a>
          </p>
        )}
      </header>

      <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">{TICKET_ES.shipment_section}</h2>
          <dl className="text-sm">
            <Row label={TICKET_ES.origin} value={data.origin_country ?? '—'} />
            <Row label={TICKET_ES.destination} value={`${data.destination_country ?? '—'}${data.port_of_entry ? ' (' + data.port_of_entry + ')' : ''}`} />
            <Row label="Emitido" value={new Date(payload.issued_at).toLocaleString('es-MX')} />
          </dl>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">{TICKET_EN.shipment_section}</h2>
          <dl className="text-sm">
            <Row label={TICKET_EN.origin} value={data.origin_country ?? '—'} />
            <Row label={TICKET_EN.destination} value={`${data.destination_country ?? '—'}${data.port_of_entry ? ' (' + data.port_of_entry + ')' : ''}`} />
            <Row label="Issued" value={new Date(payload.issued_at).toLocaleString('en-US')} />
          </dl>
        </div>
      </section>

      {payload.customs && (
        <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-semibold">{TICKET_ES.customs_section}</h2>
            <dl className="text-sm">
              <Row label={TICKET_ES.hs_classification} value={payload.customs.hs_classification.hts_10} />
              <Row
                label={TICKET_ES.origin_status}
                value={payload.customs.origin.usmca_originating ? `OK ${TICKET_ES.usmca_originating}` : `X ${TICKET_ES.not_originating}`}
              />
              <Row
                label={TICKET_ES.ligie_status}
                value={payload.customs.origin.ligie.affected ? `! ${payload.customs.origin.ligie.rate_pct}%` : `OK ${TICKET_ES.ligie_clear}`}
              />
            </dl>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold">{TICKET_EN.customs_section}</h2>
            <dl className="text-sm">
              <Row label={TICKET_EN.hs_classification} value={payload.customs.hs_classification.hts_10} />
              <Row
                label={TICKET_EN.origin_status}
                value={payload.customs.origin.usmca_originating ? `OK ${TICKET_EN.usmca_originating}` : `X ${TICKET_EN.not_originating}`}
              />
              <Row
                label={TICKET_EN.ligie_status}
                value={payload.customs.origin.ligie.affected ? `! ${payload.customs.origin.ligie.rate_pct}%` : `OK ${TICKET_EN.ligie_clear}`}
              />
            </dl>
          </div>
        </section>
      )}

      <section className="mt-8 rounded border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        <p className="mb-1">{TICKET_ES.disclaimer}</p>
        <p>{TICKET_EN.disclaimer}</p>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1">
      <dt className="text-white/50">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
