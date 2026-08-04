"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { MEDIA_BUCKET } from "@/lib/media-server";

export type Result = { ok: true } | { ok: false; error: string };

const MAX_BYTES = 100 * 1024 * 1024; // 100 Mo / fichier

function kindOf(mime: string): "photo" | "video" | null {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  return null;
}

function extOf(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (mime.split("/")[1] ?? "bin").toLowerCase();
}

// Upload d'un ou plusieurs fichiers vers le dossier. Le fichier va dans le
// bucket privé (service role), la ligne lead_media est insérée avec le client
// de session (la RLS vérifie le droit : propriétaire / planificatrice / admin).
export async function uploadLeadMedia(leadId: string, formData: FormData): Promise<Result> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Aucun fichier sélectionné." };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const admin = await supabaseServiceRole();
  let uploaded = 0;

  for (const file of files) {
    const kind = kindOf(file.type);
    if (!kind) return { ok: false, error: `Type non supporté : ${file.name} (photos et vidéos uniquement).` };
    if (file.size > MAX_BYTES) return { ok: false, error: `Fichier trop volumineux : ${file.name} (max 100 Mo).` };

    const path = `${leadId}/${crypto.randomUUID()}.${extOf(file.name, file.type)}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: `Envoi impossible (${file.name}) : ${upErr.message}` };

    const { error: rowErr } = await supabase.from("lead_media").insert({
      lead_id: leadId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      kind,
      size_bytes: file.size,
      uploaded_by: user.id,
    } as never);
    if (rowErr) {
      // Rollback de l'objet orphelin si la RLS refuse l'insertion.
      await admin.storage.from(MEDIA_BUCKET).remove([path]);
      return { ok: false, error: `Enregistrement refusé (${file.name}) : ${rowErr.message}` };
    }
    uploaded++;
  }

  revalidatePath(`/leads/${leadId}`);
  await auditLog({ action: "lead.media.upload", entityType: "lead", entityId: leadId, after: { count: uploaded } });
  return { ok: true };
}

// Suppression : la RLS n'autorise que l'auteur ou un admin. On supprime la
// ligne puis l'objet de stockage.
export async function deleteLeadMedia(mediaId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: row, error: readErr } = await supabase
    .from("lead_media")
    .select("id, lead_id, storage_path")
    .eq("id", mediaId)
    .maybeSingle<{ id: string; lead_id: string; storage_path: string }>();
  if (readErr || !row) return { ok: false, error: "Média introuvable." };

  const { error: delErr } = await supabase.from("lead_media").delete().eq("id", mediaId);
  if (delErr) return { ok: false, error: `Suppression refusée : ${delErr.message}` };

  const admin = await supabaseServiceRole();
  await admin.storage.from(MEDIA_BUCKET).remove([row.storage_path]);

  revalidatePath(`/leads/${row.lead_id}`);
  await auditLog({ action: "lead.media.delete", entityType: "lead", entityId: row.lead_id, after: { mediaId } });
  return { ok: true };
}

// Commentaire (interne) sur un média — auteur / planificatrice / admin (RLS).
export async function updateMediaComment(mediaId: string, comment: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: row } = await supabase
    .from("lead_media")
    .select("lead_id")
    .eq("id", mediaId)
    .maybeSingle<{ lead_id: string }>();
  const { error } = await supabase
    .from("lead_media")
    .update({ comment: comment.trim() || null } as never)
    .eq("id", mediaId);
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  if (row) revalidatePath(`/leads/${row.lead_id}`);
  return { ok: true };
}
