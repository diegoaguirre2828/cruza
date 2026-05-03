// scripts/verify-paperwork-roundtrip.mjs
// Programmatic round-trip: composer takes raw bytes → vision → classify → extract → assert.
// Bypasses Next.js dev server (tesseract WASM + Turbopack dev = hangs).
// HTTP-layer smoke is deferred to post-deploy manual verification against cruzar.app.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composePaperwork } = await import('../lib/chassis/docs/composer.ts');

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
}

(async () => {
  console.log(`Round-trip target: programmatic (composer direct, no HTTP)\n`);

  const fixtureBytes = readFileSync(resolve(__dirname, '../data/docs/test-fixtures/commercial-invoice.png'));

  const result = await composePaperwork({
    pages: [{ bytes: new Uint8Array(fixtureBytes), mime_type: 'image/png', language_hint: 'auto' }],
  });

  check('composition.doc_count is 1', result.composition?.doc_count === 1, `got ${result.composition?.doc_count}`);
  check('detected commercial_invoice', result.composition?.documents_extracted?.[0]?.doc_type === 'commercial_invoice', `got ${result.composition?.documents_extracted?.[0]?.doc_type}`);
  check('per_page array length 1', Array.isArray(result.per_page) && result.per_page.length === 1);
  check('extracted invoice_number is string', typeof result.per_page?.[0]?.fields?.invoice_number === 'string', `got ${result.per_page?.[0]?.fields?.invoice_number}`);
  check('blocking_issues empty for clean invoice', Array.isArray(result.composition.blocking_issues) && result.composition.blocking_issues.length === 0);

  const failed = checks.filter(c => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exit(1);
})();
