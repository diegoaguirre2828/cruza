// scripts/run-module-7-audit.mjs
// Module 7 Drawback (§1313) shallow-stub audit.
// Pattern adapted from scripts/run-module-14-audit.mjs.

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MEM_DIR = resolve(homedir(), '.claude/projects/C--Users-dnawa/memory');
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const RECON_PATH = resolve(MEM_DIR, `project_cruzar_module_7_audit_${today}.md`);

const checks = [];
function record(id, label, pass, evidence = '') {
  checks.push({ id, label, pass, evidence });
  console.log(`${pass ? '✓' : '✗'} ${id} ${label}${evidence ? ' [' + evidence + ']' : ''}`);
}

function runOrFail(cmd, id, label) {
  try {
    const out = execSync(cmd, { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
    const lastLine = out.split('\n').filter(Boolean).slice(-1)[0] ?? '';
    record(id, label, true, lastLine.slice(0, 120));
    return true;
  } catch (e) {
    const stderr = (e.stderr?.toString() ?? '').split('\n').slice(-3).join(' / ');
    const stdout = (e.stdout?.toString() ?? '').split('\n').slice(-3).join(' / ');
    record(id, label, false, (stdout + ' ' + stderr).slice(0, 200));
    return false;
  }
}

console.log('=== Module 7 Drawback (§1313) audit gate ===\n');

// ── Chassis verifier ───────────────────────────────────────────────────────
runOrFail('npm run verify:drawback', 'M7-CHASSIS-1', 'M7 drawback composer 8/8 known-answers');

// ── Chassis files present ──────────────────────────────────────────────────
const chassisFiles = [
  'lib/chassis/drawback/types.ts',
  'lib/chassis/drawback/registry.ts',
  'lib/chassis/drawback/claim-classifier.ts',
  'lib/chassis/drawback/eligibility-checker.ts',
  'lib/chassis/drawback/refund-calculator.ts',
  'lib/chassis/drawback/composer.ts',
];
const chassisMissing = chassisFiles.filter((f) => !existsSync(resolve(ROOT, f)));
record('M7-CHASSIS-2', 'All M7 chassis files present', chassisMissing.length === 0,
  chassisMissing.length ? `missing: ${chassisMissing.join(', ')}` : `${chassisFiles.length} files`);

// ── API routes present ─────────────────────────────────────────────────────
const apiFiles = [
  'app/api/drawback/scan/route.ts',
];
const apiMissing = apiFiles.filter((f) => !existsSync(resolve(ROOT, f)));
record('M7-API-1', 'M7 API routes present', apiMissing.length === 0,
  apiMissing.length ? `missing: ${apiMissing.join(', ')}` : `${apiFiles.length} routes`);

// ── UI surfaces ────────────────────────────────────────────────────────────
const uiFiles = [
  'app/drawback/page.tsx',
  'app/drawback/scan/page.tsx',
  'app/drawback/scan/ScanClient.tsx',
  'lib/copy/drawback-en.ts',
  'lib/copy/drawback-es.ts',
];
const uiMissing = uiFiles.filter((f) => !existsSync(resolve(ROOT, f)));
record('M7-UI-1', 'M7 UI pages + copy bundles present', uiMissing.length === 0,
  uiMissing.length ? `missing: ${uiMissing.join(', ')}` : `${uiFiles.length} files`);

// ── Cruzar Ticket extension wiring ─────────────────────────────────────────
try {
  const ticketTypes = execSync('cat lib/ticket/types.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasInterface = ticketTypes.includes('TicketDrawbackBlock');
  const hasField = /drawback\?:\s*TicketDrawbackBlock/.test(ticketTypes);
  const hasModule = /'drawback'/.test(ticketTypes);
  record('M7-TICKET-1', 'TicketDrawbackBlock + drawback? field + modules_present union',
    hasInterface && hasField && hasModule,
    `interface=${hasInterface}, field=${hasField}, union=${hasModule}`);
} catch {
  record('M7-TICKET-1', 'Ticket extension check', false, 'could not read lib/ticket/types.ts');
}

try {
  const generate = execSync('cat lib/ticket/generate.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasInput = /drawbackInput\?:\s*\{/.test(generate);
  const hasCompose = /composeDrawback\(/.test(generate);
  const hasModulePush = /modulesPresent\.push\('drawback'\)/.test(generate);
  record('M7-GENERATE-1', 'generate.ts wires drawbackInput → composeDrawback → modules_present',
    hasInput && hasCompose && hasModulePush,
    `input=${hasInput}, compose=${hasCompose}, push=${hasModulePush}`);
} catch {
  record('M7-GENERATE-1', 'generate.ts wiring check', false, 'could not read lib/ticket/generate.ts');
}

// ── Workspace integration ──────────────────────────────────────────────────
try {
  const wsClient = execSync('cat app/workspace/WorkspaceClient.tsx', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasCard = /copy\.modules\.drawback\.title/.test(wsClient);
  const hasLink = /href: `\/drawback\$\{langSuffix\}`/.test(wsClient);
  record('M7-WORKSPACE-1', 'Workspace renders drawback module card',
    hasCard && hasLink,
    `card=${hasCard}, link=${hasLink}`);
} catch {
  record('M7-WORKSPACE-1', 'Workspace integration check', false, 'could not read');
}

// ── DeWalt-frame disclaimer present in EN + ES copy ────────────────────────
try {
  const en = execSync('cat lib/copy/drawback-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const es = execSync('cat lib/copy/drawback-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const enDisclaimer = /legal_disclaimer:.*Cruzar is software for preparing CBP drawback documentation/.test(en);
  const esDisclaimer = /legal_disclaimer:.*Cruzar es software para preparar/.test(es);
  record('M7-DISCLAIMER-1', 'DeWalt-frame disclaimer present in EN + ES copy bundles',
    enDisclaimer && esDisclaimer,
    `en=${enDisclaimer}, es=${esDisclaimer}`);
} catch {
  record('M7-DISCLAIMER-1', 'disclaimer presence check', false, 'could not read');
}

// ── Pricing locked at flat 8% (shared with M14) ────────────────────────────
try {
  const fee = execSync('cat lib/chassis/refunds/fee-calculator.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const isFlat8 = /PLATFORM_FEE_RATE\s*=\s*0\.08/.test(fee);
  const hasFloor = /PLATFORM_FEE_FLOOR_USD\s*=\s*99/.test(fee);
  record('M7-PRICING-1', 'fee-calculator (shared) locked at flat 8% + $99 floor',
    isFlat8 && hasFloor,
    `rate=${isFlat8}, floor=${hasFloor}`);
} catch {
  record('M7-PRICING-1', 'pricing lock check', false, 'could not read');
}

// ── No "bilingual" feature pitch in drawback copy ──────────────────────────
try {
  const en = execSync('cat lib/copy/drawback-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const es = execSync('cat lib/copy/drawback-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const enClean = !/[Bb]ilingual/.test(en);
  const esClean = !/[Bb]ilingüe/.test(es);
  record('M7-COPY-1', 'No bilingual feature-pitch leak in drawback copy',
    enClean && esClean,
    `en_clean=${enClean}, es_clean=${esClean}`);
} catch {
  record('M7-COPY-1', 'copy lint check', false, 'could not read');
}

// ── Build clean ────────────────────────────────────────────────────────────
runOrFail('npm run build', 'M7-BUILD-1', 'npm run build clean');

// ── Summary ────────────────────────────────────────────────────────────────
const passCount = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\n=== ${passCount}/${total} pass ===`);

mkdirSync(MEM_DIR, { recursive: true });
const recon = `---
name: project_cruzar_module_7_audit_${today}
description: Module 7 Drawback (§1313) shallow-stub audit gate
type: project
---

# Cruzar Module 7 audit — ${today}

**Result:** ${passCount}/${total} pass

| ID | Label | Pass | Evidence |
|---|---|---|---|
${checks.map((c) => `| ${c.id} | ${c.label} | ${c.pass ? '✓' : '✗'} | ${c.evidence.replace(/\|/g, '\\|').slice(0, 100)} |`).join('\n')}

**Why:** First surround-strategy stub after M14 IEEPA. Same chassis shape, different statute. Drawback (§1313) recovers 99% of duties+taxes+fees on imports that get exported, used in manufacturing exports, or rejected/returned within 5yrs. Shares fee-calculator + DeWalt frame + Cruzar Ticket substrate with M14. Audience overlaps with /refunds — fastest moat-tightener.

**How to apply:** Each surround stub follows this same audit pattern (chassis files + verifier + API + UI + ticket extension + workspace card + disclaimer + pricing lock + build clean). Replicate for M11 VUCEM, CBAM, UFLPA, Driver Wallet.
`;
writeFileSync(RECON_PATH, recon);
console.log(`Reconciliation log: ${RECON_PATH}`);

if (passCount < total) process.exit(1);
