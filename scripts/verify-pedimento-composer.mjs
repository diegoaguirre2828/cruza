// scripts/verify-pedimento-composer.mjs — M11 pedimento chassis
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composePedimento } = await import('../lib/chassis/pedimento/composer.ts');

const fx = JSON.parse(readFileSync(resolve(__dirname, '../data/pedimento/test-fixtures/composer-known-answers.json'), 'utf-8'));
const today = new Date(fx.today_iso);

let pass = 0, fail = 0;
const fails = [];
for (const c of fx.cases) {
  const r = composePedimento(c.input, today);
  const e = c.expect;
  const fatalCount = r.findings.filter((f) => f.severity === 'fatal').length;
  const hasFindingId = e.has_finding_rule_id
    ? r.findings.some((f) => f.rule_id === e.has_finding_rule_id)
    : true;

  const ok =
    (e.clave === undefined || r.clave === e.clave) &&
    (e.regimen === undefined || r.regimen === e.regimen) &&
    (e.rfc_validacion === undefined || r.rfc_validacion === e.rfc_validacion) &&
    (e.patente_validacion === undefined || r.patente_validacion === e.patente_validacion) &&
    (e.padron_status === undefined || r.padron_status === e.padron_status) &&
    (e.fatal_count === undefined || fatalCount === e.fatal_count) &&
    (e.fatal_count_at_least === undefined || fatalCount >= e.fatal_count_at_least) &&
    hasFindingId &&
    (e.ad_valorem_usd === undefined || Math.abs(r.impuestos.ad_valorem_usd - e.ad_valorem_usd) < 0.01);

  if (ok) {
    pass++;
  } else {
    fail++;
    fails.push({
      name: c.name,
      got: {
        clave: r.clave,
        regimen: r.regimen,
        rfc: r.rfc_validacion,
        pat: r.patente_validacion,
        padron: r.padron_status,
        fatal: fatalCount,
        ad_val: r.impuestos.ad_valorem_usd,
        finding_ids: r.findings.map((f) => f.rule_id),
      },
      want: e,
    });
  }
}
console.log(`Pedimento composer: ${pass}/${fx.cases.length} pass`);
if (fail > 0) {
  console.error(JSON.stringify(fails, null, 2));
  process.exit(1);
}
console.log('PASS');
