// CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE NETTOYAGE
//
// ✅ TEXTE FOURNI PAR LE CLIENT le 2026-11-01. Il REMPLACE le socle de
// travail rédigé le 2026-10-31 (version 1.0), qui n'était qu'une proposition
// en attente de validation. Celui-ci est le contrat de référence.
//
// Les crochets du document original sont remplacés par les variables du CRM
// ({{...}}), résolues par lib/sous-traitance/variables.ts. Aucune formulation
// n'a été réécrite : seuls les champs à remplir ont été substitués.
//
// PÉRIMÈTRE : famille nettoyage (nettoyage, nettoyage difficile, Diogène) et
// les deux contrats qui s'y adossent — avec débarras, avec compléments. Le
// déménagement et le transport gardent le socle 1.0 en attendant que le
// client fournisse leur texte.

import type { Article } from "./clauses";

/** Version du jeu de modèles de nettoyage. Figée sur chaque contrat émis. */
export const VERSION_NETTOYAGE = "2.0";

export const TITRE_NETTOYAGE = "CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE NETTOYAGE";

/** En-tête : identification des parties, avant les articles. */
export const PARTIES = {
  intro: "ENTRE LES SOUSSIGNÉS",
  donneurOrdre: {
    titre: "LE DONNEUR D'ORDRE",
    corps:
      "{{principal_company_name}}, {{principal_company_legal_form}}, immatriculée au "
      + "Registre du commerce et des sociétés sous le numéro {{principal_company_siren}}, "
      + "dont le siège social est situé {{principal_company_address}}.\n"
      + "Représentée par {{principal_company_representative}}, en sa qualité de "
      + "{{principal_company_representative_title}}.\n"
      + "Ci-après dénommée « le Donneur d'ordre ».",
    mention: "D'UNE PART,",
  },
  sousTraitant: {
    titre: "LE SOUS-TRAITANT",
    corps:
      "{{subcontractor_legal_name}}, {{subcontractor_legal_form}}, immatriculée au "
      + "Registre du commerce et des sociétés sous le numéro {{subcontractor_siren}}, "
      + "dont le siège social est situé {{subcontractor_address}}.\n"
      + "Représentée par {{subcontractor_representative}}, en sa qualité de "
      + "{{subcontractor_representative_title}}.\n"
      + "Ci-après dénommée « le Sous-traitant ».",
    mention: "D'AUTRE PART.",
  },
  cloture: "Il a été convenu ce qui suit.",
} as const;

/**
 * Les 30 articles du contrat de nettoyage, dans l'ordre du document fourni.
 *
 * Les clés sont celles du moteur : elles permettent aux articles
 * conditionnels (vitrerie, débarras, compléments) de s'ajouter sans
 * renuméroter ni réécrire quoi que ce soit.
 */
export const SOCLE_NETTOYAGE: Article[] = [
  {
    cle: "objet",
    titre: "OBJET DU CONTRAT",
    corps:
      "Le présent contrat définit les conditions dans lesquelles le Donneur d'ordre confie "
      + "au Sous-traitant l'exécution de prestations professionnelles de nettoyage.\n\n"
      + "Ces prestations peuvent notamment comprendre le nettoyage courant, le nettoyage "
      + "complet, le nettoyage approfondi, l'entretien des sols, des surfaces, des "
      + "équipements sanitaires, des cuisines et des éléments accessibles des locaux "
      + "concernés.\n\n"
      + "Le Sous-traitant intervient en qualité d'entreprise indépendante et assume la "
      + "responsabilité de l'organisation et de la bonne exécution des prestations "
      + "confiées.\n\n"
      + "Les prestations sont exécutées conformément au présent contrat, au bon de mission "
      + "annexé et aux dispositions légales et réglementaires applicables.",
  },
  {
    cle: "chantier",
    titre: "IDENTIFICATION DU CHANTIER",
    corps:
      "Client final : {{client_lastname}} {{client_firstname}}.\n"
      + "Adresse d'intervention : {{mission_address}}.\n"
      + "Localisation : {{mission_access_conditions}}.\n"
      + "Date d'intervention : {{mission_date}}.\n"
      + "Nature de l'intervention : {{mission_type}}.\n\n"
      + "Les informations relatives au chantier sont automatiquement renseignées à partir "
      + "du dossier d'intervention enregistré dans le CRM.",
  },
  {
    cle: "prestations",
    titre: "DESCRIPTION DES PRESTATIONS",
    corps:
      "Le Sous-traitant est chargé d'exécuter les prestations suivantes, dans les limites "
      + "du périmètre convenu.\n\n"
      + "PRESTATIONS COMMANDÉES\n\n"
      + "{{prestations_detaillees}}\n\n"
      + "Ces prestations peuvent notamment concerner :\n"
      + "- Le dépoussiérage des surfaces accessibles.\n"
      + "- L'aspiration et le lavage des sols.\n"
      + "- Le nettoyage des plinthes et des éléments accessibles.\n"
      + "- Le nettoyage des sanitaires.\n"
      + "- Le nettoyage des cuisines et de leurs équipements.\n"
      + "- Le nettoyage des portes, poignées et interrupteurs.\n"
      + "- Le nettoyage des vitres et encadrements lorsque cette prestation est "
      + "expressément prévue.\n"
      + "- Le lessivage des murs et plafonds uniquement lorsqu'il est expressément "
      + "commandé.\n"
      + "- Le nettoyage final des zones concernées par l'intervention.\n\n"
      + "Toute prestation supplémentaire doit faire l'objet d'un accord préalable du "
      + "Donneur d'ordre.",
  },
  {
    cle: "independance",
    titre: "INDÉPENDANCE DU SOUS-TRAITANT",
    corps:
      "Le Sous-traitant exerce son activité en toute indépendance juridique, "
      + "administrative et organisationnelle.\n\n"
      + "Il organise librement ses moyens d'exécution, dans le respect des délais, des "
      + "résultats contractuellement convenus et des règles de sécurité.\n\n"
      + "Le présent contrat ne constitue ni un contrat de travail, ni une association, ni "
      + "un mandat général.\n\n"
      + "Le Sous-traitant demeure seul responsable de la gestion de son personnel, de ses "
      + "moyens matériels et de ses obligations professionnelles.",
  },
  {
    cle: "declarations",
    titre: "DÉCLARATIONS ADMINISTRATIVES ET LÉGALES",
    corps:
      "Le Sous-traitant déclare sur l'honneur :\n"
      + "- Être régulièrement immatriculé auprès des organismes compétents.\n"
      + "- Être à jour de ses déclarations fiscales et sociales.\n"
      + "- Être à jour du paiement de ses cotisations et contributions obligatoires.\n"
      + "- Employer, le cas échéant, du personnel régulièrement déclaré.\n"
      + "- Respecter les dispositions relatives au droit du travail et à la lutte contre "
      + "le travail dissimulé.\n"
      + "- Disposer des autorisations et qualifications légalement nécessaires aux "
      + "activités effectivement exercées.\n"
      + "- Ne faire l'objet d'aucune interdiction l'empêchant d'exécuter les prestations "
      + "confiées.\n\n"
      + "Le Sous-traitant s'engage à maintenir la régularité de sa situation pendant toute "
      + "la durée de ses relations contractuelles avec le Donneur d'ordre.\n\n"
      + "Ces déclarations ne dispensent pas le Donneur d'ordre de procéder aux "
      + "vérifications imposées par la législation, notamment au titre de son obligation "
      + "de vigilance lorsque celle-ci est applicable.",
    reference: "Articles L. 8222-1 et D. 8222-5 du code du travail",
  },
  {
    cle: "personnel",
    titre: "PERSONNEL ET OBLIGATIONS SOCIALES",
    corps:
      "Le Sous-traitant assume seul la responsabilité de son personnel.\n\n"
      + "Il garantit que les personnes mobilisées disposent des compétences nécessaires et "
      + "travaillent dans des conditions conformes à la réglementation.\n\n"
      + "Il prend en charge leurs rémunérations, cotisations, assurances, équipements et "
      + "obligations déclaratives.\n\n"
      + "Il demeure responsable des fautes et manquements de ses salariés et préposés dans "
      + "les conditions prévues par la loi.\n\n"
      + "Aucun membre du personnel du Sous-traitant ne peut se prévaloir du présent contrat "
      + "pour revendiquer un lien de subordination avec le Donneur d'ordre.",
  },
  {
    cle: "assurances",
    titre: "ASSURANCES PROFESSIONNELLES",
    corps:
      "Le Sous-traitant déclare disposer des assurances nécessaires à l'exercice de ses "
      + "activités.\n\n"
      + "Ces assurances doivent couvrir, selon les prestations réalisées et les garanties "
      + "souscrites, les risques liés aux dommages matériels et corporels ainsi qu'à "
      + "l'intervention dans les locaux du client.\n\n"
      + "Le Sous-traitant demeure responsable des dommages qui lui sont imputables, y "
      + "compris lorsque ceux-ci ne sont pas pris en charge par son assureur.\n\n"
      + "Il s'engage à informer le Donneur d'ordre de toute suspension ou résiliation d'une "
      + "assurance nécessaire à l'exécution de la mission.",
  },
  {
    cle: "materiel",
    titre: "MOYENS MATÉRIELS ET ÉQUIPEMENTS",
    corps:
      "Le Sous-traitant fournit les moyens humains, matériels et techniques nécessaires à "
      + "l'intervention.\n\n"
      + "Il veille notamment à disposer de matériels professionnels de nettoyage, de "
      + "produits adaptés aux surfaces et aux risques rencontrés, ainsi que des équipements "
      + "de protection individuelle nécessaires.\n\n"
      + "Le Sous-traitant est responsable de l'entretien, de la conformité et de la bonne "
      + "utilisation de ses équipements.",
  },
  {
    cle: "securite",
    titre: "SÉCURITÉ ET RISQUES PROFESSIONNELS",
    corps:
      "Le Sous-traitant s'engage à évaluer les risques prévisibles avant et pendant "
      + "l'intervention.\n\n"
      + "Il prend toutes les mesures nécessaires à la protection de son personnel, des "
      + "occupants, des tiers et des biens.\n\n"
      + "Il veille notamment à prévenir les risques de blessures, de chute, de manutention "
      + "et d'exposition aux produits chimiques.\n\n"
      + "En présence de matériaux suspects, de risques biologiques importants ou de toute "
      + "situation nécessitant une qualification particulière, il doit suspendre les "
      + "opérations concernées et en informer immédiatement le Donneur d'ordre.\n\n"
      + "Aucune opération soumise à une autorisation ou qualification particulière ne peut "
      + "être exécutée sans que les conditions réglementaires soient réunies.\n\n"
      + "ÉQUIPEMENTS ET CONSIGNES APPLICABLES À CETTE MISSION\n\n"
      + "{{securite_mission}}",
  },
  {
    cle: "responsabilite",
    titre: "RESPONSABILITÉ DU SOUS-TRAITANT",
    corps:
      "Le Sous-traitant assume la responsabilité des dommages résultant de ses fautes, "
      + "négligences, imprudences ou manquements contractuels.\n\n"
      + "Cette responsabilité couvre notamment les dommages causés au logement, les "
      + "dégradations des parties communes, les dommages aux meubles et équipements, les "
      + "pertes de biens confiés, les accidents imputables à un manquement à ses "
      + "obligations et les conséquences d'une mauvaise exécution des prestations.\n\n"
      + "Le Sous-traitant s'engage à prendre en charge les conséquences financières des "
      + "dommages qui lui sont juridiquement imputables.",
  },
  {
    cle: "protection_biens",
    titre: "PROTECTION DES BIENS DU CLIENT",
    corps:
      "Le Sous-traitant doit prendre toutes les précautions nécessaires pour protéger les "
      + "biens conservés par le client.\n\n"
      + "Il lui est interdit de retirer, jeter, vendre ou conserver un bien qui n'a pas été "
      + "expressément désigné comme devant être évacué.\n\n"
      + "En cas de doute sur la destination d'un objet, le Sous-traitant doit demander "
      + "confirmation au Donneur d'ordre avant toute évacuation.\n\n"
      + "Toute perte ou destruction fautive engage sa responsabilité dans les conditions "
      + "prévues par la loi.",
  },
  {
    cle: "dechets",
    titre: "GESTION DES DÉCHETS ISSUS DU NETTOYAGE",
    corps:
      "Le Sous-traitant s'engage à respecter la réglementation applicable à la collecte et "
      + "au traitement des déchets produits dans le cadre de ses prestations.\n\n"
      + "Il doit utiliser les filières autorisées correspondant à la nature des déchets "
      + "collectés.\n\n"
      + "Tout dépôt sauvage, abandon ou traitement irrégulier est strictement interdit.\n\n"
      + "Il doit conserver les justificatifs légalement requis lorsque leur établissement "
      + "est nécessaire.\n\n"
      + "Il assume les conséquences de ses propres infractions et manquements, sans "
      + "préjudice des responsabilités que la réglementation peut également faire peser sur "
      + "d'autres intervenants.",
    reference: "Articles L. 541-1 et suivants du code de l'environnement",
  },
  {
    cle: "transport_materiel",
    titre: "TRANSPORT DU MATÉRIEL PROFESSIONNEL",
    corps:
      "Le Sous-traitant assure, sous sa responsabilité, le transport des matériels, "
      + "équipements et produits nécessaires à l'exécution de sa mission.\n\n"
      + "Il garantit l'utilisation de véhicules régulièrement assurés, entretenus et "
      + "adaptés aux équipements transportés.\n\n"
      + "Il veille au chargement, à l'arrimage et à la sécurisation du matériel.\n\n"
      + "Il demeure responsable des opérations relevant de sa mission, sous réserve des "
      + "dispositions légales impératives applicables.",
  },
  {
    cle: "qualite",
    titre: "QUALITÉ D'EXÉCUTION",
    corps:
      "Le Sous-traitant s'engage à exécuter les prestations avec diligence, "
      + "professionnalisme et conformément aux règles de l'art.\n\n"
      + "Il doit respecter les tâches expressément convenues.\n\n"
      + "Les prestations de nettoyage doivent être réalisées avec des méthodes et produits "
      + "adaptés aux matériaux et à l'état des surfaces.\n\n"
      + "Le Sous-traitant doit signaler toute impossibilité technique ou difficulté "
      + "susceptible de compromettre la qualité du résultat.",
  },
  {
    cle: "delais",
    titre: "RESPECT DES DÉLAIS",
    corps:
      "Le Sous-traitant s'engage à respecter la date d'intervention convenue.\n\n"
      + "Toute difficulté susceptible de provoquer un retard doit être signalée au Donneur "
      + "d'ordre dès qu'elle est connue.\n\n"
      + "Le Sous-traitant doit prendre les mesures raisonnables nécessaires pour limiter "
      + "les conséquences d'un retard qui lui est imputable.\n\n"
      + "Les conséquences financières d'un retard fautif pourront être mises à sa charge "
      + "dans les conditions prévues par la loi.",
  },
  {
    cle: "travaux_supplementaires",
    titre: "TRAVAUX SUPPLÉMENTAIRES",
    corps:
      "Aucune prestation supplémentaire ne peut être facturée sans accord préalable du "
      + "Donneur d'ordre.\n\n"
      + "Le Sous-traitant ne peut modifier unilatéralement le prix, le périmètre ou les "
      + "conditions de la mission.\n\n"
      + "Toute difficulté nécessitant des travaux complémentaires doit être signalée avant "
      + "leur réalisation, sauf mesure conservatoire urgente nécessaire à la sécurité.",
  },
  {
    cle: "facturation_directe",
    titre: "INTERDICTION DE FACTURATION DIRECTE",
    corps:
      "Le Sous-traitant ne peut réclamer au client final le paiement des prestations "
      + "confiées par le Donneur d'ordre.\n\n"
      + "Il ne peut percevoir directement de règlement pour ces prestations sans "
      + "autorisation écrite préalable.\n\n"
      + "Toute demande financière relative à la mission doit être adressée au Donneur "
      + "d'ordre.\n\n"
      + "Cette clause s'applique sous réserve des droits impératifs que la loi pourrait "
      + "reconnaître au Sous-traitant.",
  },
  {
    cle: "confidentialite",
    titre: "CONFIDENTIALITÉ",
    corps:
      "Le Sous-traitant s'engage à préserver la confidentialité des informations relatives "
      + "au Donneur d'ordre et au client final.\n\n"
      + "Cette obligation concerne notamment les coordonnées, documents, informations "
      + "commerciales, photographies et données personnelles.\n\n"
      + "Les informations recueillies ne peuvent être utilisées que pour les besoins de "
      + "l'intervention.\n\n"
      + "Cette obligation subsiste après la fin du contrat.",
    reference: "Règlement (UE) 2016/679 et loi n° 78-17 du 6 janvier 1978 modifiée",
  },
  {
    cle: "non_detournement",
    titre: "NON-DÉTOURNEMENT DE CLIENTÈLE",
    corps:
      "Pendant l'exécution de la mission, le Sous-traitant s'interdit d'utiliser les "
      + "informations commerciales confidentielles obtenues par l'intermédiaire du Donneur "
      + "d'ordre pour détourner à son profit les prestations en cours.\n\n"
      + "Il ne peut solliciter directement le client final afin de contourner le Donneur "
      + "d'ordre sur les prestations faisant l'objet du présent contrat.\n\n"
      + "Cette clause ne constitue pas une interdiction générale de concurrence et doit être "
      + "appliquée dans les limites légales.",
  },
  {
    cle: "sous_traitance_second_rang",
    titre: "SOUS-TRAITANCE DE SECOND RANG",
    corps:
      "Le Sous-traitant ne peut confier tout ou partie de la mission à un autre prestataire "
      + "sans accord écrit préalable du Donneur d'ordre.\n\n"
      + "En cas d'autorisation, il demeure responsable de la bonne exécution des obligations "
      + "contractuelles qui lui incombent.\n\n"
      + "Il doit également respecter les dispositions légales applicables à la "
      + "sous-traitance.",
  },
  {
    cle: "photographies",
    titre: "PHOTOGRAPHIES ET DOCUMENTATION",
    corps:
      "Le Sous-traitant doit documenter l'intervention lorsque cela est prévu dans le bon "
      + "de mission.\n\n"
      + "Les photographies doivent permettre de constater l'état des lieux avant et après "
      + "les prestations, dans le respect de la vie privée et des règles relatives aux "
      + "données personnelles.\n\n"
      + "Elles doivent être transmises exclusivement au Donneur d'ordre ou aux personnes "
      + "autorisées.\n\n"
      + "Toute publication ou utilisation commerciale est interdite sans autorisation "
      + "appropriée.",
  },
  {
    cle: "rapport",
    titre: "RAPPORT D'INTERVENTION",
    corps:
      "À l'issue de la mission, le Sous-traitant doit transmettre un rapport "
      + "d'intervention.\n\n"
      + "Ce rapport précise notamment la date de réalisation, l'adresse du chantier, les "
      + "prestations exécutées, les éventuelles difficultés rencontrées, les travaux non "
      + "réalisés et leurs motifs, les dommages ou incidents éventuels, les réserves "
      + "éventuelles ainsi que les photographies et justificatifs requis.\n\n"
      + "Le rapport doit être sincère et refléter les opérations réellement effectuées.",
  },
  {
    cle: "controle",
    titre: "CONTRÔLE ET VÉRIFICATION DES PRESTATIONS",
    corps:
      "Le Donneur d'ordre peut vérifier la conformité des prestations au périmètre "
      + "convenu.\n\n"
      + "En présence d'une prestation incomplète ou non conforme imputable au "
      + "Sous-traitant, celui-ci doit être informé des anomalies constatées.\n\n"
      + "Il doit proposer et réaliser, dans un délai raisonnable convenu entre les parties, "
      + "les corrections nécessaires relevant de ses obligations contractuelles.\n\n"
      + "La transmission du rapport d'intervention ne vaut pas, à elle seule, acceptation "
      + "définitive de prestations non conformes.",
  },
  {
    cle: "reclamations",
    titre: "RÉCLAMATIONS ET MALFAÇONS",
    corps:
      "Le Sous-traitant doit coopérer au traitement des réclamations relatives aux "
      + "prestations qu'il a exécutées.\n\n"
      + "Lorsque des défauts ou dommages lui sont imputables, il doit prendre les mesures "
      + "nécessaires pour y remédier dans les conditions prévues par la loi.\n\n"
      + "Les frais justifiés résultant de ses manquements peuvent être mis à sa charge dans "
      + "les limites de sa responsabilité.\n\n"
      + "Le Sous-traitant doit être informé des réclamations afin de pouvoir présenter ses "
      + "observations.",
  },
  {
    cle: "prix",
    titre: "PRIX FORFAITAIRE ET MODALITÉS FINANCIÈRES",
    corps:
      "Les parties conviennent d'un prix forfaitaire ferme de {{montant_ht}} pour "
      + "l'ensemble des prestations confiées au titre du présent contrat.\n\n"
      + "Ce forfait comprend l'ensemble des prestations expressément convenues, ainsi que "
      + "la mobilisation du personnel, des équipements, des produits et des matériels "
      + "nécessaires.\n\n"
      + "DÉCOMPOSITION FINANCIÈRE\n\n"
      + "Montant forfaitaire HT : {{montant_ht}}\n"
      + "TVA : {{tva_detail}}\n"
      + "Montant TTC : {{montant_ttc}}\n\n"
      + "Cette décomposition s'applique sous réserve du régime fiscal effectivement "
      + "applicable au Sous-traitant.\n\n"
      + "Le prix forfaitaire couvre l'ensemble des prestations expressément convenues.\n\n"
      + "Aucun supplément ne pourra être facturé sans accord préalable et écrit du Donneur "
      + "d'ordre.\n\n"
      + "La facture devra être établie au nom de {{principal_company_name}}, conformément "
      + "aux dispositions fiscales applicables.\n\n"
      + "Les délais et modalités de règlement devront respecter les dispositions légales "
      + "impératives.\n\n"
      + "Le montant figurant dans le présent contrat correspond exclusivement à la "
      + "rémunération convenue avec le Sous-traitant.",
  },
  {
    cle: "suspension",
    titre: "SUSPENSION DE L'INTERVENTION",
    corps:
      "Le Donneur d'ordre peut demander la suspension de l'intervention en présence d'un "
      + "risque grave pour la sécurité, d'une non-conformité importante ou d'un manquement "
      + "contractuel.\n\n"
      + "Le Sous-traitant doit également suspendre les opérations dangereuses lorsqu'il "
      + "constate un risque qui ne peut être maîtrisé dans des conditions satisfaisantes.\n\n"
      + "Les parties se concertent afin de déterminer les mesures nécessaires à la reprise "
      + "éventuelle de l'intervention.",
  },
  {
    cle: "resiliation",
    titre: "RÉSILIATION",
    corps:
      "En cas de manquement grave à une obligation essentielle, la partie lésée peut "
      + "demander la résiliation du contrat dans les conditions prévues par la loi.\n\n"
      + "Lorsque la nature du manquement le permet, une mise en demeure préalable doit être "
      + "adressée à la partie défaillante.\n\n"
      + "La résiliation ne prive pas les parties de leurs droits concernant les prestations "
      + "effectivement réalisées, les sommes dues ou les dommages imputables à un "
      + "manquement.",
  },
  {
    cle: "force_majeure",
    titre: "FORCE MAJEURE",
    corps:
      "Aucune partie ne pourra être tenue responsable d'un manquement directement causé par "
      + "un événement présentant les caractéristiques de la force majeure au sens de "
      + "l'article 1218 du Code civil.\n\n"
      + "La partie concernée doit informer l'autre partie dans les meilleurs délais.\n\n"
      + "Les conséquences de l'événement sont traitées conformément aux dispositions légales "
      + "applicables.",
    reference: "Article 1218 du code civil",
  },
  {
    cle: "droit_applicable",
    titre: "DROIT APPLICABLE ET LITIGES",
    corps:
      "Le présent contrat est soumis au droit français.\n\n"
      + "Les parties s'engagent à rechercher prioritairement une solution amiable à tout "
      + "différend relatif à son interprétation ou à son exécution.\n\n"
      + "À défaut d'accord amiable, le litige sera soumis à la juridiction compétente "
      + "conformément aux règles légales applicables.",
  },
  {
    cle: "dispositions_finales",
    titre: "DISPOSITIONS FINALES",
    corps:
      "Le présent contrat et ses annexes définissent les obligations des parties concernant "
      + "l'intervention identifiée.\n\n"
      + "Toute modification substantielle doit être acceptée par les parties.\n\n"
      + "Si une clause est déclarée nulle ou inapplicable, les autres dispositions "
      + "demeurent applicables dans la mesure où l'économie générale du contrat peut être "
      + "préservée.\n\n"
      + "Les parties reconnaissent avoir pris connaissance du contrat et de ses annexes.\n\n"
      + "Date du contrat et de prise d'effet : {{mission_date}}.",
  },
];

// ══════════════════════════════════════════════════════════════════════
//  ANNEXE 1 — BON DE MISSION
// ══════════════════════════════════════════════════════════════════════

export type BlocAnnexe = { titre: string; lignes: string[] };

export const ANNEXE_BON_MISSION: { titre: string; blocs: BlocAnnexe[]; pied: string[] } = {
  titre: "ANNEXE 1 — BON DE MISSION",
  blocs: [
    {
      titre: "DONNEUR D'ORDRE",
      lignes: [
        "Société : {{principal_company_name}}",
        "SIREN : {{principal_company_siren}}",
        "Adresse : {{principal_company_address}}",
        "Représentant légal : {{principal_company_representative}}, {{principal_company_representative_title}}",
      ],
    },
    {
      titre: "SOUS-TRAITANT",
      lignes: [
        "Société : {{subcontractor_legal_name}}",
        "SIREN : {{subcontractor_siren}}",
        "Adresse : {{subcontractor_address}}",
        "Représentant légal : {{subcontractor_representative}}, {{subcontractor_representative_title}}",
      ],
    },
    { titre: "CLIENT FINAL", lignes: ["{{client_lastname}} {{client_firstname}}"] },
    // L'adresse COMPLÈTE figure ici : le bon de mission ne part qu'au
    // prestataire RETENU, au moment de la contractualisation. C'est la limite
    // posée par la règle de confidentialité des demandes de tarif.
    { titre: "ADRESSE DU CHANTIER", lignes: ["{{mission_address}}"] },
    { titre: "DATE D'INTERVENTION", lignes: ["{{mission_date}}"] },
    { titre: "PRESTATIONS COMMANDÉES", lignes: ["{{prestations_detaillees}}"] },
    {
      titre: "MONTANT FORFAITAIRE CONVENU AVEC LE SOUS-TRAITANT",
      lignes: [
        "Montant HT : {{montant_ht}}",
        "TVA applicable : {{tva_detail}}",
        "Montant TTC : {{montant_ttc}}",
      ],
    },
    { titre: "OBSERVATIONS PARTICULIÈRES", lignes: ["{{consignes_particulieres}}"] },
  ],
  pied: [
    "Le Sous-traitant doit signaler toute difficulté liée à l'état des locaux, à la nature "
    + "des surfaces ou à la sécurité.",
    "Les opérations doivent respecter le périmètre convenu et les obligations "
    + "réglementaires applicables.",
    "Aucune prestation supplémentaire ne peut être facturée sans accord préalable du "
    + "Donneur d'ordre.",
  ],
};

// ══════════════════════════════════════════════════════════════════════
//  ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION
// ══════════════════════════════════════════════════════════════════════

/** Une rubrique du rapport : préremplie par le CRM, ou déclarée après coup. */
export type RubriqueRapport = {
  cle: string;
  numero: number | null;
  titre: string;
  /** "prerempli" = repris du contrat ; "declare" = saisi après l'intervention. */
  origine: "prerempli" | "declare";
  /** Type de saisie attendu, pour construire le formulaire. */
  saisie: "texte" | "texte_long" | "oui_non";
};

export const ANNEXE_RAPPORT: { titre: string; entete: RubriqueRapport[]; rubriques: RubriqueRapport[] } = {
  titre: "ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION",
  // En-tête : entièrement prérempli depuis le contrat. Le sous-traitant n'a
  // rien à ressaisir, et rien à pouvoir y contredire.
  entete: [
    { cle: "sous_traitant", numero: null, titre: "Entreprise intervenante", origine: "prerempli", saisie: "texte" },
    { cle: "donneur_ordre", numero: null, titre: "Donneur d'ordre", origine: "prerempli", saisie: "texte" },
    { cle: "client", numero: null, titre: "Client final", origine: "prerempli", saisie: "texte" },
    { cle: "adresse", numero: null, titre: "Adresse", origine: "prerempli", saisie: "texte" },
    { cle: "date", numero: null, titre: "Date de l'intervention", origine: "prerempli", saisie: "texte" },
  ],
  // Les sept rubriques numérotées : TOUTES déclarées après l'intervention.
  // Une prestation prévue n'est jamais réputée réalisée.
  rubriques: [
    { cle: "realisees", numero: 1, titre: "PRESTATIONS RÉALISÉES", origine: "declare", saisie: "texte_long" },
    { cle: "difficultes", numero: 2, titre: "DIFFICULTÉS RENCONTRÉES", origine: "declare", saisie: "texte_long" },
    { cle: "non_realisees", numero: 3, titre: "PRESTATIONS NON RÉALISÉES OU RÉSERVES", origine: "declare", saisie: "texte_long" },
    { cle: "incidents", numero: 4, titre: "INCIDENTS OU DÉGRADATIONS ÉVENTUELS", origine: "declare", saisie: "texte_long" },
    { cle: "relation_client", numero: 5, titre: "RELATION AVEC LE CLIENT", origine: "declare", saisie: "texte_long" },
    { cle: "photos_avant", numero: 6, titre: "Photographies avant intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_apres", numero: 6, titre: "Photographies après intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_transmises", numero: 6, titre: "Photographies transmises au Donneur d'ordre", origine: "declare", saisie: "oui_non" },
    { cle: "observations", numero: 7, titre: "OBSERVATIONS FINALES", origine: "declare", saisie: "texte_long" },
  ],
};

// ══════════════════════════════════════════════════════════════════════
//  SIGNATURES
// ══════════════════════════════════════════════════════════════════════

export const BLOC_SIGNATURES = {
  lieu: "Fait à {{ville_signature}}, le {{date_signature}}.",
  exemplaires: "Établi en deux exemplaires, un pour chacune des parties.",
  parties: [
    {
      titre: "POUR LE DONNEUR D'ORDRE",
      lignes: [
        "{{principal_company_name}}",
        "Représentée par {{principal_company_representative}}",
        "{{principal_company_representative_title}}",
      ],
    },
    {
      titre: "POUR LE SOUS-TRAITANT",
      lignes: [
        "{{subcontractor_legal_name}}",
        "Représentée par {{subcontractor_representative}}",
        "{{subcontractor_representative_title}}",
      ],
    },
  ],
} as const;

/**
 * Variables propres à ce modèle, en plus du catalogue général.
 *
 * Elles sont calculées au moment de l'émission : le détail des prestations
 * retenues, les consignes de sécurité qu'elles entraînent, les montants.
 */
export const VARIABLES_MODELE = [
  { cle: "prestations_detaillees", libelle: "Détail des prestations commandées", obligatoire: true },
  { cle: "securite_mission", libelle: "Équipements et consignes de sécurité de la mission", obligatoire: false },
  // Exigées par le contrat de désinfection et de décontamination : elles
  // définissent le protocole, donc le risque que le sous-traitant accepte.
  { cle: "contamination_origine", libelle: "Origine déclarée de la contamination", obligatoire: true },
  { cle: "zones_surfaces", libelle: "Zones et surfaces à traiter", obligatoire: true },
  { cle: "produits_procedes", libelle: "Produits ou procédés prévus, si connus", obligatoire: false },
  { cle: "montant_ht", libelle: "Montant forfaitaire HT", obligatoire: true },
  { cle: "tva_detail", libelle: "TVA (taux et montant)", obligatoire: false },
  { cle: "montant_ttc", libelle: "Montant TTC", obligatoire: false },
  { cle: "consignes_particulieres", libelle: "Observations particulières", obligatoire: false },
  { cle: "ville_signature", libelle: "Ville de signature", obligatoire: true },
  { cle: "date_signature", libelle: "Date de signature", obligatoire: true },
] as const;
