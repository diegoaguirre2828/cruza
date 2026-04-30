// /api/dispatch/paperwork/usmca-review — pre-sign expert panel for USMCA
// Certificate of Origin drafts. Same 3-persona shape as hs-suggest, but
// reviewing the WHOLE filled-out certificate (all 9 elements) for issues
// before the certifier signs.
//
// Returns red flags from each persona + synthesized "fix these before
// signing" / "ready to sign" verdict. Designed to render INLINE on the
// preview step of the USMCA generator.

import { NextResponse } from "next/server";
import { runPersonaPanel, CUSTOMS_PERSONAS } from "@/lib/personaPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UsmcaDraft {
  certifier_role?: string;
  certifier_name?: string;
  certifier_address?: string;
  certifier_phone?: string;
  certifier_email?: string;
  certifier_tax_id?: string;
  exporter_same?: boolean;
  exporter_name?: string;
  exporter_address?: string;
  exporter_tax_id?: string;
  producer_same?: boolean;
  producer_unknown?: boolean;
  producer_name?: string;
  producer_address?: string;
  producer_tax_id?: string;
  importer_name?: string;
  importer_address?: string;
  importer_tax_id?: string;
  goods?: Array<{ description?: string; hs_subheading?: string; origin_criterion?: string }>;
  blanket_period?: boolean;
  blanket_from?: string;
  blanket_to?: string;
  signer_name?: string;
  signer_title?: string;
  signed_date?: string;
}

export async function POST(req: Request) {
  let draft: UsmcaDraft = {};
  try {
    draft = (await req.json()) as UsmcaDraft;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const summary = formatDraftForReview(draft);

  try {
    const panel = await runPersonaPanel({
      input: [
        "Pre-sign review of a USMCA Certificate of Origin draft. The certifier is about to sign. From your perspective, what would cause this to fail at the border, in the broker filing, or in a future audit?",
        "",
        "DRAFT:",
        "---",
        summary,
        "---",
        "Each persona: assess specifically.",
        "- CBP Classifier: do the HS subheadings + origin criterion + descriptions reconcile? Wrong-chapter risks?",
        "- Aduanal Broker: is the producer info adequate? Are blanket-period dates valid (≤12 months)? Will MX customs accept this as-is?",
        "- Audit Reviewer: what would you flag in a Focused Assessment? Missing supporting documentation triggers? Penalty exposure?",
        "Flag concrete fix-before-sign items, not generic 'consider double-checking'.",
      ].join("\n"),
      personas: CUSTOMS_PERSONAS,
      synthesisInstruction:
        "If all three personas say it's ready, say 'Ready to sign.' If anyone has a critical flag, lead with 'Fix before signing:' and list the top 1-3 items the certifier must resolve. Be specific — name the field and the issue.",
      maxTokens: 2000,
    });

    return NextResponse.json({
      panel,
      ready_to_sign:
        panel.agreement === "aligned" &&
        panel.responses.every((r) => r.flags.length === 0 && r.confidence !== "low"),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "review_failed" },
      { status: 502 },
    );
  }
}

function formatDraftForReview(d: UsmcaDraft): string {
  const lines: string[] = [];
  lines.push(`Certifier role: ${d.certifier_role ?? "?"}`);
  lines.push(`Certifier: ${d.certifier_name ?? "?"} | ${d.certifier_address ?? "?"} | tax_id=${d.certifier_tax_id || "?"} | ${d.certifier_email || d.certifier_phone || "no contact"}`);
  if (d.exporter_same) lines.push("Exporter: same as certifier");
  else lines.push(`Exporter: ${d.exporter_name ?? "?"} | ${d.exporter_address ?? "?"} | tax_id=${d.exporter_tax_id || "?"}`);
  if (d.producer_unknown) lines.push("Producer: unknown / various (Article 5.2 element 4 allowance)");
  else if (d.producer_same) lines.push("Producer: same as certifier/exporter");
  else lines.push(`Producer: ${d.producer_name ?? "?"} | ${d.producer_address ?? "?"} | tax_id=${d.producer_tax_id || "?"}`);
  lines.push(`Importer: ${d.importer_name ?? "?"} | ${d.importer_address ?? "?"} | tax_id=${d.importer_tax_id || "?"}`);
  lines.push("Goods:");
  (d.goods ?? []).forEach((g, i) => {
    lines.push(`  ${i + 1}. desc="${g.description ?? "?"}"  HS=${g.hs_subheading ?? "?"}  origin_criterion=${g.origin_criterion ?? "?"}`);
  });
  if (d.blanket_period) lines.push(`Blanket period: ${d.blanket_from ?? "?"} → ${d.blanket_to ?? "?"}`);
  lines.push(`Signer: ${d.signer_name ?? "?"} (${d.signer_title ?? "?"}) on ${d.signed_date ?? "?"}`);
  return lines.join("\n");
}
