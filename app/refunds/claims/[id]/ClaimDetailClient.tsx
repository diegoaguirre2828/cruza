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
  section_broker_of_record: string; broker_of_record_help: string;
  broker_name_label: string; broker_license_label: string; broker_attest_label: string;
  section_ior_attestation: string; ior_attest_help: string;
  ior_attest_signer_label: string; ior_attest_label: string;
  save_attestation: string; saved: string;
  submission_blocked_broker: string; submission_blocked_ior: string;
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
  broker_of_record_name: string | null;
  broker_of_record_license_number: string | null;
  broker_of_record_attested_at: string | null;
  ior_attested_signer_name: string | null;
  ior_attested_at: string | null;
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
  const [savingAttestation, setSavingAttestation] = useState(false);
  const [attestationSaved, setAttestationSaved] = useState(false);
  const [brokerName, setBrokerName] = useState('');
  const [brokerLicense, setBrokerLicense] = useState('');
  const [brokerAttest, setBrokerAttest] = useState(false);
  const [iorSigner, setIorSigner] = useState('');
  const [iorAttest, setIorAttest] = useState(false);
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
    if (j.claim) {
      setBrokerName(j.claim.broker_of_record_name ?? '');
      setBrokerLicense(j.claim.broker_of_record_license_number ?? '');
      setBrokerAttest(!!j.claim.broker_of_record_attested_at);
      setIorSigner(j.claim.ior_attested_signer_name ?? '');
      setIorAttest(!!j.claim.ior_attested_at);
    }
  }
  useEffect(() => { load(); }, [claimId]);

  async function saveAttestation() {
    setSavingAttestation(true);
    setAttestationSaved(false);
    try {
      const r = await fetch(`/api/refunds/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          broker_of_record_name: brokerName.trim() || undefined,
          broker_of_record_license_number: brokerLicense.trim() || undefined,
          broker_of_record_attested: brokerAttest && brokerName.trim() && brokerLicense.trim() ? true : false,
          ior_attested_signer_name: iorSigner.trim() || undefined,
          ior_attested: iorAttest && iorSigner.trim() ? true : false,
        }),
      });
      if (r.ok) {
        await load();
        setAttestationSaved(true);
      }
    } finally {
      setSavingAttestation(false);
    }
  }

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

  if (!claim) return <div className="text-[14px] text-muted-foreground/70">…</div>;

  const recoverable =
    Number(claim.total_principal_owed_usd ?? 0) + Number(claim.total_interest_owed_usd ?? 0);
  const brokerReady = !!(claim.broker_of_record_name && claim.broker_of_record_license_number && claim.broker_of_record_attested_at);
  const iorReady = !!claim.ior_attested_at;
  const showAttestationSection = claim.status === 'validated' || claim.status === 'submitted_to_ace' || (claim.status === 'draft' && claim.cape_csv_url);

  return (
    <div>
      <Link href={`/refunds/claims${langSuffix}`} className="text-[12px] text-muted-foreground/80 hover:text-foreground">
        {detailCopy.back}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="font-serif text-[28px] text-foreground">#{claim.id}</h1>
        <span className="rounded-md border border-accent/30 bg-foreground/5 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
          {statusLabel(claim.status)}
        </span>
      </div>

      <section className="mt-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
          {detailCopy.section_summary}
        </div>
        <div className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
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
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
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
                className="rounded-lg border border-foreground/60 bg-foreground/5 px-4 py-2 text-sm text-accent hover:bg-foreground/15 disabled:opacity-50"
              >
                {busy ? detailCopy.uploading : detailCopy.upload_label}
              </button>
            </>
          )}
          {claim.cape_csv_url && (
            <a
              href={`/api/refunds/claims/${claimId}/cape-csv`}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/85 hover:border-foreground/60 hover:text-foreground"
            >
              {detailCopy.download_cape}
            </a>
          )}
          {claim.form19_packet_url && (
            <a
              href={`/api/refunds/claims/${claimId}/form19-packet`}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/85 hover:border-foreground/60 hover:text-foreground"
            >
              {detailCopy.download_form19}
            </a>
          )}
          {claim.status === 'validated' && (
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={!brokerReady || !iorReady}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
              title={!brokerReady ? detailCopy.submission_blocked_broker : !iorReady ? detailCopy.submission_blocked_ior : undefined}
            >
              {detailCopy.mark_submitted}
            </button>
          )}
          {(claim.status === 'submitted_to_ace' || claim.status === 'refund_in_transit') && (
            <button
              onClick={() => setShowReceivedModal(true)}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-background hover:bg-emerald-300"
            >
              {detailCopy.mark_received}
            </button>
          )}
        </div>
        {(claim.status === 'draft' || claim.status === 'validated') && (
          <p className="mt-3 text-[12.5px] text-muted-foreground/70">{detailCopy.upload_help}</p>
        )}
        {claim.status === 'validated' && (!brokerReady || !iorReady) && (
          <p className="mt-3 text-[12.5px] text-foreground/80">
            {!brokerReady ? detailCopy.submission_blocked_broker : detailCopy.submission_blocked_ior}
          </p>
        )}
      </section>

      {showAttestationSection && (
        <section className="mt-8">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
            {detailCopy.section_broker_of_record}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-6">
            <p className="text-[13px] leading-[1.6] text-muted-foreground/80">{detailCopy.broker_of_record_help}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-[12.5px] text-muted-foreground/80">
                <span>{detailCopy.broker_name_label}</span>
                <input
                  type="text"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  disabled={claim.status !== 'validated'}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60 disabled:opacity-50"
                />
              </label>
              <label className="block text-[12.5px] text-muted-foreground/80">
                <span>{detailCopy.broker_license_label}</span>
                <input
                  type="text"
                  value={brokerLicense}
                  onChange={(e) => setBrokerLicense(e.target.value)}
                  disabled={claim.status !== 'validated'}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px] text-foreground outline-none focus:border-foreground/60 disabled:opacity-50"
                />
              </label>
            </div>
            <label className="mt-4 flex items-start gap-3 cursor-pointer text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={brokerAttest}
                onChange={(e) => setBrokerAttest(e.target.checked)}
                disabled={claim.status !== 'validated'}
                className="mt-1"
              />
              <span>{detailCopy.broker_attest_label}</span>
            </label>
          </div>

          <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
            {detailCopy.section_ior_attestation}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-6">
            <p className="text-[13px] leading-[1.6] text-muted-foreground/80">{detailCopy.ior_attest_help}</p>
            <label className="mt-4 block text-[12.5px] text-muted-foreground/80">
              <span>{detailCopy.ior_attest_signer_label}</span>
              <input
                type="text"
                value={iorSigner}
                onChange={(e) => setIorSigner(e.target.value)}
                disabled={claim.status !== 'validated'}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60 disabled:opacity-50"
              />
            </label>
            <label className="mt-4 flex items-start gap-3 cursor-pointer text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={iorAttest}
                onChange={(e) => setIorAttest(e.target.checked)}
                disabled={claim.status !== 'validated'}
                className="mt-1"
              />
              <span>{detailCopy.ior_attest_label}</span>
            </label>
          </div>

          {claim.status === 'validated' && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={saveAttestation}
                disabled={savingAttestation}
                className="rounded-lg border border-foreground/60 bg-foreground/5 px-4 py-2 text-sm text-accent hover:bg-foreground/15 disabled:opacity-50"
              >
                {savingAttestation ? '...' : detailCopy.save_attestation}
              </button>
              {attestationSaved && <span className="text-[12.5px] text-accent">{detailCopy.saved}</span>}
              {brokerReady && (
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-300">✓ broker</span>
              )}
              {iorReady && (
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-300">✓ IOR</span>
              )}
            </div>
          )}
        </section>
      )}

      {entries.length > 0 && (
        <section className="mt-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
            {detailCopy.section_entries}
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead className="bg-white/[0.03] text-left">
                <tr className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
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
                  <tr key={e.id} className="border-t border-border/70 hover:bg-card">
                    <td className="px-4 py-2 font-mono text-foreground/85">{e.entry_number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.country_of_origin}</td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{e.applicable_eo ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-foreground/85">{fmt(Number(e.ieepa_principal_paid_usd ?? 0))}</td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{fmt(Number(e.interest_accrued_usd ?? 0))}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.cliff_status}</td>
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
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/60"
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
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px] text-foreground outline-none focus:border-foreground/60"
          />
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <span className="text-[12.5px] text-muted-foreground/80">{label}</span>
      <span
        className={
          emphasis
            ? 'font-mono text-[15px] text-accent'
            : 'font-mono text-[13.5px] text-foreground/85'
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
        className="w-[min(420px,92vw)] rounded-xl border border-white/[0.1] bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-[18px] text-foreground">{title}</div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground">
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
            className="rounded-md bg-foreground px-3 py-1.5 text-[13px] font-medium text-background hover:bg-foreground/85 disabled:opacity-50"
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
