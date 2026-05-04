// app/pitch/refunds-broker/page.tsx
// Printable one-pager for cold-broker outreach. The cold-email template
// references "send the one-pager" — this is the rendered URL behind that
// reference. Diego loads /pitch/refunds-broker, hits Cmd+P, saves as PDF,
// attaches to the email reply.
//
// No nav chrome (we want this to print clean), single 8.5×11 layout, the
// pitch lives entirely above the fold for screen viewing too. Print stylesheet
// strips backgrounds + uses dark-on-white for ink-friendly output.

import Link from 'next/link';
import { PrintButton } from './PrintButton';

export const metadata = {
  title: 'Cruzar — IEEPA refunds for U.S. importers',
  description:
    'Recover IEEPA tariff refunds. 8% of refund processed, $99 floor, $0 on rejected. Software, not a brokerage.',
  alternates: { canonical: 'https://www.cruzar.app/pitch/refunds-broker' },
};

export default function RefundsBrokerPitchPage() {
  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0.6in; }
          body, html { background: white !important; }
          .no-print { display: none !important; }
          .print-page {
            background: white !important;
            color: #0a1020 !important;
          }
          .print-page * {
            color: inherit !important;
          }
          .print-card {
            background: white !important;
            border-color: #cbd5e1 !important;
          }
          .print-accent {
            color: #1e40af !important;
          }
          .print-emphasis {
            color: #0a1020 !important;
            font-weight: 600;
          }
        }
      `}</style>

      <div className="dark min-h-screen bg-background text-foreground">
        {/* Print-action bar — only visible on screen */}
        <div className="no-print sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto max-w-[820px] px-5 py-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              One-pager · ready to print
            </span>
            <div className="flex items-center gap-2">
              <PrintButton />
              <Link
                href="/refunds"
                className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
              >
                Live page →
              </Link>
            </div>
          </div>
        </div>

        <main className="print-page mx-auto max-w-[820px] px-8 py-10 print:px-0 print:py-0">
          {/* HEADER */}
          <header className="border-b border-border pb-5 mb-6 print-card">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent print-accent">
                  Cruzar Insights, Inc.
                </div>
                <h1 className="mt-2 font-serif text-[28px] leading-[1.1] text-foreground print-emphasis">
                  Recover IEEPA tariff refunds.
                  <br />
                  Software for the broker, not a competing brokerage.
                </h1>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground/80 text-right">
                <div>cruzar.app</div>
                <div>diego@cruzar.app</div>
                <div>RGV · Texas</div>
              </div>
            </div>
          </header>

          {/* THE WEDGE */}
          <section className="mb-7">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 print-accent">
              The wedge
            </div>
            <p className="mt-2 text-[14px] leading-[1.55] text-foreground/90 print-emphasis">
              <em>Learning Resources v. Trump</em> (2025) struck down the IEEPA tariffs.
              <strong className="text-accent print-accent"> $156B owed</strong> across roughly{' '}
              <strong className="text-accent print-accent">330,000 U.S. importers</strong>. ~83% don&apos;t
              even have an ACE Portal account + ACH Refund Authorization set up — meaning Treasury
              <em> can&apos;t pay them</em> on a clean unliquidated entry. The broker who fixes that
              setup is the broker who collects the recurring filing volume.
            </p>
          </section>

          {/* WHAT WE DO — 4 BOXES */}
          <section className="mb-7">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 print-accent">
              How Cruzar fits
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Step n="1" title="Free eligibility scan" body="Your client (or you) drops an ACE Entry Summary CSV at /refunds/scan. Cruzar classifies CAPE-eligible vs. Form-19-required vs. past-cliff per entry. ~60 seconds. Free. No signup." />
              <Step n="2" title="Compose the filings" body="CAPE Phase 1 CSV + Form 19 protest packet for entries past the 80-day cliff. Both Ed25519-signed onto a Cruzar Ticket. You review. You file." />
              <Step n="3" title="Onboard ACE / ACH" body="The 4-step walkthrough most importers skip. Without it Treasury can't pay, period. Cruzar walks them through; you keep the relationship + collect the filing fee." />
              <Step n="4" title="Track + charge on confirmed money" body="60-day refund clock tracked. Cruzar's platform fee fires only when CBP pays the refund into your client's ACH. Never on hope." />
            </div>
          </section>

          {/* PRICING */}
          <section className="mb-7 rounded-lg border border-border bg-card p-5 print-card">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 print-accent">
              Pricing — paid only when CBP pays
            </div>
            <ul className="mt-3 space-y-1.5 text-[13.5px] text-foreground/90 print-emphasis">
              <li>· <strong>8%</strong> of refund processed through Cruzar&apos;s filing platform</li>
              <li>· <strong>$99</strong> floor on any successful refund</li>
              <li>· <strong>$0</strong> on rejected, expired, or withdrawn filings — same way payment processors don&apos;t bill declined transactions</li>
              <li className="pt-1 text-accent print-accent">· No retainer. No subscription. No monthly minimum.</li>
            </ul>
          </section>

          {/* SUBSTRATE */}
          <section className="mb-7">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 print-accent">
              The Cruzar Ticket — verifiable substrate
            </div>
            <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground print-emphasis">
              Every refund composition signs onto a Cruzar Ticket — one Ed25519-signed JSON record
              that carries every Cruzar module&apos;s output for a shipment. A regulator, partner, or
              your client&apos;s auditor can verify the signature against our published public key at
              <strong> cruzar.app/.well-known/cruzar-ticket-key.json</strong> without trusting our
              database. The full schema is public at{' '}
              <strong>cruzar.app/spec/ticket-v1</strong>. The substrate is open; the application is
              proprietary; the broker is YOU.
            </p>
          </section>

          {/* THE ASK */}
          <section className="mb-6 rounded-lg border-2 border-foreground/30 bg-foreground/[0.03] p-5 print-card">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent print-accent">
              The ask
            </div>
            <p className="mt-2 text-[14px] leading-[1.55] text-foreground print-emphasis">
              <strong>Run a free scan against ONE of your client portfolios.</strong> No signup.
              ~60 seconds. Drop the ACE Entry Summary CSV at{' '}
              <strong className="text-accent print-accent">cruzar.app/refunds/scan</strong> and see
              what&apos;s recoverable. If the numbers look real, we talk about a referral arrangement
              that pays your shop on every confirmed refund without you taking on prep work.
            </p>
          </section>

          {/* FOOTER */}
          <footer className="border-t border-border pt-4 mt-6">
            <div className="grid grid-cols-2 gap-4 text-[11px] text-muted-foreground/80 print-emphasis">
              <div>
                <div className="font-mono uppercase tracking-[0.16em] text-muted-foreground/60 mb-1">
                  Founder
                </div>
                <div>Diego Aguirre — solo</div>
                <div>RGV-based · diego@cruzar.app</div>
              </div>
              <div>
                <div className="font-mono uppercase tracking-[0.16em] text-muted-foreground/60 mb-1">
                  Disclaimer
                </div>
                <div className="text-[10.5px] leading-[1.45]">
                  Cruzar is software for preparing CBP refund documentation. Cruzar is not a
                  licensed customs broker; filings prepared via Cruzar must be reviewed and
                  submitted by the licensed customs broker of record. Refunds are paid by CBP
                  directly to the importer&apos;s ACH; Cruzar never custodies refund money.
                </div>
              </div>
            </div>
            <div className="mt-4 text-center font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/50">
              Cruzar Ticket · v1 · Built on the border, for the border
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 print-card">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-mono text-[11px] text-accent print-accent">{n}.</span>
        <span className="font-serif text-[14px] text-foreground print-emphasis leading-[1.2]">
          {title}
        </span>
      </div>
      <p className="text-[12px] leading-[1.5] text-muted-foreground print-emphasis">{body}</p>
    </div>
  );
}
