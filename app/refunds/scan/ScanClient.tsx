'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface ScanCopy {
  drop_label: string;
  scanning: string;
  rate_limited: string;
  parse_failed: string;
  summary_title: string;
  summary_total_recoverable: string;
  summary_principal: string;
  summary_interest: string;
  summary_cape_eligible: string;
  summary_protest_required: string;
  summary_past_window: string;
  summary_estimated_fee: string;
  summary_net_to_you: string;
  cta_after: string;
  cta_subnote: string;
}

import { CrossModuleHintsPanel, type CrossModuleHint } from '@/components/CrossModuleHintsPanel';

interface ScanResult {
  total_entries: number;
  cape_eligible_count: number;
  protest_required_count: number;
  past_protest_window_count: number;
  ineligible_count: number;
  total_principal_recoverable_usd: number;
  total_interest_recoverable_usd: number;
  total_recoverable_usd: number;
  estimated_cruzar_fee_usd: number;
  estimated_net_to_you_usd: number;
  registry_version: string;
  cross_module_hints?: CrossModuleHint[];
  universal_scan_url?: string;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function ScanClient({ lang, copy }: { lang: 'en' | 'es'; copy: ScanCopy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('csv', file);
      const r = await fetch('/api/refunds/scan', { method: 'POST', body: fd });
      if (r.status === 429) {
        setError(copy.rate_limited);
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error === 'parse_failed' ? copy.parse_failed : j?.error ?? 'error');
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
    <div>
      <label
        className="block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 text-center text-[15px] text-muted-foreground hover:border-foreground/60 hover:text-foreground"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {busy ? copy.scanning : copy.drop_label}
      </label>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[14px] text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 rounded-xl border border-accent/30 bg-accent/10 p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
            {copy.summary_title}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
            <Row label={copy.summary_total_recoverable} value={fmt(result.total_recoverable_usd)} emphasis />
            <Row label={copy.summary_principal} value={fmt(result.total_principal_recoverable_usd)} />
            <Row label={copy.summary_interest} value={fmt(result.total_interest_recoverable_usd)} />
            <Row label={copy.summary_cape_eligible} value={String(result.cape_eligible_count)} />
            <Row label={copy.summary_protest_required} value={String(result.protest_required_count)} />
            <Row label={copy.summary_past_window} value={String(result.past_protest_window_count)} />
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
    </div>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span
        className={
          emphasis
            ? 'font-mono text-[16px] text-accent'
            : 'font-mono text-[14px] text-foreground/85'
        }
      >
        {value}
      </span>
    </div>
  );
}
