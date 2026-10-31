// Bibliothèque des prestations sous-traitables — PURE, aucune I/O.
//
// C'est le pivot du moteur de contrats : chaque prestation déclare ce qu'elle
// ENTRAÎNE juridiquement (articles, obligations de sécurité, assurances et
// qualifications). Cocher « Remplacement de WC » n'ajoute pas seulement une
// ligne de prix : cela fait apparaître les obligations de plomberie, et
// décocher la prestation les retire — sauf si une autre prestation retenue
// les exige encore.
//
// Les PRIX n'apparaissent nulle part ici. Ceux du sous-traitant sont saisis
// par la planificatrice, ceux du client vivent dans le devis : les deux
// restent étanches (§17).

/** Les quatre familles du cahier des charges (§14). */
export type Famille = "nettoyage" | "debarras" | "complements" | "transport";

export const FAMILLE_LABEL: Record<Famille, string> = {
  nettoyage: "Nettoyage",
  debarras: "Débarras",
  complements: "Compléments d'activité",
  transport: "Déménagement et transport",
};

/** Unité de facturation proposée par défaut. La planificatrice peut la changer. */
export type Unite = "forfait" | "m2" | "m3" | "h" | "u" | "km";

export const UNITE_LABEL: Record<Unite, string> = {
  forfait: "Forfait",
  m2: "m²",
  m3: "m³",
  h: "heure",
  u: "unité",
  km: "km",
};

/**
 * Exigences déclenchées par une prestation.
 *
 * `articles` référence les clés d'articles de lib/sous-traitance/clauses.ts.
 * Rien n'est dupliqué : le texte juridique vit à un seul endroit.
 */
export type Exigences = {
  /** Articles conditionnels à faire apparaître au contrat. */
  articles: string[];
  /** Équipements de protection et consignes, en clair. */
  securite: string[];
  /** Assurances à vérifier avant d'envoyer le contrat. */
  assurances: string[];
  /** Qualifications ou autorisations à vérifier. */
  qualifications: string[];
};

export type Prestation = {
  code: string;
  label: string;
  famille: Famille;
  /** Descriptif repris au contrat et à l'ordre de mission. */
  descriptif: string;
  uniteDefaut: Unite;
  /** true = la fourniture est en principe à la charge du sous-traitant. */
  fournituresParDefaut: boolean;
  exigences: Exigences;
};

// Raccourci de lecture : la plupart des prestations ne déclenchent qu'une
// partie des quatre catégories.
const ex = (p: Partial<Exigences>): Exigences => ({
  articles: p.articles ?? [],
  securite: p.securite ?? [],
  assurances: p.assurances ?? [],
  qualifications: p.qualifications ?? [],
});

// Exigences communes à toute intervention de nettoyage.
const EPI_NETTOYAGE = ["Gants et chaussures de sécurité", "Protection adaptée aux produits utilisés"];
const RC_PRO = ["Responsabilité civile professionnelle"];

export const PRESTATIONS: Prestation[] = [
  // ── Famille NETTOYAGE ───────────────────────────────────────────────
  {
    code: "net_courant", label: "Nettoyage courant", famille: "nettoyage",
    descriptif: "Nettoyage d'entretien des surfaces, sols et sanitaires.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({ articles: ["produits"], securite: EPI_NETTOYAGE, assurances: RC_PRO }),
  },
  {
    code: "net_approfondi", label: "Nettoyage approfondi", famille: "nettoyage",
    descriptif: "Nettoyage en profondeur de l'ensemble des surfaces, y compris les points habituellement non traités en entretien courant.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({ articles: ["produits"], securite: EPI_NETTOYAGE, assurances: RC_PRO }),
  },
  {
    code: "net_apres_demenagement", label: "Nettoyage après déménagement", famille: "nettoyage",
    descriptif: "Remise en état d'un logement vidé, sols, murs lavables, sanitaires et cuisine.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({ articles: ["produits"], securite: EPI_NETTOYAGE, assurances: RC_PRO }),
  },
  {
    code: "net_apres_travaux", label: "Nettoyage après travaux", famille: "nettoyage",
    descriptif: "Élimination des poussières et résidus de chantier, décollage des protections, nettoyage fin des surfaces.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "dechets_chantier"],
      securite: [...EPI_NETTOYAGE, "Masque anti-poussières", "Lunettes de protection"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "net_insalubre", label: "Nettoyage de logement insalubre", famille: "nettoyage",
    descriptif: "Intervention en milieu insalubre : évacuation des souillures, nettoyage et assainissement des surfaces.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "risque_biologique", "tracabilite_dechets"],
      securite: [
        "Combinaison de protection à usage unique",
        "Masque respiratoire adapté au risque identifié",
        "Gants résistants et lunettes de protection",
        "Protocole de décontamination en fin de poste",
      ],
      assurances: RC_PRO,
      qualifications: ["Personnel formé au travail en milieu insalubre"],
    }),
  },
  {
    code: "net_diogene", label: "Nettoyage Diogène", famille: "nettoyage",
    descriptif: "Intervention en syndrome de Diogène : évacuation des encombrants, nettoyage, désinfection et désodorisation.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "risque_biologique", "tracabilite_dechets", "objets_conserver"],
      securite: [
        "Combinaison de protection à usage unique",
        "Masque respiratoire adapté au risque identifié",
        "Gants résistants et lunettes de protection",
        "Protocole de décontamination en fin de poste",
      ],
      assurances: RC_PRO,
      qualifications: ["Personnel formé au travail en milieu insalubre"],
    }),
  },
  {
    code: "net_apres_sinistre", label: "Nettoyage après sinistre", famille: "nettoyage",
    descriptif: "Nettoyage consécutif à un dégât des eaux, un incendie ou un autre sinistre, y compris traitement des odeurs.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "tracabilite_dechets", "constat_prealable"],
      securite: [...EPI_NETTOYAGE, "Masque respiratoire adapté au risque identifié"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "net_vitres", label: "Nettoyage des vitres", famille: "nettoyage",
    descriptif: "Nettoyage des vitrages et des encadrements accessibles, faces précisées à l'ordre de mission.",
    uniteDefaut: "u", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "travail_hauteur"],
      securite: [...EPI_NETTOYAGE, "Matériel de travail en hauteur conforme si nécessaire"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "net_murs", label: "Lessivage des murs", famille: "nettoyage",
    descriptif: "Lessivage des surfaces murales lavables.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({ articles: ["produits"], securite: EPI_NETTOYAGE, assurances: RC_PRO }),
  },
  {
    code: "net_plafonds", label: "Nettoyage des plafonds", famille: "nettoyage",
    descriptif: "Nettoyage des plafonds et de leurs équipements accessibles.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "travail_hauteur"],
      securite: [...EPI_NETTOYAGE, "Matériel de travail en hauteur conforme"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "net_desinfection", label: "Désinfection", famille: "nettoyage",
    descriptif: "Application de produits désinfectants sur les surfaces désignées.",
    uniteDefaut: "m2", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "produits_biocides", "risque_biologique"],
      securite: [...EPI_NETTOYAGE, "Masque adapté aux produits appliqués", "Ventilation des locaux traités"],
      assurances: RC_PRO,
      qualifications: ["Personnel formé à l'emploi des produits biocides"],
    }),
  },
  {
    code: "net_desodorisation", label: "Désodorisation", famille: "nettoyage",
    descriptif: "Traitement des odeurs résiduelles par les moyens appropriés.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({ articles: ["produits", "produits_biocides"], securite: EPI_NETTOYAGE, assurances: RC_PRO }),
  },
  {
    code: "net_decontamination", label: "Décontamination", famille: "nettoyage",
    descriptif: "Décontamination des surfaces selon le protocole défini à l'ordre de mission.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "produits_biocides", "risque_biologique", "tracabilite_dechets"],
      securite: [
        "Combinaison de protection à usage unique",
        "Masque respiratoire adapté au risque identifié",
        "Protocole de décontamination en fin de poste",
      ],
      assurances: RC_PRO,
      qualifications: ["Personnel formé aux opérations de décontamination"],
    }),
  },
  {
    code: "net_hotte", label: "Nettoyage de hotte professionnelle", famille: "nettoyage",
    descriptif: "Dégraissage de la hotte, des filtres et des conduits accessibles, avec remise d'un certificat.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["produits", "travail_hauteur", "certificat_hotte"],
      securite: [...EPI_NETTOYAGE, "Consignation des équipements avant intervention"],
      assurances: RC_PRO,
      qualifications: ["Habilitation à l'entretien des systèmes d'extraction"],
    }),
  },

  // ── Famille DÉBARRAS ────────────────────────────────────────────────
  {
    code: "deb_complet", label: "Débarras complet", famille: "debarras",
    descriptif: "Débarras de l'intégralité du bien, tri, chargement, transport et évacuation en filière autorisée.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "objets_valeur", "tracabilite_dechets", "volume_contractuel"],
      securite: [...EPI_NETTOYAGE, "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_partiel", label: "Débarras partiel", famille: "debarras",
    descriptif: "Débarras limité aux éléments et zones expressément désignés à l'ordre de mission.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "objets_valeur", "tracabilite_dechets", "volume_contractuel"],
      securite: [...EPI_NETTOYAGE, "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_encombrants", label: "Enlèvement d'encombrants", famille: "debarras",
    descriptif: "Enlèvement et évacuation des encombrants désignés.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "tracabilite_dechets", "volume_contractuel"],
      securite: [...EPI_NETTOYAGE, "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_mobilier", label: "Évacuation de mobilier", famille: "debarras",
    descriptif: "Démontage si nécessaire, sortie et évacuation du mobilier désigné.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "tracabilite_dechets", "volume_contractuel"],
      securite: [...EPI_NETTOYAGE, "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_tri_dechets", label: "Tri et évacuation des déchets", famille: "debarras",
    descriptif: "Tri par flux et remise en filière autorisée, avec justificatifs de traitement.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["tracabilite_dechets", "tracabilite_dechets"],
      securite: EPI_NETTOYAGE,
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_cave", label: "Débarras de cave", famille: "debarras",
    descriptif: "Débarras d'une cave, y compris portage jusqu'au véhicule.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "tracabilite_dechets", "volume_contractuel", "portage"],
      securite: [...EPI_NETTOYAGE, "Éclairage d'appoint", "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_grenier", label: "Débarras de grenier", famille: "debarras",
    descriptif: "Débarras d'un grenier ou de combles, y compris portage jusqu'au véhicule.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "tracabilite_dechets", "volume_contractuel", "portage", "travail_hauteur"],
      securite: [...EPI_NETTOYAGE, "Masque anti-poussières", "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_garage", label: "Débarras de garage", famille: "debarras",
    descriptif: "Débarras d'un garage ou d'un box, y compris évacuation des produits identifiés.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "tracabilite_dechets", "volume_contractuel"],
      securite: [...EPI_NETTOYAGE, "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "deb_insalubre", label: "Débarras de logement insalubre", famille: "debarras",
    descriptif: "Débarras en milieu insalubre, évacuation et remise en filière autorisée.",
    uniteDefaut: "m3", fournituresParDefaut: true,
    exigences: ex({
      articles: ["objets_conserver", "objets_valeur", "risque_biologique", "tracabilite_dechets", "volume_contractuel"],
      securite: [
        "Combinaison de protection à usage unique",
        "Masque respiratoire adapté au risque identifié",
        "Gants résistants et lunettes de protection",
        "Protocole de décontamination en fin de poste",
      ],
      assurances: RC_PRO,
      qualifications: ["Personnel formé au travail en milieu insalubre"],
    }),
  },

  // ── Famille COMPLÉMENTS D'ACTIVITÉ ──────────────────────────────────
  {
    code: "cpl_peinture_murs", label: "Peinture des murs", famille: "complements",
    descriptif: "Préparation des supports et application de la peinture sur les surfaces murales désignées.",
    uniteDefaut: "m2", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux"],
      securite: [...EPI_NETTOYAGE, "Ventilation des locaux", "Protection des sols et du mobilier"],
      assurances: [...RC_PRO, "Assurance décennale pour les travaux de bâtiment concernés"],
      qualifications: ["Qualification en travaux de peinture"],
    }),
  },
  {
    code: "cpl_peinture_plafonds", label: "Peinture des plafonds", famille: "complements",
    descriptif: "Préparation et mise en peinture des plafonds désignés.",
    uniteDefaut: "m2", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux", "travail_hauteur"],
      securite: [...EPI_NETTOYAGE, "Matériel de travail en hauteur conforme", "Protection des sols et du mobilier"],
      assurances: [...RC_PRO, "Assurance décennale pour les travaux de bâtiment concernés"],
      qualifications: ["Qualification en travaux de peinture"],
    }),
  },
  {
    code: "cpl_rebouchage", label: "Rebouchage", famille: "complements",
    descriptif: "Rebouchage des trous et fissures superficielles, ponçage des reprises.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux"],
      securite: [...EPI_NETTOYAGE, "Masque anti-poussières"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "cpl_reparations", label: "Petites réparations", famille: "complements",
    descriptif: "Réparations ponctuelles désignées à l'ordre de mission.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux"],
      securite: EPI_NETTOYAGE, assurances: RC_PRO,
    }),
  },
  {
    code: "cpl_plomberie", label: "Plomberie", famille: "complements",
    descriptif: "Travaux de plomberie désignés, y compris mise hors d'eau et essais d'étanchéité.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["plomberie", "fournitures", "reception_travaux"],
      securite: [...EPI_NETTOYAGE, "Coupure et consignation de l'arrivée d'eau avant intervention"],
      assurances: [...RC_PRO, "Assurance décennale pour les travaux de bâtiment concernés"],
      qualifications: ["Qualification en plomberie"],
    }),
  },
  {
    code: "cpl_wc", label: "Remplacement de WC", famille: "complements",
    descriptif: "Dépose de l'appareil existant, pose et raccordement du nouvel appareil, essais d'étanchéité.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["plomberie", "fournitures", "reception_travaux", "evacuation_depose"],
      securite: [...EPI_NETTOYAGE, "Coupure et consignation de l'arrivée d'eau avant intervention"],
      assurances: [...RC_PRO, "Assurance décennale pour les travaux de bâtiment concernés"],
      qualifications: ["Qualification en plomberie"],
    }),
  },
  {
    code: "cpl_portes", label: "Réparation de portes", famille: "complements",
    descriptif: "Réglage, réparation ou remplacement des éléments de porte désignés.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux"],
      securite: EPI_NETTOYAGE, assurances: RC_PRO,
      qualifications: ["Qualification en menuiserie"],
    }),
  },
  {
    code: "cpl_placards", label: "Réparation de placards", famille: "complements",
    descriptif: "Réparation ou remise en état des placards et de leurs ferrures.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux"],
      securite: EPI_NETTOYAGE, assurances: RC_PRO,
      qualifications: ["Qualification en menuiserie"],
    }),
  },
  {
    code: "cpl_menuiserie", label: "Menuiserie", famille: "complements",
    descriptif: "Travaux de menuiserie désignés à l'ordre de mission.",
    uniteDefaut: "u", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux"],
      securite: [...EPI_NETTOYAGE, "Protection auditive et lunettes pour les travaux de coupe"],
      assurances: [...RC_PRO, "Assurance décennale pour les travaux de bâtiment concernés"],
      qualifications: ["Qualification en menuiserie"],
    }),
  },
  {
    code: "cpl_renovation", label: "Petits travaux de rénovation", famille: "complements",
    descriptif: "Travaux de rénovation de second œuvre désignés à l'ordre de mission.",
    uniteDefaut: "forfait", fournituresParDefaut: false,
    exigences: ex({
      articles: ["fournitures", "reception_travaux", "dechets_chantier"],
      securite: EPI_NETTOYAGE,
      assurances: [...RC_PRO, "Assurance décennale pour les travaux de bâtiment concernés"],
      qualifications: ["Qualification correspondant aux travaux confiés"],
    }),
  },
  {
    code: "cpl_autre", label: "Autre prestation personnalisée", famille: "complements",
    descriptif: "Prestation décrite librement à l'ordre de mission, soumise à validation préalable.",
    uniteDefaut: "forfait", fournituresParDefaut: false,
    exigences: ex({
      articles: ["prestation_a_preciser", "fournitures"],
      assurances: RC_PRO,
    }),
  },

  // ── Famille DÉMÉNAGEMENT ET TRANSPORT ───────────────────────────────
  {
    code: "tr_demenagement_complet", label: "Déménagement complet", famille: "transport",
    descriptif: "Protection, démontage si prévu, chargement, transport, déchargement et mise en place au lieu de destination.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
                 "protection_biens", "chargement_arrimage", "acces_manutention", "inventaire",
                 "incidents_transport", "livraison", "frais_transport"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention",
                 "Sangles et dispositifs d'arrimage conformes"],
      assurances: [...RC_PRO, "Assurance automobile obligatoire des véhicules utilisés",
                   "Responsabilité du transporteur pour les biens pris en charge"],
      qualifications: ["Inscription au registre des transporteurs lorsqu'elle est obligatoire",
                       "Licence de transport correspondant aux véhicules utilisés"],
    }),
  },
  {
    code: "tr_demenagement_partiel", label: "Déménagement partiel", famille: "transport",
    descriptif: "Déménagement limité aux biens expressément désignés à l'ordre de mission.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
                 "protection_biens", "chargement_arrimage", "acces_manutention", "inventaire",
                 "incidents_transport", "livraison", "frais_transport"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention"],
      assurances: [...RC_PRO, "Assurance automobile obligatoire des véhicules utilisés",
                   "Responsabilité du transporteur pour les biens pris en charge"],
      qualifications: ["Inscription au registre des transporteurs lorsqu'elle est obligatoire"],
    }),
  },
  {
    code: "tr_mobilier", label: "Transport de mobilier", famille: "transport",
    descriptif: "Prise en charge, transport et livraison du mobilier désigné.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
                 "protection_biens", "chargement_arrimage", "incidents_transport", "livraison", "frais_transport"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention"],
      assurances: [...RC_PRO, "Assurance automobile obligatoire des véhicules utilisés",
                   "Responsabilité du transporteur pour les biens pris en charge"],
      qualifications: ["Inscription au registre des transporteurs lorsqu'elle est obligatoire"],
    }),
  },
  {
    code: "tr_objets", label: "Transport d'objets", famille: "transport",
    descriptif: "Prise en charge, transport et livraison des objets désignés.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
                 "protection_biens", "chargement_arrimage", "incidents_transport", "livraison", "frais_transport"],
      securite: ["Chaussures de sécurité et gants"],
      assurances: [...RC_PRO, "Assurance automobile obligatoire des véhicules utilisés",
                   "Responsabilité du transporteur pour les biens pris en charge"],
      qualifications: ["Inscription au registre des transporteurs lorsqu'elle est obligatoire"],
    }),
  },
  {
    code: "tr_chargement", label: "Chargement", famille: "transport",
    descriptif: "Opérations de chargement du véhicule, répartition et arrimage de la charge.",
    uniteDefaut: "h", fournituresParDefaut: true,
    exigences: ex({
      articles: ["chargement_arrimage", "acces_manutention", "protection_biens"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention",
                 "Sangles et dispositifs d'arrimage conformes"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "tr_dechargement", label: "Déchargement", famille: "transport",
    descriptif: "Opérations de déchargement et de dépose au lieu de destination.",
    uniteDefaut: "h", fournituresParDefaut: true,
    exigences: ex({
      articles: ["chargement_arrimage", "acces_manutention", "protection_biens", "livraison"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "tr_manutention", label: "Manutention", famille: "transport",
    descriptif: "Opérations de manutention sur site, hors transport.",
    uniteDefaut: "h", fournituresParDefaut: true,
    exigences: ex({
      articles: ["acces_manutention", "protection_biens"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "tr_portage", label: "Portage", famille: "transport",
    descriptif: "Portage des biens entre le lieu de prise en charge et le véhicule, ou inversement.",
    uniteDefaut: "h", fournituresParDefaut: true,
    exigences: ex({
      articles: ["acces_manutention", "portage", "protection_biens"],
      securite: ["Chaussures de sécurité et gants", "Protection lombaire et gestes de manutention"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "tr_demontage", label: "Démontage de mobilier", famille: "transport",
    descriptif: "Démontage du mobilier désigné, repérage et conservation des pièces de fixation.",
    uniteDefaut: "u", fournituresParDefaut: true,
    exigences: ex({
      articles: ["demontage_remontage", "protection_biens"],
      securite: ["Chaussures de sécurité et gants"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "tr_remontage", label: "Remontage de mobilier", famille: "transport",
    descriptif: "Remontage du mobilier au lieu de destination et vérification de sa stabilité.",
    uniteDefaut: "u", fournituresParDefaut: true,
    exigences: ex({
      articles: ["demontage_remontage", "protection_biens", "reception_travaux"],
      securite: ["Chaussures de sécurité et gants"],
      assurances: RC_PRO,
    }),
  },
  {
    code: "tr_protection", label: "Protection des meubles", famille: "transport",
    descriptif: "Emballage et protection des biens : couvertures, housses, protections d'angles et de sols.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({ articles: ["protection_biens"], securite: ["Gants"], assurances: RC_PRO }),
  },
  {
    code: "tr_livraison", label: "Livraison", famille: "transport",
    descriptif: "Livraison au destinataire désigné, avec émargement et réserves éventuelles.",
    uniteDefaut: "forfait", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_responsabilite", "livraison", "incidents_transport"],
      securite: ["Chaussures de sécurité et gants"],
      assurances: [...RC_PRO, "Responsabilité du transporteur pour les biens pris en charge"],
    }),
  },
  {
    code: "tr_longue_distance", label: "Transport longue distance", famille: "transport",
    descriptif: "Transport sur longue distance, avec les temps de conduite et de repos applicables.",
    uniteDefaut: "km", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
                 "chargement_arrimage", "temps_conduite", "incidents_transport", "livraison", "frais_transport"],
      securite: ["Chaussures de sécurité et gants", "Respect des temps de conduite et de repos"],
      assurances: [...RC_PRO, "Assurance automobile obligatoire des véhicules utilisés",
                   "Responsabilité du transporteur pour les biens pris en charge"],
      qualifications: ["Inscription au registre des transporteurs lorsqu'elle est obligatoire",
                       "Licence de transport correspondant aux véhicules utilisés"],
    }),
  },
  {
    code: "tr_international", label: "Transport international", famille: "transport",
    descriptif: "Transport à destination ou en provenance de l'étranger, avec les formalités correspondantes.",
    uniteDefaut: "km", fournituresParDefaut: true,
    exigences: ex({
      articles: ["transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
                 "chargement_arrimage", "temps_conduite", "incidents_transport", "livraison",
                 "frais_transport", "transport_international"],
      securite: ["Chaussures de sécurité et gants", "Respect des temps de conduite et de repos"],
      assurances: [...RC_PRO, "Assurance automobile obligatoire des véhicules utilisés",
                   "Responsabilité du transporteur pour les biens pris en charge"],
      qualifications: ["Inscription au registre des transporteurs lorsqu'elle est obligatoire",
                       "Licence de transport correspondant aux véhicules utilisés",
                       "Licence communautaire pour les opérations internationales"],
    }),
  },
];

const PAR_CODE = new Map(PRESTATIONS.map((p) => [p.code, p]));

export function prestationParCode(code: string): Prestation | null {
  return PAR_CODE.get(code) ?? null;
}

export function prestationsParFamille(f: Famille): Prestation[] {
  return PRESTATIONS.filter((p) => p.famille === f);
}

/** Familles effectivement engagées par une sélection de prestations. */
export function famillesDe(codes: readonly string[]): Famille[] {
  const out = new Set<Famille>();
  for (const c of codes) {
    const p = PAR_CODE.get(c);
    if (p) out.add(p.famille);
  }
  // Ordre stable, celui du cahier des charges.
  return (["nettoyage", "debarras", "complements", "transport"] as Famille[]).filter((f) => out.has(f));
}

/**
 * Exigences cumulées d'une sélection, dédoublonnées.
 *
 * C'est ce qui permet de retirer une prestation sans perdre une obligation
 * qu'une autre impose encore : on recalcule l'union à chaque changement
 * plutôt que d'ajouter et de retirer au fil de l'eau (§15).
 */
export function exigencesCumulees(codes: readonly string[]): Exigences {
  const articles = new Set<string>();
  const securite = new Set<string>();
  const assurances = new Set<string>();
  const qualifications = new Set<string>();
  for (const c of codes) {
    const p = PAR_CODE.get(c);
    if (!p) continue;
    for (const x of p.exigences.articles) articles.add(x);
    for (const x of p.exigences.securite) securite.add(x);
    for (const x of p.exigences.assurances) assurances.add(x);
    for (const x of p.exigences.qualifications) qualifications.add(x);
  }
  return {
    articles: [...articles],
    securite: [...securite],
    assurances: [...assurances],
    qualifications: [...qualifications],
  };
}
