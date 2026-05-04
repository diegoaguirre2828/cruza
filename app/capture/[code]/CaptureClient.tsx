'use client';

import { useEffect, useState } from 'react';

interface SessionStatus {
  status: 'pending' | 'received' | 'expired' | 'cancelled';
  kind: string;
  uploaded_filename?: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  code: string;
  lang: 'en' | 'es';
}

export function CaptureClient({ code, lang }: Props) {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/capture/${code}/status`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        setSession(j as SessionStatus);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'error'))
      .finally(() => setLoading(false));
  }, [code]);

  async function upload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/capture/${code}/upload`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? 'upload_failed');
        return;
      }
      setUploaded(true);
      // Vibrate on devices that support it — confirmation feedback
      if ('vibrate' in navigator) {
        try { (navigator as Navigator & { vibrate?: (p: number | number[]) => void }).vibrate?.([60, 30, 60]); } catch { /* noop */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground">
        {lang === 'es' ? 'Cargando…' : 'Loading…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-red-300">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em]">Error</div>
        <p className="mt-1 text-[14px]">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
        {lang === 'es' ? 'Sesión no encontrada.' : 'Session not found.'}
      </div>
    );
  }

  if (session.status === 'expired' || session.status === 'cancelled') {
    return (
      <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-red-300">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em]">
          {lang === 'es' ? 'Sesión expirada' : 'Session expired'}
        </div>
        <p className="mt-1 text-[14px]">
          {lang === 'es'
            ? 'Pide a quien está en el escritorio que inicie una nueva.'
            : 'Ask the desktop operator to start a new one.'}
        </p>
      </div>
    );
  }

  if (uploaded || session.status === 'received') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 gap-4">
        {/* Confirmation animation — checkmark in a pulse */}
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          <svg
            viewBox="0 0 80 80"
            className="relative h-24 w-24 text-emerald-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="40" cy="40" r="36" />
            <path d="M24 42 L36 54 L58 30" className="origin-center animate-[draw_500ms_ease-out_forwards]" pathLength="1" strokeDasharray="1" strokeDashoffset="0" />
          </svg>
        </div>
        <div>
          <div className="font-serif text-[22px] text-foreground">
            {lang === 'es' ? 'Captura recibida' : 'Capture received'}
          </div>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {lang === 'es'
              ? 'Tu pantalla del escritorio ya continuó. Puedes cerrar este tab.'
              : 'The desktop screen has continued. You can close this tab.'}
          </p>
        </div>
      </div>
    );
  }

  // Pending — capture flow
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          {lang === 'es' ? 'Tipo de captura' : 'Capture kind'}
        </div>
        <div className="mt-1 text-[15px] font-medium text-foreground">{session.kind}</div>
        {session.metadata && Object.keys(session.metadata).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11.5px] text-muted-foreground/70">
              {lang === 'es' ? 'Contexto' : 'Context'}
            </summary>
            <pre className="mt-2 text-[10.5px] text-muted-foreground/80 whitespace-pre-wrap">
              {JSON.stringify(session.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <label className="block">
        <span className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          {lang === 'es' ? 'Toma la foto' : 'Take the photo'}
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-border bg-card px-3 py-3 text-[14px] text-foreground file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-background file:font-mono file:text-[11px] file:uppercase file:tracking-[0.14em]"
        />
      </label>

      {file && (
        <div className="rounded-lg border border-border bg-card p-3 text-[12.5px] text-muted-foreground">
          {file.name} · {(file.size / 1024).toFixed(1)} KB
        </div>
      )}

      <button
        type="button"
        onClick={upload}
        disabled={!file || uploading}
        className="w-full rounded-lg bg-foreground py-4 text-[16px] font-medium text-background hover:bg-foreground/85 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {uploading
          ? (lang === 'es' ? 'Subiendo…' : 'Uploading…')
          : (lang === 'es' ? 'Enviar al escritorio' : 'Send to desktop')}
      </button>

      <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/60">
        {lang === 'es' ? 'Sesión válida 15 minutos' : 'Session valid 15 minutes'}
      </p>
    </div>
  );
}
