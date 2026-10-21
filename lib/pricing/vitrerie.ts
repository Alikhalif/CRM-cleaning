// Supplément VITRERIE — PUR, aucune I/O, partagé serveur et client.
//
// Cahier des charges client du 2026-10-21. Le principe y est explicite et
// commande toute la conception de ce module :
//
//   Prix estimatif total = Prix du nettoyage (inchangé) + Supplément vitrerie
//
// Le supplément se calcule SÉPARÉMENT, après le barème de nettoyage, et ne
// retouche jamais son résultat. C'est pourquoi il vit dans son propre fichier
// et s'applique en dernier, sur le prix déjà obtenu : il est impossible qu'une
// erreur ici déplace un tarif de nettoyage.

import type { Grid, GridLine } from "./grid-types";

export type FacesVitres = "interieur" | "exterieur" | "les_deux";
export type Encadrement = "pvc" | "bois" | "alu" | "mixte" | "nr";
export type AccesVitres = "classique" | "difficile";

/** Ce que le commercial a saisi dans la découverte. */
export type SaisieVitrerie = {
  fenetres: number;
  baies: number;
  velux: number;
  /** Véranda : surface vitrée approximative, en m². */
  verandaM2: number;
  /** Autres surfaces vitrées : quantité ou surface approximative. */
  autres: number;
  faces: FacesVitres | null;
  encadrement: Encadrement | null;
  acces: AccesVitres | null;
  /** Nacelle, échafaudage… : signalé, jamais chiffré automatiquement. */
  equipementSpecifique: boolean;
};

export type Palier = { cle: string; de: number; a: number; pctMin: number; pctMax: number };

export type ParamsVitrerie = {
  poids: { fenetre: number; baie: number; velux: number; verandaParM2: number; autre: number };
  faces: Record<FacesVitres, number>;
  encadrement: Record<Encadrement, number>;
  acces: Record<AccesVitres, number>;
  paliers: Palier[];
  /** Plancher du supplément, en euros. 0 = aucun (le client n'en a pas fixé). */
  supplementMin: number;
};

// Valeurs du cahier des charges, reprises telles quelles. Elles ne sont PAS
// inventées : §4, §5, §6, §8 et §10 les donnent une par une. Le Super Admin
// peut toutes les modifier depuis le module Grilles tarifaires ; celles-ci ne
// servent que de repli quand une grille n'a pas encore sa section vitrerie.
export const PARAMS_VITRERIE_DEFAUT: ParamsVitrerie = {
  // §8 — charge de travail relative d'un vitrage.
  poids: { fenetre: 1, baie: 2.5, velux: 2, verandaParM2: 0.5, autre: 1 },
  // §4 — faces à nettoyer.
  faces: { interieur: 1.0, exterieur: 1.1, les_deux: 1.8 },
  // §5 — matériau des encadrements.
  encadrement: { pvc: 1.0, bois: 1.1, alu: 1.0, mixte: 1.05, nr: 1.0 },
  // §6 — accessibilité.
  acces: { classique: 1.0, difficile: 1.15 },
  // §10 — barème progressif, six niveaux.
  paliers: [
    { cle: "vit_palier_1", de: 1, a: 2, pctMin: 3, pctMax: 7 },
    { cle: "vit_palier_2", de: 2, a: 5, pctMin: 8, pctMax: 12 },
    { cle: "vit_palier_3", de: 5, a: 10, pctMin: 13, pctMax: 20 },
    { cle: "vit_palier_4", de: 10, a: 20, pctMin: 20, pctMax: 30 },
    { cle: "vit_palier_5", de: 20, a: 30, pctMin: 30, pctMax: 35 },
    // Dernier palier BORNÉ volontairement : au-delà, le barème publié ne dit
    // plus rien, et le cahier demande une validation tarifaire plutôt qu'une
    // extrapolation. Voir `validationRequise`.
    { cle: "vit_palier_6", de: 30, a: 50, pctMin: 35, pctMax: 40 },
  ],
  supplementMin: 0,
};

export type ResultatVitrerie = {
  /** Unités brutes, avant coefficients. */
  unites: number;
  unitesPonderees: number;
  coefFaces: number;
  coefEncadrement: number;
  coefAcces: number;
  /** Majoration retenue, en % du prix de nettoyage. */
  pct: number;
  /** Supplément en euros, appliqué au prix conseillé. */
  supplement: number;
  /** Le barème ne couvre plus ce volume, ou un équipement spécifique est requis. */
  validationRequise: boolean;
  /** Motifs de la validation, à afficher tels quels. */
  alertes: string[];
  /** Détail des vitrages retenus, pour l'argumentaire. */
  detail: { libelle: string; quantite: number; unites: number }[];
};

const nb = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Unités de vitrerie, avant tout coefficient (§8). */
export function unitesVitrerie(s: SaisieVitrerie, p: ParamsVitrerie): ResultatVitrerie["detail"] {
  const out: ResultatVitrerie["detail"] = [];
  const ajouter = (libelle: string, quantite: number, poids: number) => {
    if (quantite > 0) out.push({ libelle, quantite, unites: quantite * poids });
  };
  ajouter("Fenêtres classiques", nb(s.fenetres), p.poids.fenetre);
  ajouter("Baies vitrées", nb(s.baies), p.poids.baie);
  ajouter("Velux / fenêtres de toit", nb(s.velux), p.poids.velux);
  // Véranda : une unité par tranche de 2 m², soit 0,5 unité au m².
  ajouter("Véranda (m² vitrés)", nb(s.verandaM2), p.poids.verandaParM2);
  ajouter("Autres surfaces vitrées", nb(s.autres), p.poids.autre);
  return out;
}

/**
 * Majoration en %, interpolée À L'INTÉRIEUR du palier atteint (§10).
 *
 * L'interpolation est ce qui évite les sauts : à 10,8 unités pondérées on
 * obtient 20,8 % et non le plafond du palier. En deçà du premier seuil on
 * retient son plancher ; au-delà du dernier, son plafond — et le dépassement
 * est signalé par `validationRequise` plutôt qu'extrapolé.
 */
export function pourcentagePalier(u: number, paliers: Palier[]): number {
  if (u <= 0 || paliers.length === 0) return 0;
  const tries = [...paliers].sort((a, b) => a.de - b.de);
  if (u < tries[0].de) return tries[0].pctMin;
  for (const pal of tries) {
    if (u > pal.a) continue;
    const largeur = pal.a - pal.de;
    if (largeur <= 0) return pal.pctMax;
    const t = Math.min(1, Math.max(0, (u - pal.de) / largeur));
    return pal.pctMin + t * (pal.pctMax - pal.pctMin);
  }
  return tries[tries.length - 1].pctMax;
}

/** La saisie décrit-elle au moins un vitrage ? */
export function vitrerieRenseignee(s: SaisieVitrerie): boolean {
  return nb(s.fenetres) + nb(s.baies) + nb(s.velux) + nb(s.verandaM2) + nb(s.autres) > 0;
}

/**
 * Supplément vitrerie pour un prix de nettoyage donné.
 *
 * `null` = rien à ajouter : aucun vitrage saisi. Le prix du nettoyage reste
 * alors strictement celui calculé par le barème, au centime près.
 */
export function calculerVitrerie(
  prixNettoyage: number,
  s: SaisieVitrerie,
  p: ParamsVitrerie = PARAMS_VITRERIE_DEFAUT,
): ResultatVitrerie | null {
  const detail = unitesVitrerie(s, p);
  if (detail.length === 0) return null;

  const unites = detail.reduce((n, d) => n + d.unites, 0);
  // Les coefficients multiplient les UNITÉS, jamais le pourcentage obtenu
  // ensuite (§9) — sans quoi ils s'appliqueraient deux fois.
  const coefFaces = p.faces[s.faces ?? "interieur"] ?? 1;
  const coefEncadrement = p.encadrement[s.encadrement ?? "nr"] ?? 1;
  const coefAcces = p.acces[s.acces ?? "classique"] ?? 1;
  const unitesPonderees = unites * coefFaces * coefEncadrement * coefAcces;

  const pct = pourcentagePalier(unitesPonderees, p.paliers);

  const alertes: string[] = [];
  const dernier = [...p.paliers].sort((a, b) => a.de - b.de)[p.paliers.length - 1];
  const horsBareme = dernier != null && unitesPonderees > dernier.a;
  if (horsBareme) {
    alertes.push(
      `Vitrerie exceptionnelle (${Math.round(unitesPonderees)} unités pondérées) : validation tarifaire nécessaire.`,
    );
  }
  if (s.equipementSpecifique) {
    // §6 : signalé, jamais chiffré. Une nacelle ne se devine pas.
    alertes.push("Accès spécifique : validation technique et tarifaire nécessaire.");
  }

  let supplement = Math.round((prixNettoyage * pct) / 100);
  if (p.supplementMin > 0 && supplement < p.supplementMin) supplement = p.supplementMin;

  return {
    unites,
    unitesPonderees,
    coefFaces,
    coefEncadrement,
    coefAcces,
    pct,
    supplement,
    validationRequise: horsBareme || s.equipementSpecifique,
    alertes,
    detail,
  };
}

// ── Lecture des paramètres depuis la grille tarifaire (§12) ────────────
//
// Le Super Admin règle tout depuis la section « Vitrerie » de la grille. Une
// grille qui n'a pas encore cette section garde les valeurs du cahier : aucun
// barème existant n'est modifié du seul fait de cette fonctionnalité.

const coefDe = (lignes: GridLine[], cle: string, defaut: number): number => {
  const l = lignes.find((x) => x.key === cle);
  const v = l?.coef ?? l?.ratio;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : defaut;
};

export function paramsVitrerieDepuis(grid: Grid | null | undefined): ParamsVitrerie {
  const lignes = grid?.vitrerie ?? [];
  if (lignes.length === 0) return PARAMS_VITRERIE_DEFAUT;
  const d = PARAMS_VITRERIE_DEFAUT;

  const paliers = d.paliers.map((pal) => {
    const l = lignes.find((x) => x.key === pal.cle);
    if (!l) return pal;
    return {
      cle: pal.cle,
      de: typeof l.from === "number" ? l.from : pal.de,
      a: typeof l.to === "number" ? l.to : pal.a,
      pctMin: typeof l.minPct === "number" ? l.minPct : pal.pctMin,
      pctMax: typeof l.maxPct === "number" ? l.maxPct : pal.pctMax,
    };
  });

  const minimum = lignes.find((x) => x.key === "vit_minimum");

  return {
    poids: {
      fenetre: coefDe(lignes, "vit_poids_fenetre", d.poids.fenetre),
      baie: coefDe(lignes, "vit_poids_baie", d.poids.baie),
      velux: coefDe(lignes, "vit_poids_velux", d.poids.velux),
      verandaParM2: coefDe(lignes, "vit_poids_veranda", d.poids.verandaParM2),
      autre: coefDe(lignes, "vit_poids_autre", d.poids.autre),
    },
    faces: {
      interieur: coefDe(lignes, "vit_faces_interieur", d.faces.interieur),
      exterieur: coefDe(lignes, "vit_faces_exterieur", d.faces.exterieur),
      les_deux: coefDe(lignes, "vit_faces_deux", d.faces.les_deux),
    },
    encadrement: {
      pvc: coefDe(lignes, "vit_cadre_pvc", d.encadrement.pvc),
      bois: coefDe(lignes, "vit_cadre_bois", d.encadrement.bois),
      alu: coefDe(lignes, "vit_cadre_alu", d.encadrement.alu),
      mixte: coefDe(lignes, "vit_cadre_mixte", d.encadrement.mixte),
      nr: coefDe(lignes, "vit_cadre_nr", d.encadrement.nr),
    },
    acces: {
      classique: coefDe(lignes, "vit_acces_classique", d.acces.classique),
      difficile: coefDe(lignes, "vit_acces_difficile", d.acces.difficile),
    },
    paliers,
    supplementMin: typeof minimum?.forfaitMin === "number" ? minimum.forfaitMin : d.supplementMin,
  };
}

// ── Libellés ───────────────────────────────────────────────────────────

export const FACES_LABEL: Record<FacesVitres, string> = {
  interieur: "Intérieur uniquement",
  exterieur: "Extérieur uniquement",
  les_deux: "Intérieur + Extérieur",
};

export const ENCADREMENT_LABEL: Record<Encadrement, string> = {
  pvc: "PVC",
  bois: "Bois",
  alu: "Aluminium",
  mixte: "Mixte",
  nr: "Non renseigné",
};

export const ACCES_LABEL: Record<AccesVitres, string> = {
  classique: "Accès classique",
  difficile: "Accès difficile / en hauteur",
};
