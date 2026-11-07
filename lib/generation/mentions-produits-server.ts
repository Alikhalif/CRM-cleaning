import "server-only";

// Résolution serveur de la mention produits — par PAYS de l'entité émettrice.
//
// Séparé du module pur parce qu'il lit `app_settings` et `legal_entities`.
// Les règles — table de correspondance, activation par pays, refus de la
// mention quand le pays est inconnu — vivent dans `mentions-produits.ts` et
// se testent sans base.

import { APP_SETTING_KEYS, getJsonSetting } from "@/lib/app-settings";
import { supabaseServer } from "@/lib/supabase/server";
import {
  lireReglages,
  resoudreMention,
  type ReglagesMentions,
  type ResolutionMention,
} from "./mentions-produits";

/** Réglages d'activation, tels qu'ils sont en base. */
export async function reglagesMentions(): Promise<ReglagesMentions> {
  return lireReglages(await getJsonSetting(APP_SETTING_KEYS.devisMentionsProduits));
}

/**
 * Pays d'une entité juridique, ou `null`.
 *
 * ⚠️ LE PAYS VIENT DE LA SOCIÉTÉ ÉMETTRICE, et de nulle part ailleurs. Pas
 * de l'adresse du client, pas de son téléphone, pas de la langue du
 * navigateur : le client l'a exigé, et c'est la seule base défendable pour
 * une allégation réglementaire.
 */
export async function paysDeLEntite(entityId: string | null | undefined): Promise<string | null> {
  if (!entityId) return null;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("legal_entities")
    .select("country")
    .eq("id", entityId)
    .maybeSingle<{ country: string | null }>();
  return data?.country ?? null;
}

/**
 * Mention à porter au devis de cette société.
 *
 * Retourne la RÉSOLUTION COMPLÈTE, motif compris : l'appelant doit pouvoir
 * dire au commercial pourquoi aucune mention ne figure — pays absent, pays
 * non activé, ou intervention sans produits. Un `null` muet ferait croire à
 * un oubli du moteur.
 */
export async function mentionPourEntite(
  entityId: string | null | undefined,
  emploieDesProduits = true,
): Promise<ResolutionMention> {
  const [pays, reglages] = await Promise.all([
    paysDeLEntite(entityId),
    reglagesMentions(),
  ]);
  return resoudreMention(pays, reglages, emploieDesProduits);
}

/** Les sociétés et leur pays, pour l'écran de réglages et les contrôles. */
export async function societesEtPays(): Promise<
  { id: string; nom: string; pays: string | null }[]
> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("legal_entities")
    .select("id, legal_name, country")
    .is("deleted_at", null)
    .order("legal_name")
    .returns<{ id: string; legal_name: string | null; country: string | null }[]>();
  return (data ?? []).map((e) => ({
    id: e.id,
    nom: e.legal_name ?? "sans dénomination",
    pays: e.country,
  }));
}
