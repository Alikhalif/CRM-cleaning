// Contenu de devis à partir de la découverte — PUR, aucune I/O.
//
// GÉNÉRATION DÉTERMINISTE, pas un appel à une IA. Le CRM n'a aucun modèle de
// langage configuré, et pour ce travail c'est un avantage : les règles du
// cahier sont absolues — « ne jamais inventer d'information », « ne jamais
// générer de prix », « ne jamais écrire remise en état ». Un gabarit nourri
// par les champs réellement saisis les respecte par construction et se teste.
// Le jour où vous voudrez une rédaction plus libre, ce module restera la
// source des FAITS à lui transmettre.
//
// PÉRIMÈTRE (§2) : nettoyage, nettoyage difficile, Diogène, débarras,
// déménagement, transport. Le dépannage et les travaux du bâtiment sont
// exclus — `genererContenuDevis` renvoie null pour eux.

import { labelOf } from "@/lib/discovery-metier";
import {
  COMPLEMENTS, DEBARRAS_VOLUME, DIO_DECHETS, DIO_ENCOMBREMENT, DIO_VOLUME,
  ETAT_GENERAL, EXTERIEUR_TYPE, MURS, PLAFONDS_TYPE,
  SOLS, TRAITEMENTS_SOL, TYPE_BIEN_NETTOYAGE, TYPE_NETTOYAGE, VITRERIE_FACES,
} from "@/lib/discovery-nettoyage";
import {
  EMBALLAGE, LOGEMENT_TYPE, OBJETS_SPECIFIQUES, TYPE_BIEN, VOLUME_DEMENAGEMENT,
  TYPE_OBJET, OPTIONS_TRANSPORT,
} from "@/lib/discovery-metier";

/** Activités couvertes. Les autres sont hors périmètre (§2). */
export const ACTIVITES_COUVERTES = [
  "nettoyage", "nettoyage_difficile", "diogene",
  "debarras", "demenagement", "transport",
] as const;

export function activiteCouverte(sector: string): boolean {
  return (ACTIVITES_COUVERTES as readonly string[]).includes(sector);
}

export type ContenuDevis = {
  designation: string;
  detail: string;
  reserves: string;
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
  /** Ville du chantier, pour la désignation d'un déménagement. */
  villeDepart?: string | null;
  villeArrivee?: string | null;
};

// ── Petits outils de lecture ──────────────────────────────────────────

const str = (d: Record<string, unknown>, k: string): string =>
  typeof d[k] === "string" ? (d[k] as string).trim() : "";
const num = (d: Record<string, unknown>, k: string): number => {
  const n = typeof d[k] === "number" ? d[k] : Number(d[k]);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const liste = (d: Record<string, unknown>, k: string): string[] =>
  Array.isArray(d[k]) ? (d[k] as unknown[]).map(String).filter(Boolean) : [];
const oui = (d: Record<string, unknown>, k: string): boolean => str(d, k) === "oui";

/** Première lettre en capitale, le reste intact. */
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Engagement de l'entreprise, à mentionner sur les prestations de nettoyage
// (§3.4). Pas sur un déménagement ou un transport : aucun produit n'y est
// appliqué, l'affirmation serait hors sujet.
const PRODUITS_ECO =
  "Les prestations sont réalisées avec des produits professionnels "
  + "100 % français et écoresponsables.";

// ── Réserves communes ─────────────────────────────────────────────────
//
// La réserve de périmètre figure sur TOUS les devis : c'est elle qui protège
// contre la demande supplémentaire faite au dernier moment.
const RESERVE_PERIMETRE =
  "Le présent devis est établi sur la base des informations communiquées par "
  + "le client lors de la découverte. Toute demande supplémentaire ou "
  + "modification du périmètre initial fera l'objet d'une validation préalable "
  + "et, le cas échéant, d'une réévaluation du devis.";

const RESERVE_NON_SIGNALE =
  "Les difficultés non visibles lors de la découverte, les contraintes "
  + "techniques et les éléments non signalés au moment de l'établissement du "
  + "devis pourront donner lieu à une réévaluation après accord du client.";

// ══════════════════════════════════════════════════════════════════════
//  NETTOYAGE (y compris nettoyage difficile et Diogène)
// ══════════════════════════════════════════════════════════════════════

/**
 * Libellé de prestation à partir du type de nettoyage saisi.
 *
 * Les options de la découverte sont des QUALIFICATIFS (« Approfondi »,
 * « Fin de bail ») : il faut les préfixer, sinon la désignation sort
 * « APPROFONDI D'UN APPARTEMENT ».
 *
 * ⚠️ `remise_etat` est libellé « Remise en état » dans la découverte — soit
 * exactement l'expression que le §3.4 proscrit. On la réécrit ici en
 * « Nettoyage approfondi » : c'est le seul endroit où le piège peut être
 * désamorcé, puisque le commercial continue de voir l'ancien libellé dans
 * son formulaire.
 */
function libelleTypeNettoyage(type: string): string {
  const particuliers: Record<string, string> = {
    classique: "Nettoyage courant",
    approfondi: "Nettoyage approfondi",
    remise_etat: "Nettoyage approfondi",
    tres_sale: "Nettoyage approfondi d'un logement très sale",
    insalubre: "Nettoyage d'un logement insalubre",
    apres_squat: "Nettoyage après occupation sans droit",
    autre: "Nettoyage approfondi",
  };
  if (particuliers[type]) return particuliers[type];
  const brut = type ? labelOf(TYPE_NETTOYAGE, type) : "";
  if (!brut || brut === type) return "Nettoyage approfondi";
  // « Fin de bail » → « Nettoyage fin de bail ».
  return `Nettoyage ${brut.charAt(0).toLowerCase()}${brut.slice(1)}`;
}

function nettoyage(d: Decouverte): ContenuDevis {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];
  const note = (k: string) => sources.push(k);

  const typeNet = str(det, "typeNettoyage");
  const typeBien = str(det, "typeBienNet");
  const surface = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : 0;

  // ── Désignation ──────────────────────────────────────────────────
  // « Nettoyage approfondi d'un appartement de 75 m² ».
  const libelleType = libelleTypeNettoyage(typeNet);
  if (typeNet) note("typeNettoyage"); else manquant.push("type de nettoyage");
  const libelleBien = typeBien ? labelOf(TYPE_BIEN_NETTOYAGE, typeBien).toLowerCase() : "";
  if (typeBien) note("typeBienNet"); else manquant.push("type de bien");
  if (surface) note("surface"); else manquant.push("surface");

  const complements = liste(det, "complements");
  if (complements.length) note("complements");
  const avecDesinfection = complements.includes("desinfection") || str(det, "desinfectionSurface") !== "";
  const avecDecontamination = complements.includes("decontamination");
  const avecDesodorisation = complements.includes("desodorisation");

  let designation = libelleType;
  if (avecDesinfection && !/désinfection/i.test(designation)) designation += " et désinfection";
  if (avecDecontamination && !/décontamination/i.test(designation)) designation += " et décontamination";
  if (libelleBien) designation += ` d'un ${libelleBien}`;
  if (surface) designation += ` de ${surface} m²`;
  designation = designation.toUpperCase();

  // ── Détail ───────────────────────────────────────────────────────
  const taches: string[] = [];
  const nbPieces = num(det, "nbPieces");
  if (nbPieces) note("nbPieces");

  taches.push(
    nbPieces
      ? `Nettoyage approfondi des ${nbPieces} pièces concernées.`
      : "Nettoyage approfondi de l'ensemble des pièces concernées.",
  );
  taches.push("Dépoussiérage et nettoyage des surfaces accessibles.");

  const sols = liste(det, "sols");
  if (sols.length) {
    note("sols");
    const noms = sols.map((s) => labelOf(SOLS, s).toLowerCase()).join(", ");
    taches.push(`Nettoyage et dégraissage des sols (${noms}).`);
  } else {
    taches.push("Nettoyage et dégraissage des sols selon les revêtements.");
  }

  const traitements = liste(det, "traitementsSol");
  if (traitements.length) {
    note("traitementsSol");
    for (const t of traitements) taches.push(`${cap(labelOf(TRAITEMENTS_SOL, t))} des sols concernés.`);
  }

  // Cuisine : on ne l'écrit que si la découverte la mentionne.
  if (oui(det, "cuisineAmenagee") || oui(det, "cuisineEquipee") || oui(det, "cuisineInterieur")) {
    note("cuisine");
    const equipee = oui(det, "cuisineEquipee");
    taches.push(
      equipee
        ? "Nettoyage approfondi de la cuisine et dégraissage des équipements."
        : "Nettoyage approfondi de la cuisine.",
    );
    if (oui(det, "cuisineInterieur")) {
      taches.push("Nettoyage de l'intérieur des meubles et placards de cuisine.");
    }
  }

  const nbSdb = num(det, "nbSdb");
  const nbWc = num(det, "nbWc");
  if (nbSdb || nbWc) {
    note("sanitaires");
    const parts: string[] = [];
    if (nbSdb) parts.push(`${nbSdb} salle${nbSdb > 1 ? "s" : ""} de bain`);
    if (nbWc) parts.push(`${nbWc} WC`);
    taches.push(`Nettoyage et désinfection des sanitaires (${parts.join(", ")}).`);
    taches.push("Détartrage des robinetteries et des équipements sanitaires.");
  } else {
    taches.push("Nettoyage et désinfection des sanitaires.");
    taches.push("Détartrage des robinetteries et des équipements sanitaires.");
  }

  if (oui(det, "dressings") || oui(det, "dressingsInterieur")) {
    note("dressings");
    taches.push(
      oui(det, "dressingsInterieur")
        ? "Nettoyage des placards et dressings, intérieur compris."
        : "Nettoyage extérieur des placards et dressings.",
    );
  }

  // Vitrerie : uniquement si demandée, avec les faces réellement retenues.
  if (oui(det, "vitrerie")) {
    note("vitrerie");
    const faces = str(det, "vitrerieFaces");
    const compte: string[] = [];
    const f = num(det, "vitrerieFenetres");
    const b = num(det, "vitrerieBaies");
    const v = num(det, "vitrerieVelux");
    const ver = num(det, "vitrerieVerandaM2");
    if (f) compte.push(`${f} fenêtre${f > 1 ? "s" : ""}`);
    if (b) compte.push(`${b} baie${b > 1 ? "s" : ""} vitrée${b > 1 ? "s" : ""}`);
    if (v) compte.push(`${v} Velux`);
    if (ver) compte.push(`${ver} m² de véranda`);
    const detailFaces = faces
      ? ` (${labelOf(VITRERIE_FACES, faces).toLowerCase()})`
      : "";
    taches.push(
      compte.length
        ? `Nettoyage des vitres et encadrements — ${compte.join(", ")}${detailFaces}.`
        : `Nettoyage des vitres et des encadrements accessibles${detailFaces}.`,
    );
  }

  // Murs et plafonds : SEULEMENT si demandés (§3.4).
  const murs = str(det, "murs");
  if (murs && murs !== "murs_aucun") {
    note("murs");
    const surf = str(det, "mursSurface");
    taches.push(`${cap(labelOf(MURS, murs))}${surf ? ` — ${surf}` : ""}.`);
  }
  if (oui(det, "plafonds")) {
    note("plafonds");
    const type = str(det, "plafondsType");
    taches.push(
      type
        ? `Nettoyage des plafonds (${labelOf(PLAFONDS_TYPE, type).toLowerCase()}).`
        : "Nettoyage des plafonds.",
    );
  }

  const equipements = liste(det, "equipements");
  if (equipements.length) {
    note("equipements");
    taches.push(`Nettoyage des équipements : ${equipements.map((e) => labelOf(COMPLEMENTS, e) || e).join(", ")}.`);
  }

  const exterieurs = liste(det, "exterieurTypes");
  if (exterieurs.length) {
    note("exterieurTypes");
    const m2 = num(det, "exterieurSurfaceM2");
    taches.push(
      `Nettoyage des espaces extérieurs : ${exterieurs.map((x) => labelOf(EXTERIEUR_TYPE, x).toLowerCase()).join(", ")}`
      + `${m2 ? ` (${m2} m²)` : ""}.`,
    );
  }

  if (avecDesinfection) {
    const m2 = num(det, "desinfectionM2");
    taches.push(`Désinfection des surfaces concernées${m2 ? ` (${m2} m²)` : ""}.`);
  }
  if (avecDecontamination) taches.push("Décontamination des zones identifiées.");
  if (avecDesodorisation) taches.push("Traitement des odeurs résiduelles.");

  // ── Spécificités insalubre / Diogène ─────────────────────────────
  const encombrement = str(det, "dioEncombrement");
  const dechets = str(det, "dioDechets");
  const nuisibles = str(det, "dioNuisibles");
  const odeurs = str(det, "dioOdeurs");
  const dioVolume = str(det, "dioVolume");
  const estInsalubre = d.sector === "diogene" || d.sector === "nettoyage_difficile"
    || !!encombrement || !!dechets;

  if (estInsalubre) {
    if (encombrement) { note("dioEncombrement"); taches.push(`Intervention en logement encombré — niveau ${labelOf(DIO_ENCOMBREMENT, encombrement).toLowerCase()}.`); }
    if (dechets) { note("dioDechets"); taches.push(`Évacuation des déchets présents (${labelOf(DIO_DECHETS, dechets).toLowerCase()}).`); }
    if (dioVolume) { note("dioVolume"); taches.push(`Volume à évacuer estimé à ${labelOf(DIO_VOLUME, dioVolume).toLowerCase()}.`); }
    if (nuisibles === "oui") {
      note("dioNuisibles");
      taches.push("Traitement des nuisibles constatés, en coordination avec l'entreprise habilitée.");
    }
    if (odeurs) { note("dioOdeurs"); taches.push("Traitement des odeurs."); }
    if (!dechets) manquant.push("nature des déchets");
    if (!dioVolume) manquant.push("volume de déchets à évacuer");
  }

  // Encrassement : le fait justifie le traitement renforcé.
  if (d.etatSalete) {
    note("etatSalete");
    const etat = labelOf(ETAT_GENERAL, d.etatSalete).toLowerCase();
    taches.push(`Traitement renforcé des zones présentant un encrassement ${etat}.`);
  }

  // Accès : un fait d'organisation, pas une prestation.
  const contraintes: string[] = [];
  const etage = str(det, "etage");
  if (etage) {
    note("etage");
    const asc = str(det, "ascenseur");
    contraintes.push(`${labelOf(COMPLEMENTS, etage) || etage}${asc === "non" ? " sans ascenseur" : asc === "oui" ? " avec ascenseur" : ""}`);
  }
  const stat = str(det, "stationnement");
  if (stat) { note("stationnement"); contraintes.push(labelOf(COMPLEMENTS, stat) || stat); }

  const detail = [
    "PRESTATION",
    `${libelleType}${libelleBien ? ` d'un ${libelleBien}` : ""}${surface ? ` de ${surface} m²` : ""}.`,
    "",
    "DÉTAIL DES PRESTATIONS",
    ...taches.map((t) => `- ${t}`),
    "",
    PRODUITS_ECO,
    ...(contraintes.length ? ["", `Conditions d'accès relevées : ${contraintes.join(", ")}.`] : []),
  ].join("\n");

  // ── Réserves ─────────────────────────────────────────────────────
  const reserves = [RESERVE_PERIMETRE, RESERVE_NON_SIGNALE];
  if (estInsalubre) {
    reserves.push(
      "Les conditions réelles d'intervention en logement insalubre ne peuvent "
      + "être pleinement appréciées avant le début des opérations. La découverte "
      + "d'un encombrement, d'un volume de déchets ou d'une contamination "
      + "supérieurs à ceux annoncés donnera lieu à une réévaluation après accord "
      + "du client.",
    );
  }
  if (oui(det, "vitrerie")) {
    reserves.push(
      "Les vitrages inaccessibles sans équipement spécifique (nacelle, "
      + "échafaudage) sont exclus du présent devis et feront l'objet d'une "
      + "proposition distincte.",
    );
  }
  if (murs && murs !== "murs_aucun") {
    reserves.push(
      "Le lessivage des murs est réalisé sur les supports lavables. Les "
      + "revêtements fragiles, dégradés ou non lessivables sont exclus.",
    );
  }

  return {
    designation,
    detail,
    reserves: reserves.join("\n\n"),
    sources: [...new Set(sources)],
    manquant: [...new Set(manquant)],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  DÉBARRAS
// ══════════════════════════════════════════════════════════════════════

function debarras(d: Decouverte): ContenuDevis {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];

  const typeBien = str(det, "typeBien");
  const volume = str(det, "volume") || str(det, "debarrasVolume");
  const surface = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : 0;
  const acces = str(det, "acces");
  const encombrement = str(det, "encombrement");

  if (typeBien) sources.push("typeBien"); else manquant.push("type de bien");
  if (volume) sources.push("volume"); else manquant.push("volume estimé");
  if (surface) sources.push("surface");

  const libelleBien = typeBien ? labelOf(TYPE_BIEN, typeBien).toLowerCase() : "";
  const partiel = /partiel/i.test(str(det, "typeDebarras"));
  const designation = [
    partiel ? "DÉBARRAS PARTIEL" : "DÉBARRAS COMPLET",
    libelleBien ? `D'UN${/^[aeiouh]/i.test(libelleBien) ? "E" : ""} ${libelleBien.toUpperCase()}` : "",
    "AVEC ÉVACUATION DES ENCOMBRANTS",
  ].filter(Boolean).join(" ");

  const taches: string[] = [
    partiel
      ? "Débarras des éléments et zones expressément désignés par le client."
      : "Débarras de l'intégralité des biens à évacuer.",
    "Tri des biens sur place selon les instructions du client.",
    "Chargement et sortie des biens jusqu'au véhicule.",
    "Transport et évacuation vers les filières de traitement autorisées.",
    "Remise des justificatifs de traitement des déchets.",
  ];
  if (volume) taches.push(`Volume contractuel estimé à ${labelOf(DEBARRAS_VOLUME, volume) || volume}.`);
  if (encombrement) { sources.push("encombrement"); taches.push(`Niveau d'encombrement constaté : ${encombrement}.`); }
  if (str(det, "triDemande") === "oui") { sources.push("triDemande"); taches.push("Tri sélectif demandé par le client."); }

  const contraintes: string[] = [];
  if (acces) { sources.push("acces"); contraintes.push(labelOf(COMPLEMENTS, acces) || acces); }
  const etage = str(det, "etage");
  if (etage) { sources.push("etage"); contraintes.push(etage); }

  const detail = [
    "PRESTATION",
    `${partiel ? "Débarras partiel" : "Débarras complet"}${libelleBien ? ` d'un ${libelleBien}` : ""}`
      + `${surface ? ` de ${surface} m²` : ""}, avec évacuation et traitement des encombrants.`,
    "",
    "DÉTAIL DES PRESTATIONS",
    ...taches.map((t) => `- ${t}`),
    ...(contraintes.length ? ["", `Conditions d'accès relevées : ${contraintes.join(", ")}.`] : []),
  ].join("\n");

  const reserves = [
    RESERVE_PERIMETRE,
    RESERVE_NON_SIGNALE,
    // Réserve de volume : expressément demandée (§3.4).
    "Le devis est établi sur le volume annoncé lors de la découverte. Tout "
    + "volume supplémentaire constaté sur place sera signalé au client avant "
    + "poursuite de l'intervention et fera l'objet d'un accord écrit préalable.",
    "Les biens à conserver doivent être identifiés par le client avant le début "
    + "de l'intervention. Aucun bien n'est évacué sans autorisation.",
    "Les déchets dangereux, l'amiante et les produits réglementés ne sont pas "
    + "compris dans le présent devis et relèvent de filières spécifiques.",
  ];

  return {
    designation, detail, reserves: reserves.join("\n\n"),
    sources: [...new Set(sources)], manquant: [...new Set(manquant)],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  DÉMÉNAGEMENT
// ══════════════════════════════════════════════════════════════════════

function demenagement(d: Decouverte): ContenuDevis {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];

  const logement = str(det, "logementDepart");
  const volume = str(det, "volume");
  const villeD = (d.villeDepart ?? str(det, "villeDepart")).trim();
  const villeA = (d.villeArrivee ?? str(det, "villeArrivee")).trim();
  const complet = str(det, "typeDemenagement") !== "partiel";

  if (logement) sources.push("logementDepart"); else manquant.push("type de logement");
  if (volume) sources.push("volume"); else manquant.push("volume estimé");
  if (villeD) sources.push("villeDepart"); else manquant.push("ville de départ");
  if (villeA) sources.push("villeArrivee"); else manquant.push("ville d'arrivée");

  const libelleLog = logement ? labelOf(LOGEMENT_TYPE, logement).toLowerCase() : "";
  const designation = [
    complet ? "DÉMÉNAGEMENT COMPLET" : "DÉMÉNAGEMENT PARTIEL",
    libelleLog ? `D'UN ${libelleLog.toUpperCase()}` : "",
    villeD && villeA ? `DE ${villeD.toUpperCase()} VERS ${villeA.toUpperCase()}` : "",
  ].filter(Boolean).join(" ");

  const taches: string[] = [];
  const emballage = str(det, "emballage");
  if (emballage && emballage !== "aucun") {
    sources.push("emballage");
    taches.push(`${cap(labelOf(EMBALLAGE, emballage))} des biens à transporter.`);
  }
  taches.push("Protection du mobilier durant les opérations de manutention et de transport.");
  if (str(det, "demontage") === "oui") {
    sources.push("demontage");
    taches.push("Démontage du mobilier concerné au départ et remontage à l'arrivée.");
  }
  taches.push("Chargement méthodique du mobilier, des cartons et de l'électroménager.");
  taches.push("Transport sécurisé jusqu'au lieu de destination.");
  taches.push("Déchargement de l'ensemble des biens.");
  taches.push("Mise en place du mobilier et des cartons dans les pièces indiquées par le client.");
  if (str(det, "monteMeubles") === "oui") {
    sources.push("monteMeubles");
    taches.push("Mise en œuvre d'un monte-meubles.");
  }

  const objets = liste(det, "objetsSpecifiques");
  if (objets.length) {
    sources.push("objetsSpecifiques");
    taches.push(`Manutention spécifique : ${objets.map((o) => labelOf(OBJETS_SPECIFIQUES, o).toLowerCase()).join(", ")}.`);
  }

  const contraintes: string[] = [];
  if (volume) contraintes.push(`volume estimé ${labelOf(VOLUME_DEMENAGEMENT, volume) || volume} m³`);
  const eD = num(det, "etagesDepart"), eA = num(det, "etagesArrivee");
  const aD = str(det, "ascenseurDepart"), aA = str(det, "ascenseurArrivee");
  if (eD || aD) { sources.push("etagesDepart"); contraintes.push(`départ ${eD ? `${eD}e étage` : "RDC"}${aD === "non" ? " sans ascenseur" : aD === "oui" ? " avec ascenseur" : ""}`); }
  if (eA || aA) { sources.push("etagesArrivee"); contraintes.push(`arrivée ${eA ? `${eA}e étage` : "RDC"}${aA === "non" ? " sans ascenseur" : aA === "oui" ? " avec ascenseur" : ""}`); }
  const km = num(det, "distanceKm");
  if (km) { sources.push("distanceKm"); contraintes.push(`distance ${km} km`); }

  const detail = [
    "PRESTATION",
    `${complet ? "Déménagement complet" : "Déménagement partiel"}${libelleLog ? ` d'un ${libelleLog}` : ""}`
      + `${villeD && villeA ? ` de ${villeD} vers ${villeA}` : ""}.`,
    "",
    "DÉTAIL DES PRESTATIONS",
    ...taches.map((t) => `- ${t}`),
    ...(contraintes.length ? ["", `Éléments relevés : ${contraintes.join(", ")}.`] : []),
  ].join("\n");

  const reserves = [
    RESERVE_PERIMETRE,
    RESERVE_NON_SIGNALE,
    "Le devis est établi sur la base du volume annoncé, des accès, des étages, "
    + "de la présence ou non d'un ascenseur, des possibilités de stationnement "
    + "et des distances de portage communiqués lors de la découverte. Toute "
    + "différence constatée sur place fera l'objet d'une réévaluation après "
    + "accord du client.",
    "Les objets de très grande valeur, fragiles ou hors normes doivent être "
    + "signalés avant l'intervention afin d'être protégés et assurés en "
    + "conséquence.",
  ];

  return {
    designation, detail, reserves: reserves.join("\n\n"),
    sources: [...new Set(sources)], manquant: [...new Set(manquant)],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  TRANSPORT
// ══════════════════════════════════════════════════════════════════════

function transport(d: Decouverte): ContenuDevis {
  const det = d.details;
  const sources: string[] = [];
  const manquant: string[] = [];

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

  const libelleObjet = typeObjet ? labelOf(TYPE_OBJET, typeObjet).toLowerCase() : "mobilier";
  const designation = [
    "TRANSPORT",
    options.includes("manutention") ? "ET MANUTENTION" : "",
    `DE ${libelleObjet.toUpperCase()}`,
    villeE && villeL ? `DE ${villeE.toUpperCase()} VERS ${villeL.toUpperCase()}` : "",
  ].filter(Boolean).join(" ");

  const taches: string[] = [
    qte
      ? `Enlèvement de ${qte} élément${qte > 1 ? "s" : ""} (${libelleObjet}).`
      : `Enlèvement des éléments désignés (${libelleObjet}).`,
    "Chargement et manutention au lieu de prise en charge.",
  ];
  if (options.includes("protection")) taches.push("Protection et emballage des éléments transportés.");
  if (options.includes("demontage")) taches.push("Démontage des éléments concernés avant chargement.");
  taches.push("Transport sécurisé jusqu'au lieu de livraison.");
  taches.push("Déchargement sur place et dépose à l'emplacement indiqué.");
  if (options.includes("remontage")) taches.push("Remontage des éléments à l'arrivée.");
  if (options.length) sources.push("optionsTransport");

  const contraintes: string[] = [];
  if (vol) contraintes.push(`volume ${vol} m³`);
  if (poids) contraintes.push(`poids estimé ${poids} kg`);
  const km = num(det, "distanceKm");
  if (km) { sources.push("distanceKm"); contraintes.push(`distance ${km} km`); }
  for (const o of options.filter((x) => ["fragile", "lourd", "volumineux"].includes(x))) {
    contraintes.push(labelOf(OPTIONS_TRANSPORT, o).toLowerCase());
  }

  const detail = [
    "PRESTATION",
    `Transport de ${libelleObjet}${villeE && villeL ? ` de ${villeE} vers ${villeL}` : ""}`
      + `${options.includes("manutention") ? ", avec manutention" : ""}.`,
    "",
    "DÉTAIL DES PRESTATIONS",
    ...taches.map((t) => `- ${t}`),
    ...(contraintes.length ? ["", `Éléments relevés : ${contraintes.join(", ")}.`] : []),
  ].join("\n");

  const reserves = [
    RESERVE_PERIMETRE,
    RESERVE_NON_SIGNALE,
    "Le devis est établi sur la base du volume, du poids, des accès et des "
    + "conditions de manutention communiqués lors de la découverte. Toute "
    + "difficulté de manutention ou d'accès non signalée fera l'objet d'une "
    + "réévaluation après accord du client.",
    "Les objets de très grande valeur ou nécessitant une garantie spécifique "
    + "doivent être déclarés avant le transport.",
  ];

  return {
    designation, detail, reserves: reserves.join("\n\n"),
    sources: [...new Set(sources)], manquant: [...new Set(manquant)],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Entrée publique
// ══════════════════════════════════════════════════════════════════════

/**
 * Contenu de devis à partir d'une découverte enregistrée.
 *
 * `null` = activité hors périmètre (§2 : dépannage et travaux exclus). On ne
 * produit rien plutôt qu'un texte inadapté.
 */
export function genererContenuDevis(d: Decouverte): ContenuDevis | null {
  if (!activiteCouverte(d.sector)) return null;
  switch (d.sector) {
    case "debarras": return debarras(d);
    case "demenagement": return demenagement(d);
    case "transport": return transport(d);
    default: return nettoyage(d); // nettoyage, nettoyage_difficile, diogene
  }
}

// ── Garde-fous de rédaction (§3.4) ────────────────────────────────────

/** Expressions proscrites, et ce qu'il faut écrire à la place. */
export const INTERDITS: { motif: RegExp; raison: string }[] = [
  { motif: /remise\s+en\s+(é|e)tat/i, raison: "« remise en état » est proscrit : écrire « nettoyage approfondi » ou « nettoyage complet »" },
  // Aucun prix ne doit apparaître dans le contenu généré.
  { motif: /\d[\d\s.,]*\s*(€|EUR\b|euros?)/i, raison: "aucun prix ne doit figurer dans le contenu généré" },
  { motif: /engagements?\s+de\s+l'entreprise/i, raison: "rubrique « Engagements de l'entreprise » non autorisée" },
  { motif: /objectif\s+final/i, raison: "rubrique « Objectif final » non autorisée" },
  { motif: /conditions\s+de\s+r(è|e)glement/i, raison: "rubrique « Conditions de règlement » non autorisée" },
];

/**
 * Vérifie qu'un contenu respecte les règles de rédaction.
 *
 * Appelé APRÈS la génération : c'est un filet, pas la règle. Les gabarits ne
 * produisent pas ces formulations, mais un commercial peut les saisir à la
 * main dans le champ modifiable, et le devis ne doit pas partir avec.
 */
export function verifierRedaction(c: ContenuDevis): { ok: boolean; alertes: string[] } {
  const texte = `${c.designation}\n${c.detail}\n${c.reserves}`;
  const alertes = INTERDITS.filter((i) => i.motif.test(texte)).map((i) => i.raison);
  return { ok: alertes.length === 0, alertes };
}
