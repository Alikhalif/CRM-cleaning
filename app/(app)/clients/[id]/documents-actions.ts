"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { CLIENT_DOCS_BUCKET } from "@/lib/documents/documents-server";
import { DOC_CATEGORIES, DOC_KINDS, type DocCategory, type DocKind } from "@/lib/documents/types";
import { isActivityTag } from "@/lib/documents/tags";

export type Result = { ok: true } | { ok: false; error: string };

const MAX_BYTES = 25 * 1024 * 1024; // 25 Mo / fichier
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Types acceptés : PDF + images courantes. Exclut SVG/HTML (XSS via URL signée).
const OK_MIME = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
]);

function extOf(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (mime.split("/")[1] ?? "bin").toLowerCase();
}

// Ajout d'un document au registre du client. Objet → bucket privé (service
// role) ; ligne → client de session (RLS : created_by = auth.uid()).
export async function uploadClientDocument(clientId: string, formData: FormData): Promise<Result> {
  if (!UUID_RE.test(clientId)) return { ok: false, error: "Client invalide." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Aucun fichier sélectionné." };

  const kindRaw = String(formData.get("kind") ?? "piece_jointe");
  const kind: DocKind = (DOC_KINDS as string[]).includes(kindRaw) ? (kindRaw as DocKind) : "piece_jointe";
  const catRaw = String(formData.get("category") ?? "");
  const category: DocCategory | null = (DOC_CATEGORIES as string[]).includes(catRaw) ? (catRaw as DocCategory) : null;
  const titleInput = String(formData.get("title") ?? "").trim();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const admin = await supabaseServiceRole();
  let uploaded = 0;

  for (const file of files) {
    const mime = (file.type || "").toLowerCase();
    if (!OK_MIME.has(mime)) return { ok: false, error: `Type non supporté : ${file.name} (PDF ou image).` };
    if (file.size > MAX_BYTES) return { ok: false, error: `Fichier trop volumineux : ${file.name} (max 25 Mo).` };

    const path = `${clientId}/${crypto.randomUUID()}.${extOf(file.name, mime)}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const up = await admin.storage.from(CLIENT_DOCS_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (up.error) return { ok: false, error: `Envoi impossible (${file.name}) : ${up.error.message}` };

    const { error: rowErr } = await supabase.from("client_documents").insert({
      client_id: clientId,
      kind,
      category,
      title: titleInput || file.name,
      file_name: file.name,
      mime_type: mime,
      size_bytes: file.size,
      storage_path: path,
      source: "upload",
      created_by: user.id,
    } as never);
    if (rowErr) {
      await admin.storage.from(CLIENT_DOCS_BUCKET).remove([path]); // rollback objet orphelin
      return { ok: false, error: `Enregistrement refusé (${file.name}) : ${rowErr.message}` };
    }
    uploaded++;
  }

  revalidatePath(`/clients/${clientId}`);
  await auditLog({ action: "client.document.upload", entityType: "client", entityId: clientId, after: { count: uploaded, kind } });
  return { ok: true };
}

// Suppression (soft-delete) + retrait de l'objet. RLS : auteur / admin / planif.
export async function deleteClientDocument(docId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: row } = await supabase
    .from("client_documents")
    .select("id, client_id, storage_path")
    .eq("id", docId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; client_id: string; storage_path: string | null }>();
  if (!row) return { ok: false, error: "Document introuvable." };

  const { error } = await supabase
    .from("client_documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id } as never)
    .eq("id", docId);
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };

  if (row.storage_path) {
    const admin = await supabaseServiceRole();
    await admin.storage.from(CLIENT_DOCS_BUCKET).remove([row.storage_path]);
  }

  revalidatePath(`/clients/${row.client_id}`);
  await auditLog({ action: "client.document.delete", entityType: "client", entityId: row.client_id, after: { docId } });
  return { ok: true };
}

// Enregistre les cases « Activités / Contrats » de la fiche client.
export async function updateClientActivityTags(clientId: string, tags: string[]): Promise<Result> {
  if (!UUID_RE.test(clientId)) return { ok: false, error: "Client invalide." };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const clean = [...new Set(tags.filter(isActivityTag))];
  const admin = await supabaseServiceRole();
  const { error } = await admin.from("clients").update({ activity_tags: clean } as never).eq("id", clientId);
  if (error) return { ok: false, error: `Échec : ${error.message}` };

  revalidatePath(`/clients/${clientId}`);
  await auditLog({ action: "client.tags.update", entityType: "client", entityId: clientId, after: { tags: clean } });
  return { ok: true };
}
