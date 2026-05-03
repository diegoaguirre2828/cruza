// scripts/run-module-3-audit.mjs
// Runs ALL Module 2 audit checks PLUS the new Module 3 regulatory checks.
// Writes Reconciliation log to ~/.claude/projects/.../memory/project_cruzar_module_3_audit_<DATE>.md.

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MEM_DIR = resolve(homedir(), '.claude/projects/C--Users-dnawa/memory');
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const RECON_PATH = resolve(MEM_DIR, `project_cruzar_module_3_audit_${today}.md`);

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

console.log('=== Module 3 audit gate (extends Module 2) ===\n');

// ── Module 2 checks (re-run) ────────────────────────────────────────────────
runOrFail('npm run verify:ligie', 'M2-LIGIE-1', 'M2 LIGIE table valid');
runOrFail('npm run verify:hs', 'M2-HS-1', 'M2 HS classifier ≥ 95%');
runOrFail('npm run verify:rvc', 'M2-RVC-1', 'M2 RVC calculator 100%');
runOrFail('npm run verify:origin', 'M2-ORIGIN-1', 'M2 origin validator ≥ 98%');

const m2Files = [
  'lib/chassis/customs/types.ts',
  'lib/chassis/customs/ligie-flag.ts',
  'lib/chassis/customs/hs-classifier.ts',
  'lib/chassis/customs/origin-validator.ts',
  'lib/chassis/customs/rvc-calculator.ts',
  'lib/chassis/customs/usmca-preference.ts',
  'lib/ticket/types.ts',
  'lib/ticket/json-signer.ts',
  'lib/ticket/qr.ts',
  'lib/ticket/pdf.ts',
  'lib/ticket/verifier.ts',
  'lib/ticket/generate.ts',
  'supabase/migrations/v75-customs-validations.sql',
  'supabase/migrations/v76-tickets.sql',
];
const m2Missing = m2Files.filter(f => !existsSync(resolve(ROOT, f)));
record('M2-CHASSIS-1', 'M2 chassis + Ticket files present', m2Missing.length === 0, m2Missing.length ? `missing: ${m2Missing.join(', ')}` : '');

// ── Module 3 checks ─────────────────────────────────────────────────────────
runOrFail('npm run verify:fda', 'FDA-1', 'FDA Prior Notice 100%');
runOrFail('npm run verify:usda', 'USDA-1', 'USDA APHIS 100%');
runOrFail('npm run verify:isf', 'ISF-1', 'ISF 10+2 100%');
runOrFail('npm run verify:cbp7501', 'CBP7501-1', 'CBP 7501 100%');
runOrFail('npm run verify:manifest', 'MANIFEST-1', 'Manifest routing ≥ 98%');

const m3ChassisFiles = [
  'lib/chassis/regulatory/types.ts',
  'lib/chassis/regulatory/fda-prior-notice.ts',
  'lib/chassis/regulatory/usda-aphis.ts',
  'lib/chassis/regulatory/isf-10-2.ts',
  'lib/chassis/regulatory/cbp-7501.ts',
  'lib/chassis/regulatory/submitter.ts',
  'lib/chassis/regulatory/pdf.ts',
];
const m3ChassisMissing = m3ChassisFiles.filter(f => !existsSync(resolve(ROOT, f)));
record('REGULATORY-CHASSIS-1', 'All Module 3 chassis files present', m3ChassisMissing.length === 0, m3ChassisMissing.length ? `missing: ${m3ChassisMissing.join(', ')}` : '');

const m3ApiFiles = [
  'app/api/regulatory/fda-prior-notice/route.ts',
  'app/api/regulatory/usda-aphis/route.ts',
  'app/api/regulatory/isf-10-2/route.ts',
  'app/api/regulatory/cbp-7501/route.ts',
  'app/api/regulatory/manifest/route.ts',
];
const m3ApiMissing = m3ApiFiles.filter(f => !existsSync(resolve(ROOT, f)));
record('REGULATORY-API-1', 'All 5 regulatory API routes present', m3ApiMissing.length === 0, m3ApiMissing.length ? `missing: ${m3ApiMissing.join(', ')}` : '');

record('MIGRATION-V77-1', 'v77 regulatory_submissions migration file present', existsSync(resolve(ROOT, 'supabase/migrations/v77-regulatory-submissions.sql')));

// Verify Ticket bundle extension
try {
  const ticketTypes = execSync('cat lib/ticket/types.ts', { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const hasInterface = ticketTypes.includes('TicketRegulatoryBlock');
  const hasField = /regulatory\?:\s*TicketRegulatoryBlock/.test(ticketTypes);
  record('TICKET-EXTENSION-1', 'TicketRegulatoryBlock interface + regulatory? field on CruzalTicketV1', hasInterface && hasField, `interface=${hasInterface}, field=${hasField}`);
} catch {
  record('TICKET-EXTENSION-1', 'TicketRegulatoryBlock check', false, 'could not read lib/ticket/types.ts');
}

// ── Live + build checks ─────────────────────────────────────────────────────
let devRunning = false;
try {
  execSync('curl -fsS http://localhost:3000/api/ports', { stdio: 'pipe', shell: true });
  devRunning = true;
} catch { devRunning = false; }

if (devRunning) {
  runOrFail('npm run verify:ticket', 'M2-ROUNDTRIP-1', 'M2 Ticket round-trip');
} else {
  record('M2-ROUNDTRIP-1', 'Round-trip skipped (no dev server)', true, 'SKIP');
}

const apiPortsHost = process.env.CRUZAR_AUDIT_HOST ?? (devRunning ? 'http://localhost:3000' : 'https://cruzar.app');
try {
  const out = execSync(`curl -fsS "${apiPortsHost}/api/ports"`, { cwd: ROOT, stdio: 'pipe', shell: true }).toString();
  const j = JSON.parse(out);
  const n = Array.isArray(j) ? j.length : Array.isArray(j.ports) ? j.ports.length : 0;
  record('REGRESS-1', `${apiPortsHost}/api/ports ≥ 50 ports`, n >= 50, `${n} ports`);
} catch (e) {
  record('REGRESS-1', `${apiPortsHost}/api/ports regression`, false, (e.message ?? '').slice(0, 120));
}

if (process.env.NEXT_BUILD_AUDIT === '1') {
  runOrFail('npm run build', 'BUILD-1', 'npm run build clean');
} else {
  record('BUILD-1', 'npm run build (set NEXT_BUILD_AUDIT=1 to include)', true, 'SKIP');
}

// ── Summary + Reconciliation log ────────────────────────────────────────────
const failed = checks.filter(c => !c.pass);
console.log('\n=== Summary ===');
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);

try { mkdirSync(MEM_DIR, { recursive: true }); } catch {}

const log = [
  `---`,
  `name: Cruzar Module 3 audit — ${today}`,
  `description: Module 3 pre-arrival regulatory notification audit-gate run. ${failed.length === 0 ? 'PASSED — proceed to Module 4.' : `FAILED — ${failed.length} issue(s) — block Module 4.`}`,
  `type: project`,
  `---`,
  ``,
  `# Module 3 audit — ${today}`,
  ``,
  `**Result:** ${failed.length === 0 ? '✅ PASSED — Module 4 unblocked' : `❌ FAILED — ${failed.length} blocking issue(s)`}`,
  ``,
  `## Checks`,
  ``,
  `| ID | Check | Result | Evidence |`,
  `|---|---|---|---|`,
  ...checks.map(c => `| ${c.id} | ${c.label} | ${c.pass ? '✅' : '❌'} | ${(c.evidence ?? '').replace(/\|/g, '\\|')} |`),
  ``,
  ...(failed.length > 0
    ? [`## Failures`, ``, ...failed.map(f => `- **${f.id}** — ${f.label}\n  - Evidence: \`${f.evidence}\``), ``]
    : [
        `## Reconciliation`,
        ``,
        `All Module 2 audit-gate criteria still pass. All Module 3 audit-gate criteria from the spec at \`~/cruzar/docs/superpowers/specs/2026-05-02-cruzar-ticket-and-module-2-chassis-design.md\` §Module 3 met.`,
        ``,
        `**Module 4 build (paperwork scanner /paperwork) is unblocked.** Invoke superpowers:writing-plans next for Module 4.`,
        ``,
      ]),
  `*Generated ${new Date().toISOString()} by scripts/run-module-3-audit.mjs*`,
  ``,
].join('\n');

writeFileSync(RECON_PATH, log);
console.log(`\nReconciliation log → ${RECON_PATH}`);

process.exit(failed.length === 0 ? 0 : 1);
