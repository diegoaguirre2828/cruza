"use client";

// Per-port read for the Insights B2B page.
// Pick a port → server-side multi-persona critique runs internally → only the
// synthesized one-line verdict ships to the user. The persona scaffolding
// (skeptical buyer / honest broker / audit critic) lives in
// lib/personaPanel.ts and /api/insights/drift-review — never on the page.
// Cost gated by explicit click ($0.0005/run, Haiku).

import { useState } from "react";
import { type PanelResult } from "./PersonaPanelDisplay";

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
    <section className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 border-y border-white/[0.07]">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={portId}
          onChange={(e) => {
            setPortId(e.target.value);
            setPanel(null);
            setError(null);
          }}
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
          {loading ? "Reading…" : panel ? "Re-run" : "Get the read"}
        </button>
        {selected && (
          <span className="text-[11.5px] text-white/45 font-mono tabular-nums">
            {selected.port_id} · status: <span className="text-white/65">{selected.status}</span>
            {selected.lift_vs_cbp !== null && (
              <>
                {" · lift vs CBP: "}
                <span
                  className={
                    selected.lift_vs_cbp >= 5
                      ? "text-emerald-300"
                      : selected.lift_vs_cbp >= 0
                        ? "text-amber-300"
                        : "text-rose-300"
                  }
                >
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
        <p className="mt-4 max-w-2xl text-[14px] leading-[1.55] text-white/85">
          {panel.synthesis}
        </p>
      )}
    </section>
  );
}
