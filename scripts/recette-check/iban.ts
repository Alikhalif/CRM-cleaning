// Coordonnées bancaires — les cinq pays, et les gardes de la modification.
//
// Priorité 2 du client du 2026-11-09 : modifiable depuis la fiche société,
// Super Admin seul, historisée, sécurisée, tracée, et reprise automatiquement
// sur les documents de la bonne société émettrice. « Vérifie le
// fonctionnement pour les cinq pays. »
//
// ── LE FAIT QUI STRUCTURE TOUT ──────────────────────────────────────
//
// **LE CANADA N'UTILISE PAS L'IBAN.** Une validation IBAN appliquée à une
// société canadienne refuserait toutes ses coordonnées, et un document
// imprimant « IBAN » devant un numéro de transit serait faux. Les cinq pays
// ne se traitent donc pas pareil — c'est le cœur de cette suite.
//
// Les quatre IBAN de test sont les exemples du registre IBAN, et leur clé a
// été VÉRIFIÉE par calcul avant d'être écrite ici.

import { readFileSync } from "node:fs";
import {
  cleIbanValide,
  libelleCoordonnee,
  masquer,
  normaliser,
  paysUtiliseIban,
  validerBic,
  validerCoordonnee,
} from "@/lib/entities/coordonnees-bancaires";
import type { Country } from "@/lib/leads";
import { eq, faux, sansCommentaires, titre, vrai, bilan } from "./commun";

/** Exemples du registre IBAN. Clé mod-97 vérifiée par calcul. */
const IBAN: Record<string, string> = {
  FR: "FR1420041010050500013M02606",
  CH: "CH9300762011623852957",
  BE: "BE68539007547034",
  LU: "LU280019400644750000",
};

// ═══════════════════════════════════════════════════════════════════════
titre("1. Les quatre pays à IBAN acceptent le leur");
// ═══════════════════════════════════════════════════════════════════════

for (const pays of ["FR", "CH", "BE", "LU"] as Country[]) {
  vrai(`${pays} utilise l'IBAN`, paysUtiliseIban(pays));
  eq(`${pays} : son intitulé est « IBAN »`, libelleCoordonnee(pays), "IBAN");

  const v = validerCoordonnee(IBAN[pays], pays);
  vrai(`${pays} : son IBAN de référence est accepté`, v.ok,
    v.ok ? undefined : v.motif);
  if (v.ok) {
    eq(`${pays} : il est normalisé`, v.valeurNormalisee, IBAN[pays]);
    eq(`${pays} : aucun avertissement`, v.avertissement, null);
  }

  // Les espaces de saisie ne doivent pas faire échouer une valeur juste.
  const espaces = IBAN[pays].replace(/(.{4})/g, "$1 ").trim();
  const vEsp = validerCoordonnee(espaces, pays);
  vrai(`${pays} : les espaces de saisie sont tolérés`, vEsp.ok);
  if (vEsp.ok) eq(`${pays} : et retirés`, vEsp.valeurNormalisee, IBAN[pays]);
}

// ═══════════════════════════════════════════════════════════════════════
titre("2. LE CANADA — pas d'IBAN, et le document le dit");
// ═══════════════════════════════════════════════════════════════════════

faux("le Canada n'utilise PAS l'IBAN", paysUtiliseIban("CA"));
eq("son intitulé n'est pas « IBAN »", libelleCoordonnee("CA"), "Coordonnées bancaires");

const caLocal = validerCoordonnee("003 12345 1234567", "CA");
vrai("des coordonnées locales canadiennes sont acceptées", caLocal.ok,
  caLocal.ok ? undefined : caLocal.motif);
if (caLocal.ok) {
  eq("… normalisées en chiffres", caLocal.valeurNormalisee, "003123451234567");
  vrai("… avec un avertissement qui explique", (caLocal.avertissement ?? "").includes("n'utilise pas l'IBAN"));
  vrai("… et qui annonce l'intitulé imprimé",
    (caLocal.avertissement ?? "").includes("Coordonnées bancaires"));
}

const caIban = validerCoordonnee(IBAN.FR, "CA");
vrai("un IBAN saisi pour une société canadienne est accepté…", caIban.ok);
if (caIban.ok) {
  vrai("… mais signalé comme douteux", (caIban.avertissement ?? "").includes("canadienne"));
}

const caFaux = validerCoordonnee("pas-un-numero", "CA");
faux("une valeur canadienne informe est refusée", caFaux.ok);
if (!caFaux.ok) vrai("… en disant ce qui est attendu", caFaux.motif.includes("institution"));

// ═══════════════════════════════════════════════════════════════════════
titre("3. Les refus qui comptent");
// ═══════════════════════════════════════════════════════════════════════

// Le mauvais pays : une société française ne peut pas encaisser sur un
// compte déclaré belge sans que quelqu'un s'en aperçoive.
const mauvaisPays = validerCoordonnee(IBAN.BE, "FR");
faux("un IBAN belge pour une société française est REFUSÉ", mauvaisPays.ok);
if (!mauvaisPays.ok) {
  vrai("… et le motif nomme les deux pays",
    mauvaisPays.motif.includes("BE") && mauvaisPays.motif.includes("FR"));
}

// La longueur.
const tropCourt = validerCoordonnee("FR1420041010050500013M0260", "FR");
faux("un IBAN FR de 26 caractères est refusé", tropCourt.ok);
if (!tropCourt.ok) vrai("… et le motif donne la longueur attendue", tropCourt.motif.includes("27"));

// La clé de contrôle — le cas le plus fréquent en pratique.
const cleFausse = validerCoordonnee("FR1520041010050500013M02606", "FR");
faux("un IBAN FR à clé fausse est refusé", cleFausse.ok);
if (!cleFausse.ok) {
  vrai("… et le motif dit que c'est presque toujours une faute de frappe",
    cleFausse.motif.includes("faute de frappe"));
}

faux("une valeur qui ne commence pas par un code pays est refusée",
  validerCoordonnee("1420041010050500013M02606", "FR").ok);

// ── La clé de contrôle, en direct ──
vrai("la clé des quatre IBAN de référence est valide",
  (["FR", "CH", "BE", "LU"] as Country[]).every((p) => cleIbanValide(IBAN[p])));
faux("un caractère modifié invalide la clé", cleIbanValide("FR1420041010050500013M02607"));
faux("une chaîne vide n'est pas un IBAN valide", cleIbanValide(""));
// ⚠️ Un IBAN converti en entier dépasse Number.MAX_SAFE_INTEGER : le calcul
// se fait chiffre à chiffre. Un `parseInt` donnerait un résultat faux en
// silence — ce contrôle existe pour que la régression se voie.
vrai("le calcul tient sur un IBAN de 34 caractères (longueur maximale)",
  typeof cleIbanValide("MT84MALT011000012345MTLCAST001S") === "boolean");

// ═══════════════════════════════════════════════════════════════════════
titre("4. Effacer reste possible");
// ═══════════════════════════════════════════════════════════════════════
//
// Cinq sociétés sur sept n'ont aucune coordonnée, et les documents
// n'impriment alors aucune ligne bancaire. Refuser le vide empêcherait de
// corriger une saisie erronée.

for (const pays of ["FR", "CH", "BE", "LU", "CA"] as Country[]) {
  const v = validerCoordonnee("", pays);
  vrai(`${pays} : une valeur vide est acceptée`, v.ok);
  if (v.ok) eq(`${pays} : et reste vide`, v.valeurNormalisee, "");
}
vrai("des espaces seuls valent vide", (() => {
  const v = validerCoordonnee("   ", "FR");
  return v.ok && v.valeurNormalisee === "";
})());

// ═══════════════════════════════════════════════════════════════════════
titre("5. Le BIC");
// ═══════════════════════════════════════════════════════════════════════

vrai("un BIC de 8 caractères est accepté", validerBic("BNPAFRPP", "FR").ok);
vrai("un BIC de 11 caractères aussi", validerBic("BNPAFRPPXXX", "FR").ok);
faux("un BIC de 9 caractères est refusé", validerBic("BNPAFRPPX", "FR").ok);
faux("un BIC avec des chiffres dans la banque est refusé", validerBic("BNP1FRPP", "FR").ok);
vrai("un BIC vide est accepté", validerBic("", "FR").ok);
{
  const v = validerBic("BNPAFRPP", "CH");
  vrai("un BIC d'un autre pays est accepté…", v.ok);
  if (v.ok) vrai("… mais signalé", (v.avertissement ?? "").includes("FR"));
}

// ═══════════════════════════════════════════════════════════════════════
titre("6. Le masquage — ce qui part dans le journal d'audit");
// ═══════════════════════════════════════════════════════════════════════
//
// `audit_logs` est lisible par les administrateurs et conservé des années,
// alors que la colonne est chiffrée. Y écrire l'IBAN en clair annulerait le
// chiffrement qu'on vient de poser.

const masque = masquer(IBAN.FR);
vrai("les quatre premiers caractères restent", masque.startsWith("FR14"));
vrai("les quatre derniers restent", masque.endsWith("2606"));
faux("le milieu ne sort PAS", masque.includes("20041010050500013M0"));
eq("la longueur est conservée", masque.length, IBAN.FR.length);
eq("une valeur vide se dit « (vide) »", masquer(""), "(vide)");
eq("une valeur courte est entièrement masquée", masquer("ABCD"), "****");
vrai("un masque ne permet pas de reconstituer la valeur",
  masquer(IBAN.FR) !== IBAN.FR);

eq("la normalisation retire espaces, points, tirets et barres",
  normaliser("fr14 2004.1010-0505/0001 3m02 606"), IBAN.FR);

// ═══════════════════════════════════════════════════════════════════════
titre("7. Les gardes de l'action serveur");
// ═══════════════════════════════════════════════════════════════════════

const actionBrute = readFileSync("app/(app)/settings/entities/actions.ts", "utf8");
// Inspection STRUCTURELLE : on retire les commentaires, sinon un contrôle se
// déclenche sur la prose qui l'explique. C'est arrivé trois fois dans ce lot.
const action = sansCommentaires(actionBrute);

vrai("l'action existe", action.includes("export async function modifierCoordonneesBancaires"));
vrai("garde 1 : SUPER ADMIN seul", /const droit = await assertAdmin\(\)/.test(action));
faux("… et non pas le back-office, qui laisserait passer la planification",
  /modifierCoordonneesBancaires[\s\S]{0,900}assertBackOffice\(/.test(action));
vrai("garde 2 : la validation est REJOUÉE côté serveur",
  action.includes("validerCoordonnee(input.iban, pays)") && action.includes("validerBic(input.bic, pays)"));
vrai("… contre le pays lu EN BASE, pas celui envoyé par le client",
  /paysReconnu\(avant\.country\)/.test(action));
vrai("garde 3 : pas de clé de chiffrement, pas d'écriture",
  /isFieldEncryptionConfigured\(\)[\s\S]{0,300}return \{\s*ok: false/.test(action));
vrai("la valeur est chiffrée avant d'être écrite",
  action.includes("encryptField(vIban.valeurNormalisee)"));
vrai("l'écriture ne touche QUE les deux colonnes",
  /\.update\(\{ iban: nouveauIban, bic: nouveauBic \}/.test(action));
faux("… et ne passe pas par buildPayload, qui en écrirait d'autres",
  /modifierCoordonneesBancaires[\s\S]{0,1200}buildPayload\(/.test(action));
vrai("une valeur vide efface (null en base)",
  action.includes('vIban.valeurNormalisee === "" ? null'));

// La trace.
vrai("la modification est journalisée", action.includes('action: "entity.bank_change"'));
vrai("… avec l'état AVANT et APRÈS", /before: \{[\s\S]{0,400}after: \{/.test(action));
vrai("… et la valeur n'y figure QUE MASQUÉE",
  action.includes("iban: masquer(") && action.includes("bic: masquer("));
faux("… jamais en clair",
  /iban: vIban\.valeurNormalisee[\s\S]{0,60}(before|after)/.test(action)
  || /after: \{[^}]*iban: (input|vIban)\.(iban|valeurNormalisee)/.test(action));
vrai("l'action documente son nom dans l'espace de noms du journal",
  readFileSync("lib/audit.ts", "utf8").includes("entity.bank_change"));

// La reprise sur les documents.
vrai("les écrans qui rendent des documents sont invalidés",
  action.includes('revalidatePath("/comptabilite")') && action.includes('revalidatePath("/devis")'));

// ═══════════════════════════════════════════════════════════════════════
titre("8. La reprise automatique sur les documents");
// ═══════════════════════════════════════════════════════════════════════

const docs = readFileSync("lib/documents-server.ts", "utf8");
vrai("le mappeur d'entité déchiffre les deux colonnes",
  docs.includes("lireCoordonneeBancaire(row.iban") && docs.includes("lireCoordonneeBancaire(row.bic"));

for (const f of ["lib/pdf/DocumentPdf.tsx", "lib/pdf/DevisNettoyagePdf.tsx"]) {
  const src = sansCommentaires(readFileSync(f, "utf8"));
  vrai(`${f.split("/").pop()} : l'intitulé suit le PAYS de la société`,
    src.includes("libelleCoordonnee(entity.country)"));
  faux(`${f.split("/").pop()} : plus d'« IBAN » écrit en dur devant la valeur`,
    /IBAN \{entity\.iban\}/.test(src));
  vrai(`${f.split("/").pop()} : aucune ligne bancaire sans coordonnée`,
    src.includes("entity.iban?.trim() &&"));
}

// L'écran, réservé au Super Admin.
const page = sansCommentaires(readFileSync("app/(app)/settings/entities/page.tsx", "utf8"));
vrai("la page est déjà gardée pour les admins", page.includes("isAdmin"));
vrai("… et le bloc bancaire est dans la branche admin",
  /isAdmin \?[\s\S]{0,900}CoordonneesBancaires/.test(page));
vrai("les valeurs envoyées au navigateur sont MASQUÉES",
  page.includes("masquer(e.iban)") && page.includes("masquer(e.bic)"));
faux("… jamais en clair",
  /ibanMasque: e\.iban\b/.test(page));

for (const f of [
  "lib/entities/coordonnees-bancaires.ts",
  "lib/entities/coordonnees-bancaires-server.ts",
  "app/(app)/settings/entities/CoordonneesBancaires.tsx",
]) {
  faux(`${f} — aucune condition constamment fausse`,
    /if\s*\(\s*false\s*\)|\{\s*false\s*&&/.test(readFileSync(f, "utf8")));
}

bilan("coordonnées bancaires : cinq pays et gardes de modification");
