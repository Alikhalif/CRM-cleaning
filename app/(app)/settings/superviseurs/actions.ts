"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { hasScope } from "@/lib/access-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getActivitesSupervisees } from "@/lib/supervision-perimetre-server";
import { COUNTRIES } from "@/lib/leads";
import { perimetreConfigure, type Perimetre } from "@/lib/supervision-perimetre";

// Attribution du périmètre d'un superviseur — SUPER ADMIN UNIQUEMENT.
//
// Trois garde-fous, et ils ne sont pas redondants :
//
//   1. `hasScope("admin")` ici — un superviseur ne peut pas appeler cette
//      action pour élargir son propre périmètre, même en forgeant la requête ;
//   2. la RLS de `supervisor_scopes` (« modifiable par admin ») — si ce code
//      se trompait, la base refuserait quand même ;
//   3. la VALIDATION des valeurs reçues — un pays inconnu ou une activité
//      hors des deux familles supervisées est rejeté, pas enregistré en
//      silence. Un périmètre qu'on ne peut pas relire est un périmètre qu'on
//      ne peut pas auditer.
//
// Chaque enregistrement est journalisé (avant / après) : donner ou retirer un
// accès aux données commerciales doit laisser une trace, c'est la demande du
// client (§6 « chaque intervention doit être historisée ») et le CDC §8.2.

export type Result = { ok: true } | { ok: false; error: string };

export type PerimetreSaisi = {
  userId: string;
  pays: string[];
  activityIds: string[];
  commerciauxIds: string[];
  inclureNonAttribues: boolean;
  droits: {
    ouvrirDossier: boolean;
    demanderAction: boolean;
    reaffecter: boolean;
    definirPriorite: boolean;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function enregistrerPerimetre(saisie: PerimetreSaisi): Promise<Result> {
  if (!(await hasScope("admin"))) {
    return { ok: false, error: "Réservé au Super Admin." };
  }
  if (!UUID.test(saisie.userId)) {
    return { ok: false, error: "Superviseur introuvable." };
  }

  const sb = await supabaseServer();

  // Le compte visé doit réellement porter le rôle superviseur : on ne crée pas
  // un périmètre « dormant » sur un compte qui n'en a pas l'usage.
  const { data: roles } = await sb
    .from("user_roles")
    .select("roles(slug)")
    .eq("user_id", saisie.userId)
    .returns<{ roles: { slug: string } | null }[]>();
  const estSuperviseur = (roles ?? []).some((r) => r.roles?.slug === "superviseur");
  if (!estSuperviseur) {
    return { ok: false, error: "Ce compte ne porte pas le rôle Superviseur." };
  }

  // ── Validation des valeurs ──────────────────────────────────────────
  const paysInconnus = saisie.pays.filter((c) => !(COUNTRIES as string[]).includes(c));
  if (paysInconnus.length > 0) {
    return { ok: false, error: `Pays inconnu(s) : ${paysInconnus.join(", ")}.` };
  }

  const supervisees = new Set((await getActivitesSupervisees()).map((a) => a.id));
  const horsFamilles = saisie.activityIds.filter((id) => !supervisees.has(id));
  if (horsFamilles.length > 0) {
    return {
      ok: false,
      error:
        "Activité hors des deux familles supervisées (nettoyage · déménagement/débarras/transport). " +
        "Dépannage, ENR, rénovation et TCE sont exclus du module Superviseur.",
    };
  }

  if (saisie.commerciauxIds.some((id) => !UUID.test(id))) {
    return { ok: false, error: "Identifiant de commercial invalide." };
  }
  // Un superviseur ne se supervise pas lui-même.
  if (saisie.commerciauxIds.includes(saisie.userId)) {
    return { ok: false, error: "Un superviseur ne peut pas figurer dans sa propre liste de commerciaux." };
  }

  // État AVANT, pour le journal d'audit.
  const { data: avant } = await sb
    .from("supervisor_scopes")
    .select("countries, activity_ids, owner_ids, can_intervene")
    .eq("user_id", saisie.userId)
    .maybeSingle<{
      countries: string[] | null;
      activity_ids: string[] | null;
      owner_ids: string[] | null;
      can_intervene: boolean | null;
    }>();

  const moi = await getCurrentUserProfile();

  const ligne = {
    user_id: saisie.userId,
    countries: saisie.pays,
    activity_ids: saisie.activityIds,
    owner_ids: saisie.commerciauxIds,
    include_unassigned: saisie.inclureNonAttribues,
    can_intervene: saisie.droits.ouvrirDossier,
    can_request_action: saisie.droits.demanderAction,
    can_reassign: saisie.droits.reaffecter,
    can_set_priority: saisie.droits.definirPriorite,
    updated_at: new Date().toISOString(),
    updated_by: moi?.id ?? null,
  };

  const { error } = await sb
    .from("supervisor_scopes")
    // Les colonnes de droits viennent de la migration 20261105000001 ; les
    // types générés seront régénérés après `supabase db push`.
    .upsert(ligne as never, { onConflict: "user_id" });

  if (error) {
    if (error.code === "42703") {
      return {
        ok: false,
        error:
          "La migration 20261105000001 (droits d'intervention) n'est pas appliquée en base. " +
          "Lancez « npx supabase db push » avant d'enregistrer un périmètre.",
      };
    }
    return { ok: false, error: error.message };
  }

  const perimetre: Perimetre = {
    portee: "superviseur",
    pays: saisie.pays,
    activityIds: saisie.activityIds,
    commerciauxIds: saisie.commerciauxIds,
    inclureNonAttribues: saisie.inclureNonAttribues,
    droits: saisie.droits,
  };

  revalidatePath("/settings/superviseurs");
  // Le périmètre pilote /leads (cockpit) : sans cela le superviseur garderait
  // l'ancienne page en cache.
  revalidatePath("/leads");

  await auditLog({
    action: "supervisor.scope.set",
    entityType: "user",
    entityId: saisie.userId,
    before: avant
      ? {
          countries: avant.countries ?? [],
          activity_ids: avant.activity_ids ?? [],
          owner_ids: avant.owner_ids ?? [],
          can_intervene: Boolean(avant.can_intervene),
        }
      : null,
    after: {
      countries: saisie.pays,
      activity_ids: saisie.activityIds,
      owner_ids: saisie.commerciauxIds,
      include_unassigned: saisie.inclureNonAttribues,
      droits: saisie.droits,
      // Enregistré tel quel : « ce superviseur avait-il un accès effectif ? »
      // est la question qu'on se posera en relisant le journal.
      perimetre_effectif: perimetreConfigure(perimetre),
    },
  });

  return { ok: true };
}

/**
 * Retire tout accès à un superviseur, d'un seul geste.
 *
 * Le périmètre est remis à ZÉRO, la ligne n'est pas supprimée : on garde
 * `updated_by` / `updated_at` et donc la trace de qui a coupé l'accès et
 * quand. Une ligne absente et une ligne vide ont le même effet (aucun accès),
 * mais pas la même valeur de preuve.
 */
export async function revoquerPerimetre(userId: string): Promise<Result> {
  return enregistrerPerimetre({
    userId,
    pays: [],
    activityIds: [],
    commerciauxIds: [],
    inclureNonAttribues: false,
    droits: {
      ouvrirDossier: false,
      demanderAction: false,
      reaffecter: false,
      definirPriorite: false,
    },
  });
}
