// lib/chassis/uflpa/registry.ts
import { UflpaRegistry } from './types';

const REGISTRY: UflpaRegistry = {
  version: '2026-05-04',
  effective_date: '2022-06-21',
  enforcement_agency: 'U.S. Customs and Border Protection',
  htsus_high_risk_chapter_prefixes: [
    // Cotton + apparel (Chapters 50-63 textile)
    { prefix: '52',   sector: 'cotton_apparel',           reason: 'Cotton; CBP UFLPA priority sector' },
    { prefix: '5208', sector: 'cotton_apparel',           reason: 'Cotton woven fabric — priority' },
    { prefix: '61',   sector: 'cotton_apparel',           reason: 'Knit apparel; cotton check applies' },
    { prefix: '62',   sector: 'cotton_apparel',           reason: 'Woven apparel; cotton check applies' },
    // Polysilicon + solar (HS 2804.61, 8541)
    { prefix: '2804', sector: 'polysilicon_solar',        reason: 'Polysilicon; CBP UFLPA priority sector' },
    { prefix: '8541', sector: 'polysilicon_solar',        reason: 'Photovoltaic cells; downstream of polysilicon' },
    // Tomatoes + processed food (HS 0702, 2002)
    { prefix: '0702', sector: 'tomatoes_food',            reason: 'Fresh tomatoes; CBP UFLPA priority sector' },
    { prefix: '2002', sector: 'tomatoes_food',            reason: 'Processed tomato products' },
    // Electronics + semiconductors (HS 8471, 8517, 8542)
    { prefix: '8471', sector: 'electronics_semiconductors', reason: 'ADP machines; flagged for forced-labor scrutiny' },
    { prefix: '8517', sector: 'electronics_semiconductors', reason: 'Telecom equipment; flagged' },
    { prefix: '8542', sector: 'electronics_semiconductors', reason: 'Integrated circuits' },
    // Automotive parts (HS 8708)
    { prefix: '8708', sector: 'automotive_parts',         reason: 'Vehicle parts — Xinjiang aluminum routing concern' },
    // Lithium batteries (HS 8507)
    { prefix: '8507', sector: 'lithium_batteries',        reason: 'Lithium batteries' },
    // Aluminum (HS 76) — also CBAM sector
    { prefix: '76',   sector: 'aluminum',                 reason: 'Aluminum; UFLPA Xinjiang risk' },
    // PVC chemicals (HS 3904)
    { prefix: '3904', sector: 'pvc_chemicals',            reason: 'PVC polymers' },
    // Rubber (HS 4002)
    { prefix: '4002', sector: 'rubber',                   reason: 'Synthetic rubber' },
  ],
  sample_entity_list: [
    { name: 'Xinjiang Production and Construction Corps', aliases: ['XPCC', 'Xinjiang Bingtuan'] },
    { name: 'Hetian Taida Apparel', aliases: ['Hetian Taida'] },
    { name: 'Xinjiang Junggar Cotton and Linen', aliases: ['Junggar Cotton'] },
    { name: 'Hoshine Silicon Industry', aliases: ['Hoshine'] },
    { name: 'Xinjiang Daqo New Energy', aliases: ['Daqo Xinjiang'] },
    { name: 'Xinjiang GCL New Energy', aliases: ['GCL Xinjiang'] },
    { name: 'Camel Group', aliases: [] },
    { name: 'Nuo Mining', aliases: [] },
    { name: 'Xinjiang East Hope', aliases: ['East Hope Aluminum'] },
  ],
};

export function getUflpaRegistry(): UflpaRegistry {
  return REGISTRY;
}
