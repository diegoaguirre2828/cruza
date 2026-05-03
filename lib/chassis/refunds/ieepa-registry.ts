// lib/chassis/refunds/ieepa-registry.ts
import registry from '@/data/refunds/ieepa-chapter-99.json';

export interface IeepaEoEntry {
  eo_number: string;
  title: string;
  country_codes: string[];
  effective_from: string;
  effective_to: string;
  htsus_chapter_99_codes: string[];
  duty_rate_pct?: number;
  duty_rate_pct_default?: number;
  duty_rate_pct_by_country?: Record<string, number>;
}

export interface IeepaRegistry {
  version: string;
  source: string;
  scotus_invalidated_at: string;
  ieepa_collection_ended_at: string;
  executive_orders: IeepaEoEntry[];
  interest_rate_table_19_cfr_24_3a: Record<string, number>;
}

export function getIeepaRegistry(): IeepaRegistry {
  return registry as IeepaRegistry;
}

export function findApplicableEo(
  countryCode: string,
  entryDate: string,
  htsusCode: string,
): IeepaEoEntry | null {
  const reg = getIeepaRegistry();
  for (const eo of reg.executive_orders) {
    if (entryDate < eo.effective_from || entryDate > eo.effective_to) continue;
    const countryMatches = eo.country_codes.includes('*') || eo.country_codes.includes(countryCode);
    if (!countryMatches) continue;
    if (eo.htsus_chapter_99_codes.includes(htsusCode)) return eo;
  }
  return null;
}

export function getDutyRate(eo: IeepaEoEntry, countryCode: string): number {
  if (eo.duty_rate_pct !== undefined) return eo.duty_rate_pct;
  if (eo.duty_rate_pct_by_country?.[countryCode] !== undefined) {
    return eo.duty_rate_pct_by_country[countryCode];
  }
  return eo.duty_rate_pct_default ?? 0;
}
