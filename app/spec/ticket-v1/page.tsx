import { B2BNav } from '@/components/B2BNav';
import Link from 'next/link';

export const metadata = {
  title: 'Cruzar Ticket v1 — public schema',
  description:
    'Public specification for the Cruzar Ticket — an Ed25519-signed JSON record that carries every Cruzar module composition for a single cross-border shipment. Schema, signing, verification, sample.',
  alternates: { canonical: 'https://www.cruzar.app/spec/ticket-v1' },
};

export default async function TicketSpecPage({
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
        <div className="mx-auto max-w-[860px] px-5 sm:px-8 py-20">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Cruzar Ticket · v1 · Public Specification
          </div>
          <h1 className="font-serif text-[clamp(2rem,4.2vw,3.4rem)] font-medium text-foreground mt-3 leading-tight">
            One signed record. Every cross-border module. Verifiable by anyone who has our public key.
          </h1>
          <p className="mt-6 text-[16.5px] leading-[1.7] text-muted-foreground">
            A Cruzar Ticket is a deterministic-canonical JSON record signed with Ed25519. Every Cruzar
            module composes a block onto the same Ticket — customs, pedimento, regulatory pre-arrival,
            paperwork, drivers, driver-pass, IEEPA refunds, §1313 drawback, EU MDR / EUDAMED, EU CBAM,
            US UFLPA. A regulator, partner, broker, or officer who receives the Ticket out-of-band can
            verify the signature against our published public key without trusting Cruzar's database.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[12.5px] font-mono">
            <a
              href="/.well-known/cruzar-ticket-key.json"
              className="border border-border px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground transition"
            >
              public key →
            </a>
            <a
              href="/api/ticket/sample"
              className="border border-border px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground transition"
            >
              signed sample →
            </a>
            <a
              href="#verify"
              className="border border-border px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground transition"
            >
              verifier endpoint →
            </a>
          </div>
        </div>
      </section>

      <Section title="What it is">
        <P>
          A Cruzar Ticket carries the result of every Cruzar module that fired on a single cross-border
          shipment, packaged into one Ed25519-signed JSON record. The signature is over the
          deterministic-canonical encoding of the payload (sorted keys, no whitespace, undefined
          values omitted). Re-canonicalize, recompute the SHA-256 content hash, and verify against
          our public key.
        </P>
        <P>
          The canonical form is what gets signed. Any byte-level change to the payload (re-formatting,
          re-ordering keys, escaping differences) breaks verification.
        </P>
      </Section>

      <Section title="Schema — top-level shape">
        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-[12px] leading-[1.55] font-mono text-foreground/90">
{`{
  "schema_version": "v1",
  "ticket_id": "cr_<YYYY>_<MM>_<DD>_<rand>",
  "issued_at": "<ISO 8601 UTC>",
  "issuer": "Cruzar Insights, Inc.",
  "modules_present": [ "customs" | "regulatory" | "paperwork" | "drivers"
                     | "refunds"  | "drawback"   | "pedimento" | "cbam"
                     | "uflpa"    | "driver_pass" ],
  "shipment": {
    "origin":      { "country": "<ISO-2>", "city"?: "<string>" },
    "destination": { "country": "<ISO-2>", "port_code"?: "<string>" },
    "importer_name"?: "<string>",
    "bol_ref"?: "<string>",
    "carrier"?: "<string>",
    "consignee"?: "<string>"
  },
  "customs"?:     <TicketCustomsBlock>,
  "regulatory"?:  <TicketRegulatoryBlock>,
  "paperwork"?:   <TicketPaperworkBlock>,
  "drivers"?:     <TicketDriversBlock>,
  "refunds"?:     <TicketRefundsBlock>,
  "drawback"?:    <TicketDrawbackBlock>,
  "pedimento"?:   <TicketPedimentoBlock>,
  "cbam"?:        <TicketCbamBlock>,
  "uflpa"?:       <TicketUflpaBlock>,
  "driver_pass"?: <TicketDriverPassBlock>,
  "audit_shield": {
    "prior_disclosure_eligible": <boolean>,
    "19_USC_1592_basis":         "<string>"
  },
  "calibration": { ... },
  "signing_key_id": "<string>",
  "verify_url":     "<https://www.cruzar.app/ticket/{ticket_id}>"
}`}
        </pre>
        <P>
          The fields under each module block (e.g.{' '}
          <code className="font-mono text-foreground">refunds.composition</code>) are fully
          documented in the TypeScript types at{' '}
          <code className="font-mono text-foreground">lib/chassis/&lt;module&gt;/types.ts</code> in
          the Cruzar source. Every module ships its own{' '}
          <code className="font-mono text-foreground">registry_version</code> string inside its block
          so a regulator reading the Ticket years later can know exactly which schema and reference
          tables produced it.
        </P>
      </Section>

      <Section title="Module blocks">
        <p className="text-[15px] text-muted-foreground">
          A Ticket carries one block per Cruzar module that fired on the shipment. The
          {' '}<code className="font-mono text-foreground">modules_present</code> array tells you
          which blocks to expect.
        </p>
        <ul className="mt-5 space-y-3 text-[14px]">
          <ModuleEntry name="customs" body="HS classification + USMCA origin + RVC + LIGIE flag — composes US-side declaration." />
          <ModuleEntry name="pedimento" body="Anexo 22 clave + RFC + patente + aduana + DTA / IVA / IEPS — Mexican-side declaration." />
          <ModuleEntry name="regulatory" body="FDA Prior Notice + USDA APHIS + ISF 10+2 + CBP 7501 — pre-arrival multi-agency manifest." />
          <ModuleEntry name="paperwork" body="Multi-page document classification + Mexican health-cert validation + extraction." />
          <ModuleEntry name="drivers" body="USMCA Annex 31-A + IMSS + HOS dual-regime + DOT 49 CFR Part 40 + Borello drayage — operator-level driver compliance." />
          <ModuleEntry name="driver_pass" body="Per-trip driver readiness — CDL + DOT medical + TWIC + FAST + FMM + HAZMAT expiry." />
          <ModuleEntry name="refunds" body="IEEPA tariff refund composition — CAPE Phase 1 CSV + Form 19 protest packet + 80-day cliff routing + interest." />
          <ModuleEntry name="drawback" body="US §1313 duty drawback — 99% refund on imports that get exported / re-exported / rejected, 5yr window." />
          <ModuleEntry name="cbam" body="EU Carbon Border Adjustment — embedded emissions calc + cert cost at ETS reference price." />
          <ModuleEntry name="uflpa" body="Forced-labor risk evaluation — Xinjiang detection + UFLPA Entity List match + rebuttable-presumption logic." />
          <ModuleEntry name="eudamed" body="EU MDR EUDAMED — actor + UDI/Device readiness for May 28, 2026 deadline." />
        </ul>
      </Section>

      <Section title="Signing — Ed25519 over deterministic-canonical JSON">
        <ol className="list-decimal list-inside space-y-2 text-[14.5px] text-muted-foreground">
          <li>Build the payload object.</li>
          <li>Canonicalize: sort keys, no whitespace, omit{' '}
            <code className="font-mono text-foreground">undefined</code> values, JSON.stringify scalars.</li>
          <li>SHA-256 the canonical UTF-8 bytes — that's the{' '}
            <code className="font-mono text-foreground">content_hash</code>.</li>
          <li>Ed25519-sign the SHA-256 digest with our private key — that's{' '}
            <code className="font-mono text-foreground">signature_b64</code>.</li>
          <li>Bundle everything: payload, payload_canonical, content_hash, signature_b64, signing_key_id.</li>
        </ol>
        <P>
          The canonicalization algorithm is implemented in{' '}
          <code className="font-mono text-foreground">lib/ticket/json-signer.ts</code>{' '}
          in our source. Any compatible JSON-canonicalization implementation that produces the same
          bytes will verify.
        </P>
      </Section>

      <Section title="Verifying — three paths" id="verify">
        <h3 className="font-serif text-[18px] text-foreground">1 · By ticket ID (lookup our DB)</h3>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-4 text-[12px] font-mono text-foreground/90">
{`curl https://www.cruzar.app/api/ticket/verify?id=<ticket_id>`}
        </pre>
        <p className="mt-3 text-[14px] text-muted-foreground">
          We return the signed Ticket from our database plus our server-side verification result.
          Use this when you have the ticket ID and trust Cruzar's database lookup.
        </p>

        <h3 className="mt-8 font-serif text-[18px] text-foreground">2 · By payload (no DB trust)</h3>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-4 text-[12px] font-mono text-foreground/90">
{`curl -X POST https://www.cruzar.app/api/ticket/verify-payload \\
  -H 'content-type: application/json' \\
  -d '<signed_ticket_json>'`}
        </pre>
        <p className="mt-3 text-[14px] text-muted-foreground">
          POST a SignedTicket payload you got out-of-band (from a PDF / email / portal). We
          re-canonicalize, recompute the content hash, fetch the public key, and verify. Same
          trust model as PGP — verify against the published public key.
        </p>

        <h3 className="mt-8 font-serif text-[18px] text-foreground">3 · Locally (full self-custody)</h3>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-4 text-[12px] font-mono text-foreground/90">
{`# 1. Get our public key
curl https://www.cruzar.app/.well-known/cruzar-ticket-key.json

# 2. Get a real signed sample to test against
curl https://www.cruzar.app/api/ticket/sample

# 3. Verify locally with any Ed25519 library:
#    a. canonicalize signed.payload (sorted keys, no whitespace,
#       skip undefined)
#    b. SHA-256 the canonical bytes -> must match content_hash
#    c. Ed25519.verify(signature_b64, content_hash, public_key_b64)`}
        </pre>
      </Section>

      <Section title="Trust model">
        <ul className="space-y-2 text-[14.5px] text-muted-foreground list-disc list-inside">
          <li>Cruzar issues + signs Tickets. Holders carry them. Anyone verifies them.</li>
          <li>The published public key at{' '}
            <a className="text-foreground hover:text-accent underline underline-offset-2" href="/.well-known/cruzar-ticket-key.json">
              /.well-known/cruzar-ticket-key.json
            </a>{' '}
            is the root of trust. Pin it. Audit it. Mirror it.</li>
          <li>If we rotate keys, the old key continues to verify historic Tickets;{' '}
            <code className="font-mono text-foreground">signing_key_id</code> tells you which key
            signed which Ticket.</li>
          <li>Cruzar is software for preparing customs / regulatory / refund documentation. We do
            not transact CBP / VUCEM / EU Registry business. Filings prepared via Cruzar are reviewed
            and submitted by the licensed broker / declarant of record.</li>
        </ul>
      </Section>

      <Section title="Versioning">
        <P>
          This document specifies <code className="font-mono text-foreground">cruzar-ticket-v1</code>.
          Future schema changes either:
        </P>
        <ul className="mt-3 space-y-2 text-[14.5px] text-muted-foreground list-disc list-inside">
          <li>Add new optional module blocks (forward-compatible — old verifiers ignore unknown blocks).</li>
          <li>Add new optional fields to existing blocks (forward-compatible).</li>
          <li>Bump <code className="font-mono text-foreground">schema_version</code> to{' '}
            <code className="font-mono text-foreground">v2</code> for any breaking change. v1 verifiers
            will reject v2 payloads on the schema_version field.</li>
        </ul>
      </Section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-[860px] px-5 sm:px-8 py-12">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            See it in action
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/workspace"
              className="rounded-xl border border-border bg-card p-5 hover:border-foreground transition"
            >
              <div className="font-serif text-[16px] text-foreground">Workspace</div>
              <p className="mt-2 text-[13.5px] text-muted-foreground">
                The 12 modules that compose onto the Ticket.
              </p>
            </Link>
            <Link
              href="/api/ticket/sample"
              className="rounded-xl border border-border bg-card p-5 hover:border-foreground transition"
            >
              <div className="font-serif text-[16px] text-foreground">Signed sample</div>
              <p className="mt-2 text-[13.5px] text-muted-foreground">
                A real signed Ticket with sample payload — verify against the public key.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-foreground/45">
            Cruzar is software for preparing cross-border customs and regulatory documentation.
            Cruzar does not transact CBP / VUCEM / EU Registry business and is not a licensed
            customs broker. Filings prepared via Cruzar must be reviewed and submitted by the
            licensed customs broker of record or the responsible regulated party.
          </p>
          <div className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-foreground/40">
            Cruzar Ticket · v1 · Built on the border, for the border
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-b border-border">
      <div className="mx-auto max-w-[860px] px-5 sm:px-8 py-14">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </div>
        <div className="mt-5 space-y-4">{children}</div>
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.7] text-muted-foreground">{children}</p>;
}

function ModuleEntry({ name, body }: { name: string; body: string }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <code className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">{name}</code>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">{body}</p>
    </li>
  );
}
