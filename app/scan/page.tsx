import { B2BNav } from '@/components/B2BNav';
import { ScanClient } from './ScanClient';

export const metadata = {
  title: 'Universal scan — Cruzar',
  description:
    'One ShipmentBundle. Every Cruzar module that applies fires in parallel. See refunds + drawback + UFLPA + CBAM + pedimento + driver-pass compose onto a single substrate. The "we are the connection" surface, made operational.',
  alternates: { canonical: 'https://www.cruzar.app/scan' },
};

const SAMPLE_BUNDLE = {
  bundle_id: 'SAMPLE-001',
  importer: { legal_name: 'Acme Industries Inc.', ein: '12-3456789', cbp_filer_code: 'ACM', language: 'en' },
  entries: [
    {
      entry_number: '12345678901234',
      entry_date: '2025-03-15',
      liquidation_date: null,
      liquidation_status: 'unliquidated',
      country_of_origin: 'CN',
      htsus_codes: ['8536.41.0050', '9903.01.25'],
      duty_lines: [
        { htsus_code: '8536.41.0050', rate_pct: 5.0, amount_usd: 5000, is_chapter_99: false },
        { htsus_code: '9903.01.25', rate_pct: 25.0, amount_usd: 25000, is_chapter_99: true },
      ],
      total_duty_paid_usd: 30000,
      total_taxes_paid_usd: 0,
      total_fees_paid_usd: 750,
      total_dutiable_value_usd: 200000,
      merchandise_description: 'Industrial relays',
      unit_count: 1000,
    },
  ],
  exports: [
    {
      export_id: 'AES-EXP-2025-001',
      export_date: '2025-09-01',
      destination_country: 'DE',
      htsus_or_schedule_b: '8536.41.0050',
      description: 'Relays integrated into final assemblies',
      unit_count: 1000,
      manufacturing_evidence: 'bill_of_materials',
    },
  ],
};

export default async function UniversalScanPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Universal scan · Every module · One substrate
          </div>
          <h1 className="font-serif text-[clamp(2rem,4.2vw,3.4rem)] font-medium text-foreground mt-3 leading-tight">
            One bundle. Every applicable module fires. One signed Ticket.
          </h1>
          <p className="mt-5 max-w-3xl text-[16px] leading-[1.65] text-muted-foreground">
            The 12 Cruzar modules don't sit in silos. Drop a ShipmentBundle (importer + entries + exports +
            supply chain + driver + CBAM goods — fill in what you have) and the orchestrator runs every
            composer that has enough data. Cross-references surface — which entries fired in which modules,
            total recoverable, total at-risk. The substrate composing operationally instead of just on
            paper.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-[12.5px] font-mono">
            <a href="/spec/ticket-v1" className="border border-border px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground transition">
              cruzar ticket spec →
            </a>
            <a href="/api/ticket/sample" className="border border-border px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground transition">
              signed sample →
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <ScanClient lang={lang} sampleBundle={SAMPLE_BUNDLE} />
        </div>
      </section>

      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-foreground/45">
            Cruzar is software for preparing cross-border customs and regulatory documentation. Cruzar
            does not transact CBP / VUCEM / EU Registry business and is not a licensed customs broker.
            Filings prepared via Cruzar must be reviewed and submitted by the licensed customs broker
            of record or the responsible regulated party.
          </p>
          <div className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-foreground/40">
            Universal scan · Cruzar Ticket v1 · Built on the border, for the border
          </div>
        </div>
      </footer>
    </div>
  );
}
