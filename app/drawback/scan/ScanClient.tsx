'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CrossModuleHintsPanel, type CrossModuleHint } from '@/components/CrossModuleHintsPanel';

interface ScanCopy {
  section_claimant: string;
  claimant_name_label: string;
  claimant_id_label: string;
  section_entry: string;
  entry_number_label: string;
  entry_date_label: string;
  htsus_label: string;
  duty_paid_label: string;
  fees_paid_label: string;
  units_label: string;
  section_export: string;
  export_id_label: string;
  export_date_label: string;
  export_htsus_label: string;
  export_units_label: string;
  destination_label: string;
  section_evidence: string;
  mfg_evidence_label: string;
  mfg_evidence_none: string;
  mfg_evidence_bom: string;
  mfg_evidence_record: string;
  rejection_evidence_label: string;
  rejection_evidence_none: string;
  rejection_evidence_inspection: string;
  rejection_evidence_return: string;
  submit: string;
  scanning: string;
  rate_limited: string;
  summary_title: string;
  summary_claim_type: string;
  summary_eligible: string;
  summary_ineligible: string;
  summary_refund_basis: string;
  summary_drawback: string;
  summary_estimated_fee: string;
  summary_net_to_you: string;
  cta_after: string;
  cta_subnote: string;
}

interface ScanResult {
  manufacturing_count: number;
  unused_count: number;
  rejected_count: number;
  ineligible_count: number;
  total_refund_basis_usd: number;
  total_drawback_recoverable_usd: number;
  estimated_cruzar_fee_usd: number;
  estimated_net_to_you_usd: number;
  designations: Array<{
    claim_type: string;
    ineligibility_reason: string | null;
    refund_basis_usd: number;
    reason: string;
  }>;
  registry_version: string;
  cross_module_hints?: CrossModuleHint[];
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const CLAIM_TYPE_LABELS: Record<string, string> = {
  manufacturing_direct: '§1313(a) Manufacturing — direct ID',
  manufacturing_substitution: '§1313(b) Manufacturing — substitution',
  unused_direct: '§1313(j)(1) Unused — direct ID',
  unused_substitution: '§1313(j)(2) Unused — substitution',
  rejected: '§1313(c) Rejected merchandise',
  ineligible: 'Ineligible',
};

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  const [claimantName, setClaimantName] = useState('');
  const [claimantId, setClaimantId] = useState('');

  const [entryNumber, setEntryNumber] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [htsus, setHtsus] = useState('');
  const [dutyPaid, setDutyPaid] = useState('');
  const [feesPaid, setFeesPaid] = useState('');
  const [units, setUnits] = useState('');

  const [exportId, setExportId] = useState('');
  const [exportDate, setExportDate] = useState('');
  const [exportHtsus, setExportHtsus] = useState('');
  const [exportUnits, setExportUnits] = useState('');
  const [destination, setDestination] = useState('');

  const [mfgEvidence, setMfgEvidence] = useState<'' | 'bill_of_materials' | 'manufacturing_record'>('');
  const [rejectionEvidence, setRejectionEvidence] = useState<'' | 'inspection_report' | 'customer_return'>('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/drawback/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          claimant: {
            claimant_name: claimantName,
            claimant_id_number: claimantId,
            language: lang,
          },
          entries: [{
            entry_number: entryNumber,
            entry_date: entryDate,
            importer_of_record: claimantName,
            htsus_codes: [htsus],
            total_duty_paid_usd: Number(dutyPaid) || 0,
            total_taxes_paid_usd: 0,
            total_fees_paid_usd: Number(feesPaid) || 0,
            merchandise_description: '',
            unit_count: Number(units) || 0,
          }],
          exports: [{
            export_id: exportId,
            export_date: exportDate,
            destination_country: destination.toUpperCase(),
            htsus_or_schedule_b: exportHtsus,
            description: '',
            unit_count: Number(exportUnits) || 0,
            manufacturing_evidence: mfgEvidence || null,
            rejection_evidence: rejectionEvidence || null,
          }],
        }),
      });
      if (r.status === 429) {
        setError(copy.rate_limited);
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'error');
        return;
      }
      setResult(j as ScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    claimantName && claimantId && entryNumber && entryDate && htsus && units &&
    exportId && exportDate && exportHtsus && exportUnits;

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title={copy.section_claimant}>
        <Field label={copy.claimant_name_label} value={claimantName} onChange={setClaimantName} required />
        <Field label={copy.claimant_id_label} value={claimantId} onChange={setClaimantId} required mono />
      </Section>

      <Section title={copy.section_entry}>
        <Field label={copy.entry_number_label} value={entryNumber} onChange={(v) => setEntryNumber(v.replace(/\D/g, '').slice(0, 14))} required mono />
        <Field label={copy.entry_date_label} value={entryDate} onChange={setEntryDate} required mono type="date" />
        <Field label={copy.htsus_label} value={htsus} onChange={(v) => setHtsus(v.replace(/[^\d.]/g, '').slice(0, 13))} required mono />
        <Field label={copy.units_label} value={units} onChange={(v) => setUnits(v.replace(/\D/g, ''))} required mono />
        <Field label={copy.duty_paid_label} value={dutyPaid} onChange={(v) => setDutyPaid(v.replace(/[^\d.]/g, ''))} mono />
        <Field label={copy.fees_paid_label} value={feesPaid} onChange={(v) => setFeesPaid(v.replace(/[^\d.]/g, ''))} mono />
      </Section>

      <Section title={copy.section_export}>
        <Field label={copy.export_id_label} value={exportId} onChange={setExportId} required mono />
        <Field label={copy.export_date_label} value={exportDate} onChange={setExportDate} required mono type="date" />
        <Field label={copy.export_htsus_label} value={exportHtsus} onChange={(v) => setExportHtsus(v.replace(/[^\d.]/g, '').slice(0, 13))} required mono />
        <Field label={copy.export_units_label} value={exportUnits} onChange={(v) => setExportUnits(v.replace(/\D/g, ''))} required mono />
        <Field label={copy.destination_label} value={destination} onChange={(v) => setDestination(v.toUpperCase().slice(0, 2))} required mono />
      </Section>

      <Section title={copy.section_evidence}>
        <Select
          label={copy.mfg_evidence_label}
          value={mfgEvidence}
          onChange={(v) => setMfgEvidence(v as '' | 'bill_of_materials' | 'manufacturing_record')}
          options={[
            { v: '', label: copy.mfg_evidence_none },
            { v: 'bill_of_materials', label: copy.mfg_evidence_bom },
            { v: 'manufacturing_record', label: copy.mfg_evidence_record },
          ]}
        />
        <Select
          label={copy.rejection_evidence_label}
          value={rejectionEvidence}
          onChange={(v) => setRejectionEvidence(v as '' | 'inspection_report' | 'customer_return')}
          options={[
            { v: '', label: copy.rejection_evidence_none },
            { v: 'inspection_report', label: copy.rejection_evidence_inspection },
            { v: 'customer_return', label: copy.rejection_evidence_return },
          ]}
        />
      </Section>

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 disabled:opacity-50"
      >
        {busy ? copy.scanning : copy.submit}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[14px] text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
            {copy.summary_title}
          </div>

          <div className="mt-5 space-y-3">
            {result.designations.map((d, i) => {
              const isIneligible = d.claim_type === 'ineligible';
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-4 ${
                    isIneligible
                      ? 'border-red-500/30 bg-red-500/[0.04]'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {copy.summary_claim_type}
                    </span>
                    <span className={`font-mono text-[12px] ${isIneligible ? 'text-red-300' : 'text-foreground'}`}>
                      {CLAIM_TYPE_LABELS[d.claim_type] ?? d.claim_type}
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">{d.reason}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
            <Row label={copy.summary_refund_basis} value={fmt(result.total_refund_basis_usd)} />
            <Row label={copy.summary_drawback} value={fmt(result.total_drawback_recoverable_usd)} emphasis />
            <Row label={copy.summary_estimated_fee} value={fmt(result.estimated_cruzar_fee_usd)} />
            <Row label={copy.summary_net_to_you} value={fmt(result.estimated_net_to_you_usd)} emphasis />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/signup${langSuffix}`}
              className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85"
            >
              {copy.cta_after}
            </Link>
            <span className="text-[12px] text-muted-foreground/80">{copy.cta_subnote}</span>
          </div>
        </div>
      )}

      <CrossModuleHintsPanel hints={result?.cross_module_hints} lang={lang} />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="font-serif text-[16px] text-foreground">{title}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, required, type = 'text', mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; mono?: boolean;
}) {
  return (
    <label className="block text-[12.5px] text-muted-foreground/80">
      <span>{label}{required && <span className="text-foreground/80"> *</span>}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60 ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ v: string; label: string }>;
}) {
  return (
    <label className="block text-[12.5px] text-muted-foreground/80">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={emphasis ? 'font-mono text-[16px] text-accent' : 'font-mono text-[14px] text-foreground/85'}>
        {value}
      </span>
    </div>
  );
}
