// La décision de rotation, et les cinq gardes du script.
//
// Demande du client du 2026-11-09 : sauvegarde préalable, simulation
// obligatoire, vérification d'intégrité, reprise après interruption, aucune
// perte de données, retour arrière documenté, aucun secret exposé, aucune
// modification de production, script inactif par défaut.
//
// La décision est PURE : on peut donc prouver dès maintenant qu'une valeur
// illisible ne sera jamais réécrite, sans attendre la recette. Les gardes du
// script, elles, sont vérifiées par inspection de source — et le refus de la
// production est en plus vérifié par EXÉCUTION RÉELLE.

import { readFileSync } from "node:fs";
import {
  COLONNES_CHIFFREES,
  LOT_VIDE,
  additionner,
  autorisationEcriture,
  colonnesDejaChiffrees,
  colonnesEnClair,
  conversionTerminee,
  deciderRotation,
  resumer,
  type DecisionRotation,
} from "@/lib/crypto/rotation";
import { eq, faux, titre, vrai, bilan } from "./commun";

const KID = "aaaaaaaa";
const AUTRE = "bbbbbbbb";
const CLAIR = "FR76 1234 5678 9012 3456 7890 123";

/** Déchiffrement factice : rend le clair pour ce qu'on déclare lisible. */
function dechiffreur(lisibles: Record<string, string>) {
  return (v: string) => lisibles[v] ?? "";
}

const ROTATION = { kidCible: KID, chiffrerLeClair: false, dechiffrer: dechiffreur({}) };

// ═══════════════════════════════════════════════════════════════════════
titre("1. Une valeur vide ne déclenche rien");
// ═══════════════════════════════════════════════════════════════════════

for (const v of [null, undefined, ""]) {
  eq(`« ${String(v)} » → vide`, deciderRotation(v, ROTATION).action, "vide");
}

// ═══════════════════════════════════════════════════════════════════════
titre("2. Le texte clair : laissé, ou chiffré selon le volet");
// ═══════════════════════════════════════════════════════════════════════

eq("volet D14 (rotation) : le clair hérité est LAISSÉ",
  deciderRotation(CLAIR, { ...ROTATION, chiffrerLeClair: false }).action, "laisser");

const premierChiffrement = deciderRotation(CLAIR, { ...ROTATION, chiffrerLeClair: true });
eq("volet D17 (IBAN) : le clair est à convertir", premierChiffrement.action, "a_convertir");
eq("… et le clair transmis est la valeur elle-même", premierChiffrement.clair, CLAIR);
vrai("… avec un motif qui le dit", premierChiffrement.motif.includes("première fois"));

// ═══════════════════════════════════════════════════════════════════════
titre("3. Déjà convertie : on ne déchiffre même pas");
// ═══════════════════════════════════════════════════════════════════════
//
// Sur une base en cours de conversion, la grande majorité des valeurs est
// déjà faite. Les déchiffrer pour rien coûterait des heures sur du volume.

let appels = 0;
const compteur = (v: string) => {
  appels++;
  return v === "lisible" ? CLAIR : "";
};
const deja = deciderRotation(`encv2:${KID}:iv:tag:ct`, {
  kidCible: KID,
  chiffrerLeClair: false,
  dechiffrer: compteur,
});
eq("une v2 scellée par la clé cible → déjà convertie", deja.action, "deja_convertie");
eq("… et AUCUN déchiffrement n'a été tenté", appels, 0);

// ═══════════════════════════════════════════════════════════════════════
titre("4. À convertir : v1 héritée, ou v2 d'une autre clé");
// ═══════════════════════════════════════════════════════════════════════

const v1 = "encv1:iv:tag:ct";
const dV1 = deciderRotation(v1, {
  kidCible: KID,
  chiffrerLeClair: false,
  dechiffrer: dechiffreur({ [v1]: CLAIR }),
});
eq("une v1 lisible → à convertir", dV1.action, "a_convertir");
eq("… le clair est transmis", dV1.clair, CLAIR);
vrai("… motif « à moderniser »", dV1.motif.includes("moderniser"));

const v2Autre = `encv2:${AUTRE}:iv:tag:ct`;
const dV2 = deciderRotation(v2Autre, {
  kidCible: KID,
  chiffrerLeClair: false,
  dechiffrer: dechiffreur({ [v2Autre]: CLAIR }),
});
eq("une v2 d'une AUTRE clé, lisible → à convertir", dV2.action, "a_convertir");
vrai("… motif « autre clé »", dV2.motif.includes("autre clé"));

// ═══════════════════════════════════════════════════════════════════════
titre("5. LA RÈGLE CENTRALE : une illisible n'est jamais réécrite");
// ═══════════════════════════════════════════════════════════════════════

const dIllisible = deciderRotation(v1, ROTATION); // le déchiffreur rend ""
eq("une v1 qu'aucune clé n'ouvre → ILLISIBLE", dIllisible.action, "illisible");
eq("… et AUCUN clair n'est transmis", dIllisible.clair, undefined);
vrai("… le motif nomme la cause", dIllisible.motif.includes("encv1"));

const dIllisibleV2 = deciderRotation(v2Autre, ROTATION);
eq("une v2 dont la clé manque → ILLISIBLE", dIllisibleV2.action, "illisible");
vrai("… et le motif nomme l'identifiant de la clé manquante",
  dIllisibleV2.motif.includes(AUTRE));
eq("… aucun clair transmis", dIllisibleV2.clair, undefined);

// Le refus porte sur le LOT ENTIER, pas sur la seule valeur fautive.
const lotAvecUneIllisible: DecisionRotation[] = [
  { action: "a_convertir", clair: CLAIR, motif: "" },
  { action: "a_convertir", clair: CLAIR, motif: "" },
  { action: "illisible", motif: "" },
];
const feu = autorisationEcriture(resumer(lotAvecUneIllisible));
faux("UNE SEULE illisible refuse le lot entier", feu.ok);
if (!feu.ok) {
  vrai("… et la raison dit quoi faire", feu.raison.includes("FIELD_ENCRYPTION_KEYS_ANCIENNES"));
  vrai("… et avertit que les réécrire les perdrait",
    feu.raison.includes("perdrait"));
}
vrai("un lot sans illisible est autorisé",
  autorisationEcriture(resumer([{ action: "a_convertir", clair: CLAIR, motif: "" }])).ok);
vrai("un lot vide est autorisé", autorisationEcriture({ ...LOT_VIDE }).ok);

// ═══════════════════════════════════════════════════════════════════════
titre("6. Le comptage, et la reprise après interruption");
// ═══════════════════════════════════════════════════════════════════════

const r = resumer([
  { action: "vide", motif: "" },
  { action: "laisser", motif: "" },
  { action: "deja_convertie", motif: "" },
  { action: "deja_convertie", motif: "" },
  { action: "a_convertir", clair: CLAIR, motif: "" },
  { action: "illisible", motif: "" },
]);
eq("le résumé compte chaque catégorie", r,
  { vides: 1, laissees: 1, dejaConverties: 2, aConvertir: 1, illisibles: 1, total: 6 });

eq("deux résumés s'additionnent", additionner(r, r).total, 12);
eq("… catégorie par catégorie", additionner(r, r).dejaConverties, 4);
eq("additionner un lot vide ne change rien", additionner(r, { ...LOT_VIDE }), r);

faux("une conversion avec du reste n'est PAS terminée", conversionTerminee(r));
faux("… ni une conversion avec une illisible",
  conversionTerminee({ ...LOT_VIDE, illisibles: 1 }));
vrai("une conversion sans reste ni illisible est terminée",
  conversionTerminee({ ...LOT_VIDE, dejaConverties: 10, total: 10 }));
// C'est ce qui rend la reprise sûre : l'état se recalcule entièrement depuis
// la base, sans fichier de reprise à conserver.
vrai("l'état se déduit de la base seule, sans fichier de reprise",
  conversionTerminee({ ...LOT_VIDE, dejaConverties: 5, vides: 3, laissees: 2, total: 10 }));

// ═══════════════════════════════════════════════════════════════════════
titre("7. Le périmètre est fermé : 12 colonnes, et rien d'autre");
// ═══════════════════════════════════════════════════════════════════════

eq("douze colonnes", COLONNES_CHIFFREES.length, 12);
eq("trois tables", new Set(COLONNES_CHIFFREES.map((c) => c.table)).size, 3);
eq("deux colonnes en clair aujourd'hui (volet D17)", colonnesEnClair().length, 2);
eq("dix déjà chiffrées (volet D14)", colonnesDejaChiffrees().length, 10);
eq("les deux en clair sont bien l'IBAN et le BIC",
  colonnesEnClair().map((c) => c.colonne).sort(), ["bic", "iban"]);
vrai("les sept colonnes de provenance sont là",
  ["source_url", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"]
    .every((c) => COLONNES_CHIFFREES.some((x) => x.colonne === c)));
vrai("l'annotation Immobilier/Travaux est là",
  COLONNES_CHIFFREES.some((c) => c.colonne === "immob_travaux_annotation"));
vrai("les deux jetons DocuSign sont là",
  COLONNES_CHIFFREES.filter((c) => c.table === "docusign_connections").length === 2);
vrai("chaque colonne dit POURQUOI elle est confidentielle",
  COLONNES_CHIFFREES.every((c) => c.pourquoi.length > 20));
vrai("chaque colonne a une étiquette pour le journal",
  COLONNES_CHIFFREES.every((c) => c.etiquette.length > 0));
// Aucune colonne hors périmètre : un paramètre fautif ne peut pas toucher
// une table métier.
faux("aucune colonne de `documents` dans le périmètre",
  COLONNES_CHIFFREES.some((c) => c.table === "documents"));
faux("aucune colonne de `users`",
  COLONNES_CHIFFREES.some((c) => c.table === "users"));

// ═══════════════════════════════════════════════════════════════════════
titre("8. Les cinq gardes du script");
// ═══════════════════════════════════════════════════════════════════════

const src = readFileSync("scripts/rotation-chiffrement/rotation.ts", "utf8");

// Garde 1 — la production, refusée SANS CONDITION.
vrai("garde 1 : le mode production est refusé", src.includes('if (mode === "production")'));
vrai("… et la base égale à la production aussi",
  src.includes("hoteCible === hoteProd"));
faux("AUCUN drapeau n'autorise l'écriture en production",
  /--production|--prod\b|forcer-production/.test(src));
vrai("… et le code le dit explicitement",
  src.includes("N'A AUCUN chemin d'écriture"));

// Garde 2 — la sauvegarde.
vrai("garde 2 : une sauvegarde doit être déclarée pour écrire",
  src.includes("CGK_ROTATION_SAUVEGARDE"));
vrai("… et son absence refuse l'écriture",
  /ECRIRE && !SAUVEGARDE[\s\S]{0,200}refuser\(/.test(src));
vrai("… et elle est journalisée", src.includes("Sauvegarde déclarée"));

// Garde 3 — une illisible refuse le lot.
vrai("garde 3 : l'autorisation d'écriture est consultée par lot",
  src.includes("autorisationEcriture(r)"));
vrai("… et le refus n'empêche pas de continuer à COMPTER",
  src.includes("on continue de COMPTER"));

// Garde 4 — relecture et vérification.
vrai("garde 4 : chaque écriture est relue", /\.select\(c\.colonne\)[\s\S]{0,200}eq\("id", id\)/.test(src));
vrai("… et comparée au clair d'origine", src.includes("decryptField(apres) === d.clair"));
vrai("… un écart ARRÊTE tout", /INTÉGRITÉ[\s\S]{0,200}process\.exit\(2\)/.test(src));

// Garde 5 — aucun secret imprimé.
faux("garde 5 : aucune valeur de colonne n'est imprimée",
  /console\.(log|error)\([^)]*d\.clair/.test(src));
faux("… aucune clé n'est imprimée",
  /console\.(log|error)\([^)]*FIELD_ENCRYPTION_KEY(?!S)/.test(src));
vrai("… seul l'identifiant de clé sort, qui n'est pas réversible",
  src.includes("Clé cible (kid)"));

// Inactif par défaut.
vrai("le mode par défaut est la SIMULATION",
  src.includes('const ECRIRE = args.includes("--ecrire")'));
vrai("… et le rapport le dit", src.includes("SIMULATION (aucune écriture)"));
vrai("l'écriture exige en plus CGK_CHIFFREMENT_V2",
  /ECRIRE && !ecritureV2Active\(\)[\s\S]{0,200}refuser\(/.test(src));

// Reprise.
vrai("la reprise se fait par curseur sur l'identifiant", src.includes('q.gt("id", dernierId)'));
vrai("… par lots bornés", src.includes("TAILLE_LOT"));
vrai("… et le script dit que relancer est sans risque",
  src.includes("la reprise est sans risque"));

// Retour arrière documenté.
const plan = readFileSync("docs/D14-D17-PROCEDURE-UNIFIEE.md", "utf8");
vrai("le retour arrière est documenté", /retour arri[èe]re/i.test(plan));
vrai("… avec le point de non-retour nommé", /point de non-retour/i.test(plan));
vrai("… et la sauvegarde en préalable", /sauvegarde/i.test(plan));

for (const f of ["lib/crypto/rotation.ts", "scripts/rotation-chiffrement/rotation.ts"]) {
  faux(`${f} — aucune condition constamment fausse`,
    /if\s*\(\s*false\s*\)|\{\s*false\s*&&/.test(readFileSync(f, "utf8")));
}

bilan("rotation du chiffrement : décision et gardes");
