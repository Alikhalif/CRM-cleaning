"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { sendBrevoEmail } from "@/lib/brevo";
import {
  allocateContractRef, getContractTemplateByKey, renderAndUploadContractPdf,
} from "@/lib/documents/contracts-server";
import { CLIENT_DOCS_BUCKET } from "@/lib/documents/documents-server";
import { passagesFromFrequency, type ContractStatus, type FieldValue } from "@/lib/documents/contracts-types";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: ContractStatus[] = ["actif", "a_renouveler", "expire", "resilie", "en_attente_signature"];

export type CreateContractPayload = {
  templateKey: string;
  title?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  amount?: number | null;
  billingMode?: string;
  values: Record<string, FieldValue>;
};

// Crée un contrat : génère le PDF (template + valeurs), l'archive et l'ajoute au
// registre documentaire du client. Statut initial : en attente de signature.
export async function createContract(clientId: string, payload: CreateContractPayload): Promise<Result> {
  if (!UUID_RE.test(clientId)) return { ok: false, error: "Client invalide." };
  const template = await getContractTemplateByKey(payload.templateKey);
  if (!template) return { ok: false, error: "Modèle de contrat introuvable." };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const title = (payload.title ?? "").trim() || template.name;
  const values = payload.values ?? {};

  let ref: string;
  let pdfPath: string;
  try {
    ref = await allocateContractRef();
    pdfPath = await renderAndUploadContractPdf({ clientId, ref, title, template, values });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data: inserted, error } = await supabase
    .from("contracts")
    .insert({
      ref,
      client_id: clientId,
      template_key: template.key,
      category: template.category,
      title,
      status: "en_attente_signature",
      start_date: payload.startDate || null,
      end_date: payload.endDate || null,
      frequency: payload.frequency || null,
      passages_per_year: passagesFromFrequency(payload.frequency),
      amount: payload.amount ?? null,
      billing_mode: payload.billingMode || null,
      data: values,
      pdf_path: pdfPath,
      created_by: user.id,
    } as never)
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) {
    const admin = await supabaseServiceRole();
    await admin.storage.from(CLIENT_DOCS_BUCKET).remove([pdfPath]); // rollback PDF orphelin
    return { ok: false, error: `Création refusée : ${error?.message ?? "inconnue"}` };
  }

  // Rattache au registre documentaire (onglet Documents).
  await supabase.from("client_documents").insert({
    client_id: clientId,
    contract_id: inserted.id,
    kind: "contrat",
    category: template.category,
    title,
    ref,
    storage_path: pdfPath,
    file_name: `${ref}.pdf`,
    mime_type: "application/pdf",
    source: "genere",
    status: "en_attente_signature",
    created_by: user.id,
  } as never);

  // Génère le calendrier des passages (§10) si une fréquence récurrente est connue.
  const n = passagesFromFrequency(payload.frequency);
  if (n && n >= 1 && n <= 12) {
    const rows = Array.from({ length: n }, (_, i) => ({
      contract_id: inserted.id, index: i + 1, target_label: `Passage ${i + 1}`, status: "a_planifier",
    }));
    await supabase.from("contract_passages").insert(rows as never);
  }

  revalidatePath(`/clients/${clientId}`);
  await auditLog({ action: "client.contract.create", entityType: "client", entityId: clientId, after: { ref, template: template.key, passages: n ?? 0 } });
  return { ok: true, id: inserted.id };
}

// Met à jour un passage (statut/date/notes/dossier) et resynchronise le compteur
// « passages réalisés » du contrat.
export async function updatePassage(
  passageId: string,
  patch: { status?: string; plannedAt?: string | null; notes?: string; dossierId?: string | null },
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: p } = await supabase
    .from("contract_passages").select("id, contract_id, status").eq("id", passageId)
    .maybeSingle<{ id: string; contract_id: string; status: string }>();
  if (!p) return { ok: false, error: "Passage introuvable." };

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) {
    upd.status = patch.status;
    upd.realized_at = patch.status === "realise" ? new Date().toISOString() : null;
  }
  if (patch.plannedAt !== undefined) upd.planned_at = patch.plannedAt || null;
  if (patch.notes !== undefined) upd.notes = patch.notes.trim() || null;
  if (patch.dossierId !== undefined) upd.dossier_id = patch.dossierId || null;

  const { error } = await supabase.from("contract_passages").update(upd as never).eq("id", passageId);
  if (error) return { ok: false, error: `Échec : ${error.message}` };

  // Resync du compteur « passages réalisés » du contrat.
  const { count } = await supabase
    .from("contract_passages").select("id", { count: "exact", head: true })
    .eq("contract_id", p.contract_id).eq("status", "realise");
  await supabase.from("contracts")
    .update({ passages_done: count ?? 0, updated_at: new Date().toISOString() } as never)
    .eq("id", p.contract_id);

  const { data: c } = await supabase
    .from("contracts").select("client_id").eq("id", p.contract_id)
    .maybeSingle<{ client_id: string }>();
  if (c) revalidatePath(`/clients/${c.client_id}`);
  await auditLog({ action: "client.passage.update", entityType: "client", entityId: c?.client_id ?? null, after: { passageId, ...patch } });
  return { ok: true };
}

// Change le statut (§8). « actif » pose la date de signature si absente.
export async function setContractStatus(contractId: string, status: string): Promise<Result> {
  if (!(STATUSES as string[]).includes(status)) return { ok: false, error: "Statut invalide." };
  const supabase = await supabaseServer();
  const { data: row } = await supabase
    .from("contracts").select("id, client_id, signed_date").eq("id", contractId)
    .maybeSingle<{ id: string; client_id: string; signed_date: string | null }>();
  if (!row) return { ok: false, error: "Contrat introuvable." };

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "actif" && !row.signed_date) patch.signed_date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("contracts").update(patch as never).eq("id", contractId);
  if (error) return { ok: false, error: `Échec : ${error.message}` };

  // Reflète l'état signé sur la ligne du registre.
  if (status === "actif") {
    await supabase.from("client_documents")
      .update({ signed: true, signed_at: new Date().toISOString(), status: "actif" } as never)
      .eq("contract_id", contractId);
  }
  revalidatePath(`/clients/${row.client_id}`);
  await auditLog({ action: "client.contract.status", entityType: "client", entityId: row.client_id, after: { contractId, status } });
  return { ok: true };
}

// Renouvelle : duplique le contrat (mêmes données), nouvelles dates, nouveau n°.
export async function renewContract(contractId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { data: c } = await supabase
    .from("contracts")
    .select("client_id, template_key, category, title, frequency, passages_per_year, amount, billing_mode, data, start_date, end_date")
    .eq("id", contractId)
    .maybeSingle<{ client_id: string; template_key: string | null; category: string | null; title: string; frequency: string | null; passages_per_year: number | null; amount: number | null; billing_mode: string | null; data: Record<string, FieldValue>; start_date: string | null; end_date: string | null }>();
  if (!c) return { ok: false, error: "Contrat introuvable." };
  if (!c.template_key) return { ok: false, error: "Modèle du contrat inconnu — recréez-le manuellement." };

  // Reconduit l'échéance : même durée que le contrat d'origine (repli 1 an) pour
  // que l'alerte de renouvellement reparte sur le contrat renouvelé. Si l'origine
  // n'avait pas de date de fin, on laisse ouvert (pas d'alerte, comme avant).
  const today = new Date();
  let endDate: string | undefined;
  if (c.end_date) {
    const oneYearMs = 365 * 24 * 3600 * 1000;
    const termMs = c.start_date
      ? Math.max(new Date(c.end_date).getTime() - new Date(c.start_date).getTime(), oneYearMs)
      : oneYearMs;
    endDate = new Date(today.getTime() + termMs).toISOString().slice(0, 10);
  }

  const res = await createContract(c.client_id, {
    templateKey: c.template_key,
    title: c.title,
    frequency: c.frequency ?? undefined,
    startDate: today.toISOString().slice(0, 10),
    endDate,
    amount: c.amount,
    billingMode: c.billing_mode ?? undefined,
    values: c.data ?? {},
  });
  if (!res.ok) return res;
  // L'ancien passe « expiré ».
  await supabase.from("contracts").update({ status: "expire", updated_at: new Date().toISOString() } as never).eq("id", contractId);
  revalidatePath(`/clients/${c.client_id}`);
  return res;
}

// Suppression (soft) du contrat + de sa ligne registre + retrait du PDF.
export async function deleteContract(contractId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { data: c } = await supabase
    .from("contracts").select("id, client_id, pdf_path").eq("id", contractId)
    .maybeSingle<{ id: string; client_id: string; pdf_path: string | null }>();
  if (!c) return { ok: false, error: "Contrat introuvable." };

  const { error } = await supabase.from("contracts")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id } as never).eq("id", contractId);
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };

  await supabase.from("client_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id } as never)
    .eq("contract_id", contractId);
  if (c.pdf_path) {
    const admin = await supabaseServiceRole();
    await admin.storage.from(CLIENT_DOCS_BUCKET).remove([c.pdf_path]);
  }
  revalidatePath(`/clients/${c.client_id}`);
  await auditLog({ action: "client.contract.delete", entityType: "client", entityId: c.client_id, after: { contractId } });
  return { ok: true };
}

// Envoi du contrat au client par email (PDF en lien signé 7 j).
export async function sendContract(contractId: string, toOverride?: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("contracts").select("id, client_id, ref, title, pdf_path").eq("id", contractId)
    .maybeSingle<{ id: string; client_id: string; ref: string | null; title: string; pdf_path: string | null }>();
  if (!c) return { ok: false, error: "Contrat introuvable." };
  if (!c.pdf_path) return { ok: false, error: "Aucun PDF à envoyer." };

  const { data: client } = await supabase
    .from("clients").select("email, name").eq("id", c.client_id)
    .maybeSingle<{ email: string | null; name: string | null }>();
  const to = (toOverride || client?.email || "").trim();
  if (!to) return { ok: false, error: "Aucun email client." };

  const admin = await supabaseServiceRole();
  const { data: signed } = await admin.storage.from(CLIENT_DOCS_BUCKET).createSignedUrl(c.pdf_path, 7 * 24 * 3600);
  const url = signed?.signedUrl;
  if (!url) return { ok: false, error: "Lien du document indisponible." };

  const html =
    `<p>Bonjour,</p><p>Veuillez trouver votre contrat <strong>${c.title}</strong> (réf. ${c.ref ?? ""}).</p>` +
    `<p><a href="${url}">Consulter / télécharger le contrat</a> (lien valable 7 jours).</p>` +
    `<p>Cordialement,</p>`;
  const res = await sendBrevoEmail({ to, subject: `Votre contrat — ${c.title}`, htmlContent: html });
  if (!res.ok) return { ok: false, error: `Envoi email : ${res.error}` };

  await supabase.from("contracts").update({ sent_to: to, sent_at: new Date().toISOString() } as never).eq("id", contractId);
  revalidatePath(`/clients/${c.client_id}`);
  await auditLog({ action: "client.contract.sent", entityType: "client", entityId: c.client_id, after: { contractId, to } });
  return { ok: true };
}
