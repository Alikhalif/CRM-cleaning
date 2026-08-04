"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { sendBrevoEmail } from "@/lib/brevo";
import { getDocumentById } from "@/lib/documents-server";
import DocumentPdf from "@/lib/pdf/DocumentPdf";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/database.types";
import type { DocumentType, SubSignatureMode } from "@/lib/leads";

// Document-level mutations callable from any place that shows a document
// (detail page, Comptabilité row menu). Mirrors the planification actions'
// shape — same Result type, same `as never` SDK workaround.

type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DossierUpdate = Database["public"]["Tables"]["dossiers"]["Update"];
type DossierInsert = Database["public"]["Tables"]["dossiers"]["Insert"];
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
  await auditLog({ action: "document.mark_sent", entityType: "document", entityId: id });
  return { ok: true };
}

// ── Mark a devis as signed (CDC §2.3 / §6).
//
// Single entry-point for "the devis just got signed". Handles three things
// in one atomic-ish flow:
//   1. The devis row → status='signe', signed_at=now
//   2. The linked lead → status='signe' if not already past it
//   3. If acompte_amount > 0 AND no acompte invoice exists yet for this
//      devis → auto-generates an FA-YYYY-XXXX (status='envoye') so the
//      planificatrice's queue picks it up immediately.
//
// Idempotent: signing an already-signed devis returns ok=true with no-op.
// The acompte guard checks `related_devis_id` so re-running this never
// duplicates the deposit invoice.
//
// `mode` records HOW the devis was signed (call 2026-08-02):
//   logiciel      = via the e-signature software
//   planificateur = marked signed manually by a planner
// It's persisted on the lead as sub_signature_mode for analytics. When
// omitted (e.g. legacy callers) the mode is simply left unchanged.
//
// Step 2.5 creates the `dossier` so the deal lands in the planificatrice's
// queue (/planification). Before this, signing generated the acompte but no
// dossier → the handoff was broken.
export type MarkSignedResult =
  | { ok: true; acompteId?: string; acompteNum?: string }
  | { ok: false; error: string };

export async function markDocumentSigned(
  id: string,
  mode?: SubSignatureMode,
): Promise<MarkSignedResult> {
  const supabase = await supabaseServer();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select(
      "id, type, status, num, lead_id, client_id, entity_id, activity_id, " +
      "payment_term_id, total_ht, total_vat, total_ttc, " +
      "acompte_pct, acompte_amount, solde_du",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      type: DocumentType;
      status: string;
      num: string;
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
    }>();
  if (docErr || !doc) return { ok: false, error: "Document introuvable." };
  if (doc.type !== "devis") return { ok: false, error: "Seul un devis peut être signé." };
  if (doc.status === "refuse") return { ok: false, error: "Un devis refusé ne peut pas être signé." };

  const now = new Date().toISOString();

  // ── 1. Devis status update (only if not already signed) ──────────────
  if (doc.status !== "signe") {
    const docUpdate: DocumentUpdate = { status: "signe", signed_at: now };
    const { error: signErr } = await supabase
      .from("documents")
      .update(docUpdate as never)
      .eq("id", id);
    if (signErr) return { ok: false, error: `Signature : ${signErr.message}` };
  }

  // ── 2. Lead status sync (+ signature mode) ───────────────────────────
  if (doc.lead_id) {
    const leadUpdate: Record<string, unknown> = {
      status: "signe",
      last_action_label: `Devis ${doc.num} signé`,
      last_action_at: now,
    };
    // Only touch sub_signature_mode when a mode was passed — keeps re-signs
    // and legacy callers from wiping an existing value.
    if (mode) leadUpdate.sub_signature_mode = mode;
    await supabase
      .from("leads")
      .update(leadUpdate as never)
      .eq("id", doc.lead_id)
      .in("status", ["lead", "envoye", "ouvert"]);
    // The status guard above skips already-signed leads, but the mode should
    // still be recorded on a re-sign — apply it unconditionally in that case.
    if (mode) {
      await supabase
        .from("leads")
        .update({ sub_signature_mode: mode } as never)
        .eq("id", doc.lead_id);
    }
  }

  // ── 2.5 Dossier creation — handoff to Planification ──────────────────
  // Signing hands the deal to the planificatrice. Create the dossier now so
  // it shows up in /planification (CDC handoff, client 2026-08-02). Uses the
  // service role because dossiers RLS only allows admin/planner writes, yet a
  // *commercial* signing their own devis must still trigger creation.
  // Idempotent: one dossier per lead.
  if (doc.lead_id) {
    const admin = await supabaseServiceRole();
    const { data: existingDossier } = await admin
      .from("dossiers")
      .select("id")
      .eq("lead_id", doc.lead_id)
      .maybeSingle<{ id: string }>();
    if (!existingDossier) {
      const { data: leadRow } = await admin
        .from("leads")
        .select("client_address")
        .eq("id", doc.lead_id)
        .maybeSingle<{ client_address: unknown }>();
      const dossierInsert: DossierInsert = {
        lead_id: doc.lead_id,
        quote_document_id: id,
        status: "a_planifier",
        payment_status: "en_attente",
        address: (leadRow?.client_address ?? null) as DossierInsert["address"],
      };
      await admin.from("dossiers").insert(dossierInsert as never);
    }
  }

  // ── 3. Acompte auto-generation ───────────────────────────────────────
  // Only when an acompte amount was actually set on the devis. The CDC §2.3
  // expects this trigger on "Signé · Avec acompte" — we treat acompte_amount
  // as the authoritative signal (a devis with 0% acompte simply never
  // produced an FA), independent of the lead's sub_signature flag.
  if (doc.acompte_amount && doc.acompte_amount > 0) {
    // Idempotency guard: if an acompte already exists for this devis,
    // skip generation. The (related_devis_id, type='acompte') pair is
    // effectively unique by business rule.
    const { data: existing } = await supabase
      .from("documents")
      .select("id, num")
      .eq("related_devis_id", id)
      .eq("type", "acompte")
      .maybeSingle<{ id: string; num: string }>();
    if (existing) {
      revalidatePath("/comptabilite");
      revalidatePath(`/devis/${id}`);
      if (doc.lead_id) revalidatePath(`/leads/${doc.lead_id}`);
      await auditLog({
        action: "document.signed",
        entityType: "document",
        entityId: id,
        after: { num: doc.num, acompte_existing: existing.num },
      });
      return { ok: true, acompteId: existing.id, acompteNum: existing.num };
    }

    // Allocate FA number via the gapless sequence.
    const year = new Date(now).getFullYear();
    const { data: numData, error: numErr } = await supabase.rpc(
      "next_doc_num",
      { p_type: "acompte", p_year: year } as never,
    );
    if (numErr || !numData) {
      return { ok: false, error: `Allocation numéro acompte : ${numErr?.message ?? "inconnu"}.` };
    }
    const num = numData as string;

    // The acompte VAT inherits the devis's effective VAT ratio so the FA
    // matches the devis's tax profile. For a single-VAT-rate devis this
    // produces the exact same rate; for a mixed-rate devis it produces the
    // weighted average — the right answer for an acompte that doesn't
    // detail individual lines.
    const ttc = doc.acompte_amount;
    const ratio = doc.total_ttc > 0 ? doc.total_ht / doc.total_ttc : 1;
    const totalHt = Math.round(ttc * ratio * 100) / 100;
    const totalVat = Math.round((ttc - totalHt) * 100) / 100;

    const acomptePayload: DocumentInsert = {
      type: "acompte",
      num,
      status: "envoye",
      lead_id: doc.lead_id,
      client_id: doc.client_id,
      entity_id: doc.entity_id,
      activity_id: doc.activity_id,
      payment_term_id: doc.payment_term_id,
      issued_at: now,
      total_ht: totalHt,
      total_vat: totalVat,
      total_ttc: ttc,
      acompte_pct: doc.acompte_pct,
      acompte_amount: ttc,
      related_devis_id: id,
    };
    const { data: ins, error: insErr } = await supabase
      .from("documents")
      .insert(acomptePayload as never)
      .select("id, num")
      .maybeSingle<{ id: string; num: string }>();
    if (insErr || !ins) {
      return { ok: false, error: `Création FA : ${insErr?.message ?? "inconnu"}.` };
    }

    // Single descriptive line on the acompte. Lets the PDF/preview render
    // a sensible body without having to join back to the devis lines.
    const lineLabel = `Acompte ${doc.acompte_pct ?? Math.round((ttc / doc.total_ttc) * 100)}% sur devis ${doc.num}`;
    await supabase
      .from("document_lines")
      .insert([
        {
          document_id: ins.id,
          label: lineLabel,
          quantity: 1,
          unit: "forfait",
          unit_price_ht: totalHt,
          vat_rate: doc.total_ht > 0 ? Math.round((totalVat / totalHt) * 10000) / 100 : 0,
          discount_pct: 0,
          total_ht: totalHt,
          order_index: 0,
        },
      ] as never);

    revalidatePath("/comptabilite");
    revalidatePath(`/devis/${id}`);
    if (doc.lead_id) revalidatePath(`/leads/${doc.lead_id}`);
    revalidatePath("/planification");
    await auditLog({
      action: "document.signed",
      entityType: "document",
      entityId: id,
      after: { num: doc.num, acompte_num: ins.num, acompte_id: ins.id },
    });
    await auditLog({
      action: "document.acompte.auto_create",
      entityType: "document",
      entityId: ins.id,
      after: { num: ins.num, source_devis: doc.num, amount_ttc: ttc },
    });
    return { ok: true, acompteId: ins.id, acompteNum: ins.num };
  }

  // No acompte path
  revalidatePath("/comptabilite");
  revalidatePath(`/devis/${id}`);
  if (doc.lead_id) revalidatePath(`/leads/${doc.lead_id}`);
  await auditLog({
    action: "document.signed",
    entityType: "document",
    entityId: id,
    after: { num: doc.num, acompte: null },
  });
  return { ok: true };
}

// ── Mark a devis as refused with a capture motif. CDC §2.3 / §4.4:
// captures WHY the devis was rejected so the commercial can issue a
// follow-up devis with adjusted pricing/scope. Only valid on devis (and
// only when the devis isn't already signe/paye).
export async function markDocumentRefused(
  id: string,
  reason: string,
): Promise<Result> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Motif de refus requis." };

  const supabase = await supabaseServer();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, type, status, lead_id")
    .eq("id", id)
    .maybeSingle<{ id: string; type: DocumentType; status: string; lead_id: string | null }>();
  if (!doc) return { ok: false, error: "Document introuvable." };
  if (doc.type !== "devis") return { ok: false, error: "Seul un devis peut être refusé." };
  if (doc.status === "signe") return { ok: false, error: "Un devis signé ne peut pas être refusé." };
  if (doc.status === "refuse") return { ok: false, error: "Devis déjà refusé." };

  const updates: DocumentUpdate = {
    status: "refuse",
    refusal_reason: trimmed,
  };
  const { error } = await supabase.from("documents").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/comptabilite");
  revalidatePath(`/devis/${id}`);
  if (doc.lead_id) revalidatePath(`/leads/${doc.lead_id}`);
  await auditLog({
    action: "document.mark_refused",
    entityType: "document",
    entityId: id,
    after: { reason: trimmed },
  });
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
    .select("id, type, status, num, lead_id")
    .eq("id", id)
    .maybeSingle<{ id: string; type: DocumentType; status: string; num: string; lead_id: string | null }>();
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

    // Facture FINALE payée → le lead passe à « Encaissé » (fin du cycle).
    // Relie le paiement au statut du pipeline (correctif du défaut #3 : avant,
    // marquer la finale payée ne faisait pas avancer le lead).
    if (doc.type === "finale") {
      await supabase
        .from("leads")
        .update({
          status: "encaisse",
          last_action_label: `Facture ${doc.num ?? "finale"} payée`,
          last_action_at: now,
        } as never)
        .eq("id", doc.lead_id)
        .neq("status", "encaisse");
      revalidatePath("/pipeline");
      revalidatePath("/leads");
      revalidatePath(`/leads/${doc.lead_id}`);
    }
  }

  revalidatePath("/comptabilite");
  revalidatePath("/planification");
  revalidatePath(`/factures/${id}`);
  await auditLog({
    action: "document.mark_paid",
    entityType: "document",
    entityId: id,
    after: { type: doc.type, paymentReference: paymentReference.trim() || null },
  });
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
  await auditLog({
    action: "document.duplicate",
    entityType: "document",
    entityId: inserted.id,
    before: { sourceId: id },
    after: { num: inserted.num, type: src.type },
  });
  return { ok: true, id: inserted.id, num: inserted.num };
}

export type SendEmailInput = {
  recipient: string;
  subject: string;
  message: string; // plain text — wrapped into a minimal HTML envelope below
};

// ── Send a document by email via Brevo. Attaches the PDF rendered on the
// fly from the same DocumentPdf component used by the preview route, so
// the user gets exactly what they see in the browser. On success persists
// sent_to_email + bumps a devis-brouillon to envoyé (it has actually been
// sent now, not just marked).
export async function sendDocumentByEmail(
  id: string,
  input: SendEmailInput,
): Promise<Result> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient)) {
    return { ok: false, error: "Email destinataire invalide." };
  }
  if (!input.subject.trim()) return { ok: false, error: "Objet requis." };

  // Fetch + render server-side. RLS scopes the read; if the caller can't
  // see the doc, getDocumentById returns null and we 404 early.
  const detail = await getDocumentById(id);
  if (!detail) return { ok: false, error: "Document introuvable." };

  const pdfBytes = await renderToBuffer(DocumentPdf({ detail }));

  // Minimal HTML wrapper — preserves linebreaks from the textarea. Brevo
  // also accepts text-only via `textContent` but HTML renders better in
  // mainstream clients.
  const htmlContent = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1f3a;">
${escapeHtml(input.message).replace(/\n/g, "<br>")}
<hr style="margin-top:24px;border:none;border-top:1px solid #d8dbe8;">
<p style="color:#666e8a;font-size:12px;">${escapeHtml(detail.entity.legalName)} · ${detail.doc.num} ci-joint en PDF.</p>
</div>`;

  const result = await sendBrevoEmail({
    to: input.recipient.trim(),
    toName: detail.lead.client,
    subject: input.subject.trim(),
    htmlContent,
    attachment: {
      name: `${detail.doc.num}.pdf`,
      bytes: pdfBytes,
    },
  });
  if (!result.ok) return { ok: false, error: `Brevo : ${result.error}` };

  // Persist send tracking. If it was a brouillon devis, transition to envoye
  // (we sent it — same semantics as Marquer envoyé, just real this time).
  const supabase = await supabaseServer();
  const updates: DocumentUpdate = {
    sent_to_email: input.recipient.trim(),
    ...(detail.doc.type === "devis" && detail.doc.status === "brouillon"
      ? { status: "envoye" as const }
      : {}),
  };
  await supabase
    .from("documents")
    .update(updates as never)
    .eq("id", id);

  revalidatePath("/comptabilite");
  revalidatePath(`/${detail.doc.type === "devis" ? "devis" : "factures"}/${id}`);
  await auditLog({
    action: "document.send_email",
    entityType: "document",
    entityId: id,
    after: {
      recipient: input.recipient.trim(),
      subject: input.subject.trim(),
      type: detail.doc.type,
    },
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

