// Montants d'un contrat de sous-traitance — PUR, aucune I/O.
//
// ⚠️ Ce sont les prix convenus avec le SOUS-TRAITANT. Ils n'ont aucun rapport
// avec ceux facturés au client et ne doivent jamais être rapprochés d'eux :
// aucune fonction de ce fichier ne lit un prix client, et aucune ne calcule
// une marge (§17). Le devis client ne sert qu'à savoir QUELLES prestations
// ont été vendues, jamais à quel prix.

import { prestationParCode, type Unite } from "./prestations";

/** Deux modes au choix de la planificatrice (§17). */
export type ModePrix = "forfait" | "detaille";

export const MODE_PRIX_LABEL: Record<ModePrix, string> = {
  forfait: "Prix forfaitaire global",
  detaille: "Prix détaillé par prestation",
};

export type LignePrestation = {
  /** Code de la bibliothèque, ou null pour une ligne libre à vérifier. */
  code: string | null;
  /** Libellé affiché : celui de la bibliothèque, ou la saisie libre. */
  label: string;
  descriptif?: string | null;
  quantite: number | null;
  unite: Unite;
  /** Prix unitaire HT convenu avec le sous-traitant. */
  prixUnitaireHt: number | null;
  fournituresIncluses: boolean;
  materielInclus: boolean;
  observations?: string | null;
  /**
   * Reprise du devis client mais sans correspondance dans la bibliothèque :
   * à vérifier par la planificatrice, jamais supprimée automatiquement (§16).
   */
  aVerifier?: boolean;
};

/** Frais annexes, hors prestations (déplacement, péages, stationnement…). */
export type LigneFrais = {
  label: string;
  montantHt: number | null;
  observations?: string | null;
};

export type SaisieMontants = {
  mode: ModePrix;
  /** Renseigné en mode forfait uniquement. */
  forfaitHt: number | null;
  lignes: LignePrestation[];
  frais: LigneFrais[];
  /** Taux de TVA en %, ou null si non déterminé. */
  tauxTva: number | null;
};

export type Totaux = {
  prestationsHt: number;
  fraisHt: number;
  totalHt: number;
  tva: number | null;
  totalTtc: number | null;
  /** Lignes dont le montant ne peut pas être calculé, et pourquoi. */
  incomplets: string[];
};

const nb = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** Arrondi au centime, en évitant le dérapage de la virgule flottante. */
const cents = (n: number): number => Math.round(n * 100) / 100;

/**
 * Montant d'une ligne.
 *
 * Un forfait vaut son prix unitaire, sans quantité : exiger « 1 » serait une
 * saisie de plus pour rien. Les autres unités multiplient, et une quantité
 * manquante est SIGNALÉE au lieu d'être supposée égale à 1 — un contrat
 * chiffré sur une quantité devinée n'est pas un contrat.
 */
export function montantLigne(l: LignePrestation): { ht: number; manque: string | null } {
  const pu = nb(l.prixUnitaireHt);
  if (pu <= 0) return { ht: 0, manque: `${l.label} : prix non renseigné` };
  if (l.unite === "forfait") return { ht: cents(pu), manque: null };
  const q = nb(l.quantite);
  if (q <= 0) return { ht: 0, manque: `${l.label} : quantité non renseignée` };
  return { ht: cents(pu * q), manque: null };
}

export function calculerTotaux(s: SaisieMontants): Totaux {
  const incomplets: string[] = [];
  let prestationsHt = 0;

  if (s.mode === "forfait") {
    const f = nb(s.forfaitHt);
    if (f <= 0) incomplets.push("Forfait global non renseigné");
    prestationsHt = cents(f);
  } else {
    for (const l of s.lignes) {
      const { ht, manque } = montantLigne(l);
      if (manque) incomplets.push(manque);
      prestationsHt = cents(prestationsHt + ht);
    }
  }

  let fraisHt = 0;
  for (const f of s.frais) {
    const m = nb(f.montantHt);
    if (m <= 0) incomplets.push(`${f.label} : montant non renseigné`);
    fraisHt = cents(fraisHt + m);
  }

  const totalHt = cents(prestationsHt + fraisHt);
  // Pas de taux par défaut : un taux supposé fausserait la facture du
  // sous-traitant. Null signifie « à déterminer », et l'interface le dit.
  const tva = s.tauxTva != null && Number.isFinite(s.tauxTva)
    ? cents((totalHt * s.tauxTva) / 100)
    : null;

  return {
    prestationsHt, fraisHt, totalHt,
    tva,
    totalTtc: tva == null ? null : cents(totalHt + tva),
    incomplets,
  };
}

/** Le contrat est-il chiffrable en l'état ? */
export function montantsComplets(s: SaisieMontants): boolean {
  return calculerTotaux(s).incomplets.length === 0;
}

/**
 * Prépare les lignes à partir d'une sélection de prestations.
 *
 * Les prix restent VIDES : ils se négocient avec le sous-traitant, le CRM
 * n'en propose aucun. L'unité et la charge des fournitures viennent de la
 * bibliothèque, à titre de valeur de départ modifiable.
 */
export function lignesDepuisCodes(codes: readonly string[]): LignePrestation[] {
  const out: LignePrestation[] = [];
  for (const c of codes) {
    const p = prestationParCode(c);
    if (!p) continue;
    out.push({
      code: p.code,
      label: p.label,
      descriptif: p.descriptif,
      quantite: null,
      unite: p.uniteDefaut,
      prixUnitaireHt: null,
      fournituresIncluses: p.fournituresParDefaut,
      materielInclus: true,
      observations: null,
    });
  }
  return out;
}

export function saisieVide(mode: ModePrix = "detaille"): SaisieMontants {
  return { mode, forfaitHt: null, lignes: [], frais: [], tauxTva: null };
}
