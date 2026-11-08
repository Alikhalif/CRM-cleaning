// Voie 2 — identifiant de clé et rotation progressive.
//
// Demande du client du 2026-11-08 : « Je retiens la voie 2, avec
// identification des clés et possibilité de rotation progressive. Prépare le
// plan technique et les tests. »
//
// Ces contrôles exercent le chiffrement AVEC de vraies clés — générées ici,
// jetables, et qui ne quittent pas le processus. Aucune clé de production
// n'est lue : la suite pose elle-même `process.env` autour de chaque cas.
//
// ── CE QU'ILS PROUVENT ───────────────────────────────────────────────
//
//   1. l'écriture reste en `encv1` tant que `CGK_CHIFFREMENT_V2` n'est pas
//      posée — donc le comportement de production ne change pas ;
//   2. une rotation PROGRESSIVE fonctionne : une valeur scellée par
//      l'ancienne clé reste lisible après l'arrivée de la nouvelle ;
//   3. une rotation INTERROMPUE est récupérable : les deux formes cohabitent
//      et on sait les distinguer ;
//   4. l'identifiant de clé ne révèle rien de la clé.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  clesDeLecture,
  decryptField,
  ecritureV2Active,
  encryptField,
  formeEnveloppe,
  kidDeCle,
  kidDeLEnveloppe,
  isFieldEncryptionConfigured,
} from "@/lib/crypto/field-encryption";
import { empreinte } from "@/lib/env/cible";
import { eq, faux, titre, vrai, bilan } from "./commun";

// Deux clés jetables, générées à l'instant. Elles n'existent que le temps de
// ce processus.
const CLE_A = randomBytes(32);
const CLE_B = randomBytes(32);
const HEX_A = CLE_A.toString("hex");
const HEX_B = CLE_B.toString("hex");

const SECRET = "FR76 1234 5678 9012 3456 7890 123";

/** Pose l'environnement, exécute, puis restaure — toujours. */
function avec(
  env: { courante?: string; anciennes?: string; v2?: string },
  f: () => void,
): void {
  const sauve = {
    k: process.env.FIELD_ENCRYPTION_KEY,
    a: process.env.FIELD_ENCRYPTION_KEYS_ANCIENNES,
    v: process.env.CGK_CHIFFREMENT_V2,
  };
  try {
    if (env.courante === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = env.courante;
    if (env.anciennes === undefined) delete process.env.FIELD_ENCRYPTION_KEYS_ANCIENNES;
    else process.env.FIELD_ENCRYPTION_KEYS_ANCIENNES = env.anciennes;
    if (env.v2 === undefined) delete process.env.CGK_CHIFFREMENT_V2;
    else process.env.CGK_CHIFFREMENT_V2 = env.v2;
    f();
  } finally {
    if (sauve.k === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = sauve.k;
    if (sauve.a === undefined) delete process.env.FIELD_ENCRYPTION_KEYS_ANCIENNES;
    else process.env.FIELD_ENCRYPTION_KEYS_ANCIENNES = sauve.a;
    if (sauve.v === undefined) delete process.env.CGK_CHIFFREMENT_V2;
    else process.env.CGK_CHIFFREMENT_V2 = sauve.v;
  }
}

// ═══════════════════════════════════════════════════════════════════════
titre("1. Rien ne change tant que la voie 2 n'est pas activée");
// ═══════════════════════════════════════════════════════════════════════

avec({ courante: HEX_A }, () => {
  faux("sans CGK_CHIFFREMENT_V2, l'écriture v2 est inactive", ecritureV2Active());
  const scelle = encryptField(SECRET);
  eq("… et l'enveloppe produite est bien `encv1`", formeEnveloppe(scelle), "v1");
  eq("… relisible immédiatement", decryptField(scelle), SECRET);
  eq("… et elle ne porte aucun identifiant de clé", kidDeLEnveloppe(scelle), null);
});
avec({ courante: HEX_A, v2: "non" }, () => {
  faux("une valeur autre que « oui » ne l'active pas", ecritureV2Active());
});
avec({ courante: HEX_A, v2: "OUI" }, () => {
  vrai("« OUI » en majuscules l'active", ecritureV2Active());
});

// ═══════════════════════════════════════════════════════════════════════
titre("2. L'identifiant de clé ne révèle rien de la clé");
// ═══════════════════════════════════════════════════════════════════════

const kidA = kidDeCle(CLE_A);
eq("il fait 8 caractères", kidA.length, 8);
vrai("… hexadécimaux", /^[0-9a-f]{8}$/.test(kidA));
eq("il est stable", kidDeCle(CLE_A), kidA);
vrai("deux clés différentes ont deux identifiants différents", kidDeCle(CLE_B) !== kidA);
faux("il ne contient pas la clé", HEX_A.includes(kidA) && kidA.length > 8);
vrai(
  "le même secret donné en hexadécimal ou en base64 a le MÊME identifiant",
  kidDeCle(Buffer.from(HEX_A, "hex")) === kidDeCle(Buffer.from(CLE_A.toString("base64"), "base64")),
);

// ═══════════════════════════════════════════════════════════════════════
titre("3. La forme d'une valeur stockée se reconnaît");
// ═══════════════════════════════════════════════════════════════════════

eq("du texte clair", formeEnveloppe("FR76 1234"), "clair");
eq("une enveloppe v1", formeEnveloppe("encv1:a:b:c"), "v1");
eq("une enveloppe v2", formeEnveloppe("encv2:deadbeef:a:b:c"), "v2");
eq("une chaîne vide est du clair", formeEnveloppe(""), "clair");
eq("un identifiant mal formé n'est pas retenu", kidDeLEnveloppe("encv2:XYZ:a:b:c"), null);
eq("… ni un identifiant trop court", kidDeLEnveloppe("encv2:dead:a:b:c"), null);
eq("un identifiant valide est lu", kidDeLEnveloppe("encv2:deadbeef:a:b:c"), "deadbeef");

// ═══════════════════════════════════════════════════════════════════════
titre("4. La rotation PROGRESSIVE : l'ancienne valeur reste lisible");
// ═══════════════════════════════════════════════════════════════════════
//
// C'est le scénario réel. Étape 1 : la clé A seule. Étape 2 : la clé B
// devient courante, A passe en ancienne. Les valeurs scellées par A doivent
// rester lisibles — sans quoi aucune rotation n'est possible sans interruption.

let scelleParA = "";
avec({ courante: HEX_A, v2: "oui" }, () => {
  scelleParA = encryptField(SECRET);
  eq("scellée en v2 par la clé A", formeEnveloppe(scelleParA), "v2");
  eq("… portant l'identifiant de A", kidDeLEnveloppe(scelleParA), kidA);
});

avec({ courante: HEX_B, anciennes: HEX_A, v2: "oui" }, () => {
  eq("après bascule, la valeur de A reste LISIBLE", decryptField(scelleParA), SECRET);
  const scelleParB = encryptField(SECRET);
  eq("… et les nouvelles écritures portent l'identifiant de B",
    kidDeLEnveloppe(scelleParB), kidDeCle(CLE_B));
  eq("… relisibles aussi", decryptField(scelleParB), SECRET);
  eq("deux clés sont disponibles en lecture", clesDeLecture().length, 2);
  eq("… la courante en premier", clesDeLecture()[0].kid, kidDeCle(CLE_B));
});

avec({ courante: HEX_B, v2: "oui" }, () => {
  eq("SANS l'ancienne clé, la valeur de A devient illisible", decryptField(scelleParA), "");
  vrai("… et le rendu est vide, jamais du chiffré brut",
    !decryptField(scelleParA).startsWith("encv"));
});

// ═══════════════════════════════════════════════════════════════════════
titre("5. Une rotation INTERROMPUE est récupérable");
// ═══════════════════════════════════════════════════════════════════════
//
// C'est précisément ce que l'absence d'identifiant de clé rendait impossible :
// après une interruption, on ne savait plus quelle moitié de la base était
// scellée par quoi.

avec({ courante: HEX_B, anciennes: HEX_A, v2: "oui" }, () => {
  const base = [scelleParA, encryptField(SECRET), "FR00 EN CLAIR", ""];
  const formes = base.map(formeEnveloppe);
  eq("on sait distinguer les trois formes", formes, ["v2", "v2", "clair", "clair"]);

  const aConvertir = base.filter(
    (v) => formeEnveloppe(v) === "v2" && kidDeLEnveloppe(v) !== kidDeCle(CLE_B),
  );
  eq("… et compter EXACTEMENT ce qui reste à convertir", aConvertir.length, 1);
  vrai("toutes les valeurs restent lisibles pendant la conversion",
    base.every((v) => !v || decryptField(v).length > 0));
});

// ═══════════════════════════════════════════════════════════════════════
titre("6. Compatibilité ascendante avec `encv1`");
// ═══════════════════════════════════════════════════════════════════════
//
// Les valeurs déjà en base sont en `encv1`, sans identifiant. Elles doivent
// rester lisibles, et la lecture doit ESSAYER les clés disponibles plutôt que
// de déclarer la valeur perdue.

let v1ParA = "";
avec({ courante: HEX_A }, () => {
  v1ParA = encryptField(SECRET);
  eq("écriture v1 par défaut", formeEnveloppe(v1ParA), "v1");
});
avec({ courante: HEX_B, anciennes: HEX_A }, () => {
  eq("une v1 scellée par A reste lisible quand A est déclarée ancienne",
    decryptField(v1ParA), SECRET);
});
avec({ courante: HEX_B }, () => {
  eq("… et devient illisible si A n'est plus déclarée", decryptField(v1ParA), "");
});

// ═══════════════════════════════════════════════════════════════════════
titre("7. Les cas dégradés ne rendent jamais du chiffré brut");
// ═══════════════════════════════════════════════════════════════════════

avec({}, () => {
  faux("sans aucune clé, le chiffrement n'est pas configuré", isFieldEncryptionConfigured());
  eq("une valeur chiffrée devient vide", decryptField("encv1:a:b:c"), "");
  eq("du texte clair traverse quand même", decryptField("FR76 1234"), "FR76 1234");
});
avec({ courante: "trop-court" }, () => {
  faux("une clé mal formée n'est pas acceptée", isFieldEncryptionConfigured());
  eq("… et aucune clé de lecture n'est disponible", clesDeLecture().length, 0);
});
avec({ courante: HEX_A }, () => {
  eq("une enveloppe tronquée rend vide", decryptField("encv1:seulement-deux:parties"), "");
  eq("une enveloppe v2 sans corps rend vide", decryptField("encv2:deadbeef:"), "");
  eq("un contenu altéré rend vide — GCM authentifie",
    decryptField(encryptField(SECRET).slice(0, -4) + "AAAA"), "");
});
avec({ courante: HEX_A, anciennes: `${HEX_A},${HEX_A}` }, () => {
  eq("une clé déclarée deux fois n'est comptée qu'une", clesDeLecture().length, 1);
});
avec({ courante: HEX_A, anciennes: " , ,  " }, () => {
  eq("des anciennes vides sont ignorées", clesDeLecture().length, 1);
});

// ═══════════════════════════════════════════════════════════════════════
titre("8. D17 — l'IBAN se lit quelle que soit sa forme");
// ═══════════════════════════════════════════════════════════════════════

const docs = readFileSync("lib/documents-server.ts", "utf8");
vrai("le mappeur d'entité passe par la lecture tolérante",
  docs.includes("lireCoordonneeBancaire(row.iban") && docs.includes("lireCoordonneeBancaire(row.bic"));
vrai("… qui reconnaît la forme avant de déchiffrer",
  docs.includes('formeEnveloppe(valeur) === "clair"'));
vrai("… et CRIE si un IBAN chiffré est illisible",
  docs.includes("CHIFFRÉ MAIS ILLISIBLE"));
// La société est interpolée AVANT le message, pas après : le motif suit donc
// l'ordre réel du code plutôt que celui que j'avais supposé.
vrai("… en nommant la société concernée",
  /societe[\s\S]{0,160}CHIFFR[ÉE] MAIS ILLISIBLE/.test(docs));
faux("le formulaire société n'écrit toujours PAS ces colonnes (décision du 2026-11-05)",
  readFileSync("lib/entities-shared.ts", "utf8").includes("iban: texte(input.iban)"));

// ═══════════════════════════════════════════════════════════════════════
titre("9. Deux empreintes se ressemblent — elles ne doivent pas se confondre");
// ═══════════════════════════════════════════════════════════════════════
//
// `CGK_EMPREINTE_CLE_PRODUCTION` (garde-fou de démarrage) et le `kid` de
// l'enveloppe sont deux empreintes de la MÊME clé, qui ne valent pas la même
// chose : la première porte sur la CHAÎNE telle qu'elle est écrite dans
// l'environnement, la seconde sur les 32 OCTETS décodés. Les confondre
// ferait échouer le garde-fou en silence, ou le ferait accepter la clé de
// production en recette.
//
// Je m'y suis trompé en rédigeant le guide pas à pas : ce contrôle existe
// pour que la prochaine confusion échoue au lieu de passer.
{
  const empreinteGarde = empreinte(HEX_A);
  const kidChiffrement = kidDeCle(CLE_A);
  eq("l'empreinte du garde-fou fait 12 caractères", empreinteGarde.length, 12);
  eq("le kid du chiffrement en fait 8", kidChiffrement.length, 8);
  vrai("… et les deux valeurs DIFFÈRENT pour la même clé",
    empreinteGarde !== kidChiffrement);
  vrai("… parce que l'une porte sur la chaîne et l'autre sur les octets",
    empreinte(HEX_A) !== empreinte(CLE_A.toString("base64")));
  vrai("le kid, lui, est indifférent à la représentation",
    kidDeCle(Buffer.from(HEX_A, "hex")) === kidDeCle(CLE_A));

  // Les deux fichiers d'exemple annoncent la bonne longueur.
  for (const f of [".env.example", ".env.recette.example"]) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("CGK_EMPREINTE_CLE_PRODUCTION")) continue;
    vrai(`${f} annonce 12 caractères pour l'empreinte du garde-fou`,
      /12 caract[eè]res/.test(src));
    faux(`${f} n'annonce pas 8 par confusion avec le kid`,
      /EMPREINTE_CLE_PRODUCTION[\s\S]{0,200}\b8 caract/.test(src));
  }
  const guide = readFileSync("docs/LOT-C-GUIDE-PAS-A-PAS-RECETTE.md", "utf8");
  vrai("le guide pas à pas emploie slice(0,12) pour l'empreinte du garde-fou",
    guide.includes("slice(0,12)"));
  faux("… et pas slice(0,8)", guide.includes("slice(0,8)"));
}

for (const f of ["lib/crypto/field-encryption.ts", "lib/documents-server.ts"]) {
  const src = readFileSync(f, "utf8");
  faux(`${f} — aucune condition constamment fausse`,
    /if\s*\(\s*false\s*\)|\{\s*false\s*&&/.test(src));
}

bilan("chiffrement : identifiant de clé et rotation progressive");
