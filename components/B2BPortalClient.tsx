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
  const diffMs = Date.now() - new Date(recordedAt).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 2) return 'just now';
  return `${diffMin} min ago`;
}

function LiveCell({ portId, wait, status, age }: { portId: string; wait: number | null; status: 'red' | 'amber' | 'green'; age: string }) {
  const statusLabel = status === 'red' ? 'HIGH' : status === 'amber' ? 'MOD' : 'CLEAR';
  const statusColor = status === 'red' ? 'var(--cd-red)' : status === 'amber' ? 'var(--cd-amber)' : 'var(--cd-green)';
  return (
    <div className="cell tap" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className={`dot ${status}`} />
          <span className="lbl" style={{ color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {PORT_LABELS[portId] ?? portId}
          </span>
        </div>
        <span className="lbl-xs" style={{ color: statusColor }}>{statusLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="mono" style={{ fontSize: 34, lineHeight: 1, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>
          {wait ?? '—'}
        </span>
        <span className="lbl" style={{ color: 'var(--cd-muted)' }}>min</span>
      </div>
      <div className="lbl-xs" style={{ color: 'var(--muted-2)' }}>updated {age}</div>
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
    return {
      port_id: id,
      wait: p?.vehicle ?? null,
      status: waitStatus(p?.vehicle ?? null),
      age: ageLabel(p?.recordedAt ?? null),
    };
  });

  const displayName = user?.email ? user.email.split('@')[0].slice(0, 16) : 'you';
  const firingCount = rgvPorts.filter(p => p.status === 'red' || p.status === 'amber').length;

  const liveStrip = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1px solid var(--cd-border)', borderRight: 'none' }}>
      {rgvPorts.map(p => (
        <div key={p.port_id} style={{ borderRight: '1px solid var(--cd-border)' }}>
          <LiveCell portId={p.port_id} wait={p.wait} status={p.status} age={p.age} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="cruzar-frame" data-mode={mode} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavPublic mode={mode} setMode={setMode} lang={currentLang} setLang={setCurrentLang} />

      {!loading && user ? (
        /* ── AUTHENTICATED STATE ── */
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px' }}>
          <div style={{ width: '100%', maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 10 }}>
                  {es ? `BIENVENIDO · ${displayName.toUpperCase()}` : `WELCOME BACK · ${displayName.toUpperCase()}`}
                </div>
                <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.05, margin: 0 }}>
                  {firingCount > 0
                    ? (es ? `${firingCount} puertos con demoras altas.` : `${firingCount} port${firingCount > 1 ? 's' : ''} running hot.`)
                    : (es ? 'Todo fluye.' : 'All ports clear.')
                  }
                </h1>
                <p className="lbl" style={{ color: 'var(--cd-muted)', marginTop: 8, fontSize: 11, letterSpacing: '.16em' }}>
                  {es ? 'RGV · Datos en vivo · auto-refresh 60s' : 'RGV live · auto-refresh 60s'}
                </p>
              </div>
              <Link href="/dispatch" className="btn btn-primary tap" style={{ padding: '12px 22px', textDecoration: 'none' }}>
                {es ? 'Abrir consola →' : 'Open dispatch console →'}
              </Link>
            </div>

            {liveStrip}

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', border: '1px solid var(--cd-border)' }}>
              <div style={{ borderRight: '1px solid var(--cd-border)', padding: '16px 18px' }}>
                <div className="lbl-xs" style={{ color: 'var(--cd-muted)' }}>{es ? 'PRÓXIMO INFORME' : 'NEXT BRIEFING'}</div>
                <div className="mono" style={{ fontSize: 22, color: 'var(--fg)', marginTop: 6 }}>05:00 CDT</div>
                <div className="lbl-xs" style={{ color: 'var(--muted-2)', marginTop: 4 }}>{es ? 'en 18 minutos' : 'in 18 minutes'}</div>
              </div>
              <div style={{ borderRight: '1px solid var(--cd-border)', padding: '16px 18px' }}>
                <div className="lbl-xs" style={{ color: 'var(--cd-muted)' }}>{es ? 'PRECISIÓN 30D' : '30D ACCURACY'}</div>
                <div className="mono" style={{ fontSize: 22, color: 'var(--cd-green)', marginTop: 6 }}>94.2%</div>
                <div className="lbl-xs" style={{ color: 'var(--muted-2)', marginTop: 4 }}>±9.4 min median</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div className="lbl-xs" style={{ color: 'var(--cd-muted)' }}>{es ? 'MONITOREANDO' : 'WATCHING'}</div>
                <div className="mono" style={{ fontSize: 22, color: 'var(--fg)', marginTop: 6 }}>3 ports</div>
                <div className="lbl-xs" style={{ color: firingCount > 0 ? 'var(--cd-accent)' : 'var(--cd-green)', marginTop: 4 }}>
                  {firingCount > 0 ? `${firingCount} firing now` : 'all clear'}
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* ── ANONYMOUS STATE — full company landing ── */
        <main style={{ flex: 1 }}>

          {/* 1. HERO */}
          <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '72px 48px 60px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div className="lbl-xs" style={{ color: 'var(--cd-accent)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span className="dot live" />
                {c.hero.eyebrow}
              </div>
              <h1 className="serif" style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4.4rem)', lineHeight: 1.03, margin: 0, color: 'var(--fg)', maxWidth: 920 }}>
                {c.hero.title}
              </h1>
              <p className="lbl" style={{ color: 'var(--cd-muted)', maxWidth: 640, lineHeight: 1.65, fontSize: 12, letterSpacing: '0.14em', marginTop: 22 }}>
                {c.hero.sub}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 30, flexWrap: 'wrap' }}>
                <Link href="/b2b/start" className="btn btn-primary tap" style={{ padding: '12px 24px', textDecoration: 'none' }}>
                  {c.hero.cta}
                </Link>
                <Link href="/insights/accuracy" className="btn btn-ghost tap" style={{ padding: '12px 16px', textDecoration: 'none' }}>
                  {c.hero.ctaSub}
                </Link>
                <span className="lbl-xs" style={{ color: 'var(--muted-2)', marginLeft: 'auto' }}>
                  {es ? 'SIN TARJETA · PRUEBA 14 DÍAS' : 'NO CARD · 14-DAY DISPATCH TRIAL'}
                </span>
              </div>
            </div>
          </section>

          {/* 2. LIVE STRIP */}
          <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '28px 48px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="lbl-xs" style={{ color: 'var(--cd-muted)' }}>
                  {es ? 'VALLE DEL RÍO GRANDE · EN VIVO' : 'RIO GRANDE VALLEY · LIVE'}
                </span>
                <span className="lbl-xs" style={{ color: 'var(--muted-2)' }}>auto-refresh · 60s</span>
              </div>
              {liveStrip}
            </div>
          </section>

          {/* 3. IEEPA URGENCY */}
          <section style={{
            borderBottom: '1px solid rgba(245,158,11,0.25)',
            borderTop: '1px solid rgba(245,158,11,0.25)',
            padding: '14px 48px',
            background: 'rgba(245,158,11,0.05)',
          }}>
            <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="dot amber" style={{ flexShrink: 0 }} />
                <p className="lbl-xs" style={{ color: 'rgba(250,200,80,0.92)', lineHeight: 1.55, letterSpacing: '0.1em' }}>
                  {es
                    ? 'CAPE activo 20 Abr 2026 · $165B+ sin reclamar en ACE · ventana de 80 días por entrada · 83% no tiene ACH configurado para recibirlo'
                    : 'CAPE live Apr 20, 2026 · $165B+ unclaimed in ACE · 80-day rolling window per entry · 83% of importers haven\'t set up ACH to receive it'}
                </p>
              </div>
              <Link href="/refunds/scan" className="btn tap" style={{ padding: '8px 18px', textDecoration: 'none', color: 'var(--cd-amber)', border: '1px solid rgba(245,158,11,0.4)', background: 'transparent', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {es ? 'Escanea tu ACE →' : 'Scan your ACE →'}
              </Link>
            </div>
          </section>

          {/* 4. FOUR LAYERS */}
          <section id="layers" style={{ borderBottom: '1px solid var(--cd-border)', padding: '64px 48px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 12 }}>{c.layers.kicker}</div>
              <h2 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', lineHeight: 1.1, margin: '0 0 8px', color: 'var(--fg)' }}>
                {c.layers.title}
              </h2>
              <p className="lbl" style={{ color: 'var(--cd-muted)', marginBottom: 36, fontSize: 11.5, letterSpacing: '0.14em' }}>
                {c.layers.sub}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', border: '1px solid var(--cd-border)', overflow: 'hidden' }}>
                {c.layers.items.map((layer, i) => (
                  <div key={i} className="cell" style={{
                    padding: '28px 22px',
                    borderRight: i < c.layers.items.length - 1 ? '1px solid var(--cd-border)' : undefined,
                  }}>
                    <div className="mono lbl-xs" style={{ color: 'var(--muted-2)', marginBottom: 10 }}>{layer.n}</div>
                    <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 8 }}>{layer.label}</div>
                    <div className="serif" style={{ fontSize: 17, lineHeight: 1.2, marginBottom: 10, color: 'var(--fg)' }}>{layer.title}</div>
                    <p className="lbl-xs" style={{ color: 'var(--fg-2)', lineHeight: 1.6, letterSpacing: '0.1em' }}>{layer.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5. DETENTION MATH */}
          <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '64px 48px', background: 'var(--surface)' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', margin: '0 0 18px', color: 'var(--fg)' }}>
                {c.detentionMath.title}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--fg-2)', maxWidth: 840, marginBottom: 18 }}>
                {c.detentionMath.body}
              </p>
              <p className="lbl-xs" style={{ color: 'var(--muted-2)', maxWidth: 840, lineHeight: 1.6 }}>
                {c.detentionMath.footnote}
              </p>
            </div>
          </section>

          {/* 6. ACCURACY PROOF */}
          <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '52px 48px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 12 }}>{c.accuracy.kicker}</div>
                  <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', margin: 0, color: 'var(--fg)' }}>
                    {c.accuracy.title}
                  </h2>
                  <p className="lbl" style={{ color: 'var(--cd-muted)', marginTop: 10, fontSize: 11.5, maxWidth: 460 }}>
                    {c.accuracy.sub}
                  </p>
                </div>
                <div style={{ display: 'flex', border: '1px solid var(--cd-border)', flexShrink: 0, alignSelf: 'flex-start' }}>
                  {([
                    { label: es ? 'PRECISIÓN 30D' : '30D ACCURACY', value: '94.2%', tone: 'var(--cd-green)' },
                    { label: es ? 'PUERTOS' : 'PORTS', value: '52', tone: 'var(--fg)' },
                    { label: es ? 'ERROR MEDIANO' : 'MEDIAN ERROR', value: '±9.4 min', tone: 'var(--fg)' },
                  ] as const).map((stat, i) => (
                    <div key={i} className="cell" style={{ padding: '16px 22px', borderRight: i < 2 ? '1px solid var(--cd-border)' : undefined, minWidth: 110 }}>
                      <div className="lbl-xs" style={{ color: 'var(--cd-muted)', marginBottom: 6 }}>{stat.label}</div>
                      <div className="mono" style={{ fontSize: 22, color: stat.tone }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/insights/accuracy" className="lbl-xs" style={{ color: 'var(--cd-accent)', textDecoration: 'none' }}>
                {es ? 'Ver backtest completo + soak en vivo →' : 'See full backtest + live soak →'}
              </Link>
            </div>
          </section>

          {/* 7. PRICING */}
          <section style={{ borderBottom: '1px solid var(--cd-border)', padding: '64px 48px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 8 }}>{c.pricing.kicker}</div>
              <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', margin: '0 0 32px', color: 'var(--fg)' }}>
                {c.pricing.title}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', border: '1px solid var(--cd-border)', overflow: 'hidden' }}>
                {([c.pricing.starter, c.pricing.pro, c.pricing.fleet] as const).map((tier, i) => (
                  <div key={i} className="cell" style={{ padding: '28px 22px', borderRight: i < 2 ? '1px solid var(--cd-border)' : undefined }}>
                    <div className="lbl-xs" style={{ color: 'var(--cd-accent)', marginBottom: 10 }}>{tier.tier}</div>
                    <div className="serif" style={{ fontSize: 26, color: 'var(--fg)', marginBottom: 10 }}>{tier.price}</div>
                    <p className="lbl-xs" style={{ color: 'var(--fg-2)', lineHeight: 1.65 }}>{tier.summary}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 28, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Link href="/b2b/start" className="btn btn-primary tap" style={{ padding: '12px 24px', textDecoration: 'none' }}>
                  {c.hero.cta}
                </Link>
                <Link href="/dispatch" className="btn btn-ghost tap" style={{ padding: '12px 16px', textDecoration: 'none' }}>
                  {es ? 'Abre la consola →' : 'Open the console →'}
                </Link>
              </div>
            </div>
          </section>

          {/* 8. FOOTER */}
          <section style={{ padding: '24px 48px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <p className="lbl-xs" style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>{c.notAffiliated}</p>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
