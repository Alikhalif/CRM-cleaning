// Reprise des prestations du devis client accepté — PUR, aucune I/O.
//
// Le devis client dit CE QUI A ÉTÉ VENDU. Il ne dit rien des prix du
// sous-traitant, et ce module n'en lit aucun : seuls les libellés des lignes
// sont examinés (§16, §17).
//
// Une ligne qui ne correspond à rien n'est JAMAIS écartée en silence : elle
// ressort dans `aVerifier`, et l'interface la présente à la planificatrice.
// Une correspondance ratée est visible ; une ligne disparue ne l'est pas.

import { PRESTATIONS, prestationParCode } from "./prestations";

/** Normalise un libellé pour la comparaison : sans accent, sans ponctuation. */
function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mots-clés qui identifient une prestation dans un libellé de devis.
 *
 * Chaque entrée est une LISTE de termes qui doivent TOUS apparaître. C'est ce
 * qui distingue « nettoyage après travaux » de « nettoyage après
 * déménagement » : le mot « nettoyage » seul ne tranche pas.
 */
const INDICES: { code: string; termes: string[][] }[] = [
  // Nettoyage — du plus spécifique au plus général, l'ordre compte.
  { code: "net_hotte", termes: [["hotte"]] },
  { code: "net_decontamination", termes: [["decontamination"]] },
  { code: "net_desodorisation", termes: [["desodorisation"]] },
  { code: "net_desinfection", termes: [["desinfection"]] },
  { code: "net_vitres", termes: [["vitre"], ["vitrerie"]] },
  { code: "net_murs", termes: [["lessivage"], ["mur", "lessiv"]] },
  { code: "net_plafonds", termes: [["plafond", "nettoyage"]] },
  { code: "net_diogene", termes: [["diogene"]] },
  { code: "net_insalubre", termes: [["insalubre", "nettoyage"]] },
  { code: "net_apres_sinistre", termes: [["sinistre"], ["incendie"], ["degat", "eaux"]] },
  { code: "net_apres_travaux", termes: [["apres", "travaux"], ["fin", "chantier"]] },
  { code: "net_apres_demenagement", termes: [["apres", "demenagement"], ["fin", "bail"]] },
  { code: "net_approfondi", termes: [["approfondi"], ["remise", "etat"]] },
  { code: "net_courant", termes: [["nettoyage", "courant"], ["entretien"]] },

  // Débarras
  { code: "deb_insalubre", termes: [["debarras", "insalubre"]] },
  { code: "deb_cave", termes: [["cave"]] },
  { code: "deb_grenier", termes: [["grenier"], ["comble"]] },
  { code: "deb_garage", termes: [["garage"], ["box"]] },
  { code: "deb_encombrants", termes: [["encombrant"]] },
  { code: "deb_mobilier", termes: [["evacuation", "mobilier"]] },
  { code: "deb_tri_dechets", termes: [["tri", "dechet"], ["evacuation", "dechet"]] },
  { code: "deb_partiel", termes: [["debarras", "partiel"]] },
  { code: "deb_complet", termes: [["debarras"]] },

  // Compléments
  { code: "cpl_wc", termes: [["wc"], ["toilette"]] },
  { code: "cpl_plomberie", termes: [["plomberie"]] },
  { code: "cpl_peinture_plafonds", termes: [["peinture", "plafond"]] },
  { code: "cpl_peinture_murs", termes: [["peinture"]] },
  { code: "cpl_rebouchage", termes: [["rebouchage"]] },
  { code: "cpl_portes", termes: [["porte", "reparation"]] },
  { code: "cpl_placards", termes: [["placard"]] },
  { code: "cpl_menuiserie", termes: [["menuiserie"]] },
  { code: "cpl_renovation", termes: [["renovation"], ["second", "oeuvre"]] },
  { code: "cpl_reparations", termes: [["reparation"]] },

  // Transport
  { code: "tr_international", termes: [["international"]] },
  { code: "tr_longue_distance", termes: [["longue", "distance"]] },
  { code: "tr_remontage", termes: [["remontage"]] },
  { code: "tr_demontage", termes: [["demontage"]] },
  { code: "tr_protection", termes: [["protection", "meuble"], ["emballage"]] },
  { code: "tr_portage", termes: [["portage"]] },
  { code: "tr_manutention", termes: [["manutention"]] },
  { code: "tr_dechargement", termes: [["dechargement"]] },
  { code: "tr_chargement", termes: [["chargement"]] },
  { code: "tr_livraison", termes: [["livraison"]] },
  { code: "tr_objets", termes: [["transport", "objet"]] },
  { code: "tr_mobilier", termes: [["transport", "mobilier"]] },
  { code: "tr_demenagement_partiel", termes: [["demenagement", "partiel"]] },
  { code: "tr_demenagement_complet", termes: [["demenagement"]] },
];

export type LigneDevis = {
  /** Libellé de la ligne du devis, tel qu'il y figure. */
  label: string;
  /** Quantité du devis, reprise à titre indicatif. */
  quantite?: number | null;
};

export type Reprise = {
  /** Codes de la bibliothèque reconnus, dédoublonnés, dans l'ordre du devis. */
  codes: string[];
  /** Correspondances établies, pour que la planificatrice puisse les contrôler. */
  correspondances: { label: string; code: string; prestation: string }[];
  /** Lignes sans correspondance — à vérifier, jamais supprimées (§16). */
  aVerifier: LigneDevis[];
};

/**
 * Traduit les lignes d'un devis en prestations de la bibliothèque.
 *
 * On ne retient qu'UNE correspondance par ligne, la première de la liste
 * d'indices — classée du plus spécifique au plus général. Sans cet ordre,
 * « nettoyage après travaux » tomberait sur « nettoyage courant ».
 */
export function reprendreDevis(lignes: readonly LigneDevis[]): Reprise {
  const codes: string[] = [];
  const correspondances: Reprise["correspondances"] = [];
  const aVerifier: LigneDevis[] = [];
  const vus = new Set<string>();

  for (const l of lignes) {
    const n = normaliser(l.label ?? "");
    if (!n) { aVerifier.push(l); continue; }

    const trouve = INDICES.find((i) =>
      i.termes.some((groupe) => groupe.every((t) => n.includes(t))),
    );

    if (!trouve) { aVerifier.push(l); continue; }
    const p = prestationParCode(trouve.code);
    if (!p) { aVerifier.push(l); continue; }

    correspondances.push({ label: l.label, code: p.code, prestation: p.label });
    if (!vus.has(p.code)) { vus.add(p.code); codes.push(p.code); }
  }

  return { codes, correspondances, aVerifier };
}

/** Toutes les prestations de la bibliothèque sont-elles atteignables ? */
export function codesIndexes(): string[] {
  return [...new Set(INDICES.map((i) => i.code))];
}

/** Prestations de la bibliothèque qu'aucun indice ne peut reconnaître. */
export function codesSansIndice(): string[] {
  const indexes = new Set(codesIndexes());
  return PRESTATIONS.map((p) => p.code).filter((c) => !indexes.has(c));
}
