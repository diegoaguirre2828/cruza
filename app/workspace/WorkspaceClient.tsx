'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { WORKSPACE_EN } from '@/lib/copy/workspace-en';

type Copy = typeof WORKSPACE_EN;

interface ModuleSummary {
  refunds: {
    open_claims: number;
    pending_principal_usd: number;
    pending_interest_usd: number;
    refund_received_count: number;
    total_received_usd: number;
  };
  eudamed: {
    actors_registered: number;
    actors_submission_ready: number;
    udi_records_total: number;
    udi_records_ready: number;
  };
  paperwork: { extractions_last_30d: number; blocking_issues: number };
  drivers: { compliance_runs_last_30d: number; flagged: number };
  customs: { validations_last_30d: number };
  regulatory: { submissions_last_30d: number };
  tickets: { issued_total: number; issued_last_30d: number };
  insights: { subscription_tier: string | null; watched_ports: number };
}

interface ActivityItem {
  module: string;
  label: string;
  detail: string;
  ts: string;
  href?: string;
}

interface SummaryResponse {
  summary: ModuleSummary;
  activity_recent: ActivityItem[];
}

const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Static class lookup so Tailwind JIT keeps these classes in the bundle.
// Dynamic class strings (e.g. `border-${accent}-300/15`) get purged in prod.
const accentClasses = {
  amber: {
    border: 'border-amber-300/15 hover:border-amber-300/40',
    bg: 'bg-amber-300/[0.02]',
    text: 'text-amber-200',
    link: 'text-amber-300 hover:text-amber-200',
  },
  sky: {
    border: 'border-sky-400/15 hover:border-sky-400/40',
    bg: 'bg-sky-400/[0.02]',
    text: 'text-sky-200',
    link: 'text-sky-300 hover:text-sky-200',
  },
  violet: {
    border: 'border-violet-400/15 hover:border-violet-400/40',
    bg: 'bg-violet-400/[0.02]',
    text: 'text-violet-200',
    link: 'text-violet-300 hover:text-violet-200',
  },
  emerald: {
    border: 'border-emerald-400/15 hover:border-emerald-400/40',
    bg: 'bg-emerald-400/[0.02]',
    text: 'text-emerald-200',
    link: 'text-emerald-300 hover:text-emerald-200',
  },
  rose: {
    border: 'border-rose-400/15 hover:border-rose-400/40',
    bg: 'bg-rose-400/[0.02]',
    text: 'text-rose-200',
    link: 'text-rose-300 hover:text-rose-200',
  },
  orange: {
    border: 'border-orange-400/15 hover:border-orange-400/40',
    bg: 'bg-orange-400/[0.02]',
    text: 'text-orange-200',
    link: 'text-orange-300 hover:text-orange-200',
  },
} as const;

type AccentKey = keyof typeof accentClasses;

const moduleAccent: Record<string, AccentKey> = {
  refunds: 'amber',
  eudamed: 'sky',
  paperwork: 'violet',
  drivers: 'emerald',
  customs: 'rose',
  regulatory: 'orange',
  tickets: 'amber',
  insights: 'sky',
};

export function WorkspaceClient({ lang, copy }: { lang: 'en' | 'es'; copy: Copy }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  useEffect(() => {
    fetch('/api/workspace/summary')
      .then(async (r) => {
        if (r.status === 401) {
          setError('unauthorized');
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (j) setData(j as SummaryResponse);
      })
      .catch(() => setError('error'));
  }, []);

  if (error === 'unauthorized') {
    return (
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <p className="text-[14px] text-white/65">
            Sign in to see your workspace.{' '}
            <Link href={`/login${langSuffix}`} className="text-amber-300 hover:text-amber-200">
              Log in
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
            {copy.quick_actions.eyebrow}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/refunds/scan${langSuffix}`}
              className="rounded-lg border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-300/20"
            >
              {copy.quick_actions.new_refund_scan}
            </Link>
            <Link
              href={`/eudamed/scan${langSuffix}`}
              className="rounded-lg border border-sky-400/60 bg-sky-400/10 px-4 py-2 text-sm text-sky-300 hover:bg-sky-400/20"
            >
              {copy.quick_actions.new_eudamed_scan}
            </Link>
            <Link
              href={`/dispatch${langSuffix}`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/85 hover:border-amber-300/60 hover:text-amber-300"
            >
              {copy.quick_actions.open_dispatch}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
            {copy.modules.eyebrow}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              accent={moduleAccent.refunds}
              title={copy.modules.refunds.title}
              sub={copy.modules.refunds.sub}
              stats={[
                { label: copy.modules.refunds.stat_open_claims, value: data?.summary.refunds.open_claims ?? '…', emphasis: true },
                { label: copy.modules.refunds.stat_pending, value: data ? fmtUsd(data.summary.refunds.pending_principal_usd + data.summary.refunds.pending_interest_usd) : '…' },
                { label: copy.modules.refunds.stat_received, value: data?.summary.refunds.refund_received_count ?? '…' },
              ]}
              link={{ href: `/refunds/claims${langSuffix}`, label: copy.modules.refunds.open_link }}
            />
            <ModuleCard
              accent={moduleAccent.eudamed}
              title={copy.modules.eudamed.title}
              sub={copy.modules.eudamed.sub}
              stats={[
                { label: copy.modules.eudamed.stat_actors, value: data?.summary.eudamed.actors_registered ?? '…' },
                { label: copy.modules.eudamed.stat_udi, value: data ? `${data.summary.eudamed.udi_records_ready}/${data.summary.eudamed.udi_records_total}` : '…', emphasis: true },
              ]}
              link={{ href: `/eudamed${langSuffix}`, label: copy.modules.eudamed.open_link }}
            />
            <ModuleCard
              accent={moduleAccent.paperwork}
              title={copy.modules.paperwork.title}
              sub={copy.modules.paperwork.sub}
              stats={[
                { label: copy.modules.paperwork.stat_extractions, value: data?.summary.paperwork.extractions_last_30d ?? '…', emphasis: true },
                { label: copy.modules.paperwork.stat_blocking, value: data?.summary.paperwork.blocking_issues ?? '…' },
              ]}
              link={{ href: `/paperwork${langSuffix}`, label: copy.modules.paperwork.open_link }}
            />
            <ModuleCard
              accent={moduleAccent.drivers}
              title={copy.modules.drivers.title}
              sub={copy.modules.drivers.sub}
              stats={[
                { label: copy.modules.drivers.stat_runs, value: data?.summary.drivers.compliance_runs_last_30d ?? '…', emphasis: true },
                { label: copy.modules.drivers.stat_flagged, value: data?.summary.drivers.flagged ?? '…' },
              ]}
              link={{ href: `/insights/drivers${langSuffix}`, label: copy.modules.drivers.open_link }}
            />
            <ModuleCard
              accent={moduleAccent.customs}
              title={copy.modules.customs.title}
              sub={copy.modules.customs.sub}
              stats={[
                { label: copy.modules.customs.stat_validations, value: data?.summary.customs.validations_last_30d ?? '…', emphasis: true },
              ]}
              link={{ href: `/insights/customs${langSuffix}`, label: copy.modules.customs.open_link }}
            />
            <ModuleCard
              accent={moduleAccent.regulatory}
              title={copy.modules.regulatory.title}
              sub={copy.modules.regulatory.sub}
              stats={[
                { label: copy.modules.regulatory.stat_submissions, value: data?.summary.regulatory.submissions_last_30d ?? '…', emphasis: true },
              ]}
              link={{ href: `/regulatory${langSuffix}`, label: copy.modules.regulatory.open_link }}
            />
            <ModuleCard
              accent={moduleAccent.insights}
              title={copy.modules.insights.title}
              sub={copy.modules.insights.sub}
              stats={
                data?.summary.insights.subscription_tier
                  ? [
                      { label: copy.modules.insights.stat_tier, value: data.summary.insights.subscription_tier, emphasis: true },
                      { label: copy.modules.insights.stat_watched, value: data.summary.insights.watched_ports },
                    ]
                  : [
                      { label: '', value: copy.modules.insights.stat_no_subscription },
                    ]
              }
              link={
                data?.summary.insights.subscription_tier
                  ? { href: `/dispatch${langSuffix}`, label: copy.modules.insights.open_link }
                  : { href: `/insights${langSuffix}`, label: copy.modules.insights.sales_link }
              }
            />
            <ModuleCard
              accent={moduleAccent.tickets}
              title={copy.modules.tickets.title}
              sub={copy.modules.tickets.sub}
              stats={[
                { label: copy.modules.tickets.stat_total, value: data?.summary.tickets.issued_total ?? '…', emphasis: true },
                { label: copy.modules.tickets.stat_recent, value: data?.summary.tickets.issued_last_30d ?? '…' },
              ]}
              link={null}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
            {copy.activity.eyebrow}
          </div>
          {data && data.activity_recent.length === 0 && (
            <p className="mt-4 text-[13.5px] text-white/55">{copy.activity.empty}</p>
          )}
          {data && data.activity_recent.length > 0 && (
            <ul className="mt-4 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] bg-white/[0.02]">
              {data.activity_recent.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-[13.5px]">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                      {item.module}
                    </div>
                    <div className="mt-1 text-white/85 truncate">{item.label}</div>
                    {item.detail && <div className="mt-0.5 text-[12px] text-white/55 truncate">{item.detail}</div>}
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] text-white/45">
                    <span className="font-mono">{new Date(item.ts).toLocaleString()}</span>
                    {item.href && (
                      <Link href={item.href + langSuffix} className="rounded-md border border-white/15 px-2 py-1 text-white/65 hover:border-amber-300/50 hover:text-amber-300">
                        →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function ModuleCard({
  accent, title, sub, stats, link,
}: {
  accent: AccentKey;
  title: string;
  sub: string;
  stats: Array<{ label: string; value: string | number; emphasis?: boolean }>;
  link: { href: string; label: string } | null;
}) {
  const cls = accentClasses[accent];
  return (
    <div
      className={`rounded-xl border ${cls.border} ${cls.bg} p-5 transition`}
    >
      <div className="font-serif text-[16.5px] text-white">{title}</div>
      <p className="mt-1 text-[12.5px] leading-[1.55] text-white/55">{sub}</p>
      <div className="mt-4 space-y-1">
        {stats.map((s, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span className="text-[11.5px] uppercase tracking-[0.14em] text-white/45">{s.label}</span>
            <span
              className={
                s.emphasis
                  ? `font-mono text-[18px] ${cls.text}`
                  : 'font-mono text-[13.5px] text-white/85'
              }
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
      {link && (
        <Link
          href={link.href}
          className={`mt-4 inline-block text-[12.5px] ${cls.link}`}
        >
          {link.label} →
        </Link>
      )}
    </div>
  );
}
