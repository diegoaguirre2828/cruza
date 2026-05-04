// scripts/run-driver-pass-audit.mjs — Sprint 4 audit gate (Driver Pass)

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MEM_DIR = resolve(homedir(), '.claude/projects/C--Users-dnawa/memory');
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const RECON_PATH = resolve(MEM_DIR, `project_cruzar_driver_pass_audit_${today}.md`);

const checks = [];
function record(id, label, pass, evidence = '') { checks.push({ id, label, pass, evidence }); console.log(`${pass ? '✓' : '✗'} ${id} ${label}${evidence ? ' [' + evidence + ']' : ''}`); }
function runOrFail(cmd, id, label) {
  try {
    const out = execSync(cmd, { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
    record(id, label, true, (out.split('\n').filter(Boolean).slice(-1)[0] ?? '').slice(0, 120));
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

console.log('=== Sprint 4 audit gate — Driver Pass ===\n');

runOrFail('npm run verify:driver-pass', 'DP-CHASSIS-1', 'Driver pass composer 6/6 known-answers');

checkFiles('DP-CHASSIS-2', 'Chassis files present', [
  'lib/chassis/driver-pass/types.ts',
  'lib/chassis/driver-pass/registry.ts',
  'lib/chassis/driver-pass/composer.ts',
]);
checkFiles('DP-API-1', 'API routes present', ['app/api/driver-pass/scan/route.ts']);
checkFiles('DP-UI-1', 'UI + copy bundles present', [
  'app/driver-pass/page.tsx',
  'app/driver-pass/scan/page.tsx',
  'app/driver-pass/scan/ScanClient.tsx',
  'lib/copy/driver-pass-en.ts',
  'lib/copy/driver-pass-es.ts',
]);

try {
  const ticketTypes = execSync('cat lib/ticket/types.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const ok =
    ticketTypes.includes('TicketDriverPassBlock') &&
    /driver_pass\?:\s*TicketDriverPassBlock/.test(ticketTypes) &&
    /'driver_pass'/.test(ticketTypes);
  record('DP-TICKET-1', 'TicketDriverPassBlock + driver_pass? field + modules_present union', ok);
} catch { record('DP-TICKET-1', 'Ticket extension check', false, 'could not read'); }

try {
  const generate = execSync('cat lib/ticket/generate.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const ok = /driverPassInput\?:/.test(generate) && /composeDriverPass\(/.test(generate) && /modulesPresent\.push\('driver_pass'\)/.test(generate);
  record('DP-GENERATE-1', 'generate.ts wires driverPassInput → composeDriverPass → modules_present', ok);
} catch { record('DP-GENERATE-1', 'generate.ts wiring check', false, 'could not read'); }

try {
  const ws = execSync('cat app/workspace/WorkspaceClient.tsx', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const ok = /copy\.modules\.driver_pass\.title/.test(ws) && /href: `\/driver-pass\$\{langSuffix\}`/.test(ws);
  record('DP-WORKSPACE-1', 'Workspace renders Driver Pass module card', ok);
} catch { record('DP-WORKSPACE-1', 'Workspace check', false, 'could not read'); }

try {
  const nudge = execSync('cat components/PostSignupInstallNudge.tsx', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  record('DP-NUDGE-1', 'PostSignupInstallNudge blocks /driver-pass', /'\/driver-pass'/.test(nudge));
} catch { record('DP-NUDGE-1', 'nudge check', false, 'could not read'); }

try {
  const en = execSync('cat lib/copy/driver-pass-en.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const es = execSync('cat lib/copy/driver-pass-es.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const enOk = /legal_disclaimer:.*Cruzar is software for tracking driver-document expiry/.test(en);
  const esOk = /legal_disclaimer:.*Cruzar es software para rastrear vencimientos/.test(es);
  record('DP-DISCLAIMER-1', 'DeWalt-frame disclaimer in EN + ES', enOk && esOk, `en=${enOk}, es=${esOk}`);
  const cleanEn = !/[Bb]ilingual/.test(en);
  const cleanEs = !/[Bb]ilingüe/.test(es);
  record('DP-COPY-1', 'No bilingual feature-pitch leak', cleanEn && cleanEs);
} catch { record('DP-DISCLAIMER-1', 'disclaimer check', false, 'could not read'); }

runOrFail('npm run build', 'DP-BUILD-1', 'npm run build clean');

const passCount = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\n=== ${passCount}/${total} pass ===`);

mkdirSync(MEM_DIR, { recursive: true });
const recon = `---
name: project_cruzar_driver_pass_audit_${today}
description: Sprint 4 audit gate — Driver Pass (per-trip readiness composer)
type: project
---

# Cruzar Sprint 4 audit — Driver Pass — ${today}

**Result:** ${passCount}/${total} pass

| ID | Label | Pass | Evidence |
|---|---|---|---|
${checks.map((c) => `| ${c.id} | ${c.label} | ${c.pass ? '✓' : '✗'} | ${c.evidence.replace(/\|/g, '\\|').slice(0, 100)} |`).join('\n')}

**Why:** Last surround sprint. Driver-side complement to operator-level Driver Compliance (M5). The Cruzar Ticket now carries a per-trip driver-pass block — readiness, expiring docs, recommended renewals. Closes the substrate loop: shipment + customs + pedimento + regulatory + paperwork + refunds + drawback + cbam + uflpa + drivers (operator-side) + driver-pass (driver-side) + tickets.

**How to apply:** Same shape as M7/M11/Sprint-3. With driver-pass shipped, the surround thesis is operationally complete: 12 modules across the corridor, all composing onto one signed substrate.
`;
writeFileSync(RECON_PATH, recon);
console.log(`Reconciliation log: ${RECON_PATH}`);

if (passCount < total) process.exit(1);
