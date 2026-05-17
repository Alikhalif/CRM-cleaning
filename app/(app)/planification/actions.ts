"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Dossier mutations exposed to the Planification page. Each one is a small
// status transition; the heavier "Planifier l'intervention" + "Modifier le
// dossier" modals are still UI-only stubs since they need a date/technician
// picker that isn't built yet.

type DossierUpdate = Database["public"]["Tables"]["dossiers"]["Update"];
type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DocumentLineInsert = Database["public"]["Tables"]["document_lines"]["Insert"];

export type Result = { ok: true } | { ok: false; error: string };

export type PlanifyInput = {
  plannedAt: string; // ISO datetime (UTC) — combined from the modal's date + time
  technicianId: string | null;
  durationHours: number | null;
};

export type EditDossierInput = {
  plannedAt: string | null; // null clears the schedule
  technicianId: string | null;
  durationHours: number | null;
  notes: string | null;
  flags: ("a_rappeler" | "attente_retour" | "litige" | "bloque")[];
};

// Edit an existing dossier. Unlike planifyDossier, this does NOT touch the
// status — it's pure metadata editing (technician, schedule, notes, flags).
// Use planifyDossier to transition a_planifier → planifie; use this once
// the dossier is already in motion and you need to reassign / annotate.
export async function editDossier(id: string, input: EditDossierInput): Promise<Result> {
  if (input.durationHours !== null && (input.durationHours <= 0 || input.durationHours > 999)) {
    return { ok: false, error: "Durée invalide (0–999 h)." };
  }
  const supabase = await supabaseServer();
  const updates: DossierUpdate = {
    planned_at: input.plannedAt,
    technician_id: input.technicianId,
    duration_hours: input.durationHours,
    notes: input.notes,
    flags: input.flags,
  };
  const { error } = await supabase.from("dossiers").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planification");
  return { ok: true };
}

// Schedule (or re-schedule) an intervention. CDC §4.5: a planificateur picks
// the date, optionally assigns a technician + duration, and the dossier
// transitions from a_planifier → planifie. The modal builds plannedAt as a
// proper ISO timestamp (Europe/Paris → UTC) before calling this.
export async function planifyDossier(id: string, input: PlanifyInput): Promise<Result> {
  if (!input.plannedAt) return { ok: false, error: "Date d'intervention requise." };
  if (input.durationHours !== null && (input.durationHours <= 0 || input.durationHours > 999)) {
    return { ok: false, error: "Durée invalide (0–999 h)." };
  }
  const supabase = await supabaseServer();
  const updates: DossierUpdate = {
    status: "planifie",
    planned_at: input.plannedAt,
    technician_id: input.technicianId,
    duration_hours: input.durationHours,
  };
  const { error } = await supabase.from("dossiers").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planification");
  return { ok: true };
}

// Mark the intervention as realised. CDC §4.6: a finalised dossier triggers
// the *manual* generation of a facture finale (separate action — not auto).
export async function finalizeDossier(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: DossierUpdate = {
    status: "finalise",
    realized_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("dossiers").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planification");
  return { ok: true };
}

// Close the dossier — sets status + payment_status to solde. Caller is
// expected to have already verified the final invoice is paid.
export async function soldDossier(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: DossierUpdate = {
    status: "solde",
    payment_status: "solde",
  };
  const { error } = await supabase.from("dossiers").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planification");
  return { ok: true };
}

export type GenerateFinaleResult =
  | { ok: true; id: string; num: string }
  | { ok: false; error: string };

// CDC §4.7: a facture finale is generated MANUALLY once the intervention is
// realised. The finale's total_ttc is the source devis's total minus any
// acompte already deducted; both invoices together equal the devis total.
// Status starts as `brouillon` — the user reviews/sends from the document
// detail page so they have a chance to add notes or correct the line copy.
//
// Idempotency: refuses to create a second finale for the same lead. The
// "Émettre" button is only shown when no finale exists yet, but a slow
// double-click or stale tab could race past the UI guard, so we re-check
// here against the database.
export async function generateFactureFinale(dossierId: string): Promise<GenerateFinaleResult> {
  const supabase = await supabaseServer();

  // 1. Load the dossier + lead id to know which devis to base the finale on.
  const { data: dossier, error: dossierErr } = await supabase
    .from("dossiers")
    .select("id, lead_id, status")
    .eq("id", dossierId)
    .maybeSingle<{ id: string; lead_id: string; status: string }>();
  if (dossierErr || !dossier) return { ok: false, error: "Dossier introuvable." };
  if (dossier.status !== "finalise") {
    return { ok: false, error: `Le dossier doit être finalisé (actuellement ${dossier.status}).` };
  }

  // 2. Fetch the most recent signed devis for this lead. Without a signed
  // devis there's nothing to base totals on — the CDC flow requires it.
  const { data: devis, error: devisErr } = await supabase
    .from("documents")
    .select(
      "id, num, lead_id, client_id, entity_id, activity_id, total_ttc, " +
      "total_ht, total_vat, acompte_amount, acompte_pct, payment_term_id",
    )
    .eq("lead_id", dossier.lead_id)
    .eq("type", "devis")
    .eq("status", "signe")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      num: string;
      lead_id: string;
      client_id: string | null;
      entity_id: string;
      activity_id: string | null;
      total_ttc: number;
      total_ht: number;
      total_vat: number;
      acompte_amount: number | null;
      acompte_pct: number | null;
      payment_term_id: string | null;
    }>();
  if (devisErr || !devis) {
    return { ok: false, error: "Aucun devis signé trouvé pour ce dossier." };
  }

  // 3. Idempotency: refuse if a finale already exists for this lead.
  const { data: existingFinale } = await supabase
    .from("documents")
    .select("id, num")
    .eq("lead_id", dossier.lead_id)
    .eq("type", "finale")
    .limit(1)
    .maybeSingle<{ id: string; num: string }>();
  if (existingFinale) {
    return { ok: false, error: `Facture finale ${existingFinale.num} déjà émise.` };
  }

  // 4. Compute the finale's amounts. The acompte (if any) is deducted from
  // the devis total; the remaining HT/VAT are derived proportionally so the
  // VAT line on the finale stays internally consistent.
  const devisAcompte = Number(devis.acompte_amount ?? 0);
  const devisTotalTtc = Number(devis.total_ttc);
  const finaleTotalTtc = round2(devisTotalTtc - devisAcompte);
  if (finaleTotalTtc <= 0) {
    return { ok: false, error: "Solde restant nul ou négatif — rien à facturer." };
  }
  const proportionRemaining = devisTotalTtc > 0 ? finaleTotalTtc / devisTotalTtc : 1;
  const finaleTotalHt = round2(Number(devis.total_ht) * proportionRemaining);
  const finaleTotalVat = round2(finaleTotalTtc - finaleTotalHt);

  // 5. Allocate the document number.
  const year = new Date().getFullYear();
  const { data: numData, error: numErr } = await supabase.rpc(
    "next_doc_num",
    { p_type: "finale", p_year: year } as never,
  );
  if (numErr || !numData) {
    return { ok: false, error: `Impossible d'allouer un numéro : ${numErr?.message ?? "inconnu"}.` };
  }
  const num = numData as string;

  // 6. INSERT the finale document. status='brouillon' so the user can review
  // and send from /factures/[id]; related_devis_id wires the lineage.
  const docPayload: DocumentInsert = {
    type: "finale",
    num,
    status: "brouillon",
    lead_id: devis.lead_id,
    client_id: devis.client_id,
    entity_id: devis.entity_id,
    activity_id: devis.activity_id,
    issued_at: new Date().toISOString(),
    payment_term_id: devis.payment_term_id,
    total_ht: finaleTotalHt,
    total_vat: finaleTotalVat,
    total_ttc: finaleTotalTtc,
    acompte_deduit: devisAcompte > 0 ? devisAcompte : null,
    solde_du: finaleTotalTtc,
    related_devis_id: devis.id,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("documents")
    .insert(docPayload as never)
    .select("id, num")
    .maybeSingle<{ id: string; num: string }>();
  if (insErr || !inserted) {
    return { ok: false, error: `Échec de la création : ${insErr?.message ?? "inconnu"}.` };
  }

  // 7. INSERT one "Solde après acompte sur devis" line. This matches the
  // synthesised pattern used elsewhere for finale views; future iterations
  // could copy the source devis's lines if the user needs item-level detail.
  const vatRate = finaleTotalHt > 0 ? round2((finaleTotalVat / finaleTotalHt) * 100) : 0;
  const linePayload: DocumentLineInsert = {
    document_id: inserted.id,
    label: `Solde après acompte sur devis ${devis.num}`,
    quantity: 1,
    unit: "forfait",
    unit_price_ht: finaleTotalHt,
    vat_rate: vatRate,
    discount_pct: 0,
    total_ht: finaleTotalHt,
    order_index: 0,
  };
  const { error: lineErr } = await supabase
    .from("document_lines")
    .insert(linePayload as never);
  if (lineErr) {
    await supabase.from("documents").delete().eq("id", inserted.id);
    return { ok: false, error: `Échec de la ligne : ${lineErr.message}.` };
  }

  revalidatePath("/planification");
  revalidatePath("/comptabilite");
  revalidatePath(`/leads/${dossier.lead_id}`);

  return { ok: true, id: inserted.id, num: inserted.num };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Mark an acompte invoice as paid AND bump the parent dossier's
// payment_status to acompte_paye. Two writes — no transaction, but the
// invoice update happens first so a partial failure leaves the dossier
// in a state consistent with its remaining "en_attente" status.
export async function markAcomptePaid(
  documentId: string,
  dossierId: string,
): Promise<Result> {
  const supabase = await supabaseServer();

  const docUpdate: DocumentUpdate = {
    status: "paye",
    paid_at: new Date().toISOString(),
  };
  const { error: docErr } = await supabase
    .from("documents")
    .update(docUpdate as never)
    .eq("id", documentId);
  if (docErr) return { ok: false, error: `Facture: ${docErr.message}` };

  const dossierUpdate: DossierUpdate = { payment_status: "acompte_paye" };
  const { error: dossierErr } = await supabase
    .from("dossiers")
    .update(dossierUpdate as never)
    .eq("id", dossierId);
  if (dossierErr) return { ok: false, error: `Dossier: ${dossierErr.message}` };

  revalidatePath("/planification");
  revalidatePath("/comptabilite");
  revalidatePath(`/factures/${documentId}`);
  return { ok: true };
}
