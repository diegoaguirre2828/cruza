import { Entry, DutyLine, LiquidationStatus } from './types';

const HEADER_ALIASES: Record<string, string> = {
  'entry number': 'entry_number',
  'entry_num': 'entry_number',
  'entry no': 'entry_number',
  'entry date': 'entry_date',
  'ent_dt': 'entry_date',
  'liquidation date': 'liquidation_date',
  'liq_dt': 'liquidation_date',
  'liquidation status': 'liquidation_status',
  'liq_stat': 'liquidation_status',
  'country of origin': 'country_of_origin',
  'coo': 'country_of_origin',
  'htsus': 'htsus_codes',
  'hts_codes': 'htsus_codes',
  'duty amount usd': 'total_duty_paid_usd',
  'duty_usd': 'total_duty_paid_usd',
  'dutiable value usd': 'total_dutiable_value_usd',
  'value_usd': 'total_dutiable_value_usd',
};

function normalizeHeader(h: string): string {
  return HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase();
}

function parseLiquidationStatus(s: string): LiquidationStatus {
  const v = s.trim().toLowerCase();
  if (v === 'liquidated' || v === 'liq') return 'liquidated';
  if (v === 'unliquidated' || v === 'unliq' || v === '') return 'unliquidated';
  if (v === 'extended') return 'extended';
  if (v === 'suspended') return 'suspended';
  if (v === 'final') return 'final';
  return 'unliquidated';
}

export function parseAceCsv(csvContent: string): { entries: Entry[]; errors: string[] } {
  const errors: string[] = [];
  const entries: Entry[] = [];
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    return { entries: [], errors: ['CSV has no data rows'] };
  }
  const headers = lines[0].split(',').map(normalizeHeader);
  const required = ['entry_number', 'entry_date', 'country_of_origin', 'htsus_codes', 'total_duty_paid_usd'];
  for (const r of required) {
    if (!headers.includes(r)) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length > 0) return { entries: [], errors };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? '').trim(); });

    const htsCodes = (row.htsus_codes ?? '').split(/[;|]/).map(c => c.trim()).filter(Boolean);
    const totalDuty = parseFloat(row.total_duty_paid_usd ?? '0');
    const dutyLines: DutyLine[] = htsCodes.map(code => ({
      htsus_code: code,
      rate_pct: null,
      amount_usd: htsCodes.length === 1 ? totalDuty : 0,
      is_chapter_99: code.startsWith('9903.'),
    }));

    entries.push({
      entry_number: row.entry_number,
      entry_date: row.entry_date,
      liquidation_date: row.liquidation_date || null,
      liquidation_status: parseLiquidationStatus(row.liquidation_status ?? ''),
      country_of_origin: row.country_of_origin.toUpperCase(),
      htsus_codes: htsCodes,
      duty_lines: dutyLines,
      total_duty_paid_usd: totalDuty,
      total_dutiable_value_usd: parseFloat(row.total_dutiable_value_usd ?? '0'),
    });
  }
  return { entries, errors };
}
