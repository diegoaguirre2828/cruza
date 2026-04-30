"use client";

// /dispatch/paperwork/usmca — USMCA Certificate of Origin generator.
//
// USMCA Article 5.2 prescribes 9 data elements but NO prescribed form. The
// certification can be on the invoice, a separate statement, or any document
// the importer/exporter/producer creates — as long as the 9 elements are
// present and the certifier signs.
//
// v0 captures the 9 elements + renders a formatted certificate the user can
// print (Cmd/Ctrl-P) or copy. State persists to localStorage so dispatcher
// can return mid-load.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cruzar.dispatch.paperwork.usmca.v1";

type CertifierRole = "importer" | "exporter" | "producer";
type OriginCriterion = "A" | "B" | "C" | "D";

interface UsmcaForm {
  // Element 1
  certifier_role: CertifierRole;

  // Element 2 — Certifier
  certifier_name: string;
  certifier_company: string;
  certifier_address: string;
  certifier_phone: string;
  certifier_email: string;
  certifier_tax_id: string;

  // Element 3 — Exporter (if different from certifier)
  exporter_same: boolean;
  exporter_name: string;
  exporter_address: string;
  exporter_tax_id: string;

  // Element 4 — Producer (if different)
  producer_same: boolean;
  producer_unknown: boolean;
  producer_name: string;
  producer_address: string;
  producer_tax_id: string;

  // Element 5 — Importer
  importer_name: string;
  importer_address: string;
  importer_tax_id: string;

  // Element 6 — Description + HS classification (per line)
  goods: Array<{ description: string; hs_subheading: string; origin_criterion: OriginCriterion }>;

  // Element 8 — Blanket period (optional, ≤12 months)
  blanket_period: boolean;
  blanket_from: string;
  blanket_to: string;

  // Element 9 — Signature
  signer_name: string;
  signer_title: string;
  signed_date: string; // ISO date
}

const DEFAULT_FORM: UsmcaForm = {
  certifier_role: "exporter",
  certifier_name: "",
  certifier_company: "",
  certifier_address: "",
  certifier_phone: "",
  certifier_email: "",
  certifier_tax_id: "",
  exporter_same: true,
  exporter_name: "",
  exporter_address: "",
  exporter_tax_id: "",
  producer_same: false,
  producer_unknown: false,
  producer_name: "",
  producer_address: "",
  producer_tax_id: "",
  importer_name: "",
  importer_address: "",
  importer_tax_id: "",
  goods: [{ description: "", hs_subheading: "", origin_criterion: "B" }],
  blanket_period: false,
  blanket_from: "",
  blanket_to: "",
  signer_name: "",
  signer_title: "",
  signed_date: new Date().toISOString().slice(0, 10),
};

const CRITERION_LABEL: Record<OriginCriterion, string> = {
  A: "A — Wholly obtained or produced entirely in the territory of one or more USMCA parties",
  B: "B — Produced entirely using non-originating materials, but the goods satisfy the product-specific rules of origin in Annex 4-B",
  C: "C — Produced entirely in the territory exclusively from originating materials",
  D: "D — Produced in the territory but does NOT qualify as originating (used to track non-qualifying components in mixed shipments)",
};

function loadForm(): UsmcaForm {
  if (typeof window === "undefined") return DEFAULT_FORM;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FORM;
    return { ...DEFAULT_FORM, ...JSON.parse(raw) } as UsmcaForm;
  } catch {
    return DEFAULT_FORM;
  }
}

export default function UsmcaGenerator() {
  const [form, setForm] = useState<UsmcaForm>(DEFAULT_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<"input" | "preview">("input");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm(loadForm());
    setHydrated(true);
  }, []);

  // Persist on every change after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* quota — silent */
    }
  }, [form, hydrated]);

  function update<K extends keyof UsmcaForm>(k: K, v: UsmcaForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updateGood(idx: number, patch: Partial<UsmcaForm["goods"][0]>) {
    setForm((f) => ({
      ...f,
      goods: f.goods.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }));
  }
  function addGoodRow() {
    setForm((f) => ({
      ...f,
      goods: [...f.goods, { description: "", hs_subheading: "", origin_criterion: "B" }],
    }));
  }
  function removeGoodRow(idx: number) {
    setForm((f) => ({
      ...f,
      goods: f.goods.length > 1 ? f.goods.filter((_, i) => i !== idx) : f.goods,
    }));
  }

  function reset() {
    if (!confirm("Clear the form and start over?")) return;
    setForm(DEFAULT_FORM);
    setStep("input");
  }

  function copyCertText() {
    if (!printRef.current) return;
    const text = printRef.current.innerText;
    navigator.clipboard?.writeText(text);
  }

  // Validation — required fields per Article 5.2
  const errors: string[] = [];
  if (!form.certifier_name) errors.push("Certifier name");
  if (!form.certifier_address) errors.push("Certifier address");
  if (!form.certifier_email && !form.certifier_phone) errors.push("Certifier email or phone");
  if (!form.importer_name) errors.push("Importer name");
  if (!form.importer_address) errors.push("Importer address");
  if (form.goods.length === 0 || form.goods.every((g) => !g.description)) errors.push("At least one good with description + HS code");
  for (const g of form.goods) {
    if (g.description && !/^\d{4}\.\d{2}$/.test(g.hs_subheading) && g.hs_subheading.replace(/[.\s]/g, "").length !== 6) {
      errors.push(`HS subheading must be 6 digits (e.g. 8471.30) — got "${g.hs_subheading}" for "${g.description.slice(0, 30)}"`);
    }
  }
  if (!form.signer_name) errors.push("Signer name");
  if (!form.signer_title) errors.push("Signer title");

  if (!hydrated) {
    return <main className="mx-auto max-w-[920px] px-5 py-6 text-white/45">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-[920px] px-5 sm:px-8 py-6">
      {/* Header + back */}
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[1.4rem] font-semibold text-white">
            USMCA Certificate of Origin
          </h1>
          <p className="mt-1 text-[12.5px] text-white/55">
            9 data elements per USMCA Article 5.2. We pre-fill, you verify, you sign.
          </p>
        </div>
        <Link
          href="/dispatch/paperwork"
          className="text-[11.5px] text-white/45 hover:text-white"
        >
          ← All forms
        </Link>
      </div>

      {/* Step toggle */}
      <div className="mb-5 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 text-[12px]">
        <button
          onClick={() => setStep("input")}
          className={`rounded-lg px-4 py-1.5 ${
            step === "input"
              ? "bg-amber-400 text-[#0a1020] font-semibold"
              : "text-white/55 hover:text-white"
          }`}
        >
          1. Fill
        </button>
        <button
          onClick={() => setStep("preview")}
          disabled={errors.length > 0}
          className={`rounded-lg px-4 py-1.5 ${
            step === "preview"
              ? "bg-amber-400 text-[#0a1020] font-semibold"
              : errors.length > 0
                ? "text-white/25 cursor-not-allowed"
                : "text-white/55 hover:text-white"
          }`}
        >
          2. Preview & sign
        </button>
      </div>

      {step === "input" && (
        <>
          <Section num="1" title="Certifier role">
            <div className="flex flex-wrap gap-2">
              {(["importer", "exporter", "producer"] as CertifierRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => update("certifier_role", r)}
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] capitalize ${
                    form.certifier_role === r
                      ? "border-amber-300/40 bg-amber-300/[0.06] text-amber-200"
                      : "border-white/[0.1] text-white/65 hover:bg-white/[0.04]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Section>

          <Section num="2" title="Certifier (the entity signing this certificate)">
            <Field label="Name (signing person)" v={form.certifier_name} on={(v) => update("certifier_name", v)} />
            <Field label="Company / Trade name" v={form.certifier_company} on={(v) => update("certifier_company", v)} />
            <Field label="Address" v={form.certifier_address} on={(v) => update("certifier_address", v)} multiline />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" v={form.certifier_phone} on={(v) => update("certifier_phone", v)} type="tel" />
              <Field label="Email" v={form.certifier_email} on={(v) => update("certifier_email", v)} type="email" />
            </div>
            <Field label="Tax ID (EIN / RFC / BN)" v={form.certifier_tax_id} on={(v) => update("certifier_tax_id", v)} />
          </Section>

          <Section num="3" title="Exporter (if different from certifier)">
            <Toggle label="Same as certifier" v={form.exporter_same} on={(v) => update("exporter_same", v)} />
            {!form.exporter_same && (
              <>
                <Field label="Exporter name" v={form.exporter_name} on={(v) => update("exporter_name", v)} />
                <Field label="Exporter address" v={form.exporter_address} on={(v) => update("exporter_address", v)} multiline />
                <Field label="Exporter Tax ID" v={form.exporter_tax_id} on={(v) => update("exporter_tax_id", v)} />
              </>
            )}
          </Section>

          <Section num="4" title="Producer (if different)">
            <div className="flex flex-wrap gap-3">
              <Toggle label="Same as certifier/exporter" v={form.producer_same} on={(v) => update("producer_same", v)} />
              <Toggle label="Producer unknown / multiple" v={form.producer_unknown} on={(v) => update("producer_unknown", v)} />
            </div>
            {!form.producer_same && !form.producer_unknown && (
              <>
                <Field label="Producer name" v={form.producer_name} on={(v) => update("producer_name", v)} />
                <Field label="Producer address" v={form.producer_address} on={(v) => update("producer_address", v)} multiline />
                <Field label="Producer Tax ID" v={form.producer_tax_id} on={(v) => update("producer_tax_id", v)} />
              </>
            )}
          </Section>

          <Section num="5" title="Importer (the buyer)">
            <Field label="Importer name" v={form.importer_name} on={(v) => update("importer_name", v)} />
            <Field label="Importer address" v={form.importer_address} on={(v) => update("importer_address", v)} multiline />
            <Field label="Importer Tax ID" v={form.importer_tax_id} on={(v) => update("importer_tax_id", v)} />
          </Section>

          <Section num="6+7" title="Goods + origin criterion">
            <ul className="space-y-3">
              {form.goods.map((g, i) => (
                <li key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.15em] text-white/45">
                    <span>Item {i + 1}</span>
                    {form.goods.length > 1 && (
                      <button onClick={() => removeGoodRow(i)} className="text-rose-300/70 hover:text-rose-300 normal-case tracking-normal">
                        remove
                      </button>
                    )}
                  </div>
                  <Field label="Description (sufficient to identify the good)" v={g.description} on={(v) => updateGood(i, { description: v })} multiline />
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="HS subheading (6 digits — e.g. 8471.30)"
                      v={g.hs_subheading}
                      on={(v) => updateGood(i, { hs_subheading: v })}
                      placeholder="0000.00"
                    />
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mb-1.5">
                        Origin criterion
                      </label>
                      <select
                        value={g.origin_criterion}
                        onChange={(e) => updateGood(i, { origin_criterion: e.target.value as OriginCriterion })}
                        style={{ colorScheme: "dark" }}
                        className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
                      >
                        {(["A", "B", "C", "D"] as OriginCriterion[]).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10.5px] text-white/40 leading-[1.4]">
                        {CRITERION_LABEL[g.origin_criterion]}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={addGoodRow}
              className="mt-3 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.08] hover:text-white"
            >
              + add another good
            </button>
          </Section>

          <Section num="8" title="Blanket period (optional, ≤12 months)">
            <Toggle label="Use a blanket period" v={form.blanket_period} on={(v) => update("blanket_period", v)} />
            {form.blanket_period && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mb-1.5">From</label>
                  <input
                    type="date"
                    value={form.blanket_from}
                    onChange={(e) => update("blanket_from", e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mb-1.5">To</label>
                  <input
                    type="date"
                    value={form.blanket_to}
                    onChange={(e) => update("blanket_to", e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </Section>

          <Section num="9" title="Signature">
            <Field label="Authorized signer name" v={form.signer_name} on={(v) => update("signer_name", v)} />
            <Field label="Signer title" v={form.signer_title} on={(v) => update("signer_title", v)} />
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mb-1.5">Date signed</label>
              <input
                type="date"
                value={form.signed_date}
                onChange={(e) => update("signed_date", e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white focus:border-amber-300/40 focus:outline-none"
              />
            </div>
          </Section>

          {/* Validation summary */}
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            {errors.length === 0 ? (
              <div className="text-[13px] text-emerald-300">
                ✓ All required Article 5.2 elements present. Click <span className="font-semibold">Preview & sign</span> to render the certificate.
              </div>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-[0.15em] text-amber-300/80 mb-2">
                  Required before preview:
                </div>
                <ul className="text-[12.5px] text-amber-200/80 space-y-0.5 list-disc list-inside">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setStep("preview")}
              disabled={errors.length > 0}
              className="rounded-xl bg-amber-400 px-5 py-2.5 text-[13.5px] font-semibold text-[#0a1020] hover:bg-amber-300 disabled:opacity-40"
            >
              Preview & sign →
            </button>
            <button
              onClick={reset}
              className="text-[12px] text-white/45 hover:text-rose-300"
            >
              Reset form
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <button onClick={() => window.print()} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[12.5px] font-semibold text-[#0a1020] hover:bg-emerald-300">
              Print / Save as PDF
            </button>
            <button onClick={copyCertText} className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-[12.5px] text-white/70 hover:bg-white/[0.06] hover:text-white">
              Copy text
            </button>
            <button onClick={() => setStep("input")} className="text-[12px] text-white/45 hover:text-white ml-2">
              ← Edit
            </button>
          </div>
          <div ref={printRef} className="rounded-2xl border border-white/[0.1] bg-white text-slate-900 px-8 py-10 print:border-0 print:p-0">
            <CertificateRender form={form} />
          </div>
        </>
      )}

      <p className="mt-8 text-[10.5px] text-white/35 leading-[1.55]">
        We generate, you verify. Cruzar is not a customs broker and does not provide legal advice
        on origin determination. The certifier (you) bears legal responsibility under USMCA Article
        5.2 and 19 USC § 1592 for the accuracy of the information. Retain supporting records for
        5 years. Drafts are saved to this browser only.
      </p>
    </main>
  );
}

// ─── Reusable form bits ────────────────────────────────────────────────

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-5">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.15em] text-amber-300/70">#{num}</span>
        <h3 className="text-[13.5px] font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  v,
  on,
  multiline,
  placeholder,
  type = "text",
}: {
  label: string;
  v: string;
  on: (s: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.15em] text-white/55 mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          value={v}
          onChange={(e) => on(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      ) : (
        <input
          type={type}
          value={v}
          onChange={(e) => on(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/[0.08] bg-[#040814] px-3 py-2 text-[13px] text-white placeholder-white/30 focus:border-amber-300/40 focus:outline-none"
        />
      )}
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-white/75">
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="accent-amber-400" />
      {label}
    </label>
  );
}

// ─── Certificate render (printable, light theme) ──────────────────────────

function CertificateRender({ form }: { form: UsmcaForm }) {
  return (
    <div className="space-y-5 text-[12.5px] leading-[1.55] font-sans">
      <div className="text-center pb-4 border-b border-slate-300">
        <h1 className="text-xl font-bold tracking-tight">USMCA Certification of Origin</h1>
        <div className="mt-1 text-[11px] text-slate-600">
          Per Agreement Article 5.2 / 19 CFR Part 182
        </div>
      </div>

      <Box num="1" title="Certifier role">
        <div className="capitalize">{form.certifier_role}</div>
      </Box>

      <Box num="2" title="Certifier">
        <div className="font-medium">{form.certifier_name}</div>
        {form.certifier_company && <div>{form.certifier_company}</div>}
        <div className="whitespace-pre-line">{form.certifier_address}</div>
        <div className="text-slate-600 text-[11.5px]">
          {form.certifier_phone && <span>Tel: {form.certifier_phone}</span>}
          {form.certifier_phone && form.certifier_email && <span> · </span>}
          {form.certifier_email && <span>Email: {form.certifier_email}</span>}
        </div>
        {form.certifier_tax_id && <div className="text-slate-600 text-[11.5px]">Tax ID: {form.certifier_tax_id}</div>}
      </Box>

      <Box num="3" title="Exporter">
        {form.exporter_same ? (
          <div className="text-slate-600 italic">Same as certifier.</div>
        ) : (
          <>
            <div className="font-medium">{form.exporter_name}</div>
            <div className="whitespace-pre-line">{form.exporter_address}</div>
            {form.exporter_tax_id && <div className="text-slate-600 text-[11.5px]">Tax ID: {form.exporter_tax_id}</div>}
          </>
        )}
      </Box>

      <Box num="4" title="Producer">
        {form.producer_unknown ? (
          <div className="text-slate-600 italic">Various / unknown (per Article 5.2 element 4).</div>
        ) : form.producer_same ? (
          <div className="text-slate-600 italic">Same as certifier / exporter.</div>
        ) : (
          <>
            <div className="font-medium">{form.producer_name}</div>
            <div className="whitespace-pre-line">{form.producer_address}</div>
            {form.producer_tax_id && <div className="text-slate-600 text-[11.5px]">Tax ID: {form.producer_tax_id}</div>}
          </>
        )}
      </Box>

      <Box num="5" title="Importer">
        <div className="font-medium">{form.importer_name}</div>
        <div className="whitespace-pre-line">{form.importer_address}</div>
        {form.importer_tax_id && <div className="text-slate-600 text-[11.5px]">Tax ID: {form.importer_tax_id}</div>}
      </Box>

      <Box num="6+7" title="Goods + origin criterion">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[10.5px] uppercase tracking-[0.1em] text-slate-600">
              <th className="py-1.5 pr-2 w-[60%]">Description</th>
              <th className="py-1.5 px-2 w-[15%]">HS</th>
              <th className="py-1.5 pl-2">Criterion</th>
            </tr>
          </thead>
          <tbody>
            {form.goods.map((g, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 pr-2 align-top">{g.description}</td>
                <td className="py-2 px-2 align-top font-mono">{g.hs_subheading}</td>
                <td className="py-2 pl-2 align-top">{g.origin_criterion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {form.blanket_period && (
        <Box num="8" title="Blanket period">
          <div>
            From <strong>{form.blanket_from}</strong> to <strong>{form.blanket_to}</strong>{" "}
            (≤12 months from issuance)
          </div>
        </Box>
      )}

      <Box num="9" title="Certification statement & signature">
        <p className="text-[12px] leading-[1.6]">
          I certify that the goods described in this document qualify as originating and that the
          information contained in this document is true and accurate. I assume responsibility for
          proving such representations. I understand that I am liable for any false statements or
          material omissions made in or in connection with this document. I agree to maintain and
          present upon request, documentation necessary to support this certification, and to inform,
          in writing, all persons to whom the certification was given of any changes that could
          affect the accuracy or validity of this certification.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 min-h-[24px] font-medium">
              {form.signer_name}
            </div>
            <div className="text-[10.5px] text-slate-600">Authorized signer</div>
            <div className="text-[11.5px] mt-0.5">{form.signer_title}</div>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1 min-h-[24px] font-medium">
              {form.signed_date}
            </div>
            <div className="text-[10.5px] text-slate-600">Date</div>
          </div>
        </div>
      </Box>

      <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 leading-[1.4]">
        Generated by Cruzar Dispatch — cruzar.app/dispatch/paperwork. Cruzar is not a customs broker
        and does not provide legal advice on origin determination. The certifier bears legal
        responsibility under USMCA Article 5.2 and 19 USC § 1592 for the accuracy of the
        information. Retain supporting documentation for 5 years.
      </div>
    </div>
  );
}

function Box({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 text-[10.5px] uppercase tracking-[0.15em] text-slate-500 mb-1">
        <span className="font-mono">#{num}</span>
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
