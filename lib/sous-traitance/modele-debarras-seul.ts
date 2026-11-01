// CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE DÉBARRAS
//
// ✅ TEXTE FOURNI PAR LE CLIENT le 2026-11-01 (contrat 3 sur 4 reçus).
//
// Débarras SEUL, sans nettoyage. Ce qui le distingue vraiment du contrat
// « nettoyage et débarras » n'est pas une soustraction d'articles : son
// article 1 EXCLUT expressément le nettoyage approfondi, la désinfection et
// la décontamination, et son article 3 porte une liste d'EXCLUSIONS que les
// autres contrats n'ont pas. Confondre les deux ferait signer au
// sous-traitant un périmètre qu'il n'a pas accepté.
//
// L'article 2 ajoute le volume estimatif, et le rapport compte NEUF
// rubriques — la traçabilité des déchets y est une rubrique à part entière.

import type { Article } from "./clauses";
import type { BlocAnnexe, RubriqueRapport } from "./modele-nettoyage";

export const VERSION_DEBARRAS_SEUL = "2.0";

export const TITRE_DEBARRAS_SEUL =
  "CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE DÉBARRAS";

export const SOCLE_DEBARRAS_SEUL: Article[] = [
  {
    cle: "objet",
    titre: "OBJET DU CONTRAT",
    corps:
      "Le présent contrat définit les conditions dans lesquelles le Donneur d'ordre confie "
      + "au Sous-traitant l'exécution de prestations professionnelles de débarras.\n\n"
      + "Ces prestations peuvent comprendre le tri des objets désignés, leur manutention, "
      + "leur conditionnement, leur chargement, leur transport et leur évacuation vers les "
      + "installations autorisées.\n\n"
      + "Le Sous-traitant intervient en qualité d'entreprise indépendante et assume la "
      + "responsabilité de l'organisation et de la bonne exécution des prestations "
      + "confiées.\n\n"
      + "Le présent contrat ne comprend aucune prestation de nettoyage approfondi, de "
      + "désinfection, de décontamination ou de traitement spécialisé, sauf stipulation "
      + "écrite contraire.",
  },
  {
    cle: "chantier",
    titre: "IDENTIFICATION DU CHANTIER",
    corps:
      "Client final : {{client_lastname}} {{client_firstname}}.\n"
      + "Adresse d'intervention : {{mission_address}}.\n"
      + "Localisation : {{mission_access_conditions}}.\n"
      + "Date d'intervention : {{mission_date}}.\n"
      + "Nature de l'intervention : débarras.\n"
      + "Volume estimatif à évacuer : {{mission_volume_m3}}.\n\n"
      + "Les caractéristiques particulières du chantier sont précisées dans le bon de "
      + "mission annexé.",
  },
  {
    cle: "prestations",
    titre: "DESCRIPTION DES PRESTATIONS",
    corps:
      "Le Sous-traitant est chargé d'exécuter les prestations suivantes, dans les limites "
      + "du périmètre convenu :\n"
      + "- Identification des objets et encombrants expressément désignés pour enlèvement.\n"
      + "- Tri des éléments concernés conformément aux consignes validées.\n"
      + "- Protection des zones de passage et des parties communes.\n"
      + "- Manutention et déplacement des objets.\n"
      + "- Démontage simple des éléments expressément prévus dans la mission, lorsque cette "
      + "opération peut être réalisée sans intervention technique spécialisée.\n"
      + "- Conditionnement des objets et déchets.\n"
      + "- Chargement dans les véhicules adaptés.\n"
      + "- Transport vers les installations autorisées.\n"
      + "- Déchargement et dépôt dans les filières appropriées.\n"
      + "- Retrait des résidus directement générés par les opérations de manutention et de "
      + "chargement.\n\n"
      + "PRESTATIONS COMMANDÉES\n\n"
      + "{{prestations_detaillees}}\n\n"
      + "EXCLUSIONS\n\n"
      + "Sauf mention expresse dans le bon de mission, sont exclus :\n"
      + "- Le nettoyage approfondi des locaux.\n"
      + "- Le lessivage des murs et plafonds.\n"
      + "- La désinfection et la décontamination.\n"
      + "- Le traitement de déchets dangereux.\n"
      + "- Les travaux de démolition ou de réparation.\n"
      + "- Le démontage d'installations techniques nécessitant une qualification "
      + "particulière.\n\n"
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
      + "souscrites, les risques liés à la manutention, au transport, aux dommages "
      + "matériels et corporels ainsi qu'à l'intervention dans les locaux du client.\n\n"
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
      + "Il veille notamment à disposer de véhicules adaptés, de matériels de manutention, "
      + "de protections pour les sols et les parties communes, d'équipements de protection "
      + "individuelle et de moyens appropriés pour le conditionnement et l'évacuation des "
      + "déchets.\n\n"
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
      + "et d'exposition à des substances dangereuses.\n\n"
      + "En présence de déchets dangereux, de matériaux suspects, de risques biologiques "
      + "importants ou de toute situation nécessitant une qualification particulière, il "
      + "doit suspendre les opérations concernées et en informer immédiatement le Donneur "
      + "d'ordre.\n\n"
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
      + "obligations, les dommages causés pendant le transport et les conséquences d'une "
      + "mauvaise exécution des prestations.\n\n"
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
    titre: "GESTION ET TRAÇABILITÉ DES DÉCHETS",
    corps:
      "Le Sous-traitant s'engage à respecter la réglementation applicable à la collecte, au "
      + "transport et au traitement des déchets.\n\n"
      + "Il doit utiliser les filières autorisées correspondant à la nature des déchets "
      + "collectés.\n\n"
      + "Tout dépôt sauvage, abandon ou traitement irrégulier est strictement interdit.\n\n"
      + "Il doit conserver les justificatifs de dépôt, de traitement ou de traçabilité "
      + "légalement requis et les communiquer au Donneur d'ordre lorsque cela est "
      + "nécessaire.\n\n"
      + "Il assume les conséquences de ses propres infractions et manquements, sans "
      + "préjudice des responsabilités que la réglementation peut également faire peser sur "
      + "d'autres intervenants.",
    reference: "Articles L. 541-1 et suivants du code de l'environnement",
  },
  {
    cle: "transport_obligations",
    titre: "OBLIGATIONS RELATIVES AU TRANSPORT",
    corps:
      "Le Sous-traitant déclare disposer des autorisations nécessaires aux opérations de "
      + "transport réalisées pour le compte d'autrui, lorsque la réglementation les "
      + "impose.\n\n"
      + "Il garantit l'utilisation de véhicules régulièrement assurés, entretenus et "
      + "adaptés aux marchandises transportées.\n\n"
      + "Il veille au chargement, à l'arrimage et à la sécurisation des biens "
      + "transportés.\n\n"
      + "Il demeure responsable des opérations relevant de sa mission, sous réserve des "
      + "dispositions légales impératives applicables au transport routier.",
    reference: "Articles L. 3211-1 et suivants du code des transports",
  },
  {
    cle: "qualite",
    titre: "QUALITÉ D'EXÉCUTION",
    corps:
      "Le Sous-traitant s'engage à exécuter les prestations avec diligence, "
      + "professionnalisme et conformément aux règles de l'art.\n\n"
      + "Il doit respecter les tâches expressément convenues.\n\n"
      + "Les opérations de manutention, de chargement et d'évacuation doivent être "
      + "réalisées avec des méthodes adaptées à la nature des objets et aux contraintes des "
      + "locaux.\n\n"
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
      + "Ce forfait comprend les prestations expressément convenues, notamment le tri, la "
      + "manutention, le chargement, le transport et l'évacuation des objets et déchets "
      + "désignés, ainsi que la mobilisation du personnel, des véhicules, des équipements et "
      + "des matériels nécessaires.\n\n"
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
//  ANNEXE 1 — BON DE MISSION (avec le volume estimatif)
// ══════════════════════════════════════════════════════════════════════

export const ANNEXE_BON_MISSION_DEBARRAS_SEUL: { titre: string; blocs: BlocAnnexe[]; pied: string[] } = {
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
    // Propre au débarras seul : le volume est la base du prix forfaitaire.
    { titre: "VOLUME ESTIMATIF", lignes: ["{{mission_volume_m3}}"] },
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
    + "des déchets, à la manutention ou à la sécurité.",
    "Les opérations doivent respecter le périmètre convenu et les obligations "
    + "réglementaires applicables.",
    "Aucune prestation supplémentaire ne peut être facturée sans accord préalable du "
    + "Donneur d'ordre.",
  ],
};

// ══════════════════════════════════════════════════════════════════════
//  ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION (NEUF rubriques)
// ══════════════════════════════════════════════════════════════════════
//
// La traçabilité des déchets devient une rubrique AUTONOME (3), distincte du
// volume et de la nature (2). C'est le seul des trois contrats à les séparer,
// et cela se comprend : sur un débarras seul, le justificatif de filière est
// la pièce centrale du dossier.

export const ANNEXE_RAPPORT_DEBARRAS_SEUL: { titre: string; entete: RubriqueRapport[]; rubriques: RubriqueRapport[] } = {
  titre: "ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION",
  entete: [
    { cle: "sous_traitant", numero: null, titre: "Entreprise intervenante", origine: "prerempli", saisie: "texte" },
    { cle: "donneur_ordre", numero: null, titre: "Donneur d'ordre", origine: "prerempli", saisie: "texte" },
    { cle: "client", numero: null, titre: "Client final", origine: "prerempli", saisie: "texte" },
    { cle: "adresse", numero: null, titre: "Adresse", origine: "prerempli", saisie: "texte" },
    { cle: "date", numero: null, titre: "Date de l'intervention", origine: "prerempli", saisie: "texte" },
  ],
  rubriques: [
    { cle: "realisees", numero: 1, titre: "PRESTATIONS RÉALISÉES — opérations de débarras", origine: "declare", saisie: "texte_long" },
    { cle: "volume_evacue", numero: 2, titre: "Volume et nature des éléments évacués — volume estimé", origine: "declare", saisie: "texte" },
    { cle: "nature_evacuee", numero: 2, titre: "Volume et nature des éléments évacués — nature des objets et déchets", origine: "declare", saisie: "texte_long" },
    { cle: "dechets_filiere", numero: 3, titre: "Traçabilité des déchets — lieu de dépôt ou filière de traitement", origine: "declare", saisie: "texte" },
    { cle: "dechets_justificatifs", numero: 3, titre: "Traçabilité des déchets — justificatifs, lorsque requis", origine: "declare", saisie: "texte_long" },
    { cle: "difficultes", numero: 4, titre: "DIFFICULTÉS RENCONTRÉES", origine: "declare", saisie: "texte_long" },
    { cle: "non_realisees", numero: 5, titre: "PRESTATIONS NON RÉALISÉES OU RÉSERVES", origine: "declare", saisie: "texte_long" },
    { cle: "incidents", numero: 6, titre: "INCIDENTS OU DÉGRADATIONS ÉVENTUELS", origine: "declare", saisie: "texte_long" },
    { cle: "relation_client", numero: 7, titre: "RELATION AVEC LE CLIENT", origine: "declare", saisie: "texte_long" },
    { cle: "photos_avant", numero: 8, titre: "Photographies avant intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_apres", numero: 8, titre: "Photographies après intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_transmises", numero: 8, titre: "Photographies transmises au Donneur d'ordre", origine: "declare", saisie: "oui_non" },
    { cle: "observations", numero: 9, titre: "OBSERVATIONS FINALES", origine: "declare", saisie: "texte_long" },
  ],
};
