// scripts/run-module-11-audit.mjs
// Module 11 VUCEM/Pedimento shallow-stub audit. Same shape as M7.

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MEM_DIR = resolve(homedir(), '.claude/projects/C--Users-dnawa/memory');
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const RECON_PATH = resolve(MEM_DIR, `project_cruzar_module_11_audit_${today}.md`);

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

console.log('=== Module 11 VUCEM/Pedimento audit gate ===\n');

runOrFail('npm run verify:pedimento', 'M11-CHASSIS-1', 'M11 pedimento composer 7/7 known-answers');

const chassisFiles = [
  'lib/chassis/pedimento/types.ts',
  'lib/chassis/pedimento/registry.ts',
  'lib/chassis/pedimento/validators.ts',
  'lib/chassis/pedimento/classifier.ts',
  'lib/chassis/pedimento/duty-calculator.ts',
  'lib/chassis/pedimento/composer.ts',
];
const chassisMissing = chassisFiles.filter((f) => !existsSync(resolve(ROOT, f)));
record('M11-CHASSIS-2', 'All M11 chassis files present', chassisMissing.length === 0,
  chassisMissing.length ? `missing: ${chassisMissing.join(', ')}` : `${chassisFiles.length} files`);

const apiFiles = ['app/api/pedimento/scan/route.ts'];
const apiMissing = apiFiles.filter((f) => !existsSync(resolve(ROOT, f)));
record('M11-API-1', 'M11 API routes present', apiMissing.length === 0,
  apiMissing.length ? `missing: ${apiMissing.join(', ')}` : `${apiFiles.length} routes`);

const uiFiles = [
  'app/pedimento/page.tsx',
  'app/pedimento/scan/page.tsx',
  'app/pedimento/scan/ScanClient.tsx',
  'lib/copy/pedimento-en.ts',
  'lib/copy/pedimento-es.ts',
];
const uiMissing = uiFiles.filter((f) => !existsSync(resolve(ROOT, f)));
record('M11-UI-1', 'M11 UI pages + copy bundles present', uiMissing.length === 0,
  uiMissing.length ? `missing: ${uiMissing.join(', ')}` : `${uiFiles.length} files`);

try {
  const ticketTypes = execSync('cat lib/ticket/types.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasInterface = ticketTypes.includes('TicketPedimentoBlock');
  const hasField = /pedimento\?:\s*TicketPedimentoBlock/.test(ticketTypes);
  const hasModule = /'pedimento'/.test(ticketTypes);
  record('M11-TICKET-1', 'TicketPedimentoBlock + pedimento? field + modules_present union',
    hasInterface && hasField && hasModule,
    `interface=${hasInterface}, field=${hasField}, union=${hasModule}`);
} catch {
  record('M11-TICKET-1', 'Ticket extension check', false, 'could not read');
}

try {
  const generate = execSync('cat lib/ticket/generate.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasInput = /pedimentoInput\?:\s*PedimentoInput/.test(generate);
  const hasCompose = /composePedimento\(/.test(generate);
  const hasModulePush = /modulesPresent\.push\('pedimento'\)/.test(generate);
  record('M11-GENERATE-1', 'generate.ts wires pedimentoInput → composePedimento → modules_present',
    hasInput && hasCompose && hasModulePush,
    `input=${hasInput}, compose=${hasCompose}, push=${hasModulePush}`);
} catch {
  record('M11-GENERATE-1', 'generate.ts wiring check', false, 'could not read');
}

try {
  const wsClient = execSync('cat app/workspace/WorkspaceClient.tsx', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasCard = /copy\.modules\.pedimento\.title/.test(wsClient);
  const hasLink = /href: `\/pedimento\$\{langSuffix\}`/.test(wsClient);
  record('M11-WORKSPACE-1', 'Workspace renders pedimento module card',
    hasCard && hasLink,
    `card=${hasCard}, link=${hasLink}`);
} catch {
  record('M11-WORKSPACE-1', 'Workspace integration check', false, 'could not read');
}

try {
  const en = execSync('cat lib/copy/pedimento-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const es = execSync('cat lib/copy/pedimento-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const enDisclaimer = /legal_disclaimer:.*Cruzar is software for preparing Mexican customs documentation/.test(en);
  const esDisclaimer = /legal_disclaimer:.*Cruzar es software para preparar documentación aduanal mexicana/.test(es);
  record('M11-DISCLAIMER-1', 'DeWalt-frame disclaimer in EN + ES copy bundles',
    enDisclaimer && esDisclaimer,
    `en=${enDisclaimer}, es=${esDisclaimer}`);
} catch {
  record('M11-DISCLAIMER-1', 'disclaimer presence check', false, 'could not read');
}

try {
  const en = execSync('cat lib/copy/pedimento-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const es = execSync('cat lib/copy/pedimento-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const enClean = !/[Bb]ilingual/.test(en);
  const esClean = !/[Bb]ilingüe/.test(es);
  record('M11-COPY-1', 'No bilingual feature-pitch leak in pedimento copy',
    enClean && esClean,
    `en_clean=${enClean}, es_clean=${esClean}`);
} catch {
  record('M11-COPY-1', 'copy lint check', false, 'could not read');
}

runOrFail('npm run build', 'M11-BUILD-1', 'npm run build clean');

const passCount = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\n=== ${passCount}/${total} pass ===`);

mkdirSync(MEM_DIR, { recursive: true });
const recon = `---
name: project_cruzar_module_11_audit_${today}
description: Module 11 VUCEM / Pedimento (MX-side) shallow-stub audit gate
type: project
---

# Cruzar Module 11 audit — ${today}

**Result:** ${passCount}/${total} pass

| ID | Label | Pass | Evidence |
|---|---|---|---|
${checks.map((c) => `| ${c.id} | ${c.label} | ${c.pass ? '✓' : '✗'} | ${c.evidence.replace(/\|/g, '\\|').slice(0, 100)} |`).join('\n')}

**Why:** Second surround-strategy stub. Mexican-side mirror of M2 (US customs). Anexo 22 clave classifier (A1/A3/V1/V5/F4/M3/etc.) + RFC validator + patente validator + duty math (ad-valorem + DTA + IVA + IEPS + frontera-norte 8% reduction). Closes the corridor — every shipment now has a Cruzar Ticket on both sides.

**How to apply:** Same shape as M7 audit. Each surround stub follows: chassis files + verifier + API + UI + ticket extension + workspace card + disclaimer + copy lint + build clean.
`;
writeFileSync(RECON_PATH, recon);
console.log(`Reconciliation log: ${RECON_PATH}`);

if (passCount < total) process.exit(1);
