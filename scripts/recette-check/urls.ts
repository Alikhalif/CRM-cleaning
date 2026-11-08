// Les cinq points de génération d'URL publiques.
//
// Demande du §4 : « Teste les cinq points de génération d'URL identifiés. »
// Les voici, et c'est l'inventaire qui a permis de trouver la vraie fuite :
//
//   1. app/(app)/_shared/signature-actions.ts  → lien /sign/{token}
//   2. app/api/devis/envoyer/route.ts          → lien /devis-signer/{token}
//   3. lib/devis/sign.ts                       → bannière de l'e-mail signé
//   4. lib/cert-hotte/send.ts                  → bannière du certificat
//   5. lib/devis/sender.ts  domainForSector()  → base par SECTEUR
//
// Le 5 était le plus grave : ses domaines sont des constantes de PRODUCTION
// (`https://devis.optimivv-nettoyage.com`), et c'est lui qui alimente le 2.
// Hors production, le devis de recette partait donc avec un lien de signature
// vers le site réel — une fuite par le LIEN, qu'aucune isolation de base
// n'arrête.

import { readFileSync } from "node:fs";
import {
  DOMAINES_PRODUCTION,
  domainesAutorises,
  hoteAutorise,
  resoudreBase,
  verifierLienPublic,
} from "@/lib/urls/base-publique";
import { eq, faux, titre, vrai, bilan } from "./commun";

// ═══════════════════════════════════════════════════════════════════════
titre("1. La liste blanche de domaines");
// ═══════════════════════════════════════════════════════════════════════

eq(
  "en production, un défaut existe pour ne rien casser",
  domainesAutorises(undefined, "production"),
  DOMAINES_PRODUCTION,
);
eq("en recette, AUCUN défaut : la déclaration est obligatoire", domainesAutorises(undefined, "recette"), []);
eq("en développement non plus", domainesAutorises(undefined, "developpement"), []);
eq(
  "la déclaration remplace le défaut, même en production",
  domainesAutorises("localhost:3000", "production"),
  ["localhost:3000"],
);
eq("les doublons sont réduits", domainesAutorises("a.fr, a.fr ,A.FR", "recette"), ["a.fr"]);
vrai("la comparaison d'hôte ignore la casse", hoteAutorise("LOCALHOST:3000", ["localhost:3000"]));
faux("un hôte absent n'est pas autorisé", hoteAutorise("ailleurs.fr", ["localhost:3000"]));

// ═══════════════════════════════════════════════════════════════════════
titre("2. Hors production, AUCUN repli vers la production");
// ═══════════════════════════════════════════════════════════════════════

for (const mode of ["recette", "developpement"] as const) {
  const r = resoudreBase({ mode, domainesPublics: "localhost:3000" });
  faux(`${mode} : rien de configuré, aucun en-tête → REFUS`, r.ok);
  if (!r.ok) {
    eq(`${mode} : code nommé`, r.code, "configuration_absente");
    vrai(`${mode} : le message dit quoi poser`, r.raison.includes("SIGNATURE_BASE_URL"));
    faux(`${mode} : aucun domaine de production dans le refus`, r.raison.includes("crmoptimum"));
  }
}

const enProd = resoudreBase({ mode: "production" });
vrai("production : le repli subsiste — les parcours existants continuent", enProd.ok);
if (enProd.ok) {
  eq("… et il est identifié comme tel", enProd.source, "repli_production");
  eq("… sur le premier domaine autorisé", enProd.base, "https://crmoptimum.com");
}

// ═══════════════════════════════════════════════════════════════════════
titre("3. La configuration est validée, pas crue");
// ═══════════════════════════════════════════════════════════════════════

const bonne = resoudreBase({
  mode: "recette",
  signatureBaseUrl: "http://localhost:3000",
  domainesPublics: "localhost:3000",
});
vrai("une URL configurée et autorisée passe", bonne.ok);
if (bonne.ok) {
  eq("… source « configuration »", bonne.source, "configuration");
  eq("… sans barre oblique finale", bonne.base, "http://localhost:3000");
}
eq(
  "la barre oblique finale est retirée",
  (() => {
    const r = resoudreBase({
      mode: "recette",
      signatureBaseUrl: "http://localhost:3000///",
      domainesPublics: "localhost:3000",
    });
    return r.ok ? r.base : "refus";
  })(),
  "http://localhost:3000",
);

const horsListe = resoudreBase({
  mode: "recette",
  signatureBaseUrl: "https://crmoptimum.com",
  domainesPublics: "localhost:3000",
});
faux("une URL de PRODUCTION non autorisée est refusée", horsListe.ok);
if (!horsListe.ok) eq("… code nommé", horsListe.code, "url_hors_liste");

for (const mauvaise of ["pas-une-url", "localhost:3000", "ftp://x.fr", "//x.fr"]) {
  const r = resoudreBase({ mode: "recette", signatureBaseUrl: mauvaise, domainesPublics: "x.fr" });
  faux(`« ${mauvaise} » n'est pas une URL absolue http(s) acceptable`, r.ok);
}
vrai(
  "sans liste blanche déclarée, même une URL correcte est refusée",
  !resoudreBase({ mode: "recette", signatureBaseUrl: "http://localhost:3000" }).ok,
);

// ═══════════════════════════════════════════════════════════════════════
titre("4. L'en-tête de requête est une donnée NON FIABLE");
// ═══════════════════════════════════════════════════════════════════════

const enteteOk = resoudreBase({
  mode: "recette",
  domainesPublics: "localhost:3000",
  hoteEntete: "localhost:3000",
});
vrai("un en-tête sur la liste blanche est accepté", enteteOk.ok);
if (enteteOk.ok) {
  eq("… et identifié comme validé", enteteOk.source, "entete_validee");
  eq("… en http pour localhost", enteteOk.base, "http://localhost:3000");
}

const enteteForge = resoudreBase({
  mode: "recette",
  domainesPublics: "localhost:3000",
  hoteEntete: "attaquant.example",
});
faux("un en-tête forgé est REFUSÉ", enteteForge.ok);
if (!enteteForge.ok) {
  eq("… code nommé", enteteForge.code, "entete_hors_liste");
  vrai(
    "… et le refus explique pourquoi un en-tête ne se croit pas",
    enteteForge.raison.includes("fourni par l'appelant"),
  );
}
faux(
  "un en-tête forgé est refusé même en PRODUCTION",
  resoudreBase({ mode: "production", hoteEntete: "attaquant.example" }).ok === true &&
    resoudreBase({ mode: "production", hoteEntete: "attaquant.example" }).ok,
);
vrai(
  "le protocole annoncé est repris quand il est fourni",
  (() => {
    const r = resoudreBase({
      mode: "recette",
      domainesPublics: "recette.exemple.fr",
      hoteEntete: "recette.exemple.fr",
      protoEntete: "https",
    });
    return r.ok && r.base === "https://recette.exemple.fr";
  })(),
);
vrai(
  "la configuration PRIME sur l'en-tête",
  (() => {
    const r = resoudreBase({
      mode: "recette",
      signatureBaseUrl: "http://localhost:3000",
      domainesPublics: "localhost:3000,autre.fr",
      hoteEntete: "autre.fr",
    });
    return r.ok && r.base === "http://localhost:3000";
  })(),
);

// ═══════════════════════════════════════════════════════════════════════
titre("5. Le lien final est vérifié avant émission");
// ═══════════════════════════════════════════════════════════════════════

vrai(
  "un lien local passe en recette",
  verifierLienPublic("http://localhost:3000/sign/abc", "localhost:3000", "recette").ok,
);
faux(
  "un lien vers la production est refusé en recette",
  verifierLienPublic("https://crmoptimum.com/sign/abc", "localhost:3000", "recette").ok,
);
faux(
  "un lien vers un domaine OPTIMIVV est refusé en recette",
  verifierLienPublic(
    "https://devis.optimivv-nettoyage.com/devis-signer/abc",
    "localhost:3000",
    "recette",
  ).ok,
);
faux(
  "un lien non analysable est refusé",
  verifierLienPublic("pas-un-lien", "localhost:3000", "recette").ok,
);
faux(
  "sans liste blanche, aucun lien ne passe",
  verifierLienPublic("http://localhost:3000/sign/a", undefined, "recette").ok,
);
vrai(
  "en production, le lien de production passe",
  verifierLienPublic("https://crmoptimum.com/sign/abc", undefined, "production").ok,
);

// ═══════════════════════════════════════════════════════════════════════
titre("6. Les cinq points ne portent plus de domaine de production en dur");
// ═══════════════════════════════════════════════════════════════════════

const POINTS = [
  "app/(app)/_shared/signature-actions.ts",
  "app/api/devis/envoyer/route.ts",
  "lib/devis/sign.ts",
  "lib/cert-hotte/send.ts",
];
for (const f of POINTS) {
  const src = readFileSync(f, "utf8");
  faux(`${f} — plus de repli « crmoptimum.com » en dur`, /\|\|\s*"https:\/\/crmoptimum\.com"/.test(src));
  vrai(`${f} — passe par le résolveur`, src.includes("base-publique-server"));
}

// Les deux points qui produisent un LIEN CLIENT doivent refuser explicitement.
const actions = readFileSync("app/(app)/_shared/signature-actions.ts", "utf8");
vrai("signature-actions : refus explicite si aucune base", actions.includes("Lien de signature impossible"));
vrai("signature-actions : vérifie le lien final", actions.includes("verifierLien("));
vrai(
  "signature-actions : résout AVANT de créer la demande (pas de demande orpheline)",
  actions.indexOf("baseUrlPublique()") < actions.indexOf("createSignatureRequest("),
);
faux("signature-actions : n'utilise plus l'en-tête brut", actions.includes('h.get("host")'));

const envoyer = readFileSync("app/api/devis/envoyer/route.ts", "utf8");
vrai("api/devis/envoyer : refus explicite si aucune base", envoyer.includes("Lien client impossible"));
vrai("api/devis/envoyer : vérifie le lien de signature", envoyer.includes("verifierLien(signUrl)"));
faux("api/devis/envoyer : n'utilise plus l'en-tête brut", envoyer.includes('h.get("host")'));

// Le point 5, la vraie fuite.
const sender = readFileSync("lib/devis/sender.ts", "utf8");
vrai("domainForSector connaît le mode", sender.includes("modeCourant()"));
vrai(
  "… et ne rend son domaine en dur QU'EN production",
  /modeCourant\(\)\s*!==\s*"production"\)\s*return null/.test(sender),
);
vrai(
  "… tout en respectant une surcharge explicite par variable d'environnement",
  sender.includes("if (surcharge && surcharge.trim()) return clean(surcharge.trim())"),
);
vrai(
  "la surcharge est lue AVANT la bascule de mode",
  sender.indexOf("const surcharge") < sender.indexOf('modeCourant() !== "production"'),
);

for (const f of ["lib/urls/base-publique.ts", "lib/devis/sender.ts"]) {
  const src = readFileSync(f, "utf8");
  faux(`${f} — aucune condition constamment fausse`, /if\s*\(\s*false\s*\)|\{\s*false\s*&&/.test(src));
}

bilan("URL publiques et liens de signature");
