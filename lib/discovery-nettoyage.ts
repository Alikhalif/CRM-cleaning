// Découverte commerciale NETTOYAGE — jeux d'options. PUR (aucune I/O).
//
// Les VALEURS stockées ici sont aussi les clés attendues par la grille
// tarifaire : une option cochée dans la découverte porte le même identifiant
// que la ligne que le Super Admin configure. C'est ce qui évite une table de
// correspondance supplémentaire — et donc une dérive silencieuse entre les
// deux. Les libellés sont ceux dictés par le client, mot pour mot.
//
// L'ordre des blocs suit le déroulé d'un appel téléphonique, pas une logique
// de base de données : type de prestation → logement → intérieur → extérieur →
// options → accès → Diogène.

import type { Option } from "./discovery-metier";

const opt = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

/** Activités qui utilisent ce questionnaire. ENR et Rénovation en sont
 *  exclues : poser des panneaux n'a rien à voir avec nettoyer un logement. */
export const FAMILLE_NETTOYAGE = ["nettoyage", "nettoyage_difficile", "diogene", "urgence"];

export const estFamilleNettoyage = (sector: string): boolean => FAMILLE_NETTOYAGE.includes(sector);

// ── Bloc 1 — Type de nettoyage ─────────────────────────────────────────
// Les valeurs correspondent une à une aux clés `type_*` du barème. Ajouter
// une prestation ici sans tarif correspondant la rendrait silencieusement
// incalculable — et inversement.
export const TYPE_NETTOYAGE: Option[] = opt([
  ["classique", "Classique"],
  ["approfondi", "Approfondi"],
  ["fin_bail", "Fin de bail"],
  ["fin_bail_approfondi", "Fin de bail approfondi"],
  ["avant_emmenagement", "Avant emménagement"],
  ["avant_vente", "Avant vente"],
  ["apres_demenagement", "Après déménagement"],
  ["fin_chantier_leger", "Fin de chantier léger"],
  ["fin_chantier", "Fin de chantier"],
  ["fin_chantier_difficile", "Fin de chantier difficile"],
  ["apres_renovation", "Après rénovation lourde"],
  ["remise_etat", "Remise en état"],
  ["tres_sale", "Logement très sale"],
  ["insalubre", "Insalubre"],
  ["apres_squat", "Après squat"],
  ["apres_sinistre", "Après sinistre"],
  ["autre", "Autre"],
]);

// Équipements facturés à l'unité, au forfait. Clés identiques au barème.
export const EQUIPEMENTS: Option[] = opt([
  ["opt_four", "Four"],
  ["opt_frigo", "Réfrigérateur"],
  ["opt_congelateur", "Congélateur"],
  ["opt_hotte", "Hotte"],
  ["opt_degraissage_cuisine", "Dégraissage renforcé cuisine"],
  ["opt_detartrage_sdb", "Détartrage salle de bain"],
  ["opt_wc_encrasses", "WC fortement encrassés"],
]);

// Traitements de sol facturés au m². Clés identiques au barème.
export const TRAITEMENTS_SOL: Option[] = opt([
  ["opt_sols_mecanise", "Nettoyage mécanisé"],
  ["opt_decapage_sols", "Décapage"],
]);

// ── Bloc 2 — Caractéristiques du logement ──────────────────────────────
export const TYPE_BIEN_NETTOYAGE: Option[] = opt([
  ["studio", "Studio"],
  ["appartement", "Appartement"],
  ["maison", "Maison"],
  ["local_pro", "Local professionnel"],
  ["autre", "Autre"],
]);

// L'état général réutilise l'ENUM `etat_salete` déjà en base (leger → extreme) :
// on ne crée pas un second vocabulaire pour la même réalité. Seuls les
// libellés changent, parce que le client les veut plus parlants au téléphone.
export const ETAT_GENERAL: Option[] = opt([
  ["leger", "Léger"],
  ["moyen", "Moyen"],
  ["important", "Sale"],
  ["tres_important", "Très sale"],
  ["extreme", "Insalubre"],
]);

export const OCCUPATION: Option[] = opt([
  ["vide", "Vide"],
  ["meuble", "Meublé"],
  ["occupe", "Occupé"],
  ["encombre", "Encombré"],
]);

// ── Bloc 3 — Éléments intérieurs ───────────────────────────────────────
export const VITRERIE_QUANTITE: Option[] = opt([
  ["vitrerie_peu", "Peu"],
  ["vitrerie_standard", "Standard"],
  ["vitrerie_beaucoup", "Beaucoup"],
]);

// Accessibilité des vitrages — cinq niveaux (cahier du 2026-11-02).
//
// ⚠️ Les valeurs `normale` et `vitrerie_acces_difficile` sont CONSERVÉES à
// l'identique : elles sont déjà enregistrées dans des découvertes et portent
// les deux seuls coefficients validés (1,00 et 1,15). Les trois nouvelles
// attendent leur coefficient — elles n'ont donc aucun effet tarifaire pour
// l'instant, et le CRM le dit au commercial plutôt que de deviner un prix.
export const VITRERIE_ACCES: Option[] = opt([
  ["normale", "Facilement accessibles"],
  ["vitrerie_acces_difficile", "En hauteur"],
  ["vitrerie_acces_escabeau", "Escabeau nécessaire"],
  ["vitrerie_acces_echelle", "Échelle nécessaire"],
  ["vitrerie_acces_particulier", "Accès difficile ou particulier"],
]);

// Faces à nettoyer. Une seule réponse — le nettoyage des deux faces coûte
// nécessairement plus cher qu'une seule (cahier du 2026-10-21, §4).
export const VITRERIE_FACES: Option[] = opt([
  ["interieur", "Intérieur"],
  ["exterieur", "Extérieur"],
  ["les_deux", "Intérieur + Extérieur"],
]);

// Matériau des encadrements. Le bois demande plus de soin, d'où sa
// majoration ; le nettoyage des encadrements accessibles est compris (§5).
export const VITRERIE_ENCADREMENT: Option[] = opt([
  ["pvc", "PVC"],
  ["bois", "Bois"],
  ["alu", "Aluminium"],
  ["mixte", "Mixte"],
  ["nr", "Autre / non renseigné"],
]);

export const SOLS: Option[] = opt([
  ["sol_carrelage", "Carrelage"],
  ["sol_parquet", "Parquet"],
  ["sol_pvc", "PVC / Vinyle"],
  ["sol_moquette", "Moquette"],
  ["sol_beton", "Béton"],
  ["sol_autre", "Autre"],
]);

export const MURS: Option[] = opt([
  ["non", "Non"],
  ["murs_traces", "Traces localisées"],
  ["murs_lessivage", "Lessivage complet"],
]);

export const SURFACE_CONCERNEE: Option[] = opt([
  ["totale", "Totale"],
  ["partielle", "Partielle"],
]);

export const PLAFONDS_TYPE: Option[] = opt([
  ["plafonds_depoussierage", "Dépoussiérage"],
  ["plafonds_traces", "Traces localisées"],
  ["plafonds_lessivage", "Lessivage"],
]);

export const PLAFONDS_ETAT: Option[] = opt([
  ["leger", "Léger"],
  ["moyen", "Moyen"],
  ["tres_sale", "Très sale"],
]);

export const NOMBRE_0_3: Option[] = opt([
  ["0", "0"], ["1", "1"], ["2", "2"], ["3plus", "3+"],
]);

// ── Bloc 4 — Terrasse et espaces extérieurs ────────────────────────────
export const EXTERIEUR_TYPE: Option[] = opt([
  ["ext_terrasse", "Terrasse"],
  ["ext_balcon", "Balcon"],
  ["ext_cour", "Cour"],
  ["ext_patio", "Patio"],
  ["ext_autre", "Autre"],
]);

export const EXTERIEUR_REVETEMENT: Option[] = opt([
  ["ext_rev_carrelage", "Carrelage"],
  ["ext_rev_beton", "Béton"],
  ["ext_rev_bois", "Bois"],
  ["ext_rev_pierre", "Pierre naturelle"],
  ["ext_rev_dalles", "Dalles"],
  ["ext_rev_composite", "Composite"],
  ["ext_rev_autre", "Autre"],
]);

export const EXTERIEUR_ETAT: Option[] = opt([
  ["ext_etat_leger", "Léger"],
  ["ext_etat_moyen", "Moyen"],
  ["ext_etat_encrasse", "Très encrassé"],
]);

// ── Bloc 5 — Prestations complémentaires ───────────────────────────────
export const COMPLEMENTS: Option[] = opt([
  ["desinfection", "Désinfection"],
  ["decontamination", "Décontamination"],
  ["desodorisation", "Désodorisation"],
  ["debarras", "Débarras"],
  // Ajouté le 2026-11-06 (anomalie B3). Le traitement des nuisibles n'avait
  // AUCUNE case de validation : le moteur l'ouvrait sur la seule case
  // « présence de nuisibles » de la découverte Diogène, c'est-à-dire sur une
  // observation. Le devis promettait alors une prestation que personne
  // n'avait commandée, auprès d'un client qui la lisait comme un engagement.
  ["nuisibles", "Traitement des nuisibles"],
]);

// ── Exclusions explicites (§7.4, « priorité absolue » du 2026-11-06) ────
//
// POURQUOI UNE LISTE DÉDIÉE, ET NON L'ABSENCE DE VALIDATION.
//
// Jusqu'ici, « sans désinfection » s'obtenait en ne cochant pas la case. Mais
// une omission et un refus ne sont pas la même chose : l'omission ne produit
// aucune réserve, n'est pas opposable, et ne résiste pas à une régénération où
// quelqu'un cocherait la case « pour bien faire ». Un refus explicite, lui,
// ferme le thème définitivement et se rappelle dans les réserves.
//
// Les clés sont traitées par `EXCLUSION_PAR_CLE`
// (lib/generation/prestations-validation.ts).
// ── Enrichissement de la découverte (C3, 2026-11-06) ─────────────────
//
// Quatre informations manquaient à l'audit du moteur : le moteur portait des
// opérations pour les radiateurs et les placards à son palier le plus
// développé, mais AUCUNE donnée ne pouvait les déclencher ; la nicotine et la
// suie n'existaient que comme « origine d'odeur » d'une désodorisation
// validée ; et le nombre de niveaux n'existait nulle part — « maison sur deux
// niveaux » se perdait en texte libre.
//
// Tous CONDITIONNELS : aucun de ces champs n'apparaît si la question amont
// n'est pas posée. L'écran de découverte ne doit pas s'allonger pour les
// dossiers simples.

/** Radiateurs — l'accès décide de ce qui est faisable, pas le souhait. */
export const RADIATEURS: Option[] = opt([
  ["non", "Non"],
  ["rad_accessibles", "Accessibles"],
  ["rad_derriere", "Accessibles, nettoyage derrière possible"],
  ["rad_encastres", "Encastrés ou inaccessibles"],
]);

/** Nombre de niveaux du logement. Au-delà de trois, le libellé suffit. */
export const NIVEAUX: Option[] = opt([
  ["1", "1 niveau"],
  ["2", "2 niveaux"],
  ["3", "3 niveaux"],
  ["4plus", "4 niveaux ou plus"],
]);

/**
 * État des placards et rangements.
 *
 * `dressings` disait seulement « il y en a ». Or un placard VIDE se nettoie
 * dedans ; un placard OCCUPÉ ne se vide pas sans accord, et le devis doit le
 * dire plutôt que de laisser croire le contraire.
 */
export const PLACARDS_CONTENU: Option[] = opt([
  ["placards_vides", "Vides"],
  ["placards_occupes", "Occupés"],
  ["placards_mixte", "En partie occupés"],
]);

/**
 * Traces de tabac et de nicotine — un CONSTAT d'encrassement.
 *
 * ⚠️ À ne pas confondre avec `desodorisationOrigine = "tabac"`, qui désigne
 * l'origine d'une désodorisation VALIDÉE. Ici on relève un état de surface :
 * il adapte le nettoyage prévu et il appelle une réserve, il n'ajoute aucune
 * prestation (règle B3 : une observation n'autorise rien).
 */
export const NICOTINE: Option[] = opt([
  ["non", "Non"],
  ["nicotine_legere", "Traces légères"],
  ["nicotine_marquee", "Traces marquées"],
  ["nicotine_importante", "Imprégnation importante"],
]);

/**
 * Suie et résidus de combustion — même logique de constat.
 *
 * L'origine « incendie » de la décontamination déclenche déjà la famille et
 * la section « suies ». Ce champ dit l'ÉTENDUE, que le moteur ne pouvait pas
 * deviner, et il permet de relever le niveau de détail.
 */
export const SUIE: Option[] = opt([
  ["non", "Non"],
  ["suie_localisee", "Dépôts localisés"],
  ["suie_etendue", "Dépôts étendus"],
  ["suie_generalisee", "Dépôts généralisés, fumées dans tout le volume"],
]);

/**
 * Particularités techniques du chantier.
 *
 * Structurées plutôt que laissées au texte libre : le `contexte_intervention`
 * était recopié mot pour mot dans le devis sous « Informations
 * complémentaires », ce que le cahier interdit — « le devis ne doit jamais
 * ressembler à une fiche de découverte recopiée ». Ces cases, elles, se
 * traduisent en opérations et en réserves.
 */
export const PARTICULARITES: Option[] = opt([
  ["part_hauteur", "Hauteur sous plafond importante"],
  ["part_sans_eau", "Pas d'eau courante sur place"],
  ["part_sans_electricite", "Pas d'électricité sur place"],
  ["part_sans_ascenseur", "Pas d'ascenseur"],
  ["part_acces_etroit", "Accès ou cage d'escalier étroits"],
  ["part_occupe", "Logement occupé pendant l'intervention"],
  ["part_animaux", "Présence d'animaux"],
  ["part_fragile", "Supports fragiles ou anciens"],
  ["part_amiante_suspecte", "Amiante suspectée"],
]);

export const EXCLUSIONS: Option[] = opt([
  ["excl_vitrerie", "Sans vitrerie"],
  ["excl_murs", "Sans lessivage des murs"],
  ["excl_plafonds", "Sans lessivage des plafonds"],
  ["excl_desinfection", "Sans désinfection"],
  ["excl_decontamination", "Sans décontamination"],
  ["excl_desodorisation", "Sans traitement des odeurs"],
  ["excl_nuisibles", "Sans traitement des nuisibles"],
  ["excl_debarras", "Sans débarras"],
  ["excl_debarras_prealable", "Sans débarras préalable"],
  ["excl_exterieurs", "Sans nettoyage des extérieurs"],
]);

export const DECONTAMINATION_ORIGINE: Option[] = opt([
  ["deces", "Décès"],
  ["sang", "Sang / fluides biologiques"],
  ["eaux_usees", "Eaux usées"],
  ["incendie", "Incendie"],
  ["insalubrite", "Insalubrité"],
  ["autre", "Autre"],
]);

export const DESODORISATION_ORIGINE: Option[] = opt([
  ["tabac", "Tabac"],
  ["urine", "Urine"],
  ["dechets", "Déchets"],
  ["humidite", "Humidité"],
  ["incendie", "Incendie"],
  ["autre", "Autre"],
]);

export const DEBARRAS_VOLUME: Option[] = opt([
  ["<5", "< 5 m³"],
  ["5-10", "5–10 m³"],
  ["10-20", "10–20 m³"],
  [">20", "> 20 m³"],
  ["a_evaluer", "À évaluer"],
]);

// ── Bloc 6 — Accès et date ─────────────────────────────────────────────
export const ETAGE: Option[] = opt([
  ["0", "RDC"], ["1", "1"], ["2", "2"], ["3", "3"], ["4plus", "4+"],
]);

export const STATIONNEMENT: Option[] = opt([
  ["facile", "Facile"],
  ["stationnement_difficile", "Difficile"],
]);

export const URGENCE: Option[] = opt([
  ["normale", "Normale"],
  ["urgente", "Urgente"],
]);

export const PHOTOS_ETAT: Option[] = opt([
  ["demandees", "Demandées"],
  ["recues", "Reçues"],
  ["a_recevoir", "À recevoir"],
]);

// ── Bloc 7 — Extension Diogène ─────────────────────────────────────────
export const DIO_ENCOMBREMENT: Option[] = opt([
  ["dio_enc_faible", "Faible"],
  ["dio_enc_moyen", "Moyen"],
  ["dio_enc_important", "Important"],
  ["dio_enc_extreme", "Extrême"],
]);

export const DIO_DECHETS: Option[] = opt([
  ["dio_dechets_menagers", "Déchets ménagers"],
  ["dio_dechets_alimentaires", "Déchets alimentaires"],
  ["dio_mobilier", "Mobilier / objets"],
  ["dio_excrements", "Urine / excréments"],
  ["dio_biologiques", "Déchets biologiques suspects"],
  ["dio_autres", "Autres"],
]);

export const DIO_VOLUME: Option[] = opt([
  ["<5", "< 5 m³"],
  ["5-10", "5–10 m³"],
  ["10-20", "10–20 m³"],
  ["20-40", "20–40 m³"],
  [">40", "> 40 m³"],
  ["a_evaluer", "À évaluer"],
]);

export const DIO_ACCESSIBILITE: Option[] = opt([
  ["normale", "Normale"],
  ["dio_acces_difficile", "Difficile"],
  ["dio_pieces_inaccessibles", "Pièces inaccessibles"],
]);

export const DIO_NUISIBLES: Option[] = opt([
  ["dio_blattes", "Blattes"],
  ["dio_punaises", "Punaises de lit"],
  ["dio_rongeurs", "Rongeurs"],
  ["dio_asticots", "Asticots / mouches"],
  ["dio_nuisibles_autres", "Autres"],
]);

export const DIO_ODEURS: Option[] = opt([
  ["aucune", "Aucune"],
  ["dio_odeurs_moderees", "Modérées"],
  ["dio_odeurs_fortes", "Fortes"],
  ["dio_odeurs_extremes", "Extrêmes"],
]);

// Les prestations Diogène reprennent les mêmes clés que les compléments du
// formulaire principal : cocher « Désinfection » ici et là-bas désigne la même
// prestation, et ne doit jamais être facturé deux fois.
export const DIO_PRESTATIONS: Option[] = opt([
  ["debarras", "Débarras"],
  ["nettoyage_approfondi", "Nettoyage approfondi"],
  ["desinfection", "Désinfection"],
  ["decontamination", "Décontamination"],
  ["desodorisation", "Désodorisation"],
  ["traitement_nuisibles", "Traitement des nuisibles"],
]);

/**
 * Descriptif des prestations de vitrerie, en texte.
 *
 * Reprend EXACTEMENT ce que le commercial a saisi en découverte : aucun
 * vitrage n'est supposé, aucune quantité arrondie. Renvoie `null` si la
 * vitrerie n'a pas été retenue — un devis de nettoyage sans vitres ne doit
 * pas porter une ligne vide.
 *
 * Employé par le devis ET par la fiche dossier de la planificatrice : une
 * seule rédaction, pour que les deux ne divergent pas au premier correctif.
 *
 * ⚠️ Aucun MONTANT n'est écrit ici. Le supplément vitrerie est déjà compris
 * dans le montant recommandé, calculé par le moteur tarifaire ; le rappeler
 * séparément dans le descriptif risquerait de le faire additionner deux fois.
 */
export function descriptifVitrerie(d: Record<string, unknown>): string | null {
  const str = (k: string): string =>
    typeof d[k] === "string" ? (d[k] as string) : d[k] != null ? String(d[k]) : "";
  const num = (k: string): number => {
    const n = Number(str(k));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  if (str("vitrerie") !== "oui") return null;

  const vitrages: string[] = [];
  const compte = (k: string, un: string, plusieurs: string) => {
    const n = num(k);
    if (n > 0) vitrages.push(`${n} ${n > 1 ? plusieurs : un}`);
  };
  compte("vitrerieFenetres", "fenêtre classique", "fenêtres classiques");
  compte("vitrerieBaies", "baie vitrée", "baies vitrées");
  compte("vitreriePortesFenetres", "porte-fenêtre", "portes-fenêtres");
  compte("vitrerieVelux", "Velux", "Velux");
  if (num("vitrerieVerandaM2") > 0) vitrages.push(`véranda ${num("vitrerieVerandaM2")} m² vitrés`);
  if (num("vitrerieGrandesSurfacesM2") > 0) {
    vitrages.push(`grandes surfaces vitrées ${num("vitrerieGrandesSurfacesM2")} m²`);
  }
  compte("vitrerieAutres", "autre vitrage", "autres vitrages");

  const parts: string[] = [];
  let l1 = "Nettoyage de vitrerie";
  if (vitrages.length) l1 += ` — ${vitrages.join(", ")}`;
  const faces = str("vitrerieFaces");
  if (faces) {
    l1 += ` · ${faces === "les_deux" ? "faces intérieures et extérieures"
      : faces === "exterieur" ? "face extérieure" : "face intérieure"}`;
  }
  parts.push(l1 + ".");

  const cadre = str("vitrerieEncadrement");
  if (cadre && cadre !== "nr") {
    const libelle: Record<string, string> = {
      pvc: "PVC", bois: "bois", alu: "aluminium", mixte: "mixtes",
    };
    parts.push(`Encadrements ${libelle[cadre] ?? cadre} nettoyés.`);
  }

  const options: string[] = [];
  if (str("vitrerieRails") === "oui") options.push("rails");
  if (str("vitrerieCoulisses") === "oui") options.push("coulisses");
  if (options.length) parts.push(`Nettoyage des ${options.join(" et des ")}.`);

  const acces: Record<string, string> = {
    vitrerie_acces_difficile: "vitrages en hauteur",
    vitrerie_acces_escabeau: "accès par escabeau",
    vitrerie_acces_echelle: "accès par échelle",
    vitrerie_acces_particulier: "accès difficile ou particulier",
  };
  const a = acces[str("vitrerieAcces")];
  if (a) parts.push(`Accès : ${a}.`);
  if (str("vitrerieEquipement") === "oui") {
    parts.push("Nacelle ou échafaudage nécessaire — non compris, à chiffrer séparément.");
  }

  const obs = str("vitrerieObservations").trim();
  if (obs) parts.push(`Observations : ${obs}`);

  // Un simple « oui » sans aucun vitrage compté ne décrit rien d'utile.
  return vitrages.length > 0 || options.length > 0 ? parts.join("\n") : null;
}
