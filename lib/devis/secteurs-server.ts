import "server-only";

// Les activités réellement employées par le CRM.
//
// ── POURQUOI PAS SIMPLEMENT LES NEUF SECTEURS ────────────────────────
//
// L'écran de réglage des gabarits dresse une ligne par couple (société,
// activité). Avec sept sociétés et neuf secteurs, cela ferait soixante-dix
// lignes, dont la plupart pour des activités que l'entreprise n'exerce pas.
// Un écran qu'on ne peut pas lire n'est pas un réglage, c'est un obstacle.
//
// On lit donc la table `activities`, qui est la liste administrée. En cas
// d'échec de lecture, on retombe sur les trois activités prioritaires nommées
// par le client — nettoyage, déménagement, débarras — plutôt que sur une
// liste vide : un écran sans aucune ligne se lirait comme une panne.

import { supabaseServer } from "@/lib/supabase/server";
import { SECTOR_LABEL, type Sector } from "@/lib/leads";

/** Repli : les trois activités prioritaires du client (2026-11-05). */
const PRIORITAIRES: Sector[] = ["nettoyage", "demenagement", "debarras"];

const estSecteur = (v: string): v is Sector =>
  Object.prototype.hasOwnProperty.call(SECTOR_LABEL, v);

export async function secteursEmployes(): Promise<Sector[]> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("activities")
      .select("slug")
      .order("slug")
      .returns<{ slug: string }[]>();
    // On teste `error` : une requête en échec rend `data: null`, exactement
    // comme une table vide. Les confondre ferait passer une panne pour une
    // entreprise sans activité.
    if (error || !data || data.length === 0) return PRIORITAIRES;
    const out = data.map((a) => a.slug).filter(estSecteur);
    return out.length > 0 ? out : PRIORITAIRES;
  } catch {
    return PRIORITAIRES;
  }
}
