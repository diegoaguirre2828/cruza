// lib/chassis/screening/types.ts — Module 9 Restricted Party Screening

export type ScreeningSource = 'ofac_sdn';

export interface ScreeningHit {
  source: ScreeningSource;
  name_match: string;          // canonicalized name we matched on
  match_score: number;          // 0..1 — token overlap normalized
  list_entry_uid: string;       // SDN UID
  list_entry_program: string;   // SDN program(s) e.g. "SDGT,IRAN"
  list_entry_type: string;      // 'individual' | 'entity' | 'vessel' | 'aircraft'
  remarks?: string;
}

export interface ScreeningResult {
  screened_at: string;          // ISO 8601
  source: ScreeningSource;
  list_version: string;         // SDN list date / version we used
  query: { name: string; id_number?: string };
  hits: ScreeningHit[];
  blocked: boolean;             // true if any hit at threshold or above
  threshold: number;            // match_score threshold (default 0.85)
}
