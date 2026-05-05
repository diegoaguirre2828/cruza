'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { NavPublic } from '@/components/B2BNav';
import { B2B_EN } from '@/lib/copy/b2b-en';
import { B2B_ES } from '@/lib/copy/b2b-es';
import type { PortWaitTime } from '@/types';

const RGV_IDS = ['230502', '230501', '230503'];
const PORT_LABELS: Record<string, string> = {
  '230502': 'Pharr–Reynosa',
  '230501': 'Hidalgo / McAllen',
  '230503': 'Anzaldúas',
};

function waitStatus(min: number | null): 'red' | 'amber' | 'green' {
  if (min === null) return 'green';
  if (min > 45) return 'red';
  if (min > 20) return 'amber';
  return 'green';
}

function ageLabel(recordedAt: string | null): string {
  if (!recordedAt) return 'unknown';
  const diffMin = Math.round((Date.now() - new Date(recordedAt).getTime()) / 60000);
  if (diffMin < 2) return 'just now';
  return `${diffMin} min ago`;
}

function LiveCell({ portId, wait, status, age }: {
  portId: string; wait: number | null; status: 'red' | 'amber' | 'green'; age: string;
}) {
  const statusLabel = status === 'red' ? 'HIGH' : status === 'amber' ? 'MOD' : 'CLEAR';
  const statusColor = status === 'red' ? 'text-red-400' : status === 'amber' ? 'text-amber-400' : 'text-emerald-400';
  const dotColor   = status === 'red' ? 'bg-red-400'  : status === 'amber' ? 'bg-amber-400'  : 'bg-emerald-400';
  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground truncate">
            {PORT_LABELS[portId] ?? portId}
          </span>
        </div>
        <span className={`font-mono text-[10.5px] uppercase tracking-[0.14em] shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[34px] leading-none tabular-nums text-foreground">
          {wait ?? '—'}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/50">min</span>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/40">updated {age}</div>
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function B2BPortalClient({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [currentLang, setCurrentLang] = useState<'en' | 'es'>(lang);
  const { user, loading } = useAuth();
  const es = currentLang === 'es';
  const c = es ? B2B_ES : B2B_EN;

  const { data: portsRaw } = useSWR<{ ports: PortWaitTime[] }>('/api/ports', fetcher, { refreshInterval: 60000 });
  const rgvPorts = RGV_IDS.map(id => {
    const p = portsRaw?.ports?.find(x => x.portId === id);
    return { port_id: id, wait: p?.vehicle ?? null, status: waitStatus(p?.vehicle ?? null), age: ageLabel(p?.recordedAt ?? null) };
  });

  const firingCount = rgvPorts.filter(p => p.status === 'red' || p.status === 'amber').length;
  const displayName = user?.email ? user.email.split('@')[0].slice(0, 16) : 'you';

  const liveStrip = (
    <div className="grid grid-cols-3 border border-border">
      {rgvPorts.map((p, i) => (
        <div key={p.port_id} className={i < rgvPorts.length - 1 ? 'border-r border-border' : ''}>
          <LiveCell portId={p.port_id} wait={p.wait} status={p.status} age={p.age} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <NavPublic mode={mode} setMode={setMode} lang={currentLang} setLang={setCurrentLang} />

      {!loading && user ? (
        /* ── AUTHENTICATED STATE ── */
        <main className="flex-1 flex items-center justify-center px-5 sm:px-12 py-10">
          <div className="w-full max-w-[1080px] flex flex-col gap-6">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-2.5">
                  {es ? `BIENVENIDO · ${displayName.toUpperCase()}` : `WELCOME BACK · ${displayName.toUpperCase()}`}
                </div>
                <h1 className="font-serif text-[clamp(2.2rem,4.2vw,3.2rem)] font-medium leading-tight text-foreground">
                  {firingCount > 0
                    ? (es ? `${firingCount} puertos con demoras altas.` : `${firingCount} port${firingCount > 1 ? 's' : ''} running hot.`)
                    : (es ? 'Todo fluye.' : 'All ports clear.')}
                </h1>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/50 mt-2">
                  {es ? 'RGV · datos en vivo · auto-refresh 60s' : 'RGV live · auto-refresh 60s'}
                </p>
              </div>
              <Link
                href="/dispatch"
                className="bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-foreground/90 transition shrink-0"
              >
                {es ? 'Abrir consola →' : 'Open dispatch console →'}
              </Link>
            </div>

            {liveStrip}

            <div className="grid grid-cols-3 border border-border">
              {([
                { label: es ? 'PRÓXIMO INFORME' : 'NEXT BRIEFING', value: '05:00 CDT', sub: es ? 'en 18 minutos' : 'in 18 minutes', color: 'text-foreground' },
                { label: es ? 'PRECISIÓN 30D' : '30D ACCURACY', value: '94.2%', sub: '±9.4 min median', color: 'text-emerald-400' },
                { label: es ? 'MONITOREANDO' : 'WATCHING', value: '3 ports', sub: firingCount > 0 ? `${firingCount} firing now` : 'all clear', color: firingCount > 0 ? 'text-accent' : 'text-emerald-400' },
              ] as const).map((stat, i) => (
                <div key={i} className={`p-4 ${i < 2 ? 'border-r border-border' : ''}`}>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">{stat.label}</div>
                  <div className={`font-mono text-[22px] leading-none tabular-nums ${stat.color}`}>{stat.value}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/40 mt-1.5">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      ) : (
        /* ── ANONYMOUS STATE — full landing ── */
        <main className="flex-1">

          {/* 1. HERO */}
          <section className="border-b border-border">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent flex items-center gap-2.5 mb-6">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse shrink-0" />
                {c.hero.eyebrow}
              </div>
              <h1 className="font-serif text-[clamp(2.8rem,5.5vw,4.4rem)] font-medium leading-[1.03] text-foreground max-w-[920px]">
                {c.hero.title}
              </h1>
              <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
                {c.hero.sub}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/b2b/start"
                  className="bg-foreground px-6 py-3.5 text-sm font-semibold text-background hover:bg-foreground/90 transition"
                >
                  {c.hero.cta}
                </Link>
                <Link
                  href="/insights/accuracy"
                  className="border border-border px-6 py-3.5 text-sm font-medium text-foreground hover:border-foreground transition"
                >
                  {c.hero.ctaSub}
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 ml-auto">
                  {es ? 'SIN TARJETA · PRUEBA 14 DÍAS' : 'NO CARD · 14-DAY DISPATCH TRIAL'}
                </span>
              </div>
            </div>
          </section>

          {/* 2. LIVE STRIP */}
          <section className="border-b border-border">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-7">
              <div className="flex justify-between mb-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                  {es ? 'VALLE DEL RÍO GRANDE · EN VIVO' : 'RIO GRANDE VALLEY · LIVE'}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/40">auto-refresh · 60s</span>
              </div>
              {liveStrip}
            </div>
          </section>

          {/* 3. IEEPA URGENCY BANNER */}
          <div className="border-b border-amber-400/30 bg-amber-400/[0.06]">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <p className="text-[13px] text-amber-200/90 leading-snug">
                  {es
                    ? 'CAPE activo 20 Abr 2026 · $165B+ sin reclamar en ACE · ventana de 80 días por entrada · 83% no tiene ACH configurado para recibirlo'
                    : 'CAPE live Apr 20, 2026 · $165B+ unclaimed in ACE · 80-day rolling window per entry · 83% of importers haven\'t set up ACH to receive it'}
                </p>
              </div>
              <Link
                href="/refunds/scan"
                className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-400 hover:text-amber-300 transition"
              >
                {es ? 'Escanea tu ACE →' : 'Scan your ACE →'}
              </Link>
            </div>
          </div>

          {/* 4. FOUR LAYERS */}
          <section id="layers" className="border-b border-border">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-3">{c.layers.kicker}</div>
              <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] font-medium leading-tight text-foreground mb-2">
                {c.layers.title}
              </h2>
              <p className="text-[15px] text-muted-foreground mb-9 max-w-2xl">{c.layers.sub}</p>
              <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
                {c.layers.items.map((layer, i) => (
                  <div key={i} className="bg-background p-7">
                    <div className="font-mono text-[10px] text-muted-foreground/40 mb-2.5">{layer.n}</div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-2">{layer.label}</div>
                    <h3 className="font-serif text-[1.15rem] font-medium text-foreground mb-2.5">{layer.title}</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{layer.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5. DETENTION MATH */}
          <section className="border-b border-border bg-card">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
              <h2 className="font-serif text-[clamp(1.6rem,3vw,2.4rem)] font-medium text-foreground mb-5">
                {c.detentionMath.title}
              </h2>
              <p className="text-[15px] leading-[1.75] text-muted-foreground max-w-3xl mb-4">{c.detentionMath.body}</p>
              <p className="text-[13px] text-muted-foreground/50 max-w-3xl">{c.detentionMath.footnote}</p>
            </div>
          </section>

          {/* 6. ACCURACY PROOF */}
          <section className="border-b border-border">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
              <div className="flex items-start justify-between gap-8 flex-wrap mb-5">
                <div className="flex-1 min-w-[280px]">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-3">{c.accuracy.kicker}</div>
                  <h2 className="font-serif text-[clamp(1.6rem,3vw,2.4rem)] font-medium text-foreground">
                    {c.accuracy.title}
                  </h2>
                  <p className="text-[15px] text-muted-foreground mt-3 max-w-lg">{c.accuracy.sub}</p>
                </div>
                <div className="flex border border-border shrink-0 self-start">
                  {([
                    { label: es ? 'PRECISIÓN 30D' : '30D ACCURACY', value: '94.2%', color: 'text-emerald-400' },
                    { label: es ? 'PUERTOS' : 'PORTS', value: '52', color: 'text-foreground' },
                    { label: es ? 'ERROR MEDIANO' : 'MEDIAN ERROR', value: '±9.4 min', color: 'text-foreground' },
                  ] as const).map((stat, i) => (
                    <div key={i} className={`p-4 min-w-[100px] ${i < 2 ? 'border-r border-border' : ''}`}>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">{stat.label}</div>
                      <div className={`font-mono text-[22px] leading-none tabular-nums ${stat.color}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/insights/accuracy" className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent hover:text-accent/80 transition">
                {es ? 'Ver backtest completo + soak en vivo →' : 'See full backtest + live soak →'}
              </Link>
            </div>
          </section>

          {/* 7. PRICING */}
          <section className="border-b border-border">
            <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-3">{c.pricing.kicker}</div>
              <h2 className="font-serif text-[clamp(1.6rem,3vw,2.4rem)] font-medium text-foreground mb-8">
                {c.pricing.title}
              </h2>
              <div className="grid gap-px border border-border bg-border sm:grid-cols-3">
                {([c.pricing.starter, c.pricing.pro, c.pricing.fleet] as const).map((tier, i) => (
                  <div key={i} className="bg-background p-7">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-2.5">{tier.tier}</div>
                    <div className="font-serif text-[26px] text-foreground mb-3">{tier.price}</div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{tier.summary}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/b2b/start"
                  className="bg-foreground px-6 py-3.5 text-sm font-semibold text-background hover:bg-foreground/90 transition"
                >
                  {c.hero.cta}
                </Link>
                <Link
                  href="/dispatch"
                  className="border border-border px-6 py-3.5 text-sm font-medium text-foreground hover:border-foreground transition"
                >
                  {es ? 'Abre la consola →' : 'Open the console →'}
                </Link>
              </div>
            </div>
          </section>

          {/* 8. FOOTER */}
          <section className="py-8 px-5 sm:px-8">
            <div className="mx-auto max-w-[1180px]">
              <p className="text-[12px] text-muted-foreground/40 leading-relaxed">{c.notAffiliated}</p>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
