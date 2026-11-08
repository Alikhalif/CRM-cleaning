"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import { APP_SETTING_KEYS } from "@/lib/app-settings";
import { assertAdmin } from "@/lib/access-server";
import { CLE_CONFIG, lireConfig } from "@/lib/actions-back-office/shared";
import { GABARITS } from "@/lib/devis/gabarits";
import {
  CLE_SOCIETES, COUNTRIES, MENTION_PAR_PAYS, controlerMention, type Country,
} from "@/lib/generation/mentions-produits";

type AppSettingInsert = Database["public"]["Tables"]["app_settings"]["Insert"];
type Result = { ok: true } | { ok: false; error: string };

// Admin-only — RLS on app_settings enforces is_admin() for writes. We
// also audit-log the change since this is a global config flip that
// affects every commercial.
export async function setBooleanSetting(key: string, value: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const row: AppSettingInsert = {
    key,
    value: value as unknown as Database["public"]["Tables"]["app_settings"]["Insert"]["value"],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  // Upsert — first toggle creates the row, subsequent ones update value.
  const { error } = await supabase
    .from("app_settings")
    .upsert(row as never, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    after: { key, value },
  });

  // Refresh every page whose UI depends on the toggle.
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/settings/integrations");
  return { ok: true };
}

/**
 * Réglages des mentions de produits, PAR PAYS (C1 révisé, 2026-11-06).
 *
 * ── CE QUE CETTE ACTION ENREGISTRE, ET CE QU'ELLE N'ENREGISTRE PAS ──
 *
 * Elle n'enregistre pas « quelle mention appliquer » : c'est le pays de
 * l'entité émettrice qui décide, et la table de correspondance est figée dans
 * le code (`MENTION_PAR_PAYS`). Elle enregistre si l'entreprise ASSUME cette
 * allégation pour un pays donné, et une éventuelle adaptation du texte.
 *
 * Un pays désactivé est RETIRÉ de la carte : l'absence de clé et une
 * activation à faux doivent signifier la même chose, sans quoi un pays
 * désactivé réapparaîtrait au prochain enregistrement.
 *
 * Journalisé : c'est une allégation réglementaire qui partira sur des devis
 * signés, et il faut pouvoir dire qui l'a activée, pour quel pays, et quand.
 */
export async function enregistrerMentionsProduits(
  reglages: Record<string, { active: boolean; texte: string }>,
  /**
   * Couche PAR SOCIÉTÉ (2026-11-08) : identifiant d'entité → réglages par
   * pays. Omise, elle n'est pas écrasée par mégarde : on l'enregistre telle
   * quelle, et c'est l'appelant qui décide de son contenu.
   */
  parSociete: Record<string, Record<string, { active: boolean; texte: string }>> = {},
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const propre: Record<string, { active: boolean; texte: string }> = {};
  for (const pays of COUNTRIES) {
    const r = reglages[pays];
    if (!r?.active) continue;
    const texte = (r.texte ?? "").trim();
    // Texte vide = formulation de référence du pays : on contrôle celle qui
    // partira réellement, pas la chaîne vide.
    const effectif = texte || MENTION_PAR_PAYS[pays];
    const c = controlerMention(effectif);
    if (!c.ok) return { ok: false, error: `${pays} — ${c.motif}` };
    propre[pays] = { active: true, texte };
  }

  // La couche société subit EXACTEMENT les mêmes contrôles : une allégation
  // portée par une société engage autant que la même portée par un pays.
  const propreSocietes: Record<string, Record<string, { active: boolean; texte: string }>> = {};
  for (const [entityId, parPaysDeLaSociete] of Object.entries(parSociete)) {
    if (!entityId.trim()) continue;
    const retenu: Record<string, { active: boolean; texte: string }> = {};
    for (const pays of COUNTRIES) {
      const r = parPaysDeLaSociete?.[pays];
      if (!r?.active) continue;
      const texte = (r.texte ?? "").trim();
      const effectif = texte || MENTION_PAR_PAYS[pays];
      const c = controlerMention(effectif);
      if (!c.ok) return { ok: false, error: `${pays} (société) — ${c.motif}` };
      retenu[pays] = { active: true, texte };
    }
    if (Object.keys(retenu).length > 0) propreSocietes[entityId] = retenu;
  }

  const valeur: Record<string, unknown> = { ...propre };
  // La sous-clé n'est écrite que si elle porte quelque chose : un objet vide
  // dans `app_settings` se lirait comme une configuration, pas comme son
  // absence.
  if (Object.keys(propreSocietes).length > 0) valeur[CLE_SOCIETES] = propreSocietes;

  const row: AppSettingInsert = {
    key: APP_SETTING_KEYS.devisMentionsProduits,
    value: valeur as unknown as AppSettingInsert["value"],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase
    .from("app_settings")
    .upsert(row as never, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    after: {
      key: APP_SETTING_KEYS.devisMentionsProduits,
      pays_actives: Object.keys(propre),
      // Qui a assumé quoi, société par société : c'est la trace qui manquait.
      societes_actives: Object.fromEntries(
        Object.entries(propreSocietes).map(([id, parPays]) => [id, Object.keys(parPays)]),
      ),
      // Le texte exact est journalisé : c'est lui qui engage l'entreprise.
      formulations: Object.fromEntries(
        Object.entries(propre).map(([k, v]) => [k, v.texte || MENTION_PAR_PAYS[k as Country]]),
      ),
    },
  });

  revalidatePath("/settings/integrations");
  return { ok: true };
}

/**
 * Réglage des gabarits de devis, par société et par activité (Lot B).
 *
 * ── CE QUI EST VALIDÉ, ET POURQUOI ──────────────────────────────────
 *
 * Chaque valeur doit nommer un gabarit CONNU. `app_settings` n'a aucun schéma
 * et une ligne peut être écrite à la main : sans ce contrôle, une faute de
 * frappe s'enregistrerait et se lirait plus tard comme « réglage illisible »,
 * sans que personne sache d'où elle vient.
 *
 * Une entrée vide est RETIRÉE de la carte : l'absence de clé et « par défaut »
 * doivent signifier la même chose, sans quoi un réglage effacé réapparaîtrait
 * au prochain enregistrement.
 *
 * Journalisé : le gabarit décide de la présentation d'un document contractuel,
 * et il faut pouvoir dire qui l'a changé, pour quelle société, et quand.
 */
export async function enregistrerGabaritsDevis(
  reglages: Record<string, string>,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const connus = new Set(Object.keys(GABARITS));
  const propre: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(reglages ?? {})) {
    const v = (valeur ?? "").trim();
    if (!v) continue;
    if (!connus.has(v)) {
      return { ok: false, error: `Gabarit inconnu : « ${v} » (clé ${cle}).` };
    }
    if (!/^[^|]+\|[^|]+$/.test(cle)) {
      return { ok: false, error: `Clé de réglage invalide : « ${cle} ».` };
    }
    propre[cle] = v;
  }

  const row: AppSettingInsert = {
    key: APP_SETTING_KEYS.devisGabarits,
    value: propre as unknown as AppSettingInsert["value"],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase
    .from("app_settings")
    .upsert(row as never, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    after: { key: APP_SETTING_KEYS.devisGabarits, gabarits: propre },
  });

  revalidatePath("/settings/integrations");
  revalidatePath("/comptabilite");
  return { ok: true };
}

// ── Délais d'escalade des actions back-office (2026-11-09) ──────────────────
// « Délais d'escalade paramétrables, avec une configuration initiale
// documentée et modifiable par le Super Admin. » Valeurs initiales :
// CONFIG_INITIALE (lib/actions-back-office/shared.ts). Toute saisie est
// BORNÉE par la même fonction que celle du moteur : ce qui est enregistré est
// exactement ce qui sera appliqué. Prise en compte à la passe suivante du
// moteur — immédiate ou cron —, sans redéploiement.
export async function enregistrerDelaisEscalade(brut: unknown): Promise<Result> {
  const droit = await assertAdmin();
  if (!droit.ok) return droit;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const config = lireConfig(brut);
  const { data: avant } = await supabase.from("app_settings").select("value").eq("key", CLE_CONFIG)
    .maybeSingle<{ value: unknown }>();
  const row: AppSettingInsert = {
    key: CLE_CONFIG,
    value: config as unknown as AppSettingInsert["value"],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase.from("app_settings").upsert(row as never, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    before: { key: CLE_CONFIG, value: avant?.value ?? null },
    after: { key: CLE_CONFIG, value: config },
  });
  revalidatePath("/settings/integrations");
  return { ok: true };
}
