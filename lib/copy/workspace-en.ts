// lib/copy/workspace-en.ts
export const WORKSPACE_EN = {
  hero: {
    eyebrow: 'Workspace',
    title: 'Your border substrate, in one place.',
    sub: 'Every module you have access to. Live counts. Recent activity across all of them. Open one tool, all of them stay linked through the Cruzar Ticket.',
  },
  quick_actions: {
    eyebrow: 'Quick actions',
    new_refund_scan: 'Free refund scan',
    new_eudamed_scan: 'EUDAMED readiness check',
    new_ticket: 'Compose a Cruzar Ticket',
    open_dispatch: 'Open dispatch (live monitor)',
  },
  modules: {
    eyebrow: 'Modules',
    refunds: {
      title: 'IEEPA Refunds',
      sub: 'CAPE Phase 1 + Form 19 protest packets. Filed by your broker.',
      stat_open_claims: 'open claims',
      stat_pending: 'pending recoverable',
      stat_received: 'refunds received',
      open_link: 'Open refunds',
    },
    eudamed: {
      title: 'EU MDR / EUDAMED',
      sub: 'Actor + UDI/Device data feed for Reynosa medtech. Mandatory May 28, 2026.',
      stat_actors: 'actors registered',
      stat_udi: 'UDI records ready',
      open_link: 'Open EU MDR',
    },
    paperwork: {
      title: 'Paperwork scanner',
      sub: 'Doc classification, Mexican health-cert validation, multi-page extraction.',
      stat_extractions: 'extractions (30d)',
      stat_blocking: 'blocking issues',
      open_link: 'Open paperwork',
    },
    drivers: {
      title: 'Driver compliance',
      sub: 'USMCA Annex 31-A · IMSS · HOS dual-regime · DOT 49 CFR Part 40 · Borello drayage.',
      stat_runs: 'compliance runs (30d)',
      stat_flagged: 'flagged',
      open_link: 'Open driver compliance',
    },
    customs: {
      title: 'Customs validation',
      sub: 'HS classification + USMCA origin + RVC + LIGIE flag — composes into Cruzar Ticket.',
      stat_validations: 'validations (30d)',
      open_link: 'Run a customs declaration',
    },
    regulatory: {
      title: 'Regulatory pre-arrival',
      sub: 'FDA Prior Notice · USDA APHIS · ISF 10+2 · CBP 7501 · multi-page broker handoff PDF.',
      stat_submissions: 'submissions (30d)',
      open_link: 'Open regulatory',
    },
    insights: {
      title: 'Insights & dispatch',
      sub: 'Live border wait monitor + anomaly broadcast + morning briefing.',
      stat_tier: 'tier',
      stat_watched: 'watched ports',
      stat_no_subscription: 'No active subscription',
      open_link: 'Open dispatch',
      sales_link: 'View pricing',
    },
    tickets: {
      title: 'Cruzar Tickets',
      sub: 'The signed substrate every module composes into. Audit shield + Ed25519 chain of custody.',
      stat_total: 'total tickets',
      stat_recent: 'in last 30d',
      open_link: 'View tickets',
    },
  },
  activity: {
    eyebrow: 'Recent activity',
    empty: 'Nothing yet — your activity across all modules shows up here.',
  },
  shared: {
    powered_by: 'Cruzar Ticket · One substrate · Built on the border, for the border',
    legal_disclaimer: 'Cruzar is software for preparing cross-border customs and regulatory documentation. Cruzar does not transact CBP or VUCEM business and is not a licensed customs broker. Filings must be reviewed and submitted by the licensed customs broker of record or the responsible regulated party. Refunds are paid by CBP directly to the importer\'s ACH; Cruzar never custodies refund money.',
  },
};
