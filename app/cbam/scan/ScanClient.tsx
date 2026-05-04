'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ScanCopy {
  section_declarant: string;
  declarant_name_label: string;
  declarant_eori_label: string;
  declarant_authorized_label: string;
  declarant_period_label: string;
  section_good: string;
  cn_code_label: string;
  description_label: string;
  mass_label: string;
  section_installation: string;
  installation_name_label: string;
  installation_country_label: string;
  installation_emp_label: string;
  section_emissions: string;
  emissions_basis_label: string;
  emissions_basis_actual_verified: string;
  emissions_basis_actual_unverified: string;
  emissions_basis_default: string;
  direct_emissions_label: string;
  indirect_emissions_label: string;
  submit: string;
  scanning: string;
  rate_limited: string;
  summary_title: string;
  summary_phase: string;
  summary_in_scope: string;
  summary_total_mass: string;
  summary_embedded_emissions: string;
  summary_certificates: string;
  summary_estimated_cost: string;
  summary_ets_price: string;
  summary_findings: string;
  summary_no_fatal: string;
  cta_after: string;
  cta_subnote: string;
}

interface ScanResult {
  phase: string;
  in_scope_count: number;
  out_of_scope_count: number;
  total_mass_tonnes: number;
  total_embedded_emissions_t_co2: number;
  certificates_required: number;
  estimated_cbam_cost_eur: number;
  ets_avg_price_eur_per_t: number;
  findings: Array<{ rule_id: string; severity: 'fatal' | 'warning' | 'info'; message_en: string; message_es: string }>;
  registry_version: string;
}

const fmtEur = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  const [declarantName, setDeclarantName] = useState('');
  const [eori, setEori] = useState('');
  const [authorized, setAuthorized] = useState(true);
  const [period, setPeriod] = useState('2026-Q2');

  const [cnCode, setCnCode] = useState('');
  const [description, setDescription] = useState('');
  const [mass, setMass] = useState('');

  const [installationName, setInstallationName] = useState('');
  const [installationCountry, setInstallationCountry] = useState('');
  const [hasEmp, setHasEmp] = useState(false);

  const [emissionsBasis, setEmissionsBasis] = useState<'actual_verified' | 'actual_unverified' | 'default_value'>('default_value');
  const [directEmissions, setDirectEmissions] = useState('');
  const [indirectEmissions, setIndirectEmissions] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/cbam/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          declarant: {
            declarant_name: declarantName,
            declarant_eori: eori.toUpperCase(),
            authorized_cbam_declarant: authorized,
            reporting_period: period,
            language: lang,
          },
          goods: [{
            cn_code: cnCode,
            description,
            category: 'iron_steel',
            mass_tonnes: Number(mass) || 0,
            installation: {
              installation_name: installationName,
              country_iso: installationCountry.toUpperCase(),
              has_emissions_monitoring_plan: hasEmp,
              uses_carbon_price_in_origin: false,
            },
            direct_emissions_t_co2_per_t: directEmissions ? Number(directEmissions) : undefined,
            indirect_emissions_t_co2_per_t: indirectEmissions ? Number(indirectEmissions) : undefined,
            emissions_basis: emissionsBasis,
          }],
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

  const fatalFindings = result?.findings.filter((f) => f.severity === 'fatal') ?? [];
  const warningFindings = result?.findings.filter((f) => f.severity === 'warning') ?? [];
  const messageOf = (f: { message_en: string; message_es: string }) =>
    lang === 'es' ? f.message_es : f.message_en;

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title={copy.section_declarant}>
        <Field label={copy.declarant_name_label} value={declarantName} onChange={setDeclarantName} required />
        <Field label={copy.declarant_eori_label} value={eori} onChange={(v) => setEori(v.toUpperCase().slice(0, 30))} required mono />
        <Field label={copy.declarant_period_label} value={period} onChange={setPeriod} required mono />
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80">
          <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
          {copy.declarant_authorized_label}
        </label>
      </Section>

      <Section title={copy.section_good}>
        <Field label={copy.cn_code_label} value={cnCode} onChange={(v) => setCnCode(v.replace(/\D/g, '').slice(0, 8))} required mono />
        <Field label={copy.description_label} value={description} onChange={setDescription} />
        <Field label={copy.mass_label} value={mass} onChange={(v) => setMass(v.replace(/[^\d.]/g, ''))} required mono />
      </Section>

      <Section title={copy.section_installation}>
        <Field label={copy.installation_name_label} value={installationName} onChange={setInstallationName} required />
        <Field label={copy.installation_country_label} value={installationCountry} onChange={(v) => setInstallationCountry(v.toUpperCase().slice(0, 2))} required mono />
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80 sm:col-span-2">
          <input type="checkbox" checked={hasEmp} onChange={(e) => setHasEmp(e.target.checked)} />
          {copy.installation_emp_label}
        </label>
      </Section>

      <Section title={copy.section_emissions}>
        <Select label={copy.emissions_basis_label} value={emissionsBasis} onChange={(v) => setEmissionsBasis(v as typeof emissionsBasis)} options={[
          { v: 'default_value', label: copy.emissions_basis_default },
          { v: 'actual_unverified', label: copy.emissions_basis_actual_unverified },
          { v: 'actual_verified', label: copy.emissions_basis_actual_verified },
        ]} />
        <Field label={copy.direct_emissions_label} value={directEmissions} onChange={(v) => setDirectEmissions(v.replace(/[^\d.]/g, ''))} mono />
        <Field label={copy.indirect_emissions_label} value={indirectEmissions} onChange={(v) => setIndirectEmissions(v.replace(/[^\d.]/g, ''))} mono />
      </Section>

      <button type="submit" disabled={busy || !cnCode || !mass || !eori} className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 disabled:opacity-50">
        {busy ? copy.scanning : copy.submit}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[14px] text-red-300">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">{copy.summary_title}</div>

          <div className="mt-5 grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
            <Row label={copy.summary_phase} value={result.phase} />
            <Row label={copy.summary_in_scope} value={String(result.in_scope_count)} />
            <Row label={copy.summary_total_mass} value={fmtNum(result.total_mass_tonnes)} />
            <Row label={copy.summary_embedded_emissions} value={fmtNum(result.total_embedded_emissions_t_co2)} emphasis />
            <Row label={copy.summary_certificates} value={fmtNum(result.certificates_required)} />
            <Row label={copy.summary_estimated_cost} value={fmtEur(result.estimated_cbam_cost_eur)} emphasis />
            <Row label={copy.summary_ets_price} value={fmtEur(result.ets_avg_price_eur_per_t)} />
          </div>

          <div className="mt-6 space-y-2">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{copy.summary_findings}</div>
            {fatalFindings.length === 0 && warningFindings.length === 0 && (
              <p className="text-[13.5px] text-emerald-300">{copy.summary_no_fatal}</p>
            )}
            {fatalFindings.map((f, i) => (
              <div key={`f-${i}`} className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-3 text-[13px] text-red-300">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] mr-2">{f.rule_id}</span>{messageOf(f)}
              </div>
            ))}
            {warningFindings.map((f, i) => (
              <div key={`w-${i}`} className="rounded-md border border-border bg-card p-3 text-[13px] text-muted-foreground">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] mr-2">{f.rule_id}</span>{messageOf(f)}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={`/signup${langSuffix}`} className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85">{copy.cta_after}</Link>
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

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={emphasis ? 'font-mono text-[16px] text-accent' : 'font-mono text-[14px] text-foreground/85'}>{value}</span>
    </div>
  );
}
