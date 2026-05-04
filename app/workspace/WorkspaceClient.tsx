'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { WORKSPACE_EN } from '@/lib/copy/workspace-en';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ModuleCard, type ModuleCardStat } from '@/components/ui/ModuleCard';

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

export function WorkspaceClient({ lang, copy }: { lang: 'en' | 'es'; copy: Copy }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  useEffect(() => {
    fetch('/api/workspace/summary')
      .then(async (r) => {
        if (r.status === 401) { setError('unauthorized'); return null; }
        return r.ok ? r.json() : null;
      })
      .then((j) => { if (j) setData(j as SummaryResponse); })
      .catch(() => setError('error'));
  }, []);

  if (error === 'unauthorized') {
    return (
      <section className="border-b border-white/[0.07] relative">
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

  // Module → ModuleCard prop builders. Order is intentional: revenue + active first.
  const refundStats: ModuleCardStat[] = data ? [
    { label: copy.modules.refunds.stat_open_claims, value: data.summary.refunds.open_claims, emphasis: true },
    { label: copy.modules.refunds.stat_pending, value: fmtUsd(data.summary.refunds.pending_principal_usd + data.summary.refunds.pending_interest_usd) },
    { label: copy.modules.refunds.stat_received, value: data.summary.refunds.refund_received_count },
  ] : [{ label: copy.modules.refunds.stat_open_claims, value: '…', emphasis: true }];

  const eudamedStats: ModuleCardStat[] = data ? [
    { label: copy.modules.eudamed.stat_actors, value: data.summary.eudamed.actors_registered },
    { label: copy.modules.eudamed.stat_udi, value: `${data.summary.eudamed.udi_records_ready}/${data.summary.eudamed.udi_records_total}`, emphasis: true },
  ] : [{ label: copy.modules.eudamed.stat_udi, value: '…', emphasis: true }];

  const paperworkStats: ModuleCardStat[] = data ? [
    { label: copy.modules.paperwork.stat_extractions, value: data.summary.paperwork.extractions_last_30d, emphasis: true },
    { label: copy.modules.paperwork.stat_blocking, value: data.summary.paperwork.blocking_issues },
  ] : [{ label: copy.modules.paperwork.stat_extractions, value: '…', emphasis: true }];

  const driversStats: ModuleCardStat[] = data ? [
    { label: copy.modules.drivers.stat_runs, value: data.summary.drivers.compliance_runs_last_30d, emphasis: true },
    { label: copy.modules.drivers.stat_flagged, value: data.summary.drivers.flagged },
  ] : [{ label: copy.modules.drivers.stat_runs, value: '…', emphasis: true }];

  const customsStats: ModuleCardStat[] = data ? [
    { label: copy.modules.customs.stat_validations, value: data.summary.customs.validations_last_30d, emphasis: true },
  ] : [{ label: copy.modules.customs.stat_validations, value: '…', emphasis: true }];

  const regulatoryStats: ModuleCardStat[] = data ? [
    { label: copy.modules.regulatory.stat_submissions, value: data.summary.regulatory.submissions_last_30d, emphasis: true },
  ] : [{ label: copy.modules.regulatory.stat_submissions, value: '…', emphasis: true }];

  const insightsStats: ModuleCardStat[] = data?.summary.insights.subscription_tier
    ? [
        { label: copy.modules.insights.stat_tier, value: data.summary.insights.subscription_tier, emphasis: true },
        { label: copy.modules.insights.stat_watched, value: data.summary.insights.watched_ports },
      ]
    : [{ label: '', value: copy.modules.insights.stat_no_subscription }];

  const ticketsStats: ModuleCardStat[] = data ? [
    { label: copy.modules.tickets.stat_total, value: data.summary.tickets.issued_total, emphasis: true },
    { label: copy.modules.tickets.stat_recent, value: data.summary.tickets.issued_last_30d },
  ] : [{ label: copy.modules.tickets.stat_total, value: '…', emphasis: true }];

  return (
    <>
      <section className="border-b border-white/[0.07] bg-[#070b18]/30">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8">
          <Eyebrow tone="amber">{copy.quick_actions.eyebrow}</Eyebrow>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/refunds/scan${langSuffix}`}
              className="rounded-md border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-[13px] font-mono uppercase tracking-[0.14em] text-amber-200 hover:bg-amber-300/20 transition"
            >
              {copy.quick_actions.new_refund_scan}
            </Link>
            <Link
              href={`/eudamed/scan${langSuffix}`}
              className="rounded-md border border-[#1d3557]/60 bg-[#1d3557]/15 px-4 py-2 text-[13px] font-mono uppercase tracking-[0.14em] text-[#7eaad8] hover:bg-[#1d3557]/30 transition"
            >
              {copy.quick_actions.new_eudamed_scan}
            </Link>
            <Link
              href={`/dispatch${langSuffix}`}
              className="rounded-md border border-white/15 px-4 py-2 text-[13px] font-mono uppercase tracking-[0.14em] text-white/75 hover:border-amber-300/60 hover:text-amber-300 transition"
            >
              {copy.quick_actions.open_dispatch}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.07] relative">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <Eyebrow tone="clay">{copy.modules.eyebrow}</Eyebrow>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              accent="amber"
              code="MOD · 14"
              title={copy.modules.refunds.title}
              sub={copy.modules.refunds.sub}
              stats={refundStats}
              link={{ href: `/refunds/claims${langSuffix}`, label: copy.modules.refunds.open_link }}
            />
            <ModuleCard
              accent="cobalt"
              code="MOD · EU MDR"
              title={copy.modules.eudamed.title}
              sub={copy.modules.eudamed.sub}
              stats={eudamedStats}
              link={{ href: `/eudamed${langSuffix}`, label: copy.modules.eudamed.open_link }}
            />
            <ModuleCard
              accent="violet"
              code="MOD · 04"
              title={copy.modules.paperwork.title}
              sub={copy.modules.paperwork.sub}
              stats={paperworkStats}
              link={{ href: `/paperwork${langSuffix}`, label: copy.modules.paperwork.open_link }}
            />
            <ModuleCard
              accent="sage"
              code="MOD · 05"
              title={copy.modules.drivers.title}
              sub={copy.modules.drivers.sub}
              stats={driversStats}
              link={{ href: `/insights/drivers${langSuffix}`, label: copy.modules.drivers.open_link }}
            />
            <ModuleCard
              accent="rose"
              code="MOD · 02"
              title={copy.modules.customs.title}
              sub={copy.modules.customs.sub}
              stats={customsStats}
              link={{ href: `/insights/customs${langSuffix}`, label: copy.modules.customs.open_link }}
            />
            <ModuleCard
              accent="clay"
              code="MOD · 03"
              title={copy.modules.regulatory.title}
              sub={copy.modules.regulatory.sub}
              stats={regulatoryStats}
              link={{ href: `/regulatory${langSuffix}`, label: copy.modules.regulatory.open_link }}
            />
            <ModuleCard
              accent="cobalt"
              code="LIVE · WAIT"
              title={copy.modules.insights.title}
              sub={copy.modules.insights.sub}
              stats={insightsStats}
              link={
                data?.summary.insights.subscription_tier
                  ? { href: `/dispatch${langSuffix}`, label: copy.modules.insights.open_link }
                  : { href: `/insights${langSuffix}`, label: copy.modules.insights.sales_link }
              }
            />
            <ModuleCard
              accent="amber"
              code="SUBSTRATE"
              title={copy.modules.tickets.title}
              sub={copy.modules.tickets.sub}
              stats={ticketsStats}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <Eyebrow tone="amber">{copy.activity.eyebrow}</Eyebrow>
          {data && data.activity_recent.length === 0 && (
            <p className="mt-4 text-[13.5px] text-white/55">{copy.activity.empty}</p>
          )}
          {data && data.activity_recent.length > 0 && (
            <ul className="mt-4 divide-y divide-white/[0.05] rounded-md border border-white/[0.07] bg-white/[0.015] overflow-hidden">
              {data.activity_recent.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-[13.5px] hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/40">
                      {item.module}
                    </div>
                    <div className="mt-1 text-white/85 truncate">{item.label}</div>
                    {item.detail && (
                      <div className="mt-0.5 font-mono text-[11px] text-white/50 truncate">{item.detail}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10.5px] font-mono tabular-nums text-white/40">
                    <span>{new Date(item.ts).toLocaleString()}</span>
                    {item.href && (
                      <Link
                        href={item.href + langSuffix}
                        className="rounded border border-white/15 px-2 py-1 text-white/60 hover:border-amber-300/50 hover:text-amber-300 transition"
                      >
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
