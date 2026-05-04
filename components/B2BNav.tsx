'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface B2BNavProps {
  current?: 'workspace' | 'sales' | 'console' | 'account' | 'refunds' | 'eudamed';
  lang?: 'en' | 'es';
}

const ROUTES: Array<{ key: NonNullable<B2BNavProps['current']>; href: string; en: string; es: string }> = [
  { key: 'workspace', href: '/workspace', en: 'Workspace', es: 'Workspace' },
  { key: 'sales',     href: '/insights',  en: 'Sales',     es: 'Ventas' },
  { key: 'console',   href: '/dispatch',  en: 'Console',   es: 'Consola' },
  { key: 'refunds',   href: '/refunds',   en: 'Refunds',   es: 'Reembolsos' },
  { key: 'eudamed',   href: '/eudamed',   en: 'EU MDR',    es: 'EU MDR' },
  { key: 'account',   href: '/dispatch/account', en: 'Account', es: 'Cuenta' },
];

export function B2BNav({ current, lang = 'en' }: B2BNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = current ?? deriveActive(pathname);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  // Build the current path string for lang-toggle links
  const currentPath = pathname || '/workspace';
  const otherLang: 'en' | 'es' = lang === 'es' ? 'en' : 'es';
  const otherLangHref = otherLang === 'es' ? `${currentPath}?lang=es` : currentPath;
  // Preserve other query params if present
  const otherParams = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
  if (otherLang === 'es') otherParams.set('lang', 'es'); else otherParams.delete('lang');
  const langToggleHref = otherParams.toString() ? `${currentPath}?${otherParams.toString()}` : currentPath;

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-40">
      <div className="mx-auto max-w-[1180px] flex items-stretch gap-0 px-5 sm:px-8">
        {/* Cruzar logo / brand */}
        <Link
          href={`/workspace${langSuffix}`}
          className="flex items-center gap-2 pr-5 sm:pr-7 border-r border-border hover:bg-foreground/[0.04] transition"
        >
          <span className="font-serif text-[16px] font-medium text-foreground">Cruzar</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/70">/B2B</span>
        </Link>

        {/* Tabs */}
        <div className="flex items-stretch flex-1 overflow-x-auto">
          {ROUTES.map((r) => {
            const isActive = active === r.key;
            return (
              <Link
                key={r.key}
                href={`${r.href}${langSuffix}`}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative flex items-center px-4 sm:px-5 font-mono text-[11px] uppercase tracking-[0.18em] transition border-r border-border',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                ].join(' ')}
              >
                {lang === 'es' ? r.es : r.en}
              </Link>
            );
          })}
        </div>

        {/* Language toggle on the right */}
        <Link
          href={langToggleHref}
          className="flex items-center gap-1 px-4 sm:px-5 border-l border-border hover:bg-foreground/[0.04] transition font-mono text-[11px] uppercase tracking-[0.18em]"
          title={otherLang === 'es' ? 'Cambiar a Español' : 'Switch to English'}
        >
          <span className={lang === 'en' ? 'text-foreground' : 'text-muted-foreground/60'}>EN</span>
          <span className="text-muted-foreground/40">/</span>
          <span className={lang === 'es' ? 'text-foreground' : 'text-muted-foreground/60'}>ES</span>
        </Link>
      </div>
    </nav>
  );
}

function deriveActive(pathname: string | null): NonNullable<B2BNavProps['current']> {
  if (!pathname) return 'workspace';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/eudamed')) return 'eudamed';
  if (pathname.startsWith('/refunds')) return 'refunds';
  if (pathname.startsWith('/dispatch/account')) return 'account';
  if (pathname.startsWith('/dispatch')) return 'console';
  return 'sales';
}
