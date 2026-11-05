import "server-only";
import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { getCurrentUserProfile, getAllActivities, getAllUsersForAdmin, type ActivityOption } from "./users-server";
import {
  BRANCHES,
  BRANCHES_ORDONNEES,
  PERIMETRE_VIDE,
  SECTEURS_SUPERVISES,
  TOUS_LES_DROITS,
  aDroit,
  perimetreConfigure,
  type BrancheSlug,
  type DroitIntervention,
  type Perimetre,
  type Univers,
} from "./supervision-perimetre";
import { COUNTRIES } from "./leads";

// Lecture du périmètre d'un superviseur — I/O uniquement. Les RÈGLES sont dans
// lib/supervision-perimetre.ts (module pur, testable sans base).
//
// ⚠️ FERMÉ PAR DÉFAUT (décision client 2026-11-05) : pas de ligne
// `supervisor_scopes`, ou des listes vides, = AUCUN accès. Le Super Admin,
// lui, ne passe pas par cette table.

export type { Perimetre } from "./supervision-perimetre";

type ScopeRow = {
  countries: string[] | null;
  activity_ids: string[] | null;
  owner_ids: string[] | null;
  can_intervene: boolean | null;
  can_request_action: boolean | null;
  can_reassign: boolean | null;
  can_set_priority: boolean | null;
  include_unassigned: boolean | null;
};

const COLONNES_SCOPE =
  "countries, activity_ids, owner_ids, can_intervene, can_request_action, can_reassign, can_set_priority, include_unassigned";

// Une colonne absente signifie que la migration 20261105000001 n'est pas
// poussée. On le dit au lieu de renvoyer un périmètre faux.
function colonneAbsente(code?: string): boolean {
  return code === "42703";
}

/**
 * Activités SUPERVISÉES existant en base, dans l'ordre de la taxonomie
 * (familles puis branches). Les activités hors des deux familles — dépannage,
 * ENR, rénovation — ne sont jamais renvoyées : le module ne les connaît pas.
 */
export const getActivitesSupervisees = cache(async function getActivitesSupervisees(): Promise<ActivityOption[]> {
  const toutes = await getAllActivities();
  const parSlug = new Map(toutes.map((a) => [a.slug, a]));
  const out: ActivityOption[] = [];
  for (const b of BRANCHES_ORDONNEES) {
    for (const slug of BRANCHES[b].secteurs) {
      const a = parSlug.get(slug);
      if (a) out.push(a);
    }
  }
  return out;
});

export const getUnivers = cache(async function getUnivers(): Promise<Univers> {
  const activites = await getActivitesSupervisees();
  return { activityIds: activites.map((a) => a.id) };
});

/** Branche d'appartenance de chaque activité supervisée, par id. */
export async function getBrancheParActivite(): Promise<Map<string, BrancheSlug>> {
  const activites = await getActivitesSupervisees();
  const out = new Map<string, BrancheSlug>();
  for (const a of activites) {
    for (const b of BRANCHES_ORDONNEES) {
      if (BRANCHES[b].secteurs.includes(a.slug)) out.set(a.id, b);
    }
  }
  return out;
}

/**
 * Périmètre de l'utilisateur courant dans le module Superviseur.
 *
 *   • `null`                      → l'utilisateur n'a rien à faire ici (ni
 *                                   Super Admin, ni superviseur) ;
 *   • `portee: "admin"`           → accès global (Super Admin) ;
 *   • `portee: "superviseur"`     → strictement ce que le Super Admin a
 *                                   configuré. Vérifier `perimetreConfigure()`
 *                                   avant d'afficher quoi que ce soit.
 */
export const getPerimetreSuperviseur = cache(async function getPerimetreSuperviseur(): Promise<Perimetre | null> {
  const me = await getCurrentUserProfile();
  if (!me) return null;
  const roles = (me.roles ?? []).map((r) => r.slug);

  // Le Super Admin conserve son accès global (consigne client §1). Les listes
  // sont remplies avec l'univers réel : aucune valeur magique, et les mêmes
  // fonctions pures s'appliquent sans cas particulier côté interface.
  if (roles.includes("admin")) {
    const univers = await getUnivers();
    return {
      portee: "admin",
      pays: [...COUNTRIES],
      activityIds: univers.activityIds,
      commerciauxIds: [],
      inclureNonAttribues: true,
      droits: TOUS_LES_DROITS,
    };
  }

  if (!roles.includes("superviseur")) return null;

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("supervisor_scopes")
    .select(COLONNES_SCOPE)
    .eq("user_id", me.id)
    .maybeSingle<ScopeRow>();

  if (error) {
    if (colonneAbsente(error.code)) {
      console.error(
        "[getPerimetreSuperviseur] colonnes de droits absentes — migration " +
        "20261105000001 non poussée. Périmètre refusé (fermé par défaut).",
      );
    } else {
      console.error("[getPerimetreSuperviseur] Supabase :", error.code, error.message);
    }
    // Une lecture en échec ne doit JAMAIS ouvrir l'accès.
    return { ...PERIMETRE_VIDE };
  }

  if (!data) return { ...PERIMETRE_VIDE };

  // Garde-fou : même si un identifiant d'activité hors familles a été stocké,
  // le module ne le prend pas en compte. L'exclusion n'est pas négociable.
  const univers = await getUnivers();
  const autorisees = new Set(univers.activityIds);

  return {
    portee: "superviseur",
    pays: (data.countries ?? []).filter((c) => (COUNTRIES as string[]).includes(c)),
    activityIds: (data.activity_ids ?? []).filter((id) => autorisees.has(id)),
    commerciauxIds: data.owner_ids ?? [],
    inclureNonAttribues: Boolean(data.include_unassigned),
    droits: {
      ouvrirDossier: Boolean(data.can_intervene),
      demanderAction: Boolean(data.can_request_action),
      reaffecter: Boolean(data.can_reassign),
      definirPriorite: Boolean(data.can_set_priority),
    },
  };
});

/**
 * Garde serveur d'un droit d'intervention, pour les server actions des lots 3
 * et 4. Renvoie le format `{ ok, error }` utilisé partout dans ce dépôt.
 *
 * Elle ne remplace pas la vérification du périmètre du dossier visé : avoir le
 * droit de réaffecter ne dit pas QUEL lead on peut réaffecter. Les deux
 * contrôles se cumulent.
 */
export async function assertDroitSuperviseur(
  droit: DroitIntervention,
): Promise<{ ok: true; perimetre: Perimetre } | { ok: false; error: string }> {
  const perimetre = await getPerimetreSuperviseur();
  if (!perimetre) return { ok: false, error: "Action réservée à la supervision." };
  if (!perimetreConfigure(perimetre)) {
    return { ok: false, error: "Votre périmètre de supervision n'est pas configuré." };
  }
  if (!aDroit(perimetre, droit)) {
    return { ok: false, error: "Ce droit d'intervention ne vous a pas été accordé." };
  }
  return { ok: true, perimetre };
}

// ── Côté Super Admin : la configuration des périmètres ────────────────

export type SuperviseurAdmin = {
  userId: string;
  nom: string;
  email: string;
  // Périmètre tel qu'il est stocké (jamais « interprété » : ce que voit le
  // Super Admin est ce qui est appliqué).
  pays: string[];
  activityIds: string[];
  commerciauxIds: string[];
  inclureNonAttribues: boolean;
  droits: Record<DroitIntervention, boolean>;
  // Faux = ce superviseur n'a accès à RIEN aujourd'hui.
  configure: boolean;
  misAJourLe: string | null;
};

export type CompteSupervisable = {
  id: string;
  nom: string;
  email: string;
  roles: string[];
};

export type DonneesAdminPerimetres = {
  superviseurs: SuperviseurAdmin[];
  // Comptes proposés dans « commerciaux à superviser ».
  comptes: CompteSupervisable[];
  activites: ActivityOption[];
  // Branches de la taxonomie qui n'ont aucune activité en base — affichées
  // désactivées, avec la raison.
  branchesSansActivite: { slug: BrancheSlug; label: string; manque: string }[];
  // Vrai quand la migration des droits n'est pas poussée : l'écran le dit
  // plutôt que d'enregistrer dans des colonnes inexistantes.
  migrationManquante: boolean;
};

/**
 * Tout ce qu'il faut à l'écran /settings/superviseurs. Admin uniquement : la
 * RLS de `users` / `user_roles` ne laisse pas passer un autre rôle, et la page
 * est en plus gardée par `requireAdmin()`.
 */
export async function getDonneesAdminPerimetres(): Promise<DonneesAdminPerimetres> {
  const [utilisateurs, activites] = await Promise.all([
    getAllUsersForAdmin(),
    getActivitesSupervisees(),
  ]);

  const sb = await supabaseServer();
  let migrationManquante = false;
  let lignes: (ScopeRow & { user_id: string; updated_at: string | null })[] = [];

  // Colonnes écrites EN CLAIR, pas interpolées : `scripts/check-selects`
  // ne sait pas relire une chaîne construite, et c'est précisément une
  // colonne mal nommée dans un `.select()` qui a mis les fiches
  // /planification en 404 le 2026-11-05, build et lint au vert.
  const res = await sb
    .from("supervisor_scopes")
    .select(
      "user_id, updated_at, countries, activity_ids, owner_ids, can_intervene, " +
      "can_request_action, can_reassign, can_set_priority, include_unassigned",
    )
    .returns<(ScopeRow & { user_id: string; updated_at: string | null })[]>();

  if (res.error && colonneAbsente(res.error.code)) {
    migrationManquante = true;
    // Repli sur les seules colonnes historiques, pour que l'écran s'affiche
    // quand même et explique ce qui manque.
    const repli = await sb
      .from("supervisor_scopes")
      .select("user_id, updated_at, countries, activity_ids, owner_ids, can_intervene")
      .returns<
        {
          user_id: string;
          updated_at: string | null;
          countries: string[] | null;
          activity_ids: string[] | null;
          owner_ids: string[] | null;
          can_intervene: boolean | null;
        }[]
      >();
    lignes = (repli.data ?? []).map((r) => ({
      ...r,
      can_request_action: null,
      can_reassign: null,
      can_set_priority: null,
      include_unassigned: null,
    }));
  } else {
    if (res.error) console.error("[getDonneesAdminPerimetres] Supabase :", res.error.code, res.error.message);
    lignes = res.data ?? [];
  }

  const parUser = new Map(lignes.map((l) => [l.user_id, l]));
  const idsActivitesSupervisees = new Set(activites.map((a) => a.id));

  const superviseurs: SuperviseurAdmin[] = utilisateurs
    .filter((u) => u.roleSlugs.includes("superviseur"))
    .map((u) => {
      const l = parUser.get(u.id);
      const perimetre: Perimetre = {
        portee: "superviseur",
        pays: (l?.countries ?? []).filter((c) => (COUNTRIES as string[]).includes(c)),
        activityIds: (l?.activity_ids ?? []).filter((id) => idsActivitesSupervisees.has(id)),
        commerciauxIds: l?.owner_ids ?? [],
        inclureNonAttribues: Boolean(l?.include_unassigned),
        droits: {
          ouvrirDossier: Boolean(l?.can_intervene),
          demanderAction: Boolean(l?.can_request_action),
          reaffecter: Boolean(l?.can_reassign),
          definirPriorite: Boolean(l?.can_set_priority),
        },
      };
      return {
        userId: u.id,
        nom: u.displayName,
        email: u.email,
        pays: perimetre.pays,
        activityIds: perimetre.activityIds,
        commerciauxIds: perimetre.commerciauxIds,
        inclureNonAttribues: perimetre.inclureNonAttribues,
        droits: perimetre.droits,
        configure: perimetreConfigure(perimetre),
        misAJourLe: l?.updated_at ?? null,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  // Comptes proposés comme « commerciaux à superviser ». On liste TOUS les
  // comptes actifs hors superviseurs : un lead peut appartenir à un compte qui
  // ne porte pas le rôle `commercial` (admin ayant créé un dossier, planif…),
  // et le masquer rendrait ses dossiers invisibles à la supervision sans que
  // personne ne puisse le corriger. Les rôles sont affichés en clair pour que
  // le Super Admin choisisse en connaissance de cause.
  const comptes: CompteSupervisable[] = utilisateurs
    .filter((u) => !u.roleSlugs.includes("superviseur"))
    .map((u) => ({ id: u.id, nom: u.displayName, email: u.email, roles: u.roleSlugs }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const branchesSansActivite = BRANCHES_ORDONNEES.filter(
    (b) => BRANCHES[b].secteurs.length === 0 || !BRANCHES[b].secteurs.some((s) => activites.some((a) => a.slug === s)),
  ).map((b) => ({
    slug: b,
    label: BRANCHES[b].label,
    manque:
      BRANCHES[b].manque ??
      `Les activités ${BRANCHES[b].secteurs.join(", ")} de cette branche sont absentes de la table activities.`,
  }));

  return { superviseurs, comptes, activites, branchesSansActivite, migrationManquante };
}

// Secteurs supervisés, exposés au serveur sans réimporter le module pur.
export { SECTEURS_SUPERVISES };
