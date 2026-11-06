// BLOCAGES DU CONTRAT — un bouton grisé doit dire TOUT ce qu'il attend.
//
// ── LE DÉFAUT, DEUX FOIS ─────────────────────────────────────────────
//
// La liste « Avant de générer » vivait inline dans le composant, et elle a
// dérivé deux fois de ce que le serveur exige réellement :
//
//   — 2026-11-05 : `mission_address` et `mission_date`, déclarées obligatoires
//     par `resoudre()`, n'y figuraient pas. Corrigé par 7bcc760.
//   — 2026-11-06 : `subcontractor_representative_title` — champ de CE
//     formulaire, vide à l'ouverture, exigé par `resoudre()` — n'y figurait
//     pas non plus.
//
// À chaque fois, la même scène : la planificatrice complète scrupuleusement
// tout ce que l'écran lui annonce, clique, et se fait refuser pour un motif
// jamais affiché. Elle en conclut une panne.
//
// ── CE QUE CETTE SUITE EMPÊCHE ───────────────────────────────────────
//
// La section 1 confronte le catalogue `VARIABLES` à la liste des annonces,
// variable par variable. Déclarer une nouvelle variable obligatoire sans la
// câbler fait ÉCHOUER cette suite — c'est ce qui doit empêcher la troisième
// dérive. Les sections 2 et 3 rejouent les deux dossiers réels de recette.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import { existsSync, readFileSync } from "node:fs";
import {
  anomaliesPrestataireFiche,
  blocagesContrat,
  controlerEntite,
  optionsModeles,
  type EtatContrat,
} from "@/lib/sous-traitance/contrats-shared";
import type { ModeleContrat } from "@/lib/sous-traitance/clauses";
import { VARIABLES } from "@/lib/sous-traitance/variables";
import { libelleAnomalie } from "@/lib/identite-legale";
import { confidentielDe, demandePourDossier } from "@/lib/generation/demande-depuis-dossier";

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

// ══════════════════════════════════════════════════════════════════════
//  1. Chaque variable obligatoire est annoncée quelque part
// ══════════════════════════════════════════════════════════════════════

console.log("\n1. Le catalogue des variables obligatoires est couvert");

/** Où la planificatrice apprend qu'une variable manque. */
type Annonce =
  | { ou: "blocage"; texte: string }
  | { ou: "fiche"; champ: string }
  | { ou: "entite"; champ: string }
  | { ou: "structurel"; pourquoi: string };

const COUVERTURE: Record<string, Annonce> = {
  // ── Mission ────────────────────────────────────────────────────────
  mission_id: { ou: "structurel", pourquoi: "l'identifiant du dossier : la page n'existe pas sans lui" },
  mission_reference: { ou: "structurel", pourquoi: "le short_id du lead, posé à la création" },
  mission_type: { ou: "blocage", texte: "renseigner l'activité du dossier (type de mission)" },
  mission_address: { ou: "blocage", texte: "renseigner l'adresse du chantier" },
  mission_date: { ou: "blocage", texte: "planifier la date d'intervention" },
  // ── Sous-traitant ──────────────────────────────────────────────────
  subcontractor_id: { ou: "blocage", texte: "sélectionner le sous-traitant" },
  subcontractor_legal_name: { ou: "fiche", champ: "dénomination sociale" },
  subcontractor_siret: { ou: "fiche", champ: "SIRET" },
  subcontractor_address: { ou: "fiche", champ: "adresse du siège" },
  subcontractor_representative: { ou: "fiche", champ: "représentant légal" },
  subcontractor_email: { ou: "fiche", champ: "courriel (nécessaire à l'envoi en signature)" },
  // Le défaut du 2026-11-06 : saisi sur le formulaire du contrat, PAS sur la
  // fiche. L'annoncer comme « fiche incomplète » enverrait corriger un écran
  // où le champ n'existe pas.
  subcontractor_representative_title: {
    ou: "blocage",
    texte: "renseigner la qualité du représentant du prestataire (gérant, président…)",
  },
  // ── Donneur d'ordre ────────────────────────────────────────────────
  principal_company_name: { ou: "entite", champ: "dénomination sociale" },
  principal_company_legal_form: { ou: "entite", champ: "forme juridique" },
  principal_company_siren: { ou: "entite", champ: "identifiant légal (SIREN ou SIRET)" },
  principal_company_address: { ou: "entite", champ: "adresse du siège" },
  principal_company_representative: { ou: "entite", champ: "représentant légal" },
  principal_company_representative_title: { ou: "entite", champ: "qualité du représentant" },
};

// `estTransport` est câblé à `false` dans `construireContexte()` : aucun modèle
// de transport n'est validé, donc `pickup_address` et `delivery_address` ne
// sont jamais réclamées. Les exiger ici produirait de faux manques.
const OBLIGATOIRES = VARIABLES.filter((v) => v.obligatoire && !v.transportSeulement);

eq("18 variables obligatoires hors transport", OBLIGATOIRES.length, 18);

for (const v of OBLIGATOIRES) {
  vrai(`${v.cle} est annoncée`, COUVERTURE[v.cle] !== undefined);
}
// L'inverse : une entrée pour une variable qui n'est plus obligatoire est du
// bruit, et finirait par masquer un vrai trou.
for (const cle of Object.keys(COUVERTURE)) {
  vrai(`${cle} est bien encore obligatoire`,
    OBLIGATOIRES.some((v) => v.cle === cle));
}
// Les variables de transport sont volontairement HORS table.
vrai("les variables de transport ne sont pas réclamées",
  !("pickup_address" in COUVERTURE) && !("delivery_address" in COUVERTURE));

// ── Et les annonces existent vraiment ────────────────────────────────

console.log("\n2. Les textes annoncés sont bien ceux que le code produit");

const VIDE: EtatContrat = {
  technicianId: "", entityId: "", modele: "", qualiteRepresentant: "", totalHt: 0,
  prestataire: null, entite: null, optionModele: null,
  mission: { type: "", adresse: "", date: "" },
};

const toutVide = blocagesContrat(VIDE);
for (const [cle, a] of Object.entries(COUVERTURE)) {
  if (a.ou !== "blocage") continue;
  // `subcontractor_representative_title` est conditionné au choix du
  // prestataire : son blocage n'apparaît qu'une fois celui-ci retenu.
  const liste = cle === "subcontractor_representative_title"
    ? blocagesContrat({ ...VIDE, technicianId: "t1" })
    : toutVide;
  vrai(`« ${a.texte} » est produit`, liste.includes(a.texte));
}

const ficheVide = anomaliesPrestataireFiche({
  raisonSociale: null, siret: null, siren: null, adresse: null, dirigeant: null, email: null,
}).map(libelleAnomalie);
for (const a of Object.values(COUVERTURE)) {
  if (a.ou !== "fiche") continue;
  vrai(`la fiche annonce « ${a.champ} »`, ficheVide.includes(a.champ));
}

const entiteVide = controlerEntite({
  id: "x", legal_name: null, trade_name: null, legal_form: null, siren: null,
  siret: null, vat_number: null, address: null, country: "FR",
  representative_name: null, representative_title: null,
}).manquants;
for (const a of Object.values(COUVERTURE)) {
  if (a.ou !== "entite") continue;
  vrai(`l'entité annonce « ${a.champ} »`, entiteVide.includes(a.champ));
}

// ── La qualité du représentant : le défaut lui-même ──────────────────

console.log("\n3. Le défaut du 2026-11-06, isolé");

const avecPrestataire: EtatContrat = {
  ...VIDE, technicianId: "t1",
  prestataire: { manquants: [], utilisable: true },
};
vrai("qualité vide → annoncée",
  blocagesContrat(avecPrestataire)
    .some((b) => b.startsWith("renseigner la qualité du représentant")));
vrai("qualité renseignée → plus annoncée",
  !blocagesContrat({ ...avecPrestataire, qualiteRepresentant: "Gérant" })
    .some((b) => b.startsWith("renseigner la qualité du représentant")));
vrai("qualité faite d'espaces → encore annoncée",
  blocagesContrat({ ...avecPrestataire, qualiteRepresentant: "   " })
    .some((b) => b.startsWith("renseigner la qualité du représentant")));
vrai("qualité « à renseigner » → encore annoncée",
  blocagesContrat({ ...avecPrestataire, qualiteRepresentant: "à renseigner" })
    .some((b) => b.startsWith("renseigner la qualité du représentant")));
// Avant le choix du prestataire, la réclamer serait incompréhensible : elle
// désigne LE représentant DU prestataire.
vrai("sans prestataire choisi, elle n'est pas réclamée",
  !blocagesContrat(VIDE).some((b) => b.startsWith("renseigner la qualité")));

// ══════════════════════════════════════════════════════════════════════
//  4-5. Les deux dossiers de recette, données réelles du 2026-11-06
// ══════════════════════════════════════════════════════════════════════

console.log("\n4. L-1033 « Café Margot » (75b9a1bf…) — dossier planifié");

// État lu en production : sous-traitant affecté (Aïcha Lefort), aucune fiche
// `subcontractor_profiles` (la table est vide), aucun contrat brouillon donc
// pas d'entité ni de modèle présélectionnés, devis à 0 ligne donc aucun modèle
// suggéré, adresse reprise de la facturation, date d'intervention renseignée.
const L1033: EtatContrat = {
  technicianId: "64cbb5f0-9c61-439b-9e9f-e481a1939f67",
  entityId: "",
  modele: "",
  qualiteRepresentant: "",
  totalHt: 0,
  prestataire: {
    utilisable: false,
    manquants: ["dénomination sociale", "SIRET", "adresse du siège", "représentant légal"],
  },
  entite: null,
  optionModele: null,
  mission: {
    type: "Nettoyage",
    adresse: "61 rue des Abbesses, 75018, Paris 18e",
    date: "2026-07-23",
  },
};

// ⚠️ CINQ, ET NON QUATRE. La recette du 2026-11-06 en attendait quatre, et
// c'est bien ce que la version déployée affiche. Le cinquième — la qualité du
// représentant — BLOQUAIT DÉJÀ, mais côté serveur et sans un mot à l'écran.
// Le compte qui augmente est la correction, pas une régression.
eq("cinq blocages, dans l'ordre de l'écran", blocagesContrat(L1033), [
  "sélectionner l'entité juridique émettrice",
  "sélectionner le modèle de contrat",
  "compléter la fiche du prestataire (dénomination sociale, SIRET, adresse du siège, représentant légal)",
  "renseigner la qualité du représentant du prestataire (gérant, président…)",
  "renseigner le tarif du sous-traitant",
]);
vrai("le sous-traitant n'est PAS réclamé : il est affecté au dossier",
  !blocagesContrat(L1033).includes("sélectionner le sous-traitant"));
vrai("l'adresse du chantier n'est PAS réclamée : le repli sur la facturation la fournit",
  !blocagesContrat(L1033).includes("renseigner l'adresse du chantier"));
vrai("la date n'est PAS réclamée : elle est renseignée",
  !blocagesContrat(L1033).includes("planifier la date d'intervention"));
// Ce dossier ne teste donc PAS le correctif 7bcc760 : ses deux variables sont
// présentes. C'est L-1079 qui l'exerce.
vrai("ce dossier n'exerce pas le correctif adresse/date",
  !blocagesContrat(L1033).some((b) => b.includes("chantier") || b.includes("date")));

console.log("\n5. L-1079 (82e43f51…) — dossier à planifier");

// État lu en production : aucun sous-traitant, `planned_at` nul, adresse nulle
// sur le dossier ET sur le lead (donc le repli ne donne rien), activité
// « Nettoyage » renseignée.
const L1079: EtatContrat = {
  technicianId: "", entityId: "", modele: "", qualiteRepresentant: "", totalHt: 0,
  prestataire: null, entite: null, optionModele: null,
  mission: { type: "Nettoyage", adresse: "", date: "" },
};

eq("six blocages, dans l'ordre de l'écran", blocagesContrat(L1079), [
  "sélectionner le sous-traitant",
  "sélectionner l'entité juridique émettrice",
  "sélectionner le modèle de contrat",
  "renseigner le tarif du sous-traitant",
  "renseigner l'adresse du chantier",
  "planifier la date d'intervention",
]);
vrai("la fiche prestataire n'est pas réclamée : aucun prestataire n'est encore choisi",
  !blocagesContrat(L1079).some((b) => b.includes("fiche du prestataire")));
vrai("ni la qualité de son représentant",
  !blocagesContrat(L1079).some((b) => b.includes("qualité du représentant")));
vrai("l'activité n'est pas réclamée : les 699 leads en portent une",
  !blocagesContrat(L1079).some((b) => b.includes("activité du dossier")));

// Une valeur de modèle RÉELLE, prise au catalogue : un littéral ne tiendrait
// pas si l'union `ModeleContrat` changeait, et le test mentirait sans le dire.
const MODELES = optionsModeles();
const UN_MODELE: ModeleContrat = (MODELES[0] as { valeur: ModeleContrat }).valeur;

console.log("\n6. Une entité ou un modèle inexploitable est annoncé, pas tu");

eq("entité sélectionnée mais inexploitable → le motif est repris",
  blocagesContrat({
    ...L1079, entityId: "e1",
    entite: {
      utilisable: false,
      manquants: ["identifiant légal (SIREN ou SIRET) (SIRET : clé de contrôle invalide)"],
    },
  }).filter((b) => b.startsWith("corriger l'entité")),
  ["corriger l'entité (identifiant légal (SIREN ou SIRET) (SIRET : clé de contrôle invalide))"]);

eq("modèle sans texte contractuel → annoncé",
  blocagesContrat({ ...L1079, modele: UN_MODELE, optionModele: { emissible: false } })
    .filter((b) => b.includes("modèle")),
  ["choisir un modèle dont le texte est disponible"]);

vrai("un état complet ne bloque plus rien",
  blocagesContrat({
    technicianId: "t1", entityId: "e1", modele: UN_MODELE,
    qualiteRepresentant: "Gérant", totalHt: 1200,
    prestataire: { manquants: [], utilisable: true },
    entite: { manquants: [], utilisable: true },
    optionModele: { emissible: true },
    mission: { type: "Nettoyage", adresse: "1 rue X, 75001, Paris", date: "2026-12-01" },
  }).length === 0);

// ══════════════════════════════════════════════════════════════════════
//  7. Les modèles de contrat
// ══════════════════════════════════════════════════════════════════════

console.log("\n7. Neuf modèles au menu, sept réellement émissibles");

const modeles = MODELES;
eq("neuf modèles proposés", modeles.length, 9);
const emissibles = modeles.filter((m) => m.emissible);
eq("sept portent un texte contractuel", emissibles.length, 7);
for (const m of modeles) {
  console.log(`        ${String(m.numero).padStart(2)} · ${m.label.padEnd(46)}`
    + (m.emissible ? `${m.nbArticles} articles` : `BLOQUÉ — ${m.motifBlocage ?? ""}`));
}
vrai("les deux non émissibles restent VISIBLES au menu",
  modeles.length - emissibles.length === 2);
vrai("et chacun dit pourquoi il est bloqué",
  modeles.filter((m) => !m.emissible).every((m) => Boolean(m.motifBlocage?.trim())));
vrai("aucun modèle émissible n'est vide d'articles",
  emissibles.every((m) => m.nbArticles > 0));
vrai("chaque modèle émissible porte un titre de document",
  emissibles.every((m) => m.titreDocument.trim().length > 0));
vrai("les numéros sont uniques",
  new Set(modeles.map((m) => m.numero)).size === modeles.length);

// ══════════════════════════════════════════════════════════════════════
//  8. Demande de tarif : les données personnelles ne sortent pas
// ══════════════════════════════════════════════════════════════════════

console.log("\n8. Demande de tarif — le client n'est pas identifiable");

// Les données réelles de L-1033, client compris : si l'une d'elles ressort dans
// texte, le générateur doit REFUSER de le rendre.
const dossierDemande = {
  mission: {
    secteurSlug: "nettoyage",
    adresse: "61 rue des Abbesses, 75018, Paris 18e",
    codePostal: "75018",
    ville: "Paris 18e",
    surfaceM2: 120,
    volumeDebarras: "",
    niveauDifficulte: "",
    dateSouhaitee: "",
    // Étage VIDE — comme les onze dossiers de production au 2026-11-06. Voir
    // la section 8 bis : un étage renseigné fait REFUSER la demande.
    etage: "",
    acces: "code 1234A",
    consignes: "intervention avant 7 h",
  },
  client: {
    nom: "", prenom: "", societe: "Café Margot",
    telephone: "+33 1 42 64 18 09", email: "cafe.margot@gmail.com",
    adresse: "61 rue des Abbesses, 75018, Paris 18e",
    codePostal: "75018", ville: "Paris 18e",
  },
  prestations: [{ label: "Nettoyage approfondi" }],
  signatureEntite: "OPTIMIVV NETTOYAGE",
};

const r = demandePourDossier(dossierDemande);
if (!r.ok) {
  console.log(`        refus : ${r.raison}`);
  for (const f of r.fuites) console.log(`        fuite : ${f.champ} → ${JSON.stringify(f.extrait)}`);
}
vrai("la demande est produite", r.ok);
if (r.ok) {
  const texte = `${r.demande.objet}\n\n${r.demande.corps}`;
  const secrets = confidentielDe(dossierDemande);
  for (const [cle, valeur] of Object.entries(secrets)) {
    if (!valeur) continue;
    vrai(`« ${cle} » absent du texte envoyé`, !texte.includes(valeur as string));
  }
  // Ce qui DOIT y être : la localisation grossière, pas l'adresse.
  vrai("le code postal est présent (nécessaire au chiffrage)", texte.includes("75018"));
  vrai("la ville est présente", texte.includes("Paris 18e"));
  vrai("la rue est absente", !texte.includes("Abbesses"));
  vrai("le nom du client est absent", !texte.includes("Café Margot"));
  vrai("le téléphone est absent", !texte.includes("42 64 18 09"));
  vrai("le courriel est absent", !texte.includes("cafe.margot"));
  // §6 : le prix de vente ne circule jamais vers le sous-traitant. Il n'est
  // même pas transmis au générateur — aucun champ ne le porte.
  vrai("aucun champ de prix n'est transmis au générateur",
    !Object.keys(dossierDemande.mission).some((k) => /prix|montant|tarif|ttc|^ht$/i.test(k)));
}

// ── 8 bis. DÉFAUT LATENT, constaté le 2026-11-06 ─────────────────────
//
// `confidentielDe()` classe l'étage parmi les valeurs confidentielles
// (`complement`), en expliquant qu'on n'en omet aucune « même celles qu'aucun
// gabarit n'emploie ». Mais `dossierSigneDe()` transmet précisément
// `details.etage` au générateur, qui l'imprime comme contrainte technique.
// `verifierFuites()` le retrouve donc dans son propre texte et REFUSE de le
// rendre.
//
// Conséquence : dès qu'un étage est renseigné, la demande de tarif n'est plus
// produite du tout. Le bouton « Voir le texte » ne montre rien.
//
// Pourquoi personne ne l'a vu : au 2026-11-06, AUCUN des 11 dossiers et AUCUN
// des 699 leads ne porte d'étage. Le défaut est donc latent — mais le champ
// existe à l'écran, et il est utile au chiffrage (3e sans ascenseur ne se
// facture pas comme un rez-de-chaussée).
//
// ⚠️ CE TEST FIGE LE COMPORTEMENT ACTUEL, PAS LE COMPORTEMENT SOUHAITABLE.
// Trancher demande une décision : soit l'étage n'est pas une donnée
// identifiante (un « 2e étage » ne désigne personne) et sort de
// `confidentielDe`, soit le générateur cesse de l'imprimer. Le jour où la
// décision est prise, CE TEST ÉCHOUERA — et c'est voulu : il force à mettre
// ce commentaire à jour plutôt qu'à corriger en silence.

console.log("\n8 bis. Un étage renseigné fait refuser la demande (défaut connu)");

const avecEtage = demandePourDossier({
  ...dossierDemande,
  mission: { ...dossierDemande.mission, etage: "2e étage" },
});
vrai("refusée", !avecEtage.ok);
if (!avecEtage.ok) {
  eq("et le motif est bien le complément d'adresse",
    avecEtage.fuites.map((f) => f.champ), ["complément d'adresse"]);
  vrai("le refus est explicite, il ne rend pas un texte tronqué",
    avecEtage.raison.includes("confidentielles"));
}

// ══════════════════════════════════════════════════════════════════════
//  9. DocuSign : le renforcement ne coupe pas la signature
// ══════════════════════════════════════════════════════════════════════

console.log("\n9. Compatibilité DocuSign");

const lu = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const envoi = lu("lib/docusign/envoi-server.ts");
vrai("lib/docusign/envoi-server.ts existe", envoi.length > 0);
// Le chemin d'envoi en signature partage le MÊME contrôle d'entité : le
// renforcement s'y applique sans qu'on ait rien à y recopier.
vrai("l'envoi en signature refuse une entité non utilisable",
  envoi.includes("!e.utilisable"));
vrai("et il nomme les champs à corriger",
  envoi.includes("e.manquants.join"));
// Le raccordement de production appartient à OPTIMIVV NETTOYAGE (vérifié en
// base le 2026-11-06). Sa validité est gelée dans `identite-legale.ts`,
// section 8 — ici on vérifie qu'aucun second contrôle ne s'interpose.
vrai("aucun contrôle d'identité n'a été ajouté dans le chemin OAuth",
  !lu("lib/docusign/oauth-server.ts").includes("controlerEntite"));
vrai("ni dans le webhook",
  !lu("lib/docusign/webhook.ts").includes("controlerEntite"));

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
