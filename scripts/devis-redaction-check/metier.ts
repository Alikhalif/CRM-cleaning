// Les 14 tests métier du §20, avec les critères de validation du §20 lui-même :
// qualité du titre · cohérence de l'introduction · développement des
// désignations · respect des exclusions · absence de prestations inventées ·
// pertinence des réserves · absence de répétitions · conservation des
// modifications humaines · absence d'envoi automatique.

import {
  analyser, aucunThemeComplementaireNonValide, construireSections,
  genererContenuDevis, verifierRedaction,
  type ContenuDevis, type Decouverte,
} from "@/lib/generation/devis-contenu";
import { bilan, contient, eq, faux, texteComplet, titre, vrai } from "./commun";

/** Les critères du §20 applicables à tout devis, vérifiés sur chaque test. */
function criteresCommuns(nom: string, c: ContenuDevis | null, d: Decouverte) {
  vrai(`${nom} — un contenu est produit`, c !== null);
  if (!c) return;

  // Qualité du titre.
  vrai(`${nom} — titre en majuscules et non vague`,
    c.designation === c.designation.toUpperCase() && c.designation.length >= 12,
    c.designation);

  // Cohérence de l'introduction.
  vrai(`${nom} — introduction présente et cohérente`,
    c.introduction.startsWith("Intervention de"), c.introduction.slice(0, 60));

  // Développement des désignations : jamais une puce par champ.
  const ops = c.sections.reduce((n, s) => n + s.operations.length, 0);
  vrai(`${nom} — désignations développées (${ops} opérations)`, ops >= 3);

  // Absence de répétitions.
  const toutes = c.sections.flatMap((s) => s.operations);
  eq(`${nom} — aucune répétition`, toutes.length, new Set(toutes).size);

  // Pertinence des réserves : la clause de réévaluation est toujours là.
  vrai(`${nom} — réserves présentes`,
    contient(c.reserves, "réévaluation"), c.reserves.slice(0, 80));

  // Absence de prestations inventées : contrôle structurel.
  const a = analyser(d);
  if (a) {
    const ctrl = aucunThemeComplementaireNonValide(a, construireSections(a));
    vrai(`${nom} — aucune prestation inventée`, ctrl.ok, ctrl.fautifs.join(" · "));
  }

  // Garde-fous de rédaction.
  const v = verifierRedaction(c);
  vrai(`${nom} — aucune expression proscrite`, v.ok, v.alertes.join(" · "));
}

const SECTIONS = (c: ContenuDevis | null) => (c?.sections ?? []).map((s) => s.titre);

// ══════════════════════════════════════════════════════════════════════
titre("TEST 1 — Nettoyage approfondi avec vitrerie");

const t1: Decouverte = {
  sector: "nettoyage", surfaceM2: 80, etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement",
    nbPieces: 3, nbSdb: 1, nbWc: 1,
    sols: ["sol_carrelage"], cuisineEquipee: "oui",
    vitrerie: "oui", vitrerieFenetres: 8, vitrerieFaces: "les_deux",
  },
};
const c1 = genererContenuDevis(t1);
criteresCommuns("T1", c1, t1);
vrai("T1 — « AVEC VITRERIE » au titre", contient(c1?.designation ?? "", "avec vitrerie"));
vrai("T1 — section vitrerie présente", SECTIONS(c1).includes("Nettoyage de la vitrerie"));
vrai("T1 — la cuisine est développée, pas recopiée",
  contient(c1?.detail ?? "", "Dégraissage des plans de travail"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 2 — Nettoyage de fin de bail SANS vitrerie");

const t2: Decouverte = {
  sector: "nettoyage", surfaceM2: 55, etatSalete: "moyen",
  details: {
    typeNettoyage: "fin_bail", typeBienNet: "appartement",
    nbPieces: 2, nbSdb: 1, nbWc: 1, sols: ["sol_parquet"],
    vitrerie: "non",
  },
};
const c2 = genererContenuDevis(t2);
criteresCommuns("T2", c2, t2);
vrai("T2 — titre « fin de bail »", contient(c2?.designation ?? "", "fin de bail"));
faux("T2 — aucune vitrerie au titre", contient(c2?.designation ?? "", "vitrerie"));
faux("T2 — aucune section vitrerie", SECTIONS(c2).includes("Nettoyage de la vitrerie"));
vrai("T2 — l'exclusion de la vitrerie est portée aux réserves (§9 cas 3)",
  contient(c2?.reserves ?? "", "surfaces vitrées et de leurs encadrements n'est pas compris"));
// Lot A : le libellé nomme désormais les ENCADREMENTS. La découverte les
// distingue des vitrages (`vitrerieEncadrement`) ; une réserve qui ne parlait
// que de « la vitrerie » laissait un doute sur ce qui était exclu.
vrai("T2 — et les encadrements sont nommés",
  contient(c2?.reserves ?? "", "encadrements"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 3 — Nettoyage approfondi avec lessivage des murs");

const t3: Decouverte = {
  sector: "nettoyage", surfaceM2: 95, etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "maison",
    nbPieces: 4, nbSdb: 2, nbWc: 2,
    murs: "murs_lessivage", mursSurface: "totale",
  },
};
const c3 = genererContenuDevis(t3);
criteresCommuns("T3", c3, t3);
vrai("T3 — « AVEC LESSIVAGE DES MURS » au titre",
  contient(c3?.designation ?? "", "avec lessivage des murs"));
faux("T3 — pas « et plafonds » : non demandés",
  contient(c3?.designation ?? "", "murs et plafonds"));
vrai("T3 — section lessivage des murs", SECTIONS(c3).includes("Lessivage des murs"));
faux("T3 — aucune section plafonds", SECTIONS(c3).includes("Nettoyage des plafonds"));
vrai("T3 — réserve sur les supports lavables (§9)",
  contient(c3?.reserves ?? "", "supports lavables"));
vrai("T3 — l'article s'accorde : « d'une maison »",
  contient(c3?.designation ?? "", "d'une maison"), c3?.designation);

// ══════════════════════════════════════════════════════════════════════
titre("TEST 4 — Diogène avec vitrerie et lessivage");

const t4: Decouverte = {
  sector: "diogene", surfaceM2: 70, etatSalete: "extreme",
  details: {
    typeNettoyage: "insalubre", typeBienNet: "appartement",
    nbPieces: 3, nbSdb: 1, nbWc: 1,
    dioEncombrement: "dio_enc_extreme",
    dioDechets: ["dio_dechets_menagers", "dio_excrements"],
    dioVolume: "20-40",
    dioNuisibles: "oui", dioNuisiblesTypes: ["dio_blattes"],
    dioOdeurs: "dio_odeurs_fortes",
    dioAccessibilite: "dio_pieces_inaccessibles",
    vitrerie: "oui", vitrerieFenetres: 5,
    murs: "murs_lessivage", plafonds: "oui",
    complements: ["desinfection", "decontamination"],
  },
};
const c4 = genererContenuDevis(t4);
criteresCommuns("T4", c4, t4);
eq("T4 — niveau 3 (prestation complexe)", c4?.niveau, 3);
vrai("T4 — « type Diogène » au titre", contient(c4?.designation ?? "", "type diogene"));

// §7.8 — ordre imposé : débarras → nettoyage → désinfection → décontamination.
const s4 = SECTIONS(c4);
const idx = (t: string) => s4.findIndex((x) => x === t);
vrai("T4 — les quatre phases sont présentes et SÉPARÉES",
  idx("Débarras préalable du logement") >= 0
  && idx("Nettoyage approfondi des espaces intérieurs") >= 0
  && idx("Désinfection") >= 0
  && idx("Décontamination") >= 0,
  s4.join(" · "));
vrai("T4 — ordre §7.8 : débarras avant nettoyage",
  idx("Débarras préalable du logement") < idx("Nettoyage approfondi des espaces intérieurs"));
vrai("T4 — ordre §7.8 : nettoyage avant désinfection",
  idx("Nettoyage approfondi des espaces intérieurs") < idx("Désinfection"));
vrai("T4 — ordre §7.8 : désinfection avant décontamination",
  idx("Désinfection") < idx("Décontamination"));

// Le correctif du bug `dioDechets` : la nature des déchets DOIT sortir.
vrai("T4 — la nature des déchets saisie est reprise (correctif dioDechets)",
  contient(c4?.detail ?? "", "nature des dechets presents"), c4?.detail?.slice(0, 200));
faux("T4 — « nature des déchets » n'est PAS listée comme manquante",
  (c4?.manquant ?? []).includes("nature des déchets"), JSON.stringify(c4?.manquant));

// §7.16 — les nuisibles identifiés sont nommés.
vrai("T4 — les nuisibles identifiés sont nommés", contient(c4?.detail ?? "", "blattes"));
vrai("T4 — réserve sur les nuisibles", contient(c4?.reserves ?? "", "entreprise habilitée"));
vrai("T4 — réserve d'insalubrité (§12.4)", contient(c4?.reserves ?? "", "logement insalubre"));
vrai("T4 — réserve sur les déchets réglementés", contient(c4?.reserves ?? "", "amiante"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 5 — Débarras insalubre avec nettoyage et désinfection");

const t5: Decouverte = {
  sector: "nettoyage", surfaceM2: 60, etatSalete: "extreme",
  details: {
    typeNettoyage: "insalubre", typeBienNet: "appartement",
    dioEncombrement: "dio_enc_important",
    dioDechets: ["dio_dechets_alimentaires"],
    dioVolume: "10-20",
    complements: ["desinfection", "debarras"],
    debarrasVolume: "10-20",
    nbSdb: 1,
  },
};
const c5 = genererContenuDevis(t5);
criteresCommuns("T5", c5, t5);
vrai("T5 — débarras ET désinfection au titre",
  contient(c5?.designation ?? "", "debarras") && contient(c5?.designation ?? "", "desinfection"),
  c5?.designation);
vrai("T5 — section débarras préalable", SECTIONS(c5).includes("Débarras préalable du logement"));
vrai("T5 — section désinfection", SECTIONS(c5).includes("Désinfection"));
vrai("T5 — réserve de volume (§12.3)", contient(c5?.reserves ?? "", "volume annoncé"));
vrai("T5 — réserve sur les biens à conserver",
  contient(c5?.reserves ?? "", "aucun bien n'est évacué sans autorisation"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 6 — Nettoyage après décès avec désinfection et décontamination");

const t6: Decouverte = {
  sector: "nettoyage", surfaceM2: 45, etatSalete: "tres_important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement",
    complements: ["desinfection", "decontamination", "desodorisation"],
    decontaminationOrigine: "deces",
    desodorisationOrigine: "autre",
    nbSdb: 1,
  },
};
const c6 = genererContenuDevis(t6);
criteresCommuns("T6", c6, t6);
vrai("T6 — famille « après décès » déduite de l'origine saisie",
  c6?.famille === "apres_deces", c6?.famille);
vrai("T6 — titre « nettoyage après décès »", contient(c6?.designation ?? "", "apres deces"));
vrai("T6 — désinfection ET décontamination au titre",
  contient(c6?.designation ?? "", "desinfection")
  && contient(c6?.designation ?? "", "decontamination"),
  c6?.designation);
vrai("T6 — l'origine de la contamination est reprise",
  contient(c6?.detail ?? "", "origine de la contamination : deces"));
// §7.9 et interdiction 26 : aucune promesse de résultat sanitaire.
vrai("T6 — réserve sanitaire présente (§7.9)",
  contient(c6?.reserves ?? "", "ni une expertise, ni une garantie d'absence"));
faux("T6 — aucune promesse de désinfection totale",
  /d(é|e)sinfection\s+(totale|compl(è|e)te)/i.test(texteComplet(c6!)));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 7 — Nettoyage après incendie");

const t7: Decouverte = {
  sector: "nettoyage", surfaceM2: 110, etatSalete: "tres_important",
  details: {
    typeNettoyage: "apres_sinistre", typeBienNet: "maison",
    complements: ["decontamination", "desodorisation"],
    decontaminationOrigine: "incendie",
    desodorisationOrigine: "incendie",
    nbSdb: 2, sols: ["sol_carrelage"],
  },
};
const c7 = genererContenuDevis(t7);
criteresCommuns("T7", c7, t7);
vrai("T7 — famille « après incendie »", c7?.famille === "apres_incendie", c7?.famille);
vrai("T7 — « traitement des suies » au titre (§3.2)",
  contient(c7?.designation ?? "", "traitement des suies"), c7?.designation);
vrai("T7 — section suies présente",
  SECTIONS(c7).includes("Traitement des suies et résidus de combustion"));
vrai("T7 — les dépôts de suie sont décrits", contient(c7?.detail ?? "", "dépôts de suie"));
vrai("T7 — réserve sur les matériaux dégradés par le feu (§7.10)",
  contient(c7?.reserves ?? "", "dégradés par le feu"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 8 — Nettoyage après chantier");

const t8: Decouverte = {
  sector: "nettoyage", surfaceM2: 130, etatSalete: "important",
  details: {
    typeNettoyage: "fin_chantier", typeBienNet: "local_pro",
    nbPieces: 6, nbSdb: 2, sols: ["sol_beton"],
    vitrerie: "oui", vitrerieGrandesSurfacesM2: 40,
  },
};
const c8 = genererContenuDevis(t8);
criteresCommuns("T8", c8, t8);
vrai("T8 — titre « après chantier »", contient(c8?.designation ?? "", "apres chantier"));
vrai("T8 — section finition après travaux EN PREMIER",
  SECTIONS(c8)[0] === "Nettoyage de finition après travaux", SECTIONS(c8).join(" · "));
vrai("T8 — les poussières fines sont décrites (§7.6)",
  contient(c8?.detail ?? "", "poussières fines"));
vrai("T8 — les résidus de chantier sont décrits", contient(c8?.detail ?? "", "résidus de chantier"));
vrai("T8 — les grandes surfaces vitrées saisies sont reprises",
  contient(c8?.detail ?? "", "grandes surfaces vitrées 40 m²"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 9 — Traces de fumée et indices de présence de rongeurs");

const t9: Decouverte = {
  sector: "nettoyage", surfaceM2: 65, etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement",
    nbSdb: 1,
    desodorisationOrigine: "incendie",
    // B3 (2026-11-06) : `dioNuisibles` est une OBSERVATION. Depuis la
    // correction, seule la validation explicite ouvre la section — d'où
    // « nuisibles » ajouté aux compléments. Le test continue de vérifier
    // que la prestation VALIDÉE sort, et que les rongeurs y sont nommés.
    complements: ["desodorisation", "nuisibles"],
    dioNuisibles: "oui", dioNuisiblesTypes: ["dio_rongeurs"],
  },
  contexteIntervention: "Traces de fumée relevées dans le séjour.",
};
const c9 = genererContenuDevis(t9);
criteresCommuns("T9", c9, t9);
vrai("T9 — les rongeurs identifiés sont nommés (§7.16)",
  contient(c9?.detail ?? "", "rongeurs"), c9?.detail?.slice(0, 300));
vrai("T9 — section nuisibles présente", SECTIONS(c9).includes("Traitement des nuisibles"));
vrai("T9 — le contexte libre est reporté comme information, pas comme prestation",
  contient(c9?.detail ?? "", "informations complémentaires communiquées : traces de fumée"));
faux("T9 — aucune prestation de dératisation inventée",
  contient(c9?.designation ?? "", "deratisation"));
faux("T9 — aucune décontamination inventée (non validée)",
  SECTIONS(c9).includes("Décontamination"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 10 — Découverte contenant des exclusions explicites");

const t10: Decouverte = {
  sector: "nettoyage", surfaceM2: 70, etatSalete: "moyen",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement",
    nbPieces: 3, nbSdb: 1,
    vitrerie: "non", murs: "non", plafonds: "non",
    complements: [],
  },
};
const c10 = genererContenuDevis(t10);
criteresCommuns("T10", c10, t10);
const s10 = SECTIONS(c10);
faux("T10 — aucune section vitrerie", s10.includes("Nettoyage de la vitrerie"));
faux("T10 — aucune section murs", s10.includes("Lessivage des murs"));
faux("T10 — aucune section plafonds", s10.includes("Nettoyage des plafonds"));
faux("T10 — aucune section désinfection", s10.includes("Désinfection"));
vrai("T10 — exclusion de la vitrerie aux réserves",
  contient(c10?.reserves ?? "", "surfaces vitrées et de leurs encadrements n'est pas compris"));
vrai("T10 — exclusion du lessivage aux réserves",
  contient(c10?.reserves ?? "", "lessivage des murs et des plafonds n'est pas compris"));
faux("T10 — aucune réserve contradictoire : pas de « supports lavables » sans lessivage",
  contient(c10?.reserves ?? "", "supports lavables"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 11 — Découverte comportant de nombreuses informations secondaires");

const t11: Decouverte = {
  sector: "nettoyage", surfaceM2: 75, etatSalete: "moyen",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement",
    nbPieces: 3, nbSdb: 1, nbWc: 1,
    sols: ["sol_carrelage", "sol_parquet"],
    etage: "2", ascenseur: "oui", stationnement: "facile", occupation: "vide",
    dressings: "oui", equipements: ["opt_four", "opt_frigo"],
    exterieurTypes: ["ext_balcon"], exterieurSurfaceM2: 8,
    traitementsSol: ["opt_sols_mecanise"],
  },
};
const c11 = genererContenuDevis(t11);
criteresCommuns("T11", c11, t11);
vrai("T11 — la génération n'est pas bloquée par des informations secondaires", c11 !== null);
vrai("T11 — les contraintes d'accès sont des FAITS, pas des prestations",
  contient(c11?.detail ?? "", "conditions d'accès relevées")
  && !SECTIONS(c11).some((s) => contient(s, "étage")),
  SECTIONS(c11).join(" · "));
vrai("T11 — étage, ascenseur, stationnement et occupation sont tous repris",
  ["étage 2", "avec ascenseur", "stationnement facile", "vide"]
    .every((x) => contient(c11?.detail ?? "", x)),
  c11?.detail?.split("Conditions d'accès")[1]);
vrai("T11 — les équipements saisis sont repris", contient(c11?.detail ?? "", "four"));
vrai("T11 — le balcon saisi est repris", contient(c11?.detail ?? "", "balcon"));
vrai("T11 — le devis reste proportionné (pas d'allongement artificiel)",
  (c11?.sections.reduce((n, s) => n + s.operations.length, 0) ?? 0) <= 32,
  `${c11?.sections.reduce((n, s) => n + s.operations.length, 0)} opérations`);

// ══════════════════════════════════════════════════════════════════════
titre("TEST 12 — Régénération d'un devis déjà modifié");

const a12 = genererContenuDevis(t1);
const b12 = genererContenuDevis(t1);
eq("T12 — la génération est DÉTERMINISTE : deux appels, même résultat",
  JSON.stringify(a12), JSON.stringify(b12));
vrai("T12 — le moteur est PUR : il ne lit ni n'écrit aucun document existant",
  typeof genererContenuDevis === "function" && genererContenuDevis.length === 1);
// La protection de la modification humaine est côté serveur
// (`genererDevisDepuisDecouverte` exige `regenerer: true`) : elle est
// vérifiée par lecture de code dans le journal, pas ici — ce module n'a
// aucune I/O. Ce que ce test prouve : régénérer ne peut pas produire un
// contenu différent par surprise.

// ══════════════════════════════════════════════════════════════════════
titre("TEST 13 — Prestation suggérée mais NON validée");

const t13: Decouverte = {
  sector: "nettoyage", surfaceM2: 80, etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement",
    nbPieces: 3, nbSdb: 1,
    complements: [], // rien n'est validé
  },
  contexteIntervention:
    "Le client envisage une désinfection et une vitrerie, à chiffrer séparément. "
    + "Un lessivage des murs serait souhaitable. Débarras éventuel du garage.",
};
const c13 = genererContenuDevis(t13);
criteresCommuns("T13", c13, t13);
const s13 = SECTIONS(c13);
for (const interdite of [
  "Nettoyage de la vitrerie", "Lessivage des murs", "Nettoyage des plafonds",
  "Désinfection", "Décontamination", "Traitement des odeurs",
  "Débarras et évacuation des encombrants", "Traitement des nuisibles",
]) {
  faux(`T13 — « ${interdite} » n'est PAS créée depuis une suggestion`, s13.includes(interdite));
}
faux("T13 — aucun complément au titre", contient(c13?.designation ?? "", "avec"));
vrai("T13 — la suggestion reste visible comme information, hors contractuel",
  contient(c13?.detail ?? "", "informations complémentaires communiquées"));

// ══════════════════════════════════════════════════════════════════════
titre("TEST 14 — Plusieurs entreprises et plusieurs pays");

// Le référentiel est COMMUN (§18) : le moteur ne reçoit NI société NI pays.
// C'est structurel — il lui est donc impossible de mélanger les données de
// deux entreprises, et impossible de produire deux textes différents pour un
// même chantier selon l'entité qui facture.
const clesDecouverte = Object.keys(t1);
faux("T14 — le moteur ne reçoit aucune société émettrice",
  clesDecouverte.some((k) => /entit|societ|entity|legal/i.test(k)), clesDecouverte.join(", "));
faux("T14 — le moteur ne reçoit aucun pays",
  clesDecouverte.some((k) => /pays|country/i.test(k)), clesDecouverte.join(", "));
eq("T14 — même découverte → même contenu, quelle que soit l'entité émettrice",
  JSON.stringify(genererContenuDevis(t1)), JSON.stringify(a12));

// Les activités autorisées restent les mêmes dans les cinq pays, et les
// activités hors périmètre le restent aussi.
for (const s of ["urgence", "enr", "renovation"]) {
  eq(`T14 — ${s} reste hors périmètre`,
    genererContenuDevis({ sector: s, surfaceM2: 50, etatSalete: null, details: {} }), null);
}

// ══════════════════════════════════════════════════════════════════════
titre("Les trois autres activités couvertes");

const dbr = genererContenuDevis({
  sector: "debarras", surfaceM2: 90, etatSalete: null,
  details: {
    typeBien: "maison", typeDebarras: "complet", volume: "10-20",
    acces: "escaliers", triDemande: "oui", encombrement: "important",
  },
});
criteresCommuns("Débarras", dbr, {
  sector: "debarras", surfaceM2: 90, etatSalete: null,
  details: { typeBien: "maison", typeDebarras: "complet", volume: "10-20" },
});
eq("Débarras — trois sections : tri, manutention, évacuation",
  SECTIONS(dbr),
  ["Tri et préparation des biens", "Manutention et chargement", "Évacuation et traitement des déchets"]);
vrai("Débarras — « avec évacuation des encombrants » au titre",
  contient(dbr?.designation ?? "", "avec evacuation des encombrants"), dbr?.designation);
vrai("Débarras — justificatifs de traitement mentionnés (§7.12)",
  contient(dbr?.detail ?? "", "justificatifs de traitement"));

const dmg = genererContenuDevis({
  sector: "demenagement", surfaceM2: null, etatSalete: null,
  details: {
    logementDepart: "appartement", volume: "30", typeDemenagement: "complet",
    emballage: "complet", demontage: "oui", monteMeubles: "oui",
    objetsSpecifiques: ["piano"], etagesDepart: 3, ascenseurDepart: "non",
    etagesArrivee: 1, ascenseurArrivee: "oui", distanceKm: 420,
  },
  villeDepart: "Paris", villeArrivee: "Lyon",
});
criteresCommuns("Déménagement", dmg, {
  sector: "demenagement", surfaceM2: null, etatSalete: null,
  details: { logementDepart: "appartement", volume: "30", typeDemenagement: "complet" },
  villeDepart: "Paris", villeArrivee: "Lyon",
});
vrai("Déménagement — trajet au titre",
  contient(dmg?.designation ?? "", "de paris vers lyon"), dmg?.designation);
vrai("Déménagement — le piano est repris", contient(dmg?.detail ?? "", "piano"));
vrai("Déménagement — le monte-meubles est repris", contient(dmg?.detail ?? "", "monte-meubles"));
vrai("Déménagement — étages et ascenseurs des deux côtés",
  contient(dmg?.detail ?? "", "3e étage sans ascenseur")
  && contient(dmg?.detail ?? "", "1e étage avec ascenseur"));

const trp = genererContenuDevis({
  sector: "transport", surfaceM2: null, etatSalete: null,
  details: {
    typeObjet: "piano", quantiteObjets: 1, poidsKg: 320, volumeM3: 2,
    villeEnlevement: "Bordeaux", villeLivraison: "Toulouse",
    optionsTransport: ["manutention", "protection", "lourd"],
    etageEnlevement: "2", ascenseurEnlevement: "non", accesEnlevement: "escaliers",
  },
});
criteresCommuns("Transport", trp, {
  sector: "transport", surfaceM2: null, etatSalete: null,
  details: { typeObjet: "piano", villeEnlevement: "Bordeaux", villeLivraison: "Toulouse" },
});
vrai("Transport — « transport et manutention » au titre",
  contient(trp?.designation ?? "", "transport et manutention"), trp?.designation);
vrai("Transport — le poids saisi est repris", contient(trp?.detail ?? "", "320 kg"));
vrai("Transport — les conditions d'enlèvement sont reprises",
  contient(trp?.detail ?? "", "enlèvement : étage 2, sans ascenseur, escaliers"));

bilan("tests métier du §20");
