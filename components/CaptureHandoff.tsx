'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export interface CaptureReceived {
  blob_url: string;
  filename: string;
  mime: string;
  size_bytes: number;
  uploaded_at: string;
}

interface Props {
  /** Procedure context — paperwork doc upload, driver-doc, supplier affidavit, etc. */
  kind: 'paperwork' | 'driver_doc' | 'affidavit' | 'general';
  /** Caller-supplied correlation token — claim_id, session id, etc. — for tracing. */
  desktop_session_token?: string;
  /** Caller-supplied context (doc_type, claim_id, etc.) — round-trips through metadata. */
  metadata?: Record<string, unknown>;
  /** Fires once the mobile upload lands. Caller pulls blob_url + advances workflow. */
  onReceived: (capture: CaptureReceived) => void;
  /** Called when the operator dismisses the handoff without completing it. */
  onCancel?: () => void;
  lang?: 'en' | 'es';
}

type Status = 'idle' | 'starting' | 'pending' | 'received' | 'expired' | 'error';

const POLL_MS = 2000;

/**
 * Cross-device capture handoff. Renders QR + 6-digit code on desktop;
 * polls /api/capture/[code]/status; fires onReceived when mobile uploads.
 *
 * Per Diego's framing: desktop is the procedural console, mobile is the
 * capture device. Phone scans the QR, snaps the photo, gets a confirmation
 * animation; desktop receives in real-time and continues the procedure.
 */
export function CaptureHandoff({
  kind,
  desktop_session_token,
  metadata,
  onReceived,
  onCancel,
  lang = 'en',
}: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  // Start the session once on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus('starting');
    fetch('/api/capture/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, desktop_session_token, metadata }),
    })
      .then((r) => r.json())
      .then(async (j) => {
        if (j.error) { setStatus('error'); setError(j.error); return; }
        setCode(j.code);
        setMobileUrl(j.mobile_url);
        setStatus('pending');
        try {
          const dataUrl = await QRCode.toDataURL(j.mobile_url, {
            margin: 2,
            width: 320,
            color: { dark: '#FFFFFF', light: '#0a1020' },
          });
          setQrDataUrl(dataUrl);
        } catch {
          // QR optional — code is enough
        }
      })
      .catch((e) => { setStatus('error'); setError(e instanceof Error ? e.message : 'error'); });
  }, [kind, desktop_session_token, metadata]);

  // Poll status while pending
  useEffect(() => {
    if (status !== 'pending' || !code) return;
    pollTimer.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/capture/${code}/status`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.status === 'received' && j.uploaded_blob_url) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStatus('received');
          onReceived({
            blob_url: j.uploaded_blob_url,
            filename: j.uploaded_filename,
            mime: j.uploaded_mime,
            size_bytes: j.uploaded_size_bytes,
            uploaded_at: j.uploaded_at,
          });
        } else if (j.status === 'expired') {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStatus('expired');
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [status, code, onReceived]);

  function copyUrl() {
    if (!mobileUrl) return;
    navigator.clipboard.writeText(mobileUrl).catch(() => { /* noop */ });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
        {lang === 'es' ? 'Captura desde el teléfono' : 'Capture from your phone'}
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">
        {lang === 'es'
          ? 'Escanea el código QR con tu teléfono o ingresa el código en /capture. Toma la foto del documento; tu pantalla aquí continúa cuando llegue la captura.'
          : "Scan the QR with your phone or enter the code at /capture. Snap the document; this screen continues the moment the capture lands."}
      </p>

      {status === 'starting' && (
        <p className="mt-4 font-mono text-[12px] text-muted-foreground/80">
          {lang === 'es' ? 'Iniciando sesión…' : 'Starting session…'}
        </p>
      )}

      {status === 'pending' && code && (
        <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr] items-start">
          <div className="rounded-lg border border-border bg-background p-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Capture QR" className="block w-full h-auto" />
            ) : (
              <div className="aspect-square w-full bg-foreground/[0.04] rounded animate-pulse" />
            )}
          </div>
          <div className="space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                {lang === 'es' ? 'Código' : 'Code'}
              </div>
              <div className="mt-1 font-mono text-[34px] font-semibold tracking-[0.2em] text-foreground">
                {code}
              </div>
            </div>
            {mobileUrl && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  URL
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-[11.5px] text-foreground/85 break-all">{mobileUrl}</code>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                  >
                    {lang === 'es' ? 'Copiar' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
              <span className="font-mono text-[11.5px] text-muted-foreground/80">
                {lang === 'es' ? 'Esperando captura…' : 'Waiting for capture…'}
              </span>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'received' && (
        <div className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-4 text-[13.5px] text-emerald-300">
          ✓ {lang === 'es' ? 'Captura recibida — continuando…' : 'Capture received — continuing…'}
        </div>
      )}

      {status === 'expired' && (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-[13.5px] text-red-300">
          {lang === 'es'
            ? 'Sesión expirada. Recarga para iniciar otra.'
            : 'Session expired. Reload to start another.'}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-[13.5px] text-red-300">
          {error ?? (lang === 'es' ? 'Error iniciando sesión' : 'Error starting session')}
        </div>
      )}
    </div>
  );
}
