"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { sendBrevoEmail, PLANIF_SENDER } from "@/lib/brevo";
import { getLeadMedia, type LeadMedia } from "@/lib/media-server";
import { ensureOptimivvFactureForLead } from "@/lib/devis/facture-from-optimivv";
import type { Database } from "@/lib/supabase/database.types";
import { assertBackOffice } from "@/lib/access-server";
import { calculerFinale } from "@/lib/facturation/finale-shared";

// Dossier mutations exposed to the Planification page. Each one is a small
// status transition; the heavier "Planifier l'intervention" + "Modifier le
// dossier" modals are still UI-only stubs since they need a date/technician
// picker that isn't built yet.

type DossierUpdate = Database["public"]["Tables"]["dossiers"]["Update"];
type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DocumentLineInsert = Database["public"]["Tables"]["document_lines"]["Insert"];

export type Result = { ok: true } | { ok: false; error: string };

// Charge à la demande les photos/vidéos d'un dossier pour la visionneuse de la
// planification (URLs signées 60 min). La RLS de lead_media n'autorise que le
// propriétaire / la planificatrice / l'admin.
export async function loadDossierMedia(
  leadId: string,
): Promise<{ ok: true; media: LeadMedia[] } | { ok: false; error: string }> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  try {
    const media = await getLeadMedia(leadId);
    return { ok: true, media };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chargement impossible." };
  }
}

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
  const access = await assertBackOffice();
  if (!access.ok) return access;
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
  await auditLog({
    action: "dossier.edit",
    entityType: "dossier",
    entityId: id,
    after: {
      plannedAt: input.plannedAt,
      technicianId: input.technicianId,
      durationHours: input.durationHours,
      flags: input.flags,
    },
  });
  return { ok: true };
}

// Schedule (or re-schedule) an intervention. CDC §4.5: a planificateur picks
// the date, optionally assigns a technician + duration, and the dossier
// transitions from a_planifier → planifie. The modal builds plannedAt as a
// proper ISO timestamp (Europe/Paris → UTC) before calling this.
export async function planifyDossier(id: string, input: PlanifyInput): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
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
  await auditLog({
    action: "dossier.planify",
    entityType: "dossier",
    entityId: id,
    after: {
      plannedAt: input.plannedAt,
      technicianId: input.technicianId,
      durationHours: input.durationHours,
    },
  });
  return { ok: true };
}

// Le jour J, le technicien est arrivé et l'intervention démarre :
// planifie → en_cours (client 2026-08-03). De là, "Marquer comme réalisé"
// bascule en finalise. Si le client n'est PAS présent, on reprogramme plutôt
// (planifyDossier avec une nouvelle date) sans passer par cet état.
export async function startDossierRealisation(id: string): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  const supabase = await supabaseServer();
  const updates: DossierUpdate = { status: "en_cours" };
  const { error } = await supabase.from("dossiers").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planification");
  await auditLog({ action: "dossier.start_realisation", entityType: "dossier", entityId: id });
  return { ok: true };
}

// Intervention TERMINÉE (« Marquer comme réalisé »). CDC §4.6. Depuis le
// 2026-11-09, terminée n'ouvre plus la facture : elle doit d'abord être
// VALIDÉE (validerIntervention). On ne termine qu'une intervention planifiée
// ou en cours — sans ce filtre, un dossier déjà validé pouvait être ramené à
// « terminée » en contournant l'annulation motivée.
export async function finalizeDossier(id: string): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  const supabase = await supabaseServer();
  const updates: DossierUpdate = {
    status: "finalise",
    realized_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("dossiers")
    .update(updates as never)
    .eq("id", id)
    .in("status", ["planifie", "en_cours"])
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Seule une intervention planifiée ou en cours peut être marquée terminée." };
  }
  revalidatePath("/planification");
  await auditLog({ action: "dossier.finalize", entityType: "dossier", entityId: id });
  return { ok: true };
}

// ── Intervention VALIDÉE (décision du client du 2026-11-09) ─────────────────
// « Intervention terminée → Intervention validée → Facture finale préparée. »
// Planification ou Super Admin (assertBackOffice). Chaque validation entre
// dans `dossier_validations` (append-only) ET dans `audit_logs`.
//
// Double clic : le second appel ne trouve plus de dossier `finalise` — le
// filtre de l'UPDATE le garantit en base — et répond « déjà validée » sans
// écrire une seconde ligne d'historique.
export async function validerIntervention(id: string, commentaire?: string): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("dossiers")
    .update({ status: "valide", validated_at: now, validated_by: user.id } as never)
    .eq("id", id)
    .eq("status", "finalise")
    .select("id");
  if (error) return { ok: false, error: `Validation refusée : ${error.message}` };
  if (!data || data.length === 0) {
    const { data: d } = await supabase.from("dossiers").select("status").eq("id", id).maybeSingle<{ status: string }>();
    if (d?.status === "valide") return { ok: true }; // déjà validée — idempotent
    return { ok: false, error: `Seule une intervention terminée peut être validée (état : ${d?.status ?? "inconnu"}).` };
  }

  const { error: hErr } = await supabase.from("dossier_validations").insert({
    dossier_id: id, action: "validation", motif: commentaire?.trim() || null, user_id: user.id,
  } as never);
  if (hErr) {
    // L'historique est une exigence, pas un confort : sans lui, on défait.
    await supabase.from("dossiers")
      .update({ status: "finalise", validated_at: null, validated_by: null } as never)
      .eq("id", id).eq("status", "valide");
    return { ok: false, error: `Historique de validation impossible : ${hErr.message}. Validation annulée.` };
  }

  revalidatePath("/planification");
  await auditLog({
    action: "dossier.validate", entityType: "dossier", entityId: id,
    after: { status: "valide", commentaire: commentaire?.trim() || null },
  });
  return { ok: true };
}

// Annulation d'une validation — MOTIVÉE, et impossible si une facture finale
// active existe : une facture émise se corrige par sa propre procédure
// (annulation par le Super Admin), un brouillon se supprime d'abord.
export async function annulerValidationIntervention(id: string, motif: string): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  if (!motif?.trim()) return { ok: false, error: "Le motif de l'annulation est obligatoire." };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: finale } = await supabase
    .from("documents").select("num, status")
    .eq("dossier_id", id).eq("type", "finale")
    .is("deleted_at", null).is("annulee_at", null)
    .limit(1).maybeSingle<{ num: string; status: string }>();
  if (finale) {
    return {
      ok: false,
      error: finale.status === "brouillon"
        ? "Une facture finale est en préparation : supprimez le brouillon avant d'annuler la validation."
        : `La facture ${finale.num} est émise : elle s'annule par la procédure Super Admin, pas par ce bouton.`,
    };
  }

  const { data: avant } = await supabase
    .from("dossiers").select("validated_at, validated_by").eq("id", id)
    .maybeSingle<{ validated_at: string | null; validated_by: string | null }>();

  const { data, error } = await supabase
    .from("dossiers")
    .update({ status: "finalise", validated_at: null, validated_by: null } as never)
    .eq("id", id).eq("status", "valide")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Ce dossier n'est pas (ou plus) validé." };

  const { error: hErr } = await supabase.from("dossier_validations").insert({
    dossier_id: id, action: "annulation", motif: motif.trim(), user_id: user.id,
  } as never);
  if (hErr) {
    // Pas d'annulation sans trace : on rétablit la validation telle qu'elle était.
    await supabase.from("dossiers")
      .update({ status: "valide", validated_at: avant?.validated_at ?? null, validated_by: avant?.validated_by ?? null } as never)
      .eq("id", id).eq("status", "finalise");
    return { ok: false, error: `Historique d'annulation impossible : ${hErr.message}. Validation rétablie.` };
  }
  revalidatePath("/planification");
  await auditLog({
    action: "dossier.validate.cancel", entityType: "dossier", entityId: id,
    after: { status: "finalise", motif: motif.trim() },
  });
  return { ok: true };
}

// Close the dossier — sets status + payment_status to solde.
//
// A17 — contrôle de paiement avant clôture : on refuse de solder un dossier
// dont la facture finale a été ÉMISE mais n'est pas encore encaissée (`paye`).
// Solder = déclarer le dossier réglé ; le faire alors qu'une finale est impayée
// serait un mensonge comptable. On ne bloque PAS les dossiers sans facture dans
// `documents` (paiement comptant, ou facture OPTIMIVV hors `documents`) pour ne
// casser aucun flux existant — on ne gate que le cas incohérent « finale émise
// et impayée ».
export async function soldDossier(id: string): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  const supabase = await supabaseServer();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("lead_id")
    .eq("id", id)
    .maybeSingle<{ lead_id: string }>();
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const { data: finale } = await supabase
    .from("documents")
    .select("num, status")
    .eq("lead_id", dossier.lead_id)
    .eq("type", "finale")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ num: string; status: string }>();
  if (finale && finale.status !== "paye") {
    return {
      ok: false,
      error: `Facture finale ${finale.num} non encaissée (statut : ${finale.status}). Encaissez-la avant de solder le dossier.`,
    };
  }

  const updates: DossierUpdate = {
    status: "solde",
    payment_status: "solde",
  };
  const { error } = await supabase.from("dossiers").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planification");
  await auditLog({ action: "dossier.sold", entityType: "dossier", entityId: id });
  return { ok: true };
}

export type GenerateFinaleResult =
  // `optimivvUrl` présent = facture OPTIMIVV (hors `documents`) → l'UI ouvre le
  // PDF archivé au lieu de router vers /factures/[id] (A09).
  | { ok: true; id: string; num: string; optimivvUrl?: string }
  | { ok: false; error: string };

// ── Facture finale PRÉPARÉE (décision du client du 2026-11-09) ──────────────
// « Intervention validée → Facture finale préparée. » La facture naît en
// BROUILLON, sans numéro définitif (migration 20261109000003) : elle n'est
// numérotée qu'à son ÉMISSION, par `emettreFacture`, après relecture. Aucune
// émission automatique.
//
// Reprise depuis le dossier : lignes du devis signé, acomptes ÉMIS déduits un
// par un (calculerFinale, lib/facturation/finale-shared.ts), rattachement au
// dossier (`dossier_id`).
//
// Une seule finale active par dossier et par devis : contrôlée ici, et
// GARANTIE par les index uniques partiels de la migration — un double clic
// qui passerait le contrôle se heurte à la base, et on renvoie alors la
// facture gagnante au lieu d'une erreur.
export async function generateFactureFinale(dossierId: string): Promise<GenerateFinaleResult> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  const supabase = await supabaseServer();

  const { data: dossier, error: dossierErr } = await supabase
    .from("dossiers")
    .select("id, lead_id, status")
    .eq("id", dossierId)
    .maybeSingle<{ id: string; lead_id: string; status: string }>();
  if (dossierErr || !dossier) return { ok: false, error: "Dossier introuvable." };
  if (dossier.status !== "valide") {
    return {
      ok: false,
      error: dossier.status === "finalise"
        ? "Intervention terminée mais pas encore validée : validez-la avant de préparer la facture."
        : `La facture finale exige une intervention validée (état actuel : ${dossier.status}).`,
    };
  }

  const { data: devis, error: devisErr } = await supabase
    .from("documents")
    .select("id, num, lead_id, client_id, entity_id, activity_id, total_ttc, total_ht, total_vat, payment_term_id")
    .eq("lead_id", dossier.lead_id)
    .eq("type", "devis")
    .eq("status", "signe")
    .is("deleted_at", null)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string; num: string; lead_id: string; client_id: string | null; entity_id: string;
      activity_id: string | null; total_ttc: number; total_ht: number; total_vat: number;
      payment_term_id: string | null;
    }>();
  if (devisErr || !devis) {
    // A09 — Repli OPTIMIVV : pas de devis dans `documents`, mais peut-être un
    // devis OPTIMIVV signé. On génère (ou renvoie) la facture via le moteur
    // OPTIMIVV (numéro FAC-…, PDF archivé) plutôt que d'être en impasse.
    // ⚠️ Ce moteur numérote à la génération : il ne suit pas encore la règle
    // « brouillon puis émission » (registre, D27).
    const { data: { user } } = await supabase.auth.getUser();
    const opt = await ensureOptimivvFactureForLead(dossier.lead_id, user?.id ?? null);
    if (opt) {
      revalidatePath("/planification");
      revalidatePath(`/leads/${dossier.lead_id}`);
      await auditLog({
        action: "dossier.finale.create",
        entityType: "dossier",
        entityId: dossier.id,
        after: { optimivv: true, numero: opt.numero },
      });
      return { ok: true, id: "", num: opt.numero, optimivvUrl: opt.url ?? undefined };
    }
    return { ok: false, error: "Aucun devis signé trouvé pour ce dossier." };
  }

  // Une finale ACTIVE existe déjà (brouillon ou émise, non annulée) : on la
  // renvoie. Préparer deux fois la même facture n'en crée pas deux.
  const existante = await finaleActive(supabase, dossier.id, devis.id);
  if (existante) return { ok: true, id: existante.id, num: existante.num };

  const [{ data: lignesDevis, error: lErr }, { data: acomptes, error: aErr }] = await Promise.all([
    supabase
      .from("document_lines")
      .select("label, quantity, unit, unit_price_ht, vat_rate, discount_pct, total_ht, prestation_id, order_index")
      .eq("document_id", devis.id)
      .order("order_index", { ascending: true })
      .returns<{
        label: string; quantity: number; unit: string | null; unit_price_ht: number; vat_rate: number;
        discount_pct: number | null; total_ht: number; prestation_id: string | null; order_index: number;
      }[]>(),
    // Acomptes déjà FACTURÉS : émis (pas brouillon), ni annulés ni supprimés.
    supabase
      .from("documents")
      .select("num, emise_at, issued_at, total_ht, total_vat, total_ttc")
      .eq("related_devis_id", devis.id)
      .eq("type", "acompte")
      .neq("status", "brouillon")
      .is("deleted_at", null)
      .is("annulee_at", null)
      .order("issued_at", { ascending: true })
      .returns<{ num: string; emise_at: string | null; issued_at: string; total_ht: number; total_vat: number; total_ttc: number }[]>(),
  ]);
  if (lErr) return { ok: false, error: `Lignes du devis illisibles : ${lErr.message}` };
  if (aErr) return { ok: false, error: `Acomptes illisibles : ${aErr.message}` };

  const calcul = calculerFinale({
    devis: {
      num: devis.num,
      totalHt: Number(devis.total_ht),
      totalVat: Number(devis.total_vat),
      totalTtc: Number(devis.total_ttc),
      lignes: (lignesDevis ?? []).map((l) => ({
        label: l.label,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitPriceHt: Number(l.unit_price_ht),
        vatRate: Number(l.vat_rate),
        discountPct: Number(l.discount_pct ?? 0),
        totalHt: Number(l.total_ht),
        prestationId: l.prestation_id,
      })),
    },
    acomptes: (acomptes ?? []).map((a) => ({
      num: a.num,
      emiseAt: a.emise_at ?? a.issued_at,
      totalHt: Number(a.total_ht),
      totalVat: Number(a.total_vat),
      totalTtc: Number(a.total_ttc),
    })),
  });
  if (!calcul.ok) return { ok: false, error: calcul.erreur };

  // Remplacement : si une finale de ce dossier a été ANNULÉE (procédure Super
  // Admin), la nouvelle la désigne — la base exige qu'elle soit bien annulée.
  const { data: annulee } = await supabase
    .from("documents").select("id")
    .eq("dossier_id", dossier.id).eq("type", "finale")
    .not("annulee_at", "is", null)
    .order("annulee_at", { ascending: false })
    .limit(1).maybeSingle<{ id: string }>();

  const docPayload: DocumentInsert = {
    type: "finale",
    num: "", // brouillon : la base pose un numéro PROVISOIRE, jamais un numéro légal
    status: "brouillon",
    lead_id: devis.lead_id,
    client_id: devis.client_id,
    entity_id: devis.entity_id,
    activity_id: devis.activity_id,
    payment_term_id: devis.payment_term_id,
    total_ht: calcul.totalHt,
    total_vat: calcul.totalVat,
    total_ttc: calcul.totalTtc,
    acompte_deduit: calcul.acompteDeduit > 0 ? calcul.acompteDeduit : null,
    solde_du: calcul.totalTtc,
    related_devis_id: devis.id,
    dossier_id: dossier.id,
    remplace_document_id: annulee?.id ?? null,
  };
  const { data: inserted, error: insErr } = await supabase
    .from("documents")
    .insert(docPayload as never)
    .select("id, num")
    .maybeSingle<{ id: string; num: string }>();
  if (insErr || !inserted) {
    // Course perdue contre un autre clic : l'index unique a refusé le second
    // brouillon. On renvoie celui qui a gagné.
    if (insErr?.code === "23505") {
      const gagnante = await finaleActive(supabase, dossier.id, devis.id);
      if (gagnante) return { ok: true, id: gagnante.id, num: gagnante.num };
    }
    return { ok: false, error: `Échec de la préparation : ${insErr?.message ?? "inconnu"}.` };
  }

  const lignes: DocumentLineInsert[] = calcul.lignes.map((l) => ({
    document_id: inserted.id,
    label: l.label,
    quantity: l.quantity,
    unit: l.unit ?? "forfait",
    unit_price_ht: l.unitPriceHt,
    vat_rate: l.vatRate,
    discount_pct: l.discountPct,
    total_ht: l.totalHt,
    prestation_id: l.prestationId ?? null,
    order_index: l.orderIndex,
  }));
  const { error: lineErr } = await supabase.from("document_lines").insert(lignes as never);
  if (lineErr) {
    // Un BROUILLON se supprime sans dommage : il n'a consommé aucun numéro.
    await supabase.from("documents").delete().eq("id", inserted.id);
    return { ok: false, error: `Échec des lignes : ${lineErr.message}.` };
  }

  revalidatePath("/planification");
  revalidatePath("/comptabilite");
  revalidatePath(`/leads/${dossier.lead_id}`);
  await auditLog({
    action: "dossier.finale.prepare",
    entityType: "document",
    entityId: inserted.id,
    after: {
      type: "finale",
      status: "brouillon",
      dossierId: dossier.id,
      sourceDevisId: devis.id,
      lignes: lignes.length,
      acomptesDeduits: (acomptes ?? []).map((a) => a.num),
      totalTtc: calcul.totalTtc,
      signalements: calcul.signalements,
    },
  });
  return { ok: true, id: inserted.id, num: inserted.num };
}

async function finaleActive(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  dossierId: string,
  devisId: string,
): Promise<{ id: string; num: string } | null> {
  const { data } = await supabase
    .from("documents")
    .select("id, num")
    .eq("type", "finale")
    .or(`dossier_id.eq.${dossierId},related_devis_id.eq.${devisId}`)
    .is("deleted_at", null)
    .is("annulee_at", null)
    .limit(1)
    .maybeSingle<{ id: string; num: string }>();
  return data ?? null;
}

// Mark an acompte invoice as paid AND bump the parent dossier's
// payment_status to acompte_paye. Two writes — no transaction, but the
// invoice update happens first so a partial failure leaves the dossier
// in a state consistent with its remaining "en_attente" status.
export async function markAcomptePaid(
  documentId: string,
  dossierId: string,
): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
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
  await auditLog({
    action: "dossier.acompte_paid",
    entityType: "dossier",
    entityId: dossierId,
    after: { documentId },
  });
  return { ok: true };
}

export type ConfirmInterventionInput = {
  recipient: string;
  subject: string;
  message: string; // plain text — wrapped into a minimal HTML envelope below
};

// Send the client an "intervention confirmée" email from the Planification
// page. No PDF attachment — this is a short transactional confirmation, not
// a document. The planificatrice edits the message in the modal before
// sending; we trust the input (RLS already gates her view of the dossier).
export async function sendInterventionConfirmation(
  dossierId: string,
  input: ConfirmInterventionInput,
): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient)) {
    return { ok: false, error: "Email destinataire invalide." };
  }
  if (!input.subject.trim()) return { ok: false, error: "Objet requis." };

  const htmlContent = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1f3a;">
${escapeHtml(input.message).replace(/\n/g, "<br>")}
</div>`;

  const result = await sendBrevoEmail({
    to: input.recipient.trim(),
    subject: input.subject.trim(),
    htmlContent,
    senderEmail: PLANIF_SENDER.email,
    senderName: PLANIF_SENDER.name,
  });
  if (!result.ok) return { ok: false, error: `Brevo : ${result.error}` };

  await auditLog({
    action: "dossier.confirmation_email",
    entityType: "dossier",
    entityId: dossierId,
    after: { recipient: input.recipient.trim(), subject: input.subject.trim() },
  });

  return { ok: true };
}

// ── Envoi d'un mail de mission à l'intervenant (sous-traitant) ──────────
// La planificatrice choisit un modèle « Intervenant » (déjà auto-rempli avec
// les données du dossier, hors email/tél client) et l'envoie via Brevo à
// l'email de l'intervenant. Client 2026-08-03.
export async function sendIntervenantEmail(
  dossierId: string,
  input: { recipient: string; subject: string; message: string },
): Promise<Result> {
  const access = await assertBackOffice();
  if (!access.ok) return access;
  const recipient = input.recipient.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!recipient) return { ok: false, error: "Email de l'intervenant requis." };
  if (!subject) return { ok: false, error: "Objet requis." };
  if (!message) return { ok: false, error: "Message requis." };

  const supabase = await supabaseServer();
  const { data: dossier } = await supabase
    .from("dossiers")
    .select("lead_id")
    .eq("id", dossierId)
    .maybeSingle<{ lead_id: string }>();

  const html = escapeHtml(message).replace(/\n/g, "<br>");
  const res = await sendBrevoEmail({
    to: recipient,
    subject,
    htmlContent: html,
    senderEmail: PLANIF_SENDER.email,
    senderName: PLANIF_SENDER.name,
  });
  if (!res.ok) return { ok: false, error: `Envoi email : ${res.error}` };

  revalidatePath("/planification");
  await auditLog({
    action: "dossier.intervenant.email",
    entityType: "dossier",
    entityId: dossierId,
    after: { recipient, subject, leadId: dossier?.lead_id ?? null },
  });
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
