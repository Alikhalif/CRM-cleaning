import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { ClientDocument, DocCategory, DocKind } from "./types";

// Couche données du registre documentaire (Lot 1). Fusionne, pour un client :
//  - les documents du module (table client_documents, bucket client-documents) ;
//  - les certificats hotte DÉJÀ émis (table cert_hotte, lus en lecture seule —
//    le module cert hotte n'est pas modifié).
// URLs signées à TTL court (bucket privé) via le service-role.

export const CLIENT_DOCS_BUCKET = "client-documents";
const CERT_BUCKET = "devis-optimivv"; // là où le module cert hotte archive déjà
const SIGNED_TTL = 3600; // 60 min (CDC §8)

type DocRow = {
  id: string; client_id: string; dossier_id: string | null; kind: string; category: string | null;
  title: string; ref: string | null; storage_path: string | null; file_name: string | null;
  mime_type: string | null; signed: boolean; status: string | null; created_by: string | null; created_at: string;
};
type CertRow = {
  id: string; numero: string; pdf_path: string; client_nom: string | null; sent_at: string | null;
  created_at: string; created_by: string | null; dossier_id: string | null;
};

export async function getClientDocuments(clientId: string, sourceLeadId?: string | null): Promise<ClientDocument[]> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let isManager = false;
  if (user) {
    const { data: roles } = await supabase
      .from("user_roles").select("roles(slug)").eq("user_id", user.id)
      .returns<{ roles: { slug: string } | null }[]>();
    isManager = (roles ?? []).some((r) => r.roles?.slug === "admin" || r.roles?.slug === "planification");
  }

  const admin = await supabaseServiceRole();

  // Lectures en parallèle : registre du client + certificats hotte du lead source.
  const [docsRes, certsRes] = await Promise.all([
    supabase
      .from("client_documents")
      .select("id, client_id, dossier_id, kind, category, title, ref, storage_path, file_name, mime_type, signed, status, created_by, created_at")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<DocRow[]>(),
    sourceLeadId
      ? admin
          .from("cert_hotte")
          .select("id, numero, pdf_path, client_nom, sent_at, created_at, created_by, dossier_id")
          .eq("lead_id", sourceLeadId)
          .order("created_at", { ascending: false })
          .returns<CertRow[]>()
      : Promise.resolve({ data: [] as CertRow[] }),
  ]);

  const docRows = docsRes.data ?? [];
  const certRows = certsRes.data ?? [];

  // Noms des créateurs (une requête).
  const userIds = [...new Set([...docRows, ...certRows].map((r) => r.created_by).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data } = await admin.from("users").select("id, first_name, last_name, email").in("id", userIds);
    for (const u of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]) {
      nameById.set(u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Utilisateur");
    }
  }

  // Signatures d'URL en lot, par bucket.
  const docPaths = docRows.map((r) => r.storage_path).filter(Boolean) as string[];
  const certPaths = certRows.map((r) => r.pdf_path).filter(Boolean);
  const signed = new Map<string, string>();
  await Promise.all([
    docPaths.length
      ? admin.storage.from(CLIENT_DOCS_BUCKET).createSignedUrls(docPaths, SIGNED_TTL).then(({ data }) => {
          for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(`d:${s.path}`, s.signedUrl);
        })
      : Promise.resolve(),
    certPaths.length
      ? admin.storage.from(CERT_BUCKET).createSignedUrls(certPaths, SIGNED_TTL).then(({ data }) => {
          for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(`c:${s.path}`, s.signedUrl);
        })
      : Promise.resolve(),
  ]);

  const fromDocs: ClientDocument[] = docRows.map((r) => ({
    id: r.id,
    source: "client_documents",
    clientId: r.client_id,
    kind: r.kind as DocKind,
    category: (r.category ?? null) as DocCategory | null,
    title: r.title,
    ref: r.ref,
    fileName: r.file_name,
    mimeType: r.mime_type,
    signed: r.signed,
    status: r.status,
    createdAt: r.created_at,
    createdByName: r.created_by ? nameById.get(r.created_by) ?? null : null,
    url: r.storage_path ? signed.get(`d:${r.storage_path}`) ?? null : null,
    canDelete: isManager || (!!user && r.created_by === user.id),
    dossierId: r.dossier_id,
  }));

  const fromCerts: ClientDocument[] = certRows.map((r) => ({
    id: r.id,
    source: "cert_hotte",
    clientId,
    kind: "certificat",
    category: "hotte",
    title: `Certificat de conformité — hotte`,
    ref: r.numero,
    fileName: `${r.numero}.pdf`,
    mimeType: "application/pdf",
    signed: true,
    status: r.sent_at ? "envoyé" : "généré",
    createdAt: r.created_at,
    createdByName: r.created_by ? nameById.get(r.created_by) ?? null : null,
    url: signed.get(`c:${r.pdf_path}`) ?? null,
    canDelete: false, // certificat hotte : intégré en lecture seule
    dossierId: r.dossier_id,
  }));

  return [...fromDocs, ...fromCerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
