// scripts/verify-hs-classifier.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// tsx loads TS at runtime
const { classifyHs } = await import('../lib/chassis/customs/hs-classifier.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/customs/hs-classifier-test-set.json'), 'utf-8'));

let chapterMatches = 0;
let exactMatches = 0;
const failures = [];

for (const item of set.items) {
  const result = classifyHs({ product_description: item.description });
  const predictedChapter = result.hts_10.slice(0, 2);
  const expectedChapter = item.expected_chapter;
  if (predictedChapter === expectedChapter) chapterMatches++;
  else failures.push({ id: item.id, expected: expectedChapter, got: predictedChapter, desc: item.description });
  if (result.hts_10.replace(/\./g,'').slice(0,8) === item.expected_hts_10.replace(/\./g,'').slice(0,8)) exactMatches++;
}

const chapterPct = (chapterMatches / set.items.length) * 100;
const exactPct = (exactMatches / set.items.length) * 100;

console.log(`Chapter-level match: ${chapterMatches}/${set.items.length} = ${chapterPct.toFixed(1)}%`);
console.log(`8-digit match: ${exactMatches}/${set.items.length} = ${exactPct.toFixed(1)}%`);

if (failures.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  ${f.id}: expected ch.${f.expected}, got ch.${f.got} — ${f.desc}`);
}

if (chapterPct < 95) {
  console.error(`\nFAIL: chapter-level accuracy ${chapterPct.toFixed(1)}% < 95% audit-gate threshold`);
  process.exit(1);
}
console.log(`\nPASS: chapter-level accuracy >= 95%`);
