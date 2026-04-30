"use client";

// Insights "Ask 3 experts" — buyer-facing trust panel.
// Pick a port → 3-persona panel (Skeptical buyer / Honest broker / Audit
// critic) gives a 1-sentence honest read on whether THAT port's lift
// numbers are worth paying for. Direct answer to Diego's complaint that
// "+52% better than CBP" cherry-picks one outlier.
//
// Cost is real ($0.0005/run, Haiku). Cap at one panel per page-load
// per port — no auto-fire.

import { useState } from "react";
import { PersonaPanelDisplay, type PanelResult } from "./PersonaPanelDisplay";

interface PortOption {
  port_id: string;
  label: string;
  lift_vs_cbp: number | null;
  status: string;
}

interface InsightsExpertPanelProps {
  /** Pre-built port options for the picker (server-side from manifest) */
  ports: PortOption[];
}

export function InsightsExpertPanel({ ports }: InsightsExpertPanelProps) {
  const [portId, setPortId] = useState(ports[0]?.port_id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelResult | null>(null);

  async function run() {
    if (!portId) return;
    setLoading(true);
    setError(null);
    setPanel(null);
    try {
      const res = await fetch("/api/insights/drift-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port_id: portId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      setPanel(json.panel as PanelResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  const selected = ports.find((p) => p.port_id === portId);

  return (
    <section className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12 border-y border-white/[0.07]">
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-amber-300/80">
          Ask 3 experts
        </div>
        <h2 className="mt-2 text-[clamp(1.4rem,2.5vw,1.9rem)] font-serif italic font-normal text-white tracking-tight">
          Pick a port. We&apos;ll run the lift number through 3 perspectives.
        </h2>
        <p className="mt-2 text-[13px] text-white/55 max-w-2xl">
          Skeptical fleet buyer · Honest aduanal broker · Audit critic. They look at the same data
          and tell you, in plain language, whether the lift number you see is something to pay for
          or something we should be honest about. One quote got cherry-picked into the hero number
          you saw — this is the unvarnished read on YOUR specific port.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={portId}
          onChange={(e) => setPortId(e.target.value)}
          style={{ colorScheme: "dark" }}
          className="rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none min-w-[280px]"
        >
          {ports.map((p) => (
            <option key={p.port_id} value={p.port_id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={loading || !portId}
          className="rounded-lg bg-amber-400 px-4 py-2 text-[12.5px] font-semibold text-[#0a1020] hover:bg-amber-300 disabled:opacity-50"
        >
          {loading ? "Running 3-persona panel…" : panel ? "Re-run for this port" : "Run panel"}
        </button>
        {selected && (
          <span className="text-[11.5px] text-white/45 font-mono tabular-nums">
            {selected.port_id} · status: <span className="text-white/65">{selected.status}</span>
            {selected.lift_vs_cbp !== null && (
              <>
                {" · lift vs CBP: "}
                <span className={selected.lift_vs_cbp >= 5 ? "text-emerald-300" : selected.lift_vs_cbp >= 0 ? "text-amber-300" : "text-rose-300"}>
                  {selected.lift_vs_cbp.toFixed(1)}%
                </span>
              </>
            )}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-[12.5px] text-rose-200">
          ✗ {error}
        </div>
      )}

      {panel && (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.03] p-5">
          <PersonaPanelDisplay result={panel} hideCost />
        </div>
      )}

      {!panel && !loading && !error && (
        <p className="mt-5 text-[11px] text-white/35 italic">
          Press <span className="text-amber-300/80">Run panel</span>. Single Haiku call,
          ~$0.0005/run, ~3-6 seconds. Each panel result lives in the page only — not saved
          anywhere.
        </p>
      )}
    </section>
  );
}
