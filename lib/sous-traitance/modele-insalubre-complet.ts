// CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE NETTOYAGE
// INSALUBRE ET DE DÉBARRAS INSALUBRE
//
// ✅ TEXTE FOURNI PAR LE CLIENT le 2026-11-01 (contrat 7).
//
// Il comble exactement le trou laissé par les contrats 5 et 6 : le premier
// exclut le débarras, le second exclut le nettoyage approfondi. Un chantier
// qui demande les deux — le cas le plus fréquent sur ce terrain — n'avait
// donc aucun texte. C'est désormais celui-ci.
//
// Sa structure est une CHRONOLOGIE, pas une liste : l'article 3 déroule sept
// sections A à G, dont trois phases numérotées — débarras, puis nettoyage
// approfondi, puis désinfection et décontamination. Le rapport suit le même
// ordre, avec quatre jeux de photographies au lieu de trois : avant, après
// débarras, après nettoyage, et transmises.
//
// La phrase qui compte, à l'article 3-E : « La désinfection et la
// décontamination ne doivent pas être considérées comme automatiquement
// comprises dans une mission de débarras et de nettoyage. » Les quatre
// options du bon de mission — lessivage, désinfection, désodorisation,
// décontamination — sont donc exclues par défaut, et chacune porte ses
// propres zones concernées.

import type { Article } from "./clauses";
import type { BlocAnnexe, RubriqueRapport } from "./modele-nettoyage";

export const VERSION_INSALUBRE_COMPLET = "2.0";

export const TITRE_INSALUBRE_COMPLET =
  "CONTRAT DE SOUS-TRAITANCE — PRESTATIONS PROFESSIONNELLES DE NETTOYAGE "
  + "INSALUBRE ET DE DÉBARRAS INSALUBRE";

export const SOCLE_INSALUBRE_COMPLET: Article[] = [
  {
    cle: "objet",
    titre: "OBJET DU CONTRAT",
    corps:
      "Le présent contrat définit les conditions dans lesquelles le Donneur d'ordre confie "
      + "au Sous-traitant l'exécution de prestations professionnelles de débarras et de "
      + "nettoyage approfondi de logements ou locaux présentant des conditions "
      + "d'insalubrité.\n\n"
      + "Ces prestations peuvent comprendre le tri, la manutention, le conditionnement, le "
      + "chargement, le transport et l'évacuation des objets et déchets désignés, suivis du "
      + "nettoyage approfondi des surfaces concernées.\n\n"
      + "Lorsque le bon de mission le prévoit expressément, les opérations peuvent également "
      + "comprendre la désinfection, la désodorisation et la décontamination de zones "
      + "déterminées.\n\n"
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
      + "Nature de l'intervention : débarras insalubre et nettoyage approfondi.\n\n"
      + "Surface concernée : {{mission_surface_m2}}.\n\n"
      + "Volume estimatif à évacuer : {{mission_volume_m3}}.\n\n"
      + "Niveau d'insalubrité déclaré : {{niveau_insalubrite}}.\n\n"
      + "Les caractéristiques particulières du chantier sont précisées dans le bon de "
      + "mission annexé.",
  },
  {
    cle: "prestations",
    titre: "DESCRIPTION DES PRESTATIONS",
    corps:
      "Le Sous-traitant est chargé d'exécuter les prestations suivantes, dans les limites "
      + "du périmètre convenu.\n\n"
      + "A. PRÉPARATION ET SÉCURISATION\n\n"
      + "- Prise de connaissance des informations relatives à l'état du logement.\n"
      + "- Évaluation des risques prévisibles liés à l'encombrement, aux déchets, aux "
      + "souillures et à l'environnement.\n"
      + "- Identification des zones accessibles et des obstacles éventuels.\n"
      + "- Protection des zones de passage, des parties communes et des biens à "
      + "conserver.\n"
      + "- Mise en place des équipements de protection nécessaires.\n"
      + "- Signalement des situations dangereuses nécessitant une intervention "
      + "spécialisée.\n\n"
      + "B. PREMIÈRE PHASE – DÉBARRAS\n\n"
      + "- Identification des objets expressément désignés pour enlèvement.\n"
      + "- Tri des objets et déchets conformément aux consignes validées.\n"
      + "- Séparation des biens à conserver et des éléments destinés à l'évacuation.\n"
      + "- Repérage et préservation des documents administratifs, objets personnels, "
      + "médicaments et biens de valeur.\n"
      + "- Manutention des encombrants.\n"
      + "- Conditionnement des déchets selon leur nature.\n"
      + "- Chargement dans des véhicules adaptés.\n"
      + "- Transport vers les installations autorisées.\n"
      + "- Déchargement et dépôt dans les filières appropriées.\n\n"
      + "C. DEUXIÈME PHASE – NETTOYAGE APPROFONDI\n\n"
      + "- Retrait des salissures et résidus relevant des opérations de nettoyage.\n"
      + "- Dépoussiérage approfondi des surfaces accessibles.\n"
      + "- Aspiration et lavage approfondi des sols.\n"
      + "- Dégraissage des surfaces lorsque nécessaire.\n"
      + "- Nettoyage des plinthes, portes, poignées et interrupteurs accessibles.\n"
      + "- Nettoyage des équipements sanitaires.\n"
      + "- Détartrage des sanitaires et robinetteries.\n"
      + "- Nettoyage approfondi des cuisines et équipements accessibles.\n"
      + "- Nettoyage des meubles et surfaces compris dans la mission.\n"
      + "- Nettoyage des vitres et encadrements lorsque cette prestation est expressément "
      + "prévue.\n\n"
      + "D. LESSIVAGE DES MURS ET PLAFONDS\n\n"
      + "Le lessivage des murs et plafonds n'est compris que lorsqu'il est expressément "
      + "mentionné dans le bon de mission.\n\n"
      + "Il doit être réalisé avec des méthodes adaptées à la nature et à l'état des "
      + "supports.\n\n"
      + "E. TROISIÈME PHASE – DÉSINFECTION ET DÉCONTAMINATION\n\n"
      + "Lorsque ces prestations sont expressément commandées, le Sous-traitant réalise les "
      + "opérations de désinfection, de désodorisation ou de décontamination selon les "
      + "protocoles et les produits adaptés.\n\n"
      + "Ces opérations ne peuvent être exécutées que dans les limites des compétences, "
      + "qualifications et autorisations légalement nécessaires.\n\n"
      + "La désinfection et la décontamination ne doivent pas être considérées comme "
      + "automatiquement comprises dans une mission de débarras et de nettoyage.\n\n"
      + "F. FIN D'INTERVENTION\n\n"
      + "- Retrait des matériels et équipements utilisés.\n"
      + "- Vérification des zones concernées.\n"
      + "- Transmission des photographies et du rapport d'intervention.\n"
      + "- Transmission des justificatifs réglementaires de traitement des déchets, lorsque "
      + "requis.\n\n"
      + "G. PRESTATIONS SPÉCIFIQUES COMMANDÉES\n\n"
      + "{{prestations_detaillees}}\n\n"
      + "EXCLUSIONS\n\n"
      + "Sauf accord complémentaire exprès, sont exclus :\n\n"
      + "- Les travaux de réparation et de rénovation.\n"
      + "- Le traitement de l'amiante, du plomb ou d'autres substances réglementées.\n"
      + "- Les interventions spécialisées contre les nuisibles.\n"
      + "- L'évacuation de déchets dangereux nécessitant des autorisations ou filières "
      + "spécifiques non prévues dans la mission.\n\n"
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
      + "- Disposer des autorisations et qualifications légalement nécessaires aux activités "
      + "effectivement exercées.\n"
      + "- Disposer des autorisations nécessaires au transport ou à la collecte des déchets "
      + "lorsque la réglementation les impose.\n"
      + "- Disposer des qualifications nécessaires aux opérations de désinfection ou de "
      + "décontamination lorsqu'elles sont prévues et réglementées.\n"
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
      + "Il garantit que les personnes mobilisées disposent des compétences nécessaires et "
      + "travaillent dans des conditions conformes à la réglementation.\n\n"
      + "Il prend en charge leurs rémunérations, cotisations, assurances, équipements et "
      + "obligations déclaratives.\n\n"
      + "Il veille à ce que son personnel soit informé des risques liés à l'intervention "
      + "dans des locaux insalubres.\n\n"
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
      + "aux dommages matériels et corporels, aux opérations de manutention et de transport, "
      + "aux activités de nettoyage ainsi qu'aux interventions dans des locaux présentant "
      + "des conditions d'insalubrité, dans les limites des garanties souscrites.\n\n"
      + "Lorsque des opérations de désinfection ou de décontamination sont prévues, le "
      + "Sous-traitant doit disposer des garanties adaptées à ces activités.\n\n"
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
      + "de matériels professionnels de nettoyage, de protections pour les sols et les "
      + "parties communes, d'équipements de protection individuelle adaptés aux risques "
      + "rencontrés, de produits appropriés et de moyens de conditionnement et d'évacuation "
      + "des déchets.\n\n"
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
      + "Il veille notamment à prévenir les risques de blessures, de chute, d'effondrement "
      + "d'objets empilés, de manutention, de contamination, d'exposition biologique et "
      + "d'exposition à des substances dangereuses.\n\n"
      + "Il doit mettre en place les mesures de protection adaptées aux risques "
      + "effectivement identifiés.\n\n"
      + "En présence de déchets dangereux, de matériaux suspects, de risques biologiques "
      + "importants, de structures instables ou de toute situation nécessitant une "
      + "qualification particulière, il doit suspendre les opérations concernées et en "
      + "informer immédiatement le Donneur d'ordre.\n\n"
      + "Aucune opération soumise à une autorisation ou qualification particulière ne peut "
      + "être exécutée sans que les conditions réglementaires soient réunies.",
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
      + "obligations, les dommages causés pendant la manutention ou le transport, les "
      + "dommages résultant d'une mauvaise utilisation des produits et les conséquences "
      + "d'une mauvaise exécution des prestations.\n\n"
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
      + "Il doit faire preuve d'une vigilance particulière concernant les documents "
      + "personnels, objets de valeur, médicaments, souvenirs et effets appartenant au "
      + "client.\n\n"
      + "Tout objet manifestement personnel ou présentant une valeur particulière doit être "
      + "signalé avant son éventuelle évacuation.\n\n"
      + "Toute perte ou destruction fautive engage sa responsabilité dans les conditions "
      + "prévues par la loi.",
  },
  {
    cle: "dechets",
    titre: "GESTION ET TRAÇABILITÉ DES DÉCHETS",
    corps:
      "Le Sous-traitant s'engage à respecter la réglementation applicable à la collecte, au "
      + "conditionnement, au transport et au traitement des déchets.\n\n"
      + "Il doit utiliser les filières autorisées correspondant à la nature des déchets "
      + "collectés.\n\n"
      + "Il doit distinguer les déchets ordinaires des déchets nécessitant une prise en "
      + "charge spécifique.\n\n"
      + "Tout dépôt sauvage, abandon ou traitement irrégulier est strictement interdit.\n\n"
      + "Il doit conserver les justificatifs de dépôt, de traitement ou de traçabilité "
      + "légalement requis et les communiquer au Donneur d'ordre lorsque cela est "
      + "nécessaire.\n\n"
      + "Les déchets dangereux ou présentant des risques biologiques particuliers doivent "
      + "être pris en charge conformément à leur classification réglementaire.\n\n"
      + "Le Sous-traitant assume les conséquences de ses propres infractions et manquements, "
      + "sans préjudice des responsabilités que la réglementation peut également faire peser "
      + "sur d'autres intervenants.",
  },
  {
    cle: "transport_obligations",
    titre: "OBLIGATIONS RELATIVES AU TRANSPORT",
    corps:
      "Le Sous-traitant déclare disposer des autorisations nécessaires aux opérations de "
      + "transport réalisées pour le compte d'autrui, lorsque la réglementation les "
      + "impose.\n\n"
      + "Il garantit l'utilisation de véhicules régulièrement assurés, entretenus et adaptés "
      + "aux marchandises ou déchets transportés.\n\n"
      + "Il veille au chargement, à l'arrimage et à la sécurisation des biens "
      + "transportés.\n\n"
      + "Il doit respecter les règles particulières applicables au transport de déchets "
      + "lorsque celles-ci s'imposent.\n\n"
      + "Il demeure responsable des opérations relevant de sa mission, sous réserve des "
      + "dispositions légales impératives applicables au transport routier.",
  },
  // Seul article des sept contrats à cumuler les DEUX réserves : l'interdit
  // de destruction irréversible (venu du débarras) et l'absence de garantie
  // sur les dégradations irréversibles (venue du nettoyage).
  {
    cle: "qualite",
    titre: "QUALITÉ D'EXÉCUTION",
    corps:
      "Le Sous-traitant s'engage à exécuter les prestations avec diligence, "
      + "professionnalisme et conformément aux règles de l'art.\n\n"
      + "Il doit respecter les tâches expressément convenues.\n\n"
      + "Les opérations de tri, de manutention, d'évacuation et de nettoyage doivent être "
      + "réalisées avec des méthodes adaptées à la nature des objets, aux risques présents, "
      + "aux matériaux et aux contraintes des locaux.\n\n"
      + "Le Sous-traitant doit signaler toute impossibilité technique ou difficulté "
      + "susceptible de compromettre la qualité du résultat.\n\n"
      + "Il ne peut procéder à une destruction irréversible de biens dont l'évacuation n'a "
      + "pas été expressément autorisée.\n\n"
      + "Il ne peut garantir la disparition de dégradations irréversibles des matériaux, de "
      + "taches incrustées ou de défauts structurels ne pouvant être corrigés par les "
      + "opérations contractuellement prévues.",
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
    titre: "TRAVAUX SUPPLÉMENTAIRES ET VOLUME DE DÉBARRAS",
    corps:
      "Aucune prestation supplémentaire ne peut être facturée sans accord préalable du "
      + "Donneur d'ordre.\n\n"
      + "Le Sous-traitant ne peut modifier unilatéralement le prix, le périmètre ou les "
      + "conditions de la mission.\n\n"
      + "Le volume estimatif figurant au bon de mission constitue une donnée de référence "
      + "pour l'organisation de l'intervention.\n\n"
      + "Lorsque le volume réel, la nature des déchets, l'état des surfaces ou les "
      + "contraintes d'accès diffèrent substantiellement des informations initiales, le "
      + "Sous-traitant doit en informer le Donneur d'ordre avant de réaliser les opérations "
      + "supplémentaires concernées.\n\n"
      + "Toute modification du prix ou du périmètre doit faire l'objet d'un accord préalable "
      + "et écrit.",
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
      + "Les informations susceptibles de révéler la situation personnelle, les conditions "
      + "de vie ou l'état de santé des occupants doivent faire l'objet de précautions "
      + "particulières.\n\n"
      + "Cette obligation subsiste après la fin du contrat.",
  },
  {
    cle: "comportement",
    titre: "COMPORTEMENT PROFESSIONNEL ET RELATION AVEC LE CLIENT FINAL",
    corps:
      "Le Sous-traitant s'engage à adopter, en toutes circonstances, un comportement "
      + "professionnel, respectueux, courtois et bienveillant envers le client final, ses "
      + "proches, les occupants du logement et toute personne présente sur les lieux.\n\n"
      + "Il s'interdit tout comportement agressif, intimidant, menaçant, humiliant, "
      + "discriminatoire ou irrespectueux, ainsi que toute pression morale ou financière "
      + "exercée sur le client.\n\n"
      + "Le Sous-traitant doit faire preuve de discrétion, de patience et de compréhension, "
      + "notamment lorsque l'intervention concerne une personne vulnérable ou un logement "
      + "présentant des conditions d'insalubrité importantes.\n\n"
      + "Il s'engage à respecter la dignité, la vie privée, les biens et la situation "
      + "personnelle du client, sans porter de jugement sur son état de santé, ses "
      + "conditions de vie ou l'état de son logement.\n\n"
      + "Il doit veiller à ce que l'ensemble de son personnel adopte le même "
      + "comportement.\n\n"
      + "Toute difficulté relationnelle, réclamation ou situation conflictuelle doit être "
      + "immédiatement signalée au Donneur d'ordre.\n\n"
      + "Le Sous-traitant ne peut prendre aucun engagement commercial ou financier au nom du "
      + "Donneur d'ordre sans autorisation préalable.\n\n"
      + "Tout comportement inapproprié ou manquement grave à ces obligations pourra "
      + "entraîner la suspension de l'intervention, la résiliation du contrat dans les "
      + "conditions légales et, le cas échéant, l'engagement de la responsabilité du "
      + "Sous-traitant.",
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
      + "prestations exécutées, le volume estimatif évacué, les zones nettoyées, les "
      + "éventuelles difficultés rencontrées, les travaux non réalisés et leurs motifs, les "
      + "dommages ou incidents éventuels, les réserves éventuelles ainsi que les "
      + "photographies et justificatifs requis.\n\n"
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
      + "manutention, le conditionnement, le chargement, le transport et l'évacuation des "
      + "objets et déchets désignés, le nettoyage approfondi des zones concernées, ainsi que "
      + "la mobilisation du personnel, des véhicules, des équipements de protection, des "
      + "produits et des matériels nécessaires.\n\n"
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
//  ANNEXE 1 — BON DE MISSION (dix-neuf blocs)
// ══════════════════════════════════════════════════════════════════════
//
// Le plus détaillé des sept bons de mission. Les prestations se déclarent en
// DEUX phases distinctes, et quatre options portent chacune leurs propres
// zones concernées — c'est la conséquence directe de l'article 3-E : rien de
// tout cela n'est compris par défaut.

export const ANNEXE_BON_MISSION_INSALUBRE_COMPLET: {
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
    {
      titre: "NATURE DE L'INTERVENTION",
      lignes: ["Débarras insalubre et nettoyage approfondi."],
    },
    { titre: "SURFACE CONCERNÉE", lignes: ["{{mission_surface_m2}}"] },
    { titre: "NIVEAU D'INSALUBRITÉ DÉCLARÉ", lignes: ["{{niveau_insalubrite}}"] },
    { titre: "VOLUME ESTIMATIF À ÉVACUER", lignes: ["{{mission_volume_m3}}"] },
    { titre: "PHASE 1 – DÉBARRAS", lignes: ["{{phase1_debarras}}"] },
    { titre: "BIENS À CONSERVER", lignes: ["{{biens_a_conserver}}"] },
    { titre: "PHASE 2 – NETTOYAGE APPROFONDI", lignes: ["{{phase2_nettoyage}}"] },
    // Quatre options, quatre jeux de zones : l'article 3-E refuse de les
    // tenir pour comprises d'office.
    {
      titre: "LESSIVAGE DES MURS",
      lignes: [
        "{{lessivage_murs}}",
        "Zones concernées, si applicable : {{lessivage_zones}}",
      ],
    },
    {
      titre: "DÉSINFECTION",
      lignes: [
        "{{desinfection_prevue}}",
        "Zones concernées, si applicable : {{desinfection_zones}}",
      ],
    },
    {
      titre: "DÉSODORISATION",
      lignes: [
        "{{desodorisation_prevue}}",
        "Zones concernées, si applicable : {{desodorisation_zones}}",
      ],
    },
    {
      titre: "DÉCONTAMINATION",
      lignes: [
        "{{decontamination_prevue}}",
        "Nature et zones concernées, si applicable : {{decontamination_zones}}",
      ],
    },
    { titre: "CONTRAINTES D'ACCÈS", lignes: ["{{mission_access_conditions}}"] },
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
    + "des déchets, au volume réel, à l'état des surfaces ou à la sécurité.",
    "Les opérations doivent respecter le périmètre convenu et les obligations "
    + "réglementaires applicables.",
    "Aucune prestation supplémentaire ne peut être facturée sans accord préalable du "
    + "Donneur d'ordre.",
  ],
};

// ══════════════════════════════════════════════════════════════════════
//  ANNEXE 2 — RAPPORT DE FIN D'INTERVENTION (QUATORZE rubriques)
// ══════════════════════════════════════════════════════════════════════
//
// Le plus détaillé des sept. Il suit la chronologie du chantier : débarras
// (1-4), puis nettoyage (5-7), puis traitements (8). Et il réclame QUATRE
// jeux de photographies au lieu de trois — « après débarras » et « après
// nettoyage » séparément, ce qui est la seule façon de prouver que la
// deuxième phase a bien eu lieu sur un terrain déjà vidé.

export const ANNEXE_RAPPORT_INSALUBRE_COMPLET: {
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
    { cle: "debarras_realise", numero: 1, titre: "PRESTATIONS DE DÉBARRAS RÉALISÉES", origine: "declare", saisie: "texte_long" },
    { cle: "volume_evacue", numero: 2, titre: "Volume et nature des éléments évacués — volume estimé", origine: "declare", saisie: "texte" },
    { cle: "nature_evacuee", numero: 2, titre: "Volume et nature des éléments évacués — nature des objets et déchets", origine: "declare", saisie: "texte_long" },
    { cle: "biens_conserves", numero: 3, titre: "BIENS CONSERVÉS OU SIGNALÉS", origine: "declare", saisie: "texte_long" },
    { cle: "dechets_filiere", numero: 4, titre: "Traçabilité des déchets — lieu de dépôt ou filière de traitement", origine: "declare", saisie: "texte" },
    { cle: "dechets_justificatifs", numero: 4, titre: "Traçabilité des déchets — justificatifs, lorsque requis", origine: "declare", saisie: "texte_long" },
    { cle: "nettoyage_realise", numero: 5, titre: "PRESTATIONS DE NETTOYAGE APPROFONDI RÉALISÉES", origine: "declare", saisie: "texte_long" },
    { cle: "zones_nettoyees", numero: 6, titre: "ZONES ET SURFACES NETTOYÉES", origine: "declare", saisie: "texte_long" },
    { cle: "lessivage_realise", numero: 7, titre: "Lessivage des murs — réalisé", origine: "declare", saisie: "oui_non_non_prevu" },
    { cle: "lessivage_zones_traitees", numero: 7, titre: "Lessivage des murs — zones traitées", origine: "declare", saisie: "texte_long" },
    { cle: "traitements_realises", numero: 8, titre: "Désinfection, désodorisation et décontamination — prestations réalisées", origine: "declare", saisie: "texte_long" },
    { cle: "traitements_produits", numero: 8, titre: "Désinfection, désodorisation et décontamination — produits et procédés employés", origine: "declare", saisie: "texte_long" },
    { cle: "difficultes", numero: 9, titre: "DIFFICULTÉS RENCONTRÉES", origine: "declare", saisie: "texte_long" },
    { cle: "non_realisees", numero: 10, titre: "PRESTATIONS NON RÉALISÉES OU RÉSERVES", origine: "declare", saisie: "texte_long" },
    { cle: "incidents", numero: 11, titre: "INCIDENTS OU DÉGRADATIONS ÉVENTUELS", origine: "declare", saisie: "texte_long" },
    { cle: "relation_client", numero: 12, titre: "RELATION AVEC LE CLIENT — difficultés relationnelles ou réclamations éventuelles", origine: "declare", saisie: "texte_long" },
    // Quatre jeux, pas trois : la phase 2 doit se prouver séparément.
    { cle: "photos_avant", numero: 13, titre: "Photographies avant intervention", origine: "declare", saisie: "oui_non" },
    { cle: "photos_apres_debarras", numero: 13, titre: "Photographies après débarras", origine: "declare", saisie: "oui_non" },
    { cle: "photos_apres_nettoyage", numero: 13, titre: "Photographies après nettoyage", origine: "declare", saisie: "oui_non" },
    { cle: "photos_transmises", numero: 13, titre: "Photographies transmises au Donneur d'ordre", origine: "declare", saisie: "oui_non" },
    { cle: "observations", numero: 14, titre: "OBSERVATIONS FINALES", origine: "declare", saisie: "texte_long" },
  ],
};
