import Link from 'next/link';
import { B2BNav } from '@/components/B2BNav';

export const metadata = {
  title: 'Pricing — Cruzar B2B',
  description:
    'Cruzar B2B pricing — Insights subscriptions for dispatchers + platform fee for refund recovery. No retainer, no monthly minimum on refunds.',
  alternates: { canonical: 'https://www.cruzar.app/pricing/business' },
};

export default async function BusinessPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {lang === 'es' ? 'Precios — Cruzar B2B' : 'Pricing — Cruzar B2B'}
          </div>
          <h1 className="mt-3 font-serif text-[clamp(2rem,4.2vw,3.4rem)] font-medium text-foreground leading-tight">
            {lang === 'es'
              ? 'Dos modelos. Pagas por valor confirmado.'
              : 'Two pricing models. You pay only on confirmed value.'}
          </h1>
          <p className="mt-5 max-w-3xl text-[16px] text-foreground/75">
            {lang === 'es'
              ? 'Cruzar Insights es por suscripción para dispatchers + brokers que quieren monitor en vivo + alertas + briefings. Cruzar Refunds es tarifa-plataforma por recuperación confirmada — pagas solo cuando CBP paga el reembolso.'
              : 'Cruzar Insights is subscription-priced for dispatchers + brokers who want live monitoring + alerts + briefings. Cruzar Refunds is platform-fee priced on confirmed recovery — you pay only when CBP pays the refund.'}
          </p>
        </div>
      </section>

      {/* Insights subscription tiers */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
            {lang === 'es' ? 'Cruzar Insights · Suscripción mensual' : 'Cruzar Insights · Monthly subscription'}
          </div>
          <h2 className="mt-2 font-serif text-[24px] text-foreground">
            {lang === 'es' ? 'Monitor en vivo + alertas + briefings' : 'Live monitor + alerts + morning briefings'}
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Tier
              code="STARTER"
              price="$99"
              cadence={lang === 'es' ? '/mes' : '/mo'}
              audience={lang === 'es' ? 'Solo dispatcher · 5 puertos vigilados' : 'Solo dispatcher · 5 watched ports'}
              features={lang === 'es' ? [
                'Monitor en vivo de espera',
                'Briefing matutino diario',
                '5 puertos vigilados',
                'Alertas de anomalía (email)',
                'Acceso al substrato Cruzar Ticket',
              ] : [
                'Live wait monitor',
                'Daily morning briefing',
                '5 watched ports',
                'Anomaly alerts (email)',
                'Cruzar Ticket substrate access',
              ]}
              cta_label={lang === 'es' ? 'Empezar Starter' : 'Start Starter'}
              cta_href={`/insights${langSuffix}`}
            />
            <Tier
              code="PRO"
              price="$299"
              cadence={lang === 'es' ? '/mes' : '/mo'}
              audience={lang === 'es' ? 'Equipo broker · 15 puertos · email + SMS' : 'Broker team · 15 ports · email + SMS'}
              features={lang === 'es' ? [
                'Todo lo de Starter +',
                '15 puertos vigilados',
                'Alertas SMS + email',
                'Composición Cruzar Ticket firmado',
                'Composer drawback + UFLPA + CBAM',
                'Calibration log read-access',
              ] : [
                'Everything in Starter, plus:',
                '15 watched ports',
                'SMS + email alerts',
                'Signed Cruzar Ticket composition',
                'Drawback + UFLPA + CBAM composers',
                'Calibration log read-access',
              ]}
              cta_label={lang === 'es' ? 'Empezar Pro' : 'Start Pro'}
              cta_href={`/insights${langSuffix}`}
              featured
            />
            <Tier
              code="FLEET"
              price="$999"
              cadence={lang === 'es' ? '/mes' : '/mo'}
              audience={lang === 'es' ? 'Flota multi-usuario · todos los puertos' : 'Multi-user fleet · all ports'}
              features={lang === 'es' ? [
                'Todo lo de Pro +',
                'Hasta 10 usuarios en una cuenta',
                'Todos los puertos US-MX vigilados',
                'WhatsApp + voz alertas',
                'Multi-driver Driver Pass',
                'Calibration export API',
                'Soporte prioritario',
              ] : [
                'Everything in Pro, plus:',
                'Up to 10 users on one account',
                'All US-MX ports watched',
                'WhatsApp + voice alerts',
                'Multi-driver Driver Pass',
                'Calibration export API',
                'Priority support',
              ]}
              cta_label={lang === 'es' ? 'Hablar con ventas' : 'Talk to sales'}
              cta_href="mailto:diego@cruzar.app?subject=Cruzar%20Fleet%20plan"
            />
          </div>
        </div>
      </section>

      {/* Refunds platform fee */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
            {lang === 'es' ? 'Cruzar Refunds · Tarifa plataforma' : 'Cruzar Refunds · Platform fee'}
          </div>
          <h2 className="mt-2 font-serif text-[24px] text-foreground">
            {lang === 'es' ? 'Pagas solo cuando CBP paga el reembolso' : 'You pay only when CBP pays the refund'}
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground/70">
                {lang === 'es' ? 'IEEPA Refunds (M14)' : 'IEEPA Refunds (M14)'}
              </div>
              <div className="mt-3 font-mono text-[40px] text-accent leading-none">
                8%
              </div>
              <div className="mt-1 text-[12px] text-foreground/70">
                {lang === 'es' ? 'del reembolso procesado · piso $99' : 'of refund processed · $99 floor'}
              </div>
              <ul className="mt-5 space-y-2 text-[14px] text-foreground/85">
                <li>· {lang === 'es' ? '$0 en presentaciones rechazadas, vencidas, retiradas' : '$0 on rejected, expired, or withdrawn filings'}</li>
                <li>· {lang === 'es' ? 'Sin retainer · sin mensualidad · sin mínimo' : 'No retainer · no monthly · no minimum'}</li>
                <li>· {lang === 'es' ? 'CBP paga directo al ACH del importador. Cruzar nunca custodia el dinero.' : 'CBP pays direct to the importer\'s ACH. Cruzar never custodies refund money.'}</li>
                <li>· {lang === 'es' ? 'Tarifa fira solo cuando el reembolso confirma' : 'Fee fires only when refund confirms'}</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-background p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground/70">
                {lang === 'es' ? 'Drawback §1313 (M7)' : '§1313 Drawback (M7)'}
              </div>
              <div className="mt-3 font-mono text-[40px] text-accent leading-none">
                8%
              </div>
              <div className="mt-1 text-[12px] text-foreground/70">
                {lang === 'es' ? 'del drawback procesado · piso $99' : 'of drawback processed · $99 floor'}
              </div>
              <ul className="mt-5 space-y-2 text-[14px] text-foreground/85">
                <li>· {lang === 'es' ? '99% de aranceles + impuestos + cargos sobre import re-exportado' : '99% of duties + taxes + fees on re-exported imports'}</li>
                <li>· {lang === 'es' ? 'Ventana de 5 años' : '5-year filing window'}</li>
                <li>· {lang === 'es' ? 'Mismo modelo que IEEPA — solo dinero confirmado' : 'Same model as IEEPA — confirmed money only'}</li>
              </ul>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-[13.5px] text-foreground/75">
            {lang === 'es'
              ? 'CBAM (UE), UFLPA (US), Pedimento (MX) — los 5 módulos sin-suscripción siguen el mismo modelo: 8% del valor recuperable o protegido confirmado, $99 piso, $0 si la presentación rechaza.'
              : 'CBAM (EU), UFLPA (US), Pedimento (MX) — all 5 non-subscription modules follow the same model: 8% of recoverable or protected value confirmed, $99 floor, $0 if the filing rejects.'}
          </p>
        </div>
      </section>

      {/* Trust posture */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {lang === 'es' ? 'Postura DeWalt' : 'The DeWalt frame'}
          </div>
          <h2 className="mt-2 font-serif text-[24px] text-foreground max-w-3xl">
            {lang === 'es'
              ? 'Cruzar es software, no un agente aduanal en competencia.'
              : 'Cruzar is software, not a competing brokerage.'}
          </h2>
          <p className="mt-5 max-w-3xl text-[14.5px] leading-[1.65] text-foreground/75">
            {lang === 'es'
              ? 'No transamos negocio CBP / VUCEM / Registro UE. No tenemos licencia aduanal. Las presentaciones preparadas por Cruzar las revisa y envía el agente / declarante licenciado responsable. Es la misma postura de responsabilidad que cualquier herramienta de preparación tiene desde hace décadas.'
              : 'We do not transact CBP / VUCEM / EU Registry business. We are not a licensed customs broker. Filings prepared via Cruzar must be reviewed and submitted by the licensed customs broker / declarant of record. Same liability posture any prep tool has held for decades.'}
          </p>
        </div>
      </section>

      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-3">
          <p className="text-[12px] text-foreground/55 max-w-3xl">
            {lang === 'es'
              ? 'Cruzar Insights, Inc. · Construido en la frontera, para la frontera · Solo. Sin venture funding. Pagado por brokers + dispatchers que ven el valor.'
              : 'Cruzar Insights, Inc. · Built on the border, for the border · Solo. No venture funding. Paid for by the brokers + dispatchers who see the value.'}
          </p>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground/40">
            <Link href={`/spec/ticket-v1${langSuffix}`} className="hover:text-foreground transition">
              CRUZAR TICKET · V1 SPEC →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface TierProps {
  code: string;
  price: string;
  cadence: string;
  audience: string;
  features: string[];
  cta_label: string;
  cta_href: string;
  featured?: boolean;
}

function Tier({ code, price, cadence, audience, features, cta_label, cta_href, featured }: TierProps) {
  return (
    <div
      className={`rounded-xl border ${featured ? 'border-accent/50 bg-accent/[0.04]' : 'border-border bg-card'} p-6 flex flex-col`}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/70">
        {code}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-mono text-[40px] text-foreground leading-none">{price}</span>
        <span className="font-mono text-[14px] text-foreground/60">{cadence}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-foreground/70">{audience}</p>
      <ul className="mt-5 space-y-2 text-[13.5px] text-foreground/85 flex-1">
        {features.map((f, i) => (
          <li key={i}>· {f}</li>
        ))}
      </ul>
      <Link
        href={cta_href}
        className={`mt-6 block text-center rounded-lg px-4 py-2.5 text-[13px] font-medium transition ${
          featured
            ? 'bg-foreground text-background hover:bg-foreground/85'
            : 'border border-border text-foreground hover:border-foreground'
        }`}
      >
        {cta_label}
      </Link>
    </div>
  );
}
