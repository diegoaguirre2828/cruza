'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CrossModuleHintsPanel, type CrossModuleHint } from '@/components/CrossModuleHintsPanel';

interface ScanCopy {
  section_driver: string;
  driver_name_label: string;
  cdl_number_label: string;
  cdl_state_label: string;
  section_trip: string;
  origin_label: string;
  destination_label: string;
  crossing_port_label: string;
  eta_label: string;
  hazmat_label: string;
  perishables_label: string;
  section_docs: string;
  add_doc: string;
  remove_doc: string;
  doc_id_label: string;
  doc_label_label: string;
  doc_expiry_label: string;
  submit: string;
  scanning: string;
  rate_limited: string;
  summary_title: string;
  summary_readiness: string;
  summary_blocking: string;
  summary_expiring: string;
  summary_findings: string;
  summary_actions: string;
  summary_ready: string;
  cta_after: string;
  cta_subnote: string;
}

interface DocState {
  doc_id: string;
  label: string;
  expiry_date: string;
}

interface ScanResult {
  readiness: string;
  blocking_doc_count: number;
  expiring_soon_doc_count: number;
  doc_findings: Array<{
    doc_id: string;
    status: string;
    days_to_expiry: number | null;
    message_en: string;
    message_es: string;
  }>;
  recommended_actions: string[];
  pass_payload: { pass_type: string; composed_at: string };
  registry_version: string;
  cross_module_hints?: CrossModuleHint[];
}

const READINESS_COLORS: Record<string, string> = {
  ready: 'text-emerald-300',
  partial: 'text-foreground',
  blocked: 'text-red-300',
};
const STATUS_COLORS: Record<string, string> = {
  valid: 'text-emerald-300',
  expiring_soon: 'text-foreground',
  expired: 'text-red-300',
  missing: 'text-red-300',
};

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  const [driverName, setDriverName] = useState('');
  const [cdlNumber, setCdlNumber] = useState('');
  const [cdlState, setCdlState] = useState('TX');

  const [origin, setOrigin] = useState<'US' | 'MX'>('MX');
  const [destination, setDestination] = useState<'US' | 'MX'>('US');
  const [crossingPort, setCrossingPort] = useState('');
  const [eta, setEta] = useState('');
  const [hazmat, setHazmat] = useState(false);
  const [perishables, setPerishables] = useState(false);

  const [docs, setDocs] = useState<DocState[]>([
    { doc_id: 'cdl', label: 'CDL', expiry_date: '' },
    { doc_id: 'medical', label: 'DOT medical', expiry_date: '' },
    { doc_id: 'twic', label: 'TWIC', expiry_date: '' },
  ]);

  function addDoc() {
    setDocs((prev) => [...prev, { doc_id: '', label: '', expiry_date: '' }]);
  }
  function removeDoc(idx: number) {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateDoc(idx: number, patch: Partial<DocState>) {
    setDocs((prev) => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/driver-pass/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          driver: { driver_legal_name: driverName, cdl_number: cdlNumber, cdl_state: cdlState, language: lang },
          trip: {
            origin_country: origin,
            destination_country: destination,
            crossing_port_code: crossingPort,
            hazmat,
            perishables,
            scheduled_eta_iso: eta || new Date().toISOString(),
          },
          docs: docs.filter((d) => d.doc_id).map((d) => ({
            doc_id: d.doc_id,
            category: 'identity',
            label_en: d.label,
            label_es: d.label,
            required_for: ['us_entry'],
            expiry_date: d.expiry_date || undefined,
          })),
        }),
      });
      if (r.status === 429) { setError(copy.rate_limited); return; }
      const j = await r.json();
      if (!r.ok) { setError(j?.error ?? 'error'); return; }
      setResult(j as ScanResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  const messageOf = (f: { message_en: string; message_es: string }) => lang === 'es' ? f.message_es : f.message_en;

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title={copy.section_driver}>
        <Field label={copy.driver_name_label} value={driverName} onChange={setDriverName} required />
        <Field label={copy.cdl_number_label} value={cdlNumber} onChange={setCdlNumber} required mono />
        <Field label={copy.cdl_state_label} value={cdlState} onChange={(v) => setCdlState(v.toUpperCase().slice(0, 2))} required mono />
      </Section>

      <Section title={copy.section_trip}>
        <Select label={copy.origin_label} value={origin} onChange={(v) => setOrigin(v as 'US' | 'MX')} options={[{ v: 'MX', label: 'Mexico' }, { v: 'US', label: 'United States' }]} />
        <Select label={copy.destination_label} value={destination} onChange={(v) => setDestination(v as 'US' | 'MX')} options={[{ v: 'US', label: 'United States' }, { v: 'MX', label: 'Mexico' }]} />
        <Field label={copy.crossing_port_label} value={crossingPort} onChange={(v) => setCrossingPort(v.replace(/\D/g, '').slice(0, 4))} mono />
        <Field label={copy.eta_label} value={eta} onChange={setEta} mono type="datetime-local" />
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80">
          <input type="checkbox" checked={hazmat} onChange={(e) => setHazmat(e.target.checked)} />
          {copy.hazmat_label}
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80">
          <input type="checkbox" checked={perishables} onChange={(e) => setPerishables(e.target.checked)} />
          {copy.perishables_label}
        </label>
      </Section>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="font-serif text-[16px] text-foreground">{copy.section_docs}</div>
          <button type="button" onClick={addDoc} className="rounded-md border border-border px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.16em] text-muted-foreground hover:border-foreground hover:text-foreground transition">
            + {copy.add_doc}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {docs.map((d, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end rounded-lg border border-border bg-background p-3">
              <Field label={copy.doc_id_label} value={d.doc_id} onChange={(v) => updateDoc(i, { doc_id: v })} mono />
              <Field label={copy.doc_label_label} value={d.label} onChange={(v) => updateDoc(i, { label: v })} />
              <Field label={copy.doc_expiry_label} value={d.expiry_date} onChange={(v) => updateDoc(i, { expiry_date: v })} mono type="date" />
              <button type="button" onClick={() => removeDoc(i)} className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-red-300 self-center">
                {copy.remove_doc}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={busy || !driverName || !cdlNumber || docs.length === 0} className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 disabled:opacity-50">
        {busy ? copy.scanning : copy.submit}
      </button>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[14px] text-red-300">{error}</div>}

      {result && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">{copy.summary_title}</div>

          <div className="mt-5 space-y-3">
            <Row label={copy.summary_readiness} value={result.readiness.toUpperCase()} colorClass={READINESS_COLORS[result.readiness]} emphasis />
            <Row label={copy.summary_blocking} value={String(result.blocking_doc_count)} />
            <Row label={copy.summary_expiring} value={String(result.expiring_soon_doc_count)} />
          </div>

          <div className="mt-6 space-y-2">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{copy.summary_findings}</div>
            {result.doc_findings.length === 0 && (
              <p className="text-[13.5px] text-emerald-300">{copy.summary_ready}</p>
            )}
            {result.doc_findings.map((f, i) => (
              <div key={i} className="rounded-md border border-border bg-card p-3 text-[13px]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] mr-2 text-muted-foreground">{f.doc_id}</span>
                <span className={`font-mono text-[10.5px] uppercase tracking-[0.18em] mr-2 ${STATUS_COLORS[f.status] ?? 'text-foreground'}`}>{f.status}</span>
                <span className="text-muted-foreground">{messageOf(f)}</span>
              </div>
            ))}
          </div>

          {result.recommended_actions.length > 0 && (
            <div className="mt-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{copy.summary_actions}</div>
              <ul className="mt-2 space-y-2 list-disc list-inside text-[13.5px] text-foreground/85">
                {result.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={`/signup${langSuffix}`} className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85">{copy.cta_after}</Link>
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

function Field({ label, value, onChange, required, type = 'text', mono = false }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; mono?: boolean }) {
  return (
    <label className="block text-[12.5px] text-muted-foreground/80">
      <span>{label}{required && <span className="text-foreground/80"> *</span>}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className={`mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60 ${mono ? 'font-mono' : ''}`} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ v: string; label: string }> }) {
  return (
    <label className="block text-[12.5px] text-muted-foreground/80">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60">
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Row({ label, value, emphasis = false, colorClass }: { label: string; value: string; emphasis?: boolean; colorClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`${emphasis ? 'font-mono text-[16px]' : 'font-mono text-[14px]'} ${colorClass ?? 'text-foreground/85'}`}>{value}</span>
    </div>
  );
}
