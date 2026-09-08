import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";
import type { CertHotte } from "./types";

// Le PDF vit dans le bucket privé existant, sous le préfixe « certificats/ ».
const BUCKET = "devis-optimivv";
const pathFor = (numero: string): string =>
  `certificats/${new Date().getFullYear()}/${numero}.pdf`;

// Archive un certificat émis : le binaire PDF exact (pièce qui fait foi) + une
// ligne liée au dossier/lead. Idempotent par numéro. Service-role (sessionless).
export async function archiveCertHotte(params: {
  cert: CertHotte;
  pdf: Buffer;
  leadId?: string | null;
  dossierId?: string | null;
  createdBy?: string | null;
  sentTo?: string | null;
}): Promise<{ id: string; pdfPath: string }> {
  const sb = await supabaseServiceRole();
  const pdfPath = pathFor(params.cert.numero);

  const up = await sb.storage
    .from(BUCKET)
    .upload(pdfPath, params.pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) {
    throw new Error("Archivage du PDF échoué : " + up.error.message);
  }

  const row = {
    numero: params.cert.numero,
    lead_id: params.leadId ?? null,
    dossier_id: params.dossierId ?? null,
    data: params.cert as unknown as Json,
    client_nom: params.cert.client?.etablissement ?? null,
    client_email: params.cert.client?.email ?? null,
    pdf_path: pdfPath,
    sent_to: params.sentTo ?? null,
    sent_at: params.sentTo ? new Date().toISOString() : null,
    created_by: params.createdBy ?? null,
  };

  const ins = await sb
    .from("cert_hotte")
    .upsert(row, { onConflict: "numero" })
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    throw new Error(
      "Archivage de la ligne échoué : " + (ins.error?.message ?? "réponse vide"),
    );
  }
  return { id: ins.data.id, pdfPath };
}

// URL signée (TTL court) vers le PDF archivé — jamais d'URL publique.
export async function certHottePdfUrl(
  pdfPath: string,
  ttlSeconds = 600,
): Promise<string | null> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(pdfPath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

// Dernier certificat archivé d'un dossier (bouton « Voir le certificat »).
export async function getDossierCertHotteMeta(
  dossierId: string,
): Promise<{ numero: string; pdfPath: string } | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("cert_hotte")
    .select("numero, pdf_path")
    .eq("dossier_id", dossierId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: string; pdf_path: string }>();
  return data ? { numero: data.numero, pdfPath: data.pdf_path } : null;
}

// Télécharge le binaire d'un certificat archivé (pour ré-envoi / consultation).
export async function downloadCertHottePdf(pdfPath: string): Promise<Buffer | null> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.storage.from(BUCKET).download(pdfPath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
