// Les configurations dangereuses sont-elles REFUSÉES ?
//
// C'est la demande du §5 : « Les tests doivent prouver que les configurations
// dangereuses sont rejetées. » Un garde-fou dont on n'a jamais vu le refus
// n'est pas un garde-fou, c'est une intention.
//
// La décision vit dans `lib/env/cible.ts`, qui est PUR : on peut donc lui
// soumettre vingt configurations sans fabriquer aucune variable
// d'environnement, et sans qu'aucune ne touche quoi que ce soit.

import { readFileSync } from "node:fs";
import {
  type Config,
  empreinte,
  evaluerCible,
  modeEffectif,
  rapporter,
} from "@/lib/env/cible";
import { eq, faux, titre, vrai, bilan } from "./commun";

const PROD = "https://ggdafbqahvugmzixovik.supabase.co";
const RECETTE = "https://recette-fictive.supabase.co";

/** Configuration de recette SAINE : tout le reste en dérive. */
function saine(): Config {
  return {
    cgkEnv: "recette",
    nodeEnv: "development",
    supabaseUrl: RECETTE,
    supabaseUrlProduction: PROD,
    signatureBaseUrl: "http://localhost:3000",
    domainesPublics: "localhost:3000",
    fieldEncryptionKey: "cle-de-recette-distincte-0123456789abcdef",
    empreinteCleProduction: empreinte("la-vraie-cle-de-production"),
    cronSecret: "secret-de-recette",
  };
}

function codes(c: Config): string[] {
  return evaluerCible(c).griefs.map((g) => g.code);
}

function bloque(c: Config): boolean {
  return !evaluerCible(c).ok;
}

// ═══════════════════════════════════════════════════════════════════════
titre("1. Le mode n'est jamais deviné");
// ═══════════════════════════════════════════════════════════════════════

eq("CGK_ENV=recette est respecté", modeEffectif({ cgkEnv: "recette" }), "recette");
eq("CGK_ENV=production est respecté", modeEffectif({ cgkEnv: "production" }), "production");
eq("la casse et les espaces sont tolérés", modeEffectif({ cgkEnv: "  RECETTE " }), "recette");
eq(
  "sans CGK_ENV, NODE_ENV=production donne production",
  modeEffectif({ nodeEnv: "production" }),
  "production",
);
eq(
  "sans rien, on est en développement — JAMAIS en production par défaut",
  modeEffectif({}),
  "developpement",
);
eq(
  "une valeur inconnue ne devient pas production",
  modeEffectif({ cgkEnv: "prod2", nodeEnv: "development" }),
  "developpement",
);
vrai(
  "… et elle est signalée, pas avalée en silence",
  codes({ ...saine(), cgkEnv: "prod2" }).includes("mode_inconnu"),
);

// ═══════════════════════════════════════════════════════════════════════
titre("2. Une configuration de recette saine est acceptée");
// ═══════════════════════════════════════════════════════════════════════

const verdictSain = evaluerCible(saine());
vrai("la configuration saine passe", verdictSain.ok, codes(saine()).join(", "));
eq("… et son mode est bien recette", verdictSain.mode, "recette");
faux(
  "aucun grief bloquant",
  verdictSain.griefs.some((g) => g.gravite === "bloquant"),
);

// ═══════════════════════════════════════════════════════════════════════
titre("3. La base de PRODUCTION est refusée hors production");
// ═══════════════════════════════════════════════════════════════════════

vrai("recette visant la base de production → REFUS", bloque({ ...saine(), supabaseUrl: PROD }));
vrai(
  "… et le grief nomme la cause",
  codes({ ...saine(), supabaseUrl: PROD }).includes("base_production"),
);
vrai(
  "une base absente est refusée (on ne devine pas la cible)",
  codes({ ...saine(), supabaseUrl: undefined }).includes("base_absente"),
);
vrai(
  "une base illisible est refusée",
  codes({ ...saine(), supabaseUrl: "pas-une-url" }).includes("base_illisible"),
);
vrai(
  "sans production déclarée, on AVERTIT (impossible de comparer)",
  codes({ ...saine(), supabaseUrlProduction: undefined }).includes("production_non_declaree"),
);

// ═══════════════════════════════════════════════════════════════════════
titre("4. Les DEUX transports d'e-mail sont refusés — aucun contournement");
// ═══════════════════════════════════════════════════════════════════════

vrai("Brevo configuré en recette → REFUS", bloque({ ...saine(), brevoApiKey: "cle" }));
vrai(
  "… grief nommé",
  codes({ ...saine(), brevoApiKey: "cle" }).includes("brevo_actif"),
);
// Le cœur de l'anomalie E4 : retirer Brevo ne suffit pas, le repli SMTP prend
// le relais. Si ce contrôle tombait, le plan d'isolation redeviendrait faux.
vrai("SMTP configuré SANS Brevo → REFUS quand même", bloque({ ...saine(), smtpHost: "smtp.x.com" }));
vrai(
  "… grief nommé",
  codes({ ...saine(), smtpHost: "smtp.x.com" }).includes("smtp_actif"),
);
vrai("SMTP_USER seul suffit à déclencher le refus", bloque({ ...saine(), smtpUser: "u@x.com" }));
vrai(
  "forcer le transport SMTP → REFUS",
  codes({ ...saine(), devisEmailTransport: "smtp" }).includes("transport_force_smtp"),
);
vrai(
  "les deux transages ensemble → deux griefs",
  codes({ ...saine(), brevoApiKey: "k", smtpHost: "s" }).filter((c) =>
    ["brevo_actif", "smtp_actif"].includes(c),
  ).length === 2,
);

// ═══════════════════════════════════════════════════════════════════════
titre("5. L'autorisation d'envoi réel exige une liste blanche");
// ═══════════════════════════════════════════════════════════════════════

vrai(
  "CGK_ENVOI_REEL=oui sans liste blanche → REFUS",
  codes({ ...saine(), brevoApiKey: "k", envoiReelAutorise: "oui" }).includes(
    "envoi_sans_liste_blanche",
  ),
);
vrai(
  "avec liste blanche, Brevo devient acceptable",
  evaluerCible({
    ...saine(),
    brevoApiKey: "k",
    envoiReelAutorise: "oui",
    destinatairesAutorises: "moi@exemple.fr",
  }).ok,
);
vrai(
  "« OUI » en majuscules fonctionne aussi",
  evaluerCible({
    ...saine(),
    brevoApiKey: "k",
    envoiReelAutorise: "OUI",
    destinatairesAutorises: "moi@exemple.fr",
  }).ok,
);
vrai(
  "toute autre valeur que « oui » ne vaut pas autorisation",
  bloque({ ...saine(), brevoApiKey: "k", envoiReelAutorise: "true" }),
);

// ═══════════════════════════════════════════════════════════════════════
titre("6. Téléphonie et signature électronique");
// ═══════════════════════════════════════════════════════════════════════

vrai("Ringover configuré en recette → REFUS", bloque({ ...saine(), ringoverApiKey: "k" }));
vrai(
  "DocuSign en PRODUCTION hors production → REFUS",
  codes({ ...saine(), docusignClientId: "id", docusignEnv: "production" }).includes(
    "docusign_production",
  ),
);
vrai(
  "DocuSign en demo → simple avertissement, pas un blocage",
  evaluerCible({ ...saine(), docusignClientId: "id", docusignEnv: "demo" }).ok,
);

// ═══════════════════════════════════════════════════════════════════════
titre("7. L'URL de signature");
// ═══════════════════════════════════════════════════════════════════════

vrai(
  "recette sans SIGNATURE_BASE_URL → REFUS",
  codes({ ...saine(), signatureBaseUrl: undefined }).includes("url_signature_absente"),
);
vrai(
  "URL de signature pointant sur la production → REFUS",
  bloque({
    ...saine(),
    signatureBaseUrl: PROD,
    domainesPublics: "ggdafbqahvugmzixovik.supabase.co",
  }),
);
vrai(
  "hôte hors de la liste blanche → REFUS",
  codes({ ...saine(), signatureBaseUrl: "https://ailleurs.example" }).includes(
    "url_signature_hors_liste",
  ),
);
vrai(
  "liste blanche non déclarée → REFUS",
  codes({ ...saine(), domainesPublics: undefined }).includes("domaines_non_declares"),
);

// ═══════════════════════════════════════════════════════════════════════
titre("8. La clé de production est détectée SANS être stockée");
// ═══════════════════════════════════════════════════════════════════════

const CLE_PROD = "ceci-est-la-cle-de-production";
vrai(
  "la clé de production en recette → REFUS",
  codes({
    ...saine(),
    fieldEncryptionKey: CLE_PROD,
    empreinteCleProduction: empreinte(CLE_PROD),
  }).includes("cle_production_detectee"),
);
vrai(
  "une autre clé passe",
  evaluerCible({
    ...saine(),
    fieldEncryptionKey: "une-autre-cle-entierement",
    empreinteCleProduction: empreinte(CLE_PROD),
  }).ok,
);
eq("l'empreinte est stable", empreinte(CLE_PROD), empreinte(CLE_PROD));
vrai("l'empreinte fait 12 caractères", empreinte(CLE_PROD).length === 12);
vrai(
  "l'empreinte ne contient pas le secret",
  !empreinte(CLE_PROD).includes("production") && !CLE_PROD.includes(empreinte(CLE_PROD)),
);
vrai(
  "deux secrets différents ont deux empreintes différentes",
  empreinte("a") !== empreinte("b"),
);

// ═══════════════════════════════════════════════════════════════════════
titre("9. La PRODUCTION n'est jamais bloquée — non-régression");
// ═══════════════════════════════════════════════════════════════════════
//
// La production tourne aujourd'hui sans aucune de ces variables. Un garde-fou
// qui l'empêcherait de démarrer serait une panne que personne n'a demandée.
// Ces assertions sont la promesse que ce module ne peut pas la provoquer.

const pireEnProduction: Config = {
  cgkEnv: "production",
  nodeEnv: "production",
  supabaseUrl: PROD,
  brevoApiKey: "cle-reelle",
  smtpHost: "smtp.hostinger.com",
  smtpUser: "u",
  devisEmailTransport: "smtp",
  ringoverApiKey: "cle-reelle",
  docusignClientId: "id",
  docusignEnv: "production",
  fieldEncryptionKey: CLE_PROD,
  empreinteCleProduction: empreinte(CLE_PROD),
};
const vProd = evaluerCible(pireEnProduction);
vrai("la production la plus « chargée » n'est PAS bloquée", vProd.ok);
faux(
  "aucun grief bloquant en production",
  vProd.griefs.some((g) => g.gravite === "bloquant"),
);
vrai(
  "mais les griefs restent visibles en avertissements",
  vProd.griefs.length > 0,
);
vrai(
  "la production sans aucune variable démarre aussi",
  evaluerCible({ cgkEnv: "production", nodeEnv: "production", supabaseUrl: PROD }).ok,
);

// ═══════════════════════════════════════════════════════════════════════
titre("10. Le rapport ne divulgue aucun secret");
// ═══════════════════════════════════════════════════════════════════════

const confSecrete: Config = {
  ...saine(),
  brevoApiKey: "xkeysib-SECRET-BREVO-NE-DOIT-PAS-SORTIR",
  ringoverApiKey: "RINGOVER-SECRET-NE-DOIT-PAS-SORTIR",
  fieldEncryptionKey: "CLE-SECRETE-NE-DOIT-PAS-SORTIR",
  cronSecret: "CRON-SECRET-NE-DOIT-PAS-SORTIR",
};
const texteRapport = rapporter(evaluerCible(confSecrete), confSecrete).join("\n");
for (const secret of [
  "xkeysib-SECRET-BREVO-NE-DOIT-PAS-SORTIR",
  "RINGOVER-SECRET-NE-DOIT-PAS-SORTIR",
  "CLE-SECRETE-NE-DOIT-PAS-SORTIR",
  "CRON-SECRET-NE-DOIT-PAS-SORTIR",
]) {
  faux(`le rapport ne contient pas « ${secret.slice(0, 18)}… »`, texteRapport.includes(secret));
}
vrai("le rapport dit quand même l'état « CONFIGURÉ »", texteRapport.includes("CONFIGURÉ"));
vrai("le rapport nomme le mode", texteRapport.includes("Mode"));
vrai("le rapport conclut par un verdict", texteRapport.includes("VERDICT"));

// ═══════════════════════════════════════════════════════════════════════
titre("11. Le garde-fou est bien branché au démarrage");
// ═══════════════════════════════════════════════════════════════════════

const instr = readFileSync("instrumentation.ts", "utf8");
vrai("instrumentation.ts existe et exporte register()", instr.includes("export async function register"));
vrai("… et appelle la vérification", instr.includes("verifierAuDemarrage"));
vrai(
  "… en se limitant au runtime Node (node:crypto n'existe pas sur Edge)",
  instr.includes('NEXT_RUNTIME !== "nodejs"'),
);

const garde = readFileSync("lib/env/garde-demarrage.ts", "utf8");
vrai("le garde-fou lève quand le verdict refuse", garde.includes("throw new Error"));
vrai(
  "… et nomme chaque cause dans le message",
  garde.includes("bloquants(verdict)"),
);
vrai(
  "… en disant qu'aucune donnée n'a été touchée",
  garde.includes("Aucune donnée n'a été touchée"),
);

// Garde générale contre la condition morte : un `if (false)` neutralise un
// comportement sans retirer la ligne qu'un contrôle textuel cherche. Ce piège
// a déjà fait passer quatre mutations sur vingt au Lot E.
for (const f of [
  "lib/env/cible.ts",
  "lib/env/mode.ts",
  "lib/env/garde-demarrage.ts",
  "lib/envoi/decision.ts",
  "lib/envoi/garde-server.ts",
  "lib/urls/base-publique.ts",
  "lib/urls/base-publique-server.ts",
]) {
  const src = readFileSync(f, "utf8");
  faux(`${f} — aucune condition constamment fausse`, /if\s*\(\s*false\s*\)|\{\s*false\s*&&/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════
titre("12. Toute variable lue par le code est documentée");
// ═══════════════════════════════════════════════════════════════════════
//
// C'est le contrôle qui empêche l'anomalie D9 de se réouvrir. Le code lisait
// 56 variables, `.env.example` en documentait 21 — et parmi les absentes, les
// six d'un second transport d'e-mail. Un plan d'isolation bâti sur cette
// documentation héritait de ses trous ; c'est arrivé.
//
// ⚠️ Les accès DYNAMIQUES (`process.env[nom]`) sont invisibles à une recherche
// textuelle : c'est par là que les domaines par secteur avaient échappé au
// premier inventaire. Les noms concernés sont déclarés dans des tables du
// code, et cherchés ici en plus du motif direct.

const exemple = readFileSync(".env.example", "utf8");
const documentees = new Set(
  [...exemple.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]),
);

const SOURCES = [
  "lib/brevo.ts",
  "lib/devis/email.ts",
  "lib/devis/sender.ts",
  "lib/devis/sign.ts",
  "lib/cert-hotte/send.ts",
  "lib/env/garde-demarrage.ts",
  "lib/envoi/garde-server.ts",
  "lib/urls/base-publique-server.ts",
  "lib/docusign/config.ts",
  "lib/crypto/field-encryption.ts",
  "lib/documents-server.ts",
  "app/api/presence/evaluate/route.ts",
  "app/api/devis/envoyer/route.ts",
];

const lues = new Set<string>();
for (const f of SOURCES) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) lues.add(m[1]);
  // Accès dynamiques : les noms sont déclarés dans des tables du code.
  for (const m of src.matchAll(/env[A-Za-z]*: "([A-Z0-9_]+)"/g)) lues.add(m[1]);
  for (const m of src.matchAll(/lire\("([A-Z0-9_]+)"\)/g)) lues.add(m[1]);
}
// `NODE_ENV` et `NEXT_RUNTIME` viennent de Node et de Next, pas du projet.
lues.delete("NODE_ENV");
lues.delete("NEXT_RUNTIME");

const absentes = [...lues].filter((v) => !documentees.has(v)).sort();
vrai(
  `les ${lues.size} variables lues par les ${SOURCES.length} fichiers sensibles sont documentées`,
  absentes.length === 0,
  absentes.join(", "),
);
vrai(
  "… et le fichier documente les DEUX transports d'e-mail",
  ["BREVO_API_KEY", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "DEVIS_EMAIL_TRANSPORT"].every((v) =>
    documentees.has(v),
  ),
);
vrai(
  "… ainsi que les domaines par secteur, invisibles à une recherche directe",
  ["DEVIS_BASE_URL_NETTOYAGE", "DEVIS_BASE_URL_DEMENAGEMENT"].every((v) => documentees.has(v)),
);
vrai(
  "… et les variables du garde-fou lui-même",
  ["CGK_ENV", "CGK_DOMAINES_PUBLICS", "CGK_ENVOI_REEL", "CGK_DESTINATAIRES_AUTORISES"].every((v) =>
    documentees.has(v),
  ),
);

// Aucun secret réel ne doit figurer dans un fichier suivi par Git.
for (const [motif, nom] of [
  [/^[A-Z0-9_]+=\S+/m, "une valeur renseignée"],
  [/xkeysib-[A-Za-z0-9]/, "une clé Brevo"],
  [/eyJ[A-Za-z0-9_-]{20,}/, "un jeton JWT"],
] as [RegExp, string][]) {
  faux(`.env.example ne contient pas ${nom}`, motif.test(exemple));
}

bilan("refus des configurations dangereuses");
