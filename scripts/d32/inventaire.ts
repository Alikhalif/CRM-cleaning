// D32 — génère l'inventaire des accès à partir du schéma EFFECTIF.
//   node (via esbuild) → docs/D32-INVENTAIRE-GENERE.md
import { writeFileSync } from "node:fs";
import { LIENS, lireSchema } from "./lecteur";
import { CIBLE, EXCLUES } from "./generer";

// Le CONSTAT : le schéma tel qu'il était AVANT la migration D32.
const s = lireSchema("supabase/migrations", CIBLE);
// Le RÉSULTAT : le schéma APRÈS elle.
const apres = lireSchema();
const toutesTables = new Set([...s.colonnes.keys()]);
const lignes: string[] = [];
const P = (x: string) => lignes.push(x);

const parTable = new Map<string, { cmd: string; nom: string; planif: boolean; texte: string }[]>();
for (const p of s.politiques.values()) {
  const arr = parTable.get(p.table) ?? [];
  arr.push({ cmd: p.commande, nom: p.nom, planif: /is_planificateur\(\)/i.test(p.texte), texte: p.texte.replace(/\s+/g, " ") });
  parTable.set(p.table, arr);
}

P("# D32 — Inventaire GÉNÉRÉ des accès (schéma effectif des migrations)");
P("");
P(`> Généré par \`scripts/d32/inventaire.ts\` à partir des ${s.fichiers.length} migrations, rejouées dans l'ordre. Ne pas modifier à la main.`);
P("");
P("## 1. Tables sous RLS dont une politique ouvre l'accès à `is_planificateur()`");
P("");
P("| Table | Commandes ouvertes à la planification | Colonnes de rattachement | Politiques |");
P("| --- | --- | --- | --- |");
const planif = [...parTable.entries()].filter(([, ps]) => ps.some((p) => p.planif)).sort(([a], [b]) => a.localeCompare(b));
for (const [t, ps] of planif) {
  const cols = [...(s.colonnes.get(t) ?? [])].filter((c) => (LIENS as readonly string[]).includes(c));
  P(`| \`${t}\` | ${[...new Set(ps.filter((p) => p.planif).map((p) => p.cmd))].join(", ")} | ${cols.join(", ") || "**aucune**"} | ${ps.filter((p) => p.planif).map((p) => `\`${p.nom}\``).join(", ")} |`);
}
P("");
P(`**${planif.length} tables** — AVANT la migration D32 (${CIBLE}).`);
P("");
P("### Après D32 : ce qui accorde ENCORE `is_planificateur()` sans périmètre");
P("");
const restantes = [...apres.politiques.values()].filter((p) => /is_planificateur\(\)/i.test(p.texte));
P(restantes.length ? restantes.map((p) => `- \`${p.table}\` · « ${p.nom} » — ${EXCLUES[p.table] ?? "**NON JUSTIFIÉ**"}`).join("\n") : "_aucune_");
P("");
const sansRlsApres = [...apres.colonnes.keys()].filter((t) => !apres.rls.has(t));
P(`Tables sans RLS après D32 : ${sansRlsApres.length ? sansRlsApres.map((t) => `\`${t}\``).join(", ") : "**aucune**"}.`);
P("");
P("## 2. Tables SANS RLS AVANT D32 (exposées à tout compte connecté si la table est dans `public`)");
P("");
const sansRls = [...toutesTables].filter((t) => !s.rls.has(t)).sort();
P(sansRls.length ? sansRls.map((t) => `- \`${t}\` — colonnes : ${[...(s.colonnes.get(t) ?? [])].slice(0, 8).join(", ")}`).join("\n") : "_aucune_");
P("");
P("## 3. Vues (une vue contourne la RLS de ses tables, sauf `security_invoker = true`)");
P("");
P([...s.vues.values()].map((v) => `- \`${v.nom}\` — ${v.securityInvoker ? "security_invoker ✅" : "**propriétaire : CONTOURNE la RLS**"} (${v.fichier})`).join("\n") || "_aucune_");
P("");
P("## 4. Fonctions SECURITY DEFINER exécutables par un rôle applicatif");
P("");
P("| Fonction | Exécutable par | Tables métier lues | Fichier |");
P("| --- | --- | --- | --- |");
const metier = ["leads", "clients", "documents", "dossiers", "contracts", "client_documents", "subcontract_contracts", "devis_optimivv", "cert_hotte", "lead_media", "signature_requests", "notifications"];
for (const f of [...s.fonctions.values()].filter((f) => f.securityDefiner).sort((a, b) => a.nom.localeCompare(b.nom))) {
  const exec = [...f.executablePar].filter((r) => ["public", "authenticated", "anon"].includes(r));
  if (exec.length === 0) continue;
  const lues = metier.filter((t) => new RegExp(String.raw`\b(from|join)\s+(public\.)?${t}\b`, "i").test(f.texte));
  P(`| \`${f.nom}(${f.signature})\` | ${exec.join(", ")} | ${lues.join(", ") || "—"} | ${f.fichier} |`);
}
P("");
writeFileSync("docs/D32-INVENTAIRE-GENERE.md", lignes.join("\n") + "\n");
console.log(`tables sous RLS : ${s.rls.size} · ouvertes à la planification : ${planif.length} · sans RLS : ${sansRls.length} · vues : ${s.vues.size} · SECURITY DEFINER exécutables : ${[...s.fonctions.values()].filter((f) => f.securityDefiner && [...f.executablePar].some((r) => ["public", "authenticated", "anon"].includes(r))).length}`);
