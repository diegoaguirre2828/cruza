// lib/chassis/customs/ligie-flag.ts
import type { LigieFlagResult, BomLineItem } from './types';
import ligieTable from '../../../data/customs/ligie-table.json';

interface LigieEntry {
  tariff_line: string;
  rate_pct: number;
  sector: string;
}

interface LigieData {
  source: string;
  effective: string;
  version: string;
  non_fta_origins: string[];
  entries: LigieEntry[];
}

const TABLE = ligieTable as LigieData;
const ORIGIN_SET = new Set(TABLE.non_fta_origins);
const ENTRY_BY_LINE = new Map(TABLE.entries.map(e => [e.tariff_line, e]));

/**
 * Check whether a BOM line triggers the LIGIE 2026 surcharge.
 * Match logic: BOM origin must be non-FTA AND tariff_line must be in the LIGIE table.
 *
 * For shipments where BOM components are HS-6 only, we match by HS-6 prefix
 * against the 8-digit Mexican TIGIE line (best-effort; broker confirms).
 */
export function checkLigieForBomLine(line: BomLineItem): LigieFlagResult {
  if (!ORIGIN_SET.has(line.origin_country)) {
    return {
      affected: false,
      tariff_line: null,
      rate_pct: null,
      origin_blocked: null,
      source_ref: 'DOF-5777376',
    };
  }

  const hs6 = line.hs6.padStart(6, '0');
  // Best-effort 8-digit match: try exact 8-digit first (BOM rarely has it),
  // then HS-6 prefix scan
  const exact = ENTRY_BY_LINE.get(hs6.padEnd(8, '0'));
  let matched: LigieEntry | undefined = exact;
  if (!matched) {
    matched = TABLE.entries.find(e => e.tariff_line.startsWith(hs6));
  }

  if (!matched) {
    return {
      affected: false,
      tariff_line: null,
      rate_pct: null,
      origin_blocked: null,
      source_ref: 'DOF-5777376',
    };
  }

  return {
    affected: true,
    tariff_line: matched.tariff_line,
    rate_pct: matched.rate_pct,
    origin_blocked: line.origin_country,
    source_ref: 'DOF-5777376',
  };
}

/**
 * Check the worst-case LIGIE exposure across the full BOM.
 * Returns the highest LIGIE rate found (or unaffected).
 */
export function checkLigieForShipment(bom: BomLineItem[]): LigieFlagResult {
  let worst: LigieFlagResult = {
    affected: false,
    tariff_line: null,
    rate_pct: null,
    origin_blocked: null,
    source_ref: 'DOF-5777376',
  };
  for (const line of bom) {
    const result = checkLigieForBomLine(line);
    if (result.affected && (!worst.affected || (result.rate_pct ?? 0) > (worst.rate_pct ?? 0))) {
      worst = result;
    }
  }
  return worst;
}

export function ligieTableMetadata() {
  return {
    source: TABLE.source,
    effective: TABLE.effective,
    version: TABLE.version,
    entries_count: TABLE.entries.length,
  };
}
