"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { DocumentType } from "@/lib/leads";

// Document-level mutations callable from any place that shows a document
// (detail page, Comptabilité row menu). Mirrors the planification actions'
// shape — same Result type, same `as never` SDK workaround.

type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DossierUpdate = Database["public"]["Tables"]["dossiers"]["Update"];
type LineRow = Database["public"]["Tables"]["document_lines"]["Row"];
type LineInsert = Database["public"]["Tables"]["document_lines"]["Insert"];

export type Result = { ok: true } | { ok: false; error: string };
export type DuplicateResult =
  | { ok: true; id: string; num: string }
  | { ok: false; error: string };

// ── Flip status brouillon → envoye on a devis. CDC §2.3: this is the "mano"
// path — the commercial has sent the devis themselves (email outside the
// platform, hand-delivered, etc.) and is recording the fact. Distinct from
// "Envoyer par email" which would actually push to Brevo.
export async function markDocumentSent(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: DocumentUpdate = {
    status: "envoye",
    sent_to_email: null, // not actually sent through us
  };
  const { error } = await supabase
    .from("documents")
    .update(updates as never)
    .eq("id", id)
    .eq("status", "brouillon"); // belt-and-braces: only transition from brouillon
  if (error) return { ok: false, error: error.message };
  revalidatePath("/comptabilite");
  revalidatePath(`/devis/${id}`);
  return { ok: true };
}

// ── Mark an invoice (acompte or finale) as paid. Also syncs the parent
// dossier's payment_status — acompte → acompte_paye, finale → solde + close
// the dossier — so the planification view stays consistent without the
// user having to also touch the dossier.
export async function markDocumentPaid(
  id: string,
  paymentReference: string = "",
): Promise<Result> {
  const supabase = await supabaseServer();

  // Read enough to decide on the dossier-side update.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, type, status, lead_id")
    .eq("id", id)
    .maybeSingle<{ id: string; type: DocumentType; status: string; lead_id: string | null }>();
  if (docErr || !doc) return { ok: false, error: "Document introuvable." };
  if (doc.type === "devis") {
    return { ok: false, error: "Un devis ne peut pas être marqué payé (utilisez la facture)." };
  }
  if (doc.status === "paye") {
    return { ok: false, error: "Facture déjà marquée payée." };
  }

  const now = new Date().toISOString();
  const docUpdate: DocumentUpdate = {
    status: "paye",
    paid_at: now,
    payment_reference: paymentReference.trim() || null,
  };
  const { error: payErr } = await supabase
    .from("documents")
    .update(docUpdate as never)
    .eq("id", id);
  if (payErr) return { ok: false, error: `Facture : ${payErr.message}` };

  // Sync dossier if one exists for this lead.
  if (doc.lead_id) {
    const dossierUpdate: DossierUpdate =
      doc.type === "finale"
        ? { payment_status: "solde", status: "solde" }
        : { payment_status: "acompte_paye" };
    await supabase
      .from("dossiers")
      .update(dossierUpdate as never)
      .eq("lead_id", doc.lead_id);
  }

  revalidatePath("/comptabilite");
  revalidatePath("/planification");
  revalidatePath(`/factures/${id}`);
  return { ok: true };
}

// ── Duplicate any document as a fresh brouillon. Allocates a new num via
// the gapless sequence and copies the lines verbatim. The source's lineage
// (related_devis_id, signed_at, paid_at) is intentionally not copied — the
// duplicate is a starting point, not a clone of the workflow state.
export async function duplicateDocument(id: string): Promise<DuplicateResult> {
  const supabase = await supabaseServer();

  const { data: src, error: srcErr } = await supabase
    .from("documents")
    .select(
      "type, lead_id, client_id, entity_id, activity_id, payment_term_id, " +
      "total_ht, total_vat, total_ttc, acompte_pct, acompte_amount, solde_du, notes",
    )
    .eq("id", id)
    .maybeSingle<{
      type: DocumentType;
      lead_id: string | null;
      client_id: string | null;
      entity_id: string;
      activity_id: string | null;
      payment_term_id: string | null;
      total_ht: number;
      total_vat: number;
      total_ttc: number;
      acompte_pct: number | null;
      acompte_amount: number | null;
      solde_du: number | null;
      notes: string | null;
    }>();
  if (srcErr || !src) return { ok: false, error: "Document source introuvable." };

  // Allocate a number for the same type.
  const year = new Date().getFullYear();
  const { data: numData, error: numErr } = await supabase.rpc(
    "next_doc_num",
    { p_type: src.type, p_year: year } as never,
  );
  if (numErr || !numData) {
    return { ok: false, error: `Impossible d'allouer un numéro : ${numErr?.message ?? "inconnu"}.` };
  }
  const num = numData as string;

  const docPayload: DocumentInsert = {
    type: src.type,
    num,
    status: "brouillon",
    lead_id: src.lead_id,
    client_id: src.client_id,
    entity_id: src.entity_id,
    activity_id: src.activity_id,
    issued_at: new Date().toISOString(),
    payment_term_id: src.payment_term_id,
    total_ht: src.total_ht,
    total_vat: src.total_vat,
    total_ttc: src.total_ttc,
    acompte_pct: src.acompte_pct,
    acompte_amount: src.acompte_amount,
    solde_du: src.solde_du,
    notes: src.notes,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("documents")
    .insert(docPayload as never)
    .select("id, num")
    .maybeSingle<{ id: string; num: string }>();
  if (insErr || !inserted) {
    return { ok: false, error: `Échec de la duplication : ${insErr?.message ?? "inconnu"}.` };
  }

  // Copy the lines. If this fails, roll back the parent so we don't leave
  // an empty brouillon stranded with the consumed number.
  const { data: lines } = await supabase
    .from("document_lines")
    .select("prestation_id, label, quantity, unit, unit_price_ht, vat_rate, discount_pct, total_ht, order_index")
    .eq("document_id", id)
    .order("order_index", { ascending: true })
    .returns<LineRow[]>();
  if (lines && lines.length > 0) {
    const linePayloads: LineInsert[] = lines.map((l) => ({
      document_id: inserted.id,
      prestation_id: l.prestation_id,
      label: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unit_price_ht: l.unit_price_ht,
      vat_rate: l.vat_rate,
      discount_pct: l.discount_pct,
      total_ht: l.total_ht,
      order_index: l.order_index,
    }));
    const { error: linesErr } = await supabase
      .from("document_lines")
      .insert(linePayloads as never);
    if (linesErr) {
      await supabase.from("documents").delete().eq("id", inserted.id);
      return { ok: false, error: `Échec des lignes : ${linesErr.message}.` };
    }
  }

  revalidatePath("/comptabilite");
  return { ok: true, id: inserted.id, num: inserted.num };
}
