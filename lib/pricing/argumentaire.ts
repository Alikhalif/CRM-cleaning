// Argumentaire commercial de closing — PUR (aucune I/O), importable côté client.
//
// RÈGLE ABSOLUE, posée par le client : AUCUN ARGUMENT INVENTÉ. Chaque ligne
// affichée vient soit d'une ligne de grille réellement retenue par le moteur
// (lib/pricing/grid-compute), soit d'un champ effectivement saisi dans la
// découverte. Quand l'information n'existe pas, la phrase n'est pas produite —
// on ne « remplit » jamais la pop-up avec du générique.
//
// Deux sources, dans cet ordre :
//   1. les lignes CHIFFRÉES, classées par influence réelle sur le tarif ;
//   2. les faits de la découverte qui décrivent le chantier sans être tarifés
//      (encombrement, démontage, objets spécifiques…).
// La clé `cle` sert à ne jamais énoncer deux fois le même élément.
//
// ─────────────────────────────────────────────────────────────────────────
// TEXTES COMMERCIAUX : tout ce que le commercial lit à voix haute est
// regroupé dans ce fichier, en haut, pour être relu et corrigé sans toucher
// au moteur. Les trois réponses aux objections et la phrase de closing par
// défaut sont la copie EXACTE fournie par le client — ne pas les réécrire.
// ─────────────────────────────────────────────────────────────────────────

import {
  ACCES, EMBALLAGE, ENCOMBREMENT, OBJETS_SPECIFIQUES, labelOf,
} from "@/lib/discovery-metier";
import { DELAI_SOUHAITE_LABEL, ETAT_SALETE_LABEL, type DelaiSouhaite, type EtatSalete } from "@/lib/leads";
import { OPTIONS_TRANSPORT, TYPE_OBJET } from "@/lib/discovery-metier";
import {
  ACCES_LABEL, ENCADREMENT_LABEL, FACES_LABEL,
  type Encadrement, type FacesVitres, type ResultatVitrerie,
} from "./vitrerie";
import type { GridInput, GridResultLine } from "./grid-compute";
import { EMBALLAGE_VERS_GRILLE, OBJET_VERS_GRILLE } from "./grid-discovery";
import type { GridSection } from "./grid-types";

// ── Familles de prestation ──────────────────────────────────────────────
// Le discours s'adapte à la famille, pas à chacune des huit activités : un
// nettoyage difficile et un nettoyage classique se défendent de la même façon.
// Le transport a sa propre famille depuis le 2026-10-21 : il se défend sur
// l'objet confié et le trajet, pas sur un volume de logement.
export type Famille =
  | "nettoyage" | "desinfection" | "debarras" | "demenagement" | "transport"
  | "urgence" | "travaux";

export function familleOf(sector: string): Famille {
  switch (sector) {
    case "demenagement": return "demenagement";
    case "transport": return "transport";
    case "debarras": return "debarras";
    case "diogene": return "desinfection";
    case "urgence": return "urgence";
    case "enr":
    case "renovation": return "travaux";
    default: return "nettoyage"; // nettoyage, nettoyage_difficile
  }
}

const PRESTATION: Record<Famille, string> = {
  nettoyage: "une intervention",
  desinfection: "une intervention de décontamination",
  debarras: "un débarras",
  demenagement: "un déménagement",
  transport: "un transport",
  urgence: "un dépannage",
  travaux: "une intervention",
};

// Ce que mesure la quantité, par famille. Même règle que buildGridInput().
const QUANTITE: Record<Famille, { libelle: string; unite: string; detail: string }> = {
  nettoyage: { libelle: "Surface", unite: "m²", detail: "Surface totale à traiter." },
  desinfection: { libelle: "Surface", unite: "m²", detail: "Surface à traiter et à décontaminer." },
  debarras: { libelle: "Volume", unite: "m³", detail: "Volume à évacuer et à traiter." },
  demenagement: { libelle: "Volume", unite: "m³", detail: "Volume à charger, transporter et livrer." },
  transport: { libelle: "Volume", unite: "m³", detail: "Encombrement des objets à charger, transporter et livrer." },
  urgence: { libelle: "Surface", unite: "m²", detail: "Étendue de la zone à traiter." },
  travaux: { libelle: "Surface", unite: "m²", detail: "Surface concernée par les travaux." },
};

// Ce qu'explique chaque section de grille. Formulations neutres : elles
// reformulent un fait, elles ne promettent rien.
const EXPLICATION: Record<GridSection, string> = {
  volume: "", // remplacé par QUANTITE[famille].detail
  base: "", // idem : le socle est décrit par la quantité de la famille
  minimums: "Forfait minimum de l'intervention.",
  coefficients: "Niveau de difficulté constaté.",
  ratios: "Volume estimé à partir de la surface et de l'encombrement.",
  matrice_m3: "Volume à transporter et distance à parcourir.",
  kilometrique: "Trajet et temps de route pris en compte.",
  pieces: "Nombre de pièces à traiter.",
  postes: "Prestation comprise dans l'intervention.",
  exterieur: "Surface extérieure, chiffrée séparément de l'intérieur.",
  exterieur_options: "Revêtement et état de l'espace extérieur.",
  complements: "Prestation complémentaire ajoutée à l'intervention.",
  distance: "Trajet et temps de route pris en compte.",
  floors: "Portage à la main, sans ascenseur.",
  access: "Contraintes d'accès sur place.",
  heavy: "Objet lourd ou fragile demandant un matériel et une manutention spécifiques.",
  demontage: "Démontage et remontage réalisés sur place.",
  emballage: "Fourniture, emballage et protection du mobilier.",
  materiel: "Matériel et moyens mobilisés pour l'intervention.",
  majorations: "Contrainte de délai sur l'organisation de l'intervention.",
  vitrerie: "Nombre et type de surfaces vitrées, faces à nettoyer et accès.",
};

// ── Types ───────────────────────────────────────────────────────────────
export type PitchArg = { cle: string; titre: string; detail: string };
export type Objection = { titre: string; reponse: string; precision: string | null };

/** Bloc « Nettoyage des vitres » du pop-up existant (§14). */
export type PitchVitrerie = {
  faces: string;
  vitrages: string[];
  encadrements: string;
  accessibilite: string;
  majoration: string;
  argument: string;
  /** Validation tarifaire ou technique à demander. */
  alertes: string[];
};

export type Pitch = {
  /** 3 à 5 arguments essentiels, les plus influents d'abord. */
  arguments: PitchArg[];
  /** Les autres éléments retenus, regroupés — jamais oubliés, jamais en vrac. */
  autres: string[];
  annonce: string;
  objections: Objection[];
  closing: string;
  /** Réserves du moteur (approximations, éléments non captés). */
  reserves: string[];
  /** Présent uniquement si des vitrages ont été saisis. */
  vitrerie: PitchVitrerie | null;
};

export type PitchContext = {
  sector: string;
  /** Supplément vitrerie calculé par le moteur, s'il y en a un. */
  vitrerie?: ResultatVitrerie | null;
  conseille: number;
  min: number;
  max: number;
  vatRate: number | null;
  lines: GridResultLine[];
  majorations: { key: string; label: string; minPct: number; maxPct: number }[];
  input: GridInput;
  details: Record<string, unknown>;
  etatSalete: string | null;
  delaiSouhaite: string | null;
  reactionPrix: string | null;
  wantedDate: string | null;
  isUrgent: boolean;
  reserves: string[];
};

const MAX_ARGS = 5;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nombre = (n: number): string => n.toLocaleString("fr-FR");

/** « 780 € HT » ou « 780 € TTC » — jamais de taux supposé. */
export function montantLabel(n: number, vatRate: number | null): string {
  return `${nombre(n)} €${vatRate != null ? " TTC" : " HT"}`;
}

/** « a, b et c » */
function enumere(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

const minusculeInitiale = (s: string): string => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

const dateFr = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// ── Faits de la découverte non tarifés ──────────────────────────────────
// Ils décrivent le chantier et justifient le NIVEAU du prix dans la
// fourchette. Ils n'apparaissent que s'ils ont été réellement saisis.
// `etagesChiffres` : les côtés (départ / arrivée) déjà facturés par la grille.
// Sans cette information, le portage apparaîtrait deux fois — une fois comme
// ligne tarifée, une fois comme fait de découverte.
function faitsDecouverte(c: PitchContext, f: Famille, etagesChiffres: Set<string>): PitchArg[] {
  const d = c.details ?? {};
  const out: PitchArg[] = [];

  // Encrassement (nettoyage, désinfection, urgence, travaux).
  const salete = c.etatSalete ?? "";
  if (salete === "important" || salete === "tres_important" || salete === "extreme") {
    out.push({
      cle: "salete",
      titre: `Encrassement ${ETAT_SALETE_LABEL[salete as EtatSalete].toLowerCase()}`,
      detail: "Traitement plus approfondi et produits adaptés.",
    });
  }

  if (f === "debarras" || f === "desinfection") {
    const enc = str(d.encombrement);
    if (enc === "important" || enc === "tres_important" || enc === "extreme") {
      out.push({
        cle: "encombrement",
        titre: `Encombrement ${labelOf(ENCOMBREMENT, enc).toLowerCase()}`,
        detail: "Densité d'objets à manipuler, à charger et à évacuer.",
      });
    }
    if (str(d.triDemande) === "oui") {
      out.push({
        cle: "tri",
        titre: "Tri sur place demandé",
        detail: "Séparation de ce qui est conservé, donné et évacué.",
      });
    }
    if (str(d.valorisation) === "oui") {
      out.push({
        cle: "valorisation",
        titre: "Valorisation des objets récupérables",
        detail: "Reprise et revalorisation prises en compte dans l'estimation.",
      });
    }
    const acces = str(d.acces);
    if (acces === "escaliers" || acces === "plusieurs_etages" || acces === "cour" || acces === "stationnement_difficile") {
      out.push({
        cle: `acces-${acces}`,
        titre: labelOf(ACCES, acces),
        detail: EXPLICATION.access,
      });
    }
  }

  if (f === "transport") {
    const type = str(d.typeObjet);
    if (type) {
      out.push({
        cle: `objet-${type}`,
        titre: labelOf(TYPE_OBJET, type),
        detail: "Nature de l'objet confié, qui détermine le matériel et la manutention.",
      });
    }
    const poids = Number(d.poidsKg);
    if (Number.isFinite(poids) && poids > 0) {
      out.push({
        cle: "poids",
        titre: `${poids} kg à charger et à livrer`,
        detail: "Poids total, qui détermine le véhicule et la taille de l'équipage.",
      });
    }
    for (const [n, ou] of [[c.input.floorsDepart, "enlèvement"], [c.input.floorsArrivee, "livraison"]] as const) {
      if (n > 0 && !etagesChiffres.has(ou)) {
        out.push({
          cle: `etages-${ou}`,
          titre: `${n}${n === 1 ? "er" : "e"} étage sans ascenseur (${ou})`,
          detail: EXPLICATION.floors,
        });
      }
    }
    const coches = Array.isArray(d.optionsTransport) ? d.optionsTransport.map(String) : [];
    for (const o of coches) {
      if (o === "urgence") continue; // porté par la majoration de délai
      out.push({
        // La clé est celle de la GRILLE : si l'option est déjà chiffrée, le
        // fait est écarté au lieu d'être répété sous un autre libellé.
        cle: o,
        titre: labelOf(OPTIONS_TRANSPORT, o),
        detail: EXPLICATION.heavy,
      });
    }
  }

  if (f === "demenagement") {
    // Étages sans ascenseur : si la grille ne les tarife pas, le fait reste
    // vrai et doit être défendu.
    for (const [n, ou] of [[c.input.floorsDepart, "départ"], [c.input.floorsArrivee, "arrivée"]] as const) {
      if (n > 0 && !etagesChiffres.has(ou)) {
        out.push({
          cle: `etages-${ou}`,
          titre: `${n}${n === 1 ? "er" : "e"} étage sans ascenseur (${ou})`,
          detail: EXPLICATION.floors,
        });
      }
    }
    if (str(d.demontage) === "oui") {
      out.push({ cle: "demontage", titre: "Démontage et remontage du mobilier", detail: EXPLICATION.demontage });
    }
    const emb = str(d.emballage);
    if (EMBALLAGE_VERS_GRILLE[emb]) {
      out.push({
        // La clé est celle de la GRILLE : si l'emballage est déjà facturé, le
        // fait est écarté au lieu d'être répété sous un autre libellé.
        cle: EMBALLAGE_VERS_GRILLE[emb],
        titre: `Emballage ${labelOf(EMBALLAGE, emb).toLowerCase()}`,
        detail: EXPLICATION.emballage,
      });
    }
    if (str(d.monteMeubles) === "oui") {
      out.push({
        cle: "monte_meubles",
        titre: "Monte-meubles nécessaire",
        detail: "Matériel spécifique et réservation de l'emplacement.",
      });
    }
    const objets = Array.isArray(d.objetsSpecifiques) ? d.objetsSpecifiques.map(String) : [];
    for (const o of objets) {
      if (o === "autres") continue; // nature inconnue : on n'en fait pas un argument
      out.push({
        cle: OBJET_VERS_GRILLE[o] ?? `objet-${o}`,
        titre: labelOf(OBJETS_SPECIFIQUES, o),
        detail: EXPLICATION.heavy,
      });
    }
  }

  // Délai contraint. La clé reprend celle de la majoration de grille pour ne
  // pas énoncer deux fois l'urgence quand elle est déjà facturée.
  const delai = c.delaiSouhaite ?? "";
  if (c.isUrgent || delai === "aujourdhui" || delai === "24h" || delai === "48h") {
    out.push({
      cle: "maj-urgent_48h",
      titre: delai ? `Intervention ${DELAI_SOUHAITE_LABEL[delai as DelaiSouhaite].toLowerCase()}` : "Intervention urgente",
      detail: "Mobilisation d'une équipe en priorité.",
    });
  }

  return out;
}

// ── Titre d'une ligne chiffrée ──────────────────────────────────────────
// Pour le socle (volume/surface) et la distance, on préfère la valeur SAISIE
// au libellé de la tranche : « Surface : 95 m² » parle au client, « 80 à
// 120 m² » parle à la grille.
function titreLigne(l: GridResultLine, c: PitchContext, f: Famille): string {
  if ((l.section === "volume" || l.section === "base" || l.section === "matrice_m3") && c.input.quantity != null) {
    const q = QUANTITE[f];
    return `${q.libelle} : ${nombre(Math.round(c.input.quantity))} ${q.unite}`;
  }
  if (l.section === "distance" && c.input.distanceKm != null) {
    return `Distance : ${nombre(Math.round(c.input.distanceKm))} km`;
  }
  // « 25 à 50 m² » ne dit pas DE QUOI on parle : le commercial doit pouvoir
  // annoncer la terrasse sans hésiter.
  if (l.section === "exterieur" && c.input.exteriorQuantity != null) {
    return `Surface extérieure : ${nombre(Math.round(c.input.exteriorQuantity))} m²`;
  }
  return l.label;
}

// ── Construction de l'argumentaire ──────────────────────────────────────
/**
 * Bloc vitrerie de l'argumentaire.
 *
 * Il ne reprend QUE ce qui a été saisi : pas de ligne « Encadrements : non
 * renseigné » qui n'apprendrait rien au client et affaiblirait l'annonce.
 */
function pitchVitrerie(c: PitchContext): PitchVitrerie | null {
  const v = c.vitrerie;
  if (!v) return null;
  const d = c.details ?? {};
  const faces = (str(d.vitrerieFaces) || "interieur") as FacesVitres;
  const cadre = str(d.vitrerieEncadrement) as Encadrement;
  const acces = str(d.vitrerieAcces) === "vitrerie_acces_difficile" ? "difficile" : "classique";

  return {
    faces: FACES_LABEL[faces] ?? FACES_LABEL.interieur,
    vitrages: v.detail.map((x) => `${x.quantite} ${x.libelle.toLowerCase()}`),
    encadrements: cadre && ENCADREMENT_LABEL[cadre] ? ENCADREMENT_LABEL[cadre] : "Non renseigné",
    accessibilite: ACCES_LABEL[acces],
    majoration: `+${Math.round(v.pct)} %`,
    argument:
      "Le tarif comprend également le nettoyage des vitrages sur leurs faces "
      + (faces === "les_deux" ? "intérieures et extérieures" : FACES_LABEL[faces].toLowerCase())
      + ", ainsi que les encadrements accessibles. Le supplément tient compte du "
      + "nombre de surfaces vitrées, de leurs dimensions et du temps de travail "
      + "supplémentaire nécessaire.",
    alertes: v.alertes,
  };
}

export function buildPitch(c: PitchContext): Pitch {
  const f = familleOf(c.sector);
  const prix = montantLabel(c.conseille, c.vatRate);

  // 1. Éléments chiffrés, le plus influent d'abord : c'est l'ordre dans lequel
  //    le commercial doit défendre le tarif. Une majoration se compare aux
  //    lignes par ce qu'elle PÈSE en euros, pas par son pourcentage : +10 % sur
  //    un gros sous-total vaut plus qu'une petite ligne fixe.
  const sousTotalMin = c.lines.reduce((s, l) => s + l.min, 0);
  const sousTotalMax = c.lines.reduce((s, l) => s + l.max, 0);
  const pesees: { poids: number; arg: PitchArg }[] = [
    ...c.lines.map((l) => ({
      poids: l.min + l.max,
      arg: {
        cle: l.key,
        titre: titreLigne(l, c, f),
        detail: l.section === "volume" || l.section === "base"
      ? QUANTITE[f].detail
      : EXPLICATION[l.section],
      },
    })),
    ...c.majorations.map((m) => ({
      poids: (sousTotalMin * m.minPct + sousTotalMax * m.maxPct) / 100,
      arg: { cle: `maj-${m.key}`, titre: m.label, detail: EXPLICATION.majorations },
    })),
  ];
  // Le SOCLE passe devant, toujours. C'est la surface (ou le volume) que le
  // client a en tête, et c'est par là qu'on annonce un prix — une poignée de
  // petites options cumulées pourraient autrement la reléguer en fin de liste.
  const estSocle = (a: PitchArg) =>
    c.lines.some((l) => (l.section === "volume" || l.section === "base" || l.section === "matrice_m3") && l.key === a.cle);
  const args: PitchArg[] = pesees
    .sort((a, b) => b.poids - a.poids)
    .map((p) => p.arg)
    .sort((a, b) => Number(estSocle(b)) - Number(estSocle(a)));

  // 2. Faits de découverte, sans jamais répéter un élément déjà chiffré.
  const vus = new Set(args.map((a) => a.cle));
  const etagesChiffres = new Set(
    c.lines.filter((l) => l.section === "floors").map((l) => l.key.slice(l.key.lastIndexOf("-") + 1)),
  );
  for (const fait of faitsDecouverte(c, f, etagesChiffres)) {
    if (vus.has(fait.cle)) continue;
    vus.add(fait.cle);
    args.push(fait);
  }

  const principaux = args.slice(0, MAX_ARGS);
  const autres = args.slice(MAX_ARGS).map((a) => a.titre);

  // ── Comment annoncer le prix ──────────────────────────────────────────
  // Construction en tiret long : elle évite tout accord hasardeux et se lit
  // naturellement à voix haute. La seconde phrase est celle du client.
  const troisPremiers = principaux.slice(0, 3).map((a) => minusculeInitiale(a.titre));
  const annonce = troisPremiers.length
    ? `« Compte tenu des éléments que nous avons vus ensemble — ${enumere(troisPremiers)} —, je vous recommande ${PRESTATION[f]} à ${prix}. Ce montant tient compte des moyens nécessaires pour réaliser l'ensemble des prestations prévues. »`
    : `« Pour ${PRESTATION[f]} telle que nous venons de la définir ensemble, je vous recommande un montant de ${prix}. Ce montant tient compte des moyens nécessaires pour réaliser l'ensemble des prestations prévues. »`;

  // ── Objections ────────────────────────────────────────────────────────
  // Réponses de base : copie exacte du client. La « précision » est la seule
  // partie variable, et elle ne s'appuie que sur des éléments réels.
  const contrainte = principaux.find((a) =>
    a.cle.startsWith("etages-") || a.cle.startsWith("acces-") || a.cle.startsWith("objet-") ||
    a.cle.startsWith("maj-") || a.cle === "salete" || a.cle === "encombrement" || a.cle === "monte_meubles",
  );
  const deuxPremiers = principaux.slice(0, 2).map((a) => minusculeInitiale(a.titre));

  const objections: Objection[] = [
    {
      titre: "« C'est trop cher »",
      reponse:
        "Je comprends. Le tarif tient compte des contraintes spécifiques de votre intervention et de toutes les prestations incluses. L'objectif est de vous proposer un prix cohérent, sans sous-estimer les moyens nécessaires.",
      // Tournure en deux-points : elle accueille n'importe quel libellé de
      // grille sans faute d'accord ni article manquant.
      precision: contrainte
        ? `Dans votre cas, ce qui pèse le plus : ${minusculeInitiale(contrainte.titre)}. ${contrainte.detail}`
        : null,
    },
    {
      titre: "« J'ai un devis moins cher »",
      reponse:
        "Bien entendu, mais il est important de comparer les prestations réellement incluses. Notre estimation prend en compte tous les éléments que nous avons identifiés ensemble.",
      precision: deuxPremiers.length
        ? `Ici, l'estimation comprend déjà : ${enumere(deuxPremiers)}.`
        : null,
    },
    {
      titre: "« Je vais réfléchir »",
      reponse:
        "Aucun problème. Est-ce que votre hésitation concerne le tarif ou un autre point ? Je peux regarder avec vous ce qui pourrait être adapté.",
      precision: c.wantedDate
        ? `Vous souhaitiez intervenir le ${dateFr(c.wantedDate)} : je peux vérifier nos disponibilités dès maintenant.`
        : null,
    },
  ];

  // ── Closing ───────────────────────────────────────────────────────────
  // Une seule phrase, choisie sur ce que la découverte dit VRAIMENT du client.
  // « Client souhaitant comparer les offres » n'a pas de champ dans la
  // découverte : aucune variante n'est produite pour ce cas.
  const urgent = c.isUrgent || ["aujourdhui", "24h", "48h"].includes(c.delaiSouhaite ?? "");
  let closing =
    "« Si cette proposition vous convient, je peux vous envoyer immédiatement le devis pour validation afin que nous puissions organiser votre intervention. »";
  if (c.reactionPrix === "pas_ok") {
    closing =
      "« Je vous envoie le devis détaillé : vous verrez précisément ce qui est inclus, et nous pourrons en rediscuter sur une base claire. »";
  } else if (c.reactionPrix === "hesitant") {
    closing =
      "« Je vous envoie le devis pour que vous ayez tout le détail sous les yeux. Rien n'est engagé tant que vous ne l'avez pas signé. »";
  } else if (urgent) {
    closing =
      "« Vous avez besoin d'une intervention rapide : avec votre accord, je lance le devis maintenant et nous bloquons la date. »";
  } else if (c.wantedDate) {
    closing = `« Vous souhaitez une intervention le ${dateFr(c.wantedDate)} : je vous envoie le devis maintenant pour que nous puissions réserver ce créneau. »`;
  }

  return {
    arguments: principaux, autres, annonce, objections, closing,
    reserves: c.reserves,
    vitrerie: pitchVitrerie(c),
  };
}
