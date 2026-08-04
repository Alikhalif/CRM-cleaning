"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { sendBrevoEmail, PLANIF_SENDER } from "@/lib/brevo";
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

// Partage des médias du dossier à un intervenant (sous-traitant) : envoie un
// email avec des LIENS signés (valables 7 jours) vers chaque photo/vidéo — pas
// de pièces jointes lourdes. Sender = planning dédié. Client 2026-08-03.
export async function shareLeadMediaWithIntervenant(
  leadId: string,
  recipient: string,
  message: string,
): Promise<Result> {
  const to = recipient.trim();
  if (!to) return { ok: false, error: "Email de l'intervenant requis." };

  const supabase = await supabaseServer();
  // Lu avec la session → la RLS garantit l'accès au dossier.
  const { data: rows, error } = await supabase
    .from("lead_media")
    .select("id, storage_path, file_name, kind")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<{ id: string; storage_path: string; file_name: string; kind: string }[]>();
  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) return { ok: false, error: "Aucun média à partager." };

  // Liens signés longue durée (7 jours) via le service role (bucket privé).
  const admin = await supabaseServiceRole();
  const { data: signed } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 7 * 24 * 3600);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);

  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = rows
    .map((r) => {
      const url = urlByPath.get(r.storage_path);
      const tag = r.kind === "video" ? "Vidéo" : "Photo";
      return url ? `<li>${tag} — <a href="${url}">${esc(r.file_name)}</a></li>` : "";
    })
    .filter(Boolean)
    .join("");
  const intro = message.trim() ? `${esc(message.trim()).replace(/\n/g, "<br>")}<br><br>` : "";
  const html =
    `${intro}Bonjour,<br><br>Veuillez trouver ci-dessous les photos et vidéos du chantier ` +
    `(liens valables 7 jours) :<br><ul>${items}</ul><br>` +
    `Bien professionnellement,<br>La planificatrice<br>Optimivv`;

  const res = await sendBrevoEmail({
    to,
    subject: "Photos & vidéos du chantier",
    htmlContent: html,
    senderEmail: PLANIF_SENDER.email,
    senderName: PLANIF_SENDER.name,
  });
  if (!res.ok) return { ok: false, error: `Envoi email : ${res.error}` };

  await auditLog({ action: "lead.media.share", entityType: "lead", entityId: leadId, after: { recipient: to, count: rows.length } });
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
