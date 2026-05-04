'use client';

import { useState } from 'react';
import { CaptureHandoff, type CaptureReceived } from '@/components/CaptureHandoff';

interface ExtractResponse {
  composition: {
    doc_count: number;
    documents_extracted: Array<{ doc_type: string; fields_summary: string; confidence: number; flags: Record<string, boolean> }>;
    blocking_issues: string[];
    earliest_warning: string | null;
    composed_at_iso: string;
  };
  per_page: Array<{ doc_type: string; fields: Record<string, unknown>; doc_level_confidence: number; provider_used: string }>;
}

type Mode = 'desktop' | 'phone';

export default function PaperworkClient() {
  const [mode, setMode] = useState<Mode>('desktop');
  const [shipmentRef, setShipmentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoffActive, setHandoffActive] = useState(false);

  async function handleDesktopUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/paperwork/extract', { method: 'POST', body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json() as ExtractResponse;
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Mobile handoff completed — fetch the blob, build a File, submit to extract.
  // Desktop continues the procedure as if the operator had uploaded directly,
  // because the desktop never left the procedural surface.
  async function handlePhoneCapture(capture: CaptureReceived) {
    setBusy(true); setError(null); setResult(null);
    setHandoffActive(false);
    try {
      const blobRes = await fetch(capture.blob_url);
      if (!blobRes.ok) throw new Error(`blob fetch ${blobRes.status}`);
      const blob = await blobRes.blob();
      const file = new File([blob], capture.filename || 'capture', { type: capture.mime || blob.type });

      const fd = new FormData();
      fd.append('file', file);
      if (shipmentRef) fd.append('shipment_ref', shipmentRef);

      const r = await fetch('/api/paperwork/extract', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json() as ExtractResponse;
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle — this is the hybrid pattern made visible */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setMode('desktop'); setHandoffActive(false); }}
          className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition ${
            mode === 'desktop'
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Upload from this device
        </button>
        <button
          type="button"
          onClick={() => setMode('phone')}
          className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition ${
            mode === 'phone'
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Capture from phone
        </button>
      </div>

      {mode === 'desktop' && (
        <form onSubmit={handleDesktopUpload} className="rounded-2xl border border-border bg-card p-6">
          <label className="block">
            <span className="text-sm text-muted-foreground">Document file / Archivo del documento</span>
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              required
              disabled={busy}
              className="mt-2 block w-full rounded border border-border bg-background p-2 text-foreground"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm text-muted-foreground">Shipment ref (optional)</span>
            <input
              name="shipment_ref"
              type="text"
              value={shipmentRef}
              onChange={(e) => setShipmentRef(e.target.value)}
              placeholder="e.g. PO-2026-001"
              disabled={busy}
              className="mt-2 block w-full rounded border border-border bg-background p-2 text-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background hover:bg-foreground/85 disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Extract'}
          </button>
        </form>
      )}

      {mode === 'phone' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <label className="block">
              <span className="text-sm text-muted-foreground">Shipment ref (optional)</span>
              <input
                type="text"
                value={shipmentRef}
                onChange={(e) => setShipmentRef(e.target.value)}
                placeholder="e.g. PO-2026-001"
                disabled={busy}
                className="mt-2 block w-full rounded border border-border bg-background p-2 text-foreground"
              />
            </label>
            {!handoffActive && !busy && !result && (
              <button
                type="button"
                onClick={() => setHandoffActive(true)}
                className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background hover:bg-foreground/85"
              >
                Open phone capture →
              </button>
            )}
          </div>

          {handoffActive && (
            <CaptureHandoff
              kind="paperwork"
              metadata={{ shipment_ref: shipmentRef || null }}
              onReceived={handlePhoneCapture}
              onCancel={() => setHandoffActive(false)}
            />
          )}

          {busy && (
            <div className="rounded-lg border border-border bg-card p-4 text-[13.5px] text-muted-foreground">
              Capture received. Extracting on desktop…
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-300">{error}</p>}

      {result && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-serif text-[18px] text-foreground">Result</h2>
          <p className="text-sm text-muted-foreground">{result.composition.doc_count} document(s) extracted</p>
          {result.composition.blocking_issues.length > 0 && (
            <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3">
              <p className="font-semibold text-red-300">Blocking issues:</p>
              <ul className="mt-2 list-disc pl-6 text-sm">
                {result.composition.blocking_issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {result.composition.documents_extracted.map((d, i) => (
              <div key={i} className="rounded border border-border bg-background p-3">
                <p className="font-mono text-xs text-muted-foreground/70">{d.doc_type} (conf {d.confidence.toFixed(2)})</p>
                <p className="mt-1 text-sm text-foreground">{d.fields_summary}</p>
                {Object.entries(d.flags).length > 0 && (
                  <p className="mt-2 text-xs text-accent">Flags: {Object.entries(d.flags).map(([k, v]) => `${k}=${v}`).join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
