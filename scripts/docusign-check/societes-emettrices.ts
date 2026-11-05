// Sociétés émettrices — validation et charge utile d'écriture.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// Bug de production du 2026-11-05 :
//
//   TypeError: Cannot read properties of null (reading 'replace')
//   Digest: 622936275
//
// Cause : `EntityRow` (lib/documents-server.ts) déclarait `ape_code`,
// `vat_number`, `iban`, `bic` et `color` comme des `string` alors que les cinq
// colonnes sont NULLABLES en base. Le compilateur, à qui on avait menti,
// n'exigeait aucune garde ; un `null` traversait `mapEntity`, puis le type
// `LegalEntity` qui promet `string`, puis le formulaire, et explosait sur
// `input.iban.replace(...)`. Cinq sociétés sur sept étaient concernées.
//
// Ces assertions vérifient que `validate()` et `buildPayload()` survivent à
// `null`, `undefined` et chaîne vide sur CHAQUE champ texte — et qu'ils
// continuent de produire les bonnes valeurs sur des données valides.
//
// Les tests passent volontairement des valeurs interdites par le typage (via
// un cast) : c'est précisément ce que faisait la production.

import {
  buildPayload,
  sansEspaces,
  texte,
  validate,
  type EntityInput,
} from "@/lib/entities-shared";
import { COUNTRIES, IDENTIFIANT_LEGAL } from "@/lib/leads";

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
/** N'explose pas : la seule chose qui comptait vraiment le 2026-11-05. */
function neJettePas(nom: string, fn: () => unknown) {
  try {
    fn();
    console.log(`  ok    ${nom}`);
  } catch (e) {
    console.log(`  ECHEC ${nom} — ${e instanceof Error ? e.message : String(e)}`);
    ko++;
  }
}

/** Fiche valide et complète : le cas nominal. */
const VALIDE: EntityInput = {
  legalName: "OPTIMIVV NETTOYAGE",
  legalForm: "SAS",
  siret: "92808342700023",
  apeCode: "8121Z",
  vatNumber: "FR26928083427",
  addressLine: "2 RUE ALFRED BRUNEAU",
  postalCode: "75016",
  city: "PARIS",
  contactEmail: "devispro@optimivv-nettoyage.com",
  contactPhone: "0756888275",
  defaultVatRate: 20,
  legalMentions: "",
  color: "#5b4bcc",
  representativeName: "M. Untel",
  representativeTitle: "Président",
  representativeCompanyName: "",
  country: "FR",
  siren: "928083427",
};

// Champs texte de `EntityInput`. Chacun doit survivre à null et undefined.
const CHAMPS_TEXTE = [
  "legalName", "siret", "apeCode", "vatNumber", "addressLine", "postalCode",
  "city", "contactEmail", "contactPhone", "legalMentions", "color",
  "representativeName", "representativeTitle", "representativeCompanyName",
  "siren",
] as const;

console.log("== Les lecteurs sûrs ==");
eq("texte(null)", texte(null), "");
eq("texte(undefined)", texte(undefined), "");
eq("texte('')", texte(""), "");
eq("texte('  x  ')", texte("  x  "), "x");
eq("texte(42)", texte(42 as unknown), "");
eq("texte({})", texte({} as unknown), "");
eq("sansEspaces(null)", sansEspaces(null), "");
eq("sansEspaces(' 928 083 427 ')", sansEspaces(" 928 083 427 "), "928083427");

console.log("\n== LE BUG : un champ null ne doit plus jamais faire exploser ==");
for (const champ of CHAMPS_TEXTE) {
  for (const valeur of [null, undefined]) {
    const entree = { ...VALIDE, [champ]: valeur } as unknown as EntityInput;
    neJettePas(`validate() survit à ${champ} = ${String(valeur)}`, () => validate(entree));
    neJettePas(`buildPayload() survit à ${champ} = ${String(valeur)}`, () => buildPayload(entree));
  }
}

console.log("\n== Le cas exact de la production : iban/bic nuls, les 5 sociétés ==");
// Les champs IBAN/BIC ont été retirés du formulaire, mais une charge utile
// ancienne ou un appel direct peut encore les porter. Ils ne doivent pas
// davantage casser.
const avecIbanNul = { ...VALIDE, iban: null, bic: null } as unknown as EntityInput;
neJettePas("validate() ignore iban/bic nuls", () => validate(avecIbanNul));
neJettePas("buildPayload() ignore iban/bic nuls", () => buildPayload(avecIbanNul));
const charge = buildPayload(avecIbanNul);
vrai("iban n'est PAS écrit (colonne préservée)", !("iban" in charge));
vrai("bic n'est PAS écrit (colonne préservée)", !("bic" in charge));

console.log("\n== Tout null d'un coup : le pire des cas ==");
const toutNul = Object.fromEntries(
  CHAMPS_TEXTE.map((c) => [c, null]),
) as unknown as EntityInput;
const pire = { ...toutNul, legalForm: "SAS", country: "FR", defaultVatRate: null } as unknown as EntityInput;
neJettePas("validate() survit", () => validate(pire));
neJettePas("buildPayload() survit", () => buildPayload(pire));
// Et il REFUSE, plutôt que d'enregistrer une fiche vide.
vrai("validate() refuse une fiche entièrement vide", validate(pire) !== null);
eq("le motif est la raison sociale", validate(pire), "Raison sociale requise.");

console.log("\n== Données valides : le comportement ne change pas ==");
eq("validate() accepte la fiche valide", validate(VALIDE), null);
const p = buildPayload(VALIDE);
eq("legal_name", p.legal_name, "OPTIMIVV NETTOYAGE");
eq("siret sans espaces", p.siret, "92808342700023");
eq("siren sans espaces", p.siren, "928083427");
eq("ape_code", p.ape_code, "8121Z");
eq("vat_number", p.vat_number, "FR26928083427");
eq("country", p.country, "FR");
eq("tva", p.default_vat_rate, 20);
eq("representant", p.representative_name, "M. Untel");
eq("qualite", p.representative_title, "Président");
// Vide → null, pas chaîne vide : c'est ce que `controlerEntite()` teste.
eq("societe representante vide → null", p.representative_company_name, null);
eq("mentions vides → null", p.legal_mentions, null);

console.log("\n== Espaces : un SIRET saisi avec des espaces reste valide ==");
eq("SIRET espacé accepté",
  validate({ ...VALIDE, siret: "928 083 427 000 23" }), null);
eq("et normalisé à l'écriture",
  buildPayload({ ...VALIDE, siret: "928 083 427 000 23" }).siret, "92808342700023");

console.log("\n== Règles par pays : préservées ==");
// FRANCE : SIRET de 14 chiffres exigé.
vrai("FR sans SIRET → refus", validate({ ...VALIDE, siret: "" }) !== null);
vrai("FR avec SIRET de 13 chiffres → refus",
  validate({ ...VALIDE, siret: "1234567890123" }) !== null);
vrai("FR : le message nomme le SIRET",
  (validate({ ...VALIDE, siret: "" }) ?? "").includes("SIRET"));
// FR avec un SIRET nul : refus, PAS une exception.
neJettePas("FR avec SIRET null ne jette pas",
  () => validate({ ...VALIDE, siret: null } as unknown as EntityInput));
vrai("FR avec SIRET null → refus",
  validate({ ...VALIDE, siret: null } as unknown as EntityInput) !== null);

// HORS FRANCE : aucun SIRET exigé, mais un identifiant légal national oui.
for (const pays of COUNTRIES.filter((c) => c !== "FR")) {
  const base = { ...VALIDE, country: pays, siret: "", siren: "", vatNumber: "" };
  const refus = validate(base);
  vrai(`${pays} sans aucun identifiant → refus`, refus !== null);
  vrai(`${pays} : le message nomme « ${IDENTIFIANT_LEGAL[pays].label} »`,
    (refus ?? "").includes(IDENTIFIANT_LEGAL[pays].label));
  // L'un des trois suffit.
  eq(`${pays} avec l'identifiant national → accepté`,
    validate({ ...base, siren: "CHE-123.456.789" }), null);
  eq(`${pays} avec un n° de TVA seul → accepté`,
    validate({ ...base, vatNumber: "BE0123456789" }), null);
  // Et aucun SIRET français n'est imposé.
  vrai(`${pays} : le message ne réclame pas de SIRET`,
    !(refus ?? "").includes("14 chiffres"));
  // Robustesse : identifiants nuls hors de France.
  neJettePas(`${pays} avec identifiants nuls ne jette pas`,
    () => validate({ ...base, siren: null, vatNumber: null, siret: null } as unknown as EntityInput));
}

console.log("\n== Taux de TVA ==");
eq("20 accepté", validate({ ...VALIDE, defaultVatRate: 20 }), null);
eq("0 accepté", validate({ ...VALIDE, defaultVatRate: 0 }), null);
vrai("-1 refusé", validate({ ...VALIDE, defaultVatRate: -1 }) !== null);
vrai("101 refusé", validate({ ...VALIDE, defaultVatRate: 101 }) !== null);
// NaN et null ne doivent pas passer pour valides par accident.
vrai("NaN refusé", validate({ ...VALIDE, defaultVatRate: NaN }) !== null);
vrai("null refusé",
  validate({ ...VALIDE, defaultVatRate: null } as unknown as EntityInput) !== null);
eq("un taux illisible retombe sur 20 à l'écriture",
  buildPayload({ ...VALIDE, defaultVatRate: NaN }).default_vat_rate, 20);

console.log("\n== La couleur a toujours un repli ==");
eq("couleur vide → marque", buildPayload({ ...VALIDE, color: "" }).color, "#5b4bcc");
eq("couleur nulle → marque",
  buildPayload({ ...VALIDE, color: null } as unknown as EntityInput).color, "#5b4bcc");
eq("couleur fournie → conservée",
  buildPayload({ ...VALIDE, color: "#ff0000" }).color, "#ff0000");

console.log("\n== L'adresse accepte le vide sans jeter ==");
const sansAdresse = buildPayload({ ...VALIDE, addressLine: "", postalCode: "", city: "" });
eq("adresse entièrement nulle",
  sansAdresse.address, { line1: null, postal_code: null, city: null });
neJettePas("adresse avec des null",
  () => buildPayload({ ...VALIDE, addressLine: null, city: null } as unknown as EntityInput));

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
