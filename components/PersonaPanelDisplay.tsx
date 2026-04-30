"use client";

// Shared display component for lib/personaPanel.ts results.
// Used by /dispatch/paperwork/usmca, /dispatch/load, /insights, alerts.
// Renders the synthesis headline + per-persona perspectives + flags +
// optional click-to-apply action.

import { useState } from "react";

export interface PersonaResponse {
  persona_id: string;
  persona_label: string;
  perspective: string;
  flags: string[];
  confidence: "high" | "medium" | "low";
}

export interface PanelResult {
  responses: PersonaResponse[];
  synthesis: string;
  agreement: "aligned" | "split" | "conflict";
  highest_confidence: "high" | "medium" | "low";
  cost_estimate_usd: number;
  ms: number;
}

const CONFIDENCE_BADGE: Record<PersonaResponse["confidence"], { tone: string; label: string }> = {
  high: { tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", label: "high" },
  medium: { tone: "border-amber-400/30 bg-amber-500/10 text-amber-200", label: "medium" },
  low: { tone: "border-rose-400/30 bg-rose-500/10 text-rose-200", label: "low" },
};

const AGREEMENT_BADGE: Record<PanelResult["agreement"], string> = {
  aligned: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  split: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  conflict: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

export interface PersonaPanelDisplayProps {
  result: PanelResult;
  /** Optional verdict pill rendered next to the agreement badge */
  verdict?: { label: string; tone: "good" | "warn" | "bad" };
  /** When set, each persona perspective gets a "use <code>" button if a 6-digit
   *  HS code can be parsed from it (XXXX.XX). Used by the USMCA HS suggester. */
  onApplyHsCode?: (code: string) => void;
  /** Hide the cost line (default false). Useful for buyer-facing surfaces. */
  hideCost?: boolean;
  /** Defaults open; pass false to render collapsed with a toggle */
  defaultOpen?: boolean;
}

export function PersonaPanelDisplay({
  result,
  verdict,
  onApplyHsCode,
  hideCost = false,
  defaultOpen = true,
}: PersonaPanelDisplayProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Synthesis headline */}
      <div className="rounded-lg border border-white/[0.08] bg-[#040814] p-3 mb-3">
        <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/55">Synthesis</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border ${AGREEMENT_BADGE[result.agreement]}`}
          >
            {result.agreement}
          </span>
          {verdict && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border ${
                verdict.tone === "good"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  : verdict.tone === "warn"
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    : "border-rose-400/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {verdict.label}
            </span>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-[11px] text-white/45 hover:text-white"
          >
            {open ? "▲ collapse" : `▼ ${result.responses.length} perspectives`}
          </button>
        </div>
        <p className="text-[13px] text-white/85 leading-[1.55]">{result.synthesis}</p>
      </div>

      {/* Per-persona */}
      {open && (
        <ul className="space-y-2">
          {result.responses.map((r) => {
            const code = onApplyHsCode ? r.perspective.match(/\b(\d{4}\.\d{2})\b/)?.[1] : undefined;
            const conf = CONFIDENCE_BADGE[r.confidence];
            return (
              <li
                key={r.persona_id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-white">{r.persona_label}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em] ${conf.tone}`}
                    >
                      {conf.label}
                    </span>
                  </div>
                  {code && onApplyHsCode && (
                    <button
                      onClick={() => onApplyHsCode(code)}
                      className="rounded-md border border-amber-300/40 bg-amber-300/[0.06] px-2 py-0.5 font-mono text-[11px] text-amber-200 hover:bg-amber-300/[0.12]"
                    >
                      use {code}
                    </button>
                  )}
                </div>
                <p className="text-[12.5px] text-white/75 leading-[1.55]">{r.perspective}</p>
                {r.flags.length > 0 && (
                  <ul className="mt-1.5 list-disc list-inside text-[11.5px] text-amber-200/75 leading-[1.5]">
                    {r.flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && !hideCost && (
        <div className="mt-2 text-[10px] text-white/30 font-mono">
          cost ≈ ${result.cost_estimate_usd.toFixed(4)} · {result.ms}ms · highest_confidence=
          {result.highest_confidence}
        </div>
      )}
    </div>
  );
}
