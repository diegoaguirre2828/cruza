'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ScanCopy {
  section_importer: string;
  importer_name_label: string;
  importer_ein_label: string;
  section_shipment: string;
  htsus_label: string;
  description_label: string;
  arrival_label: string;
  port_label: string;
  declared_value_label: string;
  section_supply_chain: string;
  add_tier: string;
  remove_tier: string;
  tier_label: string;
  supplier_label: string;
  country_label: string;
  province_label: string;
  is_xinjiang_label: string;
  is_entity_list_label: string;
  has_audit_label: string;
  has_affidavit_label: string;
  submit: string;
  scanning: string;
  rate_limited: string;
  summary_title: string;
  summary_risk_level: string;
  summary_presumption: string;
  summary_xinjiang_tier: string;
  summary_xinjiang_none: string;
  summary_entity_hits: string;
  summary_sectors: string;
  summary_evidence: string;
  summary_actions: string;
  summary_findings: string;
  summary_low_risk: string;
  cta_after: string;
  cta_subnote: string;
}

interface SupplyTierState {
  tier: number;
  supplier_name: string;
  country_iso: string;
  province_or_state: string;
  is_on_uflpa_entity_list: boolean;
  produced_in_xinjiang: boolean;
  audit_evidence_present: boolean;
  affidavit_present: boolean;
}

interface ScanResult {
  risk_level: string;
  rebuttable_presumption_triggered: boolean;
  high_risk_sectors_detected: string[];
  xinjiang_tier: number | null;
  entity_list_hits: Array<{ tier: number; supplier: string }>;
  evidence_quality: string;
  required_actions: string[];
  findings: Array<{ rule_id: string; severity: 'fatal' | 'warning' | 'info'; message_en: string; message_es: string }>;
  registry_version: string;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const RISK_COLORS: Record<string, string> = {
  high: 'text-red-300',
  medium: 'text-foreground',
  low: 'text-emerald-300',
  unknown: 'text-muted-foreground',
};

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  const [importerName, setImporterName] = useState('');
  const [importerEin, setImporterEin] = useState('');

  const [htsus, setHtsus] = useState('');
  const [description, setDescription] = useState('');
  const [arrival, setArrival] = useState('');
  const [port, setPort] = useState('');
  const [value, setValue] = useState('');

  const [tiers, setTiers] = useState<SupplyTierState[]>([
    { tier: 0, supplier_name: '', country_iso: '', province_or_state: '', is_on_uflpa_entity_list: false, produced_in_xinjiang: false, audit_evidence_present: false, affidavit_present: false },
  ]);

  function addTier() {
    setTiers((prev) => [...prev, { tier: prev.length, supplier_name: '', country_iso: '', province_or_state: '', is_on_uflpa_entity_list: false, produced_in_xinjiang: false, audit_evidence_present: false, affidavit_present: false }]);
  }
  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, tier: i })));
  }
  function updateTier(idx: number, patch: Partial<SupplyTierState>) {
    setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/uflpa/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          importer_name: importerName,
          importer_ein: importerEin,
          htsus_code: htsus,
          product_description: description,
          expected_arrival_iso: arrival || new Date().toISOString(),
          port_of_entry: port,
          declared_value_usd: Number(value) || 0,
          supply_chain: tiers.map((t) => ({
            tier: t.tier,
            supplier_name: t.supplier_name,
            country_iso: t.country_iso.toUpperCase(),
            province_or_state: t.province_or_state || undefined,
            is_on_uflpa_entity_list: t.is_on_uflpa_entity_list,
            produced_in_xinjiang: t.produced_in_xinjiang,
            audit_evidence_present: t.audit_evidence_present,
            affidavit_present: t.affidavit_present,
          })),
          total_supplier_traceability_tiers: tiers.length,
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
  const messageOf = (f: { message_en: string; message_es: string }) => lang === 'es' ? f.message_es : f.message_en;

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title={copy.section_importer}>
        <Field label={copy.importer_name_label} value={importerName} onChange={setImporterName} required />
        <Field label={copy.importer_ein_label} value={importerEin} onChange={(v) => setImporterEin(v.slice(0, 30))} required mono />
      </Section>

      <Section title={copy.section_shipment}>
        <Field label={copy.htsus_label} value={htsus} onChange={(v) => setHtsus(v.replace(/[^\d.]/g, '').slice(0, 13))} required mono />
        <Field label={copy.description_label} value={description} onChange={setDescription} />
        <Field label={copy.arrival_label} value={arrival} onChange={setArrival} mono type="date" />
        <Field label={copy.port_label} value={port} onChange={(v) => setPort(v.replace(/\D/g, '').slice(0, 4))} mono />
        <Field label={copy.declared_value_label} value={value} onChange={(v) => setValue(v.replace(/[^\d.]/g, ''))} mono />
      </Section>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="font-serif text-[16px] text-foreground">{copy.section_supply_chain}</div>
          <button type="button" onClick={addTier} className="rounded-md border border-border px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.16em] text-muted-foreground hover:border-foreground hover:text-foreground transition">
            + {copy.add_tier}
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {tiers.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">{copy.tier_label} {i}</span>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(i)} className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-red-300">{copy.remove_tier}</button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={copy.supplier_label} value={t.supplier_name} onChange={(v) => updateTier(i, { supplier_name: v })} required />
                <Field label={copy.country_label} value={t.country_iso} onChange={(v) => updateTier(i, { country_iso: v.toUpperCase().slice(0, 2) })} required mono />
                <Field label={copy.province_label} value={t.province_or_state} onChange={(v) => updateTier(i, { province_or_state: v })} />
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground/80">
                    <input type="checkbox" checked={t.produced_in_xinjiang} onChange={(e) => updateTier(i, { produced_in_xinjiang: e.target.checked })} />
                    {copy.is_xinjiang_label}
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground/80">
                    <input type="checkbox" checked={t.is_on_uflpa_entity_list} onChange={(e) => updateTier(i, { is_on_uflpa_entity_list: e.target.checked })} />
                    {copy.is_entity_list_label}
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground/80">
                    <input type="checkbox" checked={t.audit_evidence_present} onChange={(e) => updateTier(i, { audit_evidence_present: e.target.checked })} />
                    {copy.has_audit_label}
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground/80">
                    <input type="checkbox" checked={t.affidavit_present} onChange={(e) => updateTier(i, { affidavit_present: e.target.checked })} />
                    {copy.has_affidavit_label}
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={busy || !htsus || tiers.length === 0 || !tiers[0].supplier_name} className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 disabled:opacity-50">
        {busy ? copy.scanning : copy.submit}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[14px] text-red-300">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">{copy.summary_title}</div>

          <div className="mt-5 space-y-3">
            <Row label={copy.summary_risk_level} value={result.risk_level.toUpperCase()} colorClass={RISK_COLORS[result.risk_level]} emphasis />
            <Row label={copy.summary_presumption} value={result.rebuttable_presumption_triggered ? 'TRIGGERED' : 'NOT TRIGGERED'} colorClass={result.rebuttable_presumption_triggered ? 'text-red-300' : 'text-emerald-300'} />
            <Row
              label={copy.summary_xinjiang_tier}
              value={result.xinjiang_tier !== null ? `Tier ${result.xinjiang_tier}` : copy.summary_xinjiang_none}
              colorClass={result.xinjiang_tier !== null ? 'text-red-300' : 'text-emerald-300'}
            />
            {result.entity_list_hits.length > 0 && (
              <div>
                <div className="text-[13px] text-muted-foreground mb-1">{copy.summary_entity_hits}</div>
                <ul className="space-y-1">
                  {result.entity_list_hits.map((h, i) => (
                    <li key={i} className="text-[13px] text-red-300 font-mono">Tier {h.tier} · {h.supplier}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.high_risk_sectors_detected.length > 0 && (
              <div>
                <div className="text-[13px] text-muted-foreground mb-1">{copy.summary_sectors}</div>
                <div className="flex flex-wrap gap-2">
                  {result.high_risk_sectors_detected.map((s) => (
                    <span key={s} className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.14em] text-foreground/85">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <Row label={copy.summary_evidence} value={result.evidence_quality} />
          </div>

          {result.required_actions.length > 0 && (
            <div className="mt-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{copy.summary_actions}</div>
              <ul className="mt-2 space-y-2 list-disc list-inside text-[13.5px] text-foreground/85">
                {result.required_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{copy.summary_findings}</div>
            {fatalFindings.length === 0 && warningFindings.length === 0 && (
              <p className="text-[13.5px] text-emerald-300">{copy.summary_low_risk}</p>
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

function Row({ label, value, emphasis = false, colorClass }: { label: string; value: string; emphasis?: boolean; colorClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`${emphasis ? 'font-mono text-[16px]' : 'font-mono text-[14px]'} ${colorClass ?? 'text-foreground/85'}`}>{value}</span>
    </div>
  );
}
