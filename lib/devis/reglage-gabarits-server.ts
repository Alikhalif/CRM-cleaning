import "server-only";

// Lecture du réglage des gabarits.
//
// ── POURQUOI CE MODULE EST SÉPARÉ DU RENDU ───────────────────────────
//
// `rendu-document-server.ts` importe react-pdf ET pdfkit : c'est son métier,
// il rend des PDF. L'écran de réglages, lui, n'a besoin que de LIRE la carte
// des gabarits. L'y faire passer embarquerait les deux moteurs de rendu dans
// le bundle serveur de `/settings/integrations`, qui n'imprime rien — et
// obligerait à y tracer les polices et les gabarits au déploiement.
//
// Quelques lignes dans leur propre fichier évitent tout cela.

import { APP_SETTING_KEYS, getJsonSetting } from "@/lib/app-settings";
import type { ReglageGabarits } from "./gabarits";

/**
 * Carte « <société>|<activité> » → gabarit.
 *
 * Défensive : `app_settings` n'a aucun schéma et une ligne peut avoir été
 * écrite à la main. Tout ce qui n'est pas une chaîne est ignoré ici ; la
 * validité du nom de gabarit se juge dans `resoudreGabarit`, qui sait aussi
 * la signaler.
 */
export async function lireReglageGabarits(): Promise<ReglageGabarits> {
  const brut = await getJsonSetting(APP_SETTING_KEYS.devisGabarits);
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const out: ReglageGabarits = {};
  for (const [k, v] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
