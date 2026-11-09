// Numérotation — qui peut appeler les compteurs, et ce qui consomme un numéro.
//
// Demande du client du 2026-11-09, §4 : « Vérifie que les compteurs et
// fonctions de numérotation ne sont accessibles qu'aux processus autorisés. »
//
// ── CE QUE CES CONTRÔLES PROUVENT ───────────────────────────────────
//
// Que l'état des DROITS déclarés dans les 177 migrations est bien celui que
// le registre décrit, et qu'il ne peut pas se dégrader sans qu'un contrôle
// tombe. Trois invariants, et un plafond.
//
// ── CE QU'ILS NE PROUVENT PAS ───────────────────────────────────────
//
// Qu'un appel direct échoue réellement. Cela demande une base, un rôle
// `anon` et un essai — donc la recette. Et il reste une inconnue que ces
// contrôles ne lèvent pas : savoir si PostgREST expose effectivement ces RPC
// dépend du schéma exposé, pas des migrations.
//
// ── POURQUOI UN PLAFOND, ET NON ZÉRO ────────────────────────────────
//
// Trois fonctions `security definer` n'ont aucun `revoke … from public`
// (anomalie D23). La correction est une migration, et une migration demande
// l'autorisation du client. En attendant, la liste est FERMÉE : elle ne peut
// ni s'allonger — une quatrième ferait tomber le contrôle — ni changer
// d'identité en silence.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, faux, titre, vrai, bilan, sansCommentairesSql } from "./commun";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

type Migration = { nom: string; sql: string };

const migrations: Migration[] = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((nom) => ({
    nom,
    sql: sansCommentairesSql(readFileSync(join(MIGRATIONS, nom), "utf8")),
  }));

const tout = migrations.map((m) => m.sql).join("\n");

// ── Les fonctions de numérotation, découvertes et non listées ────────
//
// Découvertes par motif : une fonction ajoutée demain entre d'elle-même dans
// le périmètre. Une liste écrite à la main laisserait passer la suivante.

const MOTIF_DEF = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?((?:next|peek)_[a-z_]*num|allocate_[a-z_]*ref)\s*\(/gi;

const fonctions = [...new Set([...tout.matchAll(MOTIF_DEF)].map((m) => m[1].toLowerCase()))].sort();

titre("Le périmètre : les fonctions de numérotation du dépôt");

vrai(
  "au moins 9 fonctions de numérotation découvertes",
  fonctions.length >= 9,
  `découvertes : ${fonctions.length} — ${fonctions.join(", ")}`,
);

function aUn(motif: string, fn: string): boolean {
  return new RegExp(motif.replace("§", fn), "i").test(tout);
}

const estDefiner = (fn: string) =>
  aUn(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?§\s*\([^;]*?security\s+definer`, fn) ||
  aUn(String.raw`alter\s+function\s+(?:public\.)?§\s*\([^;]*?security\s+definer`, fn);

const estRevoquee = (fn: string) =>
  aUn(String.raw`revoke\s+[a-z]*\s*(?:\(\s*\))?\s*on\s+function\s+(?:public\.)?§\s*\([^;]*?from\s+public`, fn);

const aUnGrant = (fn: string) =>
  aUn(String.raw`grant\s+execute\s+on\s+function\s+(?:public\.)?§\s*\([^;]*?to\s+`, fn);

/**
 * Le corps d'une fonction, et lui seul.
 *
 * ⚠️ Cette fonction existe à cause d'une mutation que la suite N'A PAS
 * détectée : l'assertion d'incrémentation cherchait son motif dans les 177
 * migrations CONCATÉNÉES. Or `allocate_document_archive_ref` incrémente la
 * même table — légitimement, ses clés étant préfixées `arch_`. Le motif
 * restait donc trouvable même après avoir vidé la fonction visée, et
 * l'assertion passait pour la mauvaise raison.
 */
function corps(fn: string): string {
  const deb = new RegExp(
    String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${fn}\s*\(`,
    "i",
  ).exec(tout);
  if (!deb) return "";
  const reste = tout.slice(deb.index);
  const fin = /\$[a-z]*\$\s*;/i.exec(reste.slice(reste.indexOf("$")));
  return fin ? reste.slice(0, reste.indexOf("$") + fin.index + fin[0].length) : reste.slice(0, 2000);
}

const definer = fonctions.filter(estDefiner);
const sansRevoke = definer.filter((fn) => !estRevoquee(fn));

// ── Invariant 1 : aucun `drop function` dans les migrations ──────────
//
// C'est le contrôle le moins évident et le plus utile. En PostgreSQL,
// `create or replace function` CONSERVE les droits déjà accordés, mais
// `drop function` suivi d'un `create` les REMET À ZÉRO — donc à `PUBLIC`.
//
// Une migration future qui remplacerait une fonction par un drop/create
// rouvrirait silencieusement les six fonctions correctement révoquées
// aujourd'hui, sans qu'aucun `revoke` n'ait disparu du dépôt. Mesuré : il n'y
// en a aucun, et les trois redéfinitions existantes réémettent même leur
// `revoke`. Ce contrôle verrouille cet état.

titre("Invariant 1 — aucun drop/create ne peut réinitialiser les droits");

const drops = migrations.filter((m) => /drop\s+function/i.test(m.sql));
eq("aucun `drop function` dans les 177 migrations", drops.length, 0);
if (drops.length > 0) {
  console.log(`      ⚠️ ${drops.map((m) => m.nom).join(", ")}`);
}

// ── Invariant 2 : tout `security definer` épingle son search_path ────
//
// Une fonction `security definer` tourne avec les droits de son
// propriétaire. Sans `set search_path`, l'appelant choisit dans quel schéma
// ses tables sont résolues — et peut faire exécuter les siennes. C'est la
// voie d'élévation classique, et elle est fermée ici sur les neuf.

titre("Invariant 2 — tout security definer épingle son search_path");

for (const fn of definer) {
  const epingle =
    aUn(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?§\s*\([^;]*?set\s+search_path\s*=`, fn) ||
    aUn(String.raw`alter\s+function\s+(?:public\.)?§\s*\([^;]*?set\s+search_path\s*=`, fn);
  vrai(`${fn} épingle son search_path`, epingle);
}

// ── Invariant 3 : l'aperçu ne peut PAS consommer de numéro ───────────
//
// La preuve n'est pas dans le corps de la fonction, elle est dans son
// marqueur de volatilité : une fonction `stable` ne peut rien écrire —
// PostgreSQL le refuse. C'est structurel, et donc plus solide qu'une lecture
// de corps qui chercherait l'absence d'un `update`.

titre("Invariant 3 — une fonction d'aperçu est `stable`, donc ne peut pas écrire");

const apercus = fonctions.filter((f) => f.startsWith("peek_"));
vrai("au moins 2 fonctions d'aperçu", apercus.length >= 2, apercus.join(", "));

for (const fn of apercus) {
  vrai(
    `${fn} est déclarée stable (ne peut pas consommer)`,
    aUn(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?§\s*\([^;]*?\bstable\b`, fn),
  );
  faux(
    `${fn} n'incrémente aucun compteur`,
    aUn(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?§\s*\([\s\S]*?(?:update|insert\s+into)[\s\S]*?\$fn\$`, fn),
  );
}

// ── Le plafond : la liste FERMÉE des trois fonctions non révoquées ───

titre("Plafond D23 — la liste des fonctions non révoquées est fermée");

const CONNUES_NON_REVOQUEES = [
  "allocate_document_archive_ref",
  "allocate_subcontract_ref",
  "next_contract_num",
].sort();

eq(
  "exactement 3 fonctions security definer sans revoke (D23)",
  sansRevoke.length,
  CONNUES_NON_REVOQUEES.length,
);
eq(
  "et ce sont bien les trois connues, aucune autre",
  sansRevoke.join(" · "),
  CONNUES_NON_REVOQUEES.join(" · "),
);

// Le revers : les six autres SONT révoquées, et doivent le rester.
for (const fn of definer.filter((f) => !CONNUES_NON_REVOQUEES.includes(f))) {
  vrai(`${fn} est révoquée de PUBLIC, et doit le rester`, estRevoquee(fn));
}

// ── Pourquoi le revoke manquant compte : la fonction CONSOMME ────────
//
// Un `revoke` absent sur une fonction de lecture serait une négligence. Sur
// une fonction qui consomme une référence dans une séquence sans trou, c'est
// autre chose : une référence consommée ne se récupère pas.

titre("L'enjeu — allocate_subcontract_ref consomme bien une référence");

const corpsAlloc = corps("allocate_subcontract_ref");
vrai(
  "allocate_subcontract_ref incrémente subcontract_sequences (dans SON corps)",
  /on\s+conflict\s*\([^)]*\)\s*do\s+update\s+set\s+last\s*=\s*subcontract_sequences\.last\s*\+\s*1/i.test(corpsAlloc),
);
vrai(
  "et son upsert est atomique (on conflict do update), donc sérialisé",
  /insert\s+into\s+subcontract_sequences[\s\S]{0,400}?on\s+conflict[\s\S]{0,120}?do\s+update/i.test(corpsAlloc),
);

// Les deux allocateurs partagent la table. C'est VOLONTAIRE et sans
// collision, les clés de l'archive étant préfixées — mais il faut que ça
// reste vrai, sans quoi deux compteurs se mélangeraient.
vrai(
  "allocate_document_archive_ref préfixe ses clés (pas de collision de compteur)",
  /insert\s+into\s+subcontract_sequences[\s\S]{0,200}?values\s*\(\s*'arch_'\s*\|\|/i.test(
    corps("allocate_document_archive_ref"),
  ),
);

// ── Invariant 4 : un revoke sans grant casse la fonctionnalité ───────
//
// ⚠️ C'EST LE PIÈGE DE LA CORRECTION DE D23, et il est sérieux.
//
// Les trois fonctions non révoquées fonctionnent AUJOURD'HUI grâce au
// `PUBLIC` par défaut :
//
//   · `allocate_subcontract_ref` est appelée par `supabaseServer()`, donc en
//     rôle `authenticated` — et elle n'a AUCUN grant ;
//   · `next_contract_num` est appelée par `supabaseServiceRole()`, donc en
//     rôle `service_role` — et son unique grant va à `authenticated`.
//
// Ajouter les trois `revoke` SEULS — la correction qui vient à l'esprit —
// retirerait à ces deux appelants le droit d'exécuter, et casserait la
// numérotation des contrats et des contrats de sous-traitance.
//
// Cet invariant le rend impossible : toute fonction révoquée doit porter au
// moins un grant explicite. Il passe pour les six déjà révoquées, et il
// tombera si quelqu'un applique la correction à moitié.

titre("Invariant 4 — une fonction révoquée porte toujours un grant explicite");

for (const fn of definer.filter(estRevoquee)) {
  vrai(`${fn} : revoke accompagné d'un grant`, aUnGrant(fn));
}

// ── La migration PRÉPARÉE : cohérente, et hors du chemin d'application ──
//
// Elle corrige D23. Elle n'est PAS appliquée, et elle n'est pas dans
// `supabase/migrations/` — donc un `supabase db push` ne peut pas
// l'appliquer par accident. Ces contrôles vérifient deux choses :
//
//   · qu'elle reste hors du chemin tant que le client ne l'a pas autorisée ;
//   · qu'elle apparie bien chaque `revoke` à un `grant` au rôle qui appelle
//     réellement — sans quoi elle casserait l'émission qu'elle prétend
//     préserver. C'est l'invariant 4, appliqué au correctif lui-même.

titre("La migration préparée pour D23 — cohérente et non appliquée");

const PREPAREES = join(process.cwd(), "supabase", "migrations-preparees");
const FICHIER_D23 = "20261110000001_numerotation_revoke_public.sql";

const prepareeExiste = existsSync(join(PREPAREES, FICHIER_D23));
vrai("la migration préparée pour D23 existe", prepareeExiste);

faux(
  "elle n'est PAS dans le chemin de `supabase db push`",
  readdirSync(MIGRATIONS).includes(FICHIER_D23),
);

if (prepareeExiste) {
  const sqlPrep = sansCommentairesSql(readFileSync(join(PREPAREES, FICHIER_D23), "utf8"));

  // Chaque fonction : son revoke, et le grant au rôle réellement appelant.
  const ATTENDU: Array<[string, string, string[]]> = [
    ["next_contract_num", String.raw`\(integer\)`, ["service_role"]],
    ["allocate_subcontract_ref", String.raw`\(text,\s*text\)`, ["authenticated", "service_role"]],
    ["allocate_document_archive_ref", String.raw`\(text\)`, ["service_role"]],
  ];

  for (const [fn, sig, roles] of ATTENDU) {
    vrai(
      `${fn} : PUBLIC est révoqué`,
      new RegExp(String.raw`revoke\s+all\s+on\s+function\s+${fn}\s*${sig}\s+from\s+public`, "i").test(sqlPrep),
    );
    const grant = new RegExp(
      String.raw`grant\s+execute\s+on\s+function\s+${fn}\s*${sig}\s+to\s+([a-z_,\s]+);`,
      "i",
    ).exec(sqlPrep);
    vrai(`${fn} : un grant accompagne le revoke`, grant !== null);
    if (grant) {
      for (const r of roles) {
        vrai(`${fn} : accordé à ${r}`, grant[1].includes(r));
      }
    }
  }

  // Les trois, et seulement les trois : une migration qui révoquerait une
  // quatrième fonction toucherait à quelque chose qui marche.
  eq(
    "elle ne révoque exactement que les 3 fonctions de D23",
    (sqlPrep.match(/revoke\s+all\s+on\s+function/gi) || []).length,
    3,
  );

  // Aucune donnée touchée : ni table, ni compteur, ni document émis.
  for (const interdit of ["update ", "delete ", "insert ", "drop ", "alter table", "truncate"]) {
    faux(
      `elle ne contient aucun \`${interdit.trim()}\``,
      new RegExp(String.raw`\b${interdit.trim()}\b`, "i").test(sqlPrep),
    );
  }
}

bilan("numérotation : droits des compteurs et consommation");
