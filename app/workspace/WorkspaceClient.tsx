'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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

interface CrossModuleAggregate {
  total_tickets: number;
  multi_module_ticket_count: number;
  total_recoverable_across_tickets_usd: number;
  total_at_risk_count: number;
  top_co_occurrences: Array<{ modules: string[]; count: number }>;
  has_data: boolean;
}

interface SummaryResponse {
  summary: ModuleSummary;
  activity_recent: ActivityItem[];
  cross_module?: CrossModuleAggregate;
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
      <section className="border-b border-border relative">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <p className="text-[14px] text-muted-foreground">
            Sign in to see your workspace.{' '}
            <Link href={`/login${langSuffix}`} className="text-foreground hover:text-foreground/80 underline underline-offset-4">
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

  // Drawback stats — module just shipped, no DB-backed stats yet. Show placeholder.
  const drawbackStats: ModuleCardStat[] = [
    { label: copy.modules.drawback.stat_recoverable, value: '—', emphasis: true },
    { label: copy.modules.drawback.stat_pending, value: '—' },
  ];

  // Pedimento stats — module just shipped (M11), no DB-backed stats yet.
  const pedimentoStats: ModuleCardStat[] = [
    { label: copy.modules.pedimento.stat_pedimentos, value: '—', emphasis: true },
    { label: copy.modules.pedimento.stat_findings, value: '—' },
  ];

  // CBAM + UFLPA stats — modules just shipped (sprint 3), no DB-backed stats yet.
  const cbamStats: ModuleCardStat[] = [
    { label: copy.modules.cbam.stat_certificates, value: '—', emphasis: true },
    { label: copy.modules.cbam.stat_cost, value: '—' },
  ];
  const uflpaStats: ModuleCardStat[] = [
    { label: copy.modules.uflpa.stat_scans, value: '—', emphasis: true },
    { label: copy.modules.uflpa.stat_high_risk, value: '—' },
  ];

  // Driver pass stats — module just shipped (sprint 4)
  const driverPassStats: ModuleCardStat[] = [
    { label: copy.modules.driver_pass.stat_passes, value: '—', emphasis: true },
    { label: copy.modules.driver_pass.stat_blocked, value: '—' },
  ];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: 'easeOut' as const, delay: i * 0.06 },
  }),
};

  return (
    <>
      {/* COMMAND BAR — single full-width strip with divider segments, terminal-style */}
      <motion.section
        className="border-b border-border bg-card/30"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-stretch divide-x divide-border">
            <Link
              href={`/scan${langSuffix}`}
              className="group flex-1 flex flex-col gap-1 px-5 sm:px-7 py-5 hover:bg-foreground/[0.04] transition relative bg-foreground/[0.03]"
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-accent">
                ACTION · 00 · UNIVERSAL
              </span>
              <span className="font-serif text-[18px] text-foreground leading-tight">
                {lang === 'es' ? 'Escaneo universal — todos los módulos' : 'Universal scan — every module fires'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground transition">
                Open →
              </span>
            </Link>
            <Link
              href={`/refunds/scan${langSuffix}`}
              className="group flex-1 flex flex-col gap-1 px-5 sm:px-7 py-5 hover:bg-foreground/[0.04] transition relative"
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                ACTION · 01
              </span>
              <span className="font-serif text-[18px] text-foreground leading-tight">
                {copy.quick_actions.new_refund_scan}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground transition">
                Open →
              </span>
            </Link>
            <Link
              href={`/eudamed/scan${langSuffix}`}
              className="group flex-1 flex flex-col gap-1 px-5 sm:px-7 py-5 hover:bg-foreground/[0.04] transition"
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                ACTION · 02
              </span>
              <span className="font-serif text-[18px] text-foreground leading-tight">
                {copy.quick_actions.new_eudamed_scan}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground transition">
                Open →
              </span>
            </Link>
            <Link
              href={`/dispatch${langSuffix}`}
              className="group flex-1 flex flex-col gap-1 px-5 sm:px-7 py-5 hover:bg-foreground/[0.04] transition"
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                ACTION · 03
              </span>
              <span className="font-serif text-[18px] text-foreground leading-tight">
                {copy.quick_actions.open_dispatch}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground transition">
                Open →
              </span>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* CROSS-MODULE AGGREGATE — the substrate composing across all this user's tickets.
          This is the visible answer to "are the modules actually talking to each other?"
          When tickets exist, it shows multi-module count + total recoverable + at-risk;
          when 0 tickets exist, it shows the empty-state with a clear path to /scan. */}
      {data?.cross_module && (
        <section className="border-b border-border bg-card/20">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                Substrate · cross-module composition
              </span>
              {!data.cross_module.has_data && (
                <Link
                  href={`/scan${langSuffix}`}
                  className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
                >
                  Run a scan →
                </Link>
              )}
            </div>
            {data.cross_module.has_data ? (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <CrossStat label="Tickets composed" value={String(data.cross_module.total_tickets)} />
                  <CrossStat
                    label="Multi-module tickets"
                    value={String(data.cross_module.multi_module_ticket_count)}
                    emphasis={data.cross_module.multi_module_ticket_count > 0}
                  />
                  <CrossStat
                    label="Recoverable across modules"
                    value={fmtUsd(data.cross_module.total_recoverable_across_tickets_usd)}
                    emphasis
                  />
                  <CrossStat
                    label="At-risk (UFLPA / blocked)"
                    value={String(data.cross_module.total_at_risk_count)}
                    colorClass={data.cross_module.total_at_risk_count > 0 ? 'text-red-300' : 'text-emerald-300'}
                  />
                </div>
                {data.cross_module.top_co_occurrences.length > 0 && (
                  <div className="mt-5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      Most common compositions
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {data.cross_module.top_co_occurrences.map((co, i) => (
                        <span key={i} className="rounded-md border border-border bg-background px-2.5 py-1 text-[11.5px] font-mono">
                          {co.modules.join(' + ')}{' '}
                          <span className="text-muted-foreground/70">×{co.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-serif text-[16px] text-foreground">
                  No tickets composed yet.
                </span>
                <span className="text-[13px] text-muted-foreground">
                  Run the universal scan to compose your first multi-module Cruzar Ticket. Cross-module
                  aggregates surface here once the substrate has data.
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* MODULE GRID — three visible rows by default. The 6 secondary modules
          (compliance regimes + chassis support) live behind an expandable
          "Show all 12 modules" so the default view stays focused. */}
      <section className="border-b border-border relative">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <Eyebrow>{copy.modules.eyebrow}</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/60">
              12 MODULES · 1 SUBSTRATE
            </span>
          </div>

          {/* Row 1 — Refund recovery (the revenue lane) */}
          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div className="md:col-span-2" variants={fadeUp} custom={0}>
              <ModuleCard
                accent="primary"
                code="MOD · 14 · FEATURED"
                title={copy.modules.refunds.title}
                sub={copy.modules.refunds.sub}
                stats={refundStats}
                link={{ href: `/refunds/claims${langSuffix}`, label: copy.modules.refunds.open_link }}
              />
            </motion.div>
            <motion.div variants={fadeUp} custom={1}>
              <ModuleCard
                accent="primary"
                code="MOD · 07"
                title={copy.modules.drawback.title}
                sub={copy.modules.drawback.sub}
                stats={drawbackStats}
                link={{ href: `/drawback${langSuffix}`, label: copy.modules.drawback.open_link }}
              />
            </motion.div>
          </motion.div>

          {/* Row 2 — Customs declaration (US / MX) */}
          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div variants={fadeUp} custom={0}>
              <ModuleCard
                accent="primary"
                code="MOD · 02 · US"
                title={copy.modules.customs.title}
                sub={copy.modules.customs.sub}
                stats={customsStats}
                link={{ href: `/insights/customs${langSuffix}`, label: copy.modules.customs.open_link }}
              />
            </motion.div>
            <motion.div variants={fadeUp} custom={1}>
              <ModuleCard
                accent="primary"
                code="MOD · 11 · MX"
                title={copy.modules.pedimento.title}
                sub={copy.modules.pedimento.sub}
                stats={pedimentoStats}
                link={{ href: `/pedimento${langSuffix}`, label: copy.modules.pedimento.open_link }}
              />
            </motion.div>
          </motion.div>

          {/* Row 3 — Live + Substrate */}
          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div className="md:col-span-2" variants={fadeUp} custom={0}>
              <ModuleCard
                accent="primary"
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
            </motion.div>
            <motion.div variants={fadeUp} custom={1}>
              <ModuleCard
                accent="accent"
                code="SUBSTRATE"
                title={copy.modules.tickets.title}
                sub={copy.modules.tickets.sub}
                stats={ticketsStats}
              />
            </motion.div>
          </motion.div>

          {/* Secondary modules — collapsible to keep the default view tight */}
          <details className="group rounded-xl border border-border bg-card/30">
            <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 hover:bg-foreground/[0.03] transition">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/60">
                  Compliance regimes + chassis support
                </span>
                <span className="font-mono text-[10px] text-foreground/45">
                  6 modules
                </span>
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-foreground/70 group-open:hidden">
                Show all →
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-foreground/70 hidden group-open:inline">
                Hide
              </span>
            </summary>
            <div className="px-5 pb-5 pt-2 space-y-4">
              {/* Compliance regimes */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ModuleCard
                  accent="primary"
                  code="EU MDR"
                  title={copy.modules.eudamed.title}
                  sub={copy.modules.eudamed.sub}
                  stats={eudamedStats}
                  link={{ href: `/eudamed${langSuffix}`, label: copy.modules.eudamed.open_link }}
                />
                <ModuleCard
                  accent="primary"
                  code="EU CBAM"
                  title={copy.modules.cbam.title}
                  sub={copy.modules.cbam.sub}
                  stats={cbamStats}
                  link={{ href: `/cbam${langSuffix}`, label: copy.modules.cbam.open_link }}
                />
                <ModuleCard
                  accent="primary"
                  code="US UFLPA"
                  title={copy.modules.uflpa.title}
                  sub={copy.modules.uflpa.sub}
                  stats={uflpaStats}
                  link={{ href: `/uflpa${langSuffix}`, label: copy.modules.uflpa.open_link }}
                />
              </div>
              {/* Chassis support */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ModuleCard
                  accent="primary"
                  code="MOD · 03"
                  title={copy.modules.regulatory.title}
                  sub={copy.modules.regulatory.sub}
                  stats={regulatoryStats}
                  link={{ href: `/regulatory${langSuffix}`, label: copy.modules.regulatory.open_link }}
                />
                <ModuleCard
                  accent="primary"
                  code="MOD · 04"
                  title={copy.modules.paperwork.title}
                  sub={copy.modules.paperwork.sub}
                  stats={paperworkStats}
                  link={{ href: `/paperwork${langSuffix}`, label: copy.modules.paperwork.open_link }}
                />
                <ModuleCard
                  accent="primary"
                  code="MOD · 05 · DRIVER"
                  title={copy.modules.driver_pass.title}
                  sub={copy.modules.driver_pass.sub}
                  stats={driverPassStats}
                  link={{ href: `/driver-pass${langSuffix}`, label: copy.modules.driver_pass.open_link }}
                />
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <Eyebrow>{copy.activity.eyebrow}</Eyebrow>
          {data && data.activity_recent.length === 0 && (
            <p className="mt-4 text-[13.5px] text-muted-foreground">{copy.activity.empty}</p>
          )}
          {data && data.activity_recent.length > 0 && (
            <ul className="mt-4 divide-y divide-border border border-border bg-card overflow-hidden">
              {data.activity_recent.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-[13.5px] hover:bg-card/60">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                      {item.module}
                    </div>
                    <div className="mt-1 text-foreground/85 truncate">{item.label}</div>
                    {item.detail && (
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">{item.detail}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10.5px] font-mono tabular-nums text-muted-foreground">
                    <span>{new Date(item.ts).toLocaleString()}</span>
                    {item.href && (
                      <Link
                        href={item.href + langSuffix}
                        className="border border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground transition"
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

function CrossStat({
  label,
  value,
  emphasis = false,
  colorClass,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  colorClass?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </div>
      <div
        className={`mt-1 font-mono ${emphasis ? 'text-[20px]' : 'text-[16px]'} ${
          colorClass ?? (emphasis ? 'text-accent' : 'text-foreground/85')
        }`}
      >
        {value}
      </div>
    </div>
  );
}
