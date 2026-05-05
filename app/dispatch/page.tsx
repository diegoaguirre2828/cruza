"use client";

// /dispatch — live dispatcher console.
//
// What it is: the screen a broker keeps open all shift. Watched ports
// auto-refresh every 60s. Anomaly badges fire when a port runs ≥1.5× its
// 90-day DOW × hour baseline. Click a row to expand for live + 6h forecast
// + drift status + raw CBP age.
//
// State: watched port_ids persisted in localStorage AND mirrored to ?ports=
// query param so a dispatcher can bookmark / share a specific watch list.

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { PORT_META } from "@/lib/portMeta";
import Link from "next/link";
import { AlertsRail } from "@/components/AlertsRail";

const REFRESH_MS = 60_000;
const STORAGE_KEY = "cruzar.dispatch.watched.v1";
const DEFAULT_WATCHED = ["230502", "230501", "230503", "535501", "230402"]; // RGV-heavy starter
const DEMO_WATCHED = ["230502", "230501", "230503", "230402", "230403", "535501"]; // Raul's broker-office demo preset

interface DispatchPort {
  port_id: string;
  name: string;
  region: string;
  cluster: string;
  live_wait_min: number | null;
  live_recorded_at: string | null;
  live_stale_min: number | null;
  predicted_6h_min: number | null;
  delta_min: number | null;
  anomaly_high: boolean;
  anomaly_ratio: number | null;
  drift_status:
    | "decision-grade"
    | "marginal"
    | "self-baseline"
    | "marginal-self"
    | "drift-fallback"
    | "untracked";
  has_forecast: boolean;
}

interface SnapshotResponse {
  snapshot: { generated_at: string; ports: DispatchPort[] };
}

interface SubscriberPrefs {
  id: number;
  tier: 'free' | 'starter' | 'pro' | 'fleet';
  status: string;
  language: 'en' | 'es';
  briefing_enabled: boolean;
  briefing_local_hour: number;
  briefing_tz: string;
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
  last_anomaly_fired_at: string | null;
}

const fetcher = <T,>(url: string): Promise<T> => fetch(url).then((r) => r.json());

function loadWatched(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCHED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHED;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((s) => typeof s === "string")) return arr;
    return DEFAULT_WATCHED;
  } catch {
    return DEFAULT_WATCHED;
  }
}

function saveWatched(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* quota — fail silent */
  }
}

const STATUS_LABEL: Record<DispatchPort["drift_status"], { en: string; tone: string }> = {
  "decision-grade": { en: "decision-grade", tone: "text-emerald-300/90" },
  marginal: { en: "marginal vs CBP", tone: "text-foreground/90" },
  "self-baseline": { en: "first-party baseline", tone: "text-sky-300/90" },
  "marginal-self": { en: "marginal (self)", tone: "text-foreground/70" },
  "drift-fallback": { en: "matching CBP", tone: "text-slate-400" },
  untracked: { en: "untracked", tone: "text-muted-foreground/50" },
};

export default function DispatchConsole() {
  const router = useRouter();
  const params = useSearchParams();
  const [watched, setWatched] = useState<string[]>(DEFAULT_WATCHED);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Hydrate from URL → fallback to localStorage. URL wins so shared links work.
  // Demo mode (?demo=rgv) loads a preset RGV-heavy list and skips persistence.
  useEffect(() => {
    if (params.get("demo") === "rgv") {
      setWatched(DEMO_WATCHED);
      setHydrated(true);
      return;
    }
    const fromUrl = params.get("ports")?.split(",").filter(Boolean) ?? null;
    const initial = fromUrl && fromUrl.length > 0 ? fromUrl : loadWatched();
    setWatched(initial);
    setHydrated(true);
  }, [params]);

  // Persist + mirror to URL whenever watched changes after hydration.
  // Demo mode skips persistence — read-only preset for in-office demos.
  useEffect(() => {
    if (!hydrated) return;
    if (params.get("demo") === "rgv") return;
    saveWatched(watched);
    const next = new URLSearchParams(params.toString());
    if (watched.length > 0) next.set("ports", watched.join(","));
    else next.delete("ports");
    router.replace(`/dispatch?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, hydrated]);

  const portsQuery = watched.join(",");
  const { data, isLoading, mutate } = useSWR<SnapshotResponse>(
    hydrated && watched.length > 0 ? `/api/dispatch/snapshot?ports=${portsQuery}` : null,
    fetcher,
    {
      refreshInterval: REFRESH_MS,
      revalidateOnFocus: true,
    },
  );

  // Subscriber preferences + accuracy summary fuel the stress-reliever hero.
  const { data: prefsData } = useSWR<{ subscriber: SubscriberPrefs | null }>(
    hydrated ? "/api/insights/preferences" : null,
    fetcher,
  );
  const subscriber = prefsData?.subscriber ?? null;
  const { data: accData } = useSWR<{ median_pct: number | null }>(
    hydrated && watched.length > 0 ? `/api/insights/accuracy-summary?ports=${portsQuery}` : null,
    fetcher,
  );
  const accuracyPct = accData?.median_pct ?? null;

  const generated = data?.snapshot.generated_at;
  const ports = data?.snapshot.ports ?? [];
  const anomalyCount = ports.filter((p) => p.anomaly_high).length;

  function nextBriefingLabel(): string | null {
    if (!subscriber?.briefing_enabled) return null;
    try {
      const tz = subscriber.briefing_tz || "America/Chicago";
      const local = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      const next = new Date(local);
      next.setHours(subscriber.briefing_local_hour, 0, 0, 0);
      if (next <= local) next.setDate(next.getDate() + 1);
      return next.toLocaleString("en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });
    } catch {
      return null;
    }
  }

  // Picker — all known ports filtered by query, minus already-watched
  const pickerCandidates = useMemo(() => {
    const watchedSet = new Set(watched);
    const q = pickerQuery.trim().toLowerCase();
    return Object.entries(PORT_META)
      .filter(([id]) => !watchedSet.has(id))
      .filter(([id, meta]) => {
        if (!q) return true;
        const hay = `${id} ${meta.localName ?? ""} ${meta.city} ${meta.region}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [watched, pickerQuery]);

  function addPort(id: string) {
    setWatched((prev) => (prev.includes(id) ? prev : [...prev, id].slice(0, 12)));
    setPickerQuery("");
    setPickerOpen(false);
  }
  function removePort(id: string) {
    setWatched((prev) => prev.filter((p) => p !== id));
  }

  const lang = subscriber?.language ?? "en";
  const es = lang === "es";
  const subLabel = subscriber?.recipient_emails?.[0]
    ? ` · ${subscriber.recipient_emails[0]}`
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

      {/* ── hero strip ── */}
      <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--cd-border)", background: "var(--surface)", position: "relative" }}>
        <HeroStat label={es ? "MONITOREANDO" : "WATCHING"} value={`${watched.length} PORTS`} sub={es ? "RGV · comercial" : "RGV · commercial"} />
        <HeroStat
          label={es ? "ANOMALÍAS ACTIVAS" : "ANOMALIES FIRING"}
          value={String(anomalyCount)}
          sub={anomalyCount > 0 ? ports.filter(p => p.anomaly_high).map(p => p.name.split("–")[0].trim()).join(" · ") : (es ? "ninguna" : "none")}
          tone="amber"
        />
        <HeroStat
          label={es ? "PRECISIÓN 30D" : "30D ACCURACY"}
          value={accuracyPct !== null ? `${accuracyPct.toFixed(1)}%` : "—"}
          sub="±9.4 min median"
          tone="green"
        />
        <HeroStat
          label={es ? "PRÓXIMO INFORME" : "NEXT BRIEFING"}
          value={nextBriefingLabel() ?? "—"}
          sub={subLabel || (es ? "configura alertas →" : "configure alerts →")}
          tone="accent"
        />
        <div style={{ padding: "14px 20px", flex: "0 0 200px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, justifyContent: "center" }}>
          <button className="btn tap" onClick={() => mutate()} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--cd-green)", display: "inline-block" }} />
            AUTO · 60s
          </button>
          <span className="lbl-xs mono" style={{ color: "var(--muted-2)" }}>
            {generated ? `updated ${new Date(generated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" })} CT` : "refreshing…"}
          </span>
        </div>
      </div>

      {/* ── command bar ── */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--cd-border)", background: "var(--bg)" }}>
        {[
          { label: es ? "Todos" : "All ports", count: ports.length, tone: undefined, active: true },
          { label: es ? "Anomalías" : "Anomalies", count: anomalyCount, tone: "amber" as const },
          { label: es ? "Despejados" : "Cleared", count: ports.length - anomalyCount, tone: "green" as const },
        ].map((tab, i) => (
          <div key={i} className={`nav-cell tab${tab.active ? " active" : ""}`} style={{ padding: "0 16px", height: 42, borderRight: "1px solid var(--cd-border)", cursor: "default" }}>
            <span>{tab.label}</span>
            <span className="mono lbl-xs" style={{ marginLeft: 8, color: tab.tone === "amber" ? "var(--cd-amber)" : tab.tone === "green" ? "var(--cd-green)" : "var(--muted-2)" }}>
              {tab.count}
            </span>
          </div>
        ))}
        <div style={{ flex: 1, borderRight: "1px solid var(--cd-border)" }} />
        <div className="nav-cell" style={{ height: 42, padding: "0 16px", borderLeft: "1px solid var(--cd-border)", borderRight: "1px solid var(--cd-border)", gap: 10 }}>
          <span className="lbl-xs" style={{ color: "var(--cd-muted)" }}>SORT</span>
          <span className="lbl-xs" style={{ color: "var(--fg)" }}>ANOMALY ▾</span>
        </div>
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="nav-cell tab"
          style={{ height: 42, padding: "0 16px", cursor: "pointer", background: "transparent", border: "none" }}
        >
          <span className="lbl-xs" style={{ color: "var(--fg)" }}>+ {es ? "AGREGAR PUERTO" : "ADD PORT"}</span>
        </button>
      </div>

      {/* ── port picker (inline, below command bar) ── */}
      {pickerOpen && (
        <div style={{ borderBottom: "1px solid var(--cd-border)", background: "var(--surface)", padding: "12px 18px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={pickerQuery}
              onChange={e => setPickerQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setPickerOpen(false); }}
              placeholder={es ? "Buscar por nombre, ciudad o ID..." : "Search by name, city, or port ID..."}
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--cd-border)", padding: "8px 12px", color: "var(--fg)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              autoFocus
            />
            <button className="btn" onClick={() => setPickerOpen(false)}>× close</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pickerCandidates.map(([id, meta]) => (
              <button key={id} className="btn tap" onClick={() => addPort(id)} style={{ fontSize: 11 }}>
                {meta.localName ?? meta.city}
                <span style={{ color: "var(--muted-2)", marginLeft: 6 }}>{id}</span>
              </button>
            ))}
            {pickerCandidates.length === 0 && (
              <span className="lbl-xs" style={{ color: "var(--muted-2)" }}>No matches</span>
            )}
          </div>
          {/* Watched chips with remove */}
          {watched.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--cd-border)" }}>
              <span className="lbl-xs" style={{ color: "var(--muted-2)", alignSelf: "center" }}>WATCHING:</span>
              {watched.map(id => {
                const meta = PORT_META[id];
                return (
                  <button key={id} className="btn tap" onClick={() => removePort(id)} style={{ fontSize: 10, padding: "4px 10px", color: "var(--cd-amber)" }}>
                    {meta?.localName ?? meta?.city ?? id} ×
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── table ── */}
      <div style={{ flex: 1 }}>
        {isLoading && watched.length > 0 && (
          <div style={{ padding: "32px 18px", textAlign: "center" }}>
            <span className="lbl-xs" style={{ color: "var(--muted-2)" }}>Loading snapshot…</span>
          </div>
        )}
        {!isLoading && ports.length > 0 && (
          <>
            <CruzarDispatchHeader />
            {ports.map(p => (
              <CruzarDispatchRow
                key={p.port_id}
                p={p}
                subscriberChannels={subscriber ? { email: subscriber.channel_email, sms: subscriber.channel_sms, whatsapp: subscriber.channel_whatsapp } : null}
                lastFired={subscriber?.last_anomaly_fired_at ?? null}
                lang={lang}
              />
            ))}
          </>
        )}
        {!isLoading && watched.length === 0 && (
          <div style={{ padding: "48px 18px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <span className="lbl-xs" style={{ color: "var(--muted-2)" }}>NO PORTS WATCHED</span>
            <button className="btn btn-primary tap" onClick={() => setPickerOpen(true)}>+ Add port</button>
          </div>
        )}
      </div>

      {/* ── footer ── */}
      <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid var(--cd-border)", background: "var(--surface)", height: 36, overflow: "hidden" }}>
        <span className="nav-cell lbl-xs" style={{ height: "100%", color: "var(--cd-muted)", fontSize: 9 }}>
          ANOMALY = CURRENT ≥ 1.5× DOW × HOUR BASELINE (90D)
        </span>
        <div style={{ flex: 1 }} />
        <span className="nav-cell lbl-xs mono" style={{ height: "100%", color: "var(--cd-muted)", borderLeft: "1px solid var(--cd-border)", borderRight: "1px solid var(--cd-border)" }}>
          CBP DATA · AUTO-REFRESH 60s
        </span>
        <Link href="/dispatch/account" className="nav-cell lbl-xs" style={{ height: "100%", color: "var(--cd-muted)", textDecoration: "none" }}>
          ALERTS →
        </Link>
      </div>
    </div>
  );
}

// ── Hero stat pill (hero strip) ──────────────────────────────────────────────
function HeroStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'amber' | 'green' | 'accent' }) {
  const color = tone === 'accent' ? 'var(--cd-accent)' : tone === 'green' ? 'var(--cd-green)' : tone === 'amber' ? 'var(--cd-amber)' : 'var(--fg)';
  return (
    <div style={{ padding: '14px 20px', borderRight: '1px solid var(--cd-border)', flex: 1, minWidth: 0 }}>
      <div className="lbl-xs" style={{ color: 'var(--cd-muted)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, color, marginTop: 6, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="lbl-xs" style={{ color: 'var(--muted-2)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Table header ─────────────────────────────────────────────────────────────
function CruzarDispatchHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.1fr 1fr 1.4fr 1fr 1fr', borderBottom: '1px solid var(--cd-border)', background: 'var(--surface)', paddingLeft: 18 }}>
      {['Port', 'Now', '6h forecast', 'Trend · Δ vs typical', 'Drift', 'Updated'].map((h, i) => (
        <div key={i} className="lbl-xs" style={{ padding: '12px 14px', textAlign: i === 0 ? 'left' : i < 3 || i === 5 ? 'right' : 'left', color: 'var(--cd-muted)' }}>
          {h}
        </div>
      ))}
    </div>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────
function CruzarDispatchRow({
  p,
  subscriberChannels,
  lastFired,
  lang,
}: {
  p: DispatchPort;
  subscriberChannels: { email: boolean; sms: boolean; whatsapp: boolean } | null;
  lastFired: string | null;
  lang: 'en' | 'es';
}) {
  const status = STATUS_LABEL[p.drift_status];
  const borderL = p.anomaly_high ? 'var(--cd-amber)' : (typeof p.delta_min === 'number' && p.delta_min < -3) ? 'var(--cd-green)' : 'transparent';
  const deltaUp = typeof p.delta_min === 'number' && p.delta_min > 5;
  const deltaDn = typeof p.delta_min === 'number' && p.delta_min < -3;
  const deltaColor = deltaUp ? 'var(--cd-amber)' : deltaDn ? 'var(--cd-green)' : 'var(--cd-muted)';
  const driftColor = p.drift_status === 'decision-grade' ? 'var(--cd-green)' : p.drift_status === 'self-baseline' ? 'var(--cd-accent)' : 'var(--cd-muted)';

  const ageStr = p.live_stale_min !== null ? `${p.live_stale_min}m ago` : 'just now';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2.4fr 1.1fr 1fr 1.4fr 1fr 1fr',
        alignItems: 'center',
        borderBottom: '1px solid var(--cd-border)',
        borderLeft: `3px solid ${borderL}`,
        paddingLeft: borderL !== 'transparent' ? 15 : 18,
        background: 'var(--bg)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
    >
      {/* Port name + anomaly */}
      <div style={{ padding: '14px 14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--fg)', fontSize: 14.5, fontWeight: 500 }}>{p.name}</span>
          <span className="mono lbl-xs" style={{ color: 'var(--muted-2)' }}>{p.port_id}</span>
          {p.anomaly_high && (
            <span className="pill amber">
              ⚠ anomaly {typeof p.anomaly_ratio === 'number' ? `${p.anomaly_ratio.toFixed(1)}×` : ''} baseline
            </span>
          )}
        </div>
        <div className="lbl-xs" style={{ color: 'var(--cd-muted)', marginTop: 4 }}>{p.region}</div>
        {subscriberChannels && (
          <div style={{ marginTop: 6 }}>
            <AlertsRail channels={subscriberChannels} lastFiredAt={lastFired} lang={lang} />
          </div>
        )}
      </div>
      {/* Now */}
      <div style={{ padding: '14px', textAlign: 'right' }}>
        <div className="mono" style={{ fontSize: 22, color: p.anomaly_high ? 'var(--cd-amber)' : 'var(--fg)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {p.live_wait_min ?? '—'}
          <span className="lbl" style={{ color: 'var(--cd-muted)', marginLeft: 4 }}>min</span>
        </div>
      </div>
      {/* 6h forecast */}
      <div style={{ padding: '14px', textAlign: 'right' }}>
        <div className="mono" style={{ fontSize: 14, color: 'var(--fg-2)' }}>
          {p.predicted_6h_min ?? '—'}
          <span className="lbl-xs" style={{ color: 'var(--muted-2)', marginLeft: 4 }}>min</span>
        </div>
      </div>
      {/* Delta */}
      <div style={{ padding: '14px' }}>
        <span className="mono lbl-xs" style={{ color: deltaColor }}>
          {typeof p.delta_min === 'number'
            ? `${p.delta_min > 0 ? '▲' : p.delta_min < 0 ? '▼' : '·'} ${Math.abs(p.delta_min)}m`
            : '—'}
        </span>
      </div>
      {/* Drift */}
      <div style={{ padding: '14px' }}>
        <span className="mono lbl-xs" style={{ color: driftColor }}>{status.en}</span>
      </div>
      {/* Updated */}
      <div style={{ padding: '14px', textAlign: 'right' }}>
        <span className="mono lbl-xs" style={{ color: 'var(--cd-muted)' }}>{ageStr}</span>
      </div>
    </div>
  );
}
