// CLOISONNEMENT ET CHAÎNE D'ACCÈS — « le code existe » ne suffit pas.
//
// POURQUOI CE CONTRÔLE EXISTE. Un périmètre correct dans un module pur ne
// protège rien si personne ne l'applique, si l'écran d'attribution n'est pas
// gardé, ou si la restriction n'est posée que côté navigateur. Ce fichier
// remonte la chaîne : règle → application serveur → garde de route → écran
// d'administration → journal d'audit.
//
// Il lit des fichiers locaux. Ni réseau, ni base, ni secret.
//
// CE QU'IL NE FAIT PAS : il ne prouve pas qu'une session superviseur réelle
// est bien bloquée — cela demande un compte de test, que le client a demandé
// de ne pas créer sans son accord.

import { existsSync, readFileSync } from "node:fs";
import { canAccessPath, scopeForPath } from "@/lib/access-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}

const lu = new Map<string, string>();
function fichier(p: string): string {
  const cache = lu.get(p);
  if (cache !== undefined) return cache;
  const t = existsSync(p) ? readFileSync(p, "utf8") : "";
  lu.set(p, t);
  return t;
}

console.log("\n1. La règle est appliquée CÔTÉ SERVEUR");

const server = fichier("lib/supervision-server.ts");
vrai("lib/supervision-server.ts existe", server.length > 0);
vrai(
  "il importe les règles de périmètre au lieu de les réécrire",
  server.includes('from "./supervision-perimetre"'),
);
vrai("il appelle dossierDansPerimetre()", server.includes("dossierDansPerimetre("));
vrai("il vérifie perimetreConfigure() avant toute lecture", server.includes("perimetreConfigure("));
vrai(
  "un périmètre non configuré renvoie un jeu VIDE sans interroger la base",
  /if \(!perimetreConfigure\(perimetre\)\) return VIDE\(/.test(server),
);
vrai(
  "l'ancienne sémantique « liste vide = aucune restriction » a disparu du moteur",
  !server.includes("scope.countries.length &&") && !server.includes("scope.ownerIds.length &&"),
);
vrai(
  "les dossiers écartés sont comptés (ils ne disparaissent pas en silence)",
  server.includes("motifExclusion(") && server.includes("ecartes"),
);

const perimetreServer = fichier("lib/supervision-perimetre-server.ts");
vrai("lib/supervision-perimetre-server.ts est un module serveur", perimetreServer.startsWith('import "server-only"'));
vrai(
  "une lecture en échec ne relâche pas l'accès (repli sur le périmètre vide)",
  perimetreServer.includes("PERIMETRE_VIDE"),
);
vrai(
  "les activités hors familles sont filtrées même si elles sont stockées",
  perimetreServer.includes("autorisees.has(id)"),
);
vrai(
  "le Super Admin est traité explicitement, pas par une liste vide",
  perimetreServer.includes('portee: "admin"'),
);
vrai(
  "une garde de droit d'intervention est fournie pour les lots suivants",
  perimetreServer.includes("export async function assertDroitSuperviseur"),
);

console.log("\n2. L'écran d'attribution est réservé au Super Admin");

vrai(
  "/settings/superviseurs exige le scope admin",
  scopeForPath("/settings/superviseurs") === "admin",
);
vrai(
  "un commercial n'y accède pas",
  !canAccessPath(["commercial"], "/settings/superviseurs"),
);
vrai(
  "la planification non plus (c'est un acte d'administration)",
  !canAccessPath(["planification"], "/settings/superviseurs"),
);
vrai(
  "un superviseur ne peut pas ouvrir l'écran qui définit son propre périmètre",
  !canAccessPath(["superviseur"], "/settings/superviseurs"),
);
vrai("le Super Admin y accède", canAccessPath(["admin"], "/settings/superviseurs"));

const layout = fichier("app/(app)/settings/superviseurs/layout.tsx");
vrai("la route porte une garde de layout", layout.includes("requireAdmin()"));
vrai(
  "la garde est bien dans le layout (couvre les sous-routes futures)",
  layout.includes("export default async function"),
);

console.log("\n3. L'action d'écriture revérifie, valide et journalise");

const actions = fichier("app/(app)/settings/superviseurs/actions.ts");
vrai("l'action existe", actions.includes("export async function enregistrerPerimetre"));
vrai('elle revérifie le rôle admin côté serveur', actions.includes('hasScope("admin")'));
vrai(
  "elle refuse les pays inconnus",
  actions.includes("COUNTRIES as string[]") && actions.includes("Pays inconnu"),
);
vrai(
  "elle refuse les activités hors des deux familles",
  actions.includes("horsFamilles"),
);
vrai(
  "elle vérifie que le compte porte bien le rôle superviseur",
  actions.includes("estSuperviseur"),
);
vrai(
  "un superviseur ne peut pas se mettre dans sa propre liste de commerciaux",
  actions.includes("sa propre liste"),
);
vrai("elle journalise l'attribution", actions.includes('action: "supervisor.scope.set"'));
vrai(
  "le journal garde l'état AVANT et APRÈS",
  actions.includes("before:") && actions.includes("after:"),
);
vrai(
  "une révocation est possible d'un seul geste",
  actions.includes("export async function revoquerPerimetre"),
);
vrai(
  "le namespace d'audit documente la nouvelle action",
  fichier("lib/audit.ts").includes("supervisor.scope.set"),
);

console.log("\n4. L'écran est réellement atteignable");

const index = fichier("app/(app)/settings/page.tsx");
vrai("l'index des Paramètres propose le lien", index.includes('href="/settings/superviseurs"'));
const page = fichier("app/(app)/settings/superviseurs/page.tsx");
vrai("la page monte le composant d'attribution", page.includes("<PerimetresSuperviseurs"));
vrai(
  "la page lit les données par la couche serveur dédiée",
  page.includes("getDonneesAdminPerimetres()"),
);
vrai(
  "la règle « fermé par défaut » est écrite à l'écran, pas seulement dans le code",
  page.includes("Fermé par défaut"),
);
const ui = fichier("app/(app)/settings/superviseurs/PerimetresSuperviseurs.tsx");
vrai("les cinq pays sont proposés depuis la source unique", ui.includes("COUNTRIES.map"));
vrai('une option « Tout sélectionner » existe', ui.includes("Tout sélectionner"));
vrai("les quatre droits d'intervention sont proposés", ui.includes("DROITS_ORDONNES.map"));
vrai(
  "les branches sans activité sont affichées avec leur explication",
  ui.includes("branchesSansActivite"),
);
vrai(
  "l'interface avertit quand le périmètre saisi n'ouvre aucun accès",
  ui.includes("aucune donnée"),
);

console.log("\n5. Le superviseur sait pourquoi il ne voit rien");

const leads = fichier("app/(app)/leads/page.tsx");
vrai(
  "la page /leads choisit le cockpit via le périmètre",
  leads.includes("getPerimetreSuperviseur()"),
);
vrai(
  "un périmètre non configuré affiche une explication, pas un écran vide",
  leads.includes("PerimetreNonConfigure"),
);

console.log("\n6. La migration dit la bonne sémantique");

const migration = fichier("supabase/migrations/20261105000001_superviseur_perimetre_ferme.sql");
vrai("la migration existe", migration.length > 0);
for (const col of ["can_request_action", "can_reassign", "can_set_priority", "include_unassigned"]) {
  vrai(`la colonne ${col} est ajoutée`, migration.includes(col));
}
vrai(
  "la migration dit explicitement qu'une liste vide = aucun accès",
  /VIDE = AUCUN acc/i.test(migration) || /AUCUN acc/i.test(migration),
);
vrai(
  "elle n'ajoute AUCUNE politique RLS globale pour le rôle superviseur",
  !/create policy[^;]*superviseur/i.test(migration),
);
vrai(
  "elle n'invente pas de périmètre pour les lignes existantes",
  !/update supervisor_scopes\s+set/i.test(migration),
);
// La table `leads` ne doit donner aucun accès au rôle superviseur : la lecture
// agrégée passe par le service-role, où le périmètre est appliqué dans le code.
const rls = fichier("supabase/migrations/20260515000005_init_rls.sql");
vrai(
  "la politique de lecture des leads ne cite pas le rôle superviseur",
  rls.includes("leads visible to owner / admin / planner") && !rls.includes("superviseur"),
);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
