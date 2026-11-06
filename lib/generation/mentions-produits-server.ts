import "server-only";

// Résolution serveur de la mention produits d'une société (C1 du 2026-11-06).
//
// Séparé du module pur parce qu'il lit `app_settings`. Les règles — lecture
// défensive de la carte, texte vide traité comme absence — vivent dans
// `mentions-produits.ts` et sont testées sans base.

import { APP_SETTING_KEYS, getJsonSetting } from "@/lib/app-settings";
import { lireMentions, resoudreMentionProduits } from "./mentions-produits";

/**
 * Mention à porter au devis de cette société, ou `null`.
 *
 * `null` est le cas NORMAL : aucune société n'a de mention tant qu'un Super
 * Admin ne l'a pas saisie. Une lecture en échec rend `null` aussi — un
 * réglage illisible ne doit pas empêcher d'émettre un devis, et surtout il ne
 * doit pas faire réapparaître une affirmation que personne n'a validée.
 */
export async function mentionProduitsPourEntite(
  entityId: string | null | undefined,
): Promise<string | null> {
  if (!entityId) return null;
  const brut = await getJsonSetting(APP_SETTING_KEYS.devisMentionsProduits);
  return resoudreMentionProduits(entityId, lireMentions(brut));
}

/** La carte complète, pour l'écran d'administration. */
export async function toutesLesMentions(): Promise<Record<string, string>> {
  return lireMentions(await getJsonSetting(APP_SETTING_KEYS.devisMentionsProduits));
}
