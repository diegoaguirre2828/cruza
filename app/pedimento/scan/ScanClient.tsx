'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CrossModuleHintsPanel, type CrossModuleHint } from '@/components/CrossModuleHintsPanel';

interface ScanCopy {
  section_agente: string;
  patente_label: string;
  agente_name_label: string;
  agente_rfc_label: string;
  section_importador: string;
  importador_rfc_label: string;
  importador_razon_label: string;
  importador_estado_label: string;
  importador_padron_label: string;
  importador_immex_label: string;
  section_operacion: string;
  operacion_label: string;
  operacion_import: string;
  operacion_export: string;
  operacion_transit: string;
  operacion_return: string;
  regimen_label: string;
  regimen_definitivo: string;
  regimen_temporal: string;
  regimen_deposito: string;
  regimen_transito: string;
  aduana_label: string;
  fecha_label: string;
  section_mercancia: string;
  fraccion_label: string;
  nico_label: string;
  descripcion_label: string;
  pais_origen_label: string;
  pais_vendedor_label: string;
  cantidad_label: string;
  unidad_label: string;
  valor_factura_label: string;
  ad_valorem_label: string;
  ieps_label: string;
  submit: string;
  scanning: string;
  rate_limited: string;
  summary_title: string;
  summary_clave: string;
  summary_regimen: string;
  summary_rfc_validation: string;
  summary_patente_validation: string;
  summary_padron: string;
  summary_findings: string;
  summary_no_fatal: string;
  summary_total_value: string;
  summary_ad_valorem: string;
  summary_dta: string;
  summary_iva: string;
  summary_ieps: string;
  summary_total_contributions: string;
  cta_after: string;
  cta_subnote: string;
}

interface ScanResult {
  clave: string;
  regimen: string;
  rfc_validacion: string;
  patente_validacion: string;
  padron_status: string;
  total_mercancias: number;
  total_valor_factura_usd: number;
  impuestos: {
    ad_valorem_usd: number;
    dta_usd: number;
    iva_usd: number;
    ieps_usd: number;
    total_contribuciones_usd: number;
  };
  findings: Array<{
    rule_id: string;
    severity: 'fatal' | 'warning' | 'info';
    field?: string;
    message_es: string;
    message_en: string;
  }>;
  registry_version: string;
  cross_module_hints?: CrossModuleHint[];
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  // Agente
  const [patente, setPatente] = useState('');
  const [agenteName, setAgenteName] = useState('');
  const [agenteRfc, setAgenteRfc] = useState('');

  // Importador
  const [importadorRfc, setImportadorRfc] = useState('');
  const [importadorRazon, setImportadorRazon] = useState('');
  const [importadorEstado, setImportadorEstado] = useState('');
  const [padronActivo, setPadronActivo] = useState(true);
  const [immex, setImmex] = useState('');

  // Operación
  const [operacion, setOperacion] = useState<'importacion' | 'exportacion' | 'transito' | 'retorno'>('importacion');
  const [regimen, setRegimen] = useState<'definitivo' | 'temporal' | 'deposito_fiscal' | 'transito'>('definitivo');
  const [aduana, setAduana] = useState('');
  const [fecha, setFecha] = useState('');

  // Mercancía
  const [fraccion, setFraccion] = useState('');
  const [nico, setNico] = useState('00');
  const [descripcion, setDescripcion] = useState('');
  const [paisOrigen, setPaisOrigen] = useState('');
  const [paisVendedor, setPaisVendedor] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('PZA');
  const [valorFactura, setValorFactura] = useState('');
  const [adValorem, setAdValorem] = useState('');
  const [ieps, setIeps] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/pedimento/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agente: { patente, nombre_o_razon_social: agenteName, rfc: agenteRfc.toUpperCase() },
          importador_exportador: {
            rfc: importadorRfc.toUpperCase(),
            razon_social: importadorRazon,
            domicilio_fiscal_estado: importadorEstado.toUpperCase(),
            padron_importadores_activo: padronActivo,
            programa_immex: immex.trim() || undefined,
          },
          operacion,
          regimen,
          aduana_codigo: aduana,
          fecha_operacion: fecha,
          mercancias: [{
            fraccion_arancelaria: fraccion,
            nico,
            descripcion,
            pais_origen: paisOrigen.toUpperCase(),
            pais_vendedor: paisVendedor.toUpperCase(),
            cantidad: Number(cantidad) || 0,
            unidad_medida_comercial: unidad,
            valor_factura_usd: Number(valorFactura) || 0,
            valor_dolares: Number(valorFactura) || 0,
            ad_valorem_pct: Number(adValorem) || 0,
            iva_pct: 16,
            ieps_aplicable: ieps,
          }],
          forma_pago: 'transferencia',
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

  const fatalFindings = result?.findings.filter((f) => f.severity === 'fatal') ?? [];
  const otherFindings = result?.findings.filter((f) => f.severity !== 'fatal') ?? [];
  const messageOf = (f: { message_es: string; message_en: string }) =>
    lang === 'es' ? f.message_es : f.message_en;

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title={copy.section_agente}>
        <Field label={copy.patente_label} value={patente} onChange={(v) => setPatente(v.replace(/\D/g, '').slice(0, 4))} required mono />
        <Field label={copy.agente_name_label} value={agenteName} onChange={setAgenteName} required />
        <Field label={copy.agente_rfc_label} value={agenteRfc} onChange={(v) => setAgenteRfc(v.toUpperCase().slice(0, 13))} required mono />
      </Section>

      <Section title={copy.section_importador}>
        <Field label={copy.importador_rfc_label} value={importadorRfc} onChange={(v) => setImportadorRfc(v.toUpperCase().slice(0, 13))} required mono />
        <Field label={copy.importador_razon_label} value={importadorRazon} onChange={setImportadorRazon} required />
        <Field label={copy.importador_estado_label} value={importadorEstado} onChange={(v) => setImportadorEstado(v.toUpperCase().slice(0, 3))} required mono />
        <Field label={copy.importador_immex_label} value={immex} onChange={setImmex} mono />
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80 sm:col-span-2">
          <input type="checkbox" checked={padronActivo} onChange={(e) => setPadronActivo(e.target.checked)} />
          {copy.importador_padron_label}
        </label>
      </Section>

      <Section title={copy.section_operacion}>
        <Select label={copy.operacion_label} value={operacion} onChange={(v) => setOperacion(v as typeof operacion)} options={[
          { v: 'importacion', label: copy.operacion_import },
          { v: 'exportacion', label: copy.operacion_export },
          { v: 'transito', label: copy.operacion_transit },
          { v: 'retorno', label: copy.operacion_return },
        ]} />
        <Select label={copy.regimen_label} value={regimen} onChange={(v) => setRegimen(v as typeof regimen)} options={[
          { v: 'definitivo', label: copy.regimen_definitivo },
          { v: 'temporal', label: copy.regimen_temporal },
          { v: 'deposito_fiscal', label: copy.regimen_deposito },
          { v: 'transito', label: copy.regimen_transito },
        ]} />
        <Field label={copy.aduana_label} value={aduana} onChange={(v) => setAduana(v.replace(/\D/g, '').slice(0, 3))} required mono />
        <Field label={copy.fecha_label} value={fecha} onChange={setFecha} required mono type="date" />
      </Section>

      <Section title={copy.section_mercancia}>
        <Field label={copy.fraccion_label} value={fraccion} onChange={(v) => setFraccion(v.replace(/\D/g, '').slice(0, 8))} required mono />
        <Field label={copy.nico_label} value={nico} onChange={(v) => setNico(v.replace(/\D/g, '').slice(0, 2))} required mono />
        <Field label={copy.descripcion_label} value={descripcion} onChange={setDescripcion} />
        <Field label={copy.pais_origen_label} value={paisOrigen} onChange={(v) => setPaisOrigen(v.toUpperCase().slice(0, 2))} required mono />
        <Field label={copy.pais_vendedor_label} value={paisVendedor} onChange={(v) => setPaisVendedor(v.toUpperCase().slice(0, 2))} required mono />
        <Field label={copy.cantidad_label} value={cantidad} onChange={(v) => setCantidad(v.replace(/[^\d.]/g, ''))} required mono />
        <Field label={copy.unidad_label} value={unidad} onChange={(v) => setUnidad(v.toUpperCase().slice(0, 5))} mono />
        <Field label={copy.valor_factura_label} value={valorFactura} onChange={(v) => setValorFactura(v.replace(/[^\d.]/g, ''))} required mono />
        <Field label={copy.ad_valorem_label} value={adValorem} onChange={(v) => setAdValorem(v.replace(/[^\d.]/g, ''))} mono />
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground/80">
          <input type="checkbox" checked={ieps} onChange={(e) => setIeps(e.target.checked)} />
          {copy.ieps_label}
        </label>
      </Section>

      <button
        type="submit"
        disabled={busy || !patente || !agenteRfc || !importadorRfc || !fraccion || !valorFactura}
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

          <div className="mt-5 grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
            <Row label={copy.summary_clave} value={result.clave} emphasis />
            <Row label={copy.summary_regimen} value={result.regimen} />
            <Row label={copy.summary_rfc_validation} value={result.rfc_validacion} />
            <Row label={copy.summary_patente_validation} value={result.patente_validacion} />
            <Row label={copy.summary_padron} value={result.padron_status} />
          </div>

          <div className="mt-6 space-y-2">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              {copy.summary_findings}
            </div>
            {fatalFindings.length === 0 && otherFindings.length === 0 && (
              <p className="text-[13.5px] text-emerald-300">{copy.summary_no_fatal}</p>
            )}
            {fatalFindings.map((f, i) => (
              <div key={`f-${i}`} className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-3 text-[13px] text-red-300">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] mr-2">{f.rule_id}</span>
                {messageOf(f)}
              </div>
            ))}
            {otherFindings.map((f, i) => (
              <div key={`o-${i}`} className="rounded-md border border-border bg-card p-3 text-[13px] text-muted-foreground">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] mr-2">{f.rule_id}</span>
                {messageOf(f)}
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
            <Row label={copy.summary_total_value} value={fmt(result.total_valor_factura_usd)} />
            <Row label={copy.summary_ad_valorem} value={fmt(result.impuestos.ad_valorem_usd)} />
            <Row label={copy.summary_dta} value={fmt(result.impuestos.dta_usd)} />
            <Row label={copy.summary_iva} value={fmt(result.impuestos.iva_usd)} />
            <Row label={copy.summary_ieps} value={fmt(result.impuestos.ieps_usd)} />
            <Row label={copy.summary_total_contributions} value={fmt(result.impuestos.total_contribuciones_usd)} emphasis />
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
