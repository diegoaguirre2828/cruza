// lib/chassis/screening/ofac-sdn.ts
// OFAC Specially Designated Nationals (SDN) list screening.
// Source: https://www.treasury.gov/ofac/downloads/sdn.csv (public, free, US Treasury).
// Updated daily. We cache an in-memory snapshot per process; production should
// refresh via cron daily and persist to KV.
//
// IMPORTANT: This is a baseline check. A full M9 RPS implementation would also
// screen against:
//   - OFAC consolidated non-SDN (CMIC, FSE, NS-PLC, etc.) — also free
//   - Bureau of Industry and Security Entity List (Commerce)
//   - State Dept Debarred Parties
//   - EU Consolidated Sanctions
//   - UK OFSI Consolidated List
//   - UN Consolidated Sanctions
// Ship SDN first; expand list coverage in subsequent releases.

import type { ScreeningHit, ScreeningResult } from './types';

interface SdnEntry {
  uid: string;            // sdn.csv field 1
  name: string;           // field 2 (LAST, FIRST or entity name)
  type: string;           // field 3 (individual / entity / vessel / aircraft)
  program: string;        // field 4 (SDGT,IRAN,etc)
  remarks: string;        // field 12
}

const TREASURY_SDN_URL = 'https://www.treasury.gov/ofac/downloads/sdn.csv';
const DEFAULT_MATCH_THRESHOLD = 0.85;

let cachedSnapshot: { entries: SdnEntry[]; fetchedAt: string; sourceUrl: string } | null = null;

/**
 * Parse a single SDN CSV line. Treasury's CSV uses quote-escaped fields with
 * embedded commas. We do a small state machine instead of pulling in csv-parse.
 */
function parseSdnLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export async function loadSdnSnapshot(opts: { force?: boolean; csvText?: string } = {}): Promise<{ entries: SdnEntry[]; fetchedAt: string; sourceUrl: string }> {
  if (cachedSnapshot && !opts.force && !opts.csvText) return cachedSnapshot;

  let csv: string;
  if (opts.csvText !== undefined) {
    csv = opts.csvText;
  } else {
    const res = await fetch(TREASURY_SDN_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`SDN fetch failed: HTTP ${res.status}`);
    csv = await res.text();
  }

  const entries: SdnEntry[] = [];
  for (const rawLine of csv.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const fields = parseSdnLine(rawLine);
    if (fields.length < 5) continue;
    entries.push({
      uid: (fields[0] ?? '').trim(),
      name: (fields[1] ?? '').replace(/^"|"$/g, '').trim(),
      type: (fields[2] ?? '').trim(),
      program: (fields[3] ?? '').replace(/^"|"$/g, '').trim(),
      remarks: (fields[11] ?? '').replace(/^"|"$/g, '').trim(),
    });
  }

  const snapshot = {
    entries,
    fetchedAt: new Date().toISOString(),
    sourceUrl: opts.csvText !== undefined ? 'inline' : TREASURY_SDN_URL,
  };
  if (opts.csvText === undefined) cachedSnapshot = snapshot;
  return snapshot;
}

// Connector words + corporate suffixes that should NOT drive match scores.
// Sanctioned-entity names are full of corporate filler ("INC", "LLC", "SA DE CV", etc.)
// that distorts Jaccard similarity. Strip them so the substantive terms drive matching.
const NAME_STOPWORDS = new Set([
  // English corporate
  'INC', 'LLC', 'LTD', 'CO', 'COMPANY', 'CORP', 'CORPORATION', 'GROUP',
  'HOLDINGS', 'ENTERPRISES', 'INDUSTRIES', 'INTERNATIONAL', 'INTL',
  // Spanish/MX corporate
  'SA', 'CV', 'SADECV', 'SOCIEDAD', 'ANONIMA', 'SRL', 'RL', 'COOPERATIVA',
  'COMERCIAL', 'COMERCIO',
  // Connectors EN
  'THE', 'OF', 'FOR', 'AND',
  // Connectors ES
  'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y',
  // Connectors FR/AR/IR common in OFAC list
  'LE', 'AL', 'BIN',
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !NAME_STOPWORDS.has(t)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union > 0 ? intersect / union : 0;
}

export interface ScreenInput {
  name: string;
  id_number?: string;
  threshold?: number;
  snapshot?: { entries: SdnEntry[]; fetchedAt: string; sourceUrl: string };
}

export async function screenAgainstSdn(input: ScreenInput): Promise<ScreeningResult> {
  const threshold = input.threshold ?? DEFAULT_MATCH_THRESHOLD;
  const snapshot = input.snapshot ?? (await loadSdnSnapshot());
  const queryTokens = tokenize(input.name);

  const hits: ScreeningHit[] = [];
  for (const entry of snapshot.entries) {
    const entryTokens = tokenize(entry.name);
    const score = jaccardSimilarity(queryTokens, entryTokens);
    if (score >= threshold) {
      hits.push({
        source: 'ofac_sdn',
        name_match: entry.name,
        match_score: Math.round(score * 1000) / 1000,
        list_entry_uid: entry.uid,
        list_entry_program: entry.program,
        list_entry_type: entry.type || 'unknown',
        remarks: entry.remarks || undefined,
      });
    }
  }

  hits.sort((a, b) => b.match_score - a.match_score);

  return {
    screened_at: new Date().toISOString(),
    source: 'ofac_sdn',
    list_version: snapshot.fetchedAt,
    query: { name: input.name, id_number: input.id_number },
    hits,
    blocked: hits.length > 0,
    threshold,
  };
}
