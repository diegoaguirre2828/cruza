// app/ticket/[id]/page.tsx
// Cruzar Ticket viewer — renders all module blocks composed onto the ticket
// with cross-references showing which entries fired in which modules.
// The substrate's value made visible.

import { B2BNav } from '@/components/B2BNav';
import { createClient } from '@supabase/supabase-js';
import { verifyTicket, canonicalize } from '@/lib/ticket/json-signer';
import type { CruzarTicketV1, SignedTicket } from '@/lib/ticket/types';
import { TICKET_EN } from '@/lib/copy/ticket-en';
import { TICKET_ES } from '@/lib/copy/ticket-es';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

interface CrossRef {
  entry_number: string;
  fired_in_modules: string[];
  at_risk: { uflpa: boolean; cbam: boolean };
}

function computeCrossRefs(payload: CruzarTicketV1): CrossRef[] {
  const map = new Map<string, CrossRef>();
  const ensure = (entry: string) => {
    let r = map.get(entry);
    if (!r) {
      r = { entry_number: entry, fired_in_modules: [], at_risk: { uflpa: false, cbam: false } };
      map.set(entry, r);
    }
    return r;
  };
  const tag = (entry: string, mod: string) => {
    const r = ensure(entry);
    if (!r.fired_in_modules.includes(mod)) r.fired_in_modules.push(mod);
  };

  // Refunds composition contains validation_errors with entry_numbers — but the cleanest
  // entry source is to iterate on cape-eligible / protest-required / past-window via the
  // composition's per-entry rollups embedded in validation_errors and the registry version.
  // For now we use validation_errors as the per-entry signal.
  if (payload.refunds?.composition?.validation_errors) {
    for (const v of payload.refunds.composition.validation_errors) {
      if (v.entry_number) tag(v.entry_number, 'refunds');
    }
  }
  if (payload.drawback?.composition?.designations) {
    for (const d of payload.drawback.composition.designations) {
      if (d.entry_number) tag(d.entry_number, 'drawback');
    }
  }
  // UFLPA + CBAM are shipment-level, not per-entry, so we tag the shipment-level
  // rollup against any refunds/drawback entries we already have.
  if (payload.uflpa?.rebuttable_presumption_triggered) {
    for (const r of map.values()) {
      r.fired_in_modules.push('uflpa');
      r.at_risk.uflpa = true;
    }
  }
  if (payload.cbam?.in_scope_count && payload.cbam.in_scope_count > 0) {
    for (const r of map.values()) {
      r.fired_in_modules.push('cbam');
      r.at_risk.cbam = true;
    }
  }

  return [...map.values()];
}

export default async function TicketViewerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const lang: 'en' | 'es' = sp?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? TICKET_ES : TICKET_EN;

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supa
    .from('tickets')
    .select('ticket_id,issued_at,modules_present,origin_country,destination_country,port_of_entry,payload_canonical,content_hash,signature_b64,signing_key_id,superseded_by')
    .eq('ticket_id', id)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="dark min-h-screen bg-background text-foreground">
        <B2BNav lang={lang} />
        <main className="mx-auto max-w-2xl p-12">
          <h1 className="font-serif text-[28px] text-foreground">Ticket not found</h1>
          <p className="mt-3 font-mono text-[12px] text-muted-foreground">ID: {id}</p>
        </main>
      </div>
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
  const crossRefs = computeCrossRefs(payload);
  const langSuffix = lang === 'es' ? '?lang=es' : '';
  const dateLocale = lang === 'es' ? 'es-MX' : 'en-US';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      {/* HERO — ticket ID + verify status + modules-present chips */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {c.title} · v1
          </div>
          <h1 className="font-serif text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium text-foreground mt-3">
            {payload.ticket_id}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">{c.subtitle}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-mono uppercase tracking-[0.16em]',
                verify.valid
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border-red-400/30 bg-red-400/10 text-red-300',
              ].join(' ')}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${verify.valid ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {verify.valid ? c.signature_valid : `${c.signature_invalid}: ${verify.reason ?? '—'}`}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {c.issued_at} {new Date(payload.issued_at).toLocaleString(dateLocale)}
            </span>
            <a
              href={`/spec/ticket-v1${langSuffix}`}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70 hover:text-foreground"
            >
              {c.spec_link} →
            </a>
          </div>

          {data.superseded_by && (
            <p className="mt-4 text-[13px] text-accent">
              {c.superseded_by}{' '}
              <a className="underline underline-offset-2" href={`/ticket/${data.superseded_by}${langSuffix}`}>
                {data.superseded_by}
              </a>
            </p>
          )}

          {/* modules_present chips */}
          {payload.modules_present?.length > 0 && (
            <div className="mt-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {c.modules_present} ({payload.modules_present.length})
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {payload.modules_present.map((m) => (
                  <span
                    key={m}
                    className="rounded-md border border-foreground/30 bg-foreground/[0.04] px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.14em] text-foreground/85"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CROSS-REFERENCES — the substrate composing */}
      {crossRefs.length > 0 && (
        <Section title={c.cross_refs_section}>
          <p className="text-[13.5px] text-muted-foreground">{c.cross_refs_intro}</p>
          <div className="mt-4 space-y-2">
            {crossRefs.map((r) => (
              <div key={r.entry_number} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80">{c.cross_ref_entry} </span>
                    <code className="font-mono text-[12px] text-foreground">{r.entry_number}</code>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {r.fired_in_modules.map((m) => (
                      <span key={m} className="rounded border border-border bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-foreground/85">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                {(r.at_risk.uflpa || r.at_risk.cbam) && (
                  <div className="mt-2 flex items-center gap-3 text-[11.5px] font-mono">
                    <span className="text-muted-foreground/80">{c.cross_ref_at_risk}:</span>
                    {r.at_risk.uflpa && <span className="text-red-300">UFLPA</span>}
                    {r.at_risk.cbam && <span className="text-foreground">CBAM</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* SHIPMENT */}
      <Section title={c.shipment_section}>
        <Row label={c.origin} value={data.origin_country ?? '—'} />
        <Row label={c.destination} value={`${data.destination_country ?? '—'}${data.port_of_entry ? ' · ' + data.port_of_entry : ''}`} />
        {payload.shipment?.importer_name && <Row label={c.importer} value={payload.shipment.importer_name} />}
        {payload.shipment?.bol_ref && <Row label={c.bol_ref} value={payload.shipment.bol_ref} />}
        {payload.shipment?.carrier && <Row label={c.carrier} value={payload.shipment.carrier} />}
      </Section>

      {/* CUSTOMS */}
      {payload.customs && (
        <Section title={c.customs_section} code="MOD · 02 · US">
          <Row label={c.hs_classification} value={payload.customs.hs_classification.hts_10} />
          <Row label={c.origin_status} value={payload.customs.origin.usmca_originating ? c.usmca_originating : c.not_originating} />
          <Row
            label={c.ligie_status}
            value={payload.customs.origin.ligie?.affected ? `${c.ligie_affected} · ${payload.customs.origin.ligie.rate_pct}%` : c.ligie_clear}
          />
          {payload.customs.rvc && (
            <Row
              label={c.rvc_status}
              value={`${(payload.customs.rvc.transaction_value_pct ?? payload.customs.rvc.net_cost_pct ?? 0).toFixed(1)}% ${payload.customs.rvc.threshold_met ? '✓' : '✗'} (≥${payload.customs.rvc.threshold_required}%)`}
            />
          )}
        </Section>
      )}

      {/* PEDIMENTO */}
      {payload.pedimento && (
        <Section title={c.pedimento_section} code="MOD · 11 · MX">
          <Row label={c.pedimento_clave} value={payload.pedimento.clave} />
          <Row label={c.pedimento_regimen} value={payload.pedimento.regimen} />
          <Row label={c.pedimento_total_contribuciones} value={fmtUsd(payload.pedimento.total_contribuciones_usd)} />
          {payload.pedimento.fatal_findings_count > 0 && (
            <Row label={c.pedimento_fatal_findings} value={String(payload.pedimento.fatal_findings_count)} colorClass="text-red-300" />
          )}
        </Section>
      )}

      {/* REGULATORY */}
      {payload.regulatory && (
        <Section title={c.regulatory_section} code="MOD · 03">
          <Row label={c.agencies_required} value={payload.regulatory.agencies_required.join(', ') || '—'} />
          <Row label={c.earliest_deadline} value={payload.regulatory.earliest_deadline_iso ?? '—'} />
        </Section>
      )}

      {/* PAPERWORK */}
      {payload.paperwork && (
        <Section title={c.paperwork_section} code="MOD · 04">
          <Row label={c.documents} value={String(payload.paperwork.doc_count)} />
          {payload.paperwork.blocking_issues.length > 0 && (
            <Row label={c.blocking} value={String(payload.paperwork.blocking_issues.length)} colorClass="text-red-300" />
          )}
        </Section>
      )}

      {/* DRIVERS (operator) */}
      {payload.drivers && (
        <Section title={c.drivers_section} code="MOD · 05 · OPS">
          <Row label={c.overall_status} value={payload.drivers.overall_status} />
          <Row label={c.checks_run} value={String(payload.drivers.manifest.checks_run.length)} />
          {payload.drivers.blocking_issues.length > 0 && (
            <Row label={c.blocking} value={String(payload.drivers.blocking_issues.length)} colorClass="text-red-300" />
          )}
        </Section>
      )}

      {/* DRIVER PASS */}
      {payload.driver_pass && (
        <Section title={c.driver_pass_section} code="MOD · 05 · DRIVER">
          <Row
            label={c.driver_pass_readiness}
            value={payload.driver_pass.readiness.toUpperCase()}
            colorClass={
              payload.driver_pass.readiness === 'ready' ? 'text-emerald-300'
              : payload.driver_pass.readiness === 'blocked' ? 'text-red-300'
              : 'text-foreground'
            }
          />
          {payload.driver_pass.blocking_doc_count > 0 && (
            <Row label={c.driver_pass_blocking} value={String(payload.driver_pass.blocking_doc_count)} colorClass="text-red-300" />
          )}
          {payload.driver_pass.expiring_soon_doc_count > 0 && (
            <Row label={c.driver_pass_expiring} value={String(payload.driver_pass.expiring_soon_doc_count)} />
          )}
        </Section>
      )}

      {/* REFUNDS */}
      {payload.refunds && (
        <Section title={c.refunds_section} code="MOD · 14">
          <Row label={c.refunds_total_recoverable} value={fmtUsd(payload.refunds.total_recoverable_usd)} emphasis />
          <Row label={c.refunds_cape_eligible} value={String(payload.refunds.cape_eligible_count)} />
          <Row label={c.refunds_protest_required} value={String(payload.refunds.protest_required_count)} />
          <Row label={c.refunds_registry_version} value={payload.refunds.registry_version} />
        </Section>
      )}

      {/* DRAWBACK */}
      {payload.drawback && (
        <Section title={c.drawback_section} code="MOD · 07">
          <Row label={c.drawback_total_recoverable} value={fmtUsd(payload.drawback.total_drawback_recoverable_usd)} emphasis />
          {payload.drawback.manufacturing_count > 0 && <Row label={c.drawback_manufacturing} value={String(payload.drawback.manufacturing_count)} />}
          {payload.drawback.unused_count > 0 && <Row label={c.drawback_unused} value={String(payload.drawback.unused_count)} />}
          {payload.drawback.rejected_count > 0 && <Row label={c.drawback_rejected} value={String(payload.drawback.rejected_count)} />}
          {payload.drawback.accelerated_payment_eligible && (
            <Row label={c.drawback_accelerated} value="✓" colorClass="text-emerald-300" />
          )}
        </Section>
      )}

      {/* CBAM */}
      {payload.cbam && (
        <Section title={c.cbam_section} code="EU · CBAM">
          <Row label={c.cbam_phase} value={payload.cbam.composition.phase} />
          <Row label={c.cbam_in_scope} value={String(payload.cbam.in_scope_count)} />
          <Row label={c.cbam_emissions} value={String(payload.cbam.total_embedded_emissions_t_co2)} />
          <Row label={c.cbam_certificates} value={String(payload.cbam.certificates_required)} />
          <Row label={c.cbam_cost} value={fmtEur(payload.cbam.estimated_cbam_cost_eur)} emphasis />
        </Section>
      )}

      {/* UFLPA */}
      {payload.uflpa && (
        <Section title={c.uflpa_section} code="US · UFLPA">
          <Row
            label={c.uflpa_risk_level}
            value={payload.uflpa.risk_level.toUpperCase()}
            colorClass={
              payload.uflpa.risk_level === 'high' ? 'text-red-300'
              : payload.uflpa.risk_level === 'medium' ? 'text-foreground'
              : 'text-emerald-300'
            }
            emphasis
          />
          <Row
            label={c.uflpa_presumption}
            value={payload.uflpa.rebuttable_presumption_triggered ? 'TRIGGERED' : 'NOT TRIGGERED'}
            colorClass={payload.uflpa.rebuttable_presumption_triggered ? 'text-red-300' : 'text-emerald-300'}
          />
          {payload.uflpa.composition.xinjiang_tier !== null && payload.uflpa.composition.xinjiang_tier !== undefined && (
            <Row label={c.uflpa_xinjiang_tier} value={`Tier ${payload.uflpa.composition.xinjiang_tier}`} colorClass="text-red-300" />
          )}
          <Row label={c.uflpa_evidence} value={payload.uflpa.composition.evidence_quality} />
        </Section>
      )}

      {/* AUDIT SHIELD */}
      <Section title={c.audit_shield}>
        <Row label={c.prior_disclosure} value={payload.audit_shield.prior_disclosure_eligible ? '✓' : '—'} />
        <Row label={c.signing_key_id} value={signed.signing_key_id} mono />
        <Row label={c.schema_version} value={payload.schema_version} />
      </Section>

      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-foreground/45">{c.disclaimer}</p>
          <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-border/60">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/60">
              Cruzar Ticket · v1 · {payload.ticket_id}
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.08em] text-muted-foreground/50">
              <a href={`/spec/ticket-v1${langSuffix}`} className="hover:text-foreground transition">SPEC</a>
              <span className="h-3 w-px bg-border/60" />
              <a href="/.well-known/cruzar-ticket-key.json" className="hover:text-foreground transition">PUBLIC KEY</a>
              <span className="h-3 w-px bg-border/60" />
              <a href="/api/ticket/sample" className="hover:text-foreground transition">SAMPLE</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, code, children }: { title: string; code?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[18px] text-foreground">{title}</h2>
          {code && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{code}</span>
          )}
        </div>
        <dl className="mt-4 space-y-1.5">{children}</dl>
      </div>
    </section>
  );
}

function Row({ label, value, emphasis = false, colorClass, mono = false }: { label: string; value: string; emphasis?: boolean; colorClass?: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 py-1.5 border-b border-border/40 last:border-b-0">
      <dt className="text-[12.5px] text-muted-foreground/80">{label}</dt>
      <dd className={`${emphasis ? 'font-mono text-[15px]' : 'text-[13.5px]'} ${mono ? 'font-mono text-[12px]' : ''} ${colorClass ?? (emphasis ? 'text-accent' : 'text-foreground/85')}`}>
        {value}
      </dd>
    </div>
  );
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
function fmtEur(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}
