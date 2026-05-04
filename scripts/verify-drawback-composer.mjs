// scripts/verify-drawback-composer.mjs — M7 drawback chassis
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeDrawback } = await import('../lib/chassis/drawback/composer.ts');

const fx = JSON.parse(readFileSync(resolve(__dirname, '../data/drawback/test-fixtures/composer-known-answers.json'), 'utf-8'));
const today = new Date(fx.today_iso);

let pass = 0, fail = 0;
const fails = [];
for (const c of fx.cases) {
  const r = composeDrawback({ claimant: c.claimant, entries: c.entries, exports: c.exports }, today);
  const e = c.expect;
  const ok =
    r.manufacturing_count === e.manufacturing_count &&
    r.unused_count === e.unused_count &&
    r.rejected_count === e.rejected_count &&
    r.ineligible_count === e.ineligible_count &&
    Math.abs(r.total_refund_basis_usd - e.total_refund_basis_usd) < 0.01 &&
    Math.abs(r.total_drawback_recoverable_usd - e.total_drawback_recoverable_usd) < 0.01 &&
    r.designations[0]?.claim_type === e.first_designation_claim_type &&
    (e.first_designation_ineligibility_reason === undefined ||
      r.designations[0]?.ineligibility_reason === e.first_designation_ineligibility_reason) &&
    (e.accelerated_payment_eligible === undefined ||
      r.accelerated_payment_eligible === e.accelerated_payment_eligible);
  if (ok) {
    pass++;
  } else {
    fail++;
    fails.push({
      name: c.name,
      got: {
        mc: r.manufacturing_count,
        uc: r.unused_count,
        rc: r.rejected_count,
        ic: r.ineligible_count,
        basis: r.total_refund_basis_usd,
        dbk: r.total_drawback_recoverable_usd,
        ct: r.designations[0]?.claim_type,
        ir: r.designations[0]?.ineligibility_reason,
        ape: r.accelerated_payment_eligible,
      },
      want: e,
    });
  }
}
console.log(`Drawback composer: ${pass}/${fx.cases.length} pass`);
if (fail > 0) {
  console.error(JSON.stringify(fails, null, 2));
  process.exit(1);
}
console.log('PASS');
