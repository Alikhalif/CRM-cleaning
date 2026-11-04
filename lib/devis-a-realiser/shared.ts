// « Devis à réaliser » — helpers PURS, aucune I/O.
//
// VUE DÉRIVÉE, PAS UN SECOND PIPELINE
//
// Rien n'est stocké ici : l'appartenance à la liste et le sous-statut se
// RELISENT à chaque affichage depuis l'état réel du dossier. C'est ce qui
// donne les trois propriétés demandées au cahier du 2026-11-03 :
//
//   • §3 — aucune manipulation : le dossier entre dans la liste dès que la
//     découverte est validée, sans qu'on le déplace ;
//   • §5 — il en sort quand le devis est RÉELLEMENT parti, parce que la
//     sortie se lit sur le statut du lead, pas sur un geste de rangement ;
//   • §13-10 — les dossiers déjà en base y apparaissent d'eux-mêmes, sans
//     reprise de données : il n'y a rien à migrer.
//
// Le module ne crée AUCUNE tâche et ne touche à aucun statut de pipeline. Il
// lit, situe et ordonne — comme `lib/suivi-shared.ts`, dont il reprend le
// vocabulaire plutôt que d'en inventer un second.

import type { Lead } from "../leads";
import type { Situation } from "../suivi-shared";

// ══════════════════════════════════════════════════════════════════════
//  Appartenance à la liste
// ══════════════════════════════════════════════════════════════════════

/**
 * Statuts de lead qui signifient « le devis est parti » ou « le dossier est
 * clos ». Un dossier qui en porte un ne figure plus dans la liste.
 *
 * La sortie se lit sur `leads.status` et sur lui seul. C'est le signal posé
 * par TOUS les chemins d'envoi réel — devis manuel (`intent === "send"`),
 * marquage « envoyé », envoi par e-mail, devis OPTIMIVV — et jamais par la
 * simple création d'un brouillon. Depuis le 2026-11-04 l'envoi est TOUJOURS
 * déclenché par une personne : entrer dans cette liste ne fait jamais partir
 * un devis. C'est donc exactement la
 * règle absolue du §5 : commencer ou finir la rédaction ne fait pas sortir le
 * dossier, seul l'envoi le fait.
 */
export const STATUTS_SORTIE = new Set(["envoye", "ouvert", "signe", "encaisse", "perdu"]);

/**
 * Le dossier attend-il un devis ?
 *
 * Deux conditions, toutes deux lues sur le lead :
 *   1. la découverte a été VALIDÉE — `discovery_done_at`, posé par le bouton
 *      « Enregistrer » explicite de la fiche découverte. Un enregistrement
 *      partiel du brouillon n'y touche pas (règle déjà en vigueur dans le
 *      Suivi commercial) ;
 *   2. aucun devis n'est parti.
 *
 * On ne se sert PAS de `situationOf()` pour décider de l'appartenance : un
 * dossier dont les photos sont attendues sort en `attente_client` avant même
 * que la découverte soit validée, et il n'a rien à faire dans cette liste.
 * Le §12 veut l'inverse : découverte terminée + photos manquantes → présent,
 * avec une indication. D'où ce test direct.
 */
export function attendUnDevis(lead: Lead): boolean {
  return attendUnDevisDe(lead.discoveryDoneAt, lead.status);
}

/**
 * La même règle, sur les deux seuls champs qu'elle lit.
 *
 * Elle existe pour le COMPTEUR affiché ailleurs (tableau de bord, suivi,
 * supervision), qui ne doit pas charger un lead entier pour afficher un
 * nombre : `getAllLeads()` ramène une quarantaine de colonnes, soit près de
 * 900 Ko, là où deux suffisent. Les deux chemins appellent cette fonction, si
 * bien que le compteur et la liste ne peuvent pas se contredire — un test le
 * vérifie sur le même jeu de données.
 */
export function attendUnDevisDe(
  discoveryDoneAt: string | null | undefined,
  status: string,
): boolean {
  if (!discoveryDoneAt) return false;
  return !STATUTS_SORTIE.has(status);
}

// ══════════════════════════════════════════════════════════════════════
//  Les cinq statuts du §5
// ══════════════════════════════════════════════════════════════════════

export type StatutDevis =
  | "a_realiser"
  | "en_preparation"
  | "attente_infos"
  | "pret_a_envoyer"
  | "envoye";

export const STATUT_LABEL: Record<StatutDevis, string> = {
  a_realiser: "Découverte enregistrée — devis à réaliser",
  en_preparation: "Devis en préparation",
  attente_infos: "En attente d'informations complémentaires",
  pret_a_envoyer: "Devis prêt à envoyer",
  envoye: "Devis envoyé",
};

/** Libellé court, pour une pastille de tableau. */
export const STATUT_COURT: Record<StatutDevis, string> = {
  a_realiser: "À réaliser",
  en_preparation: "En préparation",
  attente_infos: "Attente d'infos",
  pret_a_envoyer: "Prêt à envoyer",
  envoye: "Envoyé",
};

export const STATUTS: StatutDevis[] = [
  "a_realiser", "en_preparation", "attente_infos", "pret_a_envoyer",
];

/** Ce que le CRM sait des devis d'un dossier. Tout vient de la base. */
export type EtatDevis = {
  /** Un devis brouillon existe (table `documents`, statut brouillon). */
  brouillon: boolean;
  /** Ce brouillon porte un montant : il est rédigé, pas seulement ouvert. */
  brouillonChiffre: boolean;
  /** Un devis OPTIMIVV existe sans date d'envoi. */
  optimivvNonEnvoye: boolean;
  /** Des photos ont été demandées au client et ne sont pas arrivées. */
  photosEnAttente: boolean;
};

/**
 * Sous-statut du dossier, dérivé.
 *
 * L'ORDRE DE PRIORITÉ répond à la question « que doit faire le commercial
 * maintenant ? ». Un devis chiffré prime sur des photos manquantes : s'il est
 * prêt, l'action est de l'envoyer. Les photos manquantes restent signalées
 * à part (§12), par un indicateur et non par le statut — sinon un devis prêt
 * resterait caché derrière une attente de photos.
 */
export function statutDevis(e: EtatDevis): StatutDevis {
  if (e.brouillonChiffre || e.optimivvNonEnvoye) return "pret_a_envoyer";
  if (e.brouillon) return "en_preparation";
  if (e.photosEnAttente) return "attente_infos";
  return "a_realiser";
}

/**
 * Correspondance avec le vocabulaire du Suivi commercial.
 *
 * Les deux vues doivent raconter la même histoire : un dossier affiché
 * « Devis en préparation » ici ne doit pas s'afficher « Découverte terminée »
 * là-bas. Cette fonction est le pont, et un test vérifie qu'il tient.
 */
export function situationEquivalente(s: StatutDevis): Situation {
  switch (s) {
    case "a_realiser": return "decouverte_faite";
    case "en_preparation":
    case "pret_a_envoyer": return "devis_preparation";
    case "attente_infos": return "attente_client";
    case "envoye": return "devis_envoye";
  }
}

// ══════════════════════════════════════════════════════════════════════
//  Ancienneté et alerte visuelle (§6)
// ══════════════════════════════════════════════════════════════════════

export type Urgence = "recent" | "attente" | "prioritaire";

export const URGENCE_LABEL: Record<Urgence, string> = {
  recent: "Découverte récente",
  attente: "Devis en attente",
  prioritaire: "Traitement prioritaire",
};

/**
 * Seuils d'ancienneté, en heures. Paramétrables par le Super Admin (§6).
 *
 * Les valeurs par défaut sont celles du cahier : vert sous 2 h, orange de 2 à
 * 24 h, rouge au-delà. Elles vivent dans `app_settings`, donc modifiables sans
 * redéploiement — et ce sont des SEUILS d'affichage, jamais un tarif : les
 * changer ne touche aucun montant.
 */
export type SeuilsUrgence = { vertH: number; orangeH: number };

export const SEUILS_DEFAUT: SeuilsUrgence = { vertH: 2, orangeH: 24 };

/**
 * Normalise des seuils venus de la configuration.
 *
 * Un seuil absurde — négatif, nul, inversé — ne doit pas rendre la colonne
 * illisible : on retombe sur le défaut plutôt que de colorer au hasard.
 */
export function seuilsValides(brut: Partial<SeuilsUrgence> | null | undefined): SeuilsUrgence {
  const n = (v: unknown, defaut: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : defaut;
  const vertH = n(brut?.vertH, SEUILS_DEFAUT.vertH);
  const orangeH = n(brut?.orangeH, SEUILS_DEFAUT.orangeH);
  return orangeH > vertH ? { vertH, orangeH } : SEUILS_DEFAUT;
}

/** Heures écoulées depuis la validation de la découverte. */
export function heuresDepuis(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now - t) / 3_600_000);
}

export function urgenceDe(heures: number | null, s: SeuilsUrgence): Urgence {
  // Sans date de découverte on ne colore pas en vert par défaut : un dossier
  // dont on ignore l'ancienneté est au moins « en attente ».
  if (heures == null) return "attente";
  if (heures < s.vertH) return "recent";
  if (heures < s.orangeH) return "attente";
  return "prioritaire";
}

/** « 3 h », « 2 j 4 h », « 18 min » — ancienneté lisible. */
export function ancienneteLabel(heures: number | null): string {
  if (heures == null) return "—";
  if (heures < 1) return `${Math.max(1, Math.round(heures * 60))} min`;
  if (heures < 48) return `${Math.floor(heures)} h`;
  const jours = Math.floor(heures / 24);
  const reste = Math.floor(heures % 24);
  return reste > 0 ? `${jours} j ${reste} h` : `${jours} j`;
}

// ══════════════════════════════════════════════════════════════════════
//  La ligne de la liste (§4)
// ══════════════════════════════════════════════════════════════════════

export type LigneDevis = {
  leadId: string;
  shortId: string;
  client: string;
  phone: string;
  /** Adresse d'intervention. */
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string | null;
  /** Type de prestation — le secteur du dossier. */
  prestation: string;
  prestationSlug: string;
  /** Entité juridique émettrice rattachée au dossier. */
  societe: string | null;
  societeId: string | null;
  commercialId: string | null;
  commercial: string | null;
  /** Date d'entrée du lead. */
  arriveeLe: string;
  /** Date de validation de la découverte — base de l'ancienneté. */
  decouverteLe: string | null;
  /** Début de préparation du devis : création du brouillon. */
  preparationLe: string | null;
  heures: number | null;
  urgence: Urgence;
  statut: StatutDevis;
  /** §12 — indication séparée du statut. */
  photosManquantes: boolean;
  photosDemandeesLe: string | null;
  isUrgent: boolean;
};

// ══════════════════════════════════════════════════════════════════════
//  Filtres et recherche (§7)
// ══════════════════════════════════════════════════════════════════════

export type Filtres = {
  commercial: string;
  prestation: string;
  societe: string;
  pays: string;
  statut: string;
  /** "" | "oui" | "non" — photos reçues ou manquantes. */
  photos: string;
  /** Ancienneté minimale, en heures. 0 = sans minimum. */
  ancienneteMin: number;
  /** Bornes sur la date de découverte, en « AAAA-MM-JJ ». */
  depuis: string;
  jusqu: string;
  recherche: string;
};

export const FILTRES_VIDES: Filtres = {
  commercial: "", prestation: "", societe: "", pays: "", statut: "",
  photos: "", ancienneteMin: 0, depuis: "", jusqu: "", recherche: "",
};

/** Normalise pour la recherche : sans accent, sans ponctuation, minuscule. */
function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * La ligne correspond-elle à la recherche ?
 *
 * Nom, téléphone ou numéro de dossier (§7). Le téléphone est comparé CHIFFRE
 * À CHIFFRE : un commercial tape « 0612345678 » là où la base contient
 * « +33 6 12 34 56 78 », et les deux doivent se rencontrer.
 */
export function correspondRecherche(l: LigneDevis, q: string): boolean {
  const terme = q.trim();
  if (!terme) return true;

  const chiffres = terme.replace(/\D/g, "");
  if (chiffres.length >= 4) {
    const tel = l.phone.replace(/\D/g, "");
    // On compare les fins de numéro : indicatif pays écrit ou non, le reste
    // concorde. « 0612… » et « +33612… » partagent « 612… ».
    if (tel && (tel.endsWith(chiffres) || chiffres.endsWith(tel.slice(-9)))) return true;
  }

  const n = normaliser(terme);
  if (!n) return false;
  return (
    normaliser(l.client).includes(n) ||
    normaliser(l.shortId).includes(n) ||
    normaliser(l.ville).includes(n) ||
    normaliser(l.adresse).includes(n)
  );
}

/** Bornes « AAAA-MM-JJ » → le jour est inclus de bout en bout. */
function dansBornes(iso: string | null, depuis: string, jusqu: string): boolean {
  if (!depuis && !jusqu) return true;
  if (!iso) return false;
  const jour = iso.slice(0, 10);
  if (depuis && jour < depuis) return false;
  if (jusqu && jour > jusqu) return false;
  return true;
}

export function appliquerFiltres(lignes: readonly LigneDevis[], f: Filtres): LigneDevis[] {
  return lignes.filter((l) => {
    if (f.commercial && l.commercialId !== f.commercial) return false;
    if (f.prestation && l.prestationSlug !== f.prestation) return false;
    if (f.societe && l.societeId !== f.societe) return false;
    if (f.pays && l.pays !== f.pays) return false;
    if (f.statut && l.statut !== f.statut) return false;
    // « oui » = photos MANQUANTES, « non » = photos reçues — l'intitulé du
    // filtre porte sur le manque, pas sur la présence. Les deux conditions
    // étaient inversées : demander « manquantes » renvoyait les dossiers
    // complets, et inversement.
    if (f.photos === "oui" && !l.photosManquantes) return false;
    if (f.photos === "non" && l.photosManquantes) return false;
    if (f.ancienneteMin > 0 && (l.heures ?? 0) < f.ancienneteMin) return false;
    if (!dansBornes(l.decouverteLe, f.depuis, f.jusqu)) return false;
    return correspondRecherche(l, f.recherche);
  });
}

/**
 * Ordre par défaut : LES PLUS ANCIENS D'ABORD (§7).
 *
 * C'est l'inverse du Suivi commercial, et c'est voulu : cette vue sert à
 * rattraper les retards, pas à voir les nouveautés. Le dossier qui attend
 * depuis trois jours passe avant celui validé il y a dix minutes.
 *
 * À ancienneté égale, l'identifiant tranche, pour que la liste ne se
 * réorganise pas d'un affichage à l'autre.
 */
export function compareAnciennete(a: LigneDevis, b: LigneDevis): number {
  const ha = a.heures ?? Number.POSITIVE_INFINITY;
  const hb = b.heures ?? Number.POSITIVE_INFINITY;
  if (ha !== hb) return hb - ha;
  return a.leadId < b.leadId ? -1 : a.leadId > b.leadId ? 1 : 0;
}

// ══════════════════════════════════════════════════════════════════════
//  Compteurs du bouton et des onglets
// ══════════════════════════════════════════════════════════════════════

export type Compteurs = {
  total: number;
  parStatut: Record<StatutDevis, number>;
  parUrgence: Record<Urgence, number>;
  photosManquantes: number;
  /** Au-delà du seuil rouge — le chiffre qui doit alerter. */
  enRetard: number;
};

export function compter(lignes: readonly LigneDevis[]): Compteurs {
  const parStatut: Record<StatutDevis, number> = {
    a_realiser: 0, en_preparation: 0, attente_infos: 0, pret_a_envoyer: 0, envoye: 0,
  };
  const parUrgence: Record<Urgence, number> = { recent: 0, attente: 0, prioritaire: 0 };
  let photosManquantes = 0;

  for (const l of lignes) {
    parStatut[l.statut]++;
    parUrgence[l.urgence]++;
    if (l.photosManquantes) photosManquantes++;
  }

  return {
    total: lignes.length,
    parStatut,
    parUrgence,
    photosManquantes,
    enRetard: parUrgence.prioritaire,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Données de la page
// ══════════════════════════════════════════════════════════════════════
// Forme PURE : le composant client la lit sans jamais atteindre `server.ts`,
// qui porte `import "server-only"`.

export type DevisARealiserData = {
  lignes: LigneDevis[];
  compteurs: Compteurs;
  seuils: SeuilsUrgence;
  /** Horloge du serveur : l'ancienneté affichée ne doit pas dépendre du poste. */
  now: number;
  /** Listes pour les filtres, déduites des lignes visibles. */
  commerciaux: { id: string; name: string }[];
  prestations: { slug: string; label: string }[];
  societes: { id: string; name: string }[];
  pays: string[];
  isBackOffice: boolean;
  /** Seul le Super Admin règle les seuils (§6). */
  isAdmin: boolean;
  meId: string | null;
};
