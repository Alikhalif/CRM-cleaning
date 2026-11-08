// Notifications intermodules — actions attendues du back-office.
//
// Niveau de preuve : la LOGIQUE (naissance, fermeture, escalade, doublons,
// bornes) est EXÉCUTÉE ici. La base, le moteur et les branchements sont LUS.
// La persistance réelle et les changements de statut en base se prouvent par
// la section 8 de `npm run recette:facturation`.

import { existsSync, readFileSync } from "node:fs";
import {
  attendues, CONFIG_INITIALE, lireConfig, reconcilier, type EtatDossier, type EtatFacture, type Ouverte,
} from "@/lib/actions-back-office/shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const T0 = new Date("2026-11-09T10:00:00Z");
const h = (n: number) => new Date(T0.getTime() + n * 3_600_000);
const C = CONFIG_INITIALE;

console.log("\n1. Ce qui est attendu, état par état — EXÉCUTÉ");
const d = (status: string, finaleActive = false): EtatDossier => ({ id: `d-${status}${finaleActive ? "-facture" : ""}`, status, pays: "FR", client: "Client", finaleActive });
const A = attendues([d("a_planifier"), d("finalise"), d("valide"), d("valide", true), d("planifie"), d("solde")], [], T0, C);
vrai("à planifier → action « à planifier »", A.some((a) => a.type === "dossier.a_planifier"));
vrai("… SANS notification (quote.signed l'a déjà faite : pas de doublon)", A.find((a) => a.type === "dossier.a_planifier")?.notifier === false);
vrai("terminée → « à valider », notifiée", A.some((a) => a.type === "dossier.a_valider" && a.notifier));
vrai("validée sans facture → « facture à préparer »", A.filter((a) => a.type === "facture.a_preparer").length === 1);
vrai("validée AVEC facture active → plus rien à préparer", !A.some((a) => a.entityId === "d-valide-facture"));
vrai("planifiée, soldée → aucune action", !A.some((a) => a.entityId === "d-planifie" || a.entityId === "d-solde"));
vrai("le pays du dossier accompagne l'action (cloisonnement CDC §11)", A.every((a) => a.pays === "FR"));

const f = (o: Partial<EtatFacture>): EtatFacture => ({ id: "f", type: "finale", status: "envoye", pays: "BE", num: "FAC-1", client: "C", emiseAt: T0.toISOString(), termeSlug: "30j", ...o });
vrai("finale brouillon → « à émettre »", attendues([], [f({ status: "brouillon", emiseAt: null })], T0, C).some((a) => a.type === "facture.a_emettre"));
vrai("finale à 30 j : pas impayée au 29e jour", attendues([], [f({})], h(29 * 24), C).length === 0);
vrai("… impayée au 30e jour (échéance + 0 j)", attendues([], [f({})], h(30 * 24), C).some((a) => a.type === "facture.impayee"));
vrai("finale payée → rien", attendues([], [f({ status: "paye" })], h(90 * 24), C).length === 0);
vrai("acompte : impayé après 7 jours", attendues([], [f({ type: "acompte", termeSlug: null })], h(7 * 24), C).some((a) => a.type === "acompte.impaye"));
vrai("acompte : pas avant", attendues([], [f({ type: "acompte", termeSlug: null })], h(6 * 24), C).length === 0);
vrai("acompte brouillon : jamais « à émettre » (émis à la signature)", attendues([], [f({ type: "acompte", status: "brouillon", emiseAt: null })], T0, C).length === 0);

console.log("\n2. Ouvrir, fermer, escalader — EXÉCUTÉ");
const voulue = attendues([d("finalise")], [], T0, C);
const ouverte: Ouverte = { id: "o1", cle: voulue[0].cle, type: "dossier.a_valider", ouverteAt: T0.toISOString(), escaladeeAt: null };
const p0 = reconcilier(voulue, [], T0, C);
vrai("état nouveau → l'action s'ouvre", p0.aOuvrir.length === 1);
const p1 = reconcilier(voulue, [ouverte], h(1), C);
vrai("déjà ouverte → rien à ouvrir (aucun doublon)", p1.aOuvrir.length === 0 && p1.aFermer.length === 0);
vrai("état produit DEUX fois → une seule ouverture", reconcilier([...voulue, ...voulue], [], T0, C).aOuvrir.length === 1);
vrai("état toujours présent → l'action RESTE ouverte, quel que soit le temps", reconcilier(voulue, [ouverte], h(24 * 365), C).aFermer.length === 0);
vrai("état disparu (intervention validée) → l'action se ferme", reconcilier([], [ouverte], h(2), C).aFermer.length === 1);
vrai("avant le délai (47 h) → pas d'escalade", reconcilier(voulue, [ouverte], h(47), C).aEscalader.length === 0);
vrai("au délai (48 h) → escalade", reconcilier(voulue, [ouverte], h(48), C).aEscalader.length === 1);
vrai("déjà escaladée → pas une seconde fois", reconcilier(voulue, [{ ...ouverte, escaladeeAt: h(48).toISOString() }], h(100), C).aEscalader.length === 0);
vrai("une action escaladée reste OUVERTE", reconcilier(voulue, [{ ...ouverte, escaladeeAt: h(48).toISOString() }], h(100), C).aFermer.length === 0);
vrai("une action dont l'état a disparu ne s'escalade pas", reconcilier([], [ouverte], h(100), C).aEscalader.length === 0);

console.log("\n3. Délais paramétrables, bornés — EXÉCUTÉ");
vrai("réglage absent → valeurs initiales documentées", JSON.stringify(lireConfig(null)) === JSON.stringify(CONFIG_INITIALE));
vrai("valeur modifiée → appliquée", lireConfig({ escaladeHeures: { "dossier.a_valider": 12 } }).escaladeHeures["dossier.a_valider"] === 12);
vrai("délai modifié → l'escalade suit", reconcilier(voulue, [ouverte], h(12), lireConfig({ escaladeHeures: { "dossier.a_valider": 12 } })).aEscalader.length === 1);
vrai("0 h, négatif, texte → ramenés aux bornes ou à l'initial", lireConfig({ escaladeHeures: { "dossier.a_valider": 0 } }).escaladeHeures["dossier.a_valider"] === 1
  && lireConfig({ escaladeHeures: { "dossier.a_valider": "x" } }).escaladeHeures["dossier.a_valider"] === 48);
vrai("10 ans → plafonné à 90 jours (une alerte ne se fait pas taire)", lireConfig({ escaladeHeures: { "facture.impayee": 87600 } }).escaladeHeures["facture.impayee"] === 2160);

console.log("\n4. La base — migration 20261109000006 (lue)");
const M = lire("supabase/migrations/20261109000006_actions_back_office.sql").toLowerCase();
vrai("préparée, non appliquée", M.includes("préparée, non appliquée"));
vrai("une seule action OUVERTE par clé (index unique partiel)", M.includes("create unique index if not exists uq_actions_bo_ouverte") && M.includes("on actions_back_office (cle) where fermee_at is null"));
vrai("AUCUNE colonne « lue » : lire ne peut rien fermer", !/\blu(e)?_at\b|read_at/.test(M.slice(M.indexOf("create table if not exists actions_back_office"), M.indexOf("create unique index"))));
vrai("fermeture : « action effectuée » ou « objet disparu », rien d'autre", M.includes("raison_fermeture in ('action_effectuee', 'objet_disparu')"));
vrai("une action fermée ne se rouvre pas ; rien ne se supprime (même le service-role)", M.includes("fermée : elle ne se modifie plus") && M.includes("pas de suppression"));
vrai("RLS : un planificateur ne voit que SES pays", M.includes("pays = any (u.countries)"));
vrai("RLS : aucune politique d'écriture", !/for (insert|update|delete|all)/.test(M));
vrai("informations ponctuelles : une clé, un envoi (clé primaire)", M.includes("cle        text primary key"));

console.log("\n5. Le moteur et ses branchements (lus)");
const E = lire("lib/actions-back-office/engine-server.ts");
vrai("notification seulement si L'INSERTION a réussi (le perdant d'une course ne notifie pas)", /if \(error \|\| !data\) continue;\s+nOuvertes\+\+;\s+if \(a\.notifier\)/.test(E));
vrai("notification ciblée sur les planificateurs du PAYS", E.includes("notifierPlanificateursDuPays(a.pays") && E.includes('.contains("countries", [pays])'));
vrai("escalade : mise à jour conditionnelle, puis notification au Super Admin", E.includes('.is("escaladee_at", null).is("fermee_at", null)') && E.includes('notifyRole("admin"'));
vrai("contrat DocuSign signé : une fois par enveloppe, ciblé par pays", E.includes("docusign.signe:${e.envelope_id}") && E.includes("notifierPlanificateursDuPays(e.contrat?.dossier?.lead?.country"));
vrai("délais lus par le SERVICE-ROLE (le cron n'a pas de session)", /async function config\(\)[\s\S]{0,200}supabaseServiceRole\(\)/.test(E));
vrai("sans migration : le moteur le dit, ne fabrique rien", E.includes("migration non appliquée ?"));
const R = lire("app/api/presence/evaluate/route.ts");
vrai("cron : passe dédiée, isolée par try/catch", /let backOffice[\s\S]{0,120}try \{\s+backOffice = await evaluerActionsBackOffice\(\);/.test(R));
const P = lire("app/(app)/planification/actions.ts");
const D = lire("app/(app)/_shared/document-actions.ts");
const branches = (src: string) => (src.match(/declencherActionsBackOffice\(\); \/\/ alerte immédiate/g) ?? []).length;
vrai("alerte IMMÉDIATE : 7 actions de Planification branchées", branches(P) === 7);
vrai("… et 4 actions documentaires (signature, émission, encaissement, annulation)", branches(D) === 4);
vrai("immédiat sans ralentir l'utilisateur : after() de Next", lire("lib/actions-back-office/declencher.ts").includes('import { after } from "next/server"'));

console.log("\n6. Les écrans (lus)");
const U = lire("app/(app)/planification/ActionsAttendues.tsx");
// Sur le CODE seulement : la phrase « aucun bouton marquer comme lu » vit
// dans un commentaire du panneau, et un motif sur le texte brut la prenait
// pour un bouton — faux positif constaté le 2026-11-09.
const codeU = U.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
vrai("le panneau n'a AUCUN bouton « lu »", !/marquer[^"]*lu|read_at|markRead/i.test(codeU) && !/<button/.test(codeU));
vrai("le panneau lit par la SESSION (la RLS décide)", U.includes("await supabaseServer()") && !U.includes("supabaseServiceRole"));
const S = lire("app/(app)/settings/integrations/actions.ts");
const i = S.indexOf("export async function enregistrerDelaisEscalade(");
vrai("délais : Super Admin, en première instruction", i >= 0 && S.slice(i).indexOf("assertAdmin()") < S.slice(i).indexOf("supabaseServer()"));
vrai("délais : bornés par la MÊME fonction que le moteur", S.slice(i).includes("const config = lireConfig(brut);"));
vrai("délais : modification tracée (avant / après)", S.slice(i).includes("before: { key: CLE_CONFIG"));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
