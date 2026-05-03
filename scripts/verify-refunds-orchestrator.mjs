// scripts/verify-refunds-orchestrator.mjs
// End-to-end pipeline test: ACE CSV → entries → classify → split → cliff-route → CAPE/Form19 compose.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { parseAceCsv } = await import('../lib/chassis/refunds/ace-parser.ts');
const { composeRefund } = await import('../lib/chassis/refunds/composer.ts');

const fixturesDir = resolve(__dirname, '../data/refunds/test-fixtures/ace-csv');

const ior = {
  ior_name: 'Test Broker LLC',
  ior_id_number: '12-3456789',
  filer_code: 'ABC',
  importer_address: '123 RGV Way, McAllen TX 78501',
};

let pass = 0, fail = 0;
const today = new Date('2026-05-03');

// Test 1: fixture-001 — 2 entries, both within 80-day cliff (liq 2026-02-23 + 2026-03-31, both <80 days from today)
{
  const csv = readFileSync(resolve(fixturesDir, 'fixture-001-entry-summary-by-filer.csv'), 'utf-8');
  const { entries } = parseAceCsv(csv);
  if (entries.length !== 2) {
    fail++;
    console.log(`FAIL [fixture-001 parse]: expected 2 entries, got ${entries.length}`);
  } else {
    const composition = await composeRefund(entries, ior, today);
    const checks = {
      total_entries: composition.total_entries === 2,
      total_principal_positive: composition.total_principal_recoverable_usd > 0,
      total_interest_positive: composition.total_interest_recoverable_usd > 0,
      total_recoverable_sums: Math.abs(
        composition.total_recoverable_usd -
          (composition.total_principal_recoverable_usd + composition.total_interest_recoverable_usd)
      ) < 0.01,
      cape_csv_nonempty: composition.cape_csv.length > 'Entry Number\n'.length,
      cape_csv_signature_set: /^[a-f0-9]{64}$/.test(composition.cape_csv_signature),
      composed_at_iso: typeof composition.composed_at === 'string' && composition.composed_at.includes('T'),
      registry_version_set: typeof composition.registry_version === 'string' && composition.registry_version.length > 0,
      counts_partition: (
        composition.cape_eligible_count +
          composition.protest_required_count +
          composition.past_protest_window_count +
          composition.ineligible_count
      ) <= composition.total_entries,
      estimated_fee_floor: composition.estimated_cruzar_fee_usd >= 99 || composition.total_recoverable_usd === 0,
    };
    let testFail = false;
    for (const [k, v] of Object.entries(checks)) {
      if (!v) {
        testFail = true;
        console.log(`FAIL [fixture-001 ${k}]: got ${JSON.stringify(composition[k.split('_').slice(0,-1).join('_')] ?? composition)}`);
      }
    }
    if (!testFail) {
      pass++;
      console.log(`PASS: fixture-001 — ${composition.total_entries} entries, $${composition.total_principal_recoverable_usd} principal + $${composition.total_interest_recoverable_usd} interest = $${composition.total_recoverable_usd} recoverable`);
    } else fail++;
  }
}

// Test 2: fixture-006 (CA-only, all liquidations beyond 80-day cliff per filename)
{
  const csv = readFileSync(resolve(fixturesDir, 'fixture-006-canada-only.csv'), 'utf-8');
  const { entries } = parseAceCsv(csv);
  const composition = await composeRefund(entries, ior, today);
  if (composition.total_entries !== entries.length) {
    fail++;
    console.log(`FAIL [fixture-006 total_entries]: expected ${entries.length}, got ${composition.total_entries}`);
  } else {
    pass++;
    console.log(`PASS: fixture-006 — ${composition.total_entries} entries; $${composition.total_recoverable_usd} recoverable; cape=${composition.cape_eligible_count}, protest=${composition.protest_required_count}`);
  }
}

// Test 3: fee floor — $0 recoverable should produce $0 fee, not $99 floor
{
  const composition = await composeRefund([], ior, today);
  if (composition.total_recoverable_usd === 0 && composition.estimated_cruzar_fee_usd === 0) {
    pass++;
    console.log(`PASS: empty input — $0 recoverable, $0 fee (no $99 floor on zero)`);
  } else {
    fail++;
    console.log(`FAIL [empty input]: expected $0 recoverable + $0 fee, got recoverable=$${composition.total_recoverable_usd} fee=$${composition.estimated_cruzar_fee_usd}`);
  }
}

console.log(`\nRefunds Orchestrator: ${pass}/${pass + fail} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed`);
  process.exit(1);
}
console.log('PASS: 100%');
