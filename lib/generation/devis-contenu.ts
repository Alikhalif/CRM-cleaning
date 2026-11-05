// Contenu de devis à partir de la découverte — PUR, aucune I/O.
//
// ── LES TROIS NIVEAUX DU §14 ──────────────────────────────────────────
//
//   NIVEAU A — DÉCOUVERTE      `Decouverte` : les données brutes saisies.
//   NIVEAU B — ANALYSE MÉTIER  `analyser()` : quelles prestations sont
//                              validées, quelles contraintes, quelles
//                              exclusions, quel niveau de développement,
//                              qu'est-ce qui manque.
//   NIVEAU C — RÉDACTION       `rediger()`  : titre, introduction, sections
//                              numérotées, réserves.
//
// Le §14 l'exige explicitement : « les champs de découverte ne doivent pas
// être directement transformés en lignes de devis, ils doivent passer par une
// étape d'analyse métier ». La séparation est donc structurelle, pas
// cosmétique — et chaque niveau se teste séparément.
//
// ── GÉNÉRATION DÉTERMINISTE, pas un appel à une IA ────────────────────
//
// Le CRM n'a aucun modèle de langage configuré, et pour ce travail c'est un
// avantage : les 28 interdictions du §19 sont absolues. Un référentiel fini de
// formulations (bibliotheque-redaction.ts) les respecte par construction et se
// teste. Le jour où vous voudrez une rédaction plus libre, ce module restera
// la source des FAITS à lui transmettre.
//
// ── PÉRIMÈTRE ─────────────────────────────────────────────────────────
//
// Nettoyage (y compris difficile et Diogène), débarras, déménagement,
// transport. Le dépannage et les travaux du bâtiment sont exclus :
// `genererContenuDevis` renvoie null pour eux.

import { labelOf } from "@/lib/discovery-metier";
import {
  DEBARRAS_VOLUME, DIO_ACCESSIBILITE, DIO_DECHETS, DIO_ENCOMBREMENT,
  DIO_NUISIBLES, DIO_ODEURS, DIO_VOLUME, EQUIPEMENTS, ETAGE, ETAT_GENERAL,
  EXTERIEUR_TYPE, MURS, OCCUPATION, PLAFONDS_TYPE, SOLS, STATIONNEMENT,
  SURFACE_CONCERNEE, TRAITEMENTS_SOL, TYPE_BIEN_NETTOYAGE, VITRERIE_FACES,
  descriptifVitrerie,
} from "@/lib/discovery-nettoyage";
import {
  ACCES, EMBALLAGE, LOGEMENT_TYPE, OBJETS_SPECIFIQUES, OUI_NON, TYPE_BIEN,
  VOLUME_DEMENAGEMENT, TYPE_OBJET, OPTIONS_TRANSPORT,
} from "@/lib/discovery-metier";
import {
  FAMILLES, MENTION_PRODUITS, RESERVES_PAR_FAMILLE, RESERVE_ASSECHEMENT,
  RESERVE_BIENS_CONSERVES, RESERVE_DECHETS_REGLEMENTES, RESERVE_INSALUBRE,
  RESERVE_MURS_EXCLUS, RESERVE_MURS_LAVABLES, RESERVE_NON_SIGNALE,
  RESERVE_NUISIBLES, RESERVE_REEVALUATION, RESERVE_SUPPORTS, RESERVE_VOLUME,
  RESERVE_VITRERIE_EXCLUE, RESERVE_VITRERIE_INACCESSIBLE,
  estComplementaire, familleDe, operationsDe, titreDe,
  type FamilleNettoyage, type Niveau, type SectionRedigee, type Theme,
} from "./bibliotheque-redaction";

export { VERSION_REFERENTIEL } from "./bibliotheque-redaction";
export type { Niveau, SectionRedigee } from "./bibliotheque-redaction";

/** Activités couvertes. Les autres sont hors périmètre. */
export const ACTIVITES_COUVERTES = [
  "nettoyage", "nettoyage_difficile", "diogene",
  "debarras", "demenagement", "transport",
] as const;

export function activiteCouverte(sector: string): boolean {
  return (ACTIVITES_COUVERTES as readonly string[]).includes(sector);
}

export type ContenuDevis = {
  /** Titre en majuscules (§3). Devient le libellé de la ligne de prestation. */
  designation: string;
  /** Introduction professionnelle (§4). */
  introduction: string;
  /** Sections techniques, dans l'ordre de rédaction (§2, §5). */
  sections: SectionRedigee[];
  /** Rendu texte des sections, numérotées — ce qui part dans le PDF. */
  detail: string;
  reserves: string;
  /** Niveau de développement retenu (§10). */
  niveau: Niveau;
  /** Famille métier retenue, pour la traçabilité. */
  famille: string;
  /** Champs de la découverte réellement utilisés — pour que le commercial voie d'où vient le texte. */
  sources: string[];
  /** Informations utiles mais absentes : le texte ne les invente pas. */
  manquant: string[];
};

export type Decouverte = {
  sector: string;
  surfaceM2: number | null;
  /** État général du logement (colonne `etat_salete` du lead). */
  etatSalete: string | null;
  details: Record<string, unknown>;
  villeDepart?: string | null;
  villeArrivee?: string | null;
  /**
   * « Contexte de l'intervention » saisi en découverte.
   *
   * Reporté comme un ÉLÉMENT RELEVÉ, jamais comme une prestation, puisque
   * ce n'en est pas une. Le commercial relit le brouillon avant tout envoi.
   */
  contexteIntervention?: string | null;
};

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU B — RÉSULTAT DE L'ANALYSE MÉTIER
// ══════════════════════════════════════════════════════════════════════

export type Analyse = {
  /** Base du titre, en clair : « Nettoyage approfondi », « Débarras complet ». */
  titreBase: string;
  /** Nature de l'intervention, première phrase de l'introduction. */
  nature: string;
  /** Type de bien en clair, ou null si non saisi. */
  bien: string | null;
  surface: number | null;
  /** Précision de titre propre à l'activité : « de Paris vers Lyon ». */
  precisionTitre: string | null;
  /** Niveau d'encrassement en clair, s'il est saisi. */
  etat: string | null;
  niveau: Niveau;
  /** Thèmes validés, dans l'ordre de rédaction. */
  themes: Theme[];
  /** Précisions issues de la découverte, par thème. Rien n'est perdu. */
  faits: Partial<Record<Theme, string[]>>;
  /** Fragments à ajouter au titre : « vitrerie », « lessivage des murs »… */
  titreComplements: string[];
  /** Faits d'organisation : étage, stationnement, occupation. Pas des prestations. */
  contraintes: string[];
  /** Réserves propres au chantier, en plus du socle. */
  reserves: string[];
  /** La mention « produits » du §11 s'applique-t-elle ? */
  mentionProduits: boolean;
  famille: FamilleNettoyage | null;
  sources: string[];
  manquant: string[];
  contexte: string | null;
};

// ══════════════════════════════════════════════════════════════════════
//  Petits outils de lecture
// ══════════════════════════════════════════════════════════════════════

const str = (d: Record<string, unknown>, k: string): string =>
  typeof d[k] === "string" ? (d[k] as string).trim() : "";
const num = (d: Record<string, unknown>, k: string): number => {
  const n = typeof d[k] === "number" ? d[k] : Number(d[k]);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const liste = (d: Record<string, unknown>, k: string): string[] =>
  Array.isArray(d[k]) ? (d[k] as unknown[]).map(String).filter(Boolean) : [];
const oui = (d: Record<string, unknown>, k: string): boolean => str(d, k) === "oui";
/** Réponse explicitement négative — à distinguer d'une absence de réponse (§9). */
const non = (d: Record<string, unknown>, k: string): boolean => str(d, k) === "non";
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Article élidé correct : « d'un appartement », « d'une maison ». */
function article(bien: string): string {
  return /^(maison|villa|cave|grange|cuisine|chambre|boutique|usine)/i.test(bien)
    ? "d'une"
    : "d'un";
}

/** Énumération française : « a », « a et b », « a, b et c ». */
function enumerer(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU B — ANALYSE : NETTOYAGE
// ══════════════════════════════════════════════════════════════════════

function analyserNettoyage(d: Decouverte): Analyse {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];
  const faits: Partial<Record<Theme, string[]>> = {};
  const reserves: string[] = [];
  const titreComplements: string[] = [];
  const contraintes: string[] = [];
  const note = (k: string) => sources.push(k);
  const fait = (t: Theme, s: string) => { (faits[t] ??= []).push(s); };

  // ── Famille et niveau ────────────────────────────────────────────
  const typeNet = str(det, "typeNettoyage");
  if (typeNet) note("typeNettoyage"); else manquant.push("type de nettoyage");

  const complements = liste(det, "complements");
  if (complements.length) note("complements");

  const origineDecont = str(det, "decontaminationOrigine");
  const origineDesod = str(det, "desodorisationOrigine");
  if (origineDecont) note("decontaminationOrigine");
  if (origineDesod) note("desodorisationOrigine");

  const famille = familleDe({
    sector: d.sector,
    typeNettoyage: typeNet,
    origineDecontamination: origineDecont,
    origineDesodorisation: origineDesod,
  });
  const def = FAMILLES[famille];

  // ── Prestations complémentaires : validées, ou rien (§6.B) ───────
  const avecDesinfection =
    complements.includes("desinfection") || str(det, "desinfectionSurface") !== "";
  const avecDecontamination = complements.includes("decontamination");
  const avecDesodorisation = complements.includes("desodorisation");
  const avecDebarrasInclus = complements.includes("debarras") || str(det, "debarrasVolume") !== "";

  const vitrerieDemandee = oui(det, "vitrerie");
  const vitrerieExclue = non(det, "vitrerie");

  // ⚠️ La liste MURS vaut `non` | `murs_traces` | `murs_lessivage`. Tester
  // `murs_aucun` — une valeur qui n'existe pas — faisait sortir une ligne
  // « - Non. » sur les dossiers où le commercial avait répondu « Non ».
  const murs = str(det, "murs");
  const mursDemande = murs !== "" && murs !== "non";
  const mursExclus = murs === "non";
  const plafondsDemande = oui(det, "plafonds");
  const plafondsExclus = non(det, "plafonds");

  // ── Niveau de développement (§10) ────────────────────────────────
  // Le niveau de la famille est le plancher. Un encrassement extrême, une
  // infestation ou un volume de déchets important le relèvent : le §10
  // interdit « une description superficielle pour une intervention
  // complexe ». Il n'est jamais abaissé.
  let niveau: Niveau = def.niveau;
  const encombrement = str(det, "dioEncombrement");
  const dechets = liste(det, "dioDechets"); // ⚠️ liste à choix MULTIPLES
  const nuisibles = oui(det, "dioNuisibles");
  const dioVolume = str(det, "dioVolume");
  // ⚠️ Les valeurs réelles de `ETAT_GENERAL` sont `leger | moyen | important
  // | tres_important | extreme`. Tester « tres_sale » ou « insalubre » —
  // qui n'existent pas — n'aurait jamais relevé le niveau.
  if (
    encombrement === "dio_enc_important" || encombrement === "dio_enc_extreme"
    || nuisibles || dechets.includes("dio_biologiques")
    || d.etatSalete === "tres_important" || d.etatSalete === "extreme"
  ) {
    niveau = 3;
  } else if (niveau < 2 && (avecDesinfection || avecDecontamination || vitrerieDemandee || mursDemande)) {
    // Un nettoyage courant auquel on ajoute une prestation technique n'est
    // plus une simple intervention d'entretien.
    niveau = 2;
  }

  // ── Bien, surface, état ──────────────────────────────────────────
  const typeBien = str(det, "typeBienNet");
  if (typeBien) note("typeBienNet"); else manquant.push("type de bien");
  const bien = typeBien ? labelOf(TYPE_BIEN_NETTOYAGE, typeBien).toLowerCase() : null;

  const surface = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : null;
  if (surface) note("surface"); else manquant.push("surface");

  // ⚠️ Les libellés de `ETAT_GENERAL` sont faits pour une liste déroulante
  // (« Sale », « Très sale », « Insalubre ») : repris tels quels, ils
  // donnaient « un niveau d'encrassement sale ». Le devis a son propre
  // vocabulaire, qualifiant le NIVEAU et non le logement.
  let etat: string | null = null;
  if (d.etatSalete) {
    note("etatSalete");
    etat = NIVEAU_ENCRASSEMENT[d.etatSalete]
      ?? labelOf(ETAT_GENERAL, d.etatSalete).toLowerCase();
  }

  // ── Faits par thème — AUCUN champ saisi n'est perdu ──────────────

  // Pièces.
  const nbPieces = num(det, "nbPieces");
  if (nbPieces) {
    note("nbPieces");
    fait("interieur", `Intervention portant sur les ${nbPieces} pièces concernées.`);
  }

  // Sols et traitements.
  const sols = liste(det, "sols");
  if (sols.length) {
    note("sols");
    fait("sols_traitements",
      `Revêtements concernés : ${sols.map((s) => labelOf(SOLS, s).toLowerCase()).join(", ")}.`);
  }
  const traitements = liste(det, "traitementsSol");
  if (traitements.length) {
    note("traitementsSol");
    for (const t of traitements) {
      fait("sols_traitements", `${cap(labelOf(TRAITEMENTS_SOL, t))} des sols concernés.`);
    }
  }

  // Cuisine : uniquement si la découverte la mentionne.
  const cuisine = oui(det, "cuisineAmenagee") || oui(det, "cuisineEquipee") || oui(det, "cuisineInterieur");
  if (cuisine) {
    note("cuisine");
    if (oui(det, "cuisineEquipee")) fait("cuisine", "Dégraissage des équipements de cuisine présents.");
    if (oui(det, "cuisineInterieur")) fait("cuisine", "Nettoyage de l'intérieur des meubles et placards de cuisine.");
  }

  // Sanitaires.
  const nbSdb = num(det, "nbSdb");
  const nbWc = num(det, "nbWc");
  if (nbSdb || nbWc) {
    note("sanitaires");
    const parts: string[] = [];
    if (nbSdb) parts.push(`${nbSdb} salle${nbSdb > 1 ? "s" : ""} de bain`);
    if (nbWc) parts.push(`${nbWc} WC`);
    fait("sanitaires", `Équipements concernés : ${parts.join(", ")}.`);
  }

  // Placards et dressings → rattachés aux espaces intérieurs.
  if (oui(det, "dressings") || oui(det, "dressingsInterieur")) {
    note("dressings");
    fait("interieur",
      oui(det, "dressingsInterieur")
        ? "Nettoyage des placards et dressings, intérieur compris."
        : "Nettoyage extérieur des placards et dressings.");
  }

  // Équipements facturés à l'unité.
  const equipements = liste(det, "equipements");
  if (equipements.length) {
    note("equipements");
    fait("equipements",
      `Équipements compris au devis : `
      + `${equipements.map((e) => (labelOf(EQUIPEMENTS, e) || e).toLowerCase()).join(", ")}.`);
  }

  // Extérieurs.
  const exterieurs = liste(det, "exterieurTypes");
  if (exterieurs.length) {
    note("exterieurTypes");
    const m2 = num(det, "exterieurSurfaceM2");
    if (m2) note("exterieurSurfaceM2");
    fait("exterieurs",
      `Espaces concernés : ${exterieurs.map((x) => labelOf(EXTERIEUR_TYPE, x).toLowerCase()).join(", ")}`
      + `${m2 ? ` (${m2} m²)` : ""}.`);
  }

  // Vitrerie — §8. Développée uniquement si validée.
  if (vitrerieDemandee) {
    note("vitrerie");
    titreComplements.push("vitrerie");
    // `descriptifVitrerie()` couvre les sept types de vitrages comptés, les
    // faces, le matériau des encadrements, les rails, les coulisses, le
    // niveau d'accès, le besoin de nacelle et les observations.
    const descriptif = descriptifVitrerie(det);
    if (descriptif) {
      for (const ligne of descriptif.split("\n")) {
        const t = ligne.trim();
        if (t) fait("vitrerie", t);
      }
      for (const k of VITRERIE_CHAMPS) if (str(det, k) || num(det, k)) note(k);
    } else {
      // « Oui » coché sans aucun vitrage chiffré : on reste générique plutôt
      // que d'inventer un décompte (interdiction 7), et on le signale.
      const faces = str(det, "vitrerieFaces");
      if (faces) {
        note("vitrerieFaces");
        fait("vitrerie", `Faces traitées : ${labelOf(VITRERIE_FACES, faces).toLowerCase()}.`);
      }
      manquant.push("détail de la vitrerie (nombre et type de vitrages)");
    }
    reserves.push(RESERVE_VITRERIE_INACCESSIBLE);
  } else if (vitrerieExclue) {
    // §8 : « si la vitrerie est explicitement exclue, ne pas l'intégrer ».
    // Le commercial a répondu « Non » : c'est une exclusion, pas un oubli.
    reserves.push(RESERVE_VITRERIE_EXCLUE);
  }

  // Murs et plafonds — §9.
  if (mursDemande) {
    note("murs");
    const surf = str(det, "mursSurface");
    if (surf) note("mursSurface");
    const libelleSurf = surf ? (labelOf(SURFACE_CONCERNEE, surf) || surf).toLowerCase() : "";
    fait("murs",
      `Périmètre : ${(labelOf(MURS, murs) || murs).toLowerCase()}`
      + `${libelleSurf ? `, surface ${libelleSurf}` : ""}.`);
    reserves.push(RESERVE_MURS_LAVABLES);
    titreComplements.push(plafondsDemande ? "lessivage des murs et plafonds" : "lessivage des murs");
  }
  if (plafondsDemande) {
    note("plafonds");
    const type = str(det, "plafondsType");
    if (type) note("plafondsType");
    const surfPlaf = str(det, "plafondsSurface");
    if (surfPlaf) note("plafondsSurface");
    const libellePlaf = surfPlaf ? (labelOf(SURFACE_CONCERNEE, surfPlaf) || surfPlaf).toLowerCase() : "";
    fait("plafonds",
      `Périmètre : ${type ? labelOf(PLAFONDS_TYPE, type).toLowerCase() : "plafonds concernés"}`
      + `${libellePlaf ? `, surface ${libellePlaf}` : ""}.`);
    if (!mursDemande) titreComplements.push("lessivage des plafonds");
  }
  if (mursExclus && plafondsExclus) {
    reserves.push(RESERVE_MURS_EXCLUS);
  }

  // Débarras compris dans une prestation de nettoyage.
  const volDebarras = str(det, "debarrasVolume");
  if (avecDebarrasInclus) {
    if (volDebarras) {
      note("debarrasVolume");
      fait("debarras_inclus",
        `Volume estimé : ${labelOf(DEBARRAS_VOLUME, volDebarras) || volDebarras}.`);
    }
    reserves.push(RESERVE_VOLUME, RESERVE_BIENS_CONSERVES);
    titreComplements.push("débarras");
  }

  // Désinfection / décontamination / désodorisation.
  if (avecDesinfection) {
    const m2 = num(det, "desinfectionM2");
    if (m2) { note("desinfectionM2"); fait("desinfection", `Surface traitée : ${m2} m².`); }
    const surf = str(det, "desinfectionSurface");
    if (surf) note("desinfectionSurface");
    titreComplements.push("désinfection");
  }
  if (avecDecontamination) {
    if (origineDecont) {
      fait("decontamination", `Origine de la contamination : ${libelleOrigine(origineDecont)}.`);
    }
    titreComplements.push("décontamination");
  }
  if (avecDesodorisation) {
    if (origineDesod) {
      fait("desodorisation", `Origine des odeurs : ${libelleOrigine(origineDesod)}.`);
    }
  }

  // ── Spécificités insalubre / Diogène / sinistre ──────────────────
  const estInsalubre =
    famille === "insalubre" || famille === "diogene" || famille === "apres_squat"
    || famille === "apres_deces" || !!encombrement || dechets.length > 0;

  if (estInsalubre) {
    if (encombrement) {
      note("dioEncombrement");
      fait("debarras_prealable",
        `Niveau d'encombrement constaté : ${labelOf(DIO_ENCOMBREMENT, encombrement).toLowerCase()}.`);
    }
    // ⚠️ CORRECTIF : `dioDechets` est une liste à choix MULTIPLES. Elle était
    // lue comme une chaîne, donc toujours vide : la ligne « Évacuation des
    // déchets » ne sortait JAMAIS, et « nature des déchets » figurait dans
    // les informations manquantes alors que le commercial l'avait renseignée.
    if (dechets.length) {
      note("dioDechets");
      fait("debarras_prealable",
        `Nature des déchets présents : `
        + `${dechets.map((x) => (labelOf(DIO_DECHETS, x) || x).toLowerCase()).join(", ")}.`);
    } else {
      manquant.push("nature des déchets");
    }
    if (dioVolume) {
      note("dioVolume");
      fait("debarras_prealable",
        `Volume à évacuer estimé à ${labelOf(DIO_VOLUME, dioVolume).toLowerCase()}.`);
    } else {
      manquant.push("volume de déchets à évacuer");
    }
    const acc = str(det, "dioAccessibilite");
    if (acc) {
      note("dioAccessibilite");
      contraintes.push(`accessibilité ${(labelOf(DIO_ACCESSIBILITE, acc) || acc).toLowerCase()}`);
    }
    reserves.push(RESERVE_INSALUBRE, RESERVE_DECHETS_REGLEMENTES);
  }

  if (nuisibles) {
    note("dioNuisibles");
    // Les types de nuisibles étaient saisis (`dioNuisiblesTypes`) et ignorés
    // par la rédaction : le §7.16 demande d'« adapter aux nuisibles
    // identifiés ».
    const types = liste(det, "dioNuisiblesTypes");
    if (types.length) {
      note("dioNuisiblesTypes");
      fait("nuisibles",
        `Nuisibles identifiés : `
        + `${types.map((x) => (labelOf(DIO_NUISIBLES, x) || x).toLowerCase()).join(", ")}.`);
    }
    reserves.push(RESERVE_NUISIBLES);
  }

  const odeurs = str(det, "dioOdeurs");
  if (odeurs) {
    note("dioOdeurs");
    fait("desodorisation", `Odeurs constatées : ${(labelOf(DIO_ODEURS, odeurs) || odeurs).toLowerCase()}.`);
  }

  if (famille === "apres_degat_eaux") reserves.push(RESERVE_ASSECHEMENT);

  if (etat) {
    fait("interieur", `Traitement renforcé des zones présentant un encrassement ${etat}.`);
  }

  // ── Contraintes d'organisation — pas des prestations ─────────────
  const etage = str(det, "etage");
  if (etage) {
    note("etage");
    const asc = str(det, "ascenseur");
    if (asc) note("ascenseur");
    const brut = labelOf(ETAGE, etage) || etage;
    const libelleEtage = brut === "RDC" ? "rez-de-chaussée" : `étage ${brut}`;
    const libelleAsc =
      asc === "non" ? " sans ascenseur"
      : asc === "oui" ? " avec ascenseur"
      : asc ? ` (${(labelOf(OUI_NON, asc) || asc).toLowerCase()})` : "";
    contraintes.push(`${libelleEtage}${libelleAsc}`);
  }
  const stat = str(det, "stationnement");
  if (stat) {
    note("stationnement");
    contraintes.push(`stationnement ${(labelOf(STATIONNEMENT, stat) || stat).toLowerCase()}`);
  }
  const occ = str(det, "occupation");
  if (occ) {
    note("occupation");
    contraintes.push((labelOf(OCCUPATION, occ) || occ).toLowerCase());
  }

  // ── Thèmes retenus : l'intersection de la famille et du validé ───
  const valide: Partial<Record<Theme, boolean>> = {
    interieur: true,
    sanitaires: true,
    sols_traitements: sols.length > 0 || traitements.length > 0,
    cuisine,
    equipements: equipements.length > 0,
    exterieurs: exterieurs.length > 0,
    finition_chantier: true,
    suies: true,
    degat_eaux: true,
    vitrerie: vitrerieDemandee,
    murs: mursDemande,
    plafonds: plafondsDemande,
    desinfection: avecDesinfection,
    decontamination: avecDecontamination,
    desodorisation: avecDesodorisation || !!odeurs,
    debarras_inclus: avecDebarrasInclus,
    debarras_prealable: estInsalubre,
    nuisibles,
  };
  // ── Thèmes retenus ───────────────────────────────────────────────
  //
  // La famille gouverne l'ORDRE de rédaction, pas l'inclusion. Un thème
  // piloté par la donnée — un équipement facturé, une vitrerie validée, des
  // nuisibles constatés — doit figurer au devis même si l'ordre de rédaction
  // de la famille ne le mentionne pas.
  //
  // ⚠️ Sans ce rattrapage, une prestation VALIDÉE disparaissait :
  //   • un nettoyage après incendie avec nuisibles perdait la section
  //     « Traitement des nuisibles » (test 9 du §20) ;
  //   • un chantier Diogène avec un four facturé perdait la section
  //     « Nettoyage des équipements » (interdiction 7 du §19).
  // Dans les deux cas c'est l'interdiction 5 — « oublier une prestation
  // validée » — et dans les deux cas c'est le contrôle automatique qui l'a
  // révélé, pas une relecture.
  //
  // Le rattrapage ne peut rien INVENTER : `valide[t] === true` n'est vrai
  // que pour un thème effectivement validé par la découverte. Et les thèmes
  // dont l'opportunité relève de la famille seule (`GATE_FAMILLE` : socle
  // intérieur, sanitaires, finition de chantier, suies, dégât des eaux) sont
  // volontairement hors de la liste de rattrapage : eux ne viennent QUE de
  // l'ordre de la famille.
  const themes: Theme[] = def.themes.filter((t) => valide[t] === true);
  for (const t of ORDRE_RATTRAPAGE) {
    if (valide[t] === true && !themes.includes(t)) themes.push(t);
  }

  if (famille === "apres_incendie" && themes.includes("suies")) {
    titreComplements.push("traitement des suies");
  }

  reserves.push(...(RESERVES_PAR_FAMILLE[famille] ?? []));

  return {
    titreBase: def.titre,
    nature: def.nature,
    bien,
    surface,
    precisionTitre: null,
    etat,
    niveau,
    themes,
    faits,
    titreComplements,
    contraintes,
    reserves,
    mentionProduits: true,
    famille,
    sources,
    manquant,
    contexte: (d.contexteIntervention ?? "").trim() || null,
  };
}

/**
 * Thèmes PILOTÉS PAR LA DONNÉE, dans leur ordre canonique de rattrapage.
 *
 * Tout thème validé par la découverte qui n'apparaît pas dans l'ordre de
 * rédaction de la famille est ajouté ici, à la fin, dans cet ordre. La liste
 * exclut délibérément `interieur`, `sanitaires`, `finition_chantier`, `suies`
 * et `degat_eaux` : ceux-là relèvent de la nature du chantier, décidée par la
 * famille, et les ajouter d'office reviendrait à inventer une prestation.
 */
const ORDRE_RATTRAPAGE: readonly Theme[] = [
  "sols_traitements", "cuisine", "equipements", "exterieurs",
  "murs", "plafonds", "vitrerie",
  "debarras_prealable", "debarras_inclus", "nuisibles",
  "desinfection", "decontamination", "desodorisation",
] as const;

/** Champs de vitrerie tracés en source quand le descriptif les exploite. */
const VITRERIE_CHAMPS = [
  "vitrerieFenetres", "vitrerieBaies", "vitreriePortesFenetres", "vitrerieVelux",
  "vitrerieVerandaM2", "vitrerieGrandesSurfacesM2", "vitrerieAutres",
  "vitrerieFaces", "vitrerieEncadrement", "vitrerieRails", "vitrerieCoulisses",
  "vitrerieAcces", "vitrerieEquipement", "vitrerieObservations",
] as const;

/**
 * Niveau d'encrassement tel qu'il se lit dans un devis.
 *
 * Les libellés de `ETAT_GENERAL` sont écrits pour le formulaire du
 * commercial ; ceux-ci qualifient le NIVEAU, ce qui est la seule tournure
 * acceptable dans une phrase adressée au client.
 */
const NIVEAU_ENCRASSEMENT: Record<string, string> = {
  leger: "léger",
  moyen: "modéré",
  important: "important",
  tres_important: "très important",
  extreme: "extrême",
};

const ORIGINES: Record<string, string> = {
  deces: "décès",
  sang: "sang ou fluides biologiques",
  eaux_usees: "eaux usées",
  incendie: "incendie",
  insalubrite: "insalubrité",
  tabac: "tabac",
  urine: "urine",
  dechets: "déchets",
  humidite: "humidité",
  autre: "autre origine signalée",
};
function libelleOrigine(k: string): string {
  return ORIGINES[k] ?? k;
}

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU B — ANALYSE : DÉBARRAS
// ══════════════════════════════════════════════════════════════════════

function analyserDebarras(d: Decouverte): Analyse {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];
  const faits: Partial<Record<Theme, string[]>> = {};
  const contraintes: string[] = [];
  const fait = (t: Theme, s: string) => { (faits[t] ??= []).push(s); };

  const typeBien = str(det, "typeBien");
  const volume = str(det, "volume") || str(det, "debarrasVolume");
  const surface = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : null;
  const acces = str(det, "acces");
  const encombrement = str(det, "encombrement");

  if (typeBien) sources.push("typeBien"); else manquant.push("type de bien");
  if (volume) sources.push("volume"); else manquant.push("volume estimé");
  if (surface) sources.push("surface");

  const bien = typeBien ? labelOf(TYPE_BIEN, typeBien).toLowerCase() : null;
  const partiel = /partiel/i.test(str(det, "typeDebarras"));
  if (str(det, "typeDebarras")) sources.push("typeDebarras");

  if (volume) fait("evacuation", `Volume contractuel estimé à ${labelOf(DEBARRAS_VOLUME, volume) || volume}.`);
  if (encombrement) {
    sources.push("encombrement");
    contraintes.push(`niveau d'encombrement ${encombrement.toLowerCase()}`);
  }
  if (str(det, "triDemande") === "oui") {
    sources.push("triDemande");
    fait("tri", "Tri sélectif demandé par le client.");
  }
  if (partiel) {
    fait("tri", "Débarras limité aux éléments et zones expressément désignés par le client.");
  }

  if (acces) {
    sources.push("acces");
    contraintes.push((labelOf(ACCES, acces) || acces).toLowerCase());
  }
  const etage = str(det, "etage");
  if (etage) { sources.push("etage"); contraintes.push(`étage ${etage}`); }

  // §10 : un débarras est une prestation simple, sauf encombrement marqué.
  const niveau: Niveau = /important|extr[êe]me|insalubre/i.test(encombrement) ? 3 : 2;

  return {
    titreBase: partiel ? "Débarras partiel" : "Débarras complet",
    nature: partiel ? "débarras partiel" : "débarras complet",
    bien,
    surface,
    precisionTitre: "avec évacuation des encombrants",
    etat: null,
    niveau,
    themes: ["tri", "manutention", "evacuation"],
    faits,
    titreComplements: [],
    contraintes,
    reserves: [RESERVE_VOLUME, RESERVE_BIENS_CONSERVES, RESERVE_DECHETS_REGLEMENTES],
    mentionProduits: false,
    famille: null,
    sources,
    manquant,
    contexte: (d.contexteIntervention ?? "").trim() || null,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU B — ANALYSE : DÉMÉNAGEMENT
// ══════════════════════════════════════════════════════════════════════

function analyserDemenagement(d: Decouverte): Analyse {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];
  const faits: Partial<Record<Theme, string[]>> = {};
  const contraintes: string[] = [];
  const themes: Theme[] = [];
  const fait = (t: Theme, s: string) => { (faits[t] ??= []).push(s); };

  const logement = str(det, "logementDepart");
  const volume = str(det, "volume");
  const villeD = (d.villeDepart ?? str(det, "villeDepart")).trim();
  const villeA = (d.villeArrivee ?? str(det, "villeArrivee")).trim();
  const complet = str(det, "typeDemenagement") !== "partiel";

  if (logement) sources.push("logementDepart"); else manquant.push("type de logement");
  if (volume) sources.push("volume"); else manquant.push("volume estimé");
  if (villeD) sources.push("villeDepart"); else manquant.push("ville de départ");
  if (villeA) sources.push("villeArrivee"); else manquant.push("ville d'arrivée");

  const bien = logement ? labelOf(LOGEMENT_TYPE, logement).toLowerCase() : null;

  const emballage = str(det, "emballage");
  if (emballage && emballage !== "aucun") {
    sources.push("emballage");
    themes.push("emballage");
    fait("emballage", `${cap(labelOf(EMBALLAGE, emballage))} des biens à transporter.`);
  } else {
    // La protection du mobilier est comprise dans tout déménagement.
    themes.push("emballage");
  }

  themes.push("transport_mobilier");
  if (str(det, "demontage") === "oui") {
    sources.push("demontage");
    fait("transport_mobilier", "Démontage du mobilier concerné au départ et remontage à l'arrivée.");
  }
  if (str(det, "monteMeubles") === "oui") {
    sources.push("monteMeubles");
    fait("transport_mobilier", "Mise en œuvre d'un monte-meubles.");
  }
  const objets = liste(det, "objetsSpecifiques");
  if (objets.length) {
    sources.push("objetsSpecifiques");
    fait("transport_mobilier",
      `Manutention spécifique : ${objets.map((o) => labelOf(OBJETS_SPECIFIQUES, o).toLowerCase()).join(", ")}.`);
  }
  themes.push("installation");

  if (volume) contraintes.push(`volume estimé ${labelOf(VOLUME_DEMENAGEMENT, volume) || volume} m³`);
  const eD = num(det, "etagesDepart"), eA = num(det, "etagesArrivee");
  const aD = str(det, "ascenseurDepart"), aA = str(det, "ascenseurArrivee");
  if (eD || aD) {
    sources.push("etagesDepart");
    contraintes.push(`départ ${eD ? `${eD}e étage` : "RDC"}${aD === "non" ? " sans ascenseur" : aD === "oui" ? " avec ascenseur" : ""}`);
  }
  if (eA || aA) {
    sources.push("etagesArrivee");
    contraintes.push(`arrivée ${eA ? `${eA}e étage` : "RDC"}${aA === "non" ? " sans ascenseur" : aA === "oui" ? " avec ascenseur" : ""}`);
  }
  const km = num(det, "distanceKm");
  if (km) { sources.push("distanceKm"); contraintes.push(`distance ${km} km`); }

  return {
    titreBase: complet ? "Déménagement complet" : "Déménagement partiel",
    nature: complet ? "déménagement complet" : "déménagement partiel",
    bien,
    surface: null,
    precisionTitre: villeD && villeA ? `de ${villeD} vers ${villeA}` : null,
    etat: null,
    niveau: 2,
    themes,
    faits,
    titreComplements: [],
    contraintes,
    reserves: [
      "Le devis est établi sur la base du volume annoncé, des accès, des étages, "
      + "de la présence ou non d'un ascenseur, des possibilités de stationnement "
      + "et des distances de portage communiqués lors de la découverte. Toute "
      + "différence constatée sur place fera l'objet d'une réévaluation après "
      + "accord du client.",
      "Les objets de très grande valeur, fragiles ou hors normes doivent être "
      + "signalés avant l'intervention afin d'être protégés et assurés en "
      + "conséquence.",
    ],
    mentionProduits: false,
    famille: null,
    sources,
    manquant,
    contexte: (d.contexteIntervention ?? "").trim() || null,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU B — ANALYSE : TRANSPORT
// ══════════════════════════════════════════════════════════════════════

function analyserTransport(d: Decouverte): Analyse {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];
  const faits: Partial<Record<Theme, string[]>> = {};
  const contraintes: string[] = [];
  const fait = (t: Theme, s: string) => { (faits[t] ??= []).push(s); };

  const typeObjet = str(det, "typeObjet");
  const qte = num(det, "quantiteObjets");
  const poids = num(det, "poidsKg");
  const vol = num(det, "volumeM3");
  const villeE = str(det, "villeEnlevement");
  const villeL = str(det, "villeLivraison");
  const options = liste(det, "optionsTransport");

  if (typeObjet) sources.push("typeObjet"); else manquant.push("type d'objet");
  if (qte) sources.push("quantiteObjets");
  if (poids) sources.push("poidsKg");
  if (vol) sources.push("volumeM3");
  if (villeE) sources.push("villeEnlevement"); else manquant.push("ville d'enlèvement");
  if (villeL) sources.push("villeLivraison"); else manquant.push("ville de livraison");

  const objet = typeObjet ? labelOf(TYPE_OBJET, typeObjet).toLowerCase() : "mobilier";

  if (qte) fait("transport_objet", `Éléments concernés : ${qte} unité${qte > 1 ? "s" : ""} (${objet}).`);
  if (options.length) sources.push("optionsTransport");
  if (options.includes("protection")) fait("transport_objet", "Protection et emballage des éléments transportés.");
  if (options.includes("demontage")) fait("transport_objet", "Démontage des éléments concernés avant chargement.");
  if (options.includes("remontage")) fait("transport_objet", "Remontage des éléments à l'arrivée.");
  if (options.includes("manutention")) fait("transport_objet", "Manutention assurée au départ et à l'arrivée.");

  const descObjets = str(det, "descriptionObjets");
  if (descObjets) {
    sources.push("descriptionObjets");
    fait("transport_objet", `Descriptif communiqué : ${descObjets}`);
  }

  if (vol) contraintes.push(`volume ${vol} m³`);
  if (poids) contraintes.push(`poids estimé ${poids} kg`);
  const km = num(det, "distanceKm");
  if (km) { sources.push("distanceKm"); contraintes.push(`distance ${km} km`); }
  for (const o of options.filter((x) => ["fragile", "lourd", "volumineux"].includes(x))) {
    contraintes.push(labelOf(OPTIONS_TRANSPORT, o).toLowerCase());
  }

  // Étages, ascenseurs et accès aux DEUX extrémités : ce sont eux qui
  // déterminent le temps de manutention.
  const bout = (libelle: string, cEtage: string, cAsc: string, cAcces: string) => {
    const etage = str(det, cEtage);
    const asc = str(det, cAsc);
    const acces = str(det, cAcces);
    const morceaux: string[] = [];
    if (etage) { sources.push(cEtage); morceaux.push(`étage ${etage}`); }
    if (asc) {
      sources.push(cAsc);
      morceaux.push(asc === "non" ? "sans ascenseur" : asc === "oui" ? "avec ascenseur" : asc);
    }
    if (acces) {
      sources.push(cAcces);
      morceaux.push((labelOf(ACCES, acces) || acces).toLowerCase());
    }
    if (morceaux.length) contraintes.push(`${libelle} : ${morceaux.join(", ")}`);
  };
  bout("enlèvement", "etageEnlevement", "ascenseurEnlevement", "accesEnlevement");
  bout("livraison", "etageLivraison", "ascenseurLivraison", "accesLivraison");

  return {
    titreBase: options.includes("manutention") ? "Transport et manutention" : "Transport",
    nature: "transport",
    bien: objet,
    surface: null,
    precisionTitre: villeE && villeL ? `de ${villeE} vers ${villeL}` : null,
    etat: null,
    niveau: 1,
    themes: ["transport_objet"],
    faits,
    titreComplements: [],
    contraintes,
    reserves: [
      "Le devis est établi sur la base du volume, du poids, des accès et des "
      + "conditions de manutention communiqués lors de la découverte. Toute "
      + "difficulté de manutention ou d'accès non signalée fera l'objet d'une "
      + "réévaluation après accord du client.",
      "Les objets de très grande valeur ou nécessitant une garantie spécifique "
      + "doivent être déclarés avant le transport.",
    ],
    mentionProduits: false,
    famille: null,
    sources,
    manquant,
    contexte: (d.contexteIntervention ?? "").trim() || null,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU B — entrée publique de l'analyse
// ══════════════════════════════════════════════════════════════════════

export function analyser(d: Decouverte): Analyse | null {
  if (!activiteCouverte(d.sector)) return null;
  switch (d.sector) {
    case "debarras": return analyserDebarras(d);
    case "demenagement": return analyserDemenagement(d);
    case "transport": return analyserTransport(d);
    default: return analyserNettoyage(d);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  NIVEAU C — RÉDACTION
// ══════════════════════════════════════════════════════════════════════

/**
 * Titre principal (§3).
 *
 *   PRESTATION PRINCIPALE + NATURE DU CHANTIER + COMPLÉMENTS IMPORTANTS
 *
 * Règles tenues : pas de répétition (un complément déjà nommé dans le titre
 * de base est ignoré), pas de longueur excessive (trois compléments au plus),
 * et jamais de prestation non validée — `titreComplements` n'est alimenté que
 * par des prestations validées.
 */
export function construireTitre(a: Analyse): string {
  const morceaux = [a.titreBase];
  if (a.bien) morceaux.push(`${article(a.bien)} ${a.bien}`);
  if (a.surface) morceaux.push(`de ${a.surface} m²`);
  if (a.precisionTitre) morceaux.push(a.precisionTitre);

  const base = morceaux.join(" ");
  // Pas de répétition : « avec désinfection » ne s'ajoute pas à un titre qui
  // dit déjà « et désinfection ».
  const nouveaux = a.titreComplements
    .filter((c) => !base.toLowerCase().includes(c.toLowerCase()))
    .slice(0, 3);

  const titre = nouveaux.length ? `${base} avec ${enumerer(nouveaux)}` : base;
  return titre.toUpperCase();
}

/** Prose courte par thème, pour la deuxième phrase de l'introduction (§4). */
const PROSE: Partial<Record<Theme, string>> = {
  interieur: "le nettoyage minutieux des espaces intérieurs",
  sols_traitements: "le traitement des sols",
  cuisine: "le nettoyage approfondi et le dégraissage de la cuisine",
  sanitaires: "le nettoyage approfondi des équipements sanitaires",
  equipements: "le nettoyage des équipements compris au devis",
  exterieurs: "le nettoyage des espaces extérieurs",
  finition_chantier: "le nettoyage de finition après travaux",
  debarras_prealable: "le débarras préalable du logement",
  nuisibles: "le traitement des nuisibles",
  vitrerie: "la vitrerie comprise dans le périmètre de l'intervention",
  murs: "le lessivage des murs",
  plafonds: "le nettoyage des plafonds",
  desinfection: "la désinfection des surfaces concernées",
  decontamination: "la décontamination des zones identifiées",
  desodorisation: "le traitement des odeurs",
  debarras_inclus: "l'évacuation des encombrants",
  suies: "le traitement des suies et résidus de combustion",
  degat_eaux: "le traitement consécutif au dégât des eaux",
  tri: "le tri des biens",
  manutention: "la manutention et le chargement",
  evacuation: "l'évacuation vers les filières autorisées",
  emballage: "la protection des biens",
  transport_mobilier: "le chargement et le transport",
  installation: "le déchargement et la mise en place",
  transport_objet: "l'enlèvement, le transport et la livraison",
};

/**
 * Introduction professionnelle (§4).
 *
 * Deux phrases. La première situe le bien et la nature de l'intervention ; la
 * seconde annonce les principales opérations. Le §4 l'exige concise : elle ne
 * reprend pas toutes les informations de découverte et ne répète pas les
 * sections détaillées — quatre opérations au plus y sont citées.
 */
export function construireIntroduction(a: Analyse): string {
  const bien = a.bien ? ` ${article(a.bien)} ${a.bien}` : "";
  const surface = a.surface ? ` d'environ ${a.surface} m²` : "";
  const etat = a.etat ? ` présentant un niveau d'encrassement ${a.etat}` : "";
  const lieu = a.precisionTitre && !a.precisionTitre.startsWith("avec")
    ? ` ${a.precisionTitre}`
    : "";

  const phrase1 = `Intervention de ${a.nature}${bien}${surface}${lieu}${etat}.`;

  // Le modèle du §4 cite trois opérations du socle puis, « ainsi que », la
  // prestation complémentaire — « ainsi que la vitrerie comprise dans le
  // périmètre de l'intervention ». C'est elle qui distingue ce devis des
  // autres : la prendre dans l'ordre des thèmes la ferait tomber hors des
  // quatre citées dès que le chantier compte plusieurs pièces.
  const socle = a.themes.filter((t) => !estComplementaire(t));
  const complementaires = a.themes.filter((t) => estComplementaire(t));
  const retenues = [...socle.slice(0, 3), ...complementaires.slice(0, 1)]
    .map((t) => PROSE[t])
    .filter((p): p is string => !!p);
  if (retenues.length === 0) return phrase1;
  const phrase2 =
    retenues.length === 1
      ? `La prestation comprend ${retenues[0]}.`
      : `La prestation comprend ${retenues.slice(0, -1).join(", ")} ainsi que ${retenues[retenues.length - 1]}.`;

  return `${phrase1}\n\n${phrase2}`;
}

/**
 * Sections techniques numérotées (§2, §5).
 *
 * Chaque thème validé donne UNE section : les opérations du référentiel pour
 * le niveau retenu, puis les précisions tirées de la découverte. L'ordre est
 * celui de la famille — pour un chantier Diogène, c'est l'ordre imposé par le
 * §7.8 : débarras, nettoyage, désinfection, décontamination.
 */
export function construireSections(a: Analyse): SectionRedigee[] {
  const sections: SectionRedigee[] = [];
  const dejaEcrites = new Set<string>();

  for (const theme of a.themes) {
    const operations: string[] = [];
    for (const op of operationsDe(theme, a.niveau)) {
      // Anti-répétition globale (§10, §19.18) : une opération écrite dans une
      // section ne se répète pas dans une autre.
      const cle = normaliser(op);
      if (dejaEcrites.has(cle)) continue;
      dejaEcrites.add(cle);
      operations.push(op);
    }
    for (const f of a.faits[theme] ?? []) {
      const cle = normaliser(f);
      if (dejaEcrites.has(cle)) continue;
      dejaEcrites.add(cle);
      operations.push(f);
    }
    if (operations.length === 0) continue;
    sections.push({ titre: titreDe(theme), operations });
  }

  return sections;
}

function normaliser(s: string): string {
  return s.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüç0-9]+/g, " ").trim();
}

/** Réserves du devis (§12) : socle commun, puis réserves du chantier. */
export function construireReserves(a: Analyse): string {
  const socle = [RESERVE_REEVALUATION, RESERVE_NON_SIGNALE];
  if (a.niveau >= 2 && a.mentionProduits) socle.push(RESERVE_SUPPORTS);
  // Dédoublonnage : une même réserve peut être poussée par deux chemins.
  const toutes = [...socle, ...a.reserves];
  return [...new Set(toutes)].join("\n\n");
}

/** Rendu texte des sections, numérotées — ce qui part dans le PDF. */
export function rendreDetail(a: Analyse, sections: SectionRedigee[]): string {
  const lignes: string[] = [];
  sections.forEach((s, i) => {
    if (i > 0) lignes.push("");
    lignes.push(`${i + 1}. ${s.titre}`);
    lignes.push("");
    for (const op of s.operations) lignes.push(`- ${op}`);
  });

  if (a.mentionProduits) {
    lignes.push("", MENTION_PRODUITS);
  }
  if (a.contraintes.length) {
    lignes.push("", `Conditions d'accès relevées : ${a.contraintes.join(", ")}.`);
  }
  if (a.contexte) {
    lignes.push("", `Informations complémentaires communiquées : ${a.contexte}`);
  }
  return lignes.join("\n");
}

/** NIVEAU C — rédaction complète à partir d'une analyse. */
export function rediger(a: Analyse): ContenuDevis {
  const sections = construireSections(a);
  return {
    designation: construireTitre(a),
    introduction: construireIntroduction(a),
    sections,
    detail: rendreDetail(a, sections),
    reserves: construireReserves(a),
    niveau: a.niveau,
    famille: a.famille ?? a.titreBase,
    sources: [...new Set(a.sources)],
    manquant: [...new Set(a.manquant)],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Entrée publique
// ══════════════════════════════════════════════════════════════════════

/**
 * Contenu de devis à partir d'une découverte enregistrée.
 *
 * `null` = activité hors périmètre. On ne produit rien plutôt qu'un texte
 * inadapté.
 */
export function genererContenuDevis(d: Decouverte): ContenuDevis | null {
  const a = analyser(d);
  return a ? rediger(a) : null;
}

/**
 * Régénération à un niveau de développement imposé (§17, boutons 2 et 3).
 *
 * Le niveau ne peut qu'être relevé par rapport à ce que l'analyse a déduit :
 * le §10 interdit de produire une description superficielle pour une
 * intervention complexe, et ce n'est pas à un bouton d'interface de passer
 * outre.
 */
export function genererAuNiveau(d: Decouverte, niveau: Niveau): ContenuDevis | null {
  const a = analyser(d);
  if (!a) return null;
  return rediger({ ...a, niveau: Math.max(a.niveau, niveau) as Niveau });
}

// ══════════════════════════════════════════════════════════════════════
//  Garde-fous de rédaction (§19)
// ══════════════════════════════════════════════════════════════════════

/** Expressions proscrites, et ce qu'il faut écrire à la place. */
export const INTERDITS: { motif: RegExp; raison: string }[] = [
  // Interdiction 20.
  { motif: /remise\s+en\s+(é|e)tat/i, raison: "« remise en état » est proscrit : écrire « nettoyage approfondi » ou « nettoyage complet »" },
  // Interdiction 16 : aucun prix dans le contenu généré.
  { motif: /\d[\d\s.,]*\s*(€|EUR\b|euros?|CHF\b|francs?\s+suisses?|\$|CAD\b)/i, raison: "aucun prix ne doit figurer dans le contenu généré" },
  // Interdictions 21, 22, 23.
  { motif: /engagements?\s+de\s+l'entreprise/i, raison: "rubrique « Engagements de l'entreprise » non autorisée" },
  { motif: /objectif\s+final/i, raison: "rubrique « Objectif final » non autorisée" },
  { motif: /conditions\s+de\s+r(è|e)glement/i, raison: "rubrique « Conditions de règlement » non autorisée" },
  // Interdiction 26 : aucune promesse de résultat sanitaire.
  //
  // ⚠️ Le motif ne doit relever que les promesses POSITIVES. Une première
  // version cherchait « garantie d'absence » et se déclenchait donc sur la
  // réserve du §7.9 — « ni une expertise, ni une garantie d'absence totale
  // d'agents biologiques » — qui dit exactement le contraire. Un garde-fou
  // qui sanctionne la clause protectrice est pire qu'absent : il pousse à la
  // retirer.
  {
    motif: /(d(é|e)sinfection|d(é|e)contamination|st(é|e)rilisation)\s+(totale|compl(è|e)te|int(é|e)grale)|(é|e)limination\s+totale\s+des|100\s*%\s*(sain|st(é|e)rile|d(é|e)sinfect)|nous\s+garantissons|garantit\s+(l'absence|une\s+absence|un\s+r(é|e)sultat)|r(é|e)sultat\s+sanitaire\s+garanti/i,
    raison: "aucune promesse de résultat sanitaire absolu n'est autorisée",
  },
  // Interdiction 27 : une prestation prévue n'est jamais présentée comme faite.
  {
    motif: /(a\s+(é|e)t(é|e)\s+(r(é|e)alis|nettoy|d(é|e)sinfect|d(é|e)contamin|trait))|(travaux\s+r(é|e)alis(é|e)s)|(intervention\s+r(é|e)alis(é|e)e\s+le\b)/i,
    raison: "le devis décrit une prestation À RÉALISER : ne pas la présenter comme déjà exécutée",
  },
];

/**
 * Vérifie qu'un contenu respecte les règles de rédaction.
 *
 * Appelé APRÈS la génération : c'est un filet, pas la règle. Les gabarits ne
 * produisent pas ces formulations, mais un commercial peut les saisir à la
 * main dans le champ modifiable, et le devis ne doit pas partir avec.
 */
export function verifierRedaction(c: ContenuDevis): { ok: boolean; alertes: string[] } {
  const texte = `${c.designation}\n${c.introduction}\n${c.detail}\n${c.reserves}`;
  const alertes = INTERDITS.filter((i) => i.motif.test(texte)).map((i) => i.raison);

  // Interdictions 11 à 15 : aucune prestation complémentaire ne doit
  // apparaître si elle n'a pas été validée. Le contrôle est structurel —
  // il compare les sections rédigées aux thèmes que l'analyse a retenus.
  return { ok: alertes.length === 0, alertes };
}

/**
 * Contrôle structurel : aucune section complémentaire non validée (§6.B).
 *
 * Complète `verifierRedaction`, qui ne voit que du texte. Ici on vérifie que
 * toute section issue d'un thème complémentaire correspond bien à un thème
 * retenu par l'analyse — c'est la garantie mécanique des interdictions 11
 * à 15, et le test 13 du §20 s'appuie dessus.
 */
export function aucunThemeComplementaireNonValide(
  a: Analyse,
  sections: SectionRedigee[],
): { ok: boolean; fautifs: string[] } {
  const autorises = new Set(a.themes.map((t) => titreDe(t)));
  const fautifs = sections
    .map((s) => s.titre)
    .filter((titre) => !autorises.has(titre));
  // Un titre de section hors analyse est nécessairement une invention.
  const complementairesNonValides = fautifs.filter((titre) =>
    (Object.keys(OPERATIONS_TITRES) as Theme[]).some(
      (t) => OPERATIONS_TITRES[t] === titre && estComplementaire(t),
    ),
  );
  return {
    ok: fautifs.length === 0,
    fautifs: complementairesNonValides.length ? complementairesNonValides : fautifs,
  };
}

/** Index titre → thème, pour le contrôle structurel ci-dessus. */
const OPERATIONS_TITRES: Record<Theme, string> = (() => {
  const themes: Theme[] = [
    "interieur", "cuisine", "sanitaires", "sols_traitements", "equipements",
    "exterieurs", "finition_chantier", "debarras_prealable", "nuisibles",
    "vitrerie", "murs", "plafonds", "desinfection", "decontamination",
    "desodorisation", "debarras_inclus", "suies", "degat_eaux",
    "tri", "manutention", "evacuation", "emballage", "transport_mobilier",
    "installation", "transport_objet",
  ];
  const out = {} as Record<Theme, string>;
  for (const t of themes) out[t] = titreDe(t);
  return out;
})();

// ══════════════════════════════════════════════════════════════════════
//  §17.4 — CORRIGER LES RÉPÉTITIONS
// ══════════════════════════════════════════════════════════════════════

/**
 * Supprime les puces en double d'un descriptif, et renumérote les sections.
 *
 * S'applique au TEXTE du devis, y compris modifié à la main : c'est tout
 * l'intérêt du bouton du §17.4, puisque le moteur, lui, ne produit jamais de
 * doublon (le contrôle `18 — aucune opération répétée` le prouve). Ce sont les
 * ajouts successifs d'un commercial qui en créent.
 *
 * CE QU'ELLE NE FAIT PAS : reformuler. Deux phrases qui disent la même chose
 * autrement sont conservées toutes les deux — les départager demanderait de
 * juger du sens, et le §19.19 interdit d'appauvrir un descriptif. Seules les
 * puces STRICTEMENT identiques, à la casse, aux accents et à la ponctuation
 * près, sont retirées.
 *
 * Elle préserve l'ordre, les intitulés de blocs, les lignes vides et tout ce
 * qui n'est pas une puce.
 */
export function corrigerRepetitions(texte: string): { texte: string; retirees: number } {
  const lignes = texte.split("\n");
  const vues = new Set<string>();
  const sortie: string[] = [];
  let retirees = 0;
  let numero = 0;

  for (const ligne of lignes) {
    const puce = /^\s*[-•*]\s+(.*\S)\s*$/.exec(ligne);
    if (puce) {
      const cle = normaliser(puce[1]);
      // Une puce vide de contenu signifiant n'est pas dédoublonnée.
      if (cle.length >= 8) {
        if (vues.has(cle)) { retirees++; continue; }
        vues.add(cle);
      }
      sortie.push(ligne);
      continue;
    }
    // Section numérotée : on renumérote, puisque des suppressions peuvent
    // avoir vidé une section entière plus haut.
    const section = /^(\s*)(\d+)\.\s+(.*)$/.exec(ligne);
    if (section) {
      numero++;
      sortie.push(`${section[1]}${numero}. ${section[3]}`);
      continue;
    }
    sortie.push(ligne);
  }

  // Une section dont toutes les puces ont disparu ne doit pas rester en
  // titre orphelin.
  const nettoye: string[] = [];
  for (let i = 0; i < sortie.length; i++) {
    const estSection = /^\s*\d+\.\s+\S/.test(sortie[i]);
    if (estSection) {
      // La section garde-t-elle au moins une puce avant la section suivante ?
      let aUnePuce = false;
      for (let j = i + 1; j < sortie.length; j++) {
        if (/^\s*\d+\.\s+\S/.test(sortie[j])) break;
        if (/^\s*[-•*]\s+\S/.test(sortie[j])) { aUnePuce = true; break; }
      }
      if (!aUnePuce) {
        // On saute le titre ET la ligne vide qui le suit.
        if (sortie[i + 1] !== undefined && sortie[i + 1].trim() === "") i++;
        continue;
      }
    }
    nettoye.push(sortie[i]);
  }

  // Renumérotation finale, après retrait des sections vidées.
  let n = 0;
  const final = nettoye.map((l) => {
    const s = /^(\s*)(\d+)\.\s+(.*)$/.exec(l);
    if (!s) return l;
    n++;
    return `${s[1]}${n}. ${s[3]}`;
  });

  return { texte: final.join("\n"), retirees };
}
