import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";
import type { Devis } from "./types";

const BUCKET = "devis-optimivv";

// Archive un devis émis : le binaire PDF EXACT (pièce qui fait foi en cas de
// litige) dans un bucket privé + une ligne liée à l'affaire. Idempotent par
// numéro (ré-émission = upsert). Écrit en service-role : sessionless côté
// serveur, l'endpoint appelant a déjà vérifié la session.
export async function archiveDevis(params: {
  devis: Devis;
  pdf: Buffer;
  leadId?: string | null;
  createdBy?: string | null;
  sentTo?: string | null;
}): Promise<{ id: string; pdfPath: string }> {
  const sb = await supabaseServiceRole();
  const year = new Date().getFullYear();
  const docType = params.devis.docType ?? "devis";
  const pdfPath = `${year}/${docType}-${params.devis.numero}.pdf`;

  const up = await sb.storage
    .from(BUCKET)
    .upload(pdfPath, params.pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (up.error) {
    throw new Error("Archivage du PDF échoué : " + up.error.message);
  }

  const row = {
    numero: params.devis.numero,
    doc_type: docType,
    lead_id: params.leadId ?? null,
    data: params.devis as unknown as Json,
    montant_ht: params.devis.montant_ht ?? null,
    client_nom: params.devis.client?.nom ?? null,
    client_email: params.devis.client?.email ?? null,
    pdf_path: pdfPath,
    sent_to: params.sentTo ?? null,
    sent_at: params.sentTo ? new Date().toISOString() : null,
    created_by: params.createdBy ?? null,
  };

  const ins = await sb
    .from("devis_optimivv")
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

// URL signée (TTL court) vers le PDF archivé — jamais d'URL publique sur un devis.
export async function signedDevisUrl(
  pdfPath: string,
  ttlSeconds = 600,
): Promise<string | null> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(pdfPath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
