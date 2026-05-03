// scripts/verify-cbp-7501.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeCbp7501 } = await import('../lib/chassis/regulatory/cbp-7501.ts');
const set = JSON.parse(readFileSync(resolve(__dirname, '../data/regulatory/test-shipments.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = composeCbp7501(c.input);
  const usmca = c.input.origin.usmca_originating;
  let ok = got.required === true
    && typeof got.filing_deadline_iso === 'string'
    && new Date(got.filing_deadline_iso) > new Date(got.fields.entry_date_iso)
    && got.fields.line_items.length === 1
    && got.fields.line_items[0].hts_10 === c.input.hs.hts_10
    && got.fields.line_items[0].value_usd === c.input.shipment.transaction_value_usd
    && got.fields.line_items[0].duty_rate_pct === c.input.origin.effective_rate_pct;
  if (usmca) {
    ok = ok && got.fields.line_items[0].fta_claimed === 'USMCA'
      && got.fields.line_items[0].fta_criterion === 'B'
      && got.fields.fta_savings_usd > 0;
  } else {
    ok = ok && got.fields.line_items[0].fta_claimed === 'NONE'
      && got.fields.fta_savings_usd === 0;
  }
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, usmca, got_line: got.fields.line_items[0], got_savings: got.fields.fta_savings_usd, got_deadline: got.filing_deadline_iso });
}
const pct = (passed / set.cases.length) * 100;
console.log(`CBP 7501: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} usmca=${f.usmca} line=${JSON.stringify(f.got_line)} savings=${f.got_savings}`);
if (pct < 100) { console.error('FAIL: < 100%'); process.exit(1); }
console.log('PASS: 100%');
