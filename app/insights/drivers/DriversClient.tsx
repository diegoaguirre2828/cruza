'use client';

import { useState } from 'react';

interface ManifestResponse {
  driver_ref: string;
  shipment_ref: string | null;
  checks_run: string[];
  usmca_annex_31a?: { compliant: string; reason: string; manifest_notes?: string[] };
  imss?: { compliant: string; reason: string; manifest_notes?: string[] };
  hos?: { compliant: string; reason: string; us_dot?: { within_11h_driving: boolean; cycle_reset_eligible?: boolean }; mx_sct?: { within_8h_driving: boolean }; divergence_flag?: boolean; manifest_notes?: string[] };
  drug_testing?: { compliant: string; reason: string; test_currency?: string; manifest_notes?: string[] };
  drayage_classification?: { compliant: string; reason: string; borello_score?: number; classification_recommendation?: string; paga_risk_estimate_usd?: number; manifest_notes?: string[] };
  overall_status: 'compliant' | 'non_compliant' | 'flagged' | 'inconclusive';
  blocking_issues: string[];
  disclaimer: string;
}

const STATUS_CLASSES: Record<string, string> = {
  compliant: 'bg-green-500/15 text-green-400 border-green-500/30',
  non_compliant: 'bg-red-500/15 text-red-400 border-red-500/30',
  flagged: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  inconclusive: 'bg-white/10 text-white/60 border-white/20',
};

export default function DriversClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ManifestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k)?.toString() ?? '';
    const checked = (k: string) => fd.get(k) === 'on';

    const drivingHours = parseFloat(get('driving_hours') || '0');
    const onDutyHours = parseFloat(get('on_duty_hours') || '0');
    const restHoursPrior = parseFloat(get('rest_hours_prior') || '0');
    const cycleHours = parseFloat(get('cycle_hours_last_7_or_8_days') || '0');
    const hasHosLog = !isNaN(drivingHours) && (drivingHours > 0 || onDutyHours > 0);

    const input = {
      driver: {
        driver_ref: get('driver_ref') || 'unknown',
        primary_jurisdiction: get('primary_jurisdiction') as 'US' | 'MX' | 'BOTH',
        cdl_class: get('cdl_class') as 'A' | 'B' | 'C' || undefined,
        imss_active: get('imss_active') === 'true' ? true : get('imss_active') === 'false' ? false : undefined,
        imss_last_payment_iso: get('imss_last_payment_iso') || undefined,
        last_drug_test_iso: get('last_drug_test_iso') || undefined,
        last_drug_test_jurisdiction: get('last_drug_test_jurisdiction') as 'US_DOT' | 'MX_SCT' | 'BOTH' || undefined,
        employment_classification: get('employment_classification') as 'W2' | '1099' || undefined,
        uses_own_truck: checked('uses_own_truck'),
        sets_own_schedule: checked('sets_own_schedule'),
        works_for_other_carriers: checked('works_for_other_carriers'),
        carries_independent_business_expenses: checked('carries_independent_business_expenses'),
        paid_per_mile: checked('paid_per_mile'),
        paid_hourly: checked('paid_hourly'),
        has_own_dot_authority: checked('has_own_dot_authority'),
      },
      shipment_ref: get('shipment_ref') || null,
      shipment_route: get('shipment_route') as 'US_only' | 'MX_only' | 'cross_border',
      facility_attestation_uploaded: checked('facility_attestation_uploaded'),
      ...(hasHosLog ? {
        hos_log: {
          date_iso: new Date().toISOString().slice(0, 10),
          driving_hours: drivingHours,
          on_duty_hours: onDutyHours,
          rest_hours_prior: restHoursPrior,
          cycle_hours_last_7_or_8_days: cycleHours,
        },
      } : {}),
    };

    try {
      const r = await fetch('/api/drivers/manifest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json() as ManifestResponse;
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-white/80">Driver / Operador</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs text-white/60">Driver ref</span>
              <input name="driver_ref" type="text" required disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Primary jurisdiction</span>
              <select name="primary_jurisdiction" required disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white">
                <option value="US">US</option>
                <option value="MX">MX</option>
                <option value="BOTH">BOTH</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-white/60">CDL class</span>
              <select name="cdl_class" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white">
                <option value="">--</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Employment classification</span>
              <select name="employment_classification" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white">
                <option value="">--</option><option value="W2">W2</option><option value="1099">1099</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-white/80">Shipment / Envio</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs text-white/60">Shipment ref</span>
              <input name="shipment_ref" type="text" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Route</span>
              <select name="shipment_route" required disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white">
                <option value="US_only">US only</option>
                <option value="MX_only">MX only</option>
                <option value="cross_border">Cross-border</option>
              </select>
            </label>
            <label className="md:col-span-2 inline-flex items-center gap-2">
              <input name="facility_attestation_uploaded" type="checkbox" disabled={busy} />
              <span className="text-sm">Facility attestation on file (USMCA Annex 31-A)</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-white/80">IMSS (MX-side)</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs text-white/60">IMSS active</span>
              <select name="imss_active" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white">
                <option value="">unknown</option><option value="true">yes</option><option value="false">no</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Last IMSS payment (date)</span>
              <input name="imss_last_payment_iso" type="date" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-white/80">Drug & Alcohol Test</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs text-white/60">Last drug test (date)</span>
              <input name="last_drug_test_iso" type="date" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Last test jurisdiction</span>
              <select name="last_drug_test_jurisdiction" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white">
                <option value="">--</option><option value="US_DOT">US DOT</option><option value="MX_SCT">MX SCT</option><option value="BOTH">BOTH</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-white/80">HOS Log (current duty period)</legend>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="block">
              <span className="text-xs text-white/60">Driving hrs</span>
              <input name="driving_hours" type="number" step="0.1" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">On-duty hrs</span>
              <input name="on_duty_hours" type="number" step="0.1" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Rest hrs prior</span>
              <input name="rest_hours_prior" type="number" step="0.1" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Cycle hrs (7/8d)</span>
              <input name="cycle_hours_last_7_or_8_days" type="number" step="0.1" disabled={busy} className="mt-1 block w-full rounded border border-white/10 bg-black/30 p-2 text-white" />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-white/80">Borello factors / Factores Borello</legend>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="inline-flex items-center gap-2"><input name="uses_own_truck" type="checkbox" disabled={busy} /><span className="text-sm">Uses own truck</span></label>
            <label className="inline-flex items-center gap-2"><input name="sets_own_schedule" type="checkbox" disabled={busy} /><span className="text-sm">Sets own schedule</span></label>
            <label className="inline-flex items-center gap-2"><input name="works_for_other_carriers" type="checkbox" disabled={busy} /><span className="text-sm">Works for other carriers</span></label>
            <label className="inline-flex items-center gap-2"><input name="carries_independent_business_expenses" type="checkbox" disabled={busy} /><span className="text-sm">Independent business expenses</span></label>
            <label className="inline-flex items-center gap-2"><input name="paid_per_mile" type="checkbox" disabled={busy} /><span className="text-sm">Paid per mile</span></label>
            <label className="inline-flex items-center gap-2"><input name="paid_hourly" type="checkbox" disabled={busy} /><span className="text-sm">Paid hourly</span></label>
            <label className="inline-flex items-center gap-2"><input name="has_own_dot_authority" type="checkbox" disabled={busy} /><span className="text-sm">Has own DOT authority</span></label>
          </div>
        </fieldset>

        <button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">
          {busy ? 'Running checks... / Ejecutando...' : 'Run compliance checks / Ejecutar verificaciones'}
        </button>
      </form>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {result && (
        <section className="mt-6 space-y-4">
          <header className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Overall / Estado General</h2>
              <span className={`rounded border px-3 py-1 text-sm font-medium ${STATUS_CLASSES[result.overall_status] ?? STATUS_CLASSES.inconclusive}`}>
                {result.overall_status}
              </span>
            </div>
            {result.blocking_issues.length > 0 && (
              <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3">
                <p className="font-semibold text-red-400">Blocking / Problemas:</p>
                <ul className="mt-2 list-disc pl-6 text-sm">
                  {result.blocking_issues.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
          </header>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <CheckCard title="USMCA Annex 31-A" data={result.usmca_annex_31a} />
            <CheckCard title="IMSS" data={result.imss} />
            <CheckCard title="HOS" data={result.hos} />
            <CheckCard title="Drug Testing" data={result.drug_testing} />
            <CheckCard title="Drayage Classification" data={result.drayage_classification} />
          </div>

          <p className="rounded border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            {result.disclaimer}
          </p>
        </section>
      )}
    </div>
  );
}

function CheckCard({ title, data }: { title: string; data?: { compliant: string; reason: string; manifest_notes?: string[] } }) {
  if (!data) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[data.compliant] ?? STATUS_CLASSES.inconclusive}`}>
          {data.compliant}
        </span>
      </div>
      <p className="mt-2 text-sm text-white/80">{data.reason}</p>
      {data.manifest_notes && data.manifest_notes.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-white/60">
          {data.manifest_notes.slice(0, 3).map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
