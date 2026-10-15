import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import { getCurrentUserProfile } from "./users-server";
import { COUNTRY_LABEL, type Country } from "./leads";
import type { Periode, SupRow } from "./supervision-shared";
export { PERIODE_LABEL, PERIODES, type Periode } from "./supervision-shared";

// Centre de supervision commerciale. LECTURE SEULE, agrégée : le dirigeant doit
// comprendre la situation sans ouvrir un seul dossier.
//
// ⚠️ PÉRIMÈTRE APPLIQUÉ ICI, CÔTÉ SERVEUR. Un superviseur restreint à la France
// ne reçoit pas les lignes des autres pays — elles ne quittent pas la machine.
// Masquer dans l'interface ne suffirait pas (consigne explicite).
//
// Aucune donnée inventée : un indicateur qui ne peut pas être calculé de façon
// fiable renvoie null, et l'interface affiche « donnée indisponible ».

export type SupervisionScope = {
  // Listes vides = aucune restriction sur cet axe.
  countries: string[];
  activityIds: string[];
  ownerIds: string[];
  canIntervene: boolean;
};


type LeadRow = {
  id: string;
  short_id: string | null;
  owner_id: string | null;
  activity_id: string | null;
  country: string | null;
  status: string;
  received_at: string;
  discovery_done_at: string | null;
  last_action_at: string;
};

export type EvenementFlux = {
  at: string;
  action: string;
  libelle: string;
  qui: string | null;
};

export type SupervisionData = {
  periode: Periode;
  // Faits par dossier. L'agrégation (KPI, blocs, alertes) est faite par
  // lib/supervision-shared.ts — côté serveur au premier rendu, côté client à
  // chaque changement de filtre, avec LE MÊME code.
  rows: SupRow[];
  flux: EvenementFlux[];
  filtres: {
    pays: { code: string; label: string }[];
    activites: { id: string; label: string }[];
    commerciaux: { id: string; label: string }[];
  };
  scope: SupervisionScope;
};

export async function getSupervisionScope(): Promise<SupervisionScope | null> {
  const me = await getCurrentUserProfile();
  if (!me) return null;
  const roles = (me.roles ?? []).map((r) => r.slug);
  // Le Super Admin voit tout : périmètre vide sur les trois axes.
  if (roles.includes("admin")) {
    return { countries: [], activityIds: [], ownerIds: [], canIntervene: true };
  }
  if (!roles.includes("superviseur")) return null;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("supervisor_scopes")
    .select("countries, activity_ids, owner_ids, can_intervene")
    .eq("user_id", me.id)
    .maybeSingle<{ countries: string[]; activity_ids: string[]; owner_ids: string[]; can_intervene: boolean }>();
  return {
    countries: data?.countries ?? [],
    activityIds: data?.activity_ids ?? [],
    ownerIds: data?.owner_ids ?? [],
    canIntervene: Boolean(data?.can_intervene),
  };
}

// Devise de référence par pays. Aucune conversion automatique : additionner
// des euros et des francs suisses sans taux daté donnerait un chiffre faux.
const DEVISE: Record<string, string> = { FR: "EUR", BE: "EUR", LU: "EUR", CA: "CAD", CH: "CHF" };

function bornes(p: Periode): { debut: Date; fin: Date } {
  const fin = new Date();
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  switch (p) {
    case "today": break;
    case "yesterday":
      debut.setDate(debut.getDate() - 1);
      fin.setDate(fin.getDate() - 1);
      fin.setHours(23, 59, 59, 999);
      break;
    case "7d": debut.setDate(debut.getDate() - 6); break;
    case "30d": debut.setDate(debut.getDate() - 29); break;
    case "mtd": debut.setDate(1); break;
  }
  return { debut, fin };
}

export async function getSupervisionData(periode: Periode): Promise<SupervisionData | null> {
  const scope = await getSupervisionScope();
  if (!scope) return null;

  const { debut, fin } = bornes(periode);
  // Service-role : la supervision agrège l'activité de TOUTE l'équipe, ce que
  // la RLS « mine » interdirait. Le périmètre est appliqué juste en dessous,
  // explicitement — c'est lui qui fait la sécurité ici, pas la RLS.
  const sb = await supabaseServiceRole();

  const [leadsRes, actsRes, usersRes, docsRes, optRes, auditRes, actionsRes] = await Promise.all([
    sb.from("leads")
      .select("id, short_id, owner_id, activity_id, country, status, received_at, discovery_done_at, last_action_at")
      .is("deleted_at", null)
      .returns<LeadRow[]>(),
    sb.from("activities").select("id, slug, label").returns<{ id: string; slug: string; label: string }[]>(),
    sb.from("users").select("id, first_name, last_name")
      .returns<{ id: string; first_name: string | null; last_name: string | null }[]>(),
    sb.from("documents").select("lead_id, total_ttc, signed_at, issued_at, type, status")
      .eq("type", "devis")
      .returns<{ lead_id: string | null; total_ttc: number | null; signed_at: string | null; issued_at: string; status: string }[]>(),
    sb.from("devis_optimivv").select("lead_id, montant_ht, created_at, sent_at, data")
      .returns<{ lead_id: string | null; montant_ht: number | null; created_at: string; sent_at: string | null; data: { signature?: unknown; _signature_meta?: { signedAt?: string } } | null }[]>(),
    sb.from("audit_logs").select("action, created_at, user_id, entity_id")
      .order("created_at", { ascending: false })
      .limit(1500)
      .returns<{ action: string; created_at: string; user_id: string | null; entity_id: string | null }[]>(),
    sb.from("commercial_actions").select("lead_id, owner_id, due_at, snoozed_until, status")
      .neq("status", "terminee")
      .returns<{ lead_id: string; owner_id: string | null; due_at: string; snoozed_until: string | null; status: string }[]>(),
  ]);

  const actById = new Map((actsRes.data ?? []).map((a) => [a.id, a]));
  const userById = new Map(
    (usersRes.data ?? []).map((u) => [u.id, `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—"]),
  );

  // ── Périmètre appliqué AVANT tout calcul ─────────────────────────────
  const dansScope = (l: LeadRow): boolean => {
    if (scope.countries.length && !scope.countries.includes(l.country ?? "")) return false;
    if (scope.activityIds.length && !scope.activityIds.includes(l.activity_id ?? "")) return false;
    if (scope.ownerIds.length && !scope.ownerIds.includes(l.owner_id ?? "")) return false;
    return true;
  };
  const tousLeads = (leadsRes.data ?? []).filter(dansScope);
  const idsScope = new Set(tousLeads.map((l) => l.id));

  const dansPeriode = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= debut.getTime() && t <= fin.getTime();
  };

  // ── Devis : envoi et signature, par dossier ──────────────────────────
  const envoyeDansPeriode = new Set<string>();
  const signeDansPeriode = new Map<string, number>();
  const aUnDevisEnvoye = new Set<string>();
  for (const d of docsRes.data ?? []) {
    if (!d.lead_id || !idsScope.has(d.lead_id)) continue;
    if (d.status !== "brouillon") {
      aUnDevisEnvoye.add(d.lead_id);
      if (dansPeriode(d.issued_at)) envoyeDansPeriode.add(d.lead_id);
    }
    if (dansPeriode(d.signed_at)) {
      signeDansPeriode.set(d.lead_id, (signeDansPeriode.get(d.lead_id) ?? 0) + Number(d.total_ttc ?? 0));
    }
  }
  for (const d of optRes.data ?? []) {
    if (!d.lead_id || !idsScope.has(d.lead_id)) continue;
    const envoi = d.sent_at ?? d.created_at;
    aUnDevisEnvoye.add(d.lead_id);
    if (dansPeriode(envoi)) envoyeDansPeriode.add(d.lead_id);
    const sig = d.data?.signature ? (d.data?._signature_meta?.signedAt ?? envoi) : null;
    if (dansPeriode(sig)) {
      signeDansPeriode.set(d.lead_id, (signeDansPeriode.get(d.lead_id) ?? 0) + Number(d.montant_ht ?? 0));
    }
  }

  // ── Réactivité : fondée sur un ÉVÉNEMENT vérifiable (audit lead.open),
  // jamais sur une supposition. Sans trace, la valeur reste nulle. ──────
  const premiereOuverture = new Map<string, string>();
  for (const a of (auditRes.data ?? []).slice().reverse()) {
    if (a.action !== "lead.open" || !a.entity_id) continue;
    if (!premiereOuverture.has(a.entity_id)) premiereOuverture.set(a.entity_id, a.created_at);
  }

  // ── Retards par dossier ──────────────────────────────────────────────
  const maintenant = Date.now();
  const retardsParLead = new Map<string, number>();
  for (const a of actionsRes.data ?? []) {
    if (!idsScope.has(a.lead_id)) continue;
    const due = Math.max(new Date(a.due_at).getTime(), a.snoozed_until ? new Date(a.snoozed_until).getTime() : 0);
    if (due < maintenant) retardsParLead.set(a.lead_id, (retardsParLead.get(a.lead_id) ?? 0) + 1);
  }

  // ── Un fait par dossier ──────────────────────────────────────────────
  const rows: SupRow[] = tousLeads.map((l) => {
    const ouvert = premiereOuverture.get(l.id);
    // « Traité » = le dossier a bougé au-delà de son arrivée. Trois preuves
    // possibles, toutes vérifiables.
    const traite = l.status !== "lead" || Boolean(l.discovery_done_at) || Boolean(ouvert);
    const delai = ouvert
      ? Math.max(0, Math.round((new Date(ouvert).getTime() - new Date(l.received_at).getTime()) / 60000))
      : null;
    const act = l.activity_id ? actById.get(l.activity_id) : null;
    const pays = l.country ?? null;
    return {
      leadId: l.id,
      ownerId: l.owner_id,
      ownerName: l.owner_id ? userById.get(l.owner_id) ?? "—" : "Non attribué",
      country: pays,
      countryLabel: pays ? (COUNTRY_LABEL[pays as Country] ?? pays) : "Pays inconnu",
      devise: pays ? (DEVISE[pays] ?? "EUR") : "EUR",
      activityId: l.activity_id,
      activityLabel: act?.label ?? "—",
      recu: dansPeriode(l.received_at),
      traite,
      decouverte: dansPeriode(l.discovery_done_at),
      devisEnvoye: envoyeDansPeriode.has(l.id),
      signe: signeDansPeriode.has(l.id),
      montantSigne: signeDansPeriode.get(l.id) ?? 0,
      enRetard: retardsParLead.get(l.id) ?? 0,
      delaiPriseEnChargeMin: dansPeriode(l.received_at) ? delai : null,
      decouverteSansDevis: Boolean(l.discovery_done_at) && l.status === "lead" && !aUnDevisEnvoye.has(l.id),
    };
  });

  // ── Flux d'activité ──────────────────────────────────────────────────
  const LIBELLE: Record<string, string> = {
    "lead.create": "Nouveau lead",
    "lead.create.webhook": "Nouveau lead (formulaire)",
    "lead.open": "Dossier ouvert",
    "lead.status.change": "Changement de statut",
    "lead.discovery.save": "Découverte enregistrée",
    "lead.call.outbound": "Appel sortant",
    "document.create": "Devis créé",
    "document.send_email": "Devis envoyé",
    "lead.lost": "Dossier perdu",
  };
  const flux = (auditRes.data ?? [])
    .filter((a) => LIBELLE[a.action] && a.entity_id != null && idsScope.has(a.entity_id))
    .slice(0, 40)
    .map((a) => ({
      at: a.created_at,
      action: a.action,
      libelle: LIBELLE[a.action],
      qui: a.user_id ? userById.get(a.user_id) ?? null : null,
    }));

  // Options de filtre, limitées au périmètre : on ne propose jamais un pays ou
  // un commercial que l'utilisateur n'a pas le droit de voir.
  const uniques = <T,>(xs: (T | null)[]): T[] => [...new Set(xs.filter((x): x is T => x != null))];

  return {
    periode,
    rows,
    flux,
    filtres: {
      pays: uniques(tousLeads.map((l) => l.country)).map((c) => ({ code: c, label: COUNTRY_LABEL[c as Country] ?? c })),
      activites: uniques(tousLeads.map((l) => l.activity_id)).map((id) => ({ id, label: actById.get(id)?.label ?? "—" })),
      commerciaux: uniques(tousLeads.map((l) => l.owner_id)).map((id) => ({ id, label: userById.get(id) ?? "—" })),
    },
    scope,
  };
}
