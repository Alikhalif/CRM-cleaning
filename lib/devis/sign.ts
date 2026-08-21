import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";
import { genererDevisBuffer } from "./render";
import { todayFr, type Devis } from "./types";
import { markLeadDevisSigne } from "./status";
import { signedDevisUrl } from "./archive";

const BUCKET = "devis-optimivv";

type Row = { numero: string; data: unknown; pdf_path: string };

async function latestDevisRow(leadId: string): Promise<Row | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("devis_optimivv")
    .select("numero, data, pdf_path")
    .eq("lead_id", leadId)
    .eq("doc_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Row>();
  return data ?? null;
}

export type SignContext = {
  numero: string;
  clientNom: string;
  pdfUrl: string | null;
  alreadySigned: boolean;
};

// Contexte pour la page publique de signature : le devis à signer + son PDF
// (URL signée temporaire) + un drapeau « déjà signé ».
export async function getDevisForSigning(
  leadId: string,
): Promise<SignContext | null> {
  const row = await latestDevisRow(leadId);
  if (!row) return null;
  const devis = row.data as Devis;

  const sb = await supabaseServiceRole();
  const { data: lead } = await sb
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle<{ status: string }>();
  const alreadySigned = !!lead && ["signe", "encaisse"].includes(lead.status);

  return {
    numero: row.numero,
    clientNom: devis?.client?.nom ?? "",
    pdfUrl: await signedDevisUrl(row.pdf_path, 3600),
    alreadySigned,
  };
}

// Enregistre la signature : re-génère le PDF avec la signature dans la case
// « Bon pour accord », archive la version signée, puis fait avancer le lead à
// « Signé ». Idempotent (markLeadDevisSigne ne signe pas deux fois).
export async function recordDevisSignature(
  leadId: string,
  input: { nom: string; imageDataUrl?: string; ip?: string | null; ua?: string | null },
): Promise<{ ok: true; numero: string } | { ok: false; error: string }> {
  const row = await latestDevisRow(leadId);
  if (!row) return { ok: false, error: "Devis introuvable." };
  const devis = row.data as Devis;

  const signedDevis: Devis = {
    ...devis,
    signature: { nom: input.nom, date: todayFr(), imageDataUrl: input.imageDataUrl },
  };
  const pdf = await genererDevisBuffer(signedDevis);

  const sb = await supabaseServiceRole();
  const year = new Date().getFullYear();
  const signedPath = `${year}/signed-devis-${row.numero}.pdf`;
  const up = await sb.storage
    .from(BUCKET)
    .upload(signedPath, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) {
    return { ok: false, error: "Archivage du PDF signé échoué : " + up.error.message };
  }

  const dataWithMeta = {
    ...signedDevis,
    _signature_meta: {
      signedAt: new Date().toISOString(),
      ip: input.ip ?? null,
      ua: input.ua ?? null,
    },
  };
  await sb
    .from("devis_optimivv")
    .update({ data: dataWithMeta as unknown as Json, pdf_path: signedPath } as never)
    .eq("numero", row.numero);

  const sub = (devis?.acompte_pct ?? 0) > 0 ? "avec" : "sans";
  const r = await markLeadDevisSigne(leadId, sub);
  if (r === "error") return { ok: false, error: "Mise à jour du statut échouée." };

  return { ok: true, numero: row.numero };
}
