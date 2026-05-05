'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useState } from 'react';
import { createClient } from '@/lib/auth';

// ── Legacy B2BNav — used across all non-dispatch B2B pages ───────────────────
// Kept for backwards compatibility. New surfaces use NavPublic / NavConsole.

type B2BNavCurrent = 'workspace' | 'portal' | 'accuracy' | 'console' | 'account' | 'refunds' | 'eudamed';

const AUTH_ROUTES: Array<{ key: B2BNavCurrent; href: string; en: string; es: string }> = [
  { key: 'workspace', href: '/workspace', en: 'Workspace', es: 'Workspace' },
  { key: 'console',   href: '/dispatch',  en: 'Console',   es: 'Consola' },
  { key: 'refunds',   href: '/refunds',   en: 'Refunds',   es: 'Reembolsos' },
];

const PUBLIC_ROUTES: Array<{ key: B2BNavCurrent; href: string; en: string; es: string }> = [
  { key: 'portal',   href: '/b2b',              en: 'Portal',   es: 'Portal' },
  { key: 'accuracy', href: '/insights/accuracy', en: 'Accuracy', es: 'Precisión' },
];

function deriveActive(pathname: string | null): B2BNavCurrent {
  if (!pathname) return 'workspace';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/refunds')) return 'refunds';
  if (pathname.startsWith('/dispatch/account')) return 'account';
  if (pathname.startsWith('/dispatch')) return 'console';
  if (pathname.startsWith('/insights/accuracy')) return 'accuracy';
  if (pathname.startsWith('/b2b')) return 'portal';
  return 'portal';
}

export function B2BNav({ current, lang = 'en' }: { current?: B2BNavCurrent; lang?: 'en' | 'es' }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = current ?? deriveActive(pathname);
  const es = lang === 'es';
  const langSuffix = es ? '?lang=es' : '';

  const otherLang: 'en' | 'es' = es ? 'en' : 'es';
  const otherParams = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
  if (otherLang === 'es') otherParams.set('lang', 'es'); else otherParams.delete('lang');
  const langToggleHref = otherParams.toString() ? `${pathname ?? '/'}?${otherParams.toString()}` : (pathname ?? '/');

  const displayName = user?.email ? user.email.split('@')[0].slice(0, 18) : null;

  async function signOut() {
    try {
      const sb = createClient();
      await sb.auth.signOut();
      try { localStorage.removeItem('cruzar_has_session'); } catch { /* noop */ }
    } finally {
      window.location.href = `/login${langSuffix}`;
    }
  }

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-40">
      <div className="mx-auto max-w-[1180px] flex items-stretch gap-0 px-5 sm:px-8">
        <Link href={`/workspace${langSuffix}`} className="flex items-center gap-2 pr-5 sm:pr-7 border-r border-border hover:bg-foreground/[0.04] transition">
          <span className="font-serif text-[16px] font-medium text-foreground">Cruzar</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/70">/B2B</span>
        </Link>
        <div className="flex items-stretch flex-1 overflow-x-auto">
          {(user ? AUTH_ROUTES : PUBLIC_ROUTES).map((r) => {
            const isActive = active === r.key;
            return (
              <Link key={r.key} href={`${r.href}${langSuffix}`} aria-current={isActive ? 'page' : undefined}
                className={['group relative flex items-center px-4 sm:px-5 font-mono text-[11px] uppercase tracking-[0.18em] transition border-r border-border',
                  isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'].join(' ')}
              >
                {es ? r.es : r.en}
              </Link>
            );
          })}
        </div>
        {!authLoading && (
          user ? (
            <div className="relative flex items-stretch border-l border-border">
              <button type="button" onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 px-4 sm:px-5 hover:bg-foreground/[0.04] transition font-mono text-[11px] uppercase tracking-[0.18em] text-foreground"
                aria-haspopup="menu" aria-expanded={menuOpen}>
                <span className="inline-flex h-6 w-6 items-center justify-center bg-foreground/[0.10] text-[11px] text-foreground/85">
                  {displayName?.charAt(0).toUpperCase() ?? '·'}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[200px] border border-border bg-card shadow-lg z-50">
                  <Link href={`/dispatch/account${langSuffix}`} className="block px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground border-b border-border" onClick={() => setMenuOpen(false)}>
                    {es ? 'Cuenta' : 'Account'}
                  </Link>
                  <button type="button" onClick={() => { setMenuOpen(false); signOut(); }}
                    className="block w-full text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground">
                    {es ? 'Cerrar sesión' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-stretch border-l border-border">
              <Link href={`/login${langSuffix}`} className="hidden sm:flex items-center px-4 hover:bg-foreground/[0.04] transition font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
                {es ? 'Entrar' : 'Sign in'}
              </Link>
              <Link href={`/b2b/start${langSuffix}`} className="flex items-center px-4 sm:px-5 bg-foreground hover:bg-foreground/85 transition font-mono text-[11px] uppercase tracking-[0.18em] text-background">
                {es ? 'Empezar →' : 'Get started →'}
              </Link>
            </div>
          )
        )}
        <Link href={langToggleHref} className="flex items-center gap-1 px-4 sm:px-5 border-l border-border hover:bg-foreground/[0.04] transition font-mono text-[11px] uppercase tracking-[0.18em]" title={otherLang === 'es' ? 'Cambiar a Español' : 'Switch to English'}>
          <span className={lang === 'en' ? 'text-foreground' : 'text-muted-foreground/60'}>EN</span>
          <span className="text-muted-foreground/40">/</span>
          <span className={lang === 'es' ? 'text-foreground' : 'text-muted-foreground/60'}>ES</span>
        </Link>
      </div>
    </nav>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// Public nav (anonymous visitors on /b2b)
export function NavPublic({
  mode,
  setMode,
  lang = 'en',
  setLang,
}: {
  mode: 'dark' | 'light';
  setMode: (m: 'dark' | 'light') => void;
  lang?: 'en' | 'es';
  setLang?: (l: 'en' | 'es') => void;
}) {
  const pathname = usePathname();
  const accuracyActive = pathname?.startsWith('/insights/accuracy');
  const refundsActive = pathname?.startsWith('/refunds');
  return (
    <nav className="nav">
      <Link href="/b2b" className="nav-cell" style={{ borderRight: '1px solid var(--cd-border)', gap: 10, textDecoration: 'none' }}>
        <span className="brand">Cruzar</span>
      </Link>
      <Link href="/insights/accuracy" className={`nav-cell tab${accuracyActive ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Accuracy</Link>
      <Link href="/b2b#layers" className="nav-cell tab" style={{ textDecoration: 'none' }}>Methods</Link>
      <Link href="/refunds" className={`nav-cell tab${refundsActive ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
        {lang === 'es' ? 'Reembolsos' : 'Refunds'}
      </Link>
      <div style={{ flex: 1, borderRight: '1px solid var(--cd-border)' }} />
      <div className="nav-cell right" style={{ padding: '0 14px', gap: 6 }}>
        <button
          className={`btn btn-ghost${lang === 'en' ? '' : ''}`}
          style={{ padding: '4px 8px', borderColor: 'transparent', color: lang === 'en' ? 'var(--fg)' : 'var(--cd-muted)' }}
          onClick={() => setLang?.('en')}
        >EN</button>
        <span style={{ color: 'var(--muted-2)' }}>/</span>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 8px', borderColor: 'transparent', color: lang === 'es' ? 'var(--fg)' : 'var(--cd-muted)' }}
          onClick={() => setLang?.('es')}
        >ES</button>
      </div>
      <div className="nav-cell right">
        <ModeToggle mode={mode} setMode={setMode} />
      </div>
      <Link href="/login" className="nav-cell right tab" style={{ textDecoration: 'none' }}>Sign in</Link>
      <div className="nav-cell right" style={{ padding: '0 6px' }}>
        <Link href="/b2b/start" className="btn btn-primary tap" style={{ textDecoration: 'none' }}>Get started →</Link>
      </div>
    </nav>
  );
}

const CONSOLE_TABS = [
  { label: 'Console', href: '/dispatch' },
  { label: 'Account', href: '/dispatch/account' },
];

// Console nav (authenticated dispatch users)
export function NavConsole({
  mode,
  setMode,
}: {
  mode: 'dark' | 'light';
  setMode: (m: 'dark' | 'light') => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.email ? user.email.split('@')[0].slice(0, 16) : 'user';

  async function signOut() {
    try {
      const sb = createClient();
      await sb.auth.signOut();
      try { localStorage.removeItem('cruzar_has_session'); } catch { /* noop */ }
    } finally {
      window.location.href = '/login';
    }
  }

  const active = CONSOLE_TABS.find(t => t.href !== '/dispatch'
    ? pathname?.startsWith(t.href)
    : pathname === '/dispatch' || pathname === '/dispatch/'
  )?.href ?? '/dispatch';

  return (
    <nav className="nav">
      <Link href="/dispatch" className="nav-cell" style={{ borderRight: '1px solid var(--cd-border)', gap: 10, textDecoration: 'none' }}>
        <span className="brand">Cruzar</span>
        <span className="brand-sub">/dispatch</span>
      </Link>
      {CONSOLE_TABS.map(t => (
        <Link
          key={t.href}
          href={t.href}
          className={`nav-cell tab${active === t.href ? ' active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          {t.label}
        </Link>
      ))}
      <div style={{ flex: 1, borderRight: '1px solid var(--cd-border)' }} />
      <div className="nav-cell right" style={{ gap: 8 }}>
        <span className="dot live" />
        <span className="lbl-xs" style={{ color: 'var(--cd-green)' }}>LIVE</span>
      </div>
      <div className="nav-cell right">
        <ModeToggle mode={mode} setMode={setMode} />
      </div>
      <button
        onClick={signOut}
        className="nav-cell right tab"
        title="Sign out"
        style={{ padding: '0 14px', background: 'transparent', border: 'none', cursor: 'pointer', gap: 8 }}
        aria-label="Sign out"
      >
        <span style={{
          width: 24, height: 24, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--surface-2)',
          border: '1px solid var(--cd-border)', fontFamily: 'ui-monospace,Menlo,monospace',
          fontSize: 11, color: 'var(--fg)',
        }}>
          {displayName.charAt(0).toUpperCase()}
        </span>
      </button>
    </nav>
  );
}

function ModeToggle({ mode, setMode }: { mode: 'dark' | 'light'; setMode: (m: 'dark' | 'light') => void }) {
  return (
    <button
      className="icobtn tap"
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {mode === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
