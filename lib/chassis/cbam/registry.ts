// lib/chassis/cbam/registry.ts — CBAM 2026 statutory parameters + default emission factors
// Sources:
//   - Regulation (EU) 2023/956
//   - Implementing Regulation 2025/486 (default values + verifier accreditation)
//   - EU ETS auction average for reference (volatile; production should refresh monthly)
import { CbamRegistry, CbamGoodCategory } from './types';

const DEFAULT_FACTORS: CbamRegistry['default_factors_t_co2_per_t'] = {
  // Conservative default values per Annex IV — used when actual verified data isn't available.
  cement:        { direct: 0.766, indirect: 0.014 },
  iron_steel:    { direct: 1.880, indirect: 0.165 },
  aluminum:      { direct: 1.620, indirect: 8.520 },  // primary alu electrolysis is electricity-heavy
  fertilizers:   { direct: 1.620, indirect: 0.300 },
  electricity:   { direct: 0.000, indirect: 0.475 },  // grid avg t CO2e per MWh — treat as direct = 0, embedded = 0.475 per tonne-equiv
  hydrogen:      { direct: 8.900, indirect: 1.200 },
  out_of_scope:  { direct: 0,     indirect: 0 },
};

// Combined Nomenclature → CBAM category mapping (sample — Annex I full list is ~700 codes).
// CN codes match by 4 or 6-digit prefix in the lookup, falling back to out_of_scope.
const CN_PREFIXES: Array<[string, CbamGoodCategory]> = [
  // Cement (Chapter 25)
  ['2523',     'cement'],
  // Iron and steel (Chapter 72-73)
  ['72',       'iron_steel'],
  ['7301',     'iron_steel'],
  ['7302',     'iron_steel'],
  ['7303',     'iron_steel'],
  ['7304',     'iron_steel'],
  ['7305',     'iron_steel'],
  ['7306',     'iron_steel'],
  ['7307',     'iron_steel'],
  ['7308',     'iron_steel'],
  ['7309',     'iron_steel'],
  ['7310',     'iron_steel'],
  ['7311',     'iron_steel'],
  ['7318',     'iron_steel'],
  ['7326',     'iron_steel'],
  // Aluminum (Chapter 76)
  ['76',       'aluminum'],
  // Fertilizers (Chapter 28-31)
  ['2808',     'fertilizers'],
  ['2814',     'fertilizers'],
  ['2834',     'fertilizers'],
  ['3102',     'fertilizers'],
  ['3105',     'fertilizers'],
  // Electricity
  ['2716',     'electricity'],
  // Hydrogen
  ['2804',     'hydrogen'],
];

function categoryForCn(cn: string): CbamGoodCategory {
  const clean = cn.replace(/\D/g, '');
  for (const [prefix, cat] of CN_PREFIXES) {
    if (clean.startsWith(prefix)) return cat;
  }
  return 'out_of_scope';
}

const CN_LOOKUP_CACHE = new Map<string, CbamGoodCategory>();

const REGISTRY: CbamRegistry = {
  version: '2026-05-04',
  phase: 'definitive',                       // definitive phase began 2026-01-01
  ets_reference_price_eur_per_t: 78.50,      // EU ETS auction reference price (volatile — refresh monthly)
  default_factors_t_co2_per_t: DEFAULT_FACTORS,
  cn_code_to_category: {},                   // computed lazily via classifyCn() below
  references: {
    regulation: 'Regulation (EU) 2023/956',
    implementing_regulation: 'Implementing Regulation (EU) 2025/486',
    transitional_start: '2023-10-01',
    definitive_start: '2026-01-01',
  },
};

export function getCbamRegistry(): CbamRegistry {
  return REGISTRY;
}

export function classifyCn(cn: string): CbamGoodCategory {
  const cached = CN_LOOKUP_CACHE.get(cn);
  if (cached) return cached;
  const cat = categoryForCn(cn);
  CN_LOOKUP_CACHE.set(cn, cat);
  return cat;
}
