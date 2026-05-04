'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ScanCopy {
  actor_section: string;
  device_section: string;
  actor_legal_name: string;
  actor_role_label: string;
  actor_country: string;
  actor_email: string;
  actor_srn: string;
  actor_ar_srn: string;
  device_brand: string;
  device_model: string;
  device_di: string;
  device_gmdn_code: string;
  device_gmdn_term: string;
  device_class_label: string;
  device_nb: string;
  device_ce_label: string;
  submit: string;
  checking: string;
  summary_title: string;
  actor_ready: string;
  actor_blocked: string;
  device_ready: string;
  device_blocked: string;
  cta_after: string;
  cta_subnote: string;
}

interface ScanResult {
  actor_ready: boolean;
  actor_warnings: string[];
  device_count: number;
  ready_count: number;
  blocked_count: number;
  device_validation: Array<{ udi_di: string; valid: boolean; missing_fields: string[] }>;
  registry_version: string;
}

const ROLES = [
  'manufacturer',
  'authorized_representative',
  'importer',
  'distributor',
  'system_procedure_pack_producer',
  'sterilizer',
] as const;

const RISK_CLASSES = ['I', 'I_sterile', 'I_measuring', 'I_reusable', 'IIa', 'IIb', 'III', 'AIMD', 'IVD_A', 'IVD_B', 'IVD_C', 'IVD_D'] as const;
const CE_STATUSES = ['declared', 'in_transition_mdd_to_mdr', 'expired', 'unmarked'] as const;

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  // Actor
  const [legalName, setLegalName] = useState('');
  const [role, setRole] = useState<typeof ROLES[number]>('manufacturer');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [srn, setSrn] = useState('');
  const [arSrn, setArSrn] = useState('');

  // Device
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [di, setDi] = useState('');
  const [gmdnCode, setGmdnCode] = useState('');
  const [gmdnTerm, setGmdnTerm] = useState('');
  const [riskClass, setRiskClass] = useState<typeof RISK_CLASSES[number]>('I');
  const [nb, setNb] = useState('');
  const [ce, setCe] = useState<typeof CE_STATUSES[number]>('declared');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/eudamed/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actor: {
            legal_name: legalName,
            role,
            srn: srn.trim() || null,
            registration_country_iso: country.toUpperCase(),
            address: { street: 'TBD', city: 'TBD', postal_code: 'TBD', country_iso: country.toUpperCase() },
            contact_email: email,
            authorized_rep_srn: arSrn.trim() || undefined,
          },
          devices: brand && di ? [{
            udi_di: { issuing_agency: 'GS1', di_value: di, brand_name: brand, model_or_reference_number: model },
            udi_pi: { lot_number: 'SCAN-LOT' },
            gmdn_code: gmdnCode,
            gmdn_term: gmdnTerm,
            risk_class: riskClass,
            is_sterile: false,
            has_measuring_function: false,
            is_active_implantable: false,
            notified_body_id: nb.trim() || null,
            ce_marking_status: ce,
          }] : [],
        }),
      });
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

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title={copy.actor_section}>
        <Field label={copy.actor_legal_name} value={legalName} onChange={setLegalName} required />
        <Select label={copy.actor_role_label} value={role} onChange={(v) => setRole(v as typeof ROLES[number])} options={[...ROLES]} />
        <Field label={copy.actor_country} value={country} onChange={(v) => setCountry(v.toUpperCase().slice(0, 2))} required />
        <Field label={copy.actor_email} value={email} onChange={setEmail} type="email" required />
        <Field label={copy.actor_srn} value={srn} onChange={setSrn} mono />
        <Field label={copy.actor_ar_srn} value={arSrn} onChange={setArSrn} mono />
      </Section>

      <Section title={copy.device_section}>
        <Field label={copy.device_brand} value={brand} onChange={setBrand} />
        <Field label={copy.device_model} value={model} onChange={setModel} />
        <Field label={copy.device_di} value={di} onChange={(v) => setDi(v.replace(/\D/g, '').slice(0, 14))} mono />
        <Field label={copy.device_gmdn_code} value={gmdnCode} onChange={setGmdnCode} mono />
        <Field label={copy.device_gmdn_term} value={gmdnTerm} onChange={setGmdnTerm} />
        <Select label={copy.device_class_label} value={riskClass} onChange={(v) => setRiskClass(v as typeof RISK_CLASSES[number])} options={[...RISK_CLASSES]} />
        <Field label={copy.device_nb} value={nb} onChange={(v) => setNb(v.replace(/\D/g, '').slice(0, 4))} mono />
        <Select label={copy.device_ce_label} value={ce} onChange={(v) => setCe(v as typeof CE_STATUSES[number])} options={[...CE_STATUSES]} />
      </Section>

      <button
        type="submit"
        disabled={busy || !legalName || !country || !email}
        className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 disabled:opacity-50"
      >
        {busy ? copy.checking : copy.submit}
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
          <div className="mt-4 space-y-3">
            <div className="text-[14px]">
              <span className={result.actor_ready ? 'text-emerald-300' : 'text-foreground'}>
                {result.actor_ready ? '✓' : '✗'}
              </span>{' '}
              {result.actor_ready ? copy.actor_ready : copy.actor_blocked}
            </div>
            {result.actor_warnings.length > 0 && (
              <ul className="ml-4 list-disc space-y-1 text-[13px] text-muted-foreground">
                {result.actor_warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {result.device_count > 0 && (
              <div className="text-[14px]">
                <span className={result.ready_count > 0 ? 'text-emerald-300' : 'text-foreground'}>
                  {result.ready_count > 0 ? '✓' : '✗'}
                </span>{' '}
                {result.ready_count > 0 ? copy.device_ready : copy.device_blocked}
              </div>
            )}
            {result.device_validation.map((dv, i) => (
              !dv.valid && dv.missing_fields.length > 0 && (
                <ul key={i} className="ml-4 list-disc space-y-1 text-[13px] text-muted-foreground">
                  {dv.missing_fields.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
              )
            ))}
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
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="block text-[12.5px] text-muted-foreground/80">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
