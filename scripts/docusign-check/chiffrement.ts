// Chiffrement des champs confidentiels — fail-closed à l'écriture.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// `encryptField()` renvoyait le texte clair quand FIELD_ENCRYPTION_KEY était
// absente ou mal formée, avec un unique avertissement console. Constaté le
// 2026-11-05 : la clé de `.env.local` faisait 30 caractères — ni 64 hex, ni
// base64 décodant sur 32 octets — et ce même `.env.local` pointait sur la base
// de PRODUCTION. Chaque enregistrement y écrivait donc la provenance marketing
// et l'annotation Immobilier/Travaux EN CLAIR, dans les colonnes mêmes qui
// existent pour les cacher au commercial.
//
// Une écriture refusée se voit. Une écriture en clair ne se voit pas. Ces
// assertions garantissent que le refus reste la règle, dans TOUTES les formes
// de clé invalide — et que la lecture, elle, reste tolérante aux données
// existantes, chiffrées comme héritées en clair.
//
// AUCUNE VRAIE CLÉ ICI. Les valeurs sont des motifs de test évidents, et la
// suite commence par retirer FIELD_ENCRYPTION_KEY de l'environnement pour que
// son résultat ne dépende pas de la machine qui l'exécute.

import { readFileSync } from "node:fs";
import {
  FieldEncryptionUnavailableError,
  decryptField,
  encryptField,
  isFieldEncryptionConfigured,
} from "@/lib/crypto/field-encryption";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  console.log(ja === jb ? `  ok    ${nom} = ${ja}` : `  ECHEC ${nom}\n    obtenu  ${ja}\n    attendu ${jb}`);
  if (ja !== jb) ko++;
}

/**
 * Le chiffrement doit REFUSER, pas se rabattre.
 *
 * On vérifie trois choses d'un coup : qu'il lève, que c'est bien l'erreur
 * dédiée, et surtout que le texte en clair n'est PAS ressorti — ni comme
 * valeur de retour, ni dans le message d'erreur.
 */
function refuse(nom: string, clair: string) {
  let leve = false, bonneErreur = false, bonCode = false, fuite = false, retour = "";
  try {
    retour = encryptField(clair);
  } catch (e) {
    leve = true;
    bonneErreur = e instanceof FieldEncryptionUnavailableError;
    bonCode = (e as FieldEncryptionUnavailableError).code === "FIELD_ENCRYPTION_UNAVAILABLE";
    fuite = clair.length > 0 && String((e as Error).message).includes(clair);
  }
  vrai(`${nom} → lève au lieu de renvoyer du clair`, leve);
  vrai(`${nom} → erreur FieldEncryptionUnavailableError`, bonneErreur);
  vrai(`${nom} → code FIELD_ENCRYPTION_UNAVAILABLE`, bonCode);
  vrai(`${nom} → le message ne contient pas la valeur confidentielle`, !fuite);
  vrai(`${nom} → rien n'est renvoyé`, retour === "");
}

function avecCle(cle: string | undefined, fn: () => void) {
  const avant = process.env.FIELD_ENCRYPTION_KEY;
  if (cle === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = cle;
  try { fn(); } finally {
    if (avant === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = avant;
  }
}

// Motifs de test. Jamais une clé réelle.
const HEX_A = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const HEX_B = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";
const B64_32 = Buffer.alloc(32, 7).toString("base64");
const SECRET = "Appartement vendu 480 000 € — travaux à prévoir";

// Indépendance de la machine : la vraie clé, si elle existe dans
// l'environnement de l'exécutant, ne doit pas influencer un seul résultat.
delete process.env.FIELD_ENCRYPTION_KEY;

console.log("\n== Clé absente : l'écriture est refusée, jamais dégradée ==");
avecCle(undefined, () => {
  vrai("isFieldEncryptionConfigured() = false", isFieldEncryptionConfigured() === false);
  refuse("clé absente", SECRET);
  refuse("clé absente, valeur vide", "");
});

console.log("\n== Clé invalide : chaque forme est refusée ==");
const INVALIDES: [string, string][] = [
  ["30 caractères (le cas réel du 2026-11-05)", "cle-de-test-trop-courte-30car."],
  ["63 caractères hex (un de trop peu)", HEX_A.slice(0, 63)],
  ["65 caractères hex (un de trop)", HEX_A + "f"],
  ["64 caractères dont un non-hexadécimal", HEX_A.slice(0, 63) + "z"],
  ["base64 décodant sur 21 octets", Buffer.alloc(21, 3).toString("base64")],
  ["base64 décodant sur 31 octets", Buffer.alloc(31, 3).toString("base64")],
  ["base64 décodant sur 33 octets", Buffer.alloc(33, 3).toString("base64")],
  ["chaîne vide", ""],
  ["espaces seulement", "     "],
];
for (const [libelle, cle] of INVALIDES) {
  avecCle(cle, () => {
    vrai(`${libelle} → isFieldEncryptionConfigured() = false`, isFieldEncryptionConfigured() === false);
    refuse(libelle, SECRET);
  });
}

console.log("\n== Clé valide : les deux formats admis fonctionnent ==");
for (const [libelle, cle] of [
  ["64 caractères hexadécimaux", HEX_A],
  ["hexadécimal en majuscules", HEX_A.toUpperCase()],
  ["base64 de 32 octets", B64_32],
  ["hexadécimal entouré d'espaces", `  ${HEX_A}  `],
] as [string, string][]) {
  avecCle(cle, () => {
    vrai(`${libelle} → isFieldEncryptionConfigured() = true`, isFieldEncryptionConfigured() === true);
    const enveloppe = encryptField(SECRET);
    vrai(`${libelle} → enveloppe préfixée encv1:`, enveloppe.startsWith("encv1:"));
    vrai(`${libelle} → la valeur confidentielle n'apparaît pas dans l'enveloppe`,
      !enveloppe.includes(SECRET));
    eq(`${libelle} → aller-retour fidèle`, decryptField(enveloppe), SECRET);
  });
}

console.log("\n== Le format de l'enveloppe est stable ==");
avecCle(HEX_A, () => {
  const e = encryptField(SECRET);
  const parts = e.split(":");
  eq("quatre segments séparés par ':'", parts.length, 4);
  eq("premier segment", parts[0], "encv1");
  vrai("IV de 12 octets", Buffer.from(parts[1], "base64").length === 12);
  vrai("tag GCM de 16 octets", Buffer.from(parts[2], "base64").length === 16);
  vrai("deux chiffrements de la même valeur diffèrent (IV aléatoire)",
    encryptField(SECRET) !== encryptField(SECRET));
});

console.log("\n== L'aller-retour préserve le contenu réel ==");
avecCle(HEX_A, () => {
  for (const v of [
    "",
    "simple",
    "accents éàüç et ponctuation « ! »",
    "deux\nlignes",
    "emoji 🏠 et tabulation\t",
    "a".repeat(5000),
    "encv1:pas-vraiment-une-enveloppe",
  ]) {
    const etiquette = v.length > 24 ? `${v.slice(0, 21)}… (${v.length} car.)` : JSON.stringify(v);
    eq(`aller-retour ${etiquette}`, decryptField(encryptField(v)), v);
  }
});

console.log("\n== Compatibilité : les données déjà en base restent lisibles ==");
avecCle(HEX_A, () => {
  eq("texte clair hérité (sans préfixe) rendu tel quel",
    decryptField("ancienne annotation en clair"), "ancienne annotation en clair");
  eq("texte clair hérité vide", decryptField(""), "");
  eq("texte clair hérité contenant des ':'",
    decryptField("13:45 rendez-vous"), "13:45 rendez-vous");
});

console.log("\n== La lecture ne révèle jamais de chiffré, et ne lève pas ==");
const enveloppeA = (() => { let e = ""; avecCle(HEX_A, () => { e = encryptField(SECRET); }); return e; })();
avecCle(undefined, () => {
  eq("clé absente → chaîne vide, pas le chiffré brut", decryptField(enveloppeA), "");
});
avecCle(HEX_B, () => {
  eq("MAUVAISE clé → chaîne vide, jamais la valeur ni le chiffré",
    decryptField(enveloppeA), "");
});
avecCle(HEX_A, () => {
  const parts = enveloppeA.split(":");
  const tagFaux = Buffer.alloc(16, 0).toString("base64");
  eq("tag GCM falsifié → chaîne vide (authentification)",
    decryptField(`encv1:${parts[1]}:${tagFaux}:${parts[3]}`), "");
  eq("chiffré tronqué → chaîne vide",
    decryptField(`encv1:${parts[1]}:${parts[2]}:${parts[3].slice(0, 4)}`), "");
  eq("enveloppe incomplète → chaîne vide", decryptField("encv1:xx"), "");
});

console.log("\n== La clé est relue à chaque appel : aucun cache ==");
// C'est ce qui rend ces contrôles valides, et surtout ce qui fait qu'un
// redémarrage avec la bonne clé rétablit le service sans purger quoi que ce
// soit. Un cache de module aurait figé l'état « pas de clé » pour tout le
// processus.
avecCle(undefined, () => {
  vrai("sans clé → false", isFieldEncryptionConfigured() === false);
});
avecCle(HEX_A, () => {
  vrai("puis avec clé, dans le même processus → true", isFieldEncryptionConfigured() === true);
});
avecCle(undefined, () => {
  vrai("puis sans clé à nouveau → false", isFieldEncryptionConfigured() === false);
});

console.log("\n== Le contrôle préalable et le refus disent la même chose ==");
// Les appelants décident à partir de `isFieldEncryptionConfigured()` ; le
// module refuse à partir de `loadKey()`. Si les deux divergeaient, un appelant
// se croirait autorisé puis récolterait une exception — un « 500 » au lieu d'un
// message. On vérifie donc l'équivalence sur toutes les formes testées.
for (const [libelle, cle] of [
  ...INVALIDES,
  ["64 hex valide", HEX_A],
  ["base64 valide", B64_32],
] as [string, string][]) {
  avecCle(cle, () => {
    const autorise = isFieldEncryptionConfigured();
    let aLeve = false;
    try { encryptField("x"); } catch { aLeve = true; }
    vrai(`${libelle} → contrôle préalable et refus concordent`, autorise === !aLeve);
  });
}

console.log("\n== Ordre des contrôles dans les chemins DocuSign ==");
// Pourquoi une assertion sur le TEXTE SOURCE et non sur le comportement :
// `accesPourEntite()` fait des I/O (Supabase, puis un POST vers DocuSign) et
// n'est donc pas exécutable ici — la portée du lanceur l'interdit. Or le
// défaut à empêcher est un ORDRE, pas un calcul.
//
// Constaté le 2026-11-05 : le contrôle du chiffrement se trouvait APRÈS les
// deux `decryptField()`. Sans clé valide, le premier renvoyait un `Bearer`
// VIDE (DocuSign : 401) et le second postait un `refresh_token` VIDE
// (DocuSign : 400), puis inscrivait « rafraîchissement refusé (HTTP 400) »
// dans `last_error` — un diagnostic qui accuse DocuSign et envoie
// réautoriser, alors que seule la clé manquait. Le garde-fou d'écriture,
// lui, n'était jamais atteint : l'écriture restait sûre, mais le message
// mentait.
//
// Ce contrôle fige l'ordre : le refus doit précéder tout usage de la clé.
{
  const src = readFileSync("lib/docusign/oauth-server.ts", "utf8");

  /** Corps d'une fonction exportée, jusqu'à la suivante. */
  const corps = (nom: string): string => {
    const i = src.indexOf(`export async function ${nom}(`);
    if (i < 0) return "";
    const j = src.indexOf("\nexport async function ", i + 1);
    return src.slice(i, j < 0 ? src.length : j);
  };

  for (const nom of ["accesPourEntite", "terminerAutorisation"]) {
    const f = corps(nom);
    vrai(`${nom} : fonction trouvée dans la source`, f.length > 0);
    if (!f) continue;

    // Un commentaire ne déchiffre rien : les blocs d'explication qui citent
    // le nom d'une fonction ne doivent pas faire échouer le contrôle.
    const code = f
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
      })
      .join("\n");

    const garde = code.indexOf("isFieldEncryptionConfigured()");
    const dechiffre = code.indexOf("decryptField(");
    const chiffre = code.indexOf("encryptField(");

    vrai(`${nom} : le contrôle du chiffrement est présent`, garde >= 0);
    if (dechiffre >= 0) {
      vrai(`${nom} : contrôle AVANT tout decryptField()`, garde >= 0 && garde < dechiffre);
    }
    if (chiffre >= 0) {
      vrai(`${nom} : contrôle AVANT tout encryptField()`, garde >= 0 && garde < chiffre);
    }
  }

  // Compensation : si l'insertion de la nouvelle connexion échoue APRÈS la
  // révocation de l'ancienne, l'ancienne doit être rétablie. L'index unique
  // partiel interdit d'insérer avant de révoquer — l'ordre ne peut donc pas
  // être inversé, et seule la compensation protège l'entité d'un échec
  // d'écriture qui la laisserait sans aucun raccordement.
  const t = corps("terminerAutorisation");
  const iRevoque = t.indexOf('.is("revoked_at", null)');
  const iSelect = t.indexOf('.select("id")', iRevoque >= 0 ? iRevoque : 0);
  const iInsert = t.indexOf(".insert(ligne");
  // `{ revoked_at: null }` et non `revoked_at: null` : cette seconde forme
  // apparaît aussi dans l'objet `ligne`, AVANT l'insertion — la chercher
  // telle quelle validerait un code sans compensation.
  const iRetour = t.indexOf("{ revoked_at: null }");

  vrai("terminerAutorisation : la révocation retient les lignes touchées",
    iRevoque >= 0 && iInsert > 0 && iSelect > iRevoque && iSelect < iInsert);
  vrai("terminerAutorisation : l'échec d'insertion rétablit la connexion révoquée",
    iInsert > 0 && iRetour > iInsert);
}

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
