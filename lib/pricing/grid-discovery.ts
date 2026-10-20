// Traduit la découverte commerciale en entrée du moteur de grille. PUR.
//
// Le commercial ne ressaisit rien : tout vient des champs qu'il remplit déjà.
//
// ⚠️ La grille est plus FINE que la découverte. Elle distingue « lit double »
// de « grande armoire » là où la découverte ne demande qu'un oui/non au
// démontage. On mappe ce qui existe et on remonte le reste dans `nonCaptes` :
// l'interface le dit au commercial au lieu de laisser croire que tout a été
// pris en compte.

import { estFamilleNettoyage } from "@/lib/discovery-nettoyage";
import type { GridInput } from "./grid-compute";

// Les volumes sont des libellés, pas des nombres : « 20 » (déménagement) ou
// « 10-20 » / « <5 » / « >100 » (débarras). Une tranche donne son MILIEU —
// annoncer le haut gonflerait le prix, annoncer le bas le sous-estimerait.
export function parseVolume(raw: unknown): { value: number | null; approx: boolean } {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return { value: null, approx: false };
  if (v.startsWith("<")) {
    const n = Number(v.slice(1));
    return Number.isFinite(n) ? { value: n / 2, approx: true } : { value: null, approx: false };
  }
  if (v.startsWith(">")) {
    const n = Number(v.slice(1));
    // Au-delà de la dernière tranche on ne sait pas : on retient le seuil et on
    // le signale, plutôt que d'extrapoler un volume inventé.
    return Number.isFinite(n) ? { value: n, approx: true } : { value: null, approx: false };
  }
  if (v.includes("-")) {
    const [a, b] = v.split("-").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) return { value: (a + b) / 2, approx: true };
  }
  const n = Number(v);
  return Number.isFinite(n) ? { value: n, approx: false } : { value: null, approx: false };
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Objets spécifiques de la découverte → lignes « objets lourds » de la grille.
// Les clés absentes de la grille sont simplement ignorées par le moteur.
//
// EXPORTÉ : l'argumentaire commercial s'en sert pour reconnaître qu'un objet
// de la découverte est DÉJÀ chiffré sous un autre nom, et ne pas l'énoncer
// deux fois. Toute correspondance doit vivre ici, et nulle part ailleurs.
export const OBJET_VERS_GRILLE: Record<string, string> = {
  piano: "piano_droit",
  coffre_fort: "coffre_fort",
  billard: "mobilier_volumineux",
  electromenager_lourd: "frigo_americain",
  objets_fragiles: "mobilier_ancien",
  oeuvres_art: "oeuvre_art",
};

// Même rôle que OBJET_VERS_GRILLE, pour le niveau d'emballage.
export const EMBALLAGE_VERS_GRILLE: Record<string, string> = {
  partiel: "fragiles",
  complet: "logement_complet",
};

const DELAI_URGENT = new Set(["aujourdhui", "24h", "48h"]);

export type GridDiscovery = {
  sector: string;
  surfaceM2: number | null;
  details: Record<string, unknown>;
  delaiSouhaite: string | null;
  isUrgent: boolean;
  // État général du logement (colonne `etat_salete`) : la famille nettoyage
  // s'en sert comme majoration.
  etatSalete?: string | null;
};

// ── Famille nettoyage : découverte → clés de grille ─────────────────────
//
// La plupart des valeurs stockées SONT déjà la clé de grille (voir
// lib/discovery-nettoyage.ts). Seuls les sous-qualificatifs — surface
// concernée, état, origine — sont préfixés ici : « partielle » tout seul ne
// désigne rien dans un barème.
//
// Les valeurs NEUTRES ne produisent aucune ligne : répondre « Non » ou
// « Normale » n'est pas une prestation.
const NEUTRES = new Set(["", "non", "normale", "aucune", "vide", "facile", "0"]);

function majorationPrefixee(majorations: string[], prefixe: string, valeur: unknown) {
  const k = typeof valeur === "string" ? valeur.trim() : "";
  if (k && k !== "vide") majorations.push(`${prefixe}_${k}`);
}

function nettoyageVersGrille(
  det: Record<string, unknown>,
  options: string[],
  majorations: string[],
): { pieces: number | null; exteriorQuantity: number | null; etage: number } {
  const pousser = (v: unknown) => {
    const k = str(v);
    if (k && !NEUTRES.has(k)) options.push(k);
  };
  const prefixe = (p: string, v: unknown) => {
    const k = str(v);
    if (k && !NEUTRES.has(k)) options.push(`${p}_${k}`);
  };
  const liste = (k: string): string[] => (Array.isArray(det[k]) ? (det[k] as unknown[]).map(String) : []);

  // Le type de prestation identifie la famille tarifaire.
  prefixe("type", det.typeNettoyage);

  // Vitrerie : quantité et accessibilité sont deux lignes distinctes.
  if (str(det.vitrerie) === "oui") {
    pousser(det.vitrerieQuantite);
    pousser(det.vitrerieAcces);
  }

  for (const sol of liste("sols")) pousser(sol);

  // Murs : le lessivage est une prestation complémentaire, jamais incluse
  // d'office (consigne client).
  pousser(det.murs);
  if (str(det.murs) === "murs_lessivage") prefixe("murs_surface", det.mursSurface);

  if (str(det.plafonds) === "oui") {
    pousser(det.plafondsType);
    prefixe("plafonds_surface", det.plafondsSurface);
    prefixe("plafonds_etat", det.plafondsEtat);
  }

  if (str(det.cuisineAmenagee) === "oui") {
    options.push("cuisine_amenagee");
    if (str(det.cuisineEquipee) === "oui") options.push("cuisine_equipee");
    if (str(det.cuisineInterieur) === "oui") options.push("cuisine_interieur");
  }
  if (str(det.dressings) === "oui") {
    options.push("dressings");
    if (str(det.dressingsInterieur) === "oui") options.push("dressings_interieur");
  }
  prefixe("sdb", det.nbSdb);
  prefixe("wc", det.nbWc);

  // ── Extérieur : surface à part, revêtement et état en options ─────────
  let exteriorQuantity: number | null = null;
  if (str(det.exterieur) === "oui") {
    const m2 = num(det.exterieurSurfaceM2);
    exteriorQuantity = m2 > 0 ? m2 : null;
    for (const t of liste("exterieurTypes")) pousser(t);
    for (const r of liste("exterieurRevetements")) pousser(r);
    pousser(det.exterieurEtat);
  }

  // ── Prestations complémentaires, avec leurs précisions ───────────────
  const comps = new Set(liste("complements"));
  if (comps.has("desinfection")) {
    options.push("desinfection");
    prefixe("desinfection_surface", det.desinfectionSurface);
  }
  if (comps.has("decontamination")) {
    options.push("decontamination");
    prefixe("decontamination", det.decontaminationOrigine);
    prefixe("decontamination_surface", det.decontaminationSurface);
  }
  if (comps.has("desodorisation")) {
    options.push("desodorisation");
    prefixe("desodorisation", det.desodorisationOrigine);
  }
  if (comps.has("debarras")) {
    options.push("debarras");
    prefixe("debarras_vol", det.debarrasVolume);
  }

  // Occupation et urgence : des majorations, pas des postes.
  majorationPrefixee(majorations, "occupation", det.occupation);
  if (str(det.urgence) === "urgente") majorations.push("urgent_48h");

  // ── Extension Diogène ────────────────────────────────────────────────
  if (det.diogene === true) {
    pousser(det.dioEncombrement);
    for (const x of liste("dioDechets")) pousser(x);
    prefixe("dio_vol", det.dioVolume);
    pousser(det.dioAccessibilite);
    if (str(det.dioNuisibles) === "oui") {
      options.push("dio_nuisibles");
      for (const x of liste("dioNuisiblesTypes")) pousser(x);
    }
    pousser(det.dioOdeurs);
    // Les prestations Diogène partagent les clés des compléments : le Set du
    // moteur garantit qu'une prestation cochée des deux côtés n'est comptée
    // qu'une seule fois.
    for (const x of liste("dioPrestations")) pousser(x);
  }

  const pieces = num(det.nbPieces) > 0 ? num(det.nbPieces) : null;
  const etage = str(det.etage) === "4plus" ? 4 : num(det.etage);
  return { pieces, exteriorQuantity, etage };
}

export function buildGridInput(d: GridDiscovery): { input: GridInput; approx: boolean; nonCaptes: string[] } {
  const det = d.details ?? {};
  const options: string[] = [];
  const majorations: string[] = [];
  const nonCaptes: string[] = [];
  let approx = false;

  // ── Taille : m³ pour déménagement / débarras, m² pour le nettoyage ────
  // Diogène appartient à la famille nettoyage : sa découverte saisit une
  // SURFACE ; le volume à évacuer est une option à part (dio_vol_*).
  let quantity: number | null = null;
  if (d.sector === "demenagement" || d.sector === "debarras") {
    const v = parseVolume(det.volume);
    quantity = v.value;
    approx = v.approx;
  } else {
    quantity = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : null;
  }

  const distRaw = det.distanceKm;
  const distanceKm =
    distRaw != null && distRaw !== "" && Number.isFinite(Number(distRaw)) ? Number(distRaw) : null;

  // ── Étages : seuls ceux SANS ascenseur comptent ──────────────────────
  let floorsDepart = 0;
  let floorsArrivee = 0;
  let pieces: number | null = null;
  let exteriorQuantity: number | null = null;
  if (d.sector === "demenagement") {
    if (str(det.ascenseurDepart) === "non") floorsDepart = num(det.etagesDepart);
    if (str(det.ascenseurArrivee) === "non") floorsArrivee = num(det.etagesArrivee);

    const emballage = EMBALLAGE_VERS_GRILLE[str(det.emballage)];
    if (emballage) options.push(emballage);

    if (str(det.monteMeubles) === "oui") options.push("monte_meubles");

    // Etages sans ascenseur : la bibliotheque demenagement les facture au
    // forfait par etage (75 EUR). Sans cette cle, ils n'etaient jamais comptes.
    if (floorsDepart + floorsArrivee > 0) options.push("etage_sans_ascenseur");

    // La découverte dit « démontage : oui » sans dire de QUOI. La grille
    // tarifie au meuble : on ne devine pas, on le signale.
    if (str(det.demontage) === "oui") {
      nonCaptes.push("le détail du démontage (quels meubles)");
    }

    const objets = Array.isArray(det.objetsSpecifiques) ? det.objetsSpecifiques.map(String) : [];
    for (const o of objets) {
      const k = OBJET_VERS_GRILLE[o];
      if (k) options.push(k);
      else if (o === "autres") nonCaptes.push("la nature des « autres » objets spécifiques");
    }

    // La découverte ne capte pas la distance de portage ni les contraintes
    // d'accès détaillées : ce sont des lignes de grille sans source.
    nonCaptes.push("les difficultés d'accès (portage, stationnement, passage)");
    // Ni la formule (économique / standard / confort) : le moteur retient
    // « standard » et le signale, plutôt que de supposer un choix client.
    nonCaptes.push("la formule de déménagement (économique / standard / confort)");
  } else if (estFamilleNettoyage(d.sector)) {
    const net = nettoyageVersGrille(det, options, majorations);
    pieces = net.pieces;
    exteriorQuantity = net.exteriorQuantity;
    // Seuls les étages SANS ascenseur comptent, ici comme ailleurs.
    if (str(det.ascenseur) === "non") floorsDepart = net.etage;
    majorationPrefixee(majorations, "etat", d.etatSalete);
  } else {
    const acces = str(det.acces);
    if (acces === "escaliers") floorsDepart = 1;
    if (acces === "plusieurs_etages") floorsDepart = 2;
    if (acces === "stationnement_difficile") options.push("sans_stationnement");

    if (d.sector === "debarras") {
      // Niveau d'encombrement → type de débarras de la bibliothèque. La
      // découverte en propose cinq, le barème sept : on n'utilise que ceux
      // qui ont un tarif publié, sans jamais en extrapoler un.
      const parEncombrement: Record<string, string> = {
        faible: "deb_leger",
        moyen: "deb_classique",
        important: "deb_encombre",
        tres_important: "deb_tres_encombre",
        extreme: "deb_insalubre",
      };
      const typeDeb = parEncombrement[str(det.encombrement)];
      if (typeDeb) options.push(typeDeb);

      // Type de bien → forfait minimum applicable.
      const bien = str(det.typeBien);
      if (bien) options.push(`typeBien_${bien}`);

      // Ratio d'estimation du volume, pour la grille (§7.3).
      const ratio: Record<string, string> = {
        faible: "enc_faible",
        moyen: "enc_modere",
        important: "enc_important",
        tres_important: "enc_tres_important",
        extreme: "enc_extreme",
      };
      const r = ratio[str(det.encombrement)];
      if (r) options.push(r);

      if (acces === "stationnement_difficile") options.push("stationnement_difficile");
      if (str(det.triDemande) === "oui") options.push("tri_complexe");

      // Étages sans ascenseur : le barème débarras les exprime en pourcentage
      // (+6 % par étage jusqu'à +24 %), pas en montant. On coche la tranche
      // correspondante plutôt que de la calculer ici.
      const parEtage = ["", "etage_1", "etage_2", "etage_3"];
      if (floorsDepart > 0) {
        majorations.push(floorsDepart >= 4 ? "etage_4plus" : parEtage[floorsDepart]);
      }
    }
  }

  if (d.isUrgent || DELAI_URGENT.has(d.delaiSouhaite ?? "")) majorations.push("urgent_48h");

  // Quantités nommées : une option au m² ne porte pas forcément sur la
  // surface du logement (terrasse, surface à désinfecter…).
  const quantites: Record<string, number> = {};
  // En débarras, `quantity` est un VOLUME : la surface du logement est une
  // donnée distincte, qui sert à estimer ce volume quand il manque.
  if (d.surfaceM2 != null && d.surfaceM2 > 0) quantites.surface = d.surfaceM2;
  if (quantity != null && quantity > 0) quantites.volume = quantity;
  if (exteriorQuantity != null && exteriorQuantity > 0) quantites.exterieur = exteriorQuantity;
  // Désinfection partielle : sa propre surface si elle est renseignée, sinon
  // la surface du logement.
  const desinfM2 = num(det.desinfectionM2);
  if (desinfM2 > 0) quantites.desinfection = desinfM2;
  else if (quantity != null && quantity > 0) quantites.desinfection = quantity;

  return {
    input: {
      quantity, pieces, exteriorQuantity, distanceKm,
      floorsDepart, floorsArrivee, options, majorations, quantites,
    },
    approx,
    nonCaptes,
  };
}
