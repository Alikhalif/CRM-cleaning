import "server-only";
import { notify, notifyRole } from "@/lib/notifications";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { PaymentTermSlug } from "@/lib/leads";
import {
  attendues, CLE_CONFIG, lireConfig, reconcilier,
  type ConfigEscalade, type EtatDossier, type EtatFacture, type Ouverte, type TypeAction,
} from "./shared";

// Moteur des actions attendues du back-office.
//
// Appelé de DEUX façons, et c'est ce qui rend l'alerte « immédiate » sans
// renoncer à la fiabilité :
//   · juste après chaque action qui change un état (validation, préparation,
//     émission, encaissement…), par `after()` — la réponse n'attend pas ;
//   · par le cron (4e passe isolée de /api/presence/evaluate), qui rattrape
//     tout ce qui aurait été manqué et déclenche les escalades.
//
// Idempotent : deux passes qui se croisent ne créent ni deux actions (index
// unique partiel) ni deux notifications (seul le gagnant de l'insertion
// notifie). Service-role : il tourne sans session, depuis le cron.

export type Bilan =
  | { ok: true; ouvertes: number; fermees: number; escaladees: number; informations: number }
  | { ok: false; raison: string };

const LIBELLE_ESCALADE: Record<TypeAction, string> = {
  "dossier.a_planifier": "Intervention toujours pas planifiée",
  "dossier.a_valider": "Intervention terminée toujours pas validée",
  "facture.a_preparer": "Facture finale toujours pas préparée",
  "facture.a_emettre": "Facture finale préparée toujours pas émise",
  "facture.impayee": "Facture toujours impayée",
  "acompte.impaye": "Acompte toujours impayé",
};

async function config(): Promise<ConfigEscalade> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("app_settings").select("value").eq("key", CLE_CONFIG).maybeSingle<{ value: unknown }>();
  return lireConfig(data?.value ?? null);
}

const nomClient = (l: { is_company?: boolean | null; client_company?: string | null; client_first_name?: string | null; client_last_name?: string | null } | null) =>
  !l ? "client" : l.is_company
    ? (l.client_company ?? "client")
    : `${l.client_first_name ?? ""} ${l.client_last_name ?? ""}`.trim() || "client";

export async function evaluerActionsBackOffice(maintenant: Date = new Date()): Promise<Bilan> {
  const sb = await supabaseServiceRole();
  const cfg = await config();

  const [dos, fac, finales, ouv] = await Promise.all([
    sb.from("dossiers")
      .select("id, status, lead:leads(is_company, client_company, client_first_name, client_last_name, country)")
      .in("status", ["a_planifier", "finalise", "valide"]),
    sb.from("documents")
      .select("id, type, status, num, emise_at, lead:leads(is_company, client_company, client_first_name, client_last_name, country), terme:payment_terms(slug)")
      .in("type", ["acompte", "finale"])
      .in("status", ["brouillon", "envoye", "retard"])
      .is("deleted_at", null)
      .is("annulee_at", null),
    sb.from("documents").select("dossier_id")
      .eq("type", "finale").not("dossier_id", "is", null)
      .is("deleted_at", null).is("annulee_at", null),
    sb.from("actions_back_office").select("id, cle, type, ouverte_at, escaladee_at").is("fermee_at", null),
  ]);
  // Sans la migration 20261109000006 (et …03), ces lectures échouent : on le
  // DIT, on ne fabrique rien. Le cron continue ses autres passes.
  const err = dos.error ?? fac.error ?? finales.error ?? ouv.error;
  if (err) return { ok: false, raison: `lecture impossible (migration non appliquée ?) : ${err.message}` };

  type L = (Parameters<typeof nomClient>[0] & { country?: string | null }) | null;
  const avecFinale = new Set(((finales.data ?? []) as { dossier_id: string }[]).map((r) => r.dossier_id));
  const etatsDossiers: EtatDossier[] = ((dos.data ?? []) as unknown as { id: string; status: string; lead: L }[]).map((d) => ({
    id: d.id, status: d.status, pays: d.lead?.country ?? null, client: nomClient(d.lead), finaleActive: avecFinale.has(d.id),
  }));
  const etatsFactures: EtatFacture[] = ((fac.data ?? []) as unknown as {
    id: string; type: "acompte" | "finale"; status: string; num: string; emise_at: string | null; lead: L; terme: { slug: PaymentTermSlug } | null;
  }[]).map((f) => ({
    id: f.id, type: f.type, status: f.status, pays: f.lead?.country ?? null, num: f.num, client: nomClient(f.lead), emiseAt: f.emise_at, termeSlug: f.terme?.slug ?? null,
  }));
  const ouvertes: Ouverte[] = ((ouv.data ?? []) as { id: string; cle: string; type: TypeAction; ouverte_at: string; escaladee_at: string | null }[])
    .map((o) => ({ id: o.id, cle: o.cle, type: o.type, ouverteAt: o.ouverte_at, escaladeeAt: o.escaladee_at }));

  const plan = reconcilier(attendues(etatsDossiers, etatsFactures, maintenant, cfg), ouvertes, maintenant, cfg);
  let nOuvertes = 0, nFermees = 0, nEscaladees = 0;

  for (const a of plan.aOuvrir) {
    const { data, error } = await sb.from("actions_back_office").insert({
      cle: a.cle, type: a.type, role_cible: a.roleCible, entity_type: a.entityType,
      entity_id: a.entityId, pays: a.pays, titre: a.titre, href: a.href,
    }).select("id").maybeSingle();
    // 23505 : une passe concurrente l'a ouverte la première — elle a notifié.
    if (error || !data) continue;
    nOuvertes++;
    if (a.notifier) {
      await notifierPlanificateursDuPays(a.pays, {
        kind: `action.${a.type}`, entityType: a.entityType, entityId: a.entityId,
        title: a.titre, body: "Action attendue : elle reste ouverte tant qu'elle n'est pas effectuée.", href: a.href,
      });
    }
  }

  for (const f of plan.aFermer) {
    const { data } = await sb.from("actions_back_office")
      .update({ fermee_at: maintenant.toISOString(), raison_fermeture: "action_effectuee" })
      .eq("id", f.id).is("fermee_at", null).select("id");
    if (data && data.length > 0) nFermees++;
  }

  for (const o of plan.aEscalader) {
    const { data } = await sb.from("actions_back_office")
      .update({ escaladee_at: maintenant.toISOString() })
      .eq("id", o.id).is("escaladee_at", null).is("fermee_at", null).select("id, titre, href, entity_type, entity_id");
    const row = (data ?? [])[0] as { titre: string; href: string | null; entity_type: string; entity_id: string } | undefined;
    if (!row) continue; // une autre passe a escaladé : elle a notifié
    nEscaladees++;
    await notifyRole("admin", {
      kind: "action.escalade", entityType: row.entity_type, entityId: row.entity_id,
      title: `⚠️ ${LIBELLE_ESCALADE[o.type]} — délai dépassé`,
      body: `${row.titre}. Ouverte depuis plus de ${cfg.escaladeHeures[o.type]} h : intervention du Super Admin attendue.`,
      href: row.href ?? undefined,
    });
  }

  return { ok: true, ouvertes: nOuvertes, fermees: nFermees, escaladees: nEscaladees, informations: await contratsSignes(maintenant) };
}

/**
 * Notifie les planificateurs qui COUVRENT le pays du dossier — et eux seuls.
 * `notifyRole("planification")` avertirait toute l'équipe, contournant le
 * cloisonnement par pays (CDC §11) : un planificateur lirait le nom d'un
 * client qu'il ne voit pas dans Planification. Pays inconnu : personne en
 * planification — l'escalade au Super Admin le rattrapera.
 */
async function notifierPlanificateursDuPays(
  pays: string | null,
  input: { kind: string; entityType: string; entityId: string; title: string; body: string; href: string },
): Promise<number> {
  if (!pays) return 0;
  const sb = await supabaseServiceRole();
  const { data: role } = await sb.from("roles").select("id").eq("slug", "planification" as never).maybeSingle<{ id: string }>();
  if (!role) return 0;
  const { data: liens } = await sb.from("user_roles").select("user_id").eq("role_id", role.id);
  const ids = ((liens ?? []) as { user_id: string }[]).map((l) => l.user_id);
  if (ids.length === 0) return 0;
  const { data: users } = await sb.from("users").select("id").in("id", ids).eq("is_active", true).contains("countries", [pays]);
  let n = 0;
  for (const u of (users ?? []) as { id: string }[]) {
    await notify({ userId: u.id, ...input });
    n++;
  }
  return n;
}

/**
 * Contrat de sous-traitance SIGNÉ (DocuSign) : une information, pas une
 * action — une seule notification par enveloppe, garantie par la clé primaire
 * de `notifications_emises`. Fenêtre de 7 jours : la première passe après la
 * mise en service n'inonde pas l'équipe avec l'historique.
 */
async function contratsSignes(maintenant: Date): Promise<number> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("docusign_envelopes")
    .select("envelope_id, contract_id, completed_at, contrat:subcontract_contracts(dossier:dossiers(lead:leads(country)))")
    .eq("statut", "signe_toutes_parties")
    .not("contract_id", "is", null)
    .gte("completed_at", new Date(maintenant.getTime() - 7 * 86_400_000).toISOString());
  let n = 0;
  type Env = { envelope_id: string; contract_id: string; contrat: { dossier: { lead: { country: string | null } | null } | null } | null };
  for (const e of (data ?? []) as unknown as Env[]) {
    const { data: gagne } = await sb.from("notifications_emises")
      .insert({ cle: `docusign.signe:${e.envelope_id}` }).select("cle").maybeSingle();
    if (!gagne) continue;
    n++;
    // Ciblée par pays, comme les actions : pas de fuite entre périmètres.
    await notifierPlanificateursDuPays(e.contrat?.dossier?.lead?.country ?? null, {
      kind: "soustraitance.contrat_signe", entityType: "subcontract_contract", entityId: e.contract_id,
      title: "Contrat de sous-traitance signé par toutes les parties",
      body: "Le document signé et son certificat sont archivés. La mission peut être lancée.",
      href: "/planification",
    });
  }
  return n;
}
