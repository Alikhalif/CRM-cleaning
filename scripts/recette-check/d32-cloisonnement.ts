// D32 — cloisonnement des données par pays et entité, à tous les niveaux.
//
// Niveau de preuve : la RÈGLE est EXÉCUTÉE (matrice cinq pays × modes ×
// entités × rôles) ; le SCHÉMA après D32 est REJOUÉ depuis les migrations par
// le lecteur (scripts/d32/lecteur.ts) ; le serveur est LU. L'exécution réelle
// des politiques, sous de vraies sessions, est la section 10 de
// `npm run recette:facturation`. RIEN de D32 n'est validé avant elle.

import { existsSync, readFileSync } from "node:fs";
import { lireSchema } from "../d32/lecteur";
import { CIBLE, CORRESPONDANCE, EXCLUES, generer } from "../d32/generer";
import { planifPeutVoir, type PerimetrePlanif } from "@/lib/perimetre/regle-shared";
import { dansPerimetre } from "@/lib/notifications/perimetre-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const PAYS = ["FR", "CH", "LU", "BE", "CA"] as const;
const E = (p: string) => `ent-${p.toLowerCase()}`;

console.log("\n1. La règle — EXÉCUTÉE sur la matrice");
for (const p of PAYS) {
  const u: PerimetrePlanif = { herite: false, countries: [p], entitesAutorisees: [E(p)] };
  for (const q of PAYS) {
    vrai(`strict ${p}/${E(p)} · objet ${q}/${E(q)} → ${p === q ? "visible" : "REFUSÉ"}`, planifPeutVoir(u, { pays: q, entiteId: E(q) }) === (p === q));
  }
  vrai(`strict ${p} · même pays, AUTRE entité → REFUSÉ`, !planifPeutVoir(u, { pays: p, entiteId: "ent-autre" }));
}
const neuf: PerimetrePlanif = { herite: false, countries: ["FR"], entitesAutorisees: [] };
vrai("NOUVEAU compte, aucune entité cochée → AUCUN accès (décision du client)", PAYS.every((p) => !planifPeutVoir(neuf, { pays: p, entiteId: E(p) })));
vrai("strict, pays inconnu → refusé (fail-closed)", !planifPeutVoir({ herite: false, countries: ["FR"], entitesAutorisees: [E("FR")] }, { pays: null, entiteId: E("FR") }));
vrai("strict, entité inconnue → refusé (fail-closed)", !planifPeutVoir({ herite: false, countries: ["FR"], entitesAutorisees: [E("FR")] }, { pays: "FR", entiteId: null }));
vrai("strict multi-pays FR+BE, deux entités → FR et BE, pas CH", (() => {
  const u = { herite: false, countries: ["FR", "BE"], entitesAutorisees: [E("FR"), E("BE")] };
  return planifPeutVoir(u, { pays: "BE", entiteId: E("BE") }) && !planifPeutVoir(u, { pays: "CH", entiteId: E("CH") });
})());
vrai("EXISTANT, mode hérité → accès d'avant D32 conservé (aucun compte bloqué)", PAYS.every((p) => planifPeutVoir({ herite: true, countries: [], entitesAutorisees: [] }, { pays: p, entiteId: E(p) })));

console.log("\n2. Les notifications suivent le mode (D31 × D32) — EXÉCUTÉ");
const dest = (herite: boolean, entites: string[]) => ({ roles: ["planification"], countries: ["FR"], entitesAutorisees: entites, herite });
vrai("hérité, aucune entité → notifications FR reçues (règle D31)", dansPerimetre(dest(true, []), { pays: "FR", entiteId: E("FR") }));
vrai("STRICT, aucune entité → AUCUNE notification", !dansPerimetre(dest(false, []), { pays: "FR", entiteId: E("FR") }));
vrai("strict, entité cochée → reçue ; autre entité → refusée", dansPerimetre(dest(false, [E("FR")]), { pays: "FR", entiteId: E("FR") })
  && !dansPerimetre(dest(false, [E("FR")]), { pays: "FR", entiteId: E("CH") }));
vrai("dans tous les modes : pays non couvert → refusée", !dansPerimetre(dest(true, []), { pays: "BE", entiteId: E("BE") }));

console.log("\n3. Le schéma APRÈS D32 — rejoué depuis les 185 migrations");
const avant = lireSchema("supabase/migrations", CIBLE);
const apres = lireSchema();
const ouvertesAvant = new Set([...avant.politiques.values()].filter((p) => /is_planificateur\(\)/i.test(p.texte)).map((p) => p.table));
const ouvertesApres = [...apres.politiques.values()].filter((p) => /is_planificateur\(\)/i.test(p.texte));
vrai(`avant D32 : ${ouvertesAvant.size} tables ouvertes à toute planificatrice (le constat)`, ouvertesAvant.size >= 40);
vrai("après D32 : il ne reste QUE les tables d'exclusion justifiée", ouvertesApres.every((p) => !!EXCLUES[p.table]));
vrai("chaque table ouverte avant D32 est soit cloisonnée, soit justifiée", [...ouvertesAvant].every((t) => !!CORRESPONDANCE[t] || !!EXCLUES[t]));
const appels = [...apres.politiques.values()].flatMap((p) => [...p.texte.matchAll(/planif_[a-z_]+\(([^()]*)\)/g)].map((m) => ({ p, args: m[1] })));
vrai(`toutes les politiques cloisonnées qualifient leurs colonnes (${appels.length} appels)`, appels.length > 60 && appels.every(({ p, args }) =>
  args.split(",").map((a) => a.trim()).every((a) => a === "null" || a.startsWith(`${p.table}.`))));
vrai("plus AUCUNE table sans RLS (D33 : les quatre compteurs)", [...apres.colonnes.keys()].every((t) => apres.rls.has(t)));
vrai("aucune vue (une vue contournerait la RLS)", apres.vues.size === 0);
const M = lire(`supabase/migrations/${CIBLE}`);
vrai("migration : préparée, non appliquée", M.includes("PRÉPARÉE, NON APPLIQUÉE"));
vrai("nouveaux comptes STRICTS par défaut", M.includes("perimetre_herite boolean not null default false"));
vrai("comptes EXISTANTS passés en mode hérité (aucun blocage)", /update users u\s+set perimetre_herite = true\s+where exists[\s\S]{0,140}r\.slug = 'planification'/.test(M));
vrai("D34 : numérotations retirées à PUBLIC et à la clé anonyme", M.includes("revoke all on function next_contract_num(integer) from public, anon")
  && M.includes("revoke all on function allocate_subcontract_ref(text, text) from public, anon")
  && M.includes("revoke all on function allocate_document_archive_ref(text) from public, anon"));
vrai("fonctions de périmètre : retirées à la clé anonyme", M.includes("execute format('revoke all on function %s from public, anon', f)"));
const g = generer();
vrai("la migration est EXACTEMENT celle que produit le générateur (aucune retouche manuelle)", g.sql === M);
vrai(`${g.reecrites} politiques réécrites sur ${g.tables.length} tables`, g.reecrites >= 69 && g.tables.length >= 34);

console.log("\n4. Le serveur et l'API — lus");
const DB = lire("lib/documents/dashboard-server.ts");
vrai("/documents : lu par la SESSION (plus de service-role)", DB.includes("const sb = await supabaseServer();") && !DB.includes("supabaseServiceRole"));
const CS = lire("lib/documents/contracts-server.ts");
vrai("fiche client : contrats et passages par la session", CS.includes("const { data } = await db\n    .from(\"contracts\")") && CS.includes("(lot) => db\n        .from(\"contract_passages\")"));
vrai("fiche client : interventions par la session", /getClientInterventions[\s\S]{0,260}const sb = await supabaseServer\(\);/.test(CS));
for (const r of ["app/api/certificat-hotte/route.ts", "app/api/certificat-hotte/envoyer/route.ts"]) {
  const s = lire(r);
  // Forme EXACTE de la garde ET son refus : une simple présence des mots
  // laissait passer `if (false && …)` — mutation non détectée le 2026-11-09.
  vrai(`${r} : dossier et lead VISIBLES exigés, sinon refus`,
    /\n  if \(\(body\.dossierId && !\(await dossierVisible\(body\.dossierId\)\)\)\s+\|\| \(body\.leadId && !\(await leadVisible\(body\.leadId\)\)\)\) \{\s+return NextResponse\.json\(\{ ok: false, error: "hors_perimetre" \}, \{ status: 404 \}\);/.test(s));
  const i = s.indexOf("dossierVisible(body.dossierId)"), j = s.indexOf("supabaseServiceRole()");
  vrai(`${r} : la vérification précède le service-role`, i > 0 && (j < 0 || i < j));
}
vrai("Planification : la page applique LA règle (même que la base)", lire("app/(app)/planification/page.tsx").includes("planifPeutVoir({ herite: false, countries: myCountries, entitesAutorisees: myEntites }"));
vrai("utilisateurs : le mode est affiché tel qu'il est", lire("app/(app)/settings/users/UsersList.tsx").includes("strict : aucune entité = aucun accès"));

console.log("\n5. La procédure des comptes existants — lue");
const PR = lire("supabase/procedures/d32-passage-strict.sql").toLowerCase();
vrai("inventaire en LECTURE SEULE d'abord", PR.includes("begin transaction read only"));
vrai("montre ce que chaque compte perdrait", PR.includes("leads_en_strict") && PR.includes("leads_aujourdhui"));
vrai("montre les données sans périmètre déterminable", PR.includes("leads sans entité") && PR.includes("clients directs sans pays ni entité"));
vrai("un seul compte, nommément ; refusé sans pays ou sans entité", PR.includes("where email = ") && PR.includes("cardinality(countries) > 0") && PR.includes("cardinality(entites_autorisees) > 0"));
vrai("se termine par ROLLBACK", PR.trim().endsWith("rollback;"));
vrai("aucune suppression", !/\bdelete\s+from\b/.test(PR));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
