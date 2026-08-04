import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";

// Couche données des médias (photos/vidéos) d'un dossier. La liste est lue avec
// le client de session (RLS : propriétaire / planificatrice / admin). Les URLs
// de visualisation sont des URLs signées (TTL 60 min, CDC §8) générées via le
// service role sur le bucket privé « lead-media ».

export const MEDIA_BUCKET = "lead-media";
const SIGNED_TTL = 3600; // 60 min

export type LeadMedia = {
  id: string;
  leadId: string;
  fileName: string;
  mimeType: string;
  kind: "photo" | "video";
  sizeBytes: number | null;
  comment: string | null;
  uploadedBy: string | null;
  uploaderName: string | null;
  createdAt: string;
  url: string | null; // URL signée (visualisation / téléchargement)
  canDelete: boolean; // admin ou auteur
};

type Row = {
  id: string;
  lead_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  kind: "photo" | "video";
  size_bytes: number | null;
  comment: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader: { first_name: string | null; last_name: string | null } | null;
};

export async function getLeadMedia(leadId: string): Promise<LeadMedia[]> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Rôle admin (pour le droit de suppression global).
  let isAdmin = false;
  if (user) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("roles(slug)")
      .eq("user_id", user.id)
      .returns<{ roles: { slug: string } | null }[]>();
    isAdmin = (roles ?? []).some((r) => r.roles?.slug === "admin");
  }

  const { data, error } = await supabase
    .from("lead_media")
    .select(
      "id, lead_id, storage_path, file_name, mime_type, kind, size_bytes, comment, uploaded_by, created_at, uploader:users!lead_media_uploaded_by_fkey(first_name, last_name)",
    )
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error || !data) return [];

  // URLs signées en lot via le service role (le bucket est privé).
  const admin = await supabaseServiceRole();
  const paths = data.map((r) => r.storage_path);
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(paths, SIGNED_TTL);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
    }
  }

  return data.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    fileName: r.file_name,
    mimeType: r.mime_type,
    kind: r.kind,
    sizeBytes: r.size_bytes,
    comment: r.comment,
    uploadedBy: r.uploaded_by,
    uploaderName:
      `${r.uploader?.first_name ?? ""} ${r.uploader?.last_name ?? ""}`.trim() || null,
    createdAt: r.created_at,
    url: signedByPath.get(r.storage_path) ?? null,
    canDelete: isAdmin || (!!user && r.uploaded_by === user.id),
  }));
}
