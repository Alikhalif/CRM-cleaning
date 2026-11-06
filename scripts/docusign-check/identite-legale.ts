// IDENTITÉ LÉGALE DES PARTIES — un champ rempli n'est pas un champ renseigné.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// Constat du 2026-11-06 sur la base de production : cinq sociétés émettrices
// sur sept portaient `siret = "À renseigner"` et une adresse de siège
// identique. Ces valeurs ne sont pas vides, et `controlerEntite()` ne testait
// que le vide : elles PASSAIENT. Les deux seuls champs détectés comme
// manquants étaient le représentant légal et sa qualité — de sorte qu'en les
// renseignant, un contrat devenait émissible et sortait en identifiant son
// donneur d'ordre par « À renseigner ».
//
// Un contrat qui n'identifie pas ses parties n'est pas opposable. Le défaut
// était juridique, pas cosmétique, et il n'aurait été visible qu'au premier
// litige.
//
// Deux mesures sont gelées ici : la détection des valeurs de remplissage, et
// le contrôle de structure (clé de Luhn du SIREN et du SIRET).
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret. Les SIRET
// réels qui figurent ci-dessous sont des mentions légales publiques, imprimées
// sur chaque facture — ce ne sont pas des données confidentielles.
//
// (Ce fichier vit dans `docusign-check/` par continuité : le dossier porte
// déjà des suites qui n'ont rien de DocuSign — `generation-devis.ts`,
// `pipeline-resume.ts`, `accessibilite.ts`. Le renommer coûterait plus que
// l'inexactitude du nom.)

import {
  controlerAdressePostale,
  controlerEmail,
  controlerIdentifiantLegal,
  controlerNomPersonne,
  controlerSiren,
  controlerSiret,
  controlerTexteLegal,
  estValeurFictive,
  libelleAnomalie,
  luhnValide,
  normaliser,
} from "@/lib/identite-legale";
import {
  anomaliesPrestataireFiche,
  controlerEntite,
} from "@/lib/sous-traitance/contrats-shared";
import { IDENTIFIANT_LEGAL } from "@/lib/leads";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  console.log(ja === jb ? `  ok    ${nom}` : `  ECHEC ${nom}\n    obtenu  ${ja}\n    attendu ${jb}`);
  if (ja !== jb) ko++;
}
/** Refusé, et le motif dit bien pourquoi. */
function refuse(nom: string, v: { ok: boolean } & { motif?: string }, fragment?: string) {
  const bon = !v.ok && (!fragment || (v.motif ?? "").includes(fragment));
  console.log(bon ? `  ok    ${nom}` : `  ECHEC ${nom} — motif obtenu : ${JSON.stringify(v.motif ?? "(accepté)")}`);
  if (!bon) ko++;
}

console.log("\n1. Les valeurs de remplissage sont reconnues");

// Exactement celles qui sont en base aujourd'hui.
for (const v of ["À renseigner", "à renseigner", "A RENSEIGNER", "À renseigner.", "  à renseigner  "]) {
  vrai(`« ${v} » est fictive`, estValeurFictive(v));
}
for (const v of [
  "Non renseigné", "non communiqué", "N/A", "n/a", "NC", "néant", "Aucun",
  "inconnu", "TBD", "todo", "à compléter", "à définir", "sans objet", "S/O",
  "test", "DEMO", "exemple", "placeholder", "xxx", "XXXXXX", "---", "...",
  "0", "000", "?", "???", "idem", "voir ci-dessus", "null", "undefined",
]) {
  vrai(`« ${v} » est fictive`, estValeurFictive(v));
}

console.log("\n2. Et les valeurs réelles ne le sont PAS");

// Le risque d'un tel filtre est le faux positif. La comparaison porte sur la
// VALEUR ENTIÈRE, jamais sur une sous-chaîne : ces valeurs doivent passer.
for (const v of [
  "OPTIMIVV NETTOYAGE", "CGK Services", "Extra.net", "Déménagement Pro Services",
  "SAS", "SARL", "EURL", "Gérant", "Président", "Directeur général",
  "M. Jean DUPONT", "Testud", "Nathalie Sanson", "Jean-Luc Nguyen",
  "2 RUE ALFRED BRUNEAU, 75016, PARIS", "14 rue Pasteur, 33000, Bordeaux",
  "Place de l'Église, 29100, Douarnenez", "rue des Testes, 33000, Bordeaux",
  "92808342700023", "contact@optimivv.fr",
]) {
  vrai(`« ${v} » n'est PAS fictive`, !estValeurFictive(v));
}
// Une chaîne vide est ABSENTE, pas fictive : les deux cas méritent des
// messages différents, donc ils restent distincts.
vrai("la chaîne vide n'est pas « fictive » mais « absente »", !estValeurFictive(""));
vrai("ni les espaces seuls", !estValeurFictive("   "));
vrai("ni null", !estValeurFictive(null));
eq("normaliser retire accents, casse et ponctuation de bordure",
  normaliser("  « À Renseigner. »  "), "a renseigner");

console.log("\n3. Clé de Luhn — la structure, pas seulement la longueur");

// Témoin public : SIRET du siège de Google France.
vrai("44306184100047 (SIRET réel) → Luhn juste", luhnValide("44306184100047"));
vrai("92808342700023 (OPTIMIVV) → Luhn juste", luhnValide("92808342700023"));
vrai("928083427 (son SIREN) → Luhn juste", luhnValide("928083427"));
vrai("12345678901234 → Luhn faux", !luhnValide("12345678901234"));
vrai("00000000000000 → Luhn juste arithmétiquement (rattrapé ailleurs)",
  luhnValide("00000000000000"));
vrai("une chaîne non numérique n'est jamais Luhn-valide", !luhnValide("9280834270002X"));

console.log("\n4. SIRET");

eq("SIRET réel accepté", controlerSiret("92808342700023"), { ok: true });
eq("espaces et points tolérés", controlerSiret("928 083 427 000 23"), { ok: true });
refuse("SIRET absent", controlerSiret(""), "absent");
refuse("SIRET « À renseigner »", controlerSiret("À renseigner"), "valeur de remplissage");
refuse("SIRET à 9 chiffres → c'est un SIREN", controlerSiret("928083427"), "c'est un SIREN");
refuse("SIRET à 13 chiffres", controlerSiret("9280834270002"), "13 chiffres au lieu de 14");
refuse("SIRET à 14 chiffres mais clé fausse",
  controlerSiret("12345678901234"), "clé de contrôle invalide");
refuse("SIRET sans aucun chiffre", controlerSiret("SIRET"), "aucun chiffre");
// Les deux SIRET réels que la production porte et que Luhn refuse. Ce ne sont
// pas des faux positifs : ce sont des valeurs fausses, saisies à la main.
refuse("89421753000021 (CGK Services) — clé fausse",
  controlerSiret("89421753000021"), "clé de contrôle invalide");
refuse("91730541200018 (CGK Énergie) — clé fausse",
  controlerSiret("91730541200018"), "clé de contrôle invalide");
// « 00000000000000 » passe Luhn : c'est le filtre des valeurs fictives qui
// l'arrête, et c'est pour ça que les deux contrôles sont nécessaires.
refuse("SIRET tout à zéro", controlerSiret("00000000000000"), "valeur de remplissage");

console.log("\n5. SIREN");

eq("SIREN réel accepté", controlerSiren("928083427"), { ok: true });
refuse("SIREN à 14 chiffres → c'est un SIRET",
  controlerSiren("92808342700023"), "c'est un SIRET");
refuse("SIREN à 8 chiffres", controlerSiren("92808342"), "8 chiffres au lieu de 9");
refuse("SIREN clé fausse", controlerSiren("812345678"), "clé de contrôle invalide");
eq("le SIREN d'exemple du formulaire est VALIDE",
  controlerSiren(IDENTIFIANT_LEGAL.FR.exemple), { ok: true });

console.log("\n6. Identifiant légal selon le pays");

const frBase = { country: "FR", siren: null, siret: null, vat_number: null };
eq("FR avec SIRET juste", controlerIdentifiantLegal({ ...frBase, siret: "92808342700023" }), { ok: true });
eq("FR avec SIREN juste", controlerIdentifiantLegal({ ...frBase, siren: "928083427" }), { ok: true });
refuse("FR : la TVA seule n'identifie pas la société",
  controlerIdentifiantLegal({ ...frBase, vat_number: "FR92928083427" }),
  "doit porter son SIREN ou son SIRET");
refuse("FR : rien du tout", controlerIdentifiantLegal(frBase), "absent");
refuse("FR : un SIRET faux à côté d'un SIREN juste est quand même refusé",
  controlerIdentifiantLegal({ ...frBase, siren: "928083427", siret: "89421753000021" }),
  "SIRET : clé de contrôle invalide");
// Hors de France, la structure n'est pas vérifiable dans le dépôt : on exige
// une valeur réelle sans prétendre la valider.
eq("CH : l'identifiant national suffit",
  controlerIdentifiantLegal({ country: "CH", siren: "CHE-123.456.789", siret: null, vat_number: null }),
  { ok: true });
eq("BE : la TVA est un identifiant accepté",
  controlerIdentifiantLegal({ country: "BE", siren: null, siret: null, vat_number: "BE0123456789" }),
  { ok: true });
refuse("CH : une valeur de remplissage est refusée aussi",
  controlerIdentifiantLegal({ country: "CH", siren: "à renseigner", siret: null, vat_number: null }),
  "valeur de remplissage");
refuse("LU : une valeur trop courte est refusée",
  controlerIdentifiantLegal({ country: "LU", siren: "LU1", siret: null, vat_number: null }),
  "trop court");
// Un pays absent est traité comme la France — pays d'exploitation du CRM.
refuse("pays absent → règle française appliquée",
  controlerIdentifiantLegal({ country: null, siren: null, siret: null, vat_number: "FR92928083427" }),
  "société française");

console.log("\n7. Représentant, adresse, courriel");

eq("nom réel accepté", controlerNomPersonne("M. Jean DUPONT"), { ok: true });
eq("un mononyme est accepté", controlerNomPersonne("Nguyen"), { ok: true });
refuse("nom absent", controlerNomPersonne("  "), "absent");
refuse("nom fictif", controlerNomPersonne("à renseigner"), "valeur de remplissage");
refuse("nom trop court", controlerNomPersonne("JD"), "trop court");
refuse("nom uniquement numérique", controlerNomPersonne("123456"), "aucune lettre");

eq("adresse réelle acceptée",
  controlerAdressePostale("2 RUE ALFRED BRUNEAU, 75016, PARIS"), { ok: true });
eq("adresse sans numéro de rue acceptée",
  controlerAdressePostale("Place de l'Église, 29100, Douarnenez"), { ok: true });
refuse("adresse absente", controlerAdressePostale(null), "absente");
refuse("adresse « À renseigner »", controlerAdressePostale("À renseigner"), "valeur de remplissage");
// Le cas que l'aplatissement produit : un segment fictif dans une adresse
// par ailleurs plausible. La valeur entière n'est pas fictive — c'est le
// contrôle segment par segment qui l'attrape.
refuse("segment fictif au milieu d'une adresse",
  controlerAdressePostale("À renseigner, 75016, PARIS"), "dans l'adresse");

eq("courriel réel accepté", controlerEmail("aicha.lefort@optimivv-nettoyage.com"), { ok: true });
refuse("courriel absent", controlerEmail(""), "absent");
refuse("courriel sans arobase", controlerEmail("aicha.lefort.optimivv.com"), "forme d'une adresse");
refuse("courriel sans domaine complet", controlerEmail("aicha@localhost"), "incomplet");
refuse("courriel avec espace", controlerEmail("aicha lefort@optimivv.com"), "espace");
refuse("courriel fictif", controlerEmail("n/a"), "valeur de remplissage");

eq("qualité du représentant réelle", controlerTexteLegal("Gérant", 2), { ok: true });
eq("« DG » accepté (abréviation courante)", controlerTexteLegal("DG", 2), { ok: true });
refuse("qualité fictive", controlerTexteLegal("à renseigner", 2), "valeur de remplissage");

console.log("\n8. Les sept sociétés de production, telles qu'elles sont en base");

// Valeurs lues en production le 2026-11-06, en lecture seule. Aucune n'est
// modifiée : la consigne interdit de corriger ces lignes sans autorisation.
// Ce tableau dit donc l'ÉTAT RÉEL, et ce que le renforcement en fait.
type Ligne = {
  legal_name: string; legal_form: string; siret: string; address: string;
  representative_name: string | null; representative_title: string | null;
};
const ent = (x: Ligne) => controlerEntite({
  id: x.legal_name, trade_name: null, siren: null, vat_number: null, country: "FR",
  legal_name: x.legal_name, legal_form: x.legal_form, siret: x.siret,
  address: x.address, representative_name: x.representative_name,
  representative_title: x.representative_title,
});

const PRODUCTION: Ligne[] = [
  { legal_name: "NP", legal_form: "SAS", siret: "À renseigner", address: "À renseigner", representative_name: null, representative_title: null },
  { legal_name: "Extra.net", legal_form: "SAS", siret: "À renseigner", address: "À renseigner", representative_name: null, representative_title: null },
  { legal_name: "NPS", legal_form: "SAS", siret: "À renseigner", address: "À renseigner", representative_name: null, representative_title: null },
  { legal_name: "Déménagement Pro Services", legal_form: "SAS", siret: "À renseigner", address: "À renseigner", representative_name: null, representative_title: null },
  { legal_name: "CGK Énergie", legal_form: "SAS", siret: "91730541200018", address: "27 avenue Carnot, 33200, Bordeaux", representative_name: null, representative_title: null },
  { legal_name: "CGK Services", legal_form: "SAS", siret: "89421753000021", address: "14 rue Pasteur, 33000, Bordeaux", representative_name: "M. Rosalie DAVID", representative_title: "Président" },
  { legal_name: "OPTIMIVV NETTOYAGE", legal_form: "SAS", siret: "92808342700023", address: "2 RUE ALFRED BRUNEAU, 75016, PARIS", representative_name: "M. Rosalie DAVID", representative_title: "Président" },
];

for (const x of PRODUCTION) {
  const r = ent(x);
  console.log(`        ${x.legal_name.padEnd(26)} ${r.utilisable ? "ÉMISSIBLE" : "bloquée : " + r.manquants.join(" · ")}`);
}

// ⚠️ LA RÉGRESSION À NE JAMAIS LAISSER PASSER. Le raccordement DocuSign de
// production appartient à OPTIMIVV NETTOYAGE (vérifié en base le 2026-11-06,
// `docusign_connections.entity_id`). Si le renforcement la bloquait, plus
// aucun contrat ne pourrait partir en signature.
const optimivv = ent(PRODUCTION[6] as Ligne);
vrai("OPTIMIVV NETTOYAGE (porteuse du raccordement DocuSign) reste émissible",
  optimivv.utilisable);
eq("et rien ne lui est reproché", optimivv.manquants, []);

// Les quatre sociétés à « À renseigner » : désormais bloquées sur le SIRET
// ET l'adresse, là où seul le représentant était signalé avant.
const np = ent(PRODUCTION[0] as Ligne);
vrai("NP est bloquée", !np.utilisable);
vrai("son SIRET est nommé comme valeur de remplissage",
  np.manquants.some((m) => m.includes("SIREN ou SIRET") && m.includes("remplissage")));
vrai("son adresse de siège aussi",
  np.manquants.some((m) => m.startsWith("adresse du siège") && m.includes("remplissage")));
vrai("et le représentant reste signalé",
  np.manquants.some((m) => m === "représentant légal"));

// CGK Services est le cas instructif : représentant complet, adresse réelle,
// et pourtant refusée — sur la seule clé de contrôle du SIRET. AVANT le
// renforcement, elle était émissible.
const cgk = ent(PRODUCTION[5] as Ligne);
vrai("CGK Services est bloquée", !cgk.utilisable);
eq("sur le seul SIRET, et le motif le dit",
  cgk.manquants,
  ["identifiant légal (SIREN ou SIRET) (SIRET : clé de contrôle invalide "
    + "(14 chiffres, mais la clé ne tombe pas juste))"]);

console.log("\n9. Un champ vide et un champ faux ne se disent pas pareil");

// C'est tout l'enjeu de « afficher précisément les champs à corriger » : la
// planificatrice qui lit « il manque le SIRET » sur un champ qu'elle voit
// rempli conclut à une panne et appelle le support.
eq("champ vide → son seul nom",
  libelleAnomalie({ champ: "SIRET", motif: "absent", absent: true }), "SIRET");
eq("champ faux → le nom ET le motif",
  libelleAnomalie({ champ: "SIRET", motif: "clé de contrôle invalide", absent: false }),
  "SIRET (clé de contrôle invalide)");

console.log("\n10. Fiche du sous-traitant — mêmes règles, mêmes messages");

// État réel au 2026-11-06 : AUCUNE ligne dans `subcontractor_profiles`. Tout
// prestataire est donc dépourvu des cinq champs, sur tous les dossiers.
const ficheVide = anomaliesPrestataireFiche({
  raisonSociale: null, siret: null, siren: null, adresse: null,
  dirigeant: null, email: "aicha.lefort@optimivv-nettoyage.com",
});
eq("fiche absente → les quatre champs de la fiche, le courriel étant connu",
  ficheVide.map(libelleAnomalie),
  ["dénomination sociale", "SIRET", "adresse du siège", "représentant légal"]);

const ficheFictive = anomaliesPrestataireFiche({
  raisonSociale: "à renseigner", siret: "00000000000000", siren: null,
  adresse: "N/A", dirigeant: "xxx", email: "n/a",
});
vrai("une fiche entièrement remplie de valeurs fictives est refusée en totalité",
  ficheFictive.length === 5);
vrai("et chaque motif dit « remplissage »",
  ficheFictive.every((a) => a.motif.includes("remplissage")));

const ficheJuste = anomaliesPrestataireFiche({
  raisonSociale: "LEFORT PROPRETÉ", siret: "44306184100047", siren: "443061841",
  adresse: "12 rue de la République, 13001 Marseille",
  dirigeant: "Mme Aïcha LEFORT", email: "aicha.lefort@optimivv-nettoyage.com",
});
eq("une fiche réellement complète passe", ficheJuste, []);

// Le SIREN n'est pas exigé — le contrat imprime le SIRET — mais s'il est
// renseigné il s'imprime aussi, donc un SIREN faux ne doit pas passer.
const ficheSirenFaux = anomaliesPrestataireFiche({
  raisonSociale: "LEFORT PROPRETÉ", siret: "44306184100047", siren: "812345678",
  adresse: "12 rue de la République, 13001 Marseille",
  dirigeant: "Mme Aïcha LEFORT", email: "aicha.lefort@optimivv-nettoyage.com",
});
eq("un SIREN renseigné mais faux est signalé",
  ficheSirenFaux.map((a) => a.champ), ["SIREN"]);
const ficheSansSiren = anomaliesPrestataireFiche({
  raisonSociale: "LEFORT PROPRETÉ", siret: "44306184100047", siren: null,
  adresse: "12 rue de la République, 13001 Marseille",
  dirigeant: "Mme Aïcha LEFORT", email: "aicha.lefort@optimivv-nettoyage.com",
});
eq("un SIREN absent n'est PAS réclamé", ficheSansSiren, []);

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
