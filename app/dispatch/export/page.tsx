"use client";

// /dispatch/export — pull a CSV snapshot of any list of ports.
//
// SMB freight ops live in Excel + Google Sheets (cited research:
// "You can quickly end up in Excel Hell" — Cargado CEO Matt Silver). This is
// the surface that respects that reality. Paste port_ids, click Generate,
// download a CSV with live wait + 6h forecast + drift status.

import { useEffect, useMemo, useState } from "react";
import { PORT_META } from "@/lib/portMeta";

const WATCHED_KEY = "cruzar.dispatch.watched.v1";

interface DispatchPort {
  port_id: string;
  name: string;
  region: string;
  cluster: string;
  live_wait_min: number | null;
  predicted_6h_min: number | null;
  delta_min: number | null;
  anomaly_high: boolean;
  anomaly_ratio: number | null;
  drift_status: string;
}

function loadWatched(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ExportPage() {
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DispatchPort[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    const watched = loadWatched();
    if (watched.length > 0) setInput(watched.join("\n"));
    setHydrated(true);
  }, []);

  const portIds = useMemo(
    () =>
      input
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((id, i, arr) => arr.indexOf(id) === i),
    [input],
  );

  const validIds = useMemo(() => portIds.filter((id) => id in PORT_META), [portIds]);
  const invalidIds = useMemo(() => portIds.filter((id) => !(id in PORT_META)), [portIds]);

  async function generate() {
    if (validIds.length === 0) return;
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const res = await fetch(`/api/dispatch/snapshot?ports=${validIds.slice(0, 12).join(",")}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        return;
      }
      setRows(json.snapshot.ports as DispatchPort[]);
      setGeneratedAt(json.snapshot.generated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!rows) return;
    const header = [
      "port_id",
      "name",
      "region",
      "cluster",
      "live_wait_min",
      "predicted_6h_min",
      "delta_min",
      "anomaly_high",
      "anomaly_ratio",
      "drift_status",
      "generated_at",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.port_id,
          r.name,
          r.region,
          r.cluster,
          r.live_wait_min,
          r.predicted_6h_min,
          r.delta_min,
          r.anomaly_high,
          r.anomaly_ratio?.toFixed(2),
          r.drift_status,
          generatedAt ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `cruzar-dispatch-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-[1180px] px-5 sm:px-8 py-6">
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-semibold text-foreground">
          Export <span className="text-muted-foreground/70 text-base font-normal">· exportar</span>
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground/80 max-w-2xl">
          Drop port_ids one per line (or comma-separated). Generate a snapshot, then download as CSV.
          Open in Excel / Sheets / your TMS.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div>
          <label className="block text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80 mb-2">
            Port IDs
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={`230501\n230502\n230503\n230402`}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-[12.5px] text-foreground placeholder-white/25 focus:border-amber-300/40 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/70">
            <span>
              {validIds.length} valid · {invalidIds.length} invalid
              {invalidIds.length > 0 && (
                <span className="ml-1 text-rose-300/70" title={invalidIds.join(", ")}>
                  ({invalidIds.slice(0, 3).join(", ")}
                  {invalidIds.length > 3 ? "…" : ""})
                </span>
              )}
            </span>
            <span>max 12 per batch</span>
          </div>

          <button
            onClick={generate}
            disabled={loading || validIds.length === 0}
            className="mt-4 w-full rounded-xl bg-foreground py-2.5 text-[13.5px] font-semibold text-background hover:bg-foreground disabled:opacity-50 transition"
          >
            {loading ? "Generating…" : "Generate snapshot"}
          </button>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-[12px] text-rose-200">
              ✗ {error}
            </div>
          )}

          <p className="mt-5 text-[10.5px] text-muted-foreground/60 leading-[1.5]">
            {hydrated && loadWatched().length > 0 ? (
              <>Pre-filled from your /dispatch watched list.</>
            ) : (
              <>No watched list yet — paste port_ids manually or set up a list on /dispatch.</>
            )}
          </p>
        </div>

        <div>
          {!rows && !loading && (
            <div className="rounded-2xl border border-dashed border-border bg-foreground/[0.01] p-10 text-center text-[12.5px] text-muted-foreground/70">
              CSV preview appears here.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="rounded-2xl border border-border bg-foreground/[0.02]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  Snapshot · {rows.length} ports
                  {generatedAt && (
                    <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal">
                      ({new Date(generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })})
                    </span>
                  )}
                </div>
                <button
                  onClick={download}
                  className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[12px] font-semibold text-background hover:bg-emerald-300 transition"
                >
                  Download CSV ↓
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left">Port</th>
                      <th className="px-4 py-2 text-right">Now</th>
                      <th className="px-4 py-2 text-right">+6h</th>
                      <th className="px-4 py-2 text-right">Δ</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {rows.map((r) => (
                      <tr key={r.port_id}>
                        <td className="px-4 py-2 text-foreground">
                          {r.name} <span className="ml-1 font-mono text-[10px] text-muted-foreground/60">{r.port_id}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-foreground">
                          {r.live_wait_min ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                          {r.predicted_6h_min ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground/80">
                          {r.delta_min ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-muted-foreground">{r.drift_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
