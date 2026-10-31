// Socle juridique des contrats de sous-traitance — PUR, aucune I/O.
//
// ⚠️ TEXTE À FAIRE VALIDER PAR UN JURISTE AVANT MISE EN PRODUCTION.
// Le cahier des charges le demande expressément (§4). Ce fichier fournit une
// rédaction de travail, structurée et complète ; il ne remplace pas une
// relecture juridique.
//
// DEUX NIVEAUX, et c'est tout l'intérêt :
//   • SOCLE — les 31 articles du contrat-cadre OPTIMIVV. Ils figurent dans les
//     quatre modèles, parce que ce sont eux qui protègent le donneur d'ordre.
//   • CONDITIONNELS — articles ajoutés UNIQUEMENT si une prestation retenue
//     les appelle. C'est la bibliothèque de prestations qui le décide, via
//     `exigences.articles` : aucune règle n'est écrite deux fois.
//
// Retirer une prestation retire ses articles — sauf si une autre prestation
// encore retenue les exige. L'union est recalculée à chaque fois, jamais
// ajoutée puis défaite au fil des clics.

import { exigencesCumulees, famillesDe, type Famille } from "./prestations";

export type Article = {
  cle: string;
  titre: string;
  corps: string;
  /** Référence légale ou conventionnelle, affichée en petit sous l'article. */
  reference?: string;
};

/** Les quatre modèles du cahier des charges (§3). */
export type ModeleContrat =
  | "nettoyage_approfondi"
  | "nettoyage_debarras"
  | "nettoyage_complements"
  | "demenagement_transport";

export const MODELE_LABEL: Record<ModeleContrat, string> = {
  nettoyage_approfondi: "Contrat 1 — Nettoyage approfondi",
  nettoyage_debarras: "Contrat 2 — Nettoyage avec débarras",
  nettoyage_complements: "Contrat 3 — Nettoyage avec compléments d'activité",
  demenagement_transport: "Contrat 4 — Déménagement et transport",
};

/** Version du jeu de modèles. Figée sur chaque contrat généré (§29). */
export const VERSION_MODELES = "1.0";

// ══════════════════════════════════════════════════════════════════════
//  SOCLE — les 31 articles du contrat-cadre
// ══════════════════════════════════════════════════════════════════════

export const SOCLE: Article[] = [
  {
    cle: "objet",
    titre: "Objet du contrat",
    corps:
      "Le donneur d'ordre confie au sous-traitant, qui l'accepte, l'exécution des prestations "
      + "décrites à l'ordre de mission annexé au présent contrat. Le sous-traitant les exécute "
      + "sous sa propre responsabilité, dans le respect des règles de l'art et des instructions "
      + "portées à l'ordre de mission. L'ordre de mission fait partie intégrante du contrat.",
  },
  {
    cle: "independance",
    titre: "Indépendance et responsabilité du sous-traitant",
    corps:
      "Le sous-traitant est un entrepreneur indépendant. Il organise librement son travail, "
      + "dirige seul son personnel et assume l'entière responsabilité de l'exécution des "
      + "prestations. Le présent contrat ne crée aucun lien de subordination entre le donneur "
      + "d'ordre et le sous-traitant ou son personnel, ni aucune société de fait.",
  },
  {
    cle: "declarations",
    titre: "Déclarations administratives, sociales et fiscales",
    corps:
      "Le sous-traitant déclare être régulièrement immatriculé, exercer son activité en "
      + "conformité avec la réglementation applicable et être à jour de ses obligations "
      + "déclaratives et de paiement en matière sociale et fiscale. Il emploie un personnel "
      + "régulièrement déclaré. Il s'engage à remettre au donneur d'ordre, à sa demande et au "
      + "moins tous les six mois, les justificatifs correspondants. Une déclaration sur "
      + "l'honneur ne dispense d'aucune vérification légalement obligatoire.",
    reference: "Articles L. 8222-1 et D. 8222-5 du code du travail",
  },
  {
    cle: "assurances",
    titre: "Assurances professionnelles",
    corps:
      "Le sous-traitant déclare être titulaire des assurances couvrant son activité et les "
      + "prestations confiées, notamment une assurance de responsabilité civile "
      + "professionnelle en cours de validité. Il remet les attestations correspondantes avant "
      + "tout commencement d'exécution et à chaque renouvellement. Il lui appartient de "
      + "vérifier que les montants garantis, les franchises et les exclusions de ses contrats "
      + "couvrent effectivement les prestations qu'il accepte.",
  },
  {
    cle: "chantier",
    titre: "Identification du chantier et ordre de mission",
    corps:
      "Chaque intervention fait l'objet d'un ordre de mission précisant le lieu, les dates et "
      + "horaires, la nature des prestations, les contraintes d'accès et les consignes "
      + "particulières. Le sous-traitant ne peut intervenir sans ordre de mission. Il vérifie, "
      + "à son arrivée, la concordance entre les conditions réelles et celles décrites, et "
      + "signale toute divergence avant de commencer.",
  },
  {
    cle: "responsabilite_chantier",
    titre: "Responsabilité sur le chantier",
    corps:
      "Le sous-traitant est responsable de son personnel, de son matériel et des biens qui lui "
      + "sont confiés pendant toute la durée de son intervention. Il prend les précautions "
      + "nécessaires pour préserver les lieux, les équipements et les biens du client, et "
      + "répond des dommages qui lui sont imputables.",
  },
  {
    cle: "execution_complete",
    titre: "Exécution complète des prestations",
    corps:
      "Le sous-traitant exécute l'intégralité des prestations portées à l'ordre de mission. "
      + "Il ne peut en abandonner aucune, ni en réduire l'étendue, sans l'accord écrit "
      + "préalable du donneur d'ordre. Une prestation laissée inachevée n'ouvre droit à aucun "
      + "paiement pour la part non exécutée.",
  },
  {
    cle: "alerte",
    titre: "Obligation d'alerte et de signalement",
    corps:
      "Le sous-traitant informe sans délai le donneur d'ordre de tout fait susceptible "
      + "d'affecter l'exécution de la mission : impossibilité d'accéder aux lieux, état des "
      + "lieux différent de celui annoncé, risque pour les personnes ou les biens, découverte "
      + "d'un désordre préexistant, retard prévisible. Il ne prend aucune initiative "
      + "susceptible d'engager le donneur d'ordre sans son accord.",
  },
  {
    cle: "personnel",
    titre: "Personnel et organisation des équipes",
    corps:
      "Le sous-traitant affecte à la mission un personnel compétent, formé aux tâches "
      + "confiées et régulièrement déclaré. Il communique au donneur d'ordre, à sa demande, "
      + "la composition de l'équipe intervenante. Il est seul employeur de son personnel et "
      + "assume toutes les obligations qui en découlent.",
  },
  {
    cle: "materiel",
    titre: "Matériel, produits et fournitures",
    corps:
      "Sauf mention contraire à l'ordre de mission, le sous-traitant fournit son matériel, "
      + "ses produits et ses consommables. Le matériel doit être en bon état et conforme à la "
      + "réglementation applicable. La répartition des fournitures est précisée, prestation "
      + "par prestation, à l'ordre de mission.",
  },
  {
    cle: "securite",
    titre: "Sécurité et équipements de protection",
    corps:
      "Le sous-traitant respecte les règles de sécurité applicables et met à disposition de "
      + "son personnel les équipements de protection individuelle adaptés aux risques de la "
      + "mission. Les équipements requis au titre des prestations retenues sont énumérés à "
      + "l'ordre de mission. Le sous-traitant interrompt son intervention et alerte le donneur "
      + "d'ordre dès qu'un risque ne peut être maîtrisé.",
  },
  {
    cle: "sous_traitance_interdite",
    titre: "Interdiction de sous-traitance non autorisée",
    corps:
      "Le sous-traitant exécute personnellement les prestations confiées. Il ne peut les "
      + "sous-traiter, en tout ou partie, sans l'accord écrit et préalable du donneur d'ordre. "
      + "En cas d'accord, il demeure pleinement responsable de l'exécution devant le donneur "
      + "d'ordre.",
  },
  {
    cle: "delais",
    titre: "Respect des dates et délais",
    corps:
      "Le sous-traitant respecte les dates et horaires portés à l'ordre de mission. Tout "
      + "retard prévisible est signalé sans délai. Le donneur d'ordre peut, en cas de retard "
      + "ou d'absence non justifiée, faire exécuter la prestation par un tiers aux frais du "
      + "sous-traitant défaillant, après mise en demeure restée sans effet.",
  },
  {
    cle: "rapport",
    titre: "Rapport d'intervention obligatoire",
    corps:
      "À l'issue de chaque intervention, le sous-traitant remet un rapport mentionnant les "
      + "horaires réels, les prestations réalisées, celles qui ne l'ont pas été et leurs "
      + "motifs, les difficultés rencontrées et les réserves éventuelles. Le rapport "
      + "conditionne la validation de la mission. Une prestation prévue n'est jamais réputée "
      + "réalisée du seul fait qu'elle figurait au contrat.",
  },
  {
    cle: "photos",
    titre: "Photographies avant et après intervention",
    corps:
      "Le sous-traitant réalise des photographies des lieux avant et après son intervention, "
      + "dans la limite de ce qui est nécessaire pour établir l'état des lieux et la bonne "
      + "exécution des prestations. Ces photographies sont transmises au donneur d'ordre avec "
      + "le rapport d'intervention. Elles ne peuvent être utilisées à aucune autre fin, ni "
      + "diffusées, sans l'accord écrit du donneur d'ordre.",
  },
  {
    cle: "controle",
    titre: "Contrôle de conformité",
    corps:
      "Le donneur d'ordre peut contrôler à tout moment la conformité des prestations, sur "
      + "place ou sur la base du rapport et des photographies. Le contrôle ne transfère aucune "
      + "responsabilité au donneur d'ordre et ne vaut pas acceptation des prestations non "
      + "conformes.",
  },
  {
    cle: "reprise",
    titre: "Reprise des prestations non conformes",
    corps:
      "Lorsqu'une non-conformité imputable au sous-traitant est constatée, celui-ci reprend "
      + "les prestations concernées à ses frais, dans le délai fixé par le donneur d'ordre. "
      + "À défaut de reprise dans ce délai, le donneur d'ordre peut faire exécuter les travaux "
      + "nécessaires par un tiers et en imputer le coût au sous-traitant.",
  },
  {
    cle: "dommages",
    titre: "Dommages et dégradations",
    corps:
      "Le sous-traitant répond des dommages causés aux biens, aux locaux et aux tiers du fait "
      + "de son intervention. Il déclare le sinistre à son assureur et en informe le donneur "
      + "d'ordre sans délai. Les dommages constatés sont consignés au rapport d'intervention, "
      + "accompagnés des photographies correspondantes.",
  },
  {
    cle: "relations_client",
    titre: "Relations avec le client",
    corps:
      "Le sous-traitant intervient pour le compte du donneur d'ordre. Il ne négocie aucune "
      + "condition avec le client, ne lui communique aucun prix et ne lui remet aucun document "
      + "commercial. Toute demande du client est transmise au donneur d'ordre, seul habilité à "
      + "y répondre.",
  },
  {
    cle: "confidentialite",
    titre: "Confidentialité et protection de la clientèle",
    corps:
      "Le sous-traitant garde confidentielles toutes les informations dont il a connaissance "
      + "à l'occasion de ses missions, notamment l'identité et les coordonnées des clients, "
      + "les conditions tarifaires et les documents internes. Il s'interdit de démarcher ou de "
      + "contracter directement avec les clients chez lesquels il est intervenu, pendant la "
      + "durée du contrat et pendant douze mois après son terme.",
  },
  {
    cle: "facturation",
    titre: "Facturation et règlement",
    corps:
      "Le sous-traitant facture les prestations effectivement réalisées, aux prix convenus à "
      + "l'ordre de mission. La facture mentionne la référence de la mission. Le règlement "
      + "intervient selon les modalités convenues, après remise du rapport d'intervention et "
      + "validation de la mission. Aucune prestation supplémentaire n'est réglée sans accord "
      + "écrit préalable du donneur d'ordre.",
  },
  {
    cle: "responsabilite_financiere",
    titre: "Responsabilité financière",
    corps:
      "Le donneur d'ordre peut retenir ou compenser sur les sommes dues au sous-traitant le "
      + "montant des reprises, des dommages et des frais engagés du fait de son inexécution ou "
      + "de son exécution défectueuse, après information du sous-traitant et justification des "
      + "montants retenus.",
  },
  {
    cle: "dechets",
    titre: "Débarras et gestion des déchets, lorsque applicable",
    corps:
      "Lorsque les prestations confiées comportent un débarras, une évacuation ou la "
      + "production de déchets, le sous-traitant assure le tri, le transport et la remise des "
      + "déchets à des installations autorisées à les recevoir. Il respecte les obligations "
      + "applicables à chaque flux, notamment pour les déchets dangereux, les déchets "
      + "d'équipements électriques et électroniques et les déchets d'amiante, dont la présence "
      + "doit être signalée avant toute manipulation. Il n'effectue aucun dépôt non autorisé et "
      + "remet les justificatifs de traitement avec le rapport d'intervention.",
    reference: "Articles L. 541-1 et suivants du code de l'environnement",
  },
  {
    cle: "batiment",
    titre: "Prestations du bâtiment, lorsque applicable",
    corps:
      "Lorsque les prestations confiées comportent des travaux de bâtiment, le sous-traitant "
      + "les exécute dans le respect des règles de l'art et des normes applicables. Il déclare "
      + "disposer des qualifications et des assurances correspondant à leur nature, y compris, "
      + "lorsque les travaux relèvent de la garantie décennale, d'une assurance couvrant cette "
      + "responsabilité. Les attestations sont remises avant tout commencement d'exécution.",
    reference: "Articles 1792 et suivants du code civil ; article L. 241-1 du code des assurances",
  },
  {
    cle: "donnees_personnelles",
    titre: "Protection des données personnelles",
    corps:
      "Le sous-traitant traite les données personnelles auxquelles il accède pour les seules "
      + "finalités de la mission, conformément à la réglementation applicable. Il ne les "
      + "conserve pas au-delà de ce qui est nécessaire, ne les communique à aucun tiers non "
      + "autorisé et met en œuvre des mesures de sécurité appropriées. Il informe le donneur "
      + "d'ordre sans délai de toute violation de données.",
    reference: "Règlement (UE) 2016/679 et loi n° 78-17 du 6 janvier 1978 modifiée",
  },
  {
    cle: "suspension",
    titre: "Suspension des missions",
    corps:
      "Le donneur d'ordre peut suspendre l'attribution de nouvelles missions, sans indemnité, "
      + "en cas de manquement du sous-traitant à ses obligations, notamment en cas de document "
      + "obligatoire manquant ou expiré, de non-conformité répétée ou d'absence de rapport "
      + "d'intervention.",
  },
  {
    cle: "resiliation",
    titre: "Résiliation du contrat",
    corps:
      "Chaque partie peut résilier le contrat-cadre par écrit, moyennant un préavis d'un mois, "
      + "sans préjudice des missions en cours qui doivent être menées à leur terme. En cas de "
      + "manquement grave, le donneur d'ordre peut résilier sans préavis après mise en demeure "
      + "restée sans effet pendant quinze jours.",
  },
  {
    cle: "force_majeure",
    titre: "Force majeure",
    corps:
      "Aucune des parties ne répond de l'inexécution de ses obligations lorsqu'elle résulte "
      + "d'un événement de force majeure. La partie empêchée en informe l'autre sans délai et "
      + "met en œuvre les moyens raisonnables pour en limiter les effets. Si l'empêchement "
      + "persiste au-delà d'un mois, chaque partie peut mettre fin à la mission concernée.",
    reference: "Article 1218 du code civil",
  },
  {
    cle: "preuve",
    titre: "Preuve et communications",
    corps:
      "Les parties conviennent que les échanges par courrier électronique, les documents "
      + "signés électroniquement et les enregistrements conservés dans le système "
      + "d'information du donneur d'ordre constituent des moyens de preuve recevables entre "
      + "elles. Les notifications sont valablement adressées aux adresses figurant au présent "
      + "contrat.",
  },
  {
    cle: "droit_applicable",
    titre: "Droit applicable et litiges",
    corps:
      "Le présent contrat est soumis au droit français. En cas de litige, les parties "
      + "s'efforcent de trouver une solution amiable. À défaut d'accord, le litige est porté "
      + "devant la juridiction compétente.",
  },
  {
    cle: "declaration_finale",
    titre: "Déclaration finale et engagement du sous-traitant",
    corps:
      "Le sous-traitant déclare avoir pris connaissance de l'ensemble des stipulations du "
      + "présent contrat et de l'ordre de mission qui lui est annexé, disposer des moyens "
      + "humains, matériels et assurantiels nécessaires à leur exécution, et s'engager à les "
      + "respecter sans réserve.",
  },
];

// ══════════════════════════════════════════════════════════════════════
//  CONDITIONNELS — appelés par les prestations retenues
// ══════════════════════════════════════════════════════════════════════

export const CONDITIONNELS: Record<string, Article> = {
  // ── Nettoyage ─────────────────────────────────────────────────────
  produits: {
    cle: "produits",
    titre: "Produits d'entretien et compatibilité des supports",
    corps:
      "Le sous-traitant emploie des produits adaptés à la nature des supports traités et "
      + "conformes à la réglementation. Il vérifie la compatibilité du produit avec le support "
      + "avant toute application générale et procède, en cas de doute, à un essai sur une zone "
      + "non visible. Il tient les fiches de données de sécurité à disposition.",
  },
  produits_biocides: {
    cle: "produits_biocides",
    titre: "Produits biocides et traitements",
    corps:
      "Les produits biocides employés sont autorisés pour l'usage considéré et appliqués dans "
      + "le respect de leur notice, des dosages et des délais de réoccupation des locaux. Le "
      + "sous-traitant consigne au rapport d'intervention les produits utilisés, leurs dosages "
      + "et les zones traitées, et informe le donneur d'ordre du délai avant réoccupation.",
  },
  risque_biologique: {
    cle: "risque_biologique",
    titre: "Intervention en présence d'un risque biologique",
    corps:
      "Lorsque la mission présente un risque biologique, le sous-traitant met en œuvre un "
      + "protocole de protection adapté : équipements à usage unique, confinement de la zone, "
      + "élimination séparée des déchets contaminés et décontamination du matériel en fin de "
      + "poste. Il n'affecte à ces missions qu'un personnel informé du risque et formé aux "
      + "mesures de protection.",
  },
  travail_hauteur: {
    cle: "travail_hauteur",
    titre: "Travail en hauteur",
    corps:
      "Les interventions en hauteur sont réalisées avec des équipements conformes et "
      + "vérifiés, installés sur un sol stable. Le sous-traitant privilégie les protections "
      + "collectives. Toute intervention nécessitant une nacelle, un échafaudage ou un moyen "
      + "d'accès particulier doit être signalée au donneur d'ordre et validée par lui avant "
      + "exécution : elle n'est jamais comprise dans le prix sans mention expresse à l'ordre "
      + "de mission.",
  },
  certificat_hotte: {
    cle: "certificat_hotte",
    titre: "Certificat d'entretien des systèmes d'extraction",
    corps:
      "À l'issue du dégraissage, le sous-traitant remet un certificat mentionnant la date "
      + "d'intervention, les éléments traités, les parties de conduit non accessibles et les "
      + "éventuelles réserves. Les parties inaccessibles sont expressément signalées : elles "
      + "ne sont pas réputées traitées.",
  },
  constat_prealable: {
    cle: "constat_prealable",
    titre: "Constat préalable de l'état des lieux",
    corps:
      "Avant toute intervention consécutive à un sinistre, le sous-traitant établit un constat "
      + "photographique de l'état des lieux et des désordres apparents. Les éléments "
      + "susceptibles d'être conservés pour expertise ne sont ni déplacés ni évacués sans "
      + "l'accord écrit du donneur d'ordre.",
  },
  dechets_chantier: {
    cle: "dechets_chantier",
    titre: "Évacuation des déchets de chantier",
    corps:
      "Le sous-traitant évacue les déchets produits par son intervention et laisse les lieux "
      + "nets. Les déchets sont remis en filière autorisée ; les justificatifs sont transmis "
      + "avec le rapport d'intervention.",
  },

  // ── Débarras ──────────────────────────────────────────────────────
  objets_conserver: {
    cle: "objets_conserver",
    titre: "Objets à conserver",
    corps:
      "Le sous-traitant n'évacue que les biens dont l'enlèvement a été expressément autorisé. "
      + "Les biens à conserver sont identifiés à l'ordre de mission et, le cas échéant, "
      + "signalés sur place. En cas de doute sur un bien, le sous-traitant interrompt son "
      + "enlèvement et demande confirmation au donneur d'ordre avant de poursuivre. "
      + "L'évacuation d'un bien non autorisé engage sa responsabilité.",
  },
  objets_valeur: {
    cle: "objets_valeur",
    titre: "Objets de valeur, documents et espèces découverts",
    corps:
      "Tout objet de valeur, bijou, document personnel, titre, moyen de paiement ou somme "
      + "d'argent découvert pendant l'intervention est immédiatement mis de côté, laissé sur "
      + "place en lieu sûr lorsque cela est possible, photographié et signalé sans délai au "
      + "donneur d'ordre. Ces biens ne sont ni évacués, ni emportés, ni remis à un tiers sans "
      + "instruction écrite. Leur découverte est consignée au rapport d'intervention.",
  },
  tracabilite_dechets: {
    cle: "tracabilite_dechets",
    titre: "Traçabilité des déchets",
    corps:
      "Le sous-traitant tient et remet au donneur d'ordre les justificatifs de prise en charge "
      + "et de traitement des déchets évacués, dans la forme requise par la réglementation "
      + "applicable au flux concerné. L'absence de justificatif fait obstacle à la validation "
      + "de la mission.",
  },
  volume_contractuel: {
    cle: "volume_contractuel",
    titre: "Volume contractuel de débarras",
    corps:
      "Le volume à débarrasser est indiqué à l'ordre de mission. Il constitue la base du prix "
      + "convenu. Si le volume réel excède sensiblement le volume contractuel, le "
      + "sous-traitant interrompt son intervention, en informe le donneur d'ordre et attend "
      + "son instruction. Aucun supplément n'est dû ni facturable sans accord écrit préalable "
      + "du donneur d'ordre.",
  },
  portage: {
    cle: "portage",
    titre: "Portage et distances d'accès",
    corps:
      "Les distances de portage, les étages et les contraintes d'accès sont décrits à l'ordre "
      + "de mission et pris en compte dans le prix convenu. Toute difficulté non décrite est "
      + "signalée avant le début de l'intervention.",
  },

  // ── Compléments d'activité ────────────────────────────────────────
  plomberie: {
    cle: "plomberie",
    titre: "Interventions de plomberie",
    corps:
      "Avant toute intervention sur un réseau d'eau, le sous-traitant localise et condamne "
      + "l'arrivée d'eau, protège les abords et vérifie l'absence de fuite après remise en "
      + "service. Il procède à un essai d'étanchéité, le consigne au rapport d'intervention et "
      + "signale tout désordre préexistant constaté sur le réseau.",
  },
  fournitures: {
    cle: "fournitures",
    titre: "Fournitures et matériaux",
    corps:
      "La charge des fournitures est précisée prestation par prestation à l'ordre de mission. "
      + "Lorsqu'elles sont à la charge du sous-traitant, les fournitures sont conformes à "
      + "l'usage prévu et de qualité équivalente à celle convenue ; aucune substitution n'est "
      + "admise sans accord écrit. Lorsqu'elles sont fournies par le donneur d'ordre ou par le "
      + "client, le sous-traitant en vérifie l'état et la quantité à la réception et signale "
      + "toute anomalie avant emploi.",
  },
  reception_travaux: {
    cle: "reception_travaux",
    titre: "Réception des prestations complémentaires",
    corps:
      "Les prestations complémentaires font l'objet d'une vérification contradictoire à leur "
      + "achèvement, consignée au rapport d'intervention avec les réserves éventuelles. La "
      + "levée des réserves est à la charge du sous-traitant dans le délai fixé par le donneur "
      + "d'ordre.",
  },
  evacuation_depose: {
    cle: "evacuation_depose",
    titre: "Évacuation des éléments déposés",
    corps:
      "Les appareils et éléments déposés sont évacués par le sous-traitant et remis en filière "
      + "autorisée, sauf instruction contraire portée à l'ordre de mission.",
  },
  prestation_a_preciser: {
    cle: "prestation_a_preciser",
    titre: "Prestation à préciser",
    corps:
      "La prestation désignée comme personnalisée doit être décrite à l'ordre de mission avec "
      + "une précision suffisante pour en déterminer l'étendue, les fournitures, le délai et "
      + "les qualifications requises. À défaut, elle n'est pas exécutable et ne peut être "
      + "facturée.",
  },

  // ── Validation des prestations supplémentaires (socle du contrat 3) ─
  prestations_supplementaires: {
    cle: "prestations_supplementaires",
    titre: "Prestations supplémentaires et avenants",
    corps:
      "Aucune prestation non portée à l'ordre de mission n'est exécutable. Une demande "
      + "formulée directement par le client ne vaut pas autorisation : le sous-traitant la "
      + "transmet au donneur d'ordre, qui seul décide. Toute prestation supplémentaire "
      + "acceptée fait l'objet d'un avenant écrit précisant son objet, son prix et son délai, "
      + "et, lorsqu'elle n'est pas comprise dans l'engagement initial du client, de l'accord "
      + "commercial de celui-ci. Le contrat initial n'est jamais modifié : l'avenant s'y "
      + "ajoute et y fait référence.",
  },

  // ── Transport ─────────────────────────────────────────────────────
  transport_regularite: {
    cle: "transport_regularite",
    titre: "Régularité du transporteur",
    corps:
      "Le sous-traitant déclare exercer régulièrement son activité de transport, être à jour "
      + "de ses obligations administratives, fiscales et sociales, employer un personnel "
      + "régulièrement déclaré et disposer des autorisations requises. Lorsque l'opération le "
      + "rend obligatoire, il est inscrit au registre des transporteurs et détient la licence "
      + "correspondant aux véhicules utilisés. Il remet les justificatifs avant tout "
      + "commencement d'exécution.",
    reference: "Articles L. 3211-1 et suivants du code des transports",
  },
  transport_responsabilite: {
    cle: "transport_responsabilite",
    titre: "Responsabilité du transporteur",
    corps:
      "Le sous-traitant répond des pertes, avaries et dommages survenus aux biens depuis leur "
      + "prise en charge jusqu'à leur remise au destinataire, ainsi que des retards qui lui "
      + "sont imputables, dans les conditions du régime juridique applicable à l'opération. "
      + "Sa responsabilité s'étend à la manutention, au chargement, à l'arrimage, au "
      + "transport, au déchargement et à la livraison. Les limitations légales d'indemnité "
      + "applicables sont réservées.",
    reference: "Articles L. 133-1 et suivants du code de commerce",
  },
  vehicules: {
    cle: "vehicules",
    titre: "Véhicules utilisés",
    corps:
      "Le sous-traitant utilise des véhicules adaptés aux biens transportés, régulièrement "
      + "immatriculés, assurés, entretenus et à jour de leur contrôle technique. Il respecte "
      + "les limites de poids et de gabarit, les règles de chargement et les restrictions de "
      + "circulation applicables au trajet. L'immatriculation du véhicule affecté à la mission "
      + "est communiquée au donneur d'ordre.",
  },
  assurances_transport: {
    cle: "assurances_transport",
    titre: "Assurances propres au transport",
    corps:
      "Le sous-traitant déclare être titulaire de l'assurance automobile obligatoire des "
      + "véhicules utilisés, d'une assurance de responsabilité civile professionnelle et des "
      + "garanties couvrant sa responsabilité de transporteur. Il est expressément convenu "
      + "qu'une garantie de responsabilité du transporteur ne constitue pas une assurance tous "
      + "risques des biens transportés. Lorsque la valeur des biens le justifie, une garantie "
      + "complémentaire ou une assurance ad valorem doit être souscrite : son existence et son "
      + "montant sont mentionnés à l'ordre de mission. Il appartient au sous-traitant de "
      + "vérifier les plafonds, franchises et exclusions de ses garanties.",
  },
  protection_biens: {
    cle: "protection_biens",
    titre: "Protection des biens transportés",
    corps:
      "Le sous-traitant met en œuvre les moyens de protection adaptés : couvertures, housses, "
      + "sangles, protections d'angles, de portes et de sols, chariots, diables, matériel "
      + "d'arrimage et emballages appropriés. Les biens fragiles signalés font l'objet d'une "
      + "protection renforcée. Les parties communes et les accès sont protégés avant le début "
      + "des opérations.",
  },
  chargement_arrimage: {
    cle: "chargement_arrimage",
    titre: "Chargement et arrimage",
    corps:
      "Le sous-traitant répartit la charge conformément aux capacités du véhicule et aux "
      + "limites par essieu, et maintient les biens par des dispositifs d'arrimage adaptés. "
      + "Il est interdit de circuler avec un chargement instable, débordant ou dangereux : "
      + "toute anomalie est corrigée avant le départ. Le conducteur vérifie l'arrimage à "
      + "chaque reprise de route.",
  },
  acces_manutention: {
    cle: "acces_manutention",
    titre: "Accès et conditions de manutention",
    corps:
      "L'ordre de mission précise les adresses de départ et d'arrivée, les étages, la présence "
      + "d'un ascenseur et ses dimensions utiles, les distances de portage, les conditions de "
      + "stationnement, les contraintes de circulation, les autorisations éventuellement "
      + "nécessaires, la présence d'objets lourds ou volumineux et les besoins de démontage. "
      + "Le sous-traitant vérifie ces éléments à son arrivée et signale toute divergence avant "
      + "de commencer les opérations.",
  },
  inventaire: {
    cle: "inventaire",
    titre: "Inventaire et état des biens",
    corps:
      "Lorsque la mission le prévoit, un inventaire contradictoire est établi au départ. Il "
      + "identifie les biens pris en charge, leur quantité, les dommages préexistants "
      + "constatables, les objets fragiles et ceux nécessitant une manutention particulière, "
      + "ainsi que les réserves. Les photographies autorisées y sont annexées. L'inventaire "
      + "est contresigné et joint au rapport d'intervention.",
  },
  demontage_remontage: {
    cle: "demontage_remontage",
    titre: "Démontage et remontage du mobilier",
    corps:
      "Le démontage et le remontage ne portent que sur les meubles désignés à l'ordre de "
      + "mission. Le sous-traitant repère et conserve les pièces de fixation, signale les "
      + "meubles dont le démontage présente un risque de détérioration et recueille "
      + "l'instruction du donneur d'ordre avant d'intervenir. Il vérifie la stabilité des "
      + "meubles remontés.",
  },
  temps_conduite: {
    cle: "temps_conduite",
    titre: "Temps de conduite et de repos",
    corps:
      "Le sous-traitant respecte la réglementation relative aux temps de conduite, aux pauses "
      + "et aux repos de ses conducteurs. Il organise la mission en conséquence et ne peut "
      + "invoquer les délais convenus pour s'en écarter.",
  },
  incidents_transport: {
    cle: "incidents_transport",
    titre: "Incidents et accidents de transport",
    corps:
      "Le sous-traitant signale immédiatement au donneur d'ordre tout accident, dommage aux "
      + "biens, perte, vol, avarie, retard significatif, immobilisation du véhicule, incident "
      + "de manutention ou impossibilité de livrer. Il prend les mesures conservatoires "
      + "nécessaires, constate les faits par écrit et par photographies, et ne procède à "
      + "aucune réparation ni indemnisation sans l'accord du donneur d'ordre.",
  },
  livraison: {
    cle: "livraison",
    titre: "Livraison et fin de mission",
    corps:
      "À la livraison, le sous-traitant fait constater la remise des biens, recueille "
      + "l'émargement du destinataire et consigne les réserves formulées. Il transmet au "
      + "donneur d'ordre le compte rendu de mission, les horaires de prise en charge et de "
      + "livraison, les documents de transport, les réserves, les photographies autorisées et "
      + "les incidents rencontrés.",
  },
  frais_transport: {
    cle: "frais_transport",
    titre: "Frais de transport",
    corps:
      "Le prix convenu à l'ordre de mission distingue, le cas échéant, le forfait, les "
      + "kilomètres facturables, les péages, les frais de stationnement autorisés, les frais "
      + "de déplacement et d'hébergement et les prestations supplémentaires. Les frais non "
      + "mentionnés à l'ordre de mission ne sont pas dus. Aucun supplément n'est facturable "
      + "sans accord écrit préalable du donneur d'ordre.",
  },
  transport_international: {
    cle: "transport_international",
    titre: "Transport international",
    corps:
      "Pour les transports internationaux de marchandises par route, les parties conviennent "
      + "que les dispositions de la Convention relative au contrat de transport international "
      + "de marchandises par route s'appliquent lorsque ses conditions sont réunies, et qu'une "
      + "lettre de voiture conforme est établie. Le sous-traitant accomplit les formalités "
      + "requises par les pays traversés et détient à bord les documents nécessaires. Les "
      + "règles applicables et les documents exigés sont précisés à l'ordre de mission.",
    reference: "Convention CMR du 19 mai 1956",
  },
};

// ══════════════════════════════════════════════════════════════════════
//  Choix du modèle et assemblage
// ══════════════════════════════════════════════════════════════════════

/**
 * Modèle de contrat adapté à une sélection de prestations.
 *
 * Le transport l'emporte sur tout : une mission qui déplace des biens relève
 * du régime du transport, et son contrat doit le dire. Viennent ensuite les
 * compléments de bâtiment, qui appellent la décennale, puis le débarras.
 * À défaut, le nettoyage approfondi.
 *
 * `null` = aucune prestation retenue : on ne devine pas un modèle.
 */
export function modelePour(codes: readonly string[]): ModeleContrat | null {
  const f: Famille[] = famillesDe(codes);
  if (f.length === 0) return null;
  if (f.includes("transport")) return "demenagement_transport";
  if (f.includes("complements")) return "nettoyage_complements";
  if (f.includes("debarras")) return "nettoyage_debarras";
  return "nettoyage_approfondi";
}

/** Articles que le modèle impose, indépendamment des prestations cochées. */
const ARTICLES_DU_MODELE: Record<ModeleContrat, string[]> = {
  nettoyage_approfondi: ["produits"],
  nettoyage_debarras: ["produits", "objets_conserver", "objets_valeur", "tracabilite_dechets", "volume_contractuel"],
  // Le contrat 3 impose la validation des suppléments : c'est sa raison d'être.
  nettoyage_complements: ["produits", "fournitures", "reception_travaux", "prestations_supplementaires"],
  demenagement_transport: [
    "transport_regularite", "transport_responsabilite", "vehicules", "assurances_transport",
    "protection_biens", "chargement_arrimage", "acces_manutention", "incidents_transport",
    "livraison", "frais_transport",
  ],
};

export type ContratAssemble = {
  modele: ModeleContrat;
  version: string;
  /** Socle + conditionnels, dans l'ordre, numérotés à l'affichage. */
  articles: Article[];
  securite: string[];
  assurances: string[];
  qualifications: string[];
  /** Articles conditionnels retenus, pour contrôle. */
  clesConditionnelles: string[];
};

/**
 * Assemble le contrat : socle, puis conditionnels appelés par les prestations
 * ET ceux que le modèle impose.
 *
 * L'ordre est déterministe — celui de CONDITIONNELS — pour qu'un même choix
 * de prestations produise toujours exactement le même document.
 */
export function assembler(
  codes: readonly string[],
  modeleForce?: ModeleContrat | null,
): ContratAssemble | null {
  const modele = modeleForce ?? modelePour(codes);
  if (!modele) return null;

  const exig = exigencesCumulees(codes);
  const voulus = new Set<string>([...exig.articles, ...ARTICLES_DU_MODELE[modele]]);

  // Ordre de CONDITIONNELS, pas ordre d'insertion : le document ne doit pas
  // changer selon l'ordre des clics de la planificatrice.
  const conditionnels = Object.keys(CONDITIONNELS)
    .filter((k) => voulus.has(k))
    .map((k) => CONDITIONNELS[k]);

  const unique = (xs: string[]) => [...new Set(xs)];

  return {
    modele,
    version: VERSION_MODELES,
    articles: [...SOCLE, ...conditionnels],
    securite: unique(exig.securite),
    assurances: unique(exig.assurances),
    qualifications: unique(exig.qualifications),
    clesConditionnelles: conditionnels.map((a) => a.cle),
  };
}
