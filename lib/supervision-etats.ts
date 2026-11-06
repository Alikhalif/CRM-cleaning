// MACHINE À ÉTATS COMMERCIALE DU LEAD — PUR, aucune I/O.
//
// ── POURQUOI CE MODULE EXISTE (anomalie P1-3 de l'audit du 2026-11-06) ──
//
// `lib/supervision-server.ts` calculait :
//
//   traite = status !== "lead" || discovery_done_at || actionOuverte
//
// Mesuré sur les 712 leads de production : 650 comptés « traités », dont
// **601 uniquement parce qu'une action commerciale était ouverte** — sans
// qu'aucun contact ne soit prouvé. Le cockpit annonçait 62 leads en attente
// quand 663 n'avaient jamais dépassé le statut « lead ».
//
// ── LA RÈGLE, ARBITRÉE PAR LE CLIENT LE 2026-11-06 ──────────────────
//
// « Une action créée ne signifie pas qu'un lead est traité. Un lead ne doit
// jamais être considéré comme contacté uniquement parce qu'une tâche
// existe. » Et : « un appel sans réponse ne signifie pas que le client a été
// contacté avec succès ».
//
// Donc onze états, fondés sur des ÉVÉNEMENTS RÉELLEMENT ENREGISTRÉS. Ce qui
// n'est pas enregistré n'est pas déduit : le module rend `inconnu` plutôt
// qu'un état inventé, et c'est cette honnêteté qui rend l'indicateur utile.
//
// ── CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────
//
// Il ne lit rien. Il reçoit des faits — colonnes du lead, entrées d'audit,
// documents, actions — et il en déduit un état. C'est ce qui le rend
// testable sans base, et c'est aussi ce qui permet au superviseur de savoir
// d'où vient chaque chiffre.

// ══════════════════════════════════════════════════════════════════════
//  Les onze états
// ══════════════════════════════════════════════════════════════════════

export type EtatLead =
  | "recu"              // en base, aucun commercial
  | "affecte"           // un commercial est désigné, rien de plus
  | "appel_sans_reponse" // appelé, pas joint — le dossier reste à faire
  | "premier_appel"     // un appel est journalisé, résultat non concluant
  | "contact_etabli"    // le client a été JOINT
  | "decouverte_faite"  // découverte enregistrée
  | "devis_a_realiser"  // découverte faite, aucun devis parti
  | "devis_envoye"
  | "devis_ouvert"
  | "devis_signe"
  | "perdu";            // clôturé avec motif

/** Ordre d'avancement. Sert au tri et à la détection d'un blocage. */
export const ETATS_ORDONNES: EtatLead[] = [
  "recu", "affecte", "appel_sans_reponse", "premier_appel", "contact_etabli",
  "decouverte_faite", "devis_a_realiser", "devis_envoye", "devis_ouvert",
  "devis_signe", "perdu",
];

export const ETAT_LABEL: Record<EtatLead, string> = {
  recu: "Reçu, non affecté",
  affecte: "Affecté, pas encore appelé",
  appel_sans_reponse: "Appelé sans réponse",
  premier_appel: "Appel effectué",
  contact_etabli: "Client joint",
  decouverte_faite: "Découverte effectuée",
  devis_a_realiser: "Devis à réaliser",
  devis_envoye: "Devis envoyé",
  devis_ouvert: "Devis ouvert par le client",
  devis_signe: "Devis signé",
  perdu: "Perdu",
};

/** Rang dans l'avancement. `perdu` est une SORTIE, pas une étape. */
export function rangEtat(e: EtatLead): number {
  return ETATS_ORDONNES.indexOf(e);
}

// ══════════════════════════════════════════════════════════════════════
//  Les faits dont la machine a besoin
// ══════════════════════════════════════════════════════════════════════

/**
 * Résultat d'un appel, tel que le commercial le DÉCLARE.
 *
 * ⚠️ UNE DÉCLARATION N'EST PAS UNE PREUVE. Le client l'a dit mot pour mot :
 * « un clic manuel constitue une déclaration du commercial. Il ne doit pas
 * être présenté comme une preuve d'appel téléphonique vérifiée. » D'où
 * `source` sur chaque appel, et deux compteurs distincts partout.
 */
export type ResultatAppel =
  | "joint"         // le client a répondu
  | "sans_reponse"  // ça a sonné, personne
  | "rappel"        // à rappeler (occupé, pas le moment)
  | "injoignable";  // numéro invalide ou hors service

export const RESULTAT_APPEL_LABEL: Record<ResultatAppel, string> = {
  joint: "Client joint",
  sans_reponse: "Sans réponse",
  rappel: "À rappeler",
  injoignable: "Numéro injoignable",
};

/** D'où vient l'information. Jamais confondues dans les statistiques. */
export type SourceAppel = "declare" | "ringover";

export const SOURCE_APPEL_LABEL: Record<SourceAppel, string> = {
  declare: "déclaré par le commercial",
  ringover: "confirmé par Ringover",
};

export type Appel = {
  /** Horodatage de l'événement, ISO. */
  le: string;
  resultat: ResultatAppel;
  source: SourceAppel;
  /** Auteur de la déclaration, ou null pour un événement système. */
  parQui: string | null;
};

/**
 * Tout ce que la machine lit. Rien d'autre.
 *
 * Volontairement plat et sans dépendance : un cas de test tient en six
 * lignes, et chaque champ correspond à une donnée qui EXISTE en base.
 */
export type FaitsLead = {
  /** `leads.owner_id`. */
  ownerId: string | null;
  /** `leads.status` — `lead | envoye | ouvert | signe | encaisse | perdu`. */
  statut: string;
  /** `leads.discovery_done_at`. */
  decouverteLe: string | null;
  /** Appels connus, dans n'importe quel ordre. */
  appels: Appel[];
  /** Un devis non brouillon existe-t-il ? */
  devisEnvoye: boolean;
  /** Le client a-t-il ouvert le devis ? */
  devisOuvert: boolean;
  /** Un devis signé existe-t-il ? */
  devisSigne: boolean;
  /** `leads.is_nrp` — marqueur historique, antérieur aux appels déclarés. */
  isNrp: boolean;
  /** Motif de perte, s'il existe. */
  motifPerte: string | null;
};

// ══════════════════════════════════════════════════════════════════════
//  La résolution
// ══════════════════════════════════════════════════════════════════════

const APPEL_CONCLUANT: ResultatAppel[] = ["joint"];

/** Appels triés du plus ancien au plus récent. */
export function appelsTries(appels: readonly Appel[]): Appel[] {
  return [...appels].sort((a, b) => a.le.localeCompare(b.le));
}

/** Le premier appel journalisé, quelle que soit son issue. */
export function premierAppel(appels: readonly Appel[]): Appel | null {
  return appelsTries(appels)[0] ?? null;
}

/** Le premier appel où le client a été JOINT. */
export function premierContact(appels: readonly Appel[]): Appel | null {
  return appelsTries(appels).find((a) => APPEL_CONCLUANT.includes(a.resultat)) ?? null;
}

/**
 * État commercial du lead.
 *
 * ── L'ORDRE DE RÉSOLUTION EST LA RÈGLE MÉTIER ───────────────────────
 *
 * On part du plus avancé. Un devis signé reste signé même si la découverte
 * n'a pas été saisie : l'aval l'emporte sur l'amont, parce qu'un fait
 * postérieur prouve que les étapes antérieures ont eu lieu, même mal
 * journalisées. L'inverse serait absurde — et produirait un « devis signé
 * jamais contacté ».
 *
 * ⚠️ CE QUI N'EST NULLE PART : « une action commerciale est ouverte ». Elle
 * ne figure pas dans `FaitsLead`, et c'est volontaire. C'était la cause de
 * l'anomalie P1-3 : une tâche à faire décrivait une INTENTION, et elle était
 * lue comme un traitement accompli.
 */
export function etatDuLead(f: FaitsLead): EtatLead {
  // Sortie du cycle : elle prime sur tout, mais seulement si elle est motivée.
  if (f.statut === "perdu") return "perdu";

  if (f.devisSigne || f.statut === "signe" || f.statut === "encaisse") return "devis_signe";
  if (f.devisOuvert || f.statut === "ouvert") return "devis_ouvert";
  if (f.devisEnvoye || f.statut === "envoye") return "devis_envoye";

  // Découverte faite mais aucun devis parti : c'est l'état « à chiffrer »,
  // celui que la vue « Devis à réaliser » matérialise déjà.
  if (f.decouverteLe) return "devis_a_realiser";

  // Les trois états d'appel. L'ordre compte : être joint une fois suffit,
  // quelles qu'aient été les tentatives précédentes.
  if (premierContact(f.appels)) return "contact_etabli";

  const appels = appelsTries(f.appels);
  if (appels.length > 0) {
    const dernier = appels[appels.length - 1] as Appel;
    // Sans réponse, à rappeler, injoignable : le dossier reste À FAIRE. Le
    // client n'a pas été joint, et c'est exactement ce que le client a
    // demandé de ne plus confondre.
    if (dernier.resultat === "sans_reponse" || dernier.resultat === "rappel"
        || dernier.resultat === "injoignable") {
      return "appel_sans_reponse";
    }
    return "premier_appel";
  }

  // `is_nrp` est antérieur aux appels déclarés : il vaut un appel sans
  // réponse, faute de mieux, et il ne doit pas être perdu.
  if (f.isNrp) return "appel_sans_reponse";

  return f.ownerId ? "affecte" : "recu";
}

/**
 * Le lead a-t-il été réellement CONTACTÉ ?
 *
 * La seule définition défendable : un appel où le client a été joint, ou une
 * étape postérieure qui le prouve. Ni une tâche ouverte, ni un appel sans
 * réponse.
 */
export function estContacte(f: FaitsLead): boolean {
  const e = etatDuLead(f);
  if (e === "perdu") {
    // Un lead perdu peut l'avoir été après contact, ou sans jamais de
    // réponse. On ne tranche que sur les faits.
    return premierContact(f.appels) !== null || Boolean(f.decouverteLe);
  }
  return rangEtat(e) >= rangEtat("contact_etabli") && e !== "appel_sans_reponse";
}

/**
 * Délai de premier appel, en minutes — ou `null` si aucun appel n'est connu.
 *
 * `null` est une réponse normale et aujourd'hui majoritaire : au 2026-11-06,
 * la production ne porte que dix appels journalisés. Rendre 0 ou une
 * moyenne arbitraire masquerait précisément ce que le superviseur doit voir.
 */
export function delaiPremierAppelMin(f: FaitsLead, recuLe: string | null): number | null {
  const a = premierAppel(f.appels);
  if (!a || !recuLe) return null;
  const d = new Date(a.le).getTime() - new Date(recuLe).getTime();
  return Number.isFinite(d) && d >= 0 ? Math.round(d / 60000) : null;
}

/** Délai jusqu'au premier CONTACT établi, en minutes. */
export function delaiPremierContactMin(f: FaitsLead, recuLe: string | null): number | null {
  const a = premierContact(f.appels);
  if (!a || !recuLe) return null;
  const d = new Date(a.le).getTime() - new Date(recuLe).getTime();
  return Number.isFinite(d) && d >= 0 ? Math.round(d / 60000) : null;
}

/**
 * Compteurs d'appels par SOURCE — jamais additionnés.
 *
 * Le client l'a exigé : « distinguer les appels déclarés manuellement des
 * appels confirmés par Ringover ». Un total unique effacerait la différence
 * entre une déclaration et une preuve.
 */
export function compterAppels(appels: readonly Appel[]): {
  declares: number;
  ringover: number;
  joints: number;
  sansReponse: number;
} {
  return {
    declares: appels.filter((a) => a.source === "declare").length,
    ringover: appels.filter((a) => a.source === "ringover").length,
    joints: appels.filter((a) => a.resultat === "joint").length,
    sansReponse: appels.filter((a) => a.resultat === "sans_reponse").length,
  };
}

/**
 * Dédoublonnage entre appels déclarés et appels Ringover.
 *
 * ── POURQUOI C'EST NÉCESSAIRE AVANT QUE RINGOVER EXISTE ─────────────
 *
 * Le jour où la ligne sera portée, les deux sources coexisteront : le
 * commercial déclarera son appel ET Ringover le remontera. Sans
 * dédoublonnage, chaque appel compterait deux fois et le superviseur verrait
 * une activité doublée.
 *
 * La règle : deux appels du même lead, de même résultat, à moins de
 * `fenetreMin` minutes d'écart, sont LE MÊME appel. On garde celui de
 * Ringover — c'est la preuve, pas la déclaration.
 */
export function dedoublonnerAppels(
  appels: readonly Appel[],
  fenetreMin = 15,
): Appel[] {
  const tries = appelsTries(appels);
  const gardes: Appel[] = [];
  for (const a of tries) {
    const jumeau = gardes.findIndex((g) =>
      g.resultat === a.resultat
      && Math.abs(new Date(g.le).getTime() - new Date(a.le).getTime()) <= fenetreMin * 60000);
    if (jumeau < 0) { gardes.push(a); continue; }
    // Doublon : Ringover remplace une déclaration, jamais l'inverse.
    if (a.source === "ringover" && gardes[jumeau]?.source === "declare") {
      gardes[jumeau] = a;
    }
  }
  return gardes;
}
