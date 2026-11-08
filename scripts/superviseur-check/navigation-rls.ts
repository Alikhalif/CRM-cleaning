// D20 · D21 · D22 — politiques RLS réelles, navigation, et gardes serveur.
//
// POURQUOI CE CONTRÔLE EXISTE. Le 9 novembre, l'audit a déclaré D20 :
// « `subcontractor_profiles` a la RLS activée et AUCUNE politique ». C'était
// FAUX. La politique existe depuis `20260930000001` — créée dans une boucle
// `foreach … execute format('create policy %I on %I …')`, qu'une recherche de
// `on subcontractor_profiles` ne pouvait pas voir. Troisième détection fautive
// de la même journée, même cause : un motif trop étroit.
//
// Ce fichier remplace le motif par un lecteur qui comprend les trois formes
// employées dans les 177 migrations — politique littérale, boucle dynamique,
// suppression — et rejoue leur effet DANS L'ORDRE des fichiers.
//
// Il lit des fichiers locaux. Ni réseau, ni base, ni secret.
//
// CE QU'IL NE FAIT PAS : il n'exécute aucune politique. Il prouve qu'elle
// EXISTE et ce qu'elle EXIGE ; seule une base réelle (recette) prouvera qu'un
// commercial authentifié est refusé. Aucun Postgres n'est installé sur ce
// poste à ce jour — `npm run preflight` échoue faute de `psql`.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NAV_GROUPS } from "@/lib/nav";
import { canAccessPath, scopeForPath } from "@/lib/access-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// ── 1. Lecteur de politiques ────────────────────────────────────────────────

type Politique = { table: string; nom: string; sql: string; fichier: string };

const DOSSIER = "supabase/migrations";
const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort();

const rlsActive = new Set<string>();
const politiques = new Map<string, Politique>(); // clé : table|nom

const ident = String.raw`(?:public\.)?"?([a-z_][a-z0-9_]*)"?`;
const nomPol = String.raw`("[^"]+"|[a-z_][a-z0-9_]*)`;

function sansCommentaires(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

for (const f of fichiers) {
  const sql = sansCommentaires(lire(join(DOSSIER, f))).toLowerCase();

  // Événements dans l'ordre du fichier : create / drop, littéraux ou en boucle.
  type Ev = { pos: number; fn: () => void };
  const evs: Ev[] = [];

  for (const m of sql.matchAll(new RegExp(String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${ident}\s+enable\s+row\s+level\s+security`, "g"))) {
    evs.push({ pos: m.index!, fn: () => rlsActive.add(m[1]) });
  }
  for (const m of sql.matchAll(new RegExp(String.raw`create\s+policy\s+${nomPol}\s+on\s+${ident}([\s\S]*?);`, "g"))) {
    const nom = m[1].replace(/"/g, "");
    const table = m[2];
    evs.push({ pos: m.index!, fn: () => politiques.set(`${table}|${nom}`, { table, nom, sql: m[3], fichier: f }) });
  }
  for (const m of sql.matchAll(new RegExp(String.raw`drop\s+policy\s+(?:if\s+exists\s+)?${nomPol}\s+on\s+${ident}`, "g"))) {
    const nom = m[1].replace(/"/g, "");
    const table = m[2];
    evs.push({ pos: m.index!, fn: () => politiques.delete(`${table}|${nom}`) });
  }
  // Boucle dynamique : foreach t in array array['a','b'] loop … execute format(
  //   'create policy %I on %I …', t||'_suffixe', t) … end loop
  for (const m of sql.matchAll(/foreach\s+(\w+)\s+in\s+array\s+array\[([^\]]+)\]\s+loop([\s\S]*?)end\s+loop/g)) {
    const variable = m[1];
    const tables = [...m[2].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
    const corps = m[3];
    const creations = [...corps.matchAll(new RegExp(String.raw`format\(\s*'create\s+policy\s+%i\s+on\s+%i([^']*)'\s*,\s*${variable}\s*\|\|\s*'([a-z0-9_]+)'`, "g"))];
    for (const t of tables) {
      for (const c of creations) {
        evs.push({ pos: m.index!, fn: () => politiques.set(`${t}|${t}${c[2]}`, { table: t, nom: `${t}${c[2]}`, sql: c[1], fichier: f }) });
      }
    }
  }

  evs.sort((a, b) => a.pos - b.pos).forEach((e) => e.fn());
}

const pourTable = (t: string) => [...politiques.values()].filter((p) => p.table === t);

console.log(`\n1. Lecteur de politiques — ${fichiers.length} migrations rejouées dans l'ordre`);

vrai("au moins 150 migrations lues (le lecteur ne tourne pas à vide)", fichiers.length >= 150);
vrai("la forme LITTÉRALE est reconnue (clients)", pourTable("clients").length >= 2);
vrai(
  "la SUPPRESSION est reconnue (la politique anon de l'échafaudage a disparu)",
  !pourTable("clients").some((p) => /to\s+anon/.test(p.sql)),
);
vrai(
  "le REMPLACEMENT est reconnu (contracts_select n'est plus `using (true)`)",
  !!politiques.get("contracts|contracts_select") &&
    !/using\s*\(\s*true\s*\)/.test(politiques.get("contracts|contracts_select")!.sql),
);

// Tables sous RLS sans aucune politique : refus total aux rôles de session.
// Légitime pour une table que SEUL le service-role touche ; à justifier sinon.
const sansPolitique = [...rlsActive].filter((t) => pourTable(t).length === 0).sort();
console.log(`\n  info  ${rlsActive.size} tables sous RLS · ${sansPolitique.length} sans politique` +
  (sansPolitique.length ? ` : ${sansPolitique.join(", ")}` : ""));
// Ces quatre-là ne sont lues QUE par le service-role (vérifié le 9 novembre :
// lib/auth-throttle.ts, lib/docusign/oauth-server.ts, lib/webhook-dedup.ts) —
// jetons OAuth, compteurs d'échecs de connexion, dédoublonnage des webhooks.
// Le refus total aux sessions y est VOULU. Une cinquième table apparaîtrait
// ici : à justifier avant de l'ajouter, car elle est illisible depuis l'écran.
// `facture_counters` (20261109000003) : compteurs de numérotation par société,
// écrits UNIQUEMENT par `allouer_numero_facture()` (SECURITY DEFINER) depuis
// les triggers d'émission. Aucune session ne doit pouvoir lire ni brûler un
// numéro — le refus total est la protection.
const SERVICE_ROLE_SEUL = [
  "auth_throttle", "docusign_connections", "docusign_oauth_states", "facture_counters", "webhook_events",
];
vrai(
  "seules les tables réservées au service-role sont sans politique",
  JSON.stringify(sansPolitique) === JSON.stringify(SERVICE_ROLE_SEUL),
);

console.log("\n2. D20 — `subcontractor_profiles` : la politique EXISTE (l'audit s'était trompé)");

for (const t of ["subcontractor_profiles", "subcontractor_documents", "subcontractor_invoices"]) {
  const sel = politiques.get(`${t}|${t}_select`);
  const ecr = politiques.get(`${t}|${t}_write`);
  vrai(`${t} : RLS activée`, rlsActive.has(t));
  vrai(`${t} : politique de LECTURE présente (${sel?.fichier ?? "absente"})`, !!sel);
  vrai(`${t} : politique d'ÉCRITURE présente`, !!ecr);
  // Refus du commercial : le prédicat ne mentionne que les deux rôles
  // back-office — aucune clause de propriété (`auth.uid()`), aucun `true`.
  const predicat = (p?: Politique) => (p?.sql ?? "").replace(/\s+/g, " ");
  vrai(
    `${t} : lecture limitée à is_admin() OU is_planificateur() — le commercial est refusé`,
    /using \(is_admin\(\) or is_planificateur\(\)\)/.test(predicat(sel)) &&
      !/auth\.uid\(\)|using \(true\)/.test(predicat(sel)),
  );
  vrai(
    `${t} : écriture limitée aux mêmes rôles, en USING et en WITH CHECK`,
    /using \(is_admin\(\) or is_planificateur\(\)\) with check \(is_admin\(\) or is_planificateur\(\)\)/.test(predicat(ecr)),
  );
  vrai(`${t} : aucune politique ouverte à anon`, !pourTable(t).some((p) => /to anon/.test(predicat(p))));
}

const helpers = lire(join(DOSSIER, "20260515000005_init_rls.sql"));
vrai(
  "is_planificateur() teste le slug `planification` — celui qu'emploie l'application",
  /r\.slug\s*=\s*'planification'/.test(helpers),
);
vrai(
  "aucune migration ne redéfinit is_planificateur() ou is_admin() après coup",
  fichiers.filter((f) => /create\s+or\s+replace\s+function\s+(public\.)?(is_planificateur|is_admin)\s*\(/i.test(lire(join(DOSSIER, f)))).length === 1,
);

console.log("\n3. D20 — la chaîne applicative jusqu'au contrat");

vrai("/sous-traitants est back-office", scopeForPath("/sous-traitants") === "backOffice");
vrai("/planification (où naît le contrat) est back-office", scopeForPath("/planification/x") === "backOffice");
vrai("un commercial n'atteint pas /sous-traitants", !canAccessPath(["commercial"], "/sous-traitants/abc"));
vrai("la planification l'atteint", canAccessPath(["planification"], "/sous-traitants/abc"));

const actionsST = lire("app/(app)/sous-traitants/actions.ts");
// Découpe par `export async function` — et non par accolades : une signature
// à type objet en ligne (`input: { … }`) fermait la recherche trop tôt.
const nomsST = [...actionsST.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
vrai("les actions sous-traitants sont lues", nomsST.length >= 3);
for (const nom of nomsST) {
  vrai(`action ${nom} : garde ensurePlanner()`, corpsDe(actionsST, nom).includes("ensurePlanner()"));
}

const contrats = lire("lib/sous-traitance/contrats-server.ts");
vrai(
  "le contrat lit raison sociale, SIRET, SIREN, adresse et dirigeant dans la fiche",
  /profil:subcontractor_profiles\(raison_sociale, nom_commercial, siren, siret, adresse, cp_ville, dirigeant, phone\)/.test(contrats),
);
vrai(
  "il les lit par la SESSION — la RLS s'applique, pas de contournement service-role",
  /getPrestataires\(\)[\s\S]{0,120}supabaseServer\(\)/.test(contrats),
);
vrai(
  "une fiche incomplète est signalée, pas devinée (anomaliesPrestataireFiche)",
  contrats.includes("anomaliesPrestataireFiche("),
);

console.log("\n4. D21 · D22 — les deux modules sont dans la navigation");

const entrees = NAV_GROUPS.flatMap((g) => g.items);
const icones = lire("components/Icon/Icon.tsx");
for (const href of ["/clients", "/certificat-hotte"]) {
  const e = entrees.find((i) => i.href === href);
  vrai(`${href} est une entrée de NAV_GROUPS`, !!e);
  vrai(`${href} : son icône « ${e?.icon} » est dessinée`, !!e && new RegExp(String.raw`\n  "?${e.icon}"?: \(`).test(icones));
}
vrai(
  "la page existe bien derrière chaque entrée (aucun lien vers un 404)",
  entrees.every((i) => existsSync(join("app/(app)", i.href, "page.tsx"))),
);

const sidebar = lire("components/Sidebar/Sidebar.tsx");
const palette = lire("components/CommandPalette/CommandPalette.tsx");
vrai("la barre latérale filtre par canAccessPath()", /items\.filter\(\(item\) => canAccessPath\(roles, item\.href\)\)/.test(sidebar));
vrai("la palette ⌘K lit NAV_GROUPS", palette.includes("for (const group of NAV_GROUPS)"));
vrai("la palette ⌘K filtre par canAccessPath()", palette.includes("canAccessPath(roles, r.href)"));

// Ce que chaque rôle VOIT — le même calcul que la barre et la palette.
const voit = (roles: string[], href: string) => canAccessPath(roles, href);
vrai("commercial : voit Clients", voit(["commercial"], "/clients"));
vrai("commercial : ne voit PAS Certificat de hotte", !voit(["commercial"], "/certificat-hotte"));
vrai("planification : voit les deux", voit(["planification"], "/clients") && voit(["planification"], "/certificat-hotte"));
vrai("admin : voit les deux", voit(["admin"], "/clients") && voit(["admin"], "/certificat-hotte"));
vrai(
  "le module Certificat de hotte rend un 404 hors périmètre (garde dans son layout)",
  /await requireBackOffice\(\)/.test(lire("app/(app)/certificat-hotte/layout.tsx")),
);

console.log("\n5. D21 — entrer dans la navigation n'élargit AUCUN droit");

vrai("/clients reste ouvert à tous (la RLS cloisonne les lignes)", scopeForPath("/clients") === "all");
vrai("la fiche /clients/<id> reste ouverte", scopeForPath("/clients/0000") === "all");
vrai("/clients/new est back-office (le préfixe le plus long gagne)", scopeForPath("/clients/new") === "backOffice");
vrai("« Créer un client » disparaît de la palette d'un commercial", !voit(["commercial"], "/clients/new"));
vrai("/clients/new a sa garde de layout", /await requireBackOffice\(\)/.test(lire("app/(app)/clients/new/layout.tsx")));

const rlsInit = lire(join(DOSSIER, "20260515000005_init_rls.sql"));
vrai(
  "RLS clients : le commercial ne LIT que les clients de SES leads",
  /on clients for select[\s\S]*?l\.owner_id = auth\.uid\(\)/.test(rlsInit),
);
vrai(
  "RLS clients : seul le back-office ÉCRIT",
  /on clients for all\s+to authenticated\s+using \(is_admin\(\) or is_planificateur\(\)\)/.test(rlsInit),
);

function corpsDe(src: string, nom: string): string {
  const i = src.indexOf(`export async function ${nom}(`);
  if (i < 0) return "";
  const j = src.indexOf("\nexport async function ", i + 1);
  return src.slice(i, j < 0 ? undefined : j);
}
function gardeAvant(corps: string, garde: string, avant: RegExp): boolean {
  const g = corps.indexOf(garde);
  const m = corps.search(avant);
  return g >= 0 && (m < 0 || g < m);
}
const ES_IO = /supabaseServer\(\)|supabaseServiceRole\(\)|allocateContractRef\(|getContractTemplateByKey\(/;

const ctr = lire("app/(app)/clients/[id]/contracts-actions.ts");
for (const nom of ["createContract", "updatePassage", "setContractStatus", "renewContract", "deleteContract", "sendContract"]) {
  vrai(`${nom} : assertBackOffice() AVANT toute lecture, numérotation ou écriture`, gardeAvant(corpsDe(ctr, nom), "assertBackOffice()", ES_IO));
}
const docs = lire("app/(app)/clients/[id]/documents-actions.ts");
for (const nom of ["uploadClientDocument", "deleteClientDocument"]) {
  vrai(`${nom} : assertBackOffice() AVANT tout accès`, gardeAvant(corpsDe(docs, nom), "assertBackOffice()", ES_IO));
}
const tags = corpsDe(docs, "updateClientActivityTags");
vrai(
  "updateClientActivityTags : la SESSION doit voir le client avant l'écriture service-role",
  /supabase\s*\.from\("clients"\)\.select\("id"\)/.test(tags) &&
    tags.indexOf('from("clients").select("id")') < tags.indexOf("supabaseServiceRole()") &&
    tags.includes("if (!visible) return"),
);
const nouveau = lire("app/(app)/clients/new/actions.ts");
vrai("createDirectClient : assertBackOffice() avant toute I/O", gardeAvant(corpsDe(nouveau, "createDirectClient"), "assertBackOffice()", ES_IO));
vrai(
  "ensureClientFromLead reste ouvert au commercial, mais lit SON lead par la session d'abord",
  !corpsDe(nouveau, "ensureClientFromLead").includes("assertBackOffice") &&
    /\.from\("leads"\)[\s\S]*supabaseServiceRole\(\)/.test(corpsDe(nouveau, "ensureClientFromLead")),
);

const fiche = lire("app/(app)/clients/[id]/page.tsx");
vrai("la fiche ne charge le registre documentaire que pour le back-office", fiche.includes("isBackOffice ? getClientDocuments("));
vrai("le compteur « Documents & contrats » n'est montré qu'au back-office", /\{isBackOffice && \(\s*<div>\s*<dt>Documents & contrats/.test(fiche));
vrai("le bouton « Nouveau client » suit la même règle", /\{peutCreer && \(/.test(lire("app/(app)/clients/ClientsList.tsx")));
vrai("le lien « Créer un nouveau client » du devis aussi", /\{peutCreerClient && \(/.test(lire("app/(app)/devis/new/QuoteEditor.tsx")));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
