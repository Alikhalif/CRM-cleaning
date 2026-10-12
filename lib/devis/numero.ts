import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";

// Alloue le prochain numéro de devis OPTIMIVV au format « AAAA-56-N », commun
// aux activités Déménagement et Nettoyage (série unique, cf. migration
// 20261012000003). L'allocation est atomique côté base (RPC SECURITY DEFINER +
// verrou de ligne) : deux appels concurrents obtiennent deux numéros distincts
// et consécutifs, et un redéploiement ne remet jamais le compteur à zéro. Un
// numéro n'est consommé qu'à l'ÉMISSION réelle (téléchargement / envoi), jamais
// à l'aperçu — pour rester « sans trou » au sens comptable. L'aperçu affiche la
// valeur rendue par peekNumero(), qui lit le compteur sans l'incrémenter.
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

// Lecture SEULE du prochain numéro, pour l'afficher dans l'aperçu sans
// consommer la séquence — l'aperçu se régénère à chaque frappe. Le format est
// le même que celui de l'allocation (fonction SQL partagée), donc l'aperçu et
// le document émis ne peuvent pas diverger.
//
// C'est une PRÉVISION : si un collègue émet un devis entre-temps, le numéro
// réellement attribué sera le suivant. Renvoie null si la lecture échoue, pour
// que l'appelant retombe sur son libellé par défaut plutôt que de planter
// l'aperçu.
export async function peekNumero(
  docType: "devis" | "facture",
  year: number = new Date().getFullYear(),
): Promise<string | null> {
  try {
    const sb = await supabaseServiceRole();
    // `database.types.ts` est généré DEPUIS la base : il ne connaîtra ces deux
    // fonctions qu'après le db push de la migration 20261012000009. Cast au
    // point de contact du SDK, comme ailleurs dans ce dépôt — et le try/catch
    // couvre le cas où la fonction n'existe pas encore côté base.
    const fn = docType === "facture"
      ? "peek_facture_optimivv_num"
      : "peek_devis_optimivv_num";
    const { data, error } = await sb.rpc(fn as never, { p_year: year } as never);
    return error || !data ? null : (data as string);
  } catch {
    return null;
  }
}
