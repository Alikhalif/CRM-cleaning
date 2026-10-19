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
export const TYPE_NETTOYAGE: Option[] = opt([
  ["classique", "Classique"],
  ["approfondi", "Approfondi"],
  ["remise_etat", "Remise en état"],
  ["fin_chantier", "Fin de chantier"],
  ["fin_bail", "Fin de bail"],
  ["apres_sinistre", "Après sinistre"],
  ["insalubre", "Insalubre"],
  ["autre", "Autre"],
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

export const VITRERIE_ACCES: Option[] = opt([
  ["normale", "Normale"],
  ["vitrerie_acces_difficile", "Difficile"],
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
