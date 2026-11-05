// Pont entre la découverte enregistrée et le moteur de rédaction du devis.
//
// POURQUOI UN MODULE À PART. `devis-contenu.ts` est pur et ne connaît pas le
// type `Lead` ; le serveur, lui, ne doit pas réimplémenter la correspondance
// des champs à chaque appel. Ce fichier est le seul endroit où les deux se
// rencontrent — et il reste pur, donc il se teste sans base de données.
//
// C'est la pièce qui manquait : le moteur existait depuis le 31 octobre sans
// aucun appelant.

import {
  activiteCouverte,
  genererContenuDevis,
  verifierRedaction,
  type ContenuDevis,
  type Decouverte,
} from "./devis-contenu";

/**
 * Ce que le pont attend d'un lead.
 *
 * Volontairement STRUCTURAL plutôt que `Lead` : le type complet traîne une
 * centaine de champs et une dépendance vers `lib/leads`, dont rien ici n'a
 * besoin. Un objet de test tient en cinq lignes.
 */
export type LeadPourGeneration = {
  sector: string;
  surfaceM2?: number | null;
  etatSalete?: string | null;
  discoveryDetails?: Record<string, unknown> | null;
  discoveryDoneAt?: string | null;
  /**
   * « Contexte de l'intervention » (`leads.contexte_intervention`).
   *
   * Ce champ ne vit PAS dans `discovery_details` mais en colonne propre du
   * lead : il faut donc le transmettre explicitement, sans quoi tout ce que le
   * commercial écrit en texte libre est perdu à la génération.
   */
  contexteIntervention?: string | null;
};

const texte = (d: Record<string, unknown>, k: string): string | null => {
  const v = d[k];
  return typeof v === "string" && v.trim() ? v : null;
};

/** Correspondance découverte → entrée du moteur. Aucune valeur inventée. */
export function decouverteDepuisLead(l: LeadPourGeneration): Decouverte {
  const details = l.discoveryDetails ?? {};
  return {
    sector: l.sector,
    surfaceM2: l.surfaceM2 ?? null,
    etatSalete: l.etatSalete ?? null,
    details,
    // Villes de trajet : utiles à la désignation d'un déménagement ou d'un
    // transport, ignorées par les autres gabarits.
    villeDepart: texte(details, "villeDepart"),
    villeArrivee: texte(details, "villeArrivee"),
    contexteIntervention: l.contexteIntervention ?? null,
  };
}

export type MotifRefus = "decouverte_absente" | "activite_hors_perimetre";

export type ResultatGeneration =
  | { ok: true; contenu: ContenuDevis; alertes: string[] }
  | { ok: false; motif: MotifRefus };

/**
 * Contenu de devis à partir d'un lead dont la découverte est enregistrée.
 *
 * Deux refus possibles, tous deux explicites — on ne produit jamais un texte
 * approximatif pour avoir quelque chose à afficher.
 */
export function genererDepuisLead(l: LeadPourGeneration): ResultatGeneration {
  if (!l.discoveryDoneAt) return { ok: false, motif: "decouverte_absente" };
  if (!activiteCouverte(l.sector)) return { ok: false, motif: "activite_hors_perimetre" };
  const contenu = genererContenuDevis(decouverteDepuisLead(l));
  // Le moteur renvoie null sur une activité hors périmètre ; la garde
  // ci-dessus l'a déjà écartée, celle-ci est un filet.
  if (!contenu) return { ok: false, motif: "activite_hors_perimetre" };
  return { ok: true, contenu, alertes: verifierRedaction(contenu).alertes };
}

/** Message montré au commercial quand la génération est refusée. */
export const MOTIF_LABEL: Record<MotifRefus, string> = {
  decouverte_absente:
    "Enregistrez d'abord la découverte : le devis se rédige à partir d'elle.",
  activite_hors_perimetre:
    "La rédaction automatique couvre le nettoyage, le débarras, le déménagement "
    + "et le transport. Pour cette activité, rédigez le devis à la main.",
};

/**
 * Notes du document : le DÉTAIL puis les RÉSERVES, avec leurs intitulés.
 *
 * Le modèle de devis générique n'a qu'un champ libre (`documents.notes`),
 * rendu tel quel dans le PDF. Les intitulés sont donc portés par le texte
 * lui-même — c'est ce qui permet de faire figurer les trois blocs sans
 * toucher à la mise en page du PDF. La DÉSIGNATION, elle, devient le libellé
 * de la ligne de prestation.
 */
export function notesDevis(c: ContenuDevis): string {
  const blocs: string[] = [];
  if (c.detail.trim()) blocs.push(`DÉTAIL DE LA PRESTATION\n\n${c.detail.trim()}`);
  if (c.reserves.trim()) blocs.push(`RÉSERVES\n\n${c.reserves.trim()}`);
  return blocs.join("\n\n");
}
