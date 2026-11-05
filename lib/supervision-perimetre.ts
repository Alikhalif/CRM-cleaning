// Périmètre du module Superviseur — module PUR (aucune I/O), importable côté
// client comme serveur.
//
// ⚠️ RÈGLE FONDAMENTALE (décision client du 2026-11-05, « OPTION A ») :
// FERMÉ PAR DÉFAUT. Un superviseur sans périmètre configuré n'accède à AUCUNE
// donnée commerciale. Il n'existe aucune autorisation implicite : une liste
// vide ne veut pas dire « tout », elle veut dire « rien ».
//
// C'est l'inverse de la convention utilisée ailleurs dans le CRM
// (`visibleSectorsForUser`, `visibleCountriesForUser` : liste vide = pas de
// restriction, pour activer le cloisonnement progressivement). Ici le client a
// explicitement demandé le contraire, et les deux conventions ne doivent pas
// être confondues — d'où un module séparé plutôt qu'une réutilisation.
//
// Le filtrage réel est appliqué CÔTÉ SERVEUR (lib/supervision-server.ts) :
// les lignes hors périmètre ne quittent pas la machine. Masquer dans
// l'interface ne compterait pas comme une restriction.

import { COUNTRIES, type Country } from "./leads";

// ── Les deux familles commerciales et leurs branches ──────────────────
//
// Organisation arrêtée par le client le 2026-11-05 : le module Superviseur ne
// connaît que DEUX familles, chacune découpée en branches.
//
// ⚠️ Ne pas confondre avec `FAMILLE_NETTOYAGE` de lib/discovery-nettoyage.ts,
// qui regroupe les secteurs partageant le même FORMULAIRE de découverte et
// inclut `urgence`. Ici `urgence` est exclu : ce sont deux notions distinctes
// (regroupement de supervision ≠ regroupement de formulaire). Les découvertes
// restent spécifiques à chaque prestation — consigne explicite du client.

export type FamilleSlug = "nettoyage" | "demenagement_debarras_transport";
export type BrancheSlug =
  | "nettoyage"
  | "desinfection"
  | "desinsectisation"
  | "demenagement"
  | "debarras"
  | "transport";

export type Branche = {
  slug: BrancheSlug;
  label: string;
  famille: FamilleSlug;
  // Secteurs (`activities.slug`) rattachés à cette branche et RÉELLEMENT
  // présents en base. Une branche peut être vide : voir `manque` ci-dessous.
  secteurs: string[];
  // Renseigné quand la branche n'a encore aucune activité en base. Affiché
  // tel quel au Super Admin : on ne fait pas croire qu'un filtre existe.
  manque?: string;
};

export const BRANCHES: Record<BrancheSlug, Branche> = {
  // ── Famille 1 — NETTOYAGE ───────────────────────────────────────────
  nettoyage: {
    slug: "nettoyage",
    label: "Nettoyage",
    famille: "nettoyage",
    // Nettoyage classique / approfondi / après chantier / après déménagement
    // → `nettoyage` ; insalubre, après décès, après sinistre →
    // `nettoyage_difficile` ; Diogène → `diogene`. Trois degrés de la même
    // prestation, pas trois familles indépendantes.
    secteurs: ["nettoyage", "nettoyage_difficile", "diogene"],
  },
  desinfection: {
    slug: "desinfection",
    label: "Désinfection / Décontamination",
    famille: "nettoyage",
    secteurs: [],
    manque:
      "Aucune activité « désinfection » en base : désinfection et décontamination " +
      "sont aujourd'hui des PRESTATIONS cochées dans la découverte Nettoyage " +
      "(lib/discovery-nettoyage.ts · COMPLEMENTS), pas une activité à part. " +
      "Filtrer dessus demande une décision : créer l'activité, ou déduire la " +
      "branche du contenu de la découverte.",
  },
  desinsectisation: {
    slug: "desinsectisation",
    label: "Désinsectisation / Dératisation",
    famille: "nettoyage",
    secteurs: [],
    manque:
      "Aucune activité « désinsectisation » en base : désinsectisation, " +
      "dératisation et nuisibles existent comme TAGS de fiche client dans le " +
      "module Documents & Contrats (lib/documents/tags.ts), pas comme activité " +
      "de lead. Même décision à prendre que pour la désinfection.",
  },

  // ── Famille 2 — DÉMÉNAGEMENT / DÉBARRAS / TRANSPORT ─────────────────
  demenagement: {
    slug: "demenagement",
    label: "Déménagement",
    famille: "demenagement_debarras_transport",
    secteurs: ["demenagement"],
  },
  debarras: {
    slug: "debarras",
    label: "Débarras",
    famille: "demenagement_debarras_transport",
    secteurs: ["debarras"],
  },
  transport: {
    slug: "transport",
    label: "Transport",
    famille: "demenagement_debarras_transport",
    secteurs: ["transport"],
  },
};

export type Famille = {
  slug: FamilleSlug;
  label: string;
  branches: BrancheSlug[];
};

export const FAMILLES: Famille[] = [
  {
    slug: "nettoyage",
    label: "Nettoyage",
    branches: ["nettoyage", "desinfection", "desinsectisation"],
  },
  {
    slug: "demenagement_debarras_transport",
    label: "Déménagement / Débarras / Transport",
    branches: ["demenagement", "debarras", "transport"],
  },
];

export const BRANCHES_ORDONNEES: BrancheSlug[] = FAMILLES.flatMap((f) => f.branches);

// Secteurs couverts par le module Superviseur. Tout le reste est HORS
// périmètre, pour tout le monde — y compris le Super Admin : le client a
// demandé que ces activités n'apparaissent ni dans les filtres, ni dans les
// tableaux de bord, ni dans les statistiques du module. Elles restent
// évidemment intactes dans le reste du CRM.
export const SECTEURS_SUPERVISES: string[] = BRANCHES_ORDONNEES.flatMap(
  (b) => BRANCHES[b].secteurs,
);

// Exclusions explicites, nommées pour que le contrôle de non-régression
// échoue si un secteur apparaît un jour sans être classé d'un côté ou de
// l'autre (cf. scripts/superviseur-check). Dépannage / urgence bâtiment, ENR,
// rénovation et TCE ne sont pas supervisés.
export const SECTEURS_HORS_PERIMETRE: string[] = ["urgence", "enr", "renovation"];

export function estSecteurSupervise(slug: string | null | undefined): boolean {
  return slug != null && SECTEURS_SUPERVISES.includes(slug);
}

export function brancheDuSecteur(slug: string | null | undefined): BrancheSlug | null {
  if (!slug) return null;
  for (const b of BRANCHES_ORDONNEES) {
    if (BRANCHES[b].secteurs.includes(slug)) return b;
  }
  return null;
}

export function familleDuSecteur(slug: string | null | undefined): FamilleSlug | null {
  const b = brancheDuSecteur(slug);
  return b ? BRANCHES[b].famille : null;
}

export function familleLabel(slug: FamilleSlug): string {
  return FAMILLES.find((f) => f.slug === slug)?.label ?? slug;
}

// ── Droits d'intervention ─────────────────────────────────────────────
//
// Quatre droits distincts, demandés au §6 de la validation client. Tous à
// `false` par défaut : un superviseur consulte, il n'intervient que si le
// Super Admin l'y autorise explicitement.
//
// Le lot 1 les MODÉLISE, les stocke et fournit la garde serveur
// (`assertDroitSuperviseur`). Les actions elles-mêmes — demander une action,
// réaffecter, prioriser — sont développées aux lots 3 et 4.

export type DroitIntervention =
  | "ouvrirDossier"
  | "demanderAction"
  | "reaffecter"
  | "definirPriorite";

export type DroitsIntervention = Record<DroitIntervention, boolean>;

export const AUCUN_DROIT: DroitsIntervention = {
  ouvrirDossier: false,
  demanderAction: false,
  reaffecter: false,
  definirPriorite: false,
};

export const TOUS_LES_DROITS: DroitsIntervention = {
  ouvrirDossier: true,
  demanderAction: true,
  reaffecter: true,
  definirPriorite: true,
};

export const DROITS_ORDONNES: DroitIntervention[] = [
  "ouvrirDossier",
  "demanderAction",
  "reaffecter",
  "definirPriorite",
];

export const DROIT_LABEL: Record<DroitIntervention, string> = {
  ouvrirDossier: "Ouvrir les dossiers de son périmètre",
  demanderAction: "Demander une action au commercial",
  reaffecter: "Réaffecter un lead",
  definirPriorite: "Définir une priorité",
};

export const DROIT_DETAIL: Record<DroitIntervention, string> = {
  ouvrirDossier:
    "Accès à la fiche complète, en lecture. Sans ce droit : indicateurs et alertes seulement.",
  demanderAction:
    "Crée une demande tracée, visible par le commercial. N'agit jamais à sa place.",
  reaffecter: "Change le commercial responsable d'un lead de son périmètre.",
  definirPriorite: "Marque un dossier comme prioritaire pour le commercial.",
};

// ── Le périmètre lui-même ─────────────────────────────────────────────

export type PorteePerimetre =
  // Super Admin : accès global, aucune restriction de périmètre — il conserve
  // naturellement son accès (consigne client §1).
  | "admin"
  // Superviseur : strictement limité à ce que le Super Admin a configuré.
  | "superviseur";

export type Perimetre = {
  portee: PorteePerimetre;
  pays: string[];
  activityIds: string[];
  commerciauxIds: string[];
  // Les leads SANS commercial (file « À affecter ») ne relèvent d'aucun
  // commercial : aucune liste de commerciaux ne peut les couvrir. Les inclure
  // est donc une autorisation à part entière, explicite et fermée par défaut.
  // Sans elle, « aucun lead oublié » s'arrêterait à la porte des leads non
  // attribués — c'est au Super Admin de trancher, superviseur par superviseur.
  inclureNonAttribues: boolean;
  droits: DroitsIntervention;
};

export const PERIMETRE_VIDE: Perimetre = {
  portee: "superviseur",
  pays: [],
  activityIds: [],
  commerciauxIds: [],
  inclureNonAttribues: false,
  droits: AUCUN_DROIT,
};

// L'univers des valeurs possibles, fourni par le serveur. Sert UNIQUEMENT à
// répondre à la question « ce périmètre couvre-t-il tout l'axe ? » — ce qui
// décide du sort des dossiers dont la valeur n'est pas renseignée (voir
// `dossierDansPerimetre`).
export type Univers = {
  // Identifiants des activités supervisées existant en base.
  activityIds: string[];
};

export function couvreTousLesPays(p: Perimetre): boolean {
  return COUNTRIES.every((c) => p.pays.includes(c));
}

export function couvreToutesLesActivites(p: Perimetre, u: Univers): boolean {
  return u.activityIds.length > 0 && u.activityIds.every((id) => p.activityIds.includes(id));
}

/**
 * Ce périmètre autorise-t-il quoi que ce soit ?
 *
 * Les trois axes se CUMULENT : un dossier doit satisfaire les trois. Un axe
 * vide ne laisse donc passer aucun dossier — c'est exactement l'Option A. La
 * fonction ne fait que le dire explicitement, pour que l'interface affiche
 * « périmètre non configuré » au lieu d'un tableau de bord vide et
 * inexplicable.
 */
export function perimetreConfigure(p: Perimetre): boolean {
  if (p.portee === "admin") return true;
  if (p.pays.length === 0) return false;
  if (p.activityIds.length === 0) return false;
  return p.commerciauxIds.length > 0 || p.inclureNonAttribues;
}

export type DossierAFiltrer = {
  pays: string | null;
  activityId: string | null;
  // `activities.slug` du dossier — c'est lui qui décide de l'exclusion de
  // module, indépendamment de ce que le Super Admin a pu cocher.
  activiteSlug: string | null;
  ownerId: string | null;
};

/**
 * Le dossier est-il dans le périmètre ? Appliqué côté serveur, AVANT tout
 * calcul d'indicateur.
 *
 * Quatre règles :
 *
 *  1. EXCLUSION DE MODULE — l'activité doit appartenir aux deux familles
 *     supervisées. Dépannage, ENR, rénovation, TCE sont écartés pour tout le
 *     monde, Super Admin compris : c'est le périmètre du module, pas un droit.
 *  2. PAYS — le pays du dossier doit être autorisé.
 *  3. COMMERCIAL — le propriétaire du dossier doit être autorisé.
 *  4. ACTIVITÉ — l'activité du dossier doit être autorisée.
 *
 * Valeurs NON RENSEIGNÉES (pays absent, activité absente) : un dossier dont
 * l'axe est vide n'est admis que si le périmètre couvre TOUT cet axe. La
 * logique est conservatrice et vérifiable : quand le périmètre couvre
 * l'univers entier des valeurs possibles, une valeur inconnue ne peut pas
 * tomber en dehors ; dès qu'il est restreint, on ne devine pas. Les dossiers
 * ainsi écartés sont comptés et affichés (`nonClassables`) : ils ne
 * disparaissent pas en silence.
 */
export function dossierDansPerimetre(p: Perimetre, d: DossierAFiltrer, u: Univers): boolean {
  // 1. Exclusion de module — s'applique à tous, Super Admin compris.
  if (d.activiteSlug != null) {
    if (!estSecteurSupervise(d.activiteSlug)) return false;
  } else if (!couvreToutesLesActivites(p, u)) {
    // Activité non renseignée : admise seulement sur un périmètre complet.
    return false;
  }

  if (p.portee === "admin") return true;

  // 2. Pays.
  if (d.pays == null) {
    if (!couvreTousLesPays(p)) return false;
  } else if (!p.pays.includes(d.pays)) {
    return false;
  }

  // 3. Commercial.
  if (d.ownerId == null) {
    if (!p.inclureNonAttribues) return false;
  } else if (!p.commerciauxIds.includes(d.ownerId)) {
    return false;
  }

  // 4. Activité autorisée (l'exclusion de module est déjà passée).
  if (d.activityId != null && !p.activityIds.includes(d.activityId)) return false;

  return true;
}

/**
 * Pourquoi ce dossier est-il hors périmètre ? Sert aux compteurs
 * d'explication (« N dossiers sans activité renseignée »), pas au filtrage —
 * le filtrage, c'est `dossierDansPerimetre`.
 */
export type MotifExclusion =
  | "activite_hors_module"
  | "activite_absente"
  | "activite_non_autorisee"
  | "pays_absent"
  | "pays_non_autorise"
  | "non_attribue"
  | "commercial_non_autorise"
  | null;

export function motifExclusion(p: Perimetre, d: DossierAFiltrer, u: Univers): MotifExclusion {
  if (d.activiteSlug != null && !estSecteurSupervise(d.activiteSlug)) return "activite_hors_module";
  if (d.activiteSlug == null && !couvreToutesLesActivites(p, u)) return "activite_absente";
  if (p.portee === "admin") return null;
  if (d.pays == null && !couvreTousLesPays(p)) return "pays_absent";
  if (d.pays != null && !p.pays.includes(d.pays)) return "pays_non_autorise";
  if (d.ownerId == null && !p.inclureNonAttribues) return "non_attribue";
  if (d.ownerId != null && !p.commerciauxIds.includes(d.ownerId)) return "commercial_non_autorise";
  if (d.activityId != null && !p.activityIds.includes(d.activityId)) return "activite_non_autorisee";
  return null;
}

export const MOTIF_LABEL: Record<Exclude<MotifExclusion, null>, string> = {
  activite_hors_module: "Activité hors des deux familles supervisées",
  activite_absente: "Activité non renseignée sur le dossier",
  activite_non_autorisee: "Activité absente du périmètre autorisé",
  pays_absent: "Pays non renseigné sur le dossier",
  pays_non_autorise: "Pays absent du périmètre autorisé",
  non_attribue: "Lead sans commercial attribué",
  commercial_non_autorise: "Commercial absent du périmètre autorisé",
};

export function aDroit(p: Perimetre, droit: DroitIntervention): boolean {
  if (p.portee === "admin") return true;
  if (!perimetreConfigure(p)) return false;
  return p.droits[droit] === true;
}

// Libellés des pays repris de lib/leads.ts : le module Superviseur n'en
// invente pas une deuxième liste.
export { COUNTRIES, COUNTRY_LABEL } from "./leads";
export type { Country };
