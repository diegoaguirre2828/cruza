'use client';

import { useState } from 'react';
import Link from 'next/link';

const MODULE_LABELS: Record<string, { en: string; es: string }> = {
  refunds: { en: 'IEEPA refunds', es: 'Reembolsos IEEPA' },
  drawback: { en: '§1313 drawback', es: 'Drawback §1313' },
  pedimento: { en: 'VUCEM / pedimento', es: 'VUCEM / pedimento' },
  cbam: { en: 'EU CBAM', es: 'CBAM UE' },
  uflpa: { en: 'US UFLPA', es: 'UFLPA US' },
  driver_pass: { en: 'Driver pass', es: 'Driver pass' },
};

interface CrossRef {
  entry_number: string;
  fired_in_modules: string[];
  recoverable_usd: number;
  at_risk: { uflpa_high: boolean; cbam_in_scope: boolean };
}

interface OrchestratorResult {
  bundle_id: string;
  composed_at: string;
  modules_fired: string[];
  modules_skipped: Array<{ module: string; reason: string }>;
  cross_references: CrossRef[];
  totals: {
    recoverable_usd: number;
    estimated_fee_usd: number;
    estimated_net_to_you_usd: number;
    cbam_cost_eur: number;
    uflpa_high_risk_count: number;
    fatal_findings: number;
    blocking_actions_required: number;
  };
  spec_url: string;
  cta: string;
}

const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtEur = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function ScanClient({ lang, sampleBundle }: { lang: 'en' | 'es'; sampleBundle: object }) {
  const [bundleJson, setBundleJson] = useState(JSON.stringify(sampleBundle, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  async function run() {
    setError(null);
    setBusy(true);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(bundleJson); } catch (e) {
        setError('Invalid JSON: ' + (e as Error).message);
        return;
      }
      const r = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (r.status === 429) { setError('Rate limited — try again in an hour.'); return; }
      const j = await r.json();
      if (!r.ok) { setError(j?.error ?? 'error'); return; }
      setResult(j as OrchestratorResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBundleJson(JSON.stringify(sampleBundle, null, 2));
    setResult(null);
    setError(null);
  }

  const modLabel = (m: string) => MODULE_LABELS[m]?.[lang] ?? m;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      {/* LEFT — input */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            ShipmentBundle (JSON)
          </div>
          <button onClick={reset} type="button" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
            reset to sample
          </button>
        </div>
        <textarea
          value={bundleJson}
          onChange={(e) => setBundleJson(e.target.value)}
          spellCheck={false}
          className="w-full h-[520px] rounded-lg border border-border bg-card p-4 font-mono text-[12px] leading-[1.5] text-foreground outline-none focus:border-foreground/60 resize-y"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            type="button"
            className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:bg-foreground/85 disabled:opacity-50"
          >
            {busy ? 'Running orchestrator…' : 'Run universal scan'}
          </button>
          <span className="text-[11.5px] text-muted-foreground/80">
            10 free scans / IP / hour · no signup
          </span>
        </div>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[14px] text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* RIGHT — result */}
      <div className="space-y-5">
        {!result && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              Result
            </div>
            <p className="mt-3 text-[14px] text-muted-foreground/80">
              Drop a bundle on the left and run the orchestrator. The result lands here — every
              applicable module fires in parallel; cross-references surface; totals aggregate.
            </p>
          </div>
        )}

        {result && (
          <>
            {/* Headline totals */}
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
                Aggregate · Bundle {result.bundle_id}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-6">
                <Stat label="Recoverable" value={fmtUsd(result.totals.recoverable_usd)} emphasis />
                <Stat label="Cruzar fee (8%)" value={fmtUsd(result.totals.estimated_fee_usd)} />
                <Stat label="Net to you" value={fmtUsd(result.totals.estimated_net_to_you_usd)} emphasis />
                <Stat label="Modules fired" value={String(result.modules_fired.length)} />
                <Stat label="CBAM cost (EUR)" value={fmtEur(result.totals.cbam_cost_eur)} />
                <Stat label="Blocking actions" value={String(result.totals.blocking_actions_required)} colorClass={result.totals.blocking_actions_required > 0 ? 'text-red-300' : 'text-emerald-300'} />
              </div>
            </div>

            {/* Modules fired */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                Modules that fired ({result.modules_fired.length})
              </div>
              {result.modules_fired.length === 0 && (
                <p className="mt-3 text-[13.5px] text-muted-foreground">
                  No module had enough data. Add entries / exports / supply chain / cbam goods / driver context.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.modules_fired.map((m) => (
                  <span key={m} className="rounded-md border border-foreground/30 bg-foreground/[0.04] px-2.5 py-1 text-[11.5px] font-mono text-foreground">
                    {modLabel(m)}
                  </span>
                ))}
              </div>
              {result.modules_skipped.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
                    Skipped ({result.modules_skipped.length}) — why
                  </summary>
                  <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground/80">
                    {result.modules_skipped.map((s) => (
                      <li key={s.module}>
                        <span className="font-mono text-foreground/70">{modLabel(s.module)}:</span> {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Cross-references — the "they talk" surface */}
            {result.cross_references.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                  Cross-references — entries × modules
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground/80">
                  Each entry shows every module it fired in. Multi-module entries are the substrate composing.
                </p>
                <div className="mt-4 space-y-2">
                  {result.cross_references.map((r) => (
                    <div key={r.entry_number} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <code className="font-mono text-[12px] text-foreground">{r.entry_number}</code>
                        <div className="flex flex-wrap gap-1.5">
                          {r.fired_in_modules.map((m) => (
                            <span key={m} className="rounded border border-border bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-foreground/85">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
                        <span>recoverable: <span className="font-mono text-foreground/85">{fmtUsd(r.recoverable_usd)}</span></span>
                        {r.at_risk.uflpa_high && <span className="text-red-300">UFLPA high-risk</span>}
                        {r.at_risk.cbam_in_scope && <span className="text-foreground">CBAM in scope</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-[13.5px] text-muted-foreground">{result.cta}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href={`/signup${langSuffix}`} className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:bg-foreground/85">
                  Sign up to compose a signed Ticket
                </Link>
                <Link href={`/spec/ticket-v1${langSuffix}`} className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
                  spec →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis = false, colorClass }: { label: string; value: string; emphasis?: boolean; colorClass?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">{label}</div>
      <div className={`mt-0.5 font-mono ${emphasis ? 'text-[18px]' : 'text-[14px]'} ${colorClass ?? (emphasis ? 'text-accent' : 'text-foreground/85')}`}>
        {value}
      </div>
    </div>
  );
}
