import "server-only";
import { supabaseServiceRole } from "./supabase/service";
import { COUNTRY_LABEL, type Country } from "./leads";
import type { Periode, SupRow } from "./supervision-shared";
import {
  dossierDansPerimetre,
  motifExclusion,
  perimetreConfigure,
  type MotifExclusion,
  type Perimetre,
} from "./supervision-perimetre";
import { getPerimetreSuperviseur, getUnivers } from "./supervision-perimetre-server";
import {
  compterAppels, dedoublonnerAppels, delaiPremierAppelMin, estContacte,
  etatDuLead, type Appel, type FaitsLead, type ResultatAppel,
  type SourceAppel,
} from "./supervision-etats";
export { PERIODE_LABEL, PERIODES, type Periode } from "./supervision-shared";

// Centre de supervision commerciale. LECTURE SEULE, agrégée : le dirigeant doit
// comprendre la situation sans ouvrir un seul dossier.
//
// ⚠️ PÉRIMÈTRE APPLIQUÉ ICI, CÔTÉ SERVEUR. Un superviseur restreint à la France
// ne reçoit pas les lignes des autres pays — elles ne quittent pas la machine.
// Masquer dans l'interface ne suffirait pas (consigne explicite).
//
// ⚠️ FERMÉ PAR DÉFAUT depuis le lot 1 (décision client 2026-11-05) : sans
// périmètre configuré, ZÉRO ligne. Les règles sont dans
// lib/supervision-perimetre.ts ; ce module ne fait que les appliquer.
//
// Aucune donnée inventée : un indicateur qui ne peut pas être calculé de façon
// fiable renvoie null, et l'interface affiche « donnée indisponible ».


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
  perimetre: Perimetre;
  // Faux → périmètre non configuré : zéro ligne, et l'interface doit le DIRE.
  configure: boolean;
  // Dossiers écartés du périmètre et POURQUOI. Un dossier hors périmètre ne
  // disparaît pas en silence : le compteur permet au Super Admin de voir
  // qu'il reste des leads que personne ne supervise.
  ecartes: { motif: Exclude<MotifExclusion, null>; nombre: number }[];
};

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

const VIDE = (periode: Periode, perimetre: Perimetre): SupervisionData => ({
  periode,
  rows: [],
  flux: [],
  filtres: { pays: [], activites: [], commerciaux: [] },
  perimetre,
  configure: false,
  ecartes: [],
});

export async function getSupervisionData(periode: Periode): Promise<SupervisionData | null> {
  const perimetre = await getPerimetreSuperviseur();
  if (!perimetre) return null;

  // FERMÉ PAR DÉFAUT : on n'interroge même pas la base. Rien n'est lu, donc
  // rien ne peut fuir — et l'interface reçoit de quoi expliquer pourquoi.
  if (!perimetreConfigure(perimetre)) return VIDE(periode, perimetre);

  const univers = await getUnivers();
  const { debut, fin } = bornes(periode);
  // Service-role : la supervision agrège l'activité de TOUTE l'équipe, ce que
  // la RLS « mine » interdirait. Le périmètre est appliqué juste en dessous,
  // explicitement — c'est lui qui fait la sécurité ici, pas la RLS.
  const sb = await supabaseServiceRole();

  const [leadsRes, actsRes, usersRes, docsRes, optRes, auditRes, actionsRes,
    appelsRes] = await Promise.all([
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
    // ── Événements d'appel, en requête DÉDIÉE ────────────────────────
    //
    // Pas dans les 1 500 dernières entrées d'audit ci-dessus : ce flux-là est
    // ordonné par date et sert au fil d'activité, donc un appel vieux de trois
    // mois en sort. Pour la machine à états, un appel ancien compte autant
    // qu'un appel récent — c'est lui qui dit si le client a été joint un jour.
    sb.from("audit_logs")
      .select("action, created_at, user_id, entity_id, after")
      .in("action", ["lead.appel.declare", "lead.call.outbound", "lead.nrp.set"])
      .order("created_at", { ascending: true })
      .returns<{
        action: string; created_at: string; user_id: string | null;
        entity_id: string | null; after: Record<string, unknown> | null;
      }[]>(),
  ]);

  const actById = new Map((actsRes.data ?? []).map((a) => [a.id, a]));
  const userById = new Map(
    (usersRes.data ?? []).map((u) => [u.id, `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—"]),
  );

  // ── Périmètre appliqué AVANT tout calcul ─────────────────────────────
  //
  // Les règles vivent dans lib/supervision-perimetre.ts : exclusion des
  // activités hors des deux familles supervisées (pour tout le monde, Super
  // Admin compris), puis pays, commercial et activité autorisés. Un axe vide
  // ne laisse rien passer.
  const aFiltrer = (l: LeadRow) => ({
    pays: l.country,
    activityId: l.activity_id,
    activiteSlug: l.activity_id ? (actById.get(l.activity_id)?.slug ?? null) : null,
    ownerId: l.owner_id,
  });

  const tousLeads: LeadRow[] = [];
  const motifs = new Map<Exclude<MotifExclusion, null>, number>();
  for (const l of leadsRes.data ?? []) {
    const d = aFiltrer(l);
    if (dossierDansPerimetre(perimetre, d, univers)) {
      tousLeads.push(l);
      continue;
    }
    // Hors périmètre : on retient POURQUOI, sans conserver la moindre donnée
    // du dossier. Un compteur n'est pas une fuite, un silence est un risque.
    const motif = motifExclusion(perimetre, d, univers);
    if (motif) motifs.set(motif, (motifs.get(motif) ?? 0) + 1);
  }
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

  // ── Appels par dossier, source par source (D1 du 2026-11-06) ─────────
  //
  // ⚠️ DÉCLARÉ ET CONFIRMÉ NE SE MÉLANGENT PAS. Le client l'a exigé : « un
  // clic manuel constitue une déclaration du commercial ; il ne doit pas être
  // présenté comme une preuve d'appel vérifiée ». Les deux sources sont donc
  // portées jusqu'à l'écran, et `dedoublonnerAppels()` arbitre le jour où un
  // même appel arrive par les deux chemins.
  const appelsParLead = new Map<string, Appel[]>();
  for (const e of appelsRes.data ?? []) {
    if (!e.entity_id) continue;
    const apres = (e.after ?? {}) as Record<string, unknown>;
    let resultat: ResultatAppel | null = null;
    let source: SourceAppel = "declare";

    if (e.action === "lead.appel.declare") {
      const r = String(apres.resultat ?? "");
      if (r === "joint" || r === "sans_reponse" || r === "rappel" || r === "injoignable") {
        resultat = r;
      }
      source = apres.source === "ringover" ? "ringover" : "declare";
    } else if (e.action === "lead.call.outbound") {
      // Appel lancé depuis le webphone. ⚠️ `fake: true` = appel SIMULÉ en
      // développement : il ne doit jamais compter comme un appel réel.
      if (apres.fake === true) continue;
      // Un appel lancé n'est pas un appel abouti : le webphone ne sait pas si
      // le client a décroché. On enregistre donc une tentative, pas un contact.
      resultat = "rappel";
      source = "ringover";
    } else if (e.action === "lead.nrp.set" && apres.nrp === true) {
      resultat = "sans_reponse";
      source = "declare";
    }

    if (!resultat) continue;
    const liste = appelsParLead.get(e.entity_id) ?? [];
    liste.push({ le: e.created_at, resultat, source, parQui: e.user_id });
    appelsParLead.set(e.entity_id, liste);
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

    // ⚠️ « TRAITÉ » NE VEUT PLUS DIRE « QUELQU'UN A OUVERT LA FICHE ».
    //
    // L'ancienne définition était :
    //
    //   traite = status !== "lead" || discovery_done_at || premiereOuverture
    //
    // où `premiereOuverture` vient de l'audit `lead.open` — c'est-à-dire du
    // simple fait d'AFFICHER le dossier. Mesuré sur les 712 leads de
    // production : 650 comptés « traités », dont 601 sur ce seul critère. Le
    // cockpit annonçait 62 leads en attente quand 663 n'avaient jamais
    // dépassé le statut « lead ».
    //
    // Ouvrir une fiche n'est pas appeler un client. La définition vit
    // désormais dans `lib/supervision-etats.ts`, elle est pure, testée, et
    // elle exige un ÉVÉNEMENT : un appel où le client a été joint, ou une
    // étape postérieure qui le prouve.
    const appels = dedoublonnerAppels(appelsParLead.get(l.id) ?? []);
    const faits: FaitsLead = {
      ownerId: l.owner_id,
      statut: l.status,
      decouverteLe: l.discovery_done_at,
      appels,
      devisEnvoye: aUnDevisEnvoye.has(l.id),
      devisOuvert: l.status === "ouvert",
      devisSigne: l.status === "signe" || l.status === "encaisse",
      isNrp: false,
      motifPerte: null,
    };
    const etat = etatDuLead(faits);
    const traite = estContacte(faits);

    // Réactivité : délai jusqu'au PREMIER APPEL, pas jusqu'au premier
    // affichage de la fiche. `null` quand aucun appel n'est journalisé — et
    // c'est aujourd'hui le cas général : la production ne porte que dix
    // appels tracés. Un zéro ou une moyenne masquerait exactement ce que le
    // superviseur doit voir.
    const delai = delaiPremierAppelMin(faits, l.received_at);
    const compte = compterAppels(appels);
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
      etat,
      appelsDeclares: compte.declares,
      appelsRingover: compte.ringover,
      // Délai jusqu'au premier AFFICHAGE de la fiche. Conservé parce qu'il est
      // le seul signal disponible sur la quasi-totalité des dossiers, mais
      // nommé pour ce qu'il est : il ne prouve aucun contact.
      delaiPremiereOuvertureMin: ouvert
        ? Math.max(0, Math.round(
            (new Date(ouvert).getTime() - new Date(l.received_at).getTime()) / 60000))
        : null,
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
    perimetre,
    configure: true,
    ecartes: [...motifs.entries()]
      .map(([motif, nombre]) => ({ motif, nombre }))
      .sort((a, b) => b.nombre - a.nombre),
  };
}
