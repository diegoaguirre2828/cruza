import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { PORT_META } from '@/lib/portMeta';
import type { CruzarTicketV1 } from '@/lib/ticket/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Shipment Status · ${id.slice(0, 12).toUpperCase()} · Cruzar`,
    description: 'Live crossing status for your shipment.',
    robots: { index: false },
  };
}

function statusColor(status: string) {
  if (status === 'cleared') return 'text-green-400';
  if (status === 'flagged') return 'text-red-400';
  return 'text-foreground';
}

export default async function ShipmentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supa
    .from('tickets')
    .select('ticket_id,issued_at,modules_present,shipment_ref,port_of_entry,payload_canonical')
    .eq('ticket_id', id)
    .maybeSingle();

  if (!data) notFound();

  const payload = data.payload_canonical as CruzarTicketV1;
  const portId = data.port_of_entry as string | null;
  const portMeta = portId ? PORT_META[portId] : null;
  const portName = portMeta ? (portMeta.localName ?? portMeta.city) : portId ?? 'Unknown port';

  const blockingIssues: string[] = [];
  if (payload.paperwork?.blocking_issues?.length) blockingIssues.push('Paperwork');
  if (payload.drivers?.blocking_issues?.length) blockingIssues.push('Driver compliance');
  if (payload.uflpa?.rebuttable_presumption_triggered) blockingIssues.push('UFLPA flag');

  const overallStatus = blockingIssues.length > 0 ? 'flagged' : 'cleared';
  const crossedAt = new Date(data.issued_at);

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-5 py-4 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
          Cruzar · Shipment Status
        </span>
        <a
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent hover:text-accent/80 transition"
        >
          cruzar.app
        </a>
      </div>

      <main className="flex-1 mx-auto w-full max-w-xl px-5 py-12 space-y-8">

        {/* Status badge */}
        <div className="text-center space-y-3">
          <div className={`font-mono text-[11px] uppercase tracking-[0.22em] ${statusColor(overallStatus)}`}>
            {overallStatus === 'cleared' ? '● Crossed · Cleared' : '● Flagged — review required'}
          </div>
          <div className="font-serif text-[clamp(1.6rem,5vw,2.4rem)] font-medium text-foreground leading-tight">
            {portName}
          </div>
          <div className="font-mono text-[12px] text-muted-foreground/70">
            {crossedAt.toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
            })}
          </div>
        </div>

        {/* Key fields */}
        <div className="border border-border divide-y divide-border/60">
          {data.shipment_ref && (
            <Row label="Shipment ref" value={data.shipment_ref} />
          )}
          <Row label="Port of entry" value={portName} />
          {portMeta && (
            <Row label="Region" value={portMeta.region} />
          )}
          <Row
            label="Compliance status"
            value={overallStatus === 'cleared' ? 'All checks passed' : `Issues: ${blockingIssues.join(', ')}`}
            accent={overallStatus === 'cleared' ? 'green' : 'red'}
          />
          {data.modules_present?.length > 0 && (
            <Row label="Modules checked" value={data.modules_present.join(' · ')} />
          )}
        </div>

        {/* Flagged issues */}
        {blockingIssues.length > 0 && (
          <div className="border border-red-400/30 bg-red-400/[0.05] p-5 space-y-2">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-red-400">
              Blocking issues
            </div>
            {blockingIssues.map((issue) => (
              <div key={issue} className="text-[13.5px] text-foreground/80">· {issue}</div>
            ))}
            <p className="text-[12px] text-muted-foreground/70 pt-1">
              Contact your broker for details.
            </p>
          </div>
        )}

        {/* Ticket link for broker */}
        <div className="border border-border/50 bg-card/20 px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-2">
            Full crossing record
          </div>
          <a
            href={`/ticket/${data.ticket_id}`}
            className="font-mono text-[12px] text-accent hover:text-accent/80 transition break-all"
          >
            cruzar.app/ticket/{data.ticket_id}
          </a>
          <p className="mt-2 text-[11.5px] text-muted-foreground/50">
            Signed record with full compliance detail · share with customs attorney or receiver.
          </p>
        </div>
      </main>

      <footer className="border-t border-border px-5 py-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/40">
          Powered by Cruzar · US-MX Border Intelligence · cruzar.app
        </p>
      </footer>
    </div>
  );
}

function Row({
  label, value, accent,
}: {
  label: string; value: string; accent?: 'green' | 'red';
}) {
  const valueClass = accent === 'green'
    ? 'text-green-400'
    : accent === 'red'
    ? 'text-red-400'
    : 'text-foreground/85';
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-[12px] text-muted-foreground/70 shrink-0">{label}</dt>
      <dd className={`text-[13px] text-right ${valueClass}`}>{value}</dd>
    </div>
  );
}
