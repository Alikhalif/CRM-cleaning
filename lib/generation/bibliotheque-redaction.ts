// Bibliothèque rédactionnelle centralisée — référentiel COMMUN à toutes les
// sociétés du CRM (§15 du master prompt du 2026-11-05).
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────
//
// Le moteur de génération (devis-contenu.ts) savait déjà lire la découverte
// sans rien inventer. Ce qu'il ne savait pas faire, c'est RÉDIGER : il
// produisait une puce par champ saisi, soit exactement le « MAUVAIS RÉSULTAT »
// que le §5 proscrit. Le savoir-faire métier — les opérations qu'un
// professionnel décrit habituellement pour une prestation donnée — n'était
// écrit nulle part.
//
// Ce fichier est ce savoir-faire. Il ne lit aucune donnée et ne décide de
// rien : il expose des CATALOGUES d'opérations, de titres et de réserves, que
// le moteur sélectionne en fonction des seules prestations validées.
//
// ── LA RÈGLE QUI GOUVERNE TOUT ────────────────────────────────────────
//
//   DÉVELOPPER LES OPÉRATIONS HABITUELLES D'UNE PRESTATION VALIDÉE : OUI.
//   AJOUTER UNE PRESTATION QUI N'A PAS ÉTÉ VALIDÉE : JAMAIS.
//
// Concrètement : la présence d'un thème dans `SECTIONS_PAR_FAMILLE` autorise
// le moteur à DÉVELOPPER ce thème s'il est validé par la découverte ; elle ne
// l'autorise jamais à l'ajouter de lui-même. Les thèmes de la liste
// `THEMES_COMPLEMENTAIRES` ci-dessous ne sortent que sur validation explicite.
//
// ── POURQUOI UN RÉFÉRENTIEL ÉCRIT PLUTÔT QU'UN MODÈLE DE LANGAGE ──────
//
// Le CRM n'a aucun modèle de langage configuré, et pour ce travail c'est un
// avantage, pas un pis-aller. Les 28 interdictions du §19 sont absolues :
// « ne jamais inventer de surface », « ne jamais ajouter de vitrerie », « ne
// jamais promettre de résultat sanitaire ». Un catalogue fini de phrases
// écrites par un humain les respecte PAR CONSTRUCTION, et se teste. Une
// rédaction libre ne peut que les respecter *statistiquement*.
//
// Le jour où une rédaction plus souple sera voulue, ce fichier restera la
// source des faits et des formulations autorisées à lui transmettre.

/** Version du référentiel. Toute évolution du contenu l'incrémente (§15). */
export const VERSION_REFERENTIEL = "2026-11-05.1";

/**
 * Historique des évolutions du référentiel (§15, point 10).
 *
 * Volontairement en dur : une correction du référentiel commun est un acte
 * éditorial, pas une donnée d'exploitation. Le §15 exige qu'elle soit validée
 * par un administrateur — elle passe donc par une relecture de code et un
 * commit, ce qui la rend datée, attribuée et réversible.
 */
export const HISTORIQUE_REFERENTIEL: { version: string; date: string; objet: string }[] = [
  {
    version: "2026-11-05.1",
    date: "2026-11-05",
    objet:
      "Création du référentiel commun : 13 familles de nettoyage, 24 thèmes "
      + "d'opérations, titres, introductions et réserves. Reprise verbatim des "
      + "formulations imposées par le master prompt (§5, §11, §12.2).",
  },
];

// ══════════════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════════════

/** Une section technique numérotée du devis (§2, §5). */
export type SectionRedigee = { titre: string; operations: string[] };

/**
 * Niveau de développement (§10).
 *
 *   1 — prestation simple : descriptif clair et proportionné.
 *   2 — prestation approfondie : sections techniques développées.
 *   3 — prestation complexe : descriptif particulièrement détaillé.
 *
 * Le §10 l'exige dans les deux sens : « ne pas allonger artificiellement les
 * devis simples » ET « ne pas produire de descriptions superficielles pour
 * les interventions complexes ».
 */
export type Niveau = 1 | 2 | 3;

/** Familles métier de nettoyage (§7.1 à §7.13). */
export type FamilleNettoyage =
  | "courant"
  | "approfondi"
  | "fin_bail"
  | "avant_emmenagement"
  | "avant_vente"
  | "apres_demenagement"
  | "apres_chantier"
  | "apres_squat"
  | "insalubre"
  | "diogene"
  | "apres_deces"
  | "apres_incendie"
  | "apres_degat_eaux";

/** Thèmes d'opérations. Un thème = au plus une section du devis. */
export type Theme =
  // Socle nettoyage
  | "interieur"
  | "cuisine"
  | "sanitaires"
  | "sols_traitements"
  | "equipements"
  | "exterieurs"
  | "finition_chantier"
  // Phases d'un chantier insalubre, dans l'ordre imposé par le §7.8
  | "debarras_prealable"
  | "nuisibles"
  // Prestations complémentaires — JAMAIS sans validation (§6.B)
  | "vitrerie"
  | "murs"
  | "plafonds"
  | "desinfection"
  | "decontamination"
  | "desodorisation"
  | "debarras_inclus"
  // Sinistres
  | "suies"
  | "degat_eaux"
  // Débarras (activité autonome)
  | "tri"
  | "manutention"
  | "evacuation"
  // Déménagement / transport
  | "emballage"
  | "transport_mobilier"
  | "installation"
  | "transport_objet";

/**
 * Thèmes qui constituent des PRESTATIONS COMPLÉMENTAIRES au sens du §6.B.
 *
 * Le moteur a l'interdiction formelle de les faire apparaître sans validation
 * explicite dans la découverte. Cette liste est la matérialisation des
 * interdictions 11 à 15 du §19 — et le contrôle automatique
 * `aucunThemeComplementaireNonValide()` s'appuie sur elle.
 */
export const THEMES_COMPLEMENTAIRES: readonly Theme[] = [
  "vitrerie", "murs", "plafonds", "desinfection", "decontamination",
  "desodorisation", "debarras_inclus", "debarras_prealable", "nuisibles",
] as const;

export function estComplementaire(t: Theme): boolean {
  return (THEMES_COMPLEMENTAIRES as readonly string[]).includes(t);
}

// ══════════════════════════════════════════════════════════════════════
//  FAMILLES : du type saisi en découverte à la logique rédactionnelle
// ══════════════════════════════════════════════════════════════════════

/**
 * Correspondance entre les 17 valeurs de `TYPE_NETTOYAGE` (découverte) et les
 * familles métier.
 *
 * ⚠️ AVANT : les 17 valeurs étaient écrasées sur 7 libellés, et dix d'entre
 * elles finissaient en « Nettoyage approfondi ». Un nettoyage de fin de
 * chantier et un nettoyage après sinistre produisaient le même texte. C'est
 * précisément ce que le §7 interdit : « chaque famille d'activité doit
 * posséder ses propres règles rédactionnelles ».
 */
export const FAMILLE_PAR_TYPE: Record<string, FamilleNettoyage> = {
  classique: "courant",
  approfondi: "approfondi",
  fin_bail: "fin_bail",
  fin_bail_approfondi: "fin_bail",
  avant_emmenagement: "avant_emmenagement",
  avant_vente: "avant_vente",
  apres_demenagement: "apres_demenagement",
  fin_chantier_leger: "apres_chantier",
  fin_chantier: "apres_chantier",
  fin_chantier_difficile: "apres_chantier",
  apres_renovation: "apres_chantier",
  // « Remise en état » est le libellé historique de la découverte — et
  // exactement l'expression que l'interdiction 20 proscrit. C'est ici qu'elle
  // est désamorcée : le commercial garde son libellé, le devis n'en porte
  // jamais la trace.
  remise_etat: "approfondi",
  tres_sale: "approfondi",
  insalubre: "insalubre",
  apres_squat: "apres_squat",
  apres_sinistre: "apres_incendie",
  autre: "approfondi",
};

type Famille = {
  /** Base du titre, en clair. Mise en majuscules par le moteur. */
  titre: string;
  /** Nature de l'intervention, pour la première phrase de l'introduction (§4). */
  nature: string;
  /** Niveau de développement par défaut (§10), relevé selon le chantier. */
  niveau: Niveau;
  /**
   * Thèmes que cette famille a le droit de développer, DANS L'ORDRE de
   * rédaction. Un thème complémentaire présent ici n'est développé que s'il
   * est validé par la découverte.
   */
  themes: readonly Theme[];
};

/** Ordre de rédaction commun aux familles de nettoyage de logement. */
const SOCLE_LOGEMENT: readonly Theme[] = [
  "interieur", "sols_traitements", "cuisine", "sanitaires", "equipements",
  "murs", "plafonds", "vitrerie", "exterieurs",
  "debarras_inclus", "desinfection", "decontamination", "desodorisation",
] as const;

export const FAMILLES: Record<FamilleNettoyage, Famille> = {
  courant: {
    titre: "Nettoyage courant",
    nature: "nettoyage d'entretien courant",
    // §7.1 : « rédiger un descriptif proportionné à une intervention
    // d'entretien. Ne pas ajouter automatiquement les opérations d'un
    // nettoyage approfondi. »
    niveau: 1,
    themes: ["interieur", "cuisine", "sanitaires", "equipements", "vitrerie"],
  },
  approfondi: {
    titre: "Nettoyage approfondi",
    nature: "nettoyage approfondi",
    niveau: 2,
    themes: SOCLE_LOGEMENT,
  },
  fin_bail: {
    titre: "Nettoyage approfondi de fin de bail",
    nature: "nettoyage approfondi de fin de bail",
    niveau: 2,
    themes: SOCLE_LOGEMENT,
  },
  avant_emmenagement: {
    titre: "Nettoyage approfondi avant emménagement",
    nature: "nettoyage approfondi préalable à l'occupation du logement",
    niveau: 2,
    themes: SOCLE_LOGEMENT,
  },
  avant_vente: {
    titre: "Nettoyage approfondi avant mise en vente",
    nature: "nettoyage approfondi préalable à la mise en vente du bien",
    niveau: 2,
    themes: SOCLE_LOGEMENT,
  },
  apres_demenagement: {
    titre: "Nettoyage approfondi après déménagement",
    nature: "nettoyage approfondi consécutif au déménagement",
    niveau: 2,
    themes: SOCLE_LOGEMENT,
  },
  apres_chantier: {
    titre: "Nettoyage approfondi après chantier",
    nature: "nettoyage de finition après travaux",
    niveau: 2,
    themes: [
      "finition_chantier", "interieur", "sols_traitements", "cuisine",
      "sanitaires", "equipements", "murs", "plafonds", "vitrerie",
      "exterieurs", "debarras_inclus", "desinfection", "desodorisation",
    ],
  },
  apres_squat: {
    titre: "Nettoyage après occupation sans droit",
    nature: "nettoyage consécutif à une occupation sans droit ni titre",
    niveau: 3,
    themes: [
      "debarras_prealable", "interieur", "sols_traitements", "cuisine",
      "sanitaires", "equipements", "murs", "plafonds", "vitrerie",
      "desinfection", "decontamination", "desodorisation", "nuisibles",
    ],
  },
  insalubre: {
    titre: "Nettoyage d'un logement insalubre",
    nature: "nettoyage d'un logement en état d'insalubrité",
    niveau: 3,
    themes: [
      "debarras_prealable", "interieur", "sols_traitements", "cuisine",
      "sanitaires", "equipements", "murs", "plafonds", "vitrerie",
      "desinfection", "decontamination", "desodorisation", "nuisibles",
    ],
  },
  diogene: {
    titre: "Nettoyage insalubre de type Diogène",
    nature: "nettoyage et de débarras consécutif à un syndrome de Diogène",
    niveau: 3,
    // §7.8 : ordre imposé — débarras, nettoyage approfondi, désinfection,
    // décontamination. Chaque phase est développée séparément.
    themes: [
      "debarras_prealable", "interieur", "sols_traitements", "cuisine",
      "sanitaires", "equipements", "murs", "plafonds", "vitrerie",
      "desinfection", "decontamination", "desodorisation", "nuisibles",
    ],
  },
  apres_deces: {
    titre: "Nettoyage après décès",
    nature: "nettoyage consécutif à un décès",
    niveau: 3,
    themes: [
      "debarras_prealable", "interieur", "sols_traitements", "sanitaires",
      "equipements", "murs", "plafonds", "desinfection", "decontamination",
      "desodorisation",
    ],
  },
  apres_incendie: {
    titre: "Nettoyage après incendie",
    nature: "nettoyage consécutif à un incendie",
    niveau: 3,
    themes: [
      "debarras_prealable", "suies", "interieur", "sols_traitements",
      "cuisine", "sanitaires", "equipements", "murs", "plafonds", "vitrerie",
      "desinfection", "decontamination", "desodorisation",
    ],
  },
  apres_degat_eaux: {
    titre: "Nettoyage après dégât des eaux",
    nature: "nettoyage consécutif à un dégât des eaux",
    niveau: 3,
    themes: [
      "debarras_prealable", "degat_eaux", "interieur", "sols_traitements",
      "cuisine", "sanitaires", "equipements", "murs", "plafonds",
      "desinfection", "decontamination", "desodorisation",
    ],
  },
};

/**
 * Famille déduite de la découverte.
 *
 * L'ordre des règles compte. Le SECTEUR du dossier prime sur le type de
 * nettoyage saisi : un dossier Diogène reste un dossier Diogène même si le
 * commercial a coché « Approfondi ». À l'inverse, l'origine d'une
 * décontamination (décès, incendie, eaux usées) affine un secteur générique.
 *
 * ⚠️ Interdiction 10 du §19 et règle du §3.3 : **ne jamais qualifier un
 * logement de « type Diogène » sur la seule base d'un encrassement
 * important**. Seul le secteur `diogene`, choisi par un humain, le permet.
 */
export function familleDe(input: {
  sector: string;
  typeNettoyage: string;
  origineDecontamination?: string;
  origineDesodorisation?: string;
}): FamilleNettoyage {
  if (input.sector === "diogene") return "diogene";

  const parType = FAMILLE_PAR_TYPE[input.typeNettoyage];

  // Une origine de décontamination est un fait saisi, pas une déduction : elle
  // désigne la famille quand le type de nettoyage reste générique.
  const generique = !parType || parType === "approfondi" || parType === "courant";
  if (generique) {
    switch (input.origineDecontamination) {
      case "deces": return "apres_deces";
      case "incendie": return "apres_incendie";
      case "eaux_usees": return "apres_degat_eaux";
      case "insalubrite": return "insalubre";
    }
    if (input.origineDesodorisation === "incendie") return "apres_incendie";
    if (input.origineDesodorisation === "humidite") return "apres_degat_eaux";
  }

  if (parType) return parType;
  return input.sector === "nettoyage_difficile" ? "insalubre" : "approfondi";
}

// ══════════════════════════════════════════════════════════════════════
//  CATALOGUE DES OPÉRATIONS
// ══════════════════════════════════════════════════════════════════════
//
// Chaque thème porte un titre de section et trois paliers d'opérations.
// Le moteur retient `base` au niveau 1, `base + standard` au niveau 2, et
// l'ensemble au niveau 3.
//
// Les opérations des thèmes « interieur », « cuisine », « sanitaires » et
// « vitrerie » sont reprises VERBATIM du résultat attendu donné au §5 : c'est
// la méthode de rédaction officielle, pas une interprétation.

type Catalogue = {
  titre: string;
  base: readonly string[];
  standard?: readonly string[];
  complet?: readonly string[];
};

export const OPERATIONS: Record<Theme, Catalogue> = {
  // ── Socle nettoyage ────────────────────────────────────────────────
  interieur: {
    titre: "Nettoyage approfondi des espaces intérieurs",
    base: [
      "Dépoussiérage minutieux de l'ensemble des surfaces accessibles.",
      "Nettoyage des portes, poignées, encadrements et huisseries.",
      "Élimination des traces et salissures présentes sur les surfaces concernées.",
    ],
    standard: [
      "Nettoyage des plinthes, angles, recoins et zones difficiles d'accès.",
      "Nettoyage des interrupteurs et éléments fixes accessibles.",
    ],
    complet: [
      "Nettoyage des radiateurs, grilles de ventilation et éléments techniques accessibles.",
      "Nettoyage des rangements fixes et de leurs façades.",
    ],
  },
  sols_traitements: {
    titre: "Traitement des sols",
    base: [
      "Nettoyage approfondi des sols avec utilisation de techniques adaptées aux revêtements.",
    ],
    standard: [
      "Traitement des zones présentant des traces incrustées.",
    ],
    complet: [
      "Protection des revêtements sensibles pendant les opérations.",
    ],
  },
  cuisine: {
    titre: "Nettoyage approfondi et dégraissage de la cuisine",
    base: [
      "Dégraissage des plans de travail et surfaces accessibles.",
      "Nettoyage approfondi des façades des meubles présents.",
      "Nettoyage de l'évier et de la robinetterie.",
    ],
    standard: [
      "Élimination des dépôts graisseux sur les surfaces concernées.",
      "Nettoyage des crédences et surfaces carrelées accessibles.",
    ],
    complet: [
      "Nettoyage des équipements compris dans le périmètre de la prestation.",
    ],
  },
  sanitaires: {
    titre: "Nettoyage et détartrage des sanitaires",
    base: [
      "Nettoyage approfondi des équipements sanitaires.",
      "Détartrage des robinetteries, vasques et équipements concernés.",
    ],
    standard: [
      "Nettoyage des surfaces carrelées et joints accessibles.",
      "Élimination des dépôts de savon et de calcaire.",
    ],
    complet: [
      "Nettoyage des accessoires sanitaires compris dans l'intervention.",
    ],
  },
  equipements: {
    titre: "Nettoyage des équipements",
    base: [
      "Nettoyage intérieur et extérieur des équipements compris au devis.",
    ],
    standard: [
      "Dégraissage des parois, grilles et accessoires démontables accessibles.",
    ],
  },
  exterieurs: {
    titre: "Nettoyage des espaces extérieurs",
    base: [
      "Nettoyage des surfaces extérieures comprises au devis.",
      "Évacuation des salissures et détritus présents.",
    ],
    standard: [
      "Nettoyage des garde-corps, rambardes et éléments fixes accessibles.",
    ],
  },
  finition_chantier: {
    titre: "Nettoyage de finition après travaux",
    base: [
      "Élimination des poussières fines déposées sur l'ensemble des surfaces.",
      "Retrait des traces de travaux sur les supports concernés.",
      "Évacuation des résidus de chantier présents dans le périmètre.",
    ],
    standard: [
      "Nettoyage des menuiseries, seuils et appuis après intervention.",
      "Décollement des adhésifs, protections et étiquettes résiduelles.",
    ],
    complet: [
      "Traitement particulier des matériaux sensibles, adapté à leur nature.",
      "Nettoyage des gaines techniques et réservations accessibles.",
    ],
  },

  // ── Phases d'un chantier insalubre (§7.8) ──────────────────────────
  debarras_prealable: {
    titre: "Débarras préalable du logement",
    base: [
      "Tri des biens sur place selon les instructions du client.",
      "Évacuation des déchets et encombrants présents dans le logement.",
      "Acheminement vers les filières de traitement autorisées.",
    ],
    standard: [
      "Conditionnement des déchets souillés dans des contenants adaptés.",
      "Remise des justificatifs de traitement des déchets.",
    ],
    complet: [
      "Mise en œuvre des protections individuelles et collectives adaptées à l'état du logement.",
      "Dégagement progressif des zones rendues inaccessibles par l'encombrement.",
    ],
  },
  nuisibles: {
    titre: "Traitement des nuisibles",
    base: [
      "Traitement des nuisibles constatés, en coordination avec l'entreprise habilitée.",
    ],
    standard: [
      "Traitement des zones de nidification et de passage identifiées.",
    ],
    complet: [
      "Contrôle des points d'accès et des zones de refuge accessibles.",
    ],
  },

  // ── Prestations complémentaires (§6.B — jamais sans validation) ─────
  vitrerie: {
    titre: "Nettoyage de la vitrerie",
    base: [
      "Nettoyage des surfaces vitrées prévues au devis.",
      "Élimination des traces et salissures.",
    ],
    standard: [
      "Nettoyage des encadrements et rebords accessibles.",
      "Finition des vitrages.",
    ],
  },
  murs: {
    titre: "Lessivage des murs",
    base: [
      "Lessivage des murs sur les supports lavables du périmètre convenu.",
    ],
    standard: [
      "Traitement des traces et salissures localisées.",
      "Rinçage et séchage des surfaces traitées.",
    ],
    complet: [
      "Adaptation de la technique et du dosage à la nature des revêtements.",
    ],
  },
  plafonds: {
    titre: "Nettoyage des plafonds",
    base: [
      "Nettoyage des plafonds sur le périmètre convenu.",
    ],
    standard: [
      "Dépoussiérage des angles, corniches et jonctions accessibles.",
    ],
  },
  desinfection: {
    titre: "Désinfection",
    base: [
      "Application d'un produit désinfectant sur les surfaces concernées.",
      "Traitement des points de contact et des zones à risque identifiées.",
    ],
    standard: [
      "Respect des temps de contact propres aux produits mis en œuvre.",
      "Ventilation des locaux à l'issue du traitement.",
    ],
    complet: [
      "Traitement différencié des surfaces poreuses et non poreuses.",
    ],
  },
  decontamination: {
    titre: "Décontamination",
    base: [
      "Décontamination des zones identifiées lors de la découverte.",
      "Élimination et conditionnement des matériaux souillés non récupérables.",
    ],
    standard: [
      "Mise en œuvre d'un protocole adapté à la nature de la contamination.",
      "Évacuation des déchets vers les filières réglementées correspondantes.",
    ],
    complet: [
      "Confinement de la zone d'intervention pendant les opérations.",
      "Contrôle visuel des surfaces traitées en fin d'intervention.",
    ],
  },
  desodorisation: {
    titre: "Traitement des odeurs",
    base: [
      "Traitement des odeurs résiduelles sur la zone concernée.",
    ],
    standard: [
      "Traitement des supports ayant absorbé les odeurs, dans la limite du périmètre convenu.",
      "Aération et contrôle à l'issue du traitement.",
    ],
  },
  debarras_inclus: {
    titre: "Débarras et évacuation des encombrants",
    base: [
      "Évacuation des encombrants désignés par le client.",
      "Acheminement vers les filières de traitement autorisées.",
    ],
    standard: [
      "Tri des biens sur place selon les instructions du client.",
    ],
  },

  // ── Sinistres ──────────────────────────────────────────────────────
  suies: {
    titre: "Traitement des suies et résidus de combustion",
    base: [
      "Élimination des dépôts de suie sur les surfaces concernées.",
      "Traitement des résidus de combustion présents dans le périmètre.",
    ],
    standard: [
      "Nettoyage différencié selon la nature et la porosité des supports touchés.",
      "Conditionnement et évacuation des éléments non récupérables.",
    ],
    complet: [
      "Traitement des circuits de ventilation et des surfaces hautes atteintes par les fumées.",
      "Traitement des odeurs de combustion imprégnées dans les supports.",
    ],
  },
  degat_eaux: {
    titre: "Traitement consécutif au dégât des eaux",
    base: [
      "Évacuation des eaux résiduelles et des matériaux gorgés d'eau.",
      "Nettoyage des surfaces touchées par l'écoulement.",
    ],
    standard: [
      "Retrait des revêtements décollés ou non récupérables du périmètre convenu.",
      "Traitement des traces et coulures sur les supports concernés.",
    ],
    complet: [
      "Traitement des zones présentant des traces d'humidité stagnante.",
    ],
  },

  // ── Débarras (activité autonome, §7.12) ────────────────────────────
  tri: {
    titre: "Tri et préparation des biens",
    base: [
      "Tri des biens sur place selon les instructions du client.",
      "Identification des biens à conserver, préalablement désignés par le client.",
    ],
    standard: [
      "Séparation des flux en vue de leur orientation vers les filières appropriées.",
    ],
  },
  manutention: {
    titre: "Manutention et chargement",
    base: [
      "Chargement et sortie des biens jusqu'au véhicule.",
    ],
    standard: [
      "Protection des parties communes et des accès pendant les opérations.",
      "Manutention adaptée aux contraintes d'accès relevées.",
    ],
  },
  evacuation: {
    titre: "Évacuation et traitement des déchets",
    base: [
      "Transport et évacuation vers les filières de traitement autorisées.",
      "Remise des justificatifs de traitement des déchets.",
    ],
    standard: [
      "Orientation des déchets valorisables vers les filières de recyclage.",
    ],
  },

  // ── Déménagement et transport (§7.14) ──────────────────────────────
  emballage: {
    titre: "Emballage et protection",
    base: [
      "Protection du mobilier durant les opérations de manutention et de transport.",
    ],
    standard: [
      "Conditionnement des biens fragiles dans des contenants adaptés.",
    ],
  },
  transport_mobilier: {
    titre: "Chargement et transport",
    base: [
      "Chargement méthodique du mobilier, des cartons et de l'électroménager.",
      "Transport sécurisé jusqu'au lieu de destination.",
    ],
    standard: [
      "Calage et arrimage des biens dans le véhicule.",
    ],
  },
  installation: {
    titre: "Déchargement et installation",
    base: [
      "Déchargement de l'ensemble des biens.",
      "Mise en place du mobilier et des cartons dans les pièces indiquées par le client.",
    ],
  },
  transport_objet: {
    titre: "Enlèvement, transport et livraison",
    base: [
      "Enlèvement des biens au lieu convenu.",
      "Transport sécurisé jusqu'au lieu de livraison.",
      "Remise des biens au destinataire désigné.",
    ],
    standard: [
      "Protection des biens pendant le transport.",
    ],
  },
};

/** Opérations d'un thème pour un niveau de développement donné (§10). */
export function operationsDe(theme: Theme, niveau: Niveau): string[] {
  const c = OPERATIONS[theme];
  const out = [...c.base];
  if (niveau >= 2 && c.standard) out.push(...c.standard);
  if (niveau >= 3 && c.complet) out.push(...c.complet);
  return out;
}

export function titreDe(theme: Theme): string {
  return OPERATIONS[theme].titre;
}

// ══════════════════════════════════════════════════════════════════════
//  MENTIONS ET RÉSERVES
// ══════════════════════════════════════════════════════════════════════

/**
 * ⚠️ LA MENTION DES PRODUITS N'EST PLUS UNE CONSTANTE DE LA BIBLIOTHÈQUE.
 *
 * Elle était ici, et `analyserNettoyage()` la posait en dur : la phrase
 * « produits 100 % français et écoresponsables » partait donc sur les devis
 * des sept sociétés du CRM, dans les cinq pays, sans qu'aucune règle métier
 * ne l'autorise. C'est une affirmation sur l'origine et sur le caractère
 * environnemental d'un produit : elle engage la société qui l'écrit.
 *
 * Depuis la correction C1 du 2026-11-06, elle se saisit PAR SOCIÉTÉ dans
 * Réglages › Intégrations, elle est stockée dans `app_settings`, et son
 * absence est le défaut. Le texte historique survit comme SUGGESTION de
 * saisie — `SUGGESTION_HISTORIQUE` dans lib/generation/mentions-produits.ts —
 * et il n'est jamais appliqué tout seul.
 *
 * Ne pas réintroduire de constante ici : ce serait reconstituer le défaut.
 */

/** Clause de réévaluation (§12.2), reprise MOT POUR MOT. */
export const RESERVE_REEVALUATION =
  "Le présent devis est établi sur la base des informations communiquées lors "
  + "de la découverte commerciale. Toute différence significative constatée "
  + "concernant l'état des lieux, le niveau d'encrassement, les volumes, "
  + "l'accessibilité ou les contraintes techniques pourra nécessiter une "
  + "proposition de réévaluation des prestations et du montant, soumise à "
  + "l'accord préalable du client avant toute intervention supplémentaire.";

export const RESERVE_NON_SIGNALE =
  "Les difficultés non visibles lors de la découverte, les contraintes "
  + "techniques et les éléments non signalés au moment de l'établissement du "
  + "devis pourront donner lieu à une réévaluation après accord du client.";

export const RESERVE_SUPPORTS =
  "Les dégradations préexistantes des supports, revêtements et équipements ne "
  + "relèvent pas de la présente prestation et ne peuvent être corrigées par "
  + "le nettoyage.";

/** §12.4 — insalubrité. */
export const RESERVE_INSALUBRE =
  "Les conditions réelles d'intervention en logement insalubre ne peuvent être "
  + "pleinement appréciées avant le début des opérations. La découverte d'un "
  + "encombrement, d'un volume de déchets, d'une infestation ou d'une "
  + "contamination supérieurs à ceux annoncés donnera lieu à une réévaluation "
  + "après accord du client.";

/** §12.3 — volumes déclarés. */
export const RESERVE_VOLUME =
  "Le devis est établi sur le volume annoncé lors de la découverte. Tout "
  + "volume supplémentaire constaté sur place sera signalé au client avant "
  + "poursuite de l'intervention et fera l'objet d'un accord écrit préalable.";

export const RESERVE_BIENS_CONSERVES =
  "Les biens à conserver doivent être identifiés par le client avant le début "
  + "de l'intervention. Aucun bien n'est évacué sans autorisation.";

export const RESERVE_DECHETS_REGLEMENTES =
  "Les déchets dangereux, l'amiante et les produits réglementés ne sont pas "
  + "compris dans le présent devis et relèvent de filières spécifiques.";

export const RESERVE_VITRERIE_INACCESSIBLE =
  "Les vitrages inaccessibles sans équipement spécifique (nacelle, échafaudage) "
  + "sont exclus du présent devis et feront l'objet d'une proposition distincte.";

/** §9, cas 1 — lessivage validé. */
export const RESERVE_MURS_LAVABLES =
  "Le lessivage des murs est réalisé sur les supports lavables. Les revêtements "
  + "fragiles, dégradés ou non lessivables sont exclus.";

/**
 * §9, cas 3 — lessivage explicitement EXCLU.
 *
 * Ne sort que sur exclusion explicite, jamais sur une absence de demande :
 * le §9 distingue « non demandé » (on ne dit rien) de « exclu » (on le dit).
 */
export const RESERVE_MURS_EXCLUS =
  "Le lessivage des murs et des plafonds n'est pas compris dans le présent "
  + "devis.";

export const RESERVE_VITRERIE_EXCLUE =
  "Le nettoyage de la vitrerie n'est pas compris dans le présent devis.";

/** §7.9 — aucune promesse de résultat sanitaire (interdiction 26). */
export const RESERVE_SANITAIRE =
  "La prestation consiste en un nettoyage, une désinfection et une "
  + "décontamination des surfaces accessibles selon les protocoles mis en "
  + "œuvre. Elle ne constitue ni une analyse, ni une expertise, ni une "
  + "garantie d'absence totale d'agents biologiques.";

/** §7.11 — pas d'assèchement ni de traitement antifongique implicite. */
export const RESERVE_ASSECHEMENT =
  "L'assèchement technique des structures, la recherche de fuite et le "
  + "traitement antifongique des matériaux ne sont pas compris dans le présent "
  + "devis et relèvent d'interventions spécifiques.";

/** §7.10 — l'état des matériaux après incendie conditionne le résultat. */
export const RESERVE_INCENDIE =
  "Les matériaux et revêtements dégradés par le feu, la chaleur ou les fumées "
  + "peuvent ne pas être récupérables par nettoyage. Leur remplacement ne "
  + "relève pas du présent devis.";

/** §7.16 — traitements de nuisibles. */
export const RESERVE_NUISIBLES =
  "Le traitement des nuisibles est réalisé par une entreprise habilitée. Son "
  + "efficacité dépend de l'étendue réelle de l'infestation, qui peut "
  + "nécessiter des passages complémentaires.";

/** Réserves systématiques de la famille, en complément des réserves du chantier. */
export const RESERVES_PAR_FAMILLE: Partial<Record<FamilleNettoyage, readonly string[]>> = {
  apres_deces: [RESERVE_SANITAIRE],
  apres_incendie: [RESERVE_INCENDIE],
  apres_degat_eaux: [RESERVE_ASSECHEMENT],
  insalubre: [RESERVE_INSALUBRE],
  diogene: [RESERVE_INSALUBRE],
  apres_squat: [RESERVE_INSALUBRE],
};
