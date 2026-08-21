import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";

// Alloue le prochain numéro de devis OPTIMIVV au format « AAAA-00001 ».
// L'allocation est atomique côté base (RPC SECURITY DEFINER + verrou de ligne) :
// deux appels concurrents obtiennent deux numéros distincts et consécutifs, et
// un redéploiement ne remet jamais le compteur à zéro. Un numéro n'est consommé
// qu'à l'ÉMISSION réelle (téléchargement / envoi), jamais à l'aperçu — pour
// rester « sans trou » au sens comptable.
export async function allocateDevisNumero(
  year: number = new Date().getFullYear(),
): Promise<string> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.rpc("next_devis_optimivv_num", {
    p_year: year,
  });
  if (error || !data) {
    throw new Error(
      "Allocation du numéro de devis échouée : " +
        (error?.message ?? "réponse vide"),
    );
  }
  return data;
}

// Numéro de facture « FAC-AAAA-00001 » (séquence gapless dédiée).
export async function allocateFactureNumero(
  year: number = new Date().getFullYear(),
): Promise<string> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.rpc("next_facture_optimivv_num", {
    p_year: year,
  });
  if (error || !data) {
    throw new Error(
      "Allocation du numéro de facture échouée : " +
        (error?.message ?? "réponse vide"),
    );
  }
  return data;
}

// Alloue le bon numéro selon le type de document.
export async function allocateNumero(
  docType: "devis" | "facture",
  year: number = new Date().getFullYear(),
): Promise<string> {
  return docType === "facture"
    ? allocateFactureNumero(year)
    : allocateDevisNumero(year);
}
