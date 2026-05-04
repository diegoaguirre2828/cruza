// app/api/sample/ace-csv/route.ts
// Returns a synthetic ACE Entry Summary CSV for demos. Hits a realistic mix:
// - unliquidated entries (CAPE-eligible)
// - liquidated within 80 days (CAPE-eligible)
// - liquidated 81-180 days (Form 19 protest required)
// - liquidated >180 days (past window)
// - zero-duty entries (ineligible)
// - mix of HTSUS codes including Chapter 99 IEEPA + UFLPA priority sectors so
//   the cross-module hints fire when this CSV runs through /scan.
//
// Importer name = "ACME Sample Importer LLC" — clearly synthetic, never
// confused with a real importer. Entry numbers are 14-digit but start with
// '88' so they don't collide with any plausible real CBP entry.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 86400;  // cache 1 day — content static

interface SampleEntry {
  entry_number: string;
  entry_date: string;
  liquidation_date: string;
  liquidation_status: 'unliquidated' | 'liquidated';
  country_of_origin: string;
  htsus_codes: string;       // semicolon-separated for ACE export convention
  total_duty_paid_usd: number;
  total_dutiable_value_usd: number;
}

function todayMinusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildSampleEntries(): SampleEntry[] {
  return [
    // ── Unliquidated, IEEPA-paid — CAPE-eligible ──────────────────────────
    {
      entry_number: '88000000000001',
      entry_date: todayMinusDays(90),
      liquidation_date: '',
      liquidation_status: 'unliquidated',
      country_of_origin: 'CN',
      htsus_codes: '8536.41.0050;9903.01.25',
      total_duty_paid_usd: 32500,
      total_dutiable_value_usd: 130000,
    },
    {
      entry_number: '88000000000002',
      entry_date: todayMinusDays(75),
      liquidation_date: '',
      liquidation_status: 'unliquidated',
      country_of_origin: 'CN',
      htsus_codes: '8541.40.20;9903.01.25',
      total_duty_paid_usd: 47000,
      total_dutiable_value_usd: 188000,
    },
    {
      entry_number: '88000000000003',
      entry_date: todayMinusDays(60),
      liquidation_date: '',
      liquidation_status: 'unliquidated',
      country_of_origin: 'VN',
      htsus_codes: '6203.42.4011;9903.01.25',
      total_duty_paid_usd: 18750,
      total_dutiable_value_usd: 75000,
    },

    // ── Liquidated within 80 days — CAPE-eligible ─────────────────────────
    {
      entry_number: '88000000000004',
      entry_date: todayMinusDays(180),
      liquidation_date: todayMinusDays(45),
      liquidation_status: 'liquidated',
      country_of_origin: 'CN',
      htsus_codes: '7206.10.00;9903.01.25',
      total_duty_paid_usd: 12500,
      total_dutiable_value_usd: 50000,
    },
    {
      entry_number: '88000000000005',
      entry_date: todayMinusDays(200),
      liquidation_date: todayMinusDays(70),
      liquidation_status: 'liquidated',
      country_of_origin: 'CN',
      htsus_codes: '7308.90.9590;9903.01.25',
      total_duty_paid_usd: 8200,
      total_dutiable_value_usd: 32800,
    },

    // ── Liquidated 81-180 days — Form 19 protest required ────────────────
    {
      entry_number: '88000000000006',
      entry_date: todayMinusDays(280),
      liquidation_date: todayMinusDays(120),
      liquidation_status: 'liquidated',
      country_of_origin: 'CN',
      htsus_codes: '8517.62.0050;9903.01.25',
      total_duty_paid_usd: 24000,
      total_dutiable_value_usd: 96000,
    },
    {
      entry_number: '88000000000007',
      entry_date: todayMinusDays(310),
      liquidation_date: todayMinusDays(150),
      liquidation_status: 'liquidated',
      country_of_origin: 'CN',
      htsus_codes: '8471.30.0100;9903.01.25',
      total_duty_paid_usd: 11500,
      total_dutiable_value_usd: 46000,
    },

    // ── Liquidated >180 days — past window, ineligible ────────────────────
    {
      entry_number: '88000000000008',
      entry_date: todayMinusDays(380),
      liquidation_date: todayMinusDays(220),
      liquidation_status: 'liquidated',
      country_of_origin: 'CN',
      htsus_codes: '8708.29.50;9903.01.25',
      total_duty_paid_usd: 19500,
      total_dutiable_value_usd: 78000,
    },

    // ── Zero-duty entries — ineligible (USMCA originating, no IEEPA) ─────
    {
      entry_number: '88000000000009',
      entry_date: todayMinusDays(45),
      liquidation_date: '',
      liquidation_status: 'unliquidated',
      country_of_origin: 'MX',
      htsus_codes: '0807.11.00',
      total_duty_paid_usd: 0,
      total_dutiable_value_usd: 18500,
    },
    {
      entry_number: '88000000000010',
      entry_date: todayMinusDays(30),
      liquidation_date: '',
      liquidation_status: 'unliquidated',
      country_of_origin: 'MX',
      htsus_codes: '6403.59.6000',
      total_duty_paid_usd: 0,
      total_dutiable_value_usd: 24300,
    },
  ];
}

function escapeCsvField(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function entriesToCsv(entries: SampleEntry[]): string {
  const headers = [
    'entry_number',
    'entry_date',
    'liquidation_date',
    'liquidation_status',
    'country_of_origin',
    'htsus_codes',
    'total_duty_paid_usd',
    'total_dutiable_value_usd',
  ];
  const lines = [headers.join(',')];
  for (const e of entries) {
    lines.push([
      e.entry_number,
      e.entry_date,
      e.liquidation_date,
      e.liquidation_status,
      e.country_of_origin,
      escapeCsvField(e.htsus_codes),
      e.total_duty_paid_usd.toFixed(2),
      e.total_dutiable_value_usd.toFixed(2),
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const download = url.searchParams.get('download') !== 'false';
  const csv = entriesToCsv(buildSampleEntries());

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      ...(download
        ? { 'content-disposition': `attachment; filename="cruzar-sample-ace-entries.csv"` }
        : {}),
      'cache-control': 'public, max-age=3600',
    },
  });
}
