// lib/chassis/customs/hs-classifier.ts
// Deterministic chapter-bucket + heuristic disambiguation.
// LLM-assisted classification deferred to v2.

import type { HsClassificationResult, ConfidenceScore } from './types';

interface ChapterRule {
  chapter: string;             // 2-digit
  description: string;
  keywords: string[];
  default_hts_10: string;
  gri_path: string;
}

const CHAPTER_RULES: ChapterRule[] = [
  // Produce / agriculture
  { chapter: '07', description: 'Edible vegetables', keywords: ['tomato','tomatoes','vegetable','onion','potato','lettuce','pepper','cucumber','carrot'], default_hts_10: '0702.00.20', gri_path: 'GRI 1 → Heading 0702 (tomatoes) by literal heading text' },
  { chapter: '08', description: 'Edible fruit and nuts', keywords: ['avocado','mango','lime','lemon','orange','apple','grape','banana','pineapple','strawberry','strawberries'], default_hts_10: '0804.40.00', gri_path: 'GRI 1 → Heading 0804 (fruits) by literal heading text' },
  // Medical
  { chapter: '90', description: 'Optical, photographic, medical instruments', keywords: ['catheter','stent','syringe','dialyzer','endoscope','medical device','surgical','orthopedic','sensor'], default_hts_10: '9018.39.00', gri_path: 'GRI 1 → Heading 9018 (medical instruments)' },
  // Pharmaceuticals (medical-grade gauze etc.)
  { chapter: '30', description: 'Pharmaceutical products', keywords: ['gauze','bandage','wound','pharmaceutical','medicament'], default_hts_10: '3005.90.50', gri_path: 'GRI 1 → Heading 3005 (medical dressings)' },
  // Automotive
  { chapter: '87', description: 'Vehicles other than railway', keywords: ['brake','transmission','bumper','airbag','automotive','vehicle part','wheel','catalytic','door panel'], default_hts_10: '8708.30.50', gri_path: 'GRI 1 → Heading 8708 (vehicle parts)' },
  // Engines (chapter 84)
  { chapter: '84', description: 'Machinery and mechanical appliances', keywords: ['engine block','engine','machinery','pump','compressor'], default_hts_10: '8409.91.50', gri_path: 'GRI 1 → Chapter 84 (machinery)' },
  // Tires + rubber gloves (chapter 40)
  { chapter: '40', description: 'Rubber and articles thereof', keywords: ['tire','tyre','rubber tire','latex glove','surgical gloves','surgical gloves, sterile','latex-free'], default_hts_10: '4011.10.10', gri_path: 'GRI 1 → Chapter 40 (rubber)' },
  // Knit apparel
  { chapter: '61', description: 'Apparel knit', keywords: ['t-shirt','tshirt','sweater','knit','jersey','polo','hoodie'], default_hts_10: '6109.10.00', gri_path: 'GRI 1 → Heading 6109 (T-shirts, knit)' },
  // Knit fabric
  { chapter: '60', description: 'Knitted or crocheted fabrics', keywords: ['knit fabric','knit jersey fabric','jersey fabric','crocheted fabric','fabric'], default_hts_10: '6004.10.00', gri_path: 'GRI 1 → Chapter 60 (knit fabrics)' },
  // Woven apparel
  { chapter: '62', description: 'Apparel woven', keywords: ['shirt','blouse','dress','suit','jacket','trousers','pants','jeans','denim'], default_hts_10: '6203.42.40', gri_path: 'GRI 1 → Heading 6203 (men\'s suits, woven)' },
  // Footwear
  { chapter: '64', description: 'Footwear', keywords: ['shoe','boot','sandal','sneaker','footwear'], default_hts_10: '6403.99.60', gri_path: 'GRI 1 → Chapter 64 (footwear)' },
  // Plastics
  { chapter: '39', description: 'Plastics', keywords: ['plastic','polymer','resin','polyethylene','polypropylene','pvc','polycarbonate','pipe'], default_hts_10: '3920.42.00', gri_path: 'GRI 1 → Chapter 39 (plastics)' },
  // Steel
  { chapter: '72', description: 'Iron and steel', keywords: ['steel','iron','billet','sheet metal','rebar'], default_hts_10: '7208.51.00', gri_path: 'GRI 1 → Chapter 72 (iron and steel)' },
  // Iron / steel articles
  { chapter: '73', description: 'Articles of iron or steel', keywords: ['pipe fittings','iron pipe','steel pipe','steel article'], default_hts_10: '7307.92.30', gri_path: 'GRI 1 → Chapter 73 (articles of iron/steel)' },
  // Electronics
  { chapter: '85', description: 'Electrical machinery', keywords: ['battery','capacitor','semiconductor','chip','wire harness','cable assembly','electrical'], default_hts_10: '8542.31.00', gri_path: 'GRI 1 → Chapter 85 (electrical machinery)' },
];

function scoreChapter(description: string, rule: ChapterRule): number {
  const desc = description.toLowerCase();
  let hits = 0;
  for (const kw of rule.keywords) {
    if (desc.includes(kw.toLowerCase())) hits++;
  }
  return hits;
}

export function classifyHs(input: { product_description: string; declared_hs10?: string }): HsClassificationResult {
  // If broker declared an HTS, validate and accept
  if (input.declared_hs10 && /^\d{4}\.\d{2}\.\d{2,4}$/.test(input.declared_hs10)) {
    const hts_10 = input.declared_hs10.replace(/\./g, '').padEnd(10, '0');
    return {
      hts_10: `${hts_10.slice(0,4)}.${hts_10.slice(4,6)}.${hts_10.slice(6,10)}`,
      hs_6: hts_10.slice(0, 6),
      description: input.product_description,
      gri_path: 'Broker-declared HTS accepted (no chassis override)',
      gri_rules_applied: ['1'],
      alternatives_considered: [],
      cbp_cross_refs: [],
      confidence: 0.85,
    };
  }

  // Score every chapter rule, pick the best
  const scores = CHAPTER_RULES.map(r => ({ rule: r, score: scoreChapter(input.product_description, r) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return {
      hts_10: '9999.99.99',
      hs_6: '999999',
      description: input.product_description,
      gri_path: 'GRI 4 — no analogous heading matched on keyword scan; defaulting to "other" pending broker review',
      gri_rules_applied: ['4'],
      alternatives_considered: [],
      cbp_cross_refs: [],
      confidence: 0.10,
    };
  }

  const winner = scores[0].rule;
  const alts = scores.slice(1, 3).map(s => ({
    hts_10: s.rule.default_hts_10,
    rejected_because: `lower keyword score (${s.score} vs ${scores[0].score})`,
  }));
  const confidence: ConfidenceScore = scores[0].score >= 2 ? 0.85 : scores[0].score === 1 ? 0.65 : 0.40;

  return {
    hts_10: winner.default_hts_10,
    hs_6: winner.default_hts_10.replace(/\./g, '').slice(0, 6),
    description: input.product_description,
    gri_path: winner.gri_path,
    gri_rules_applied: ['1'],
    alternatives_considered: alts,
    cbp_cross_refs: [],
    confidence,
  };
}
