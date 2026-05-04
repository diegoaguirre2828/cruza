// scripts/run-cbam-uflpa-audit.mjs
// Sprint 3 audit gate — CBAM + UFLPA shallow stubs in one pass.

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MEM_DIR = resolve(homedir(), '.claude/projects/C--Users-dnawa/memory');
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const RECON_PATH = resolve(MEM_DIR, `project_cruzar_cbam_uflpa_audit_${today}.md`);

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
  } catch (e) {
    const stderr = (e.stderr?.toString() ?? '').split('\n').slice(-3).join(' / ');
    const stdout = (e.stdout?.toString() ?? '').split('\n').slice(-3).join(' / ');
    record(id, label, false, (stdout + ' ' + stderr).slice(0, 200));
  }
}
function checkFiles(id, label, files) {
  const missing = files.filter((f) => !existsSync(resolve(ROOT, f)));
  record(id, label, missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : `${files.length} files`);
}

console.log('=== Sprint 3 audit gate — CBAM + UFLPA ===\n');

// CBAM
runOrFail('npm run verify:cbam', 'CBAM-CHASSIS-1', 'CBAM composer 4/4 known-answers');
checkFiles('CBAM-CHASSIS-2', 'CBAM chassis files present', [
  'lib/chassis/cbam/types.ts',
  'lib/chassis/cbam/registry.ts',
  'lib/chassis/cbam/composer.ts',
]);
checkFiles('CBAM-API-1', 'CBAM API routes present', [
  'app/api/cbam/scan/route.ts',
]);
checkFiles('CBAM-UI-1', 'CBAM UI + copy bundles present', [
  'app/cbam/page.tsx',
  'app/cbam/scan/page.tsx',
  'app/cbam/scan/ScanClient.tsx',
  'lib/copy/cbam-en.ts',
  'lib/copy/cbam-es.ts',
]);

// UFLPA
runOrFail('npm run verify:uflpa', 'UFLPA-CHASSIS-1', 'UFLPA evaluator 5/5 known-answers');
checkFiles('UFLPA-CHASSIS-2', 'UFLPA chassis files present', [
  'lib/chassis/uflpa/types.ts',
  'lib/chassis/uflpa/registry.ts',
  'lib/chassis/uflpa/risk-flagger.ts',
]);
checkFiles('UFLPA-API-1', 'UFLPA API routes present', [
  'app/api/uflpa/scan/route.ts',
]);
checkFiles('UFLPA-UI-1', 'UFLPA UI + copy bundles present', [
  'app/uflpa/page.tsx',
  'app/uflpa/scan/page.tsx',
  'app/uflpa/scan/ScanClient.tsx',
  'lib/copy/uflpa-en.ts',
  'lib/copy/uflpa-es.ts',
]);

// Cruzar Ticket extension
try {
  const ticketTypes = execSync('cat lib/ticket/types.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamOk =
    ticketTypes.includes('TicketCbamBlock') &&
    /cbam\?:\s*TicketCbamBlock/.test(ticketTypes) &&
    /'cbam'/.test(ticketTypes);
  const uflpaOk =
    ticketTypes.includes('TicketUflpaBlock') &&
    /uflpa\?:\s*TicketUflpaBlock/.test(ticketTypes) &&
    /'uflpa'/.test(ticketTypes);
  record('TICKET-1', 'Ticket extension: CBAM + UFLPA blocks + modules_present', cbamOk && uflpaOk,
    `cbam=${cbamOk}, uflpa=${uflpaOk}`);
} catch {
  record('TICKET-1', 'Ticket extension check', false, 'could not read');
}

try {
  const generate = execSync('cat lib/ticket/generate.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamWired =
    /cbamInput\?:/.test(generate) &&
    /composeCbam\(/.test(generate) &&
    /modulesPresent\.push\('cbam'\)/.test(generate);
  const uflpaWired =
    /uflpaInput\?:/.test(generate) &&
    /evaluateUflpa\(/.test(generate) &&
    /modulesPresent\.push\('uflpa'\)/.test(generate);
  record('GENERATE-1', 'generate.ts wires CBAM + UFLPA inputs → composers → modules_present',
    cbamWired && uflpaWired,
    `cbam=${cbamWired}, uflpa=${uflpaWired}`);
} catch {
  record('GENERATE-1', 'generate.ts wiring check', false, 'could not read');
}

// Workspace
try {
  const wsClient = execSync('cat app/workspace/WorkspaceClient.tsx', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamCard = /copy\.modules\.cbam\.title/.test(wsClient) && /href: `\/cbam\$\{langSuffix\}`/.test(wsClient);
  const uflpaCard = /copy\.modules\.uflpa\.title/.test(wsClient) && /href: `\/uflpa\$\{langSuffix\}`/.test(wsClient);
  record('WORKSPACE-1', 'Workspace renders CBAM + UFLPA module cards',
    cbamCard && uflpaCard,
    `cbam=${cbamCard}, uflpa=${uflpaCard}`);
} catch {
  record('WORKSPACE-1', 'Workspace integration check', false, 'could not read');
}

// PostSignupInstallNudge B2B blocklist
try {
  const nudge = execSync('cat components/PostSignupInstallNudge.tsx', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamBlocked = /'\/cbam'/.test(nudge);
  const uflpaBlocked = /'\/uflpa'/.test(nudge);
  record('NUDGE-1', 'PostSignupInstallNudge blocks /cbam + /uflpa',
    cbamBlocked && uflpaBlocked,
    `cbam=${cbamBlocked}, uflpa=${uflpaBlocked}`);
} catch {
  record('NUDGE-1', 'nudge blocklist check', false, 'could not read');
}

// Disclaimers
try {
  const cbamEn = execSync('cat lib/copy/cbam-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamEs = execSync('cat lib/copy/cbam-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const uflpaEn = execSync('cat lib/copy/uflpa-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const uflpaEs = execSync('cat lib/copy/uflpa-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamEnOk = /legal_disclaimer:.*Cruzar is software for preparing EU CBAM/.test(cbamEn);
  const cbamEsOk = /legal_disclaimer:.*Cruzar es software para preparar documentación CBAM/.test(cbamEs);
  const uflpaEnOk = /legal_disclaimer:.*Cruzar is software for preparing UFLPA/.test(uflpaEn);
  const uflpaEsOk = /legal_disclaimer:.*Cruzar es software para preparar documentación de riesgo UFLPA/.test(uflpaEs);
  record('DISCLAIMER-1', 'DeWalt-frame disclaimer in all 4 copy bundles',
    cbamEnOk && cbamEsOk && uflpaEnOk && uflpaEsOk,
    `cbam_en=${cbamEnOk}, cbam_es=${cbamEsOk}, uflpa_en=${uflpaEnOk}, uflpa_es=${uflpaEsOk}`);
} catch {
  record('DISCLAIMER-1', 'disclaimer presence check', false, 'could not read');
}

// No bilingual feature pitch
try {
  const cbamEn = execSync('cat lib/copy/cbam-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const cbamEs = execSync('cat lib/copy/cbam-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const uflpaEn = execSync('cat lib/copy/uflpa-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const uflpaEs = execSync('cat lib/copy/uflpa-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const clean = !/[Bb]ilingual/.test(cbamEn) && !/[Bb]ilingüe/.test(cbamEs) &&
                !/[Bb]ilingual/.test(uflpaEn) && !/[Bb]ilingüe/.test(uflpaEs);
  record('COPY-1', 'No bilingual feature-pitch leak in CBAM + UFLPA copy', clean,
    clean ? 'all 4 clean' : 'leak detected');
} catch {
  record('COPY-1', 'copy lint check', false, 'could not read');
}

runOrFail('npm run build', 'BUILD-1', 'npm run build clean');

const passCount = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\n=== ${passCount}/${total} pass ===`);

mkdirSync(MEM_DIR, { recursive: true });
const recon = `---
name: project_cruzar_cbam_uflpa_audit_${today}
description: Sprint 3 audit gate — CBAM + UFLPA shallow stubs (compliance-regime pair)
type: project
---

# Cruzar Sprint 3 audit — CBAM + UFLPA — ${today}

**Result:** ${passCount}/${total} pass

| ID | Label | Pass | Evidence |
|---|---|---|---|
${checks.map((c) => `| ${c.id} | ${c.label} | ${c.pass ? '✓' : '✗'} | ${c.evidence.replace(/\|/g, '\\|').slice(0, 100)} |`).join('\n')}

**Why:** Third surround sprint (paired). Both are 2026-active compliance regimes from external regulators (EU + US) that gate cross-border trade independent of customs/refunds. CBAM = EU carbon border adjustment, definitive phase from 2026-01-01, affects RGV exporters of steel/aluminum/cement. UFLPA = US forced-labor presumption, active since 2022, affects RGV importers with deep China supply chains. Both compose onto the Cruzar Ticket; both sign the audit shield with their respective registry version.

**How to apply:** Same shape as M7/M11. Each new sprint stub follows: chassis files + verifier + API + UI + ticket extension + workspace card + disclaimer + copy lint + nudge-block + build clean.
`;
writeFileSync(RECON_PATH, recon);
console.log(`Reconciliation log: ${RECON_PATH}`);

if (passCount < total) process.exit(1);
