import "server-only";

// Résolution serveur de la terminologie du devis (C2 du 2026-11-06).
//
// Séparé du module pur parce qu'il lit `legal_entities`. Les règles — table
// des termes, projection, contrôle du mélange — vivent dans `terminologie.ts`
// et se testent sans base.
//
// ── LE PAYS VIENT DE LA SOCIÉTÉ ÉMETTRICE ───────────────────────────
//
// Et de nulle part ailleurs : ni de l'adresse du client, ni de son téléphone,
// ni de la langue du navigateur. C'est la même règle que pour la mention des
// produits, et pour la même raison — le document engage celui qui le signe.
// La lecture du pays est donc mutualisée avec `mentions-produits-server.ts`
// plutôt que dupliquée.
//
// ── POURQUOI AUCUN RÉGLAGE DE LANGUE N'EST LU ICI ───────────────────
//
// Le client demande une « langue configurée ». Elle l'est : c'est un
// paramètre de `terminologieDe()`, et non une déduction. Mais le référentiel
// de rédaction n'existe qu'en français, donc `LANGUES_SERVIES` ne contient
// qu'une valeur — et un réglage qui ne peut prendre qu'une seule valeur est
// un écran de plus pour rien, plus une requête de plus à chaque devis.
//
// Le jour où le référentiel existera dans une deuxième langue, le point de
// configuration est tout tracé : une clé de `app_settings`, par pays, comme
// les mentions de produits — aucune migration. La traduction elle-même
// demande une relecture juridique, et c'est pour cela qu'elle figure dans
// `ARBITRAGES_EN_ATTENTE` et pas dans le code.

import { paysDeLEntite } from "./mentions-produits-server";
import {
  TERMINOLOGIE_REFERENCE,
  langueServie,
  paysReconnuPourTerminologie,
  terminologieDe,
  type Langue,
  type Terminologie,
} from "./terminologie";

export type ResolutionTerminologie = {
  terminologie: Terminologie;
  /**
   * Le pays de la société a-t-il été reconnu ?
   *
   * `false` signifie que le devis est rendu dans la terminologie de référence
   * — le français de France — faute de mieux. Ce n'est PAS une erreur
   * silencieuse : l'appelant le remonte au commercial, comme pour la mention
   * des produits. Un document rendu dans la terminologie d'un autre pays que
   * celui de la société qui le signe est un document contestable.
   */
  paysReconnu: boolean;
};

/**
 * Terminologie à employer pour le devis d'une société.
 *
 * Le repli sur la référence est volontaire et il est SIGNALÉ. Refuser de
 * produire le devis parce qu'une société n'a pas de pays exploitable serait
 * disproportionné — le français de France reste la langue du référentiel, et
 * les sept sociétés du CRM sont françaises. Mais un repli muet laisserait
 * passer une société étrangère mal renseignée.
 */
export async function terminologiePourEntite(
  entityId: string | null | undefined,
  langue: Langue = "fr",
): Promise<ResolutionTerminologie> {
  const brut = await paysDeLEntite(entityId);
  const pays = paysReconnuPourTerminologie(brut);
  const l = langueServie(langue) ?? "fr";
  if (!pays) return { terminologie: { ...TERMINOLOGIE_REFERENCE, langue: l }, paysReconnu: false };
  return { terminologie: terminologieDe(pays, l), paysReconnu: true };
}
