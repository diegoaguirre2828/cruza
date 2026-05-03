// lib/chassis/refunds/cape-validator.ts
// Local validation that mirrors CBP's known VAL-F (file-level fatal) /
// VAL-E (entry-level error) / VAL-I (entry-level info) rules. We can't
// hit CBP's actual validator, so we approximate the public rules.

import { CapeValidationError } from './types';

const ENTRY_NUMBER_PATTERN = /^[A-Z0-9]{14}$/;

export function validateCapeCsv(csv: string): { valid: boolean; errors: CapeValidationError[] } {
  const errors: CapeValidationError[] = [];
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length === 0) {
    errors.push({
      entry_number: '',
      rule_id: 'VAL-F-001',
      severity: 'fatal',
      message: 'CSV is empty',
    });
    return { valid: false, errors };
  }
  if (lines[0].trim() !== 'Entry Number') {
    errors.push({
      entry_number: '',
      rule_id: 'VAL-F-002',
      severity: 'fatal',
      message: `Header must be exactly "Entry Number"; got "${lines[0]}"`,
    });
  }
  if (lines.length === 1) {
    errors.push({
      entry_number: '',
      rule_id: 'VAL-F-003',
      severity: 'fatal',
      message: 'CSV has header only, no data rows',
    });
  }
  if (lines.length - 1 > 9999) {
    errors.push({
      entry_number: '',
      rule_id: 'VAL-F-004',
      severity: 'fatal',
      message: `${lines.length - 1} entries exceeds 9,999 per Declaration`,
    });
  }

  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const entryNumber = lines[i].trim();
    if (!ENTRY_NUMBER_PATTERN.test(entryNumber)) {
      errors.push({
        entry_number: entryNumber,
        rule_id: 'VAL-E-014',
        severity: 'error',
        message: `Entry number must be 14 alphanumeric characters; got "${entryNumber}"`,
      });
    }
    if (seen.has(entryNumber)) {
      errors.push({
        entry_number: entryNumber,
        rule_id: 'VAL-E-022',
        severity: 'error',
        message: `Duplicate entry number "${entryNumber}" within CSV`,
      });
    }
    seen.add(entryNumber);
    if (lines[i].includes(',')) {
      errors.push({
        entry_number: entryNumber,
        rule_id: 'VAL-F-005',
        severity: 'fatal',
        message: `Row ${i + 1} contains commas — CAPE template requires only entry numbers, no extra columns`,
      });
    }
  }

  const fatal = errors.some(e => e.severity === 'fatal' || e.severity === 'error');
  return { valid: !fatal, errors };
}
