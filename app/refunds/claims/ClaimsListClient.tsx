'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ClaimsCopy {
  new_claim: string;
  empty_title: string;
  empty_body: string;
  empty_cta: string;
  col_id: string;
  col_ior: string;
  col_entries: string;
  col_recoverable: string;
  col_status: string;
  col_updated: string;
  status_draft: string;
  status_validated: string;
  status_submitted_to_ace: string;
  status_refund_in_transit: string;
  status_refund_received: string;
  status_rejected: string;
  new_form_title: string;
  ior_name_label: string;
  ior_id_label: string;
  filer_code_label: string;
  language_label: string;
  create: string;
  creating: string;
}

interface Claim {
  id: number;
  ior_name: string;
  ior_id_number: string;
  filer_code: string | null;
  total_entries: number;
  total_principal_owed_usd: number | string;
  total_interest_owed_usd: number | string;
  status: string;
  language: string;
  updated_at: string;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function ClaimsListClient({ lang, copy }: { lang: 'en' | 'es'; copy: ClaimsCopy }) {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  useEffect(() => {
    fetch('/api/refunds/claims')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => setClaims(j?.claims ?? []))
      .catch(() => setClaims([]));
  }, []);

  function statusLabel(s: string): string {
    switch (s) {
      case 'draft': return copy.status_draft;
      case 'validated': return copy.status_validated;
      case 'submitted_to_ace': return copy.status_submitted_to_ace;
      case 'refund_in_transit': return copy.status_refund_in_transit;
      case 'refund_received': return copy.status_refund_received;
      case 'rejected': return copy.status_rejected;
      default: return s;
    }
  }

  function statusClass(s: string): string {
    if (s === 'refund_received') return 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30';
    if (s === 'rejected') return 'bg-red-400/15 text-red-300 border-red-400/30';
    if (s === 'submitted_to_ace' || s === 'refund_in_transit')
      return 'bg-amber-300/15 text-amber-300 border-amber-300/30';
    if (s === 'validated') return 'bg-sky-400/15 text-sky-300 border-sky-400/30';
    return 'bg-white/[0.04] text-white/55 border-white/15';
  }

  if (claims === null) {
    return <div className="text-[14px] text-white/45">…</div>;
  }

  return (
    <div>
      <div className="mb-6 flex justify-between gap-3">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-[#0a1020] hover:bg-amber-200"
        >
          {copy.new_claim}
        </button>
      </div>

      {showNew && <NewClaimForm copy={copy} onCreated={(c) => { setClaims((prev) => [c, ...(prev ?? [])]); setShowNew(false); }} />}

      {claims.length === 0 && !showNew && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-10 text-center">
          <div className="font-serif text-[20px] text-white">{copy.empty_title}</div>
          <p className="mt-3 text-[14.5px] text-white/65">{copy.empty_body}</p>
          <Link
            href={`/refunds/scan${langSuffix}`}
            className="mt-6 inline-block rounded-lg border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-300/20"
          >
            {copy.empty_cta}
          </Link>
        </div>
      )}

      {claims.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
          <table className="w-full text-[13.5px]">
            <thead className="bg-white/[0.03] text-left">
              <tr className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/45">
                <th className="px-4 py-3">{copy.col_id}</th>
                <th className="px-4 py-3">{copy.col_ior}</th>
                <th className="px-4 py-3">{copy.col_entries}</th>
                <th className="px-4 py-3">{copy.col_recoverable}</th>
                <th className="px-4 py-3">{copy.col_status}</th>
                <th className="px-4 py-3">{copy.col_updated}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const recoverable = Number(c.total_principal_owed_usd ?? 0) + Number(c.total_interest_owed_usd ?? 0);
                return (
                  <tr key={c.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/refunds/claims/${c.id}${langSuffix}`}
                        className="font-mono text-amber-300 hover:text-amber-200"
                      >
                        #{c.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white/85">{c.ior_name}</td>
                    <td className="px-4 py-3 text-white/65">{c.total_entries}</td>
                    <td className="px-4 py-3 font-mono text-white/85">{fmt(recoverable)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.14em] ${statusClass(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/55">{new Date(c.updated_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewClaimForm({ copy, onCreated }: { copy: ClaimsCopy; onCreated: (c: Claim) => void }) {
  const [iorName, setIorName] = useState('');
  const [iorId, setIorId] = useState('');
  const [filerCode, setFilerCode] = useState('');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch('/api/refunds/claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ior_name: iorName.trim(),
          ior_id_number: iorId.trim(),
          filer_code: filerCode.trim() || undefined,
          language,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        onCreated(j.claim);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
      <div className="font-serif text-[18px] text-white">{copy.new_form_title}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={copy.ior_name_label} value={iorName} onChange={setIorName} required />
        <Field label={copy.ior_id_label} value={iorId} onChange={setIorId} required />
        <Field label={copy.filer_code_label} value={filerCode} onChange={(v) => setFilerCode(v.toUpperCase().slice(0, 3))} />
        <label className="block text-[12.5px] text-white/60">
          <span>{copy.language_label}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
            className="mt-1 w-full rounded-md border border-white/15 bg-[#0a1020] px-3 py-2 text-[14px] text-white outline-none focus:border-amber-300/60"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy || !iorName.trim() || !iorId.trim()}
        className="mt-6 rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-[#0a1020] hover:bg-amber-200 disabled:opacity-50"
      >
        {busy ? copy.creating : copy.create}
      </button>
    </form>
  );
}

function Field({
  label, value, onChange, required,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block text-[12.5px] text-white/60">
      <span>{label}{required && <span className="text-amber-300/80"> *</span>}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-md border border-white/15 bg-[#0a1020] px-3 py-2 text-[14px] text-white outline-none focus:border-amber-300/60"
      />
    </label>
  );
}
