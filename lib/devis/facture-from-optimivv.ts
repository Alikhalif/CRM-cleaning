import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { buildDevis, type Devis } from "./types";
import { genererDevisBuffer } from "./render";
import { allocateFactureNumero } from "./numero";
import { archiveDevis, signedDevisUrl } from "./archive";

// Recette 2026-09-18 · Correctif A09 (P2) — OPTIMIVV facturable.
//
// Les affaires signées via le générateur OPTIMIVV (« Bon pour accord », franchise
// TVA 293 B, prestataire hors entités CRM) créent un dossier SANS devis dans la
// table `documents` → la facture finale CRM échouait (« Aucun devis signé »). On
// génère plutôt la facture avec le MOTEUR OPTIMIVV (docType=facture, numéro
// FAC-…, PDF archivé), à partir du contenu EXACT du devis signé.
//
// Hypothèse (à valider en staging) : la facture reprend le montant du devis
// (franchise TVA → TTC = HT) ; la déduction éventuelle d'un acompte n'est pas
// appliquée automatiquement (le modèle OPTIMIVV facture un montant unique).
//
// Idempotent : une seule facture par lead (pas de nouveau numéro si elle existe).
export async function ensureOptimivvFactureForLead(
  leadId: string,
  createdBy: string | null,
): Promise<{ numero: string; url: string | null } | null> {
  const sb = await supabaseServiceRole();

  // Déjà facturé ? → renvoie l'existante (n'alloue pas un nouveau numéro).
  const { data: existing } = await sb
    .from("devis_optimivv")
    .select("numero, pdf_path")
    .eq("lead_id", leadId)
    .eq("doc_type", "facture")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: string; pdf_path: string }>();
  if (existing) {
    return { numero: existing.numero, url: await signedDevisUrl(existing.pdf_path, 3600) };
  }

  // Devis OPTIMIVV source (le plus récent) = base de la facture.
  const { data: src } = await sb
    .from("devis_optimivv")
    .select("data")
    .eq("lead_id", leadId)
    .eq("doc_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ data: unknown }>();
  if (!src?.data || typeof src.data !== "object") return null;

  const source = src.data as Devis;
  const numero = await allocateFactureNumero();
  // Reprend le contenu du devis en mode facture : nouveau numéro, date du jour,
  // sans la case « Bon pour accord » (signature du devis).
  const facture = buildDevis(
    { ...source, docType: "facture", date_emission: undefined, signature: undefined },
    numero,
  );
  const pdf = await genererDevisBuffer(facture);
  const { pdfPath } = await archiveDevis({ devis: facture, pdf, leadId, createdBy });
  return { numero, url: await signedDevisUrl(pdfPath, 3600) };
}
