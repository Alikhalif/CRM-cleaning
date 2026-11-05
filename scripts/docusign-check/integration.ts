// Intégration DocuSign — tests unitaires du §7.
//
// Portée : tout ce qui se vérifie sans réseau et sans base. OAuth/PKCE,
// HMAC, machine à états, idempotence, reprise, et les invariants de sécurité
// (aucun secret en dur, aucune URL de production codée en dur).

import { createHmac } from "node:crypto";
import {
  SCOPES, authHost, redirectionAutorisee, urlApi, urlToken, urlUserInfo,
  type ConfigDocuSign,
} from "@/lib/docusign/config";
import {
  JOURS_RAFRAICHISSEMENT, MARGE_RAFRAICHISSEMENT_MS, STATE_TTL_MS,
  creerDemandePkce, defiCorrespond, jetonAExpire, joursAvantReautorisation,
  rafraichissementExpire, stateCorrespond, stateExpire, urlAutorisation,
} from "@/lib/docusign/pkce";
import {
  MAX_ESSAIS, aTraiterMaintenant, alerteNecessaire, cleEvenement,
  lireNotification, prochainEssai, signatureValide,
} from "@/lib/docusign/webhook";
import {
  STATUT_LABEL, TERMINAUX, appliquer, doitEtreArchive, estTerminal,
  restantASigner, statutDepuisDocuSign, transitionAutorisee,
  type Destinataire, type StatutSignature,
} from "@/lib/docusign/statuts";
import {
  ANCRE_DONNEUR_ORDRE, ANCRE_SOUS_TRAITANT,
} from "@/lib/docusign/ancres";
import { entiteComplete, instantanerEntite } from "@/lib/docusign/archivage";

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

const CONFIG: ConfigDocuSign = {
  environnement: "demo",
  clientId: "ck-123",
  clientSecret: "cs-456",
  redirectUri: "https://crmoptimum.com/api/docusign/callback",
  hmacSecret: "secret-connect",
};

// ══════════════════════════════════════════════════════════════════════
//  PKCE
// ══════════════════════════════════════════════════════════════════════
console.log("== PKCE ==");
const d1 = creerDemandePkce();
const d2 = creerDemandePkce();
eq("méthode S256", d1.codeChallengeMethod, "S256");
vrai("le vérificateur fait 43 caractères (256 bits en base64url)", d1.codeVerifier.length === 43);
vrai("base64url : ni +, ni /, ni =",
  !/[+/=]/.test(d1.codeVerifier) && !/[+/=]/.test(d1.codeChallenge));
vrai("le défi correspond au vérificateur", defiCorrespond(d1.codeVerifier, d1.codeChallenge));
vrai("un autre vérificateur ne correspond pas",
  !defiCorrespond(d2.codeVerifier, d1.codeChallenge));
// Deux demandes ne doivent JAMAIS produire les mêmes valeurs.
vrai("deux demandes donnent des vérificateurs distincts", d1.codeVerifier !== d2.codeVerifier);
vrai("… et des states distincts", d1.state !== d2.state);
// Le state ne doit pas être dérivable du vérificateur : il circule en clair.
vrai("le state n'est pas le vérificateur", d1.state !== d1.codeVerifier);
vrai("le state n'est pas le défi", d1.state !== d1.codeChallenge);

console.log("\n== Comparaison du state ==");
vrai("identique", stateCorrespond(d1.state, d1.state));
vrai("différent", !stateCorrespond(d1.state, d2.state));
vrai("longueur différente", !stateCorrespond("court", d1.state));
vrai("chaîne vide refusée contre un state réel", !stateCorrespond("", d1.state));

console.log("\n== Expiration du state ==");
eq("durée de vie : 10 minutes", STATE_TTL_MS, 600_000);
const maintenant = Date.parse("2026-11-03T12:00:00Z");
vrai("frais", !stateExpire(new Date(maintenant - 60_000).toISOString(), maintenant));
vrai("à 9 minutes, encore valable",
  !stateExpire(new Date(maintenant - 9 * 60_000).toISOString(), maintenant));
vrai("à 11 minutes, expiré",
  stateExpire(new Date(maintenant - 11 * 60_000).toISOString(), maintenant));
vrai("date illisible → traité comme expiré", stateExpire("pas-une-date", maintenant));

// ══════════════════════════════════════════════════════════════════════
//  URL d'autorisation
// ══════════════════════════════════════════════════════════════════════
console.log("\n== URL d'autorisation ==");
const url = new URL(urlAutorisation({
  authHost: authHost("demo"),
  clientId: CONFIG.clientId,
  redirectUri: CONFIG.redirectUri,
  scopes: SCOPES,
  demande: d1,
}));
eq("le bac à sable est bien account-d", url.host, "account-d.docusign.com");
eq("chemin", url.pathname, "/oauth/auth");
eq("response_type", url.searchParams.get("response_type"), "code");
eq("scopes demandés", url.searchParams.get("scope"), "signature extended");
eq("client_id", url.searchParams.get("client_id"), "ck-123");
eq("redirect_uri", url.searchParams.get("redirect_uri"), CONFIG.redirectUri);
eq("code_challenge_method", url.searchParams.get("code_challenge_method"), "S256");
eq("le défi est transmis", url.searchParams.get("code_challenge"), d1.codeChallenge);
eq("le state est transmis", url.searchParams.get("state"), d1.state);
// LE POINT CRITIQUE : le vérificateur ne doit JAMAIS sortir.
vrai("le code_verifier n'apparaît NULLE PART dans l'URL",
  !url.toString().includes(d1.codeVerifier));
vrai("le secret client n'apparaît pas non plus",
  !url.toString().includes(CONFIG.clientSecret));

console.log("\n== Séparation bac à sable / production ==");
eq("démo", authHost("demo"), "https://account-d.docusign.com");
eq("production", authHost("production"), "https://account.docusign.com");
vrai("les deux hôtes diffèrent", authHost("demo") !== authHost("production"));
eq("jeton, démo", urlToken("demo"), "https://account-d.docusign.com/oauth/token");
eq("userinfo, production", urlUserInfo("production"), "https://account.docusign.com/oauth/userinfo");

console.log("\n== L'URL de l'API N'EST PAS codée en dur ==");
// Exigence explicite : la production européenne a sa propre base, renvoyée
// par /oauth/userinfo. On vérifie qu'elle est bien employée telle quelle.
eq("base européenne respectée",
  urlApi("https://eu.docusign.net", "acc-1", "envelopes"),
  "https://eu.docusign.net/restapi/v2.1/accounts/acc-1/envelopes");
eq("base nord-américaine respectée",
  urlApi("https://na3.docusign.net", "acc-2", "envelopes/E1/documents/combined"),
  "https://na3.docusign.net/restapi/v2.1/accounts/acc-2/envelopes/E1/documents/combined");
eq("une barre finale en trop ne casse rien",
  urlApi("https://demo.docusign.net/", "a", "/envelopes"),
  "https://demo.docusign.net/restapi/v2.1/accounts/a/envelopes");

console.log("\n== Redirection : seule celle configurée est acceptée ==");
vrai("celle de la configuration", redirectionAutorisee(CONFIG.redirectUri, CONFIG));
vrai("un autre domaine est refusé",
  !redirectionAutorisee("https://pirate.example/api/docusign/callback", CONFIG));
vrai("le même chemin sur un autre hôte est refusé",
  !redirectionAutorisee("http://localhost:3000/api/docusign/callback", CONFIG));
vrai("un sous-domaine ressemblant est refusé",
  !redirectionAutorisee("https://crmoptimum.com.pirate.example/api/docusign/callback", CONFIG));

// ══════════════════════════════════════════════════════════════════════
//  Expiration des jetons
// ══════════════════════════════════════════════════════════════════════
console.log("\n== Jetons : marge de rafraîchissement ==");
eq("marge d'une minute", MARGE_RAFRAICHISSEMENT_MS, 60_000);
vrai("jeton valable dans 10 minutes → utilisable",
  !jetonAExpire(new Date(maintenant + 600_000).toISOString(), maintenant));
// Le point de la marge : un jeton valide 30 s expirerait pendant l'appel.
vrai("jeton valable 30 s → considéré comme expiré",
  jetonAExpire(new Date(maintenant + 30_000).toISOString(), maintenant));
vrai("jeton déjà expiré", jetonAExpire(new Date(maintenant - 1).toISOString(), maintenant));
vrai("jeton sans date → expiré", jetonAExpire(null, maintenant));
vrai("date illisible → expiré", jetonAExpire("n'importe quoi", maintenant));

console.log("\n== Jeton de rafraîchissement : la limite de 30 jours ==");
eq("durée DocuSign", JOURS_RAFRAICHISSEMENT, 30);
vrai("dans 10 jours → valable",
  !rafraichissementExpire(new Date(maintenant + 10 * 86_400_000).toISOString(), maintenant));
vrai("hier → expiré",
  rafraichissementExpire(new Date(maintenant - 86_400_000).toISOString(), maintenant));
// Inconnu : on tente, DocuSign tranchera — plutôt que de bloquer à tort.
vrai("date inconnue → on n'empêche pas la tentative",
  !rafraichissementExpire(null, maintenant));
eq("jours restants",
  joursAvantReautorisation(new Date(maintenant + 7 * 86_400_000 + 1000).toISOString(), maintenant), 7);
eq("déjà dépassé → négatif",
  joursAvantReautorisation(new Date(maintenant - 2 * 86_400_000).toISOString(), maintenant), -2);
eq("inconnu", joursAvantReautorisation(null, maintenant), null);

// ══════════════════════════════════════════════════════════════════════
//  HMAC du webhook
// ══════════════════════════════════════════════════════════════════════
console.log("\n== HMAC Connect ==");
const corps = '{"event":"envelope-completed","data":{"envelopeId":"E-1"}}';
const bonne = createHmac("sha256", CONFIG.hmacSecret).update(corps, "utf8").digest("base64");
vrai("signature correcte acceptée", signatureValide(corps, bonne, CONFIG.hmacSecret).ok);
vrai("signature d'un autre corps refusée",
  !signatureValide(corps + " ", bonne, CONFIG.hmacSecret).ok);
vrai("signature avec une autre clé refusée",
  !signatureValide(corps, createHmac("sha256", "autre").update(corps).digest("base64"), CONFIG.hmacSecret).ok);
vrai("signature absente refusée", !signatureValide(corps, null, CONFIG.hmacSecret).ok);
vrai("signature vide refusée", !signatureValide(corps, "", CONFIG.hmacSecret).ok);
// LE POINT DE SÉCURITÉ : sans clé configurée on REFUSE, on n'accepte pas.
const sansCle = signatureValide(corps, bonne, null);
vrai("clé non configurée → REFUS", !sansCle.ok);
vrai("… et la raison le dit", (sansCle.raison ?? "").includes("non configurée"));
vrai("clé vide → refus aussi", !signatureValide(corps, bonne, "").ok);
// Un seul caractère d'écart suffit à invalider.
const presque = bonne.slice(0, -1) + (bonne.endsWith("A") ? "B" : "A");
vrai("un caractère d'écart → refus", !signatureValide(corps, presque, CONFIG.hmacSecret).ok);

// ══════════════════════════════════════════════════════════════════════
//  Idempotence
// ══════════════════════════════════════════════════════════════════════
console.log("\n== Idempotence des notifications ==");
const e1 = { envelopeId: "E-1", statut: "completed", horodatage: "2026-11-03T10:00:00Z" };
eq("même événement → même clé", cleEvenement(e1), cleEvenement({ ...e1 }));
vrai("statut différent → clé différente",
  cleEvenement(e1) !== cleEvenement({ ...e1, statut: "sent" }));
vrai("horodatage différent → clé différente",
  cleEvenement(e1) !== cleEvenement({ ...e1, horodatage: "2026-11-03T11:00:00Z" }));
vrai("enveloppe différente → clé différente",
  cleEvenement(e1) !== cleEvenement({ ...e1, envelopeId: "E-2" }));
vrai("la clé porte l'identifiant d'enveloppe", cleEvenement(e1).includes("E-1"));
eq("sans horodatage, la clé reste stable",
  cleEvenement({ envelopeId: "E-1", statut: "sent" }),
  cleEvenement({ envelopeId: "E-1", statut: "sent", horodatage: null }));

// ══════════════════════════════════════════════════════════════════════
//  Reprise après erreur
// ══════════════════════════════════════════════════════════════════════
console.log("\n== File de reprise ==");
eq("six paliers", MAX_ESSAIS, 6);
const t = Date.parse("2026-11-03T12:00:00Z");
eq("1er essai → 1 minute", prochainEssai(0, t)?.toISOString(), new Date(t + 60_000).toISOString());
eq("2e essai → 5 minutes", prochainEssai(1, t)?.toISOString(), new Date(t + 5 * 60_000).toISOString());
eq("6e essai → 12 heures", prochainEssai(5, t)?.toISOString(), new Date(t + 720 * 60_000).toISOString());
// Au-delà, on renonce plutôt que de boucler indéfiniment.
eq("7e essai → abandon", prochainEssai(6, t), null);
vrai("et l'alerte est nécessaire", alerteNecessaire(6));
vrai("avant le plafond, pas d'alerte", !alerteNecessaire(5));

console.log("\n== Qui traiter maintenant ==");
vrai("en attente sans échéance → oui", aTraiterMaintenant({ etat: "en_attente" }, t));
vrai("déjà traité → non", !aTraiterMaintenant({ etat: "traite" }, t));
// « en cours » protège d'un double traitement par deux passages de cron.
vrai("en cours → non", !aTraiterMaintenant({ etat: "en_cours" }, t));
vrai("échec dont l'échéance est passée → oui",
  aTraiterMaintenant({ etat: "echec", prochainEssaiLe: new Date(t - 1000).toISOString() }, t));
vrai("échec dont l'échéance est à venir → non",
  !aTraiterMaintenant({ etat: "echec", prochainEssaiLe: new Date(t + 60_000).toISOString() }, t));
vrai("échéance illisible → on traite plutôt que de bloquer",
  aTraiterMaintenant({ etat: "echec", prochainEssaiLe: "bof" }, t));

// ══════════════════════════════════════════════════════════════════════
//  Lecture des notifications
// ══════════════════════════════════════════════════════════════════════
console.log("\n== Lecture du corps (deux générations de format) ==");
const recent = lireNotification({
  event: "envelope-completed",
  data: {
    envelopeId: "E-9",
    envelopeSummary: {
      status: "completed",
      completedDateTime: "2026-11-03T09:00:00Z",
      statusChangedDateTime: "2026-11-03T09:00:01Z",
      recipients: { signers: [
        { email: "a@x.fr", name: "A", status: "completed", signedDateTime: "2026-11-03T08:30:00Z" },
        { email: "b@x.fr", name: "B", status: "completed", signedDateTime: "2026-11-03T08:55:00Z" },
      ] },
    },
  },
});
vrai("format récent lu", recent.ok);
if (recent.ok) {
  eq("enveloppe", recent.notification.envelopeId, "E-9");
  eq("statut", recent.notification.statut, "completed");
  eq("deux signataires", recent.notification.destinataires.length, 2);
  eq("date de complétion", recent.notification.completedAt, "2026-11-03T09:00:00Z");
}
const ancien = lireNotification({
  envelopeStatus: {
    envelopeId: "E-8", status: "declined",
    RecipientStatuses: [{ Email: "c@x.fr", UserName: "C", Status: "declined", DeclineReason: "montant" }],
  },
});
vrai("format ancien lu", ancien.ok);
if (ancien.ok) {
  eq("statut", ancien.notification.statut, "declined");
  eq("motif de refus", ancien.notification.destinataires[0]?.motifRefus, "montant");
}
console.log("\n== Refus de ce qui n'est pas exploitable ==");
vrai("corps vide", !lireNotification(null).ok);
vrai("corps non objet", !lireNotification("texte").ok);
vrai("sans identifiant d'enveloppe", !lireNotification({ data: { envelopeSummary: { status: "sent" } } }).ok);
vrai("statut inconnu",
  !lireNotification({ data: { envelopeId: "E", envelopeSummary: { status: "bizarre" } } }).ok);

// ══════════════════════════════════════════════════════════════════════
//  Machine à états
// ══════════════════════════════════════════════════════════════════════
console.log("\n== Traduction DocuSign → CRM ==");
const sign = (statut: Destinataire["statut"], email: string): Destinataire => ({ email, statut });
eq("completed → signé par toutes les parties",
  statutDepuisDocuSign({ statut: "completed", destinataires: [] }), "signe_toutes_parties");
eq("declined → refusé",
  statutDepuisDocuSign({ statut: "declined", destinataires: [] }), "refuse");
eq("sent sans ouverture → envoyé",
  statutDepuisDocuSign({ statut: "sent", destinataires: [sign("sent", "a@x")] }), "envoye_signature");
eq("delivered → en attente de signature",
  statutDepuisDocuSign({ statut: "delivered", destinataires: [sign("delivered", "a@x")] }),
  "en_attente_signature");
// Le cas que DocuSign ne donne pas directement.
eq("un signataire sur deux → partiellement signé",
  statutDepuisDocuSign({ statut: "sent", destinataires: [sign("completed", "a@x"), sign("sent", "b@x")] }),
  "partiellement_signe");
eq("un refus en cours de route l'emporte",
  statutDepuisDocuSign({ statut: "sent", destinataires: [sign("completed", "a@x"), sign("declined", "b@x")] }),
  "refuse");
// `voided` : expiration ou annulation, selon le motif.
eq("voided pour expiration → expiré",
  statutDepuisDocuSign({ statut: "voided", destinataires: [], motifAnnulation: "Envelope expired" }),
  "expire");
eq("voided sans motif d'expiration → annulé",
  statutDepuisDocuSign({ statut: "voided", destinataires: [], motifAnnulation: "annulé par OPTIMIVV" }),
  "annule");

console.log("\n== Transitions : pas de retour en arrière ==");
vrai("envoyé → en attente de signature",
  transitionAutorisee("envoye_signature", "en_attente_signature"));
vrai("partiellement signé → signé", transitionAutorisee("partiellement_signe", "signe_toutes_parties"));
// LE POINT : une notification en retard ne doit pas faire reculer un signé.
vrai("signé → partiellement signé est REFUSÉ",
  !transitionAutorisee("signe_toutes_parties", "partiellement_signe"));
vrai("signé → en attente est REFUSÉ",
  !transitionAutorisee("signe_toutes_parties", "en_attente_signature"));
vrai("refusé → signé est REFUSÉ", !transitionAutorisee("refuse", "signe_toutes_parties"));
// Idempotence : rejouer la même notification ne casse rien.
for (const s of ["envoye_signature", "signe_toutes_parties", "refuse", "annule"] as StatutSignature[]) {
  vrai(`rejeu de « ${STATUT_LABEL[s]} » accepté`, transitionAutorisee(s, s));
}
const refus = appliquer("signe_toutes_parties", "en_attente_signature");
vrai("le refus est motivé", !refus.ok && refus.raison.includes("transition refusée"));

console.log("\n== Terminaux et archivage ==");
eq("quatre statuts terminaux", TERMINAUX.length, 4);
vrai("signé est terminal", estTerminal("signe_toutes_parties"));
vrai("partiellement signé n'est PAS terminal", !estTerminal("partiellement_signe"));
vrai("seul « signé par toutes les parties » déclenche l'archivage",
  doitEtreArchive("signe_toutes_parties")
  && !doitEtreArchive("partiellement_signe")
  && !doitEtreArchive("refuse"));

console.log("\n== Signataires restants ==");
eq("un sur deux reste",
  restantASigner([sign("completed", "a@x"), sign("sent", "b@x")]).map((d) => d.email), ["b@x"]);
eq("un refus ne compte pas comme restant",
  restantASigner([sign("declined", "a@x"), sign("sent", "b@x")]).map((d) => d.email), ["b@x"]);

// ══════════════════════════════════════════════════════════════════════
//  Ancres de signature
// ══════════════════════════════════════════════════════════════════════
console.log("\n== Ancres : positionner sans modifier le contrat ==");
// Deux ancres identiques poseraient les DEUX signatures au même endroit,
// donc sur la mauvaise partie. L'assertion vaut d'être gardée, mais
// TypeScript connaît les deux littéraux et refuse de comparer des types
// sans recouvrement : on passe par `string` pour comparer les VALEURS,
// c'est-à-dire ce qui changerait si quelqu'un les alignait un jour.
const ancres: string[] = [ANCRE_DONNEUR_ORDRE, ANCRE_SOUS_TRAITANT];
vrai("les deux ancres diffèrent", ancres[0] !== ancres[1]);
// Le point décisif : une ancre ne doit pas être une expression du contrat,
// sinon DocuSign poserait un champ à chaque occurrence.
for (const a of ancres) {
  vrai(`« ${a} » ne contient aucun mot du contrat`, !/[a-zà-ü]{4,}/i.test(a));
  vrai(`« ${a} » est court`, a.length <= 8);
}

// ══════════════════════════════════════════════════════════════════════
//  Entité juridique
// ══════════════════════════════════════════════════════════════════════
console.log("\n== Contrôle de l'entité avant envoi ==");
const complete = {
  id: "e-1", legalName: "OPTIMIVV", legalForm: "SASU", siret: "92808342700015",
  address: "2 rue Alfred Bruneau, 75016 Paris",
  representativeName: "M. Rosalie DAVID", representativeTitle: "Président",
};
vrai("entité complète acceptée", entiteComplete(complete).ok);
eq("sans représentant → refus motivé",
  entiteComplete({ ...complete, representativeName: "" }).manquant, ["représentant légal"]);
eq("sans SIRET ni adresse → deux motifs",
  entiteComplete({ ...complete, siret: "", address: "" }).manquant,
  ["SIRET", "adresse du siège"]);

console.log("\n== Instantané juridique : figé à l'envoi ==");
const snap = instantanerEntite(complete, new Date("2026-11-03T12:00:00Z"));
eq("raison sociale figée", snap.legal_name, "OPTIMIVV");
eq("représentant figé", snap.representative_name, "M. Rosalie DAVID");
eq("date de gel", snap.fige_le, "2026-11-03T12:00:00.000Z");
// Changer l'entité plus tard ne doit pas réécrire l'instantané déjà pris.
const apres = instantanerEntite({ ...complete, address: "Nouvelle adresse" }, new Date());
vrai("un instantané ultérieur est distinct", apres.address !== snap.address);
eq("l'ancien n'a pas bougé", snap.address, "2 rue Alfred Bruneau, 75016 Paris");

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
