// scripts/verify-eudamed-composer.mjs
// Verifies the EUDAMED composer against known-answer cases — actor validation
// (EU AR rule, SRN prefix), device validation (NB requirement, GTIN check-digit,
// CE marking, UDI-PI by risk class), and composition output shape.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeEudamedSubmission } = await import('../lib/chassis/eudamed/composer.ts');

const cases = JSON.parse(
  readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/eudamed-known-answers.json'), 'utf-8'),
);

let pass = 0;
let fail = 0;

for (const c of cases) {
  const input = {
    actor: c.input.actor,
    devices: c.input.devices,
    captured_at: '2026-05-03T12:00:00.000Z',
  };
  const out = composeEudamedSubmission(input);
  const checks = {
    actor_ready: out.actor_registration.is_submission_ready === c.expected.actor_ready,
    device_count: out.device_count === c.expected.device_count,
    ready_count: out.ready_count === c.expected.ready_count,
    blocked_count: out.blocked_count === c.expected.blocked_count,
    csv_signature: /^[a-f0-9]{64}$/.test(out.udi_csv_signature),
    csv_has_header: out.udi_csv.startsWith('udi_di,'),
  };
  const allPass = Object.values(checks).every(Boolean);
  if (allPass) {
    pass++;
    console.log(
      `PASS: ${c.label} — actor_ready=${out.actor_registration.is_submission_ready}, devices ${out.ready_count}/${out.device_count}`,
    );
  } else {
    fail++;
    console.log(`FAIL: ${c.label}`);
    for (const [k, v] of Object.entries(checks)) {
      if (!v) console.log(`  ${k}: got ${JSON.stringify(out[k] ?? out.actor_registration[k])}`);
    }
    if (out.actor_registration.validation_warnings.length > 0) {
      console.log(`  actor warnings: ${out.actor_registration.validation_warnings.join(' / ')}`);
    }
    for (const dv of out.device_validation) {
      if (!dv.valid) {
        console.log(`  device ${dv.udi_di} blocked: ${dv.missing_fields.join(' / ')}`);
      }
    }
  }
}

console.log(`\nEUDAMED composer: ${pass}/${pass + fail} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed`);
  process.exit(1);
}
console.log('PASS: 100%');
