// Quel gabarit rend quel devis, pour quelle société et quelle activité.
//
// ── LE PROBLÈME QU'IL RÉSOUT ──────────────────────────────────────────
//
// Le CRM porte QUATRE rendus de devis, écrits à des moments différents :
//
//   cgk_standard          react-pdf, deux thèmes selon le secteur, identité
//                         entièrement dynamique. C'est le rendu générique.
//   cgk_nettoyage         react-pdf, charte vert forêt et or reconstituée,
//                         identité entièrement dynamique.
//   optimivv_demenagement pdfkit, vectoriel, report au pixel de la maquette
//                         reportlab. Identité partiellement dynamique.
//   optimivv_nettoyage    pdf-lib, surcouche sur le design PDF fourni par le
//                         client. Identité CUITE dans le fichier — d'où la
//                         voie 0 (cf. `scripts/gabarit-neutre/neutraliser.py`).
//
// Aucun n'était choisissable : chaque parcours appelait le sien en dur. Une
// société suisse n'avait aucun moyen d'obtenir la présentation du gabarit
// nettoyage, et OPTIMIVV aucun moyen d'obtenir le rendu générique.
//
// ── CE QUI NE CHANGE PAS SANS RÉGLAGE ─────────────────────────────────
//
// `gabaritParDefaut()` reproduit EXACTEMENT le comportement du 2026-11-07 :
// un devis de secteur logistique sort en `cgk_standard`, les autres en
// `cgk_nettoyage`. Tant qu'aucun réglage n'est saisi, rien ne bouge — la
// bascule est une décision, jamais un effet de bord d'un déploiement.
//
// Pur, sans I/O. La lecture du réglage est à l'appelant (`app_settings`).

import type { Sector } from "@/lib/leads";

export type GabaritId =
  | "cgk_standard"
  | "cgk_nettoyage"
  | "optimivv_demenagement"
  | "optimivv_nettoyage";

/** Moteur de rendu employé — ils n'ont ni les mêmes entrées ni le même runtime. */
export type MoteurRendu = "react-pdf" | "pdfkit" | "pdf-lib";

/** Jusqu'où l'identité de la société émettrice est réellement portée. */
export type PorteeIdentite =
  /** Tout vient de `legal_entities` : rien n'est figé. */
  | "complete"
  /** Le design est réutilisé, l'identité neutralisée puis redessinée. */
  | "voie0"
  /** L'identité fait partie du design et ne peut pas changer. */
  | "figee";

export type Gabarit = {
  id: GabaritId;
  libelle: string;
  moteur: MoteurRendu;
  identite: PorteeIdentite;
  /** Secteurs pour lesquels ce gabarit a un sens. Vide = tous. */
  secteurs: Sector[];
  /** Ce que l'administrateur doit savoir avant de l'assigner. */
  note: string;
};

export const GABARITS: Record<GabaritId, Gabarit> = {
  cgk_standard: {
    id: "cgk_standard",
    libelle: "CGK standard",
    moteur: "react-pdf",
    identite: "complete",
    secteurs: [],
    note:
      "Rendu générique, deux thèmes selon le secteur. Convient à toute société "
      + "et à tout pays : aucune identité n'y est figée.",
  },
  cgk_nettoyage: {
    id: "cgk_nettoyage",
    libelle: "CGK propreté (vert et or)",
    moteur: "react-pdf",
    identite: "complete",
    secteurs: ["nettoyage", "nettoyage_difficile", "urgence", "enr", "renovation", "diogene"],
    note:
      "Charte verte et or reconstituée en vectoriel. La présentation est "
      + "équivalente au gabarit OPTIMIVV, pas identique au pixel.",
  },
  optimivv_demenagement: {
    id: "optimivv_demenagement",
    libelle: "OPTIMIVV déménagement (maquette figée)",
    moteur: "pdfkit",
    identite: "complete",
    secteurs: ["demenagement", "debarras", "transport", "diogene"],
    note:
      "Report au pixel de la maquette validée. L'identité est injectable ; "
      + "l'emblème n'est imprimé que si la société en possède un.",
  },
  optimivv_nettoyage: {
    id: "optimivv_nettoyage",
    libelle: "OPTIMIVV nettoyage (design fourni)",
    moteur: "pdf-lib",
    identite: "voie0",
    secteurs: ["nettoyage", "nettoyage_difficile", "urgence", "diogene"],
    note:
      "Design PDF fourni par le client. Pour une autre société, le gabarit "
      + "NEUTRALISÉ est employé et l'identité redessinée — sans quoi la "
      + "dénomination et le SIRET d'OPTIMIVV resteraient dans la couche texte.",
  },
};

/**
 * Secteurs rendus par le thème « logistique » de `cgk_standard`.
 *
 * ⚠️ Cette liste DOIT rester identique à `LOGISTIQUE` dans
 * `lib/pdf/DocumentPdf.tsx` : c'est elle qui décide du thème aujourd'hui, et
 * les deux divergeraient en silence. Un contrôle le vérifie
 * (`scripts/devis-redaction-check/gabarits.ts`).
 */
export const SECTEURS_LOGISTIQUE: Sector[] = [
  "demenagement",
  "diogene",
  "debarras",
  "transport",
];

/**
 * Gabarit employé quand aucun réglage ne dit autre chose.
 *
 * C'est la reproduction fidèle du comportement en place : `DocumentPdf`
 * aiguille vers `DevisNettoyagePdf` pour un devis hors secteur logistique.
 */
export function gabaritParDefaut(secteur: Sector, type: "devis" | "facture"): GabaritId {
  if (type !== "devis") return "cgk_standard";
  return SECTEURS_LOGISTIQUE.includes(secteur) ? "cgk_standard" : "cgk_nettoyage";
}

/** Réglage brut, tel qu'il est stocké en `app_settings`. */
export type ReglageGabarits = Record<string, string>;

export type ResolutionGabarit = {
  gabarit: GabaritId;
  /** D'où vient la décision — pour l'afficher et pour la journaliser. */
  origine: "réglage société et activité" | "réglage activité" | "réglage société" | "réglage global" | "défaut";
  /** Clé du réglage retenue, vide si c'est le défaut. */
  cle: string;
  /** Valeur de réglage ignorée parce qu'inconnue, pour la signaler. */
  valeurIgnoree?: string;
};

const estGabarit = (v: unknown): v is GabaritId =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(GABARITS, v);

/**
 * Résout le gabarit d'un document.
 *
 * Ordre de spécificité, du plus précis au plus général :
 *   `<entité>|<secteur>` → `*|<secteur>` → `<entité>|*` → `*|*` → défaut.
 *
 * Une valeur de réglage inconnue n'est PAS une erreur fatale : elle est
 * ignorée et SIGNALÉE, et la résolution continue. `app_settings` n'a aucun
 * schéma et une ligne peut avoir été écrite à la main — un gabarit mal
 * orthographié ne doit pas empêcher d'émettre un devis.
 */
export function resoudreGabarit(args: {
  entityId: string | null;
  secteur: Sector;
  type: "devis" | "facture";
  reglages?: ReglageGabarits | null;
}): ResolutionGabarit {
  const r = args.reglages ?? {};
  const e = args.entityId ?? "";
  const candidats: { cle: string; origine: ResolutionGabarit["origine"] }[] = [
    ...(e ? [{ cle: `${e}|${args.secteur}`, origine: "réglage société et activité" as const }] : []),
    { cle: `*|${args.secteur}`, origine: "réglage activité" as const },
    ...(e ? [{ cle: `${e}|*`, origine: "réglage société" as const }] : []),
    { cle: "*|*", origine: "réglage global" as const },
  ];

  let ignoree: string | undefined;
  for (const c of candidats) {
    const v = r[c.cle];
    if (v === undefined) continue;
    if (!estGabarit(v)) {
      if (ignoree === undefined) ignoree = `${c.cle} = « ${String(v)} »`;
      continue;
    }
    return { gabarit: v, origine: c.origine, cle: c.cle, valeurIgnoree: ignoree };
  }

  return {
    gabarit: gabaritParDefaut(args.secteur, args.type),
    origine: "défaut",
    cle: "",
    valeurIgnoree: ignoree,
  };
}

/**
 * Le gabarit retenu convient-il au secteur ?
 *
 * On ne REFUSE pas : un administrateur peut vouloir le rendu générique
 * partout, et `secteurs` décrit une intention, pas une contrainte technique.
 * On renvoie de quoi l'afficher.
 */
export function gabaritConvientAuSecteur(id: GabaritId, secteur: Sector): boolean {
  const g = GABARITS[id];
  return g.secteurs.length === 0 || g.secteurs.includes(secteur);
}
