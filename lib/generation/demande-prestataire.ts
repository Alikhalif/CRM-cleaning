// E-mail de recherche de prestataire — PUR, aucune I/O.
//
// Déclenché après signature du devis (§4.1). Il ne ressemble pas à un devis :
// c'est une demande opérationnelle, pour que le prestataire chiffre.
//
// LA RÈGLE ABSOLUE (§5) : seuls le CODE POSTAL et la VILLE. Jamais la rue, le
// bâtiment, l'appartement, le nom du client, son téléphone, son courriel.
//
// Elle est tenue DEUX FOIS, et c'est volontaire :
//
//   1. EN AMONT — `contexteRedige()` ne laisse entrer dans le générateur que
//      le code postal et la ville. Les champs confidentiels n'atteignent
//      jamais le texte, faute d'y être.
//   2. EN AVAL — `verifierFuites()` reprend les valeurs confidentielles et
//      vérifie qu'aucune n'apparaît dans le texte final, y compris après une
//      modification à la main par la planificatrice.
//
// Le §12 demande exactement cela : filtrer avant, contrôler avant l'envoi.
// Un seul des deux ne suffirait pas — le premier ne couvre pas la saisie
// libre, le second seul laisserait la fuite se produire avant d'être vue.

import { labelOf } from "@/lib/discovery-metier";
import { TYPE_OBJET } from "@/lib/discovery-metier";
import { ETAT_GENERAL, VITRERIE_FACES } from "@/lib/discovery-nettoyage";
import { activiteCouverte } from "./devis-contenu";

// ── Entrées ───────────────────────────────────────────────────────────

/** Ligne du devis SIGNÉ. C'est elle qui définit le périmètre accepté (§4.1). */
export type LigneAcceptee = {
  label: string;
  quantite?: number | null;
  unite?: string | null;
  /**
   * ⚠️ Volontairement ABSENT : aucun prix de vente ne doit parvenir au
   * prestataire (§7, règle 3). Le type ne permet donc pas d'en transmettre.
   */
};

/** Localisation autorisée : code postal et ville, rien d'autre. */
export type Localisation = { cp: string; ville: string };

export type DossierSigne = {
  sector: string;
  /** Lignes réellement acceptées au devis signé. */
  lignes: LigneAcceptee[];
  surfaceM2?: number | null;
  volumeM3?: number | null;
  /** Détails de la découverte, pour compléter les contraintes techniques. */
  details?: Record<string, unknown>;
  etatSalete?: string | null;
  /** Nettoyage et débarras : un seul lieu. */
  lieu?: Localisation | null;
  /** Déménagement et transport : départ et arrivée. */
  depart?: Localisation | null;
  arrivee?: Localisation | null;
  /** Des photos sont-elles disponibles au dossier ? */
  photosDisponibles?: boolean;
  /** Date souhaitée par le client, si elle est connue. */
  dateSouhaitee?: string | null;
  /** Signature de l'entité juridique émettrice (§10). */
  signatureEntite?: string | null;
};

export type DemandePrestataire = {
  objet: string;
  corps: string;
  /** Informations utiles absentes : rien n'est inventé pour les combler. */
  manquant: string[];
};

// ── 1. Filtrage EN AMONT ──────────────────────────────────────────────

/** Valeurs confidentielles d'un dossier, telles que le CRM les détient. */
export type Confidentiel = {
  rue?: string | null;
  /**
   * ⚠️ NE PLUS Y METTRE L'ÉTAGE. Arbitrage client du 2026-11-06 : un niveau
   * (« 2e étage », avec ou sans ascenseur) est une indication LOGISTIQUE non
   * identifiante, et le sous-traitant en a besoin pour chiffrer — un troisième
   * sans ascenseur ne se facture pas comme un rez-de-chaussée.
   *
   * L'étage y figurait, alors que `dossierSigneDe()` le transmettait au
   * générateur qui l'imprimait : `verifierFuites()` le retrouvait dans son
   * propre texte et REFUSAIT de rendre la demande. Dès qu'un étage était
   * renseigné, la demande de tarif n'existait plus. Défaut latent jusqu'ici —
   * aucun des 11 dossiers ni des 699 leads ne portait d'étage.
   *
   * Ce qui reste interdit dans un complément d'adresse, c'est ce qui DÉSIGNE
   * le logement : numéro d'appartement, porte, bâtiment, escalier. Ce n'est
   * pas une valeur du dossier mais une forme : c'est donc `motifsDesignants`
   * qui s'en charge, par motif, et `etageLogistique()` qui n'en laisse rien
   * passer en amont.
   */
  complement?: string | null;
  adresseComplete?: string | null;
  nomClient?: string | null;
  telephone?: string | null;
  email?: string | null;
};

// ── Étage : ce qui peut sortir, et rien d'autre ───────────────────────

/**
 * Réduit un complément d'adresse à la seule indication de NIVEAU.
 *
 * ── POURQUOI UNE LISTE BLANCHE, ET NON UN NETTOYAGE ──────────────────
 *
 * Le champ est une saisie libre de la découverte : « 2e étage », mais aussi
 * « Appt 34, 3e étage », « bâtiment B, 4e, porte droite », ou un slug
 * (`rez_de_chaussee`). Retirer ce qui gêne supposerait de connaître d'avance
 * toutes les formes qu'un numéro d'appartement peut prendre — c'est le mauvais
 * sens pour une règle de confidentialité.
 *
 * On ne RETIRE donc rien : on EXTRAIT ce qu'on sait reconnaître comme un
 * niveau, et on jette le reste. Un texte dont aucun niveau n'est reconnu rend
 * `""` : il ne part pas. Mieux vaut une contrainte non transmise qu'un numéro
 * d'appartement envoyé à cinq prestataires.
 */
/**
 * ⚠️ LES MOTIFS S'APPLIQUENT AU TEXTE SANS ACCENTS, et c'est nécessaire.
 *
 * `\b` est une frontière de mot ASCII : « é » n'étant pas un caractère de mot,
 * `/\b[eé]tage/` NE RECONNAÎT PAS « étage 4 » en début de chaîne. Le défaut
 * s'est vu en test. Plutôt que de remplacer chaque `\b` par un `lookbehind`
 * — supporté par Node mais plus récent côté navigateurs, et ce module est
 * aussi chargé par un composant client — on normalise l'entrée une fois.
 *
 * Le rendu, lui, est une chaîne FIXE écrite ici : la sortie garde ses accents
 * quoi qu'il arrive à l'entrée.
 */
const NIVEAUX: { re: RegExp; rendu: (m: RegExpMatchArray) => string }[] = [
  { re: /\bsous[\s_-]?sols?\b/, rendu: () => "sous-sol" },
  { re: /\brez[\s_-]?de[\s_-]?chaussee?\b/, rendu: () => "rez-de-chaussée" },
  { re: /\brdc\b/, rendu: () => "rez-de-chaussée" },
  { re: /\bdernier\s+etage\b/, rendu: () => "dernier étage" },
  // « 2e étage », « 2ème étage », « 2 eme etage », « 12e étage »
  {
    re: /\b(\d{1,2})\s*(?:er|re|e|eme|ere)?\s*[\s_-]?etages?\b/,
    rendu: (m) => `${m[1]}e étage`,
  },
  // « étage 2 », « etage_2 », « étage : 2 »
  { re: /\betages?\s*[:_-]?\s*(\d{1,2})\b/, rendu: (m) => `${m[1]}e étage` },
];

export function etageLogistique(brut: unknown): string {
  const t = typeof brut === "string" ? brut.trim() : "";
  if (!t) return "";
  const sansAccents = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const { re, rendu } of NIVEAUX) {
    const m = sansAccents.match(re);
    if (m) {
      const r = rendu(m);
      // Un « 0e étage » n'existe pas : c'est le rez-de-chaussée.
      return r === "0e étage" ? "rez-de-chaussée" : r;
    }
  }
  return "";
}

/**
 * Formes qui DÉSIGNENT un logement précis, quelle que soit leur origine.
 *
 * Contrôlées par MOTIF et non par valeur, parce que le CRM ne stocke pas le
 * numéro d'appartement dans un champ à lui : il est noyé dans de la saisie
 * libre. Un motif attrape donc aussi celui qui arriverait par un libellé de
 * prestation ou une consigne.
 *
 * ⚠️ CHAQUE MOTIF EXIGE UN IDENTIFIANT APRÈS LE MOT. Sans cela, « Nettoyage
 * des portes, poignées et encadrements » — une ligne de devis parfaitement
 * ordinaire — serait signalé comme une fuite, et la demande ne partirait
 * jamais. De même, « Il s'agit d'un appartement de 75 m² » doit passer :
 * c'est le générateur lui-même qui l'écrit.
 *
 * ⚠️ LA BRANCHE « LETTRE UNIQUE » EST GARDÉE PAR UN PRÉDICAT, pas par un
 * drapeau. Il faut reconnaître le mot quelle que soit sa casse — un libellé de
 * devis est souvent tout en majuscules — mais n'accepter comme identifiant
 * qu'une MAJUSCULE non suivie d'une apostrophe. Sans le prédicat, `/i` ferait
 * de « porte d'entrée » et « bâtiment principal » des fuites ; sans
 * l'apostrophe, « NETTOYAGE DES PORTES D'ENTRÉE » en serait une aussi. Les
 * deux phrases sont des lignes de devis ordinaires.
 */
const majusculeSeule = (m: RegExpMatchArray): boolean => /^[A-Z]$/.test(m[1] ?? "");

const motifsDesignants: { champ: string; re: RegExp; valide?: (m: RegExpMatchArray) => boolean }[] = [
  // Appartement : « appartement 34 », « appt 12B », « apt n° 7 ».
  { champ: "numéro d'appartement", re: /\b(?:appartements?|apparts?|appts?|apt)\s*(?:n\s*[°o]\s*)?[:.]?\s*[A-Za-z]?\d+[A-Za-z]?\b/i },
  { champ: "numéro de lot", re: /\blots?\s*(?:n\s*[°o]\s*)?\d+\b/i },
  // Porte : un numéro, « gauche » / « droite », ou une majuscule seule.
  { champ: "désignation de porte", re: /\bportes?\s+(?:n\s*[°o]\s*)?\d+\b/i },
  { champ: "désignation de porte", re: /\bportes?\s+(?:de\s+)?(?:gauche|droite)\b/i },
  { champ: "désignation de porte", re: /\bportes?\s+([A-Za-z])(?!['’])\b/i, valide: majusculeSeule },
  // `bat` seul est écarté : c'est aussi un verbe français (« il bat »).
  { champ: "désignation de bâtiment", re: /\b(?:b[aâ]timents?|bâts?)\s*(?:n\s*[°o]\s*)?[:.]?\s*\d+\b/i },
  { champ: "désignation de bâtiment", re: /\b(?:b[aâ]timents?|bâts?)\s+([A-Za-z])(?!['’])\b/i, valide: majusculeSeule },
  { champ: "désignation d'escalier", re: /\bescaliers?\s*(?:n\s*[°o]\s*)?[:.]?\s*\d+\b/i },
  { champ: "désignation d'escalier", re: /\bescaliers?\s+([A-Za-z])(?!['’])\b/i, valide: majusculeSeule },
  { champ: "boîte aux lettres", re: /\bbo[iî]te\s+aux\s+lettres\b/i },
];

/**
 * Réduit une adresse à ce qui peut sortir : code postal et ville.
 *
 * `null` quand ni l'un ni l'autre n'est connu — on ne devine pas une
 * localisation, et un prestataire ne peut pas chiffrer sans elle.
 */
export function contexteRedige(
  a: { cp?: string | null; ville?: string | null } | null | undefined,
): Localisation | null {
  const cp = (a?.cp ?? "").trim();
  const ville = (a?.ville ?? "").trim();
  if (!cp && !ville) return null;
  return { cp, ville };
}

/** « 37000 Tours », ou ce qu'on a. */
function localiser(l: Localisation | null | undefined): string {
  if (!l) return "";
  return [l.cp, l.ville].filter(Boolean).join(" ");
}

/** Département à partir du code postal : « Tours (37) ». */
function departement(l: Localisation | null | undefined): string {
  const cp = (l?.cp ?? "").replace(/\D/g, "");
  return cp.length >= 2 ? cp.slice(0, 2) : "";
}

// ── 2. Génération ─────────────────────────────────────────────────────

const str = (d: Record<string, unknown> | undefined, k: string): string =>
  d && typeof d[k] === "string" ? (d[k] as string).trim() : "";
const num = (d: Record<string, unknown> | undefined, k: string): number => {
  if (!d) return 0;
  const n = typeof d[k] === "number" ? d[k] : Number(d[k]);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const liste = (d: Record<string, unknown> | undefined, k: string): string[] =>
  d && Array.isArray(d[k]) ? (d[k] as unknown[]).map(String).filter(Boolean) : [];

const INTITULE: Record<string, string> = {
  nettoyage: "Nettoyage",
  nettoyage_difficile: "Nettoyage difficile",
  diogene: "Nettoyage en logement encombré",
  debarras: "Débarras",
  demenagement: "Déménagement",
  transport: "Transport",
};

/**
 * Prépare la demande de tarif et de disponibilité.
 *
 * Elle part des lignes du devis SIGNÉ : en cas d'écart avec la découverte,
 * c'est le périmètre accepté par le client qui fait foi (§4.1). La découverte
 * ne sert qu'à décrire les contraintes techniques.
 */
export function genererDemandePrestataire(d: DossierSigne): DemandePrestataire | null {
  if (!activiteCouverte(d.sector)) return null;

  const manquant: string[] = [];
  const det = d.details;
  const transport = d.sector === "demenagement" || d.sector === "transport";

  // ── Objet ────────────────────────────────────────────────────────
  const intitule = INTITULE[d.sector] ?? "Intervention";
  let suffixe: string;
  if (transport) {
    const a = d.depart?.ville ?? "", b = d.arrivee?.ville ?? "";
    suffixe = a && b ? `${a} / ${b}` : a || b || "";
    if (!a) manquant.push("ville de départ");
    if (!b) manquant.push("ville d'arrivée");
  } else {
    const v = d.lieu?.ville ?? "";
    const dep = departement(d.lieu);
    suffixe = v ? `${v}${dep ? ` (${dep})` : ""}` : "";
    if (!v) manquant.push("ville d'intervention");
  }
  const objet = `Demande de disponibilité et de tarif – ${intitule}${suffixe ? ` – ${suffixe}` : ""}`;

  // ── Ouverture ────────────────────────────────────────────────────
  const lignes: string[] = ["Bonjour,", ""];

  if (transport) {
    lignes.push(
      d.sector === "demenagement"
        ? "Nous recherchons une entreprise disponible pour un déménagement entre :"
        : "Nous recherchons un prestataire pour un transport entre :",
    );
    lignes.push("");
    const etiqD = d.sector === "demenagement" ? "Départ" : "Enlèvement";
    const etiqA = d.sector === "demenagement" ? "Arrivée" : "Livraison";
    lignes.push(`${etiqD} : ${localiser(d.depart) || "à préciser"}.`);
    lignes.push(`${etiqA} : ${localiser(d.arrivee) || "à préciser"}.`);
  } else {
    const loc = localiser(d.lieu);
    lignes.push(
      `Nous recherchons une entreprise disponible pour une intervention de `
      + `${intitule.toLowerCase()}${loc ? ` à ${loc}` : ""}.`,
    );
  }
  lignes.push("");

  // ── Nature du chantier ───────────────────────────────────────────
  const taille: string[] = [];
  if (d.surfaceM2) taille.push(`${d.surfaceM2} m²`);
  if (d.volumeM3) taille.push(`${d.volumeM3} m³`);
  if (!taille.length && !transport) manquant.push("surface");
  if (!taille.length && transport) manquant.push("volume estimé");

  if (!transport) {
    const bien = str(det, "typeBienNet") || str(det, "typeBien");
    lignes.push(
      `Il s'agit d'un${bien ? ` ${bien.replace(/_/g, " ")}` : " bien"}`
      + `${taille.length ? ` de ${taille.join(" / ")}` : ""} nécessitant les prestations suivantes :`,
    );
  } else {
    if (taille.length) lignes.push(`Volume estimé : ${taille.join(" / ")}.`);
    lignes.push("");
    lignes.push("Prestations à prévoir :");
  }
  lignes.push("");

  // ── Prestations ACCEPTÉES au devis signé ─────────────────────────
  if (d.lignes.length === 0) {
    manquant.push("prestations acceptées au devis");
    lignes.push("- (prestations à préciser)");
  } else {
    for (const l of d.lignes) {
      const q = l.quantite && l.quantite > 0
        ? ` — ${l.quantite}${l.unite ? ` ${l.unite}` : ""}`
        : "";
      lignes.push(`- ${l.label}${q}.`);
    }
  }
  lignes.push("");

  // ── Contraintes techniques, depuis la découverte ─────────────────
  const contraintes: string[] = [];

  if (d.etatSalete) {
    contraintes.push(`Le logement présente un encrassement ${labelOf(ETAT_GENERAL, d.etatSalete).toLowerCase()}.`);
  }
  if (!transport) {
    const etage = str(det, "etage");
    const asc = str(det, "ascenseur");
    if (etage) {
      contraintes.push(
        `Accès : ${etage.replace(/_/g, " ")}${asc === "non" ? ", sans ascenseur" : asc === "oui" ? ", avec ascenseur" : ""}.`,
      );
    }
    const stat = str(det, "stationnement");
    if (stat && stat !== "facile") contraintes.push(`Stationnement : ${stat.replace(/_/g, " ")}.`);
    if (str(det, "vitrerie") === "oui") {
      const faces = str(det, "vitrerieFaces");
      const f = num(det, "vitrerieFenetres"), b = num(det, "vitrerieBaies"), v = num(det, "vitrerieVelux");
      const compte = [
        f ? `${f} fenêtre${f > 1 ? "s" : ""}` : "",
        b ? `${b} baie${b > 1 ? "s" : ""} vitrée${b > 1 ? "s" : ""}` : "",
        v ? `${v} Velux` : "",
      ].filter(Boolean).join(", ");
      if (compte || faces) {
        contraintes.push(
          `Vitrerie : ${compte || "à chiffrer"}`
          + `${faces ? ` (${labelOf(VITRERIE_FACES, faces).toLowerCase()})` : ""}.`,
        );
      }
    }
    if (str(det, "dioNuisibles") === "oui") {
      contraintes.push("Présence de nuisibles signalée : équipement de protection nécessaire.");
    }
  } else {
    const eD = num(det, "etagesDepart") || num(det, "etageEnlevement");
    const eA = num(det, "etagesArrivee") || num(det, "etageLivraison");
    const aD = str(det, "ascenseurDepart") || str(det, "ascenseurEnlevement");
    const aA = str(det, "ascenseurArrivee") || str(det, "ascenseurLivraison");
    if (eD || aD) {
      contraintes.push(
        `Départ : ${eD ? `${eD}e étage` : "rez-de-chaussée"}`
        + `${aD === "non" ? " sans ascenseur" : aD === "oui" ? " avec ascenseur" : ""}.`,
      );
    }
    if (eA || aA) {
      contraintes.push(
        `Arrivée : ${eA ? `${eA}e étage` : "rez-de-chaussée"}`
        + `${aA === "non" ? " sans ascenseur" : aA === "oui" ? " avec ascenseur" : ""}.`,
      );
    }
    const km = num(det, "distanceKm");
    if (km) contraintes.push(`Distance : environ ${km} km.`);
    const poids = num(det, "poidsKg");
    if (poids) contraintes.push(`Poids estimé : ${poids} kg.`);
    const typeObjet = str(det, "typeObjet");
    if (typeObjet) contraintes.push(`Nature des biens : ${labelOf(TYPE_OBJET, typeObjet).toLowerCase()}.`);
    const options = liste(det, "optionsTransport");
    const notables = options.filter((o) => ["fragile", "lourd", "volumineux", "manutention"].includes(o));
    if (notables.length) contraintes.push(`À prévoir : ${notables.map((o) => o.replace(/_/g, " ")).join(", ")}.`);
  }

  if (contraintes.length) {
    lignes.push(...contraintes);
    lignes.push("");
  }

  // La date souhaitée est un FAIT du dossier : on ne l'invente pas.
  if (d.dateSouhaitee) {
    lignes.push(`Date souhaitée par le client : ${d.dateSouhaitee}.`);
    lignes.push("");
  }

  // ── Clôture ──────────────────────────────────────────────────────
  lignes.push(
    "Merci de nous communiquer vos disponibilités ainsi que votre tarif pour cette intervention.",
  );
  if (d.photosDisponibles) {
    lignes.push("Des photographies pourront vous être transmises pour faciliter votre évaluation.");
  }
  lignes.push("");
  lignes.push("Cordialement,");
  lignes.push(d.signatureEntite?.trim() || "Service Planification");

  return {
    objet,
    corps: lignes.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    manquant: [...new Set(manquant)],
  };
}

// ── 3. Contrôle EN AVAL : aucune fuite ────────────────────────────────

/** Normalise pour comparer : sans accent, sans ponctuation, en minuscules. */
function normaliser(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type Fuite = { champ: string; extrait: string };

/**
 * Le texte laisse-t-il échapper une information confidentielle ?
 *
 * On cherche les VALEURS RÉELLES du dossier dans le texte, pas des motifs
 * génériques : c'est la seule façon de détecter « 12 rue de la Paix » sans
 * se tromper sur « 12 m² ». Les valeurs trop courtes sont ignorées — un nom
 * de deux lettres produirait des alertes à tort.
 *
 * Les numéros de téléphone et les courriels sont EN PLUS cherchés par motif :
 * même absents du dossier, ils n'ont rien à faire dans cet e-mail.
 */
export function verifierFuites(texte: string, c: Confidentiel): { ok: boolean; fuites: Fuite[] } {
  const fuites: Fuite[] = [];
  const n = normaliser(texte);

  const aChercher: { champ: string; valeur: string | null | undefined }[] = [
    { champ: "rue", valeur: c.rue },
    { champ: "complément d'adresse", valeur: c.complement },
    { champ: "adresse complète", valeur: c.adresseComplete },
    { champ: "nom du client", valeur: c.nomClient },
    { champ: "téléphone du client", valeur: c.telephone },
    { champ: "courriel du client", valeur: c.email },
  ];

  for (const { champ, valeur } of aChercher) {
    const v = (valeur ?? "").trim();
    if (!v) continue;

    // Téléphone : on compare les chiffres, la mise en forme variant.
    if (champ === "téléphone du client") {
      const chiffres = v.replace(/\D/g, "");
      if (chiffres.length >= 6 && texte.replace(/\D/g, "").includes(chiffres)) {
        fuites.push({ champ, extrait: v });
      }
      continue;
    }

    if (champ === "courriel du client") {
      if (texte.toLowerCase().includes(v.toLowerCase())) fuites.push({ champ, extrait: v });
      continue;
    }

    const nv = normaliser(v);
    if (nv.length < 4) continue; // trop court pour être concluant
    if (n.includes(nv)) { fuites.push({ champ, extrait: v }); continue; }

    // L'adresse complète contient le code postal et la ville, qui sont
    // AUTORISÉS. On cherche donc aussi ses fragments significatifs : un
    // nom de rue suffit à identifier le domicile.
    if (champ === "adresse complète" || champ === "rue") {
      const mots = nv.split(" ").filter((m) => m.length >= 4 && !/^\d+$/.test(m));
      // Deux mots consécutifs du nom de rue présents = fuite.
      for (let i = 0; i + 1 < mots.length; i++) {
        const paire = `${mots[i]} ${mots[i + 1]}`;
        if (n.includes(paire)) { fuites.push({ champ, extrait: paire }); break; }
      }
    }
  }

  // Motifs génériques : ils n'ont pas à figurer, quelle que soit leur origine.
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(texte)) {
    const m = texte.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    // L'adresse de l'expéditeur n'est pas une fuite : elle n'est pas dans le
    // corps généré. Tout courriel trouvé ici en est donc une.
    fuites.push({ champ: "adresse électronique dans le corps", extrait: m?.[0] ?? "" });
  }
  // Numéro de téléphone français, écrit de n'importe quelle façon.
  const tel = texte.match(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
  if (tel) fuites.push({ champ: "numéro de téléphone dans le corps", extrait: tel[0] });

  // Mentions de prix : le tarif client ne doit jamais sortir (§7).
  const prix = texte.match(/\d[\d\s.,]*\s*(?:€|EUR\b|euros?)/i);
  if (prix) fuites.push({ champ: "montant", extrait: prix[0].trim() });

  // Ce qui DÉSIGNE le logement. L'étage, lui, est autorisé depuis le
  // 2026-11-06 : il situe un effort, pas une personne. Un numéro
  // d'appartement, si.
  for (const { champ, re, valide } of motifsDesignants) {
    const m = texte.match(re);
    if (m && (!valide || valide(m))) fuites.push({ champ, extrait: m[0].trim() });
  }

  // Dédoublonnage : une même valeur signalée deux fois n'apporte rien.
  const vus = new Set<string>();
  const uniques = fuites.filter((f) => {
    const k = `${f.champ}:${f.extrait}`;
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });

  return { ok: uniques.length === 0, fuites: uniques };
}

/**
 * Prépare la demande ET la contrôle. C'est cette fonction qu'il faut appeler.
 *
 * Elle refuse de rendre un texte qui fuite : mieux vaut une demande bloquée
 * et signalée qu'une adresse de client envoyée à cinq prestataires.
 */
export function preparerDemande(
  d: DossierSigne,
  c: Confidentiel,
): { ok: true; demande: DemandePrestataire } | { ok: false; raison: string; fuites: Fuite[] } {
  const demande = genererDemandePrestataire(d);
  if (!demande) {
    return { ok: false, raison: "activité hors périmètre de cette automatisation", fuites: [] };
  }
  const controle = verifierFuites(`${demande.objet}\n${demande.corps}`, c);
  if (!controle.ok) {
    return {
      ok: false,
      raison: "le texte contient des informations confidentielles",
      fuites: controle.fuites,
    };
  }
  return { ok: true, demande };
}

// ── Statuts de la demande (§9) ────────────────────────────────────────

export type StatutDemande =
  | "preparee" | "envoyee" | "attente_reponse"
  | "reponse_recue" | "tarif_recu" | "selectionne" | "refuse";

export const STATUT_DEMANDE_LABEL: Record<StatutDemande, string> = {
  preparee: "Demande préparée",
  envoyee: "Demande envoyée",
  attente_reponse: "En attente de réponse",
  reponse_recue: "Réponse reçue",
  tarif_recu: "Tarif reçu",
  selectionne: "Prestataire sélectionné",
  refuse: "Prestataire refusé",
};
