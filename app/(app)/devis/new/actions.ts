"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { sendDocumentByEmail } from "@/app/(app)/_shared/document-actions";
import type { Database } from "@/lib/supabase/database.types";

// Server actions for the new-devis editor. All money is recomputed here from
// (quantity, unit_price_ht, vat_rate, discount_pct) so client-side tampering
// can't trick the DB into storing a price that doesn't match the lines. The
// editor's totals panel is purely cosmetic — the source of truth is here.

type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DocumentLineInsert = Database["public"]["Tables"]["document_lines"]["Insert"];

export type DraftLineInput = {
  prestationId?: string;
  label: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  discountPct: number;
};

export type DraftInput = {
  clientId: string;
  entityId: string;
  issuedAt: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  paymentTermSlug: "comptant" | "30j" | "45j" | "60j";
  acomptePct: number;
  notes: string;
  lines: DraftLineInput[];
};

export type CreateDevisIntent = "draft" | "send";

export type Result =
  | { ok: true; id: string; num: string; emailWarning?: string }
  | { ok: false; error: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeTotals(lines: DraftLineInput[]): { totalHt: number; totalVat: number; totalTtc: number } {
  let totalHt = 0;
  let totalVat = 0;
  for (const l of lines) {
    const lineHt = l.quantity * l.unitPriceHt * (1 - l.discountPct / 100);
    totalHt += lineHt;
    totalVat += (lineHt * l.vatRate) / 100;
  }
  return {
    totalHt: round2(totalHt),
    totalVat: round2(totalVat),
    totalTtc: round2(totalHt + totalVat),
  };
}

export async function createDevis(draft: DraftInput, intent: CreateDevisIntent): Promise<Result> {
  // ── 1. Validate the inputs we actually trust the client to provide ──
  if (!draft.clientId) return { ok: false, error: "Client requis." };
  if (!draft.entityId) return { ok: false, error: "Entité émettrice requise." };
  if (draft.lines.length === 0) return { ok: false, error: "Au moins une ligne est requise." };
  for (const l of draft.lines) {
    if (!l.label.trim()) return { ok: false, error: "Chaque ligne doit avoir une description." };
    if (l.quantity <= 0) return { ok: false, error: "La quantité doit être > 0." };
    if (l.unitPriceHt < 0) return { ok: false, error: "Le prix unitaire ne peut pas être négatif." };
  }

  const supabase = await supabaseServer();

  // ── 2. Resolve the lead linkage from the client. Direct clients have no
  // source_lead_id, in which case lead_id stays NULL (and RLS will only let
  // admins/planners write — commerciaux must work from a lead).
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, source_lead_id, sectors")
    .eq("id", draft.clientId)
    .maybeSingle<{ id: string; source_lead_id: string | null; sectors: string[] | null }>();
  if (clientErr || !client) return { ok: false, error: "Client introuvable." };

  // ── 3. Derive activity_id from the client's first sector (or the lead's,
  // if linked). The documents row carries activity_id so the entity ↔ activity
  // default-mapping (legal_entity_activities) can pick the right template.
  let activityId: string | null = null;
  if (client.sectors && client.sectors.length > 0) {
    activityId = client.sectors[0];
  } else if (client.source_lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("activity_id")
      .eq("id", client.source_lead_id)
      .maybeSingle<{ activity_id: string | null }>();
    activityId = lead?.activity_id ?? null;
  }

  // ── 4. Resolve payment_term slug → id ────────────────────────────────
  const { data: pt } = await supabase
    .from("payment_terms")
    .select("id")
    .eq("slug", draft.paymentTermSlug)
    .maybeSingle<{ id: string }>();
  const paymentTermId = pt?.id ?? null;

  // ── 5. Recompute totals server-side. Client values are ignored. ──────
  const totals = computeTotals(draft.lines);
  const acompteAmount = draft.acomptePct > 0 ? round2((totals.totalTtc * draft.acomptePct) / 100) : null;
  const soldeDu = acompteAmount !== null ? round2(totals.totalTtc - acompteAmount) : null;

  // ── 6. Allocate the document number via the gapless sequence. ────────
  // The `as never` cast is the same workaround we use on .update() — the
  // @supabase/ssr-bundled postgrest-js loses the generic on rpc() args so
  // the call site reports `expected undefined`. The types file does have
  // the correct Args shape; only the call-site inference is broken.
  const year = new Date(draft.issuedAt).getFullYear();
  const { data: numData, error: numErr } = await supabase.rpc(
    "next_doc_num",
    { p_type: "devis", p_year: year } as never,
  );
  if (numErr || !numData) {
    return { ok: false, error: `Impossible d'allouer un numéro : ${numErr?.message ?? "inconnu"}.` };
  }
  const num = numData as string;

  // ── 7. INSERT the document. The status check constraint pins the enum
  // values per type, so an invalid intent → status mapping would fail loudly.
  const status = intent === "send" ? "envoye" : "brouillon";
  const docPayload: DocumentInsert = {
    type: "devis",
    num,
    status,
    lead_id: client.source_lead_id,
    client_id: client.id,
    entity_id: draft.entityId,
    activity_id: activityId,
    issued_at: new Date(draft.issuedAt).toISOString(),
    valid_until: new Date(draft.validUntil).toISOString(),
    payment_term_id: paymentTermId,
    total_ht: totals.totalHt,
    total_vat: totals.totalVat,
    total_ttc: totals.totalTtc,
    acompte_pct: draft.acomptePct > 0 ? draft.acomptePct : null,
    acompte_amount: acompteAmount,
    solde_du: soldeDu,
    notes: draft.notes || null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("documents")
    .insert(docPayload as never)
    .select("id, num")
    .maybeSingle<{ id: string; num: string }>();
  if (insErr || !inserted) {
    return { ok: false, error: `Échec de la création du devis : ${insErr?.message ?? "inconnu"}.` };
  }

  // ── 8. INSERT the lines. Cascade delete on the FK protects against
  // orphans if a later mutation rolls back the parent — but we want a clean
  // failure path here too, so wipe the document if line insert fails.
  const linePayloads: DocumentLineInsert[] = draft.lines.map((l, idx) => {
    const lineHt = round2(l.quantity * l.unitPriceHt * (1 - l.discountPct / 100));
    return {
      document_id: inserted.id,
      prestation_id: l.prestationId ?? null,
      label: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unit_price_ht: l.unitPriceHt,
      vat_rate: l.vatRate,
      discount_pct: l.discountPct,
      total_ht: lineHt,
      order_index: idx,
    };
  });

  const { error: linesErr } = await supabase
    .from("document_lines")
    .insert(linePayloads as never);
  if (linesErr) {
    await supabase.from("documents").delete().eq("id", inserted.id);
    return { ok: false, error: `Échec des lignes : ${linesErr.message}.` };
  }

  // ── 9. If we're sending and the source lead is still in lead_entrant,
  // bump it forward. Mirrors the manual Mano flow (CDC §2.3 — a devis sent
  // by hand after a phone call).
  if (intent === "send" && client.source_lead_id) {
    await supabase
      .from("leads")
      .update({
        status: "envoye",
        sub_envoi: "mano",
        last_action_label: `Devis ${num} envoyé`,
        last_action_at: new Date().toISOString(),
      } as never)
      .eq("id", client.source_lead_id)
      .eq("status", "lead"); // only bump if it hasn't moved further already
  }

  revalidatePath("/comptabilite");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  if (client.source_lead_id) revalidatePath(`/leads/${client.source_lead_id}`);

  // ── 10. If intent=send, actually fire the email via Brevo. We look up
  // the lead's email to use as the recipient. If the lead has no email or
  // Brevo refuses (unverified sender, bad API key), the devis stays saved
  // and we surface the failure as a non-fatal warning — the user can retry
  // from the document detail page with the SendEmailModal.
  let emailWarning: string | undefined;
  if (intent === "send" && client.source_lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("client_email, client_first_name, client_last_name, client_company, is_company")
      .eq("id", client.source_lead_id)
      .maybeSingle<{
        client_email: string | null;
        client_first_name: string | null;
        client_last_name: string | null;
        client_company: string | null;
        is_company: boolean;
      }>();

    if (!lead?.client_email) {
      emailWarning = "Devis créé, mais aucun email enregistré sur le lead — envoi non effectué.";
    } else {
      const recipientName = lead.is_company
        ? (lead.client_company ?? "")
        : `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim();
      const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";
      const sendResult = await sendDocumentByEmail(inserted.id, {
        recipient: lead.client_email,
        subject: `Devis ${num}`,
        message: `${greeting}

Veuillez trouver ci-joint notre devis ${num}.

N'hésitez pas à revenir vers nous pour toute question.

Cordialement,`,
      });
      if (!sendResult.ok) {
        emailWarning = `Devis enregistré mais envoi email échoué : ${sendResult.error}`;
      }
    }
  }

  return { ok: true, id: inserted.id, num: inserted.num, emailWarning };
}
