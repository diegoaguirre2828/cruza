'use client';

import { useEffect, useState } from 'react';

interface SetupCopy {
  step1_title: string; step1_body: string; step1_link_label: string; step1_link_url: string;
  step2_title: string; step2_body: string;
  step3_title: string; step3_body: string;
  step4_title: string; step4_body: string; step4_link_label: string; step4_link_url: string;
  status_not_started: string; status_pending: string; status_active: string; status_enrolled: string;
  save: string; saving: string; saved: string;
  bank_routing_label: string; bank_account_label: string;
}

type AceStatus = 'not_started' | 'pending' | 'active';
type AchStatus = 'not_started' | 'pending' | 'enrolled';

interface OnboardingState {
  ace_portal_account_status: AceStatus;
  ach_enrollment_status: AchStatus;
  bank_routing_last4: string | null;
  bank_account_last4: string | null;
  notes: string | null;
}

const blank: OnboardingState = {
  ace_portal_account_status: 'not_started',
  ach_enrollment_status: 'not_started',
  bank_routing_last4: null,
  bank_account_last4: null,
  notes: null,
};

export function SetupClient({ lang, copy }: { lang: 'en' | 'es'; copy: SetupCopy }) {
  const [state, setState] = useState<OnboardingState>(blank);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [routingDraft, setRoutingDraft] = useState('');
  const [accountDraft, setAccountDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/refunds/ach-onboarding')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (cancelled || !j?.onboarding) return;
        const o = j.onboarding;
        setState({
          ace_portal_account_status: o.ace_portal_account_status ?? 'not_started',
          ach_enrollment_status: o.ach_enrollment_status ?? 'not_started',
          bank_routing_last4: o.bank_routing_last4 ?? null,
          bank_account_last4: o.bank_account_last4 ?? null,
          notes: o.notes ?? null,
        });
        if (o.bank_routing_last4) setRoutingDraft(o.bank_routing_last4);
        if (o.bank_account_last4) setAccountDraft(o.bank_account_last4);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function save(patch: Partial<OnboardingState> & { bank_routing_last4?: string; bank_account_last4?: string }) {
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch('/api/refunds/ach-onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...patch, language: lang }),
      });
      if (r.ok) {
        const j = await r.json();
        setState((prev) => ({ ...prev, ...j.onboarding }));
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const aceLabel = (s: AceStatus) =>
    s === 'active' ? copy.status_active
      : s === 'pending' ? copy.status_pending
        : copy.status_not_started;
  const achLabel = (s: AchStatus) =>
    s === 'enrolled' ? copy.status_enrolled
      : s === 'pending' ? copy.status_pending
        : copy.status_not_started;

  return (
    <div className="space-y-6">
      <Step
        title={copy.step1_title}
        body={copy.step1_body}
        linkLabel={copy.step1_link_label}
        linkUrl={copy.step1_link_url}
        status={aceLabel(state.ace_portal_account_status)}
        active={state.ace_portal_account_status === 'active'}
      >
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          {(['not_started', 'pending', 'active'] as AceStatus[]).map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => save({ ace_portal_account_status: s })}
              className={`rounded-md border px-3 py-1.5 ${
                state.ace_portal_account_status === s
                  ? 'border-amber-300/60 bg-amber-300/10 text-amber-200'
                  : 'border-white/15 text-white/65 hover:border-amber-300/40'
              }`}
            >
              {aceLabel(s)}
            </button>
          ))}
        </div>
      </Step>

      <Step
        title={copy.step2_title}
        body={copy.step2_body}
        status={achLabel(state.ach_enrollment_status)}
        active={state.ach_enrollment_status === 'enrolled'}
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Last4
            label={copy.bank_routing_label}
            value={routingDraft}
            onChange={setRoutingDraft}
          />
          <Last4
            label={copy.bank_account_label}
            value={accountDraft}
            onChange={setAccountDraft}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          {(['not_started', 'pending', 'enrolled'] as AchStatus[]).map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() =>
                save({
                  ach_enrollment_status: s,
                  ...(routingDraft.length === 4 ? { bank_routing_last4: routingDraft } : {}),
                  ...(accountDraft.length === 4 ? { bank_account_last4: accountDraft } : {}),
                })
              }
              className={`rounded-md border px-3 py-1.5 ${
                state.ach_enrollment_status === s
                  ? 'border-amber-300/60 bg-amber-300/10 text-amber-200'
                  : 'border-white/15 text-white/65 hover:border-amber-300/40'
              }`}
            >
              {achLabel(s)}
            </button>
          ))}
        </div>
      </Step>

      <Step
        title={copy.step3_title}
        body={copy.step3_body}
        status={copy.status_not_started}
        optional
      />

      <Step
        title={copy.step4_title}
        body={copy.step4_body}
        linkLabel={copy.step4_link_label}
        linkUrl={copy.step4_link_url}
        status={copy.status_not_started}
      />

      {busy && <div className="text-[12.5px] text-white/55">{copy.saving}</div>}
      {saved && !busy && <div className="text-[12.5px] text-amber-200">{copy.saved}</div>}
    </div>
  );
}

function Step({
  title, body, linkLabel, linkUrl, status, active, optional, children,
}: {
  title: string;
  body: string;
  linkLabel?: string;
  linkUrl?: string;
  status: string;
  active?: boolean;
  optional?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="font-serif text-[18px] text-white">{title}</div>
        <span
          className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${
            active ? 'text-amber-300' : 'text-white/45'
          }`}
        >
          {optional ? 'Optional' : status}
        </span>
      </div>
      <p className="mt-2 text-[14.5px] leading-[1.65] text-white/65">{body}</p>
      {linkLabel && linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-[13px] text-amber-300 hover:text-amber-200"
        >
          {linkLabel}
        </a>
      )}
      {children}
    </div>
  );
}

function Last4({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[12.5px] text-white/60">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="mt-1 w-full rounded-md border border-white/15 bg-[#0a1020] px-3 py-2 font-mono text-[14px] text-white outline-none focus:border-amber-300/60"
        placeholder="0000"
      />
    </label>
  );
}
