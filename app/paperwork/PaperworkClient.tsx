'use client';

import { useState } from 'react';

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

export default function PaperworkClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
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

  return (
    <div>
      <form onSubmit={handleUpload} className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <label className="block">
          <span className="text-sm text-white/60">Document file / Archivo del documento</span>
          <input
            name="file"
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            required
            disabled={busy}
            className="mt-2 block w-full rounded border border-white/10 bg-black/30 p-2 text-white"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-white/60">Shipment ref (optional) / Referencia (opcional)</span>
          <input
            name="shipment_ref"
            type="text"
            placeholder="e.g. PO-2026-001"
            disabled={busy}
            className="mt-2 block w-full rounded border border-white/10 bg-black/30 p-2 text-white"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Processing... / Procesando...' : 'Extract / Extraer'}
        </button>
      </form>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {result && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-2 text-lg font-semibold">Result / Resultado</h2>
          <p className="text-sm text-white/60">{result.composition.doc_count} document(s) extracted</p>
          {result.composition.blocking_issues.length > 0 && (
            <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3">
              <p className="font-semibold text-red-400">Blocking issues / Problemas:</p>
              <ul className="mt-2 list-disc pl-6 text-sm">
                {result.composition.blocking_issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {result.composition.documents_extracted.map((d, i) => (
              <div key={i} className="rounded border border-white/10 bg-black/30 p-3">
                <p className="font-mono text-xs text-white/50">{d.doc_type} (conf {d.confidence.toFixed(2)})</p>
                <p className="mt-1 text-sm">{d.fields_summary}</p>
                {Object.entries(d.flags).length > 0 && (
                  <p className="mt-2 text-xs text-amber-400">Flags: {Object.entries(d.flags).map(([k,v]) => `${k}=${v}`).join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
