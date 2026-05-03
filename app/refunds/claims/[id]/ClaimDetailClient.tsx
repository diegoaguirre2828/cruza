'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface DetailCopy {
  back: string;
  section_summary: string; section_entries: string; section_actions: string;
  label_ior: string; label_filer_code: string; label_total_entries: string;
  label_principal_owed: string; label_interest_owed: string; label_recoverable: string;
  label_cape_eligible: string; label_protest_required: string; label_past_window: string;
  label_status: string; label_cape_claim_number: string; label_received_amount: string;
  label_cruzar_fee: string;
  upload_label: string; uploading: string; upload_help: string;
  download_cape: string; download_form19: string;
  mark_submitted: string; mark_submitted_modal_title: string; mark_submitted_field: string;
  mark_received: string; mark_received_modal_title: string; mark_received_field: string;
  confirm: string; cancel: string;
  entry_col_number: string; entry_col_country: string; entry_col_eo: string;
  entry_col_principal: string; entry_col_interest: string; entry_col_cliff: string;
}

interface ClaimsCopy {
  status_draft: string; status_validated: string; status_submitted_to_ace: string;
  status_refund_in_transit: string; status_refund_received: string; status_rejected: string;
}

interface Claim {
  id: number;
  ior_name: string;
  ior_id_number: string;
  filer_code: string | null;
  total_entries: number;
  total_principal_owed_usd: number | string;
  total_interest_owed_usd: number | string;
  cape_eligible_count: number;
  protest_required_count: number;
  past_protest_window_count: number;
  status: string;
  language: string;
  cape_csv_url: string | null;
  form19_packet_url: string | null;
  cape_claim_number: string | null;
  refund_received_amount_usd: number | string | null;
  cruzar_fee_usd: number | string | null;
}

interface Entry {
  id: number;
  entry_number: string;
  country_of_origin: string;
  applicable_eo: string | null;
  ieepa_principal_paid_usd: number | string;
  interest_accrued_usd: number | string;
  cliff_status: string;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function ClaimDetailClient({
  claimId, lang, detailCopy, claimsCopy,
}: {
  claimId: number;
  lang: 'en' | 'es';
  detailCopy: DetailCopy;
  claimsCopy: ClaimsCopy;
}) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReceivedModal, setShowReceivedModal] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  async function load() {
    const r = await fetch(`/api/refunds/claims/${claimId}`);
    if (!r.ok) return;
    const j = await r.json();
    setClaim(j.claim);
    setEntries(j.entries ?? []);
  }
  useEffect(() => { load(); }, [claimId]);

  async function uploadCsv(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('csv', file);
      const r = await fetch(`/api/refunds/claims/${claimId}/upload-ace-csv`, { method: 'POST', body: fd });
      if (r.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(s: string): string {
    switch (s) {
      case 'draft': return claimsCopy.status_draft;
      case 'validated': return claimsCopy.status_validated;
      case 'submitted_to_ace': return claimsCopy.status_submitted_to_ace;
      case 'refund_in_transit': return claimsCopy.status_refund_in_transit;
      case 'refund_received': return claimsCopy.status_refund_received;
      case 'rejected': return claimsCopy.status_rejected;
      default: return s;
    }
  }

  if (!claim) return <div className="text-[14px] text-white/45">…</div>;

  const recoverable =
    Number(claim.total_principal_owed_usd ?? 0) + Number(claim.total_interest_owed_usd ?? 0);

  return (
    <div>
      <Link href={`/refunds/claims${langSuffix}`} className="text-[12px] text-white/55 hover:text-amber-300">
        {detailCopy.back}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="font-serif text-[28px] text-white">#{claim.id}</h1>
        <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-amber-300">
          {statusLabel(claim.status)}
        </span>
      </div>

      <section className="mt-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
          {detailCopy.section_summary}
        </div>
        <div className="mt-4 grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 sm:grid-cols-2">
          <Row label={detailCopy.label_ior} value={`${claim.ior_name} · ${claim.ior_id_number}`} />
          {claim.filer_code && <Row label={detailCopy.label_filer_code} value={claim.filer_code} />}
          <Row label={detailCopy.label_total_entries} value={String(claim.total_entries)} />
          <Row label={detailCopy.label_principal_owed} value={fmt(Number(claim.total_principal_owed_usd ?? 0))} />
          <Row label={detailCopy.label_interest_owed} value={fmt(Number(claim.total_interest_owed_usd ?? 0))} />
          <Row label={detailCopy.label_recoverable} value={fmt(recoverable)} emphasis />
          <Row label={detailCopy.label_cape_eligible} value={String(claim.cape_eligible_count)} />
          <Row label={detailCopy.label_protest_required} value={String(claim.protest_required_count)} />
          <Row label={detailCopy.label_past_window} value={String(claim.past_protest_window_count)} />
          {claim.cape_claim_number && <Row label={detailCopy.label_cape_claim_number} value={claim.cape_claim_number} />}
          {claim.refund_received_amount_usd !== null && (
            <Row label={detailCopy.label_received_amount} value={fmt(Number(claim.refund_received_amount_usd))} emphasis />
          )}
          {claim.cruzar_fee_usd !== null && (
            <Row label={detailCopy.label_cruzar_fee} value={fmt(Number(claim.cruzar_fee_usd))} />
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
          {detailCopy.section_actions}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {(claim.status === 'draft' || claim.status === 'validated') && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCsv(f);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-lg border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-300/20 disabled:opacity-50"
              >
                {busy ? detailCopy.uploading : detailCopy.upload_label}
              </button>
            </>
          )}
          {claim.cape_csv_url && (
            <a
              href={`/api/refunds/claims/${claimId}/cape-csv`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/85 hover:border-amber-300/60 hover:text-amber-300"
            >
              {detailCopy.download_cape}
            </a>
          )}
          {claim.form19_packet_url && (
            <a
              href={`/api/refunds/claims/${claimId}/form19-packet`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/85 hover:border-amber-300/60 hover:text-amber-300"
            >
              {detailCopy.download_form19}
            </a>
          )}
          {claim.status === 'validated' && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-[#0a1020] hover:bg-amber-200"
            >
              {detailCopy.mark_submitted}
            </button>
          )}
          {(claim.status === 'submitted_to_ace' || claim.status === 'refund_in_transit') && (
            <button
              onClick={() => setShowReceivedModal(true)}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-[#0a1020] hover:bg-emerald-300"
            >
              {detailCopy.mark_received}
            </button>
          )}
        </div>
        {(claim.status === 'draft' || claim.status === 'validated') && (
          <p className="mt-3 text-[12.5px] text-white/45">{detailCopy.upload_help}</p>
        )}
      </section>

      {entries.length > 0 && (
        <section className="mt-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
            {detailCopy.section_entries}
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07]">
            <table className="w-full text-[13px]">
              <thead className="bg-white/[0.03] text-left">
                <tr className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/45">
                  <th className="px-4 py-3">{detailCopy.entry_col_number}</th>
                  <th className="px-4 py-3">{detailCopy.entry_col_country}</th>
                  <th className="px-4 py-3">{detailCopy.entry_col_eo}</th>
                  <th className="px-4 py-3">{detailCopy.entry_col_principal}</th>
                  <th className="px-4 py-3">{detailCopy.entry_col_interest}</th>
                  <th className="px-4 py-3">{detailCopy.entry_col_cliff}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-white/85">{e.entry_number}</td>
                    <td className="px-4 py-2 text-white/65">{e.country_of_origin}</td>
                    <td className="px-4 py-2 font-mono text-white/65">{e.applicable_eo ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-white/85">{fmt(Number(e.ieepa_principal_paid_usd ?? 0))}</td>
                    <td className="px-4 py-2 font-mono text-white/65">{fmt(Number(e.interest_accrued_usd ?? 0))}</td>
                    <td className="px-4 py-2 text-white/65">{e.cliff_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showSubmitModal && (
        <Modal
          title={detailCopy.mark_submitted_modal_title}
          confirm={detailCopy.confirm}
          cancel={detailCopy.cancel}
          onClose={() => setShowSubmitModal(false)}
          onConfirm={async (val) => {
            await fetch(`/api/refunds/claims/${claimId}/mark-submitted`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ cape_claim_number: val || undefined }),
            });
            setShowSubmitModal(false);
            await load();
          }}
        >
          <input
            type="text"
            placeholder={detailCopy.mark_submitted_field}
            id="cape_claim_number_input"
            className="mt-3 w-full rounded-md border border-white/15 bg-[#0a1020] px-3 py-2 text-[14px] text-white outline-none focus:border-amber-300/60"
          />
        </Modal>
      )}

      {showReceivedModal && (
        <Modal
          title={detailCopy.mark_received_modal_title}
          confirm={detailCopy.confirm}
          cancel={detailCopy.cancel}
          onClose={() => setShowReceivedModal(false)}
          onConfirm={async (val) => {
            const amount = Number(val);
            if (!Number.isFinite(amount) || amount < 0) return;
            await fetch(`/api/refunds/claims/${claimId}/mark-received`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ refund_received_amount_usd: amount }),
            });
            setShowReceivedModal(false);
            await load();
          }}
        >
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder={detailCopy.mark_received_field}
            id="received_amount_input"
            className="mt-3 w-full rounded-md border border-white/15 bg-[#0a1020] px-3 py-2 font-mono text-[14px] text-white outline-none focus:border-amber-300/60"
          />
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <span className="text-[12.5px] text-white/55">{label}</span>
      <span
        className={
          emphasis
            ? 'font-mono text-[15px] text-amber-200'
            : 'font-mono text-[13.5px] text-white/85'
        }
      >
        {value}
      </span>
    </div>
  );
}

function Modal({
  title, confirm, cancel, onClose, onConfirm, children,
}: {
  title: string;
  confirm: string;
  cancel: string;
  onClose: () => void;
  onConfirm: (val: string) => void;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[min(420px,92vw)] rounded-xl border border-white/[0.1] bg-[#0a1020] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-[18px] text-white">{title}</div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-white/15 px-3 py-1.5 text-[13px] text-white/65 hover:text-white">
            {cancel}
          </button>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const inputs = document.querySelectorAll<HTMLInputElement>(
                '#cape_claim_number_input, #received_amount_input',
              );
              const val = inputs[0]?.value ?? '';
              await onConfirm(val);
              setPending(false);
            }}
            className="rounded-md bg-amber-300 px-3 py-1.5 text-[13px] font-medium text-[#0a1020] hover:bg-amber-200 disabled:opacity-50"
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
