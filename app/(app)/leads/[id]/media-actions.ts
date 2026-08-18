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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowlist stricte des types acceptés. Exclut volontairement image/svg+xml
// (et tout HTML) : un SVG servi inline via URL signée exécuterait du script
// dans le navigateur du visionneur (stored XSS).
const PHOTO_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
]);
const VIDEO_MIME = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska",
]);

function kindOf(mime: string): "photo" | "video" | null {
  const m = (mime ?? "").toLowerCase();
  if (PHOTO_MIME.has(m)) return "photo";
  if (VIDEO_MIME.has(m)) return "video";
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
  if (!UUID_RE.test(leadId)) return { ok: false, error: "Dossier invalide." };
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

const escHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Consultation intervenant (demande de chiffrage) — RÉSERVÉE à la planificatrice
// (gérée par la RLS de intervenant_consultations + l'UI). Le corps (template
// chiffrage, déjà pré-rempli côté client, SANS adresse) est envoyé avec les
// liens signés (7 j) des médias en pièces liées, puis la consultation est
// tracée dans l'historique. Client 2026-08-05.
export async function sendConsultation(
  leadId: string,
  input: { recipient: string; subject: string; message: string; intervenantId?: string; templateName?: string },
): Promise<Result> {
  const to = input.recipient.trim();
  const subject = input.subject.trim() || "Demande de chiffrage";
  const message = input.message.trim();
  if (!to) return { ok: false, error: "Email de l'intervenant requis." };
  if (!message) return { ok: false, error: "Message requis." };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  // Réservé admin / planificatrice : la consultation envoie un e-mail sous
  // l'identité du service planification — pas de relais ouvert.
  const { data: myRoles } = await supabase
    .from("user_roles")
    .select("roles(slug)")
    .eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  const allowed = (myRoles ?? []).some((r) => r.roles?.slug === "admin" || r.roles?.slug === "planification");
  if (!allowed) return { ok: false, error: "Réservé à la planification." };

  const { data: rows } = await supabase
    .from("lead_media")
    .select("storage_path, file_name, kind")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<{ storage_path: string; file_name: string; kind: string }[]>();
  const media = rows ?? [];

  // Liens signés 7 jours (bucket privé) via le service role.
  let itemsHtml = "";
  if (media.length > 0) {
    const admin = await supabaseServiceRole();
    const { data: signed } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(media.map((r) => r.storage_path), 3600); // 60 min (CDC §8)
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    itemsHtml = media
      .map((r) => {
        const url = urlByPath.get(r.storage_path);
        return url ? `<li>${r.kind === "video" ? "Vidéo" : "Photo"} — <a href="${url}">${escHtml(r.file_name)}</a></li>` : "";
      })
      .filter(Boolean)
      .join("");
  }

  const html =
    escHtml(message).replace(/\n/g, "<br>") +
    (itemsHtml ? `<br><br>Photos &amp; vidéos (liens valables 7 jours) :<br><ul>${itemsHtml}</ul>` : "");

  const res = await sendBrevoEmail({
    to,
    subject,
    htmlContent: html,
    senderEmail: PLANIF_SENDER.email,
    senderName: PLANIF_SENDER.name,
  });
  if (!res.ok) return { ok: false, error: `Envoi email : ${res.error}` };

  // Trace dans l'historique (RLS : planif/admin uniquement).
  await supabase.from("intervenant_consultations").insert({
    lead_id: leadId,
    intervenant_email: to,
    intervenant_id: input.intervenantId ?? null,
    template_name: input.templateName ?? null,
    media_count: media.length,
    sent_by: user?.id ?? null,
  } as never);

  revalidatePath(`/leads/${leadId}`);
  await auditLog({ action: "lead.consultation.sent", entityType: "lead", entityId: leadId, after: { recipient: to, mediaCount: media.length } });
  return { ok: true };
}

// Enregistre la réponse d'un intervenant à une consultation (montant, dispos,
// statut) — planificatrice/admin (RLS).
export async function updateConsultationResponse(
  id: string,
  input: { status: string; montantPropose?: number | null; disponibilites?: string; notes?: string },
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: row } = await supabase
    .from("intervenant_consultations")
    .select("lead_id")
    .eq("id", id)
    .maybeSingle<{ lead_id: string }>();

  const upd: Record<string, unknown> = { status: input.status };
  if (input.status !== "envoyee") upd.responded_at = new Date().toISOString();
  if (input.montantPropose !== undefined) upd.montant_propose = input.montantPropose;
  if (input.disponibilites !== undefined) upd.disponibilites = input.disponibilites.trim() || null;
  if (input.notes !== undefined) upd.notes = input.notes.trim() || null;

  const { error } = await supabase.from("intervenant_consultations").update(upd as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}` };
  if (row) revalidatePath(`/leads/${row.lead_id}`);
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
