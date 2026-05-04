// lib/chassis/pedimento/duty-calculator.ts
// Computes Mexican import duties + DTA + IVA + IEPS on a pedimento operation.
// References: LIGIE 2020+, RGCE 2026, Decreto Estímulos Frontera Norte.
import { OperacionInput, ImpuestosCalculados } from './types';
import { getPedimentoRegistry, isFronteraNorte } from './registry';

// IEPS rates by sector — non-exhaustive shallow stub (alcohol, tobacco, sweetened drinks).
// For real production, this should be pulled from a sector-by-fraction-arancelaria table.
const IEPS_DEFAULT_RATE = 0.30;

export function calculateImpuestos(input: OperacionInput): ImpuestosCalculados {
  const reg = getPedimentoRegistry();
  const ivaRate = isFronteraNorte(input.importador_exportador.domicilio_fiscal_estado)
    ? reg.iva_frontera_rate
    : reg.iva_standard_rate;

  let totalValor = 0;
  let totalAdValorem = 0;
  let totalIeps = 0;
  for (const m of input.mercancias) {
    const valor = m.valor_dolares;
    totalValor += valor;
    const adVal = m.ad_valorem_pct ? valor * (m.ad_valorem_pct / 100) : 0;
    totalAdValorem += adVal;
    if (m.ieps_aplicable) {
      totalIeps += valor * IEPS_DEFAULT_RATE;
    }
  }

  // DTA: ~0.8% on definitive operations. Some claves (V5 IMMEX, M3 transit) have reduced rates;
  // this stub uses the standard rate. Real composer should branch by clave.
  const dta = totalValor * reg.dta_rate;

  // PRV (prevalidación) — fixed MXN amount, but we report it in USD for consistency.
  // Use placeholder MXN→USD ~17.5 (volatile; production should pull live FX).
  const prvUsd = reg.prv_fixed_mxn / 17.5;

  const baseGravable = totalValor + totalAdValorem + dta + totalIeps;
  const iva = baseGravable * ivaRate;

  const total = totalAdValorem + dta + prvUsd + iva + totalIeps;

  return {
    base_gravable_usd: round2(baseGravable),
    ad_valorem_usd: round2(totalAdValorem),
    dta_usd: round2(dta),
    prv_usd: round2(prvUsd),
    iva_usd: round2(iva),
    ieps_usd: round2(totalIeps),
    total_contribuciones_usd: round2(total),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
