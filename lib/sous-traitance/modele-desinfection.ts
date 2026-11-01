// CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE DÉSINFECTION
// ET DE DÉCONTAMINATION
//
// ✅ TEXTE FOURNI PAR LE CLIENT le 2026-11-01 (contrat 4 sur 4 reçus).
//
// C'est exactement le périmètre que le contrat « débarras seul » exclut à son
// article 1. Lui seul porte les obligations propres au risque sanitaire :
// autorisation d'emploi des produits biocides (art. 5), formation au risque
// biologique (art. 6), concentrations et temps de contact (art. 3-C), délais
// de réoccupation des locaux (art. 9), contrôles de validation (art. 22).
//
// Deux réserves de son article 3 méritent d'être lues : l'amiante, le plomb,
// les déchets radioactifs et les substances chimiques dangereuses sont
// EXCLUS sauf accord spécifique, et le Sous-traitant ne garantit AUCUNE
// stérilité absolue en l'absence de protocole de validation défini. L'article
// 21 en tire la conséquence : une photographie ne prouve pas l'efficacité
// microbiologique d'un traitement.
//
// Le rapport de fin d'intervention compte ONZE rubriques — le plus détaillé
// des quatre contrats.

import type { Article } from "./clauses";
import type { BlocAnnexe, RubriqueRapport } from "./modele-nettoyage";

export const VERSION_DESINFECTION = "2.0";

export const TITRE_DESINFECTION =
  "CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE DÉSINFECTION "
  + "ET DE DÉCONTAMINATION";

export const SOCLE_DESINFECTION: Article[] = [
  {
    cle: "objet",
    titre: "OBJET DU CONTRAT",
    corps:
      "Le présent contrat définit les conditions dans lesquelles le Donneur d'ordre confie "
      + "au Sous-traitant l'exécution de prestations professionnelles de désinfection et de "
      + "décontamination.\n\n"
      + "Ces prestations peuvent notamment comprendre le nettoyage préalable des surfaces "
      + "concernées, l'application de procédés de désinfection adaptés, le traitement des "
      + "zones présentant des souillures biologiques et la décontamination des éléments "
      + "expressément désignés dans le bon de mission.\n\n"
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
      "Client final : {{client_lastname}} {{client_firstname}}.\n\n"
      + "Adresse d'intervention : {{mission_address}}.\n\n"
      + "Localisation : {{mission_access_conditions}}.\n\n"
      + "Date d'intervention : {{mission_date}}.\n\n"
      + "Nature de l'intervention : désinfection et décontamination.\n\n"
      + "Origine déclarée de la contamination : {{contamination_origine}}.\n\n"
      + "Surfaces et zones concernées : {{zones_surfaces}}.\n\n"
      + "Les caractéristiques particulières du chantier sont précisées dans le bon de "
      + "mission annexé.",
  },
  {
    cle: "prestations",
    titre: "DESCRIPTION DES PRESTATIONS",
    corps:
      "Le Sous-traitant est chargé d'exécuter les prestations suivantes, dans les limites "
      + "du périmètre convenu.\n\n"
      + "A. ÉVALUATION PRÉALABLE\n\n"
      + "- Prise de connaissance des informations relatives à la contamination.\n"
      + "- Identification des zones concernées par l'intervention.\n"
      + "- Évaluation des risques prévisibles pour le personnel, les occupants et les "
      + "tiers.\n"
      + "- Détermination des moyens de protection et des procédés adaptés.\n"
      + "- Signalement immédiat des situations nécessitant une intervention spécialisée non "
      + "prévue.\n\n"
      + "B. NETTOYAGE PRÉALABLE\n\n"
      + "- Retrait des souillures accessibles lorsque cette opération est comprise dans la "
      + "mission.\n"
      + "- Nettoyage des surfaces expressément désignées.\n"
      + "- Préparation des supports avant application des procédés de désinfection.\n\n"
      + "C. DÉSINFECTION\n\n"
      + "- Application de produits désinfectants adaptés aux surfaces, aux organismes ciblés "
      + "et aux conditions d'utilisation autorisées.\n"
      + "- Respect des concentrations, temps de contact, modalités d'application et "
      + "précautions prescrits par les fabricants.\n"
      + "- Traitement des zones prévues dans le bon de mission.\n\n"
      + "D. DÉCONTAMINATION\n\n"
      + "- Traitement des surfaces ou équipements présentant une contamination identifiée ou "
      + "suspectée, dans les limites des compétences et autorisations du Sous-traitant.\n"
      + "- Collecte et conditionnement des consommables et déchets contaminés conformément à "
      + "leur classification réglementaire.\n"
      + "- Application des protocoles de protection et de prévention des contaminations "
      + "croisées.\n\n"
      + "E. PRESTATIONS SPÉCIFIQUES COMMANDÉES\n\n"
      + "{{prestations_detaillees}}\n\n"
      + "Le traitement de l'amiante, du plomb, des déchets radioactifs, des substances "
      + "chimiques dangereuses et de tout autre risque relevant d'une réglementation ou "
      + "qualification particulière est exclu, sauf accord spécifique et respect des "
      + "exigences légales correspondantes.\n\n"
      + "Le Sous-traitant ne peut garantir une stérilité absolue des locaux ou l'élimination "
      + "de tout risque sanitaire en l'absence de protocole de validation expressément "
      + "défini et techniquement réalisable.\n\n"
      + "Toute prestation supplémentaire doit faire l'objet d'un accord préalable du "
      + "Donneur d'ordre.",
  },
  {
    cle: "independance",
    titre: "INDÉPENDANCE DU SOUS-TRAITANT",
    corps:
      "Le Sous-traitant exerce son activité en toute indépendance juridique, administrative "
      + "et organisationnelle.\n\n"
      + "Il organise librement ses moyens d'exécution, dans le respect des délais, des "
      + "résultats contractuellement convenus et des règles de sécurité.\n\n"
      + "Le présent contrat ne constitue ni un contrat de travail, ni une association, ni un "
      + "mandat général.\n\n"
      + "Le Sous-traitant demeure seul responsable de la gestion de son personnel, de ses "
      + "moyens matériels et de ses obligations professionnelles.",
  },
  {
    cle: "declarations",
    titre: "DÉCLARATIONS ADMINISTRATIVES ET LÉGALES",
    corps:
      "Le Sous-traitant déclare sur l'honneur :\n\n"
      + "- Être régulièrement immatriculé auprès des organismes compétents.\n"
      + "- Être à jour de ses déclarations fiscales et sociales.\n"
      + "- Être à jour du paiement de ses cotisations et contributions obligatoires.\n"
      + "- Employer, le cas échéant, du personnel régulièrement déclaré.\n"
      + "- Respecter les dispositions relatives au droit du travail et à la lutte contre le "
      + "travail dissimulé.\n"
      + "- Disposer des autorisations, certifications et qualifications légalement "
      + "nécessaires aux activités effectivement exercées, notamment pour l'utilisation "
      + "professionnelle de produits biocides lorsque la réglementation l'exige.\n"
      + "- Ne faire l'objet d'aucune interdiction l'empêchant d'exécuter les prestations "
      + "confiées.\n\n"
      + "Le Sous-traitant s'engage à maintenir la régularité de sa situation pendant toute "
      + "la durée de ses relations contractuelles avec le Donneur d'ordre.\n\n"
      + "Ces déclarations ne dispensent pas le Donneur d'ordre de procéder aux vérifications "
      + "imposées par la législation, notamment au titre de son obligation de vigilance "
      + "lorsque celle-ci est applicable.",
  },
  {
    cle: "personnel",
    titre: "PERSONNEL ET OBLIGATIONS SOCIALES",
    corps:
      "Le Sous-traitant assume seul la responsabilité de son personnel.\n\n"
      + "Il garantit que les personnes mobilisées disposent des compétences et formations "
      + "nécessaires aux opérations de désinfection et de décontamination confiées.\n\n"
      + "Il prend en charge leurs rémunérations, cotisations, assurances, équipements et "
      + "obligations déclaratives.\n\n"
      + "Il veille à ce que son personnel soit informé des risques biologiques et chimiques "
      + "liés à l'intervention et formé à l'utilisation des équipements de protection "
      + "appropriés.\n\n"
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
      + "Ces assurances doivent être adaptées aux risques effectivement encourus, notamment "
      + "aux dommages matériels et corporels, aux activités de désinfection et de "
      + "décontamination, ainsi qu'aux conséquences de fautes commises pendant "
      + "l'intervention, dans les limites des garanties souscrites.\n\n"
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
      + "Il veille notamment à disposer de matériels professionnels adaptés, de produits "
      + "autorisés pour les usages envisagés, d'équipements de protection individuelle, de "
      + "moyens de confinement ou de protection lorsque nécessaires et de contenants adaptés "
      + "aux déchets produits.\n\n"
      + "Le Sous-traitant est responsable de l'entretien, de la conformité et de la bonne "
      + "utilisation de ses équipements.\n\n"
      + "Il veille à respecter les notices techniques et fiches de données de sécurité des "
      + "produits employés.",
  },
  {
    cle: "securite",
    titre: "SÉCURITÉ ET RISQUES PROFESSIONNELS",
    corps:
      "Le Sous-traitant s'engage à évaluer les risques prévisibles avant et pendant "
      + "l'intervention.\n\n"
      + "Il prend toutes les mesures nécessaires à la protection de son personnel, des "
      + "occupants, des tiers et des biens.\n\n"
      + "Il veille notamment à prévenir les risques biologiques, chimiques, respiratoires, "
      + "de contamination croisée et d'exposition accidentelle aux produits utilisés.\n\n"
      + "Il définit les conditions d'accès aux zones traitées et les délais de réoccupation "
      + "lorsque les produits ou procédés employés l'exigent.\n\n"
      + "En présence de matériaux suspects, de substances dangereuses non identifiées ou de "
      + "toute situation nécessitant une qualification particulière, il doit suspendre les "
      + "opérations concernées et en informer immédiatement le Donneur d'ordre.\n\n"
      + "Aucune opération soumise à une autorisation ou qualification particulière ne peut "
      + "être exécutée sans que les conditions réglementaires soient réunies.",
  },
  {
    cle: "responsabilite",
    titre: "RESPONSABILITÉ DU SOUS-TRAITANT",
    corps:
      "Le Sous-traitant assume la responsabilité des dommages résultant de ses fautes, "
      + "négligences, imprudences ou manquements contractuels.\n\n"
      + "Cette responsabilité couvre notamment les dommages causés aux locaux, aux "
      + "équipements et aux biens du client, les accidents imputables à un défaut de "
      + "prévention, les dégradations résultant d'une mauvaise utilisation des produits, les "
      + "dommages liés à une contamination croisée imputable à ses opérations et les "
      + "conséquences d'une mauvaise exécution des prestations.\n\n"
      + "Le Sous-traitant s'engage à prendre en charge les conséquences financières des "
      + "dommages qui lui sont juridiquement imputables.",
  },
  {
    cle: "protection_biens",
    titre: "PROTECTION DES BIENS DU CLIENT",
    corps:
      "Le Sous-traitant doit prendre toutes les précautions nécessaires pour protéger les "
      + "biens conservés par le client.\n\n"
      + "Il doit vérifier la compatibilité des produits et procédés avec les surfaces et "
      + "matériaux traités.\n\n"
      + "Il lui est interdit de retirer, jeter, vendre ou conserver un bien qui n'a pas été "
      + "expressément désigné comme devant être évacué.\n\n"
      + "En cas de doute sur le traitement ou la destination d'un objet, le Sous-traitant "
      + "doit demander confirmation au Donneur d'ordre avant toute opération "
      + "irréversible.\n\n"
      + "Toute perte ou destruction fautive engage sa responsabilité dans les conditions "
      + "prévues par la loi.",
  },
  {
    cle: "dechets",
    titre: "GESTION ET TRAÇABILITÉ DES DÉCHETS",
    corps:
      "Le Sous-traitant s'engage à respecter la réglementation applicable à la collecte, au "
      + "conditionnement, au transport et au traitement des déchets issus de son "
      + "intervention.\n\n"
      + "Il doit distinguer les déchets ordinaires des déchets soumis à des filières "
      + "spécifiques.\n\n"
      + "Les déchets présentant un risque biologique ou chimique doivent être gérés "
      + "conformément à leur nature et à leur classification réglementaire.\n\n"
      + "Il doit utiliser les filières autorisées et conserver les justificatifs de "
      + "traçabilité légalement requis.\n\n"
      + "Tout dépôt sauvage, abandon ou traitement irrégulier est strictement interdit.\n\n"
      + "Le Sous-traitant assume les conséquences de ses propres infractions et manquements, "
      + "sans préjudice des responsabilités que la réglementation peut également faire peser "
      + "sur d'autres intervenants.",
  },
  {
    cle: "transport_materiel",
    titre: "TRANSPORT DES PRODUITS ET MATÉRIELS",
    corps:
      "Le Sous-traitant assure, sous sa responsabilité, le transport des matériels, "
      + "équipements, produits et déchets relevant de sa mission.\n\n"
      + "Il garantit l'utilisation de véhicules régulièrement assurés, entretenus et adaptés "
      + "aux produits ou matières transportés.\n\n"
      + "Il veille au conditionnement, à l'arrimage et à la sécurisation des chargements.\n\n"
      + "Lorsque la nature des produits ou déchets l'exige, il respecte les réglementations "
      + "spécifiques applicables à leur transport.\n\n"
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
      + "Les opérations doivent être réalisées avec des méthodes adaptées aux contaminants "
      + "ciblés, aux matériaux concernés et aux caractéristiques des locaux.\n\n"
      + "Le Sous-traitant doit respecter les protocoles applicables, les prescriptions des "
      + "fabricants et les conditions de sécurité.\n\n"
      + "Il doit signaler toute impossibilité technique ou difficulté susceptible de "
      + "compromettre la qualité du résultat.",
  },
  {
    cle: "delais",
    titre: "RESPECT DES DÉLAIS",
    corps:
      "Le Sous-traitant s'engage à respecter la date d'intervention convenue.\n\n"
      + "Toute difficulté susceptible de provoquer un retard doit être signalée au Donneur "
      + "d'ordre dès qu'elle est connue.\n\n"
      + "Le Sous-traitant doit prendre les mesures raisonnables nécessaires pour limiter les "
      + "conséquences d'un retard qui lui est imputable.\n\n"
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
      + "Les informations susceptibles de révéler des données relatives à la santé ou à la "
      + "situation personnelle des occupants doivent faire l'objet de précautions "
      + "particulières.\n\n"
      + "Cette obligation subsiste après la fin du contrat.",
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
      + "appropriée.\n\n"
      + "Les photographies ne constituent pas, à elles seules, une preuve de l'efficacité "
      + "microbiologique d'un traitement.",
  },
  {
    cle: "rapport",
    titre: "RAPPORT D'INTERVENTION",
    corps:
      "À l'issue de la mission, le Sous-traitant doit transmettre un rapport "
      + "d'intervention.\n\n"
      + "Ce rapport précise notamment la date de réalisation, l'adresse du chantier, les "
      + "zones traitées, les prestations exécutées, les produits ou procédés employés, les "
      + "éventuelles difficultés rencontrées, les travaux non réalisés et leurs motifs, les "
      + "dommages ou incidents éventuels, les réserves éventuelles ainsi que les "
      + "photographies et justificatifs requis.\n\n"
      + "Lorsque des contrôles de validation sont prévus, leurs résultats et les méthodes "
      + "utilisées doivent être mentionnés ou annexés.\n\n"
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
      + "Ce forfait comprend les prestations expressément convenues, les opérations "
      + "préparatoires nécessaires, la mobilisation du personnel, les produits, les "
      + "équipements, les protections et les matériels nécessaires à l'intervention.\n\n"
      + "DÉCOMPOSITION FINANCIÈRE\n\n"
      + "- Montant forfaitaire HT : {{montant_ht}}\n"
      + "- TVA : {{tva_detail}}\n"
      + "- Montant TTC : {{montant_ttc}}\n\n"
      + "Cette décomposition s'applique sous réserve du régime fiscal effectivement "
      + "applicable au Sous-traitant.\n\n"
      + "Le prix forfaitaire couvre l'ensemble des prestations expressément convenues.\n\n"
      + "Aucun supplément ne pourra être facturé sans accord préalable et écrit du Donneur "
      + "d'ordre.\n\n"
      + "La facture devra être établie au nom de {{principal_company_name}}, conformément "
      + "aux dispositions fiscales applicables.\n\n"
      + "Les délais et modalités de règlement devront respecter les dispositions légales "
      + "impératives.\n\n"
      + "Le montant indiqué correspond exclusivement à la rémunération convenue entre le "
      + "Donneur d'ordre et le Sous-traitant.",
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
      + "Si une clause est déclarée nulle ou inapplicable, les autres dispositions demeurent "
      + "applicables dans la mesure où l'économie générale du contrat peut être "
      + "préservée.\n\n"
      + "Les parties reconnaissent avoir pris connaissance du contrat et de ses annexes.\n\n"
      + "Date du contrat et de prise d'effet : {{mission_date}}.",
  },
];

// ══════════════════════════════════════════════════════════════════════
//  ANNEXE 1 — BON DE MISSION (treize blocs)
// ══════════════════════════════════════════════════════════════════════
//
// Quatre blocs n'existent dans aucun des trois autres contrats : la nature de
// l'intervention, l'origine déclarée de la contamination, les zones et
// surfaces à traiter, et les produits ou procédés prévus. Ce sont eux qui
// déterminent le protocole, donc le risque accepté par le sous-traitant.

export const ANNEXE_BON_MISSION_DESINFECTION: {
  titre: string; blocs: BlocAnnexe[]; pied: string[];
} = {
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
    { titre: "ADRESSE DU CHANTIER", lignes: ["{{mission_address}}"] },
    { titre: "DATE D'INTERVENTION", lignes: ["{{mission_date}}"] },
    { titre: "NATURE DE L'INTERVENTION", lignes: ["Désinfection et décontamination."] },
    // Propres à ce contrat : ils définissent le protocole et le risque.
    { titre: "ORIGINE DÉCLARÉE DE LA CONTAMINATION", lignes: ["{{contamination_origine}}"] },
    { titre: "ZONES ET SURFACES À TRAITER", lignes: ["{{zones_surfaces}}"] },
    { titre: "PRESTATIONS COMMANDÉES", lignes: ["{{prestations_detaillees}}"] },
    { titre: "PRODUITS OU PROCÉDÉS PRÉVUS", lignes: ["{{produits_procedes}}"] },
    { titre: "CONSIGNES DE SÉCURITÉ", lignes: ["{{securite_mission}}"] },
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
    "Le Sous-traitant doit signaler toute difficulté liée à la nature de la contamination, "
    + "aux produits utilisés ou à la sécurité.",
    "Les opérations doivent respecter le périmètre convenu et les obligations "
    + "réglementaires applicables.",
    "Aucune prestation supplémentaire ne peut être facturée sans accord préalable du "
    + "Donneur d'ordre.",
  ],
};

// ══════════════════════════════════════════════════════════════════════
//  ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION (ONZE rubriques)
// ══════════════════════════════════════════════════════════════════════
//
// Le plus détaillé des quatre. La rubrique 3 exige les concentrations et les
// TEMPS DE CONTACT appliqués : sans eux, l'article 3-C n'est pas vérifiable.
// La rubrique 4 exige les consignes de réoccupation, et la rubrique 9 les
// contrôles de validation — seule pièce capable d'étayer un résultat, puisque
// l'article 21 refuse à la photographie toute valeur de preuve
// microbiologique.

export const ANNEXE_RAPPORT_DESINFECTION: {
  titre: string; entete: RubriqueRapport[]; rubriques: RubriqueRapport[];
} = {
  titre: "ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION",
  entete: [
    { cle: "sous_traitant", numero: null, titre: "Entreprise intervenante", origine: "prerempli", saisie: "texte" },
    { cle: "donneur_ordre", numero: null, titre: "Donneur d'ordre", origine: "prerempli", saisie: "texte" },
    { cle: "client", numero: null, titre: "Client final", origine: "prerempli", saisie: "texte" },
    { cle: "adresse", numero: null, titre: "Adresse", origine: "prerempli", saisie: "texte" },
    { cle: "date", numero: null, titre: "Date de l'intervention", origine: "prerempli", saisie: "texte" },
  ],
  rubriques: [
    { cle: "realisees", numero: 1, titre: "PRESTATIONS RÉALISÉES — opérations de désinfection et de décontamination", origine: "declare", saisie: "texte_long" },
    { cle: "zones_traitees", numero: 2, titre: "ZONES ET SURFACES TRAITÉES", origine: "declare", saisie: "texte_long" },
    { cle: "produits_noms", numero: 3, titre: "Produits et procédés utilisés — nom des produits", origine: "declare", saisie: "texte" },
    { cle: "produits_references", numero: 3, titre: "Produits et procédés utilisés — références ou autorisations pertinentes", origine: "declare", saisie: "texte" },
    { cle: "produits_concentrations", numero: 3, titre: "Produits et procédés utilisés — concentrations et modalités d'application", origine: "declare", saisie: "texte_long" },
    { cle: "produits_temps_contact", numero: 3, titre: "Produits et procédés utilisés — temps de contact appliqués", origine: "declare", saisie: "texte" },
    { cle: "securite_epi", numero: 4, titre: "Mesures de sécurité — équipements de protection utilisés", origine: "declare", saisie: "texte_long" },
    { cle: "securite_occupants", numero: 4, titre: "Mesures de sécurité — mesures de protection des occupants", origine: "declare", saisie: "texte_long" },
    { cle: "securite_reoccupation", numero: 4, titre: "Mesures de sécurité — consignes de réoccupation", origine: "declare", saisie: "texte_long" },
    { cle: "dechets_nature", numero: 5, titre: "Gestion des déchets — nature des déchets", origine: "declare", saisie: "texte" },
    { cle: "dechets_filiere", numero: 5, titre: "Gestion des déchets — filière de traitement", origine: "declare", saisie: "texte" },
    { cle: "dechets_justificatifs", numero: 5, titre: "Gestion des déchets — justificatifs de traçabilité, lorsque requis", origine: "declare", saisie: "texte_long" },
    { cle: "difficultes", numero: 6, titre: "DIFFICULTÉS RENCONTRÉES", origine: "declare", saisie: "texte_long" },
    { cle: "non_realisees", numero: 7, titre: "PRESTATIONS NON RÉALISÉES OU RÉSERVES", origine: "declare", saisie: "texte_long" },
    { cle: "incidents", numero: 8, titre: "INCIDENTS OU DÉGRADATIONS ÉVENTUELS", origine: "declare", saisie: "texte_long" },
    { cle: "controles", numero: 9, titre: "CONTRÔLES ÉVENTUELLEMENT RÉALISÉS — méthodes et résultats", origine: "declare", saisie: "texte_long" },
    { cle: "photos_avant", numero: 10, titre: "Photographies avant intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_apres", numero: 10, titre: "Photographies après intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_transmises", numero: 10, titre: "Photographies transmises au Donneur d'ordre", origine: "declare", saisie: "oui_non" },
    { cle: "observations", numero: 11, titre: "OBSERVATIONS FINALES", origine: "declare", saisie: "texte_long" },
  ],
};
