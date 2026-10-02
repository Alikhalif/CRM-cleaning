"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { SUBCO_BUCKET } from "@/lib/subcontractors-server";
import type { SubcontractorDocType, InvoiceStatus } from "@/lib/subcontractors-shared";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const MAX_BYTES = 25 * 1024 * 1024; // 25 Mo / fichier
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// PDF + images (SVG exclu volontairement : XSS stocké via URL signée).
const ALLOWED_MIME = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);
const PERMANENT_TYPES: SubcontractorDocType[] = ["kbis", "assurance_decennale", "cni_dirigeant", "contrat_sous_traitance"];

// Garde back-office (défense en profondeur, en plus de la RLS admin/planif).
async function ensurePlanner(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { data: roles } = await supabase.from("user_roles").select("roles(slug)").eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  const ok = (roles ?? []).some((r) => r.roles?.slug === "admin" || r.roles?.slug === "planification");
  if (!ok) return { ok: false, error: "Réservé à la planification / l'administration." };
  return { ok: true, userId: user.id };
}

function extOf(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (mime.split("/")[1] ?? "bin").toLowerCase();
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s || null;
}

// Upload optionnel d'un fichier dans le bucket privé du module. Renvoie les
// métadonnées à stocker sur la ligne (ou {} si aucun fichier).
async function maybeUpload(technicianId: string, sub: string, formData: FormData): Promise<
  { ok: true; meta: { storage_path?: string; file_name?: string; mime_type?: string; size_bytes?: number } } | { ok: false; error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: true, meta: {} };
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: `Type non supporté (${file.name}) — PDF ou image.` };
  if (file.size > MAX_BYTES) return { ok: false, error: `Fichier trop volumineux (${file.name}, max 25 Mo).` };
  const path = `${technicianId}/${sub}/${crypto.randomUUID()}.${extOf(file.name, file.type)}`;
  const admin = await supabaseServiceRole();
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(SUBCO_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: `Envoi impossible : ${error.message}` };
  return { ok: true, meta: { storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size } };
}

// ── Identité administrative étendue ─────────────────────────────────────────
export async function saveSubcontractorProfile(technicianId: string, input: {
  raisonSociale?: string; nomCommercial?: string; dirigeant?: string; siret?: string;
  siren?: string; adresse?: string; cpVille?: string; phone?: string; notes?: string;
}): Promise<Result> {
  if (!UUID_RE.test(technicianId)) return { ok: false, error: "Sous-traitant invalide." };
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const supabase = await supabaseServer();
  const row = {
    technician_id: technicianId,
    raison_sociale: input.raisonSociale?.trim() || null,
    nom_commercial: input.nomCommercial?.trim() || null,
    dirigeant: input.dirigeant?.trim() || null,
    siret: input.siret?.trim() || null,
    siren: input.siren?.trim() || null,
    adresse: input.adresse?.trim() || null,
    cp_ville: input.cpVille?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: g.userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("subcontractor_profiles").upsert(row as never, { onConflict: "technician_id" });
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  revalidatePath(`/sous-traitants/${technicianId}`);
  await auditLog({ action: "subcontractor.profile.save", entityType: "user", entityId: technicianId });
  return { ok: true };
}

// ── Document permanent / conformité (versionné) ─────────────────────────────
export async function uploadSubcontractorDocument(technicianId: string, formData: FormData): Promise<Result> {
  if (!UUID_RE.test(technicianId)) return { ok: false, error: "Sous-traitant invalide." };
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const docType = String(formData.get("docType") ?? "") as SubcontractorDocType;
  const allowed: SubcontractorDocType[] = ["kbis", "assurance_decennale", "cni_dirigeant", "contrat_sous_traitance", "autre"];
  if (!allowed.includes(docType)) return { ok: false, error: "Type de document invalide." };

  const up = await maybeUpload(technicianId, "documents", formData);
  if (!up.ok) return up;
  const supabase = await supabaseServer();

  // Versionnage : pour les types « permanents », l'ancienne version est conservée
  // mais n'est plus courante (is_current = false) — jamais de suppression auto.
  let version = 1;
  if (PERMANENT_TYPES.includes(docType)) {
    const { data: prev } = await supabase.from("subcontractor_documents")
      .select("version").eq("technician_id", technicianId).eq("doc_type", docType).is("deleted_at", null)
      .order("version", { ascending: false }).limit(1).maybeSingle<{ version: number }>();
    version = (prev?.version ?? 0) + 1;
    await supabase.from("subcontractor_documents")
      .update({ is_current: false } as never)
      .eq("technician_id", technicianId).eq("doc_type", docType).is("deleted_at", null);
  }

  const title = strOrNull(formData.get("title")) ?? "Document";
  const status = docType === "contrat_sous_traitance"
    ? (String(formData.get("signed") ?? "") === "on" ? "signe" : "non_signe")
    : strOrNull(formData.get("status"));

  const { data, error } = await supabase.from("subcontractor_documents").insert({
    technician_id: technicianId, doc_type: docType, title,
    ...up.meta,
    issued_date: strOrNull(formData.get("issuedDate")),
    start_date: strOrNull(formData.get("startDate")),
    end_date: strOrNull(formData.get("endDate")),
    insurer: strOrNull(formData.get("insurer")),
    contract_number: strOrNull(formData.get("contractNumber")),
    activities: strOrNull(formData.get("activities")),
    version, is_current: true, status,
    notes: strOrNull(formData.get("notes")),
    uploaded_by: g.userId,
  } as never).select("id").maybeSingle<{ id: string }>();

  if (error || !data) {
    if (up.meta.storage_path) { const admin = await supabaseServiceRole(); await admin.storage.from(SUBCO_BUCKET).remove([up.meta.storage_path]); }
    return { ok: false, error: `Enregistrement refusé : ${error?.message ?? "inconnu"}` };
  }
  revalidatePath(`/sous-traitants/${technicianId}`);
  await auditLog({ action: "subcontractor.document.add", entityType: "user", entityId: technicianId, after: { docType, version } });
  return { ok: true, id: data.id };
}

export async function setDocumentContractSigned(id: string, signed: boolean): Promise<Result> {
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const supabase = await supabaseServer();
  const { data: row } = await supabase.from("subcontractor_documents").select("technician_id").eq("id", id).maybeSingle<{ technician_id: string }>();
  const { error } = await supabase.from("subcontractor_documents").update({ status: signed ? "signe" : "non_signe" } as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  if (row) revalidatePath(`/sous-traitants/${row.technician_id}`);
  return { ok: true };
}

export async function deleteSubcontractorDocument(id: string): Promise<Result> {
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const supabase = await supabaseServer();
  const { data: row } = await supabase.from("subcontractor_documents").select("technician_id").eq("id", id).maybeSingle<{ technician_id: string }>();
  const { error } = await supabase.from("subcontractor_documents").update({ deleted_at: new Date().toISOString(), is_current: false } as never).eq("id", id);
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };
  if (row) revalidatePath(`/sous-traitants/${row.technician_id}`);
  await auditLog({ action: "subcontractor.document.delete", entityType: "user", entityId: row?.technician_id ?? "", after: { id } });
  return { ok: true };
}

// ── Factures du sous-traitant ───────────────────────────────────────────────
export async function uploadSubcontractorInvoice(technicianId: string, formData: FormData): Promise<Result> {
  if (!UUID_RE.test(technicianId)) return { ok: false, error: "Sous-traitant invalide." };
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const up = await maybeUpload(technicianId, "invoices", formData);
  if (!up.ok) return up;
  const supabase = await supabaseServer();

  const statusRaw = String(formData.get("status") ?? "recue") as InvoiceStatus;
  const status: InvoiceStatus = (["recue", "a_regler", "reglee", "litige"] as InvoiceStatus[]).includes(statusRaw) ? statusRaw : "recue";
  const dossierId = strOrNull(formData.get("dossierId"));

  const { data, error } = await supabase.from("subcontractor_invoices").insert({
    technician_id: technicianId,
    dossier_id: dossierId && UUID_RE.test(dossierId) ? dossierId : null,
    numero: strOrNull(formData.get("numero")),
    invoice_date: strOrNull(formData.get("invoiceDate")),
    received_at: strOrNull(formData.get("receivedAt")) ?? new Date().toISOString().slice(0, 10),
    amount_ht: numOrNull(formData.get("amountHt")),
    vat_amount: numOrNull(formData.get("vatAmount")),
    amount_ttc: numOrNull(formData.get("amountTtc")),
    status, paid_at: status === "reglee" ? (strOrNull(formData.get("paidAt")) ?? new Date().toISOString().slice(0, 10)) : strOrNull(formData.get("paidAt")),
    ...up.meta,
    notes: strOrNull(formData.get("notes")),
    created_by: g.userId,
  } as never).select("id").maybeSingle<{ id: string }>();

  if (error || !data) {
    if (up.meta.storage_path) { const admin = await supabaseServiceRole(); await admin.storage.from(SUBCO_BUCKET).remove([up.meta.storage_path]); }
    return { ok: false, error: `Enregistrement refusé : ${error?.message ?? "inconnu"}` };
  }
  revalidatePath(`/sous-traitants/${technicianId}`);
  await auditLog({ action: "subcontractor.invoice.add", entityType: "user", entityId: technicianId, after: { id: data.id } });
  return { ok: true, id: data.id };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus, paidAt?: string): Promise<Result> {
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const supabase = await supabaseServer();
  const { data: row } = await supabase.from("subcontractor_invoices").select("technician_id").eq("id", id).maybeSingle<{ technician_id: string }>();
  const upd: Record<string, unknown> = { status };
  if (status === "reglee") upd.paid_at = paidAt || new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("subcontractor_invoices").update(upd as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  if (row) revalidatePath(`/sous-traitants/${row.technician_id}`);
  await auditLog({ action: "subcontractor.invoice.status", entityType: "user", entityId: row?.technician_id ?? "", after: { id, status } });
  return { ok: true };
}

export async function deleteSubcontractorInvoice(id: string): Promise<Result> {
  const g = await ensurePlanner();
  if (!g.ok) return g;
  const supabase = await supabaseServer();
  const { data: row } = await supabase.from("subcontractor_invoices").select("technician_id").eq("id", id).maybeSingle<{ technician_id: string }>();
  const { error } = await supabase.from("subcontractor_invoices").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };
  if (row) revalidatePath(`/sous-traitants/${row.technician_id}`);
  return { ok: true };
}
