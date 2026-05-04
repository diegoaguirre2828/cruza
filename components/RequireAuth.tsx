'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

interface Props {
  /** Where to redirect anon users — relative path, e.g. '/dispatch' */
  redirectFrom: string;
  /** Optional language to preserve through the redirect query */
  lang?: 'en' | 'es';
  /** Children render only when auth resolved + user present. */
  children: React.ReactNode;
}

/**
 * Client-side auth gate. Used as a fallback when server-side redirect()
 * from app router page.tsx / layout.tsx isn't firing in production
 * (suspected Next.js 16 + Vercel runtime quirk 2026-05-04).
 *
 * Behavior:
 *   - While auth resolving: render a minimal placeholder (no flash of UI)
 *   - Auth resolved + no user: useEffect fires window.location to /login
 *     with redirect query preserved
 *   - Auth resolved + user present: render children
 */
export function RequireAuth({ redirectFrom, lang = 'en', children }: Props) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const langSuffix = lang === 'es' ? '&lang=es' : '';
      window.location.replace(`/login?redirect=${encodeURIComponent(redirectFrom)}${langSuffix}`);
    }
  }, [user, loading, redirectFrom, lang]);

  if (loading || !user) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          {lang === 'es' ? 'Verificando sesión…' : 'Checking session…'}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
