// D26 — séries de factures par société : indépendantes, datées, figées.
//
// Niveau de preuve : la VALIDATION des saisies est EXÉCUTÉE ; la migration et
// l'écran sont LUS. L'indépendance réelle des séries des cinq sociétés se
// prouve en base : section 6 de `npm run recette:facturation`.

import { existsSync, readFileSync } from "node:fs";
import { aujourdhuiLegal, OBLIGATIONS_PAYS, verifierSaisieSerie } from "@/lib/facturation/series-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

console.log("\n1. Validation des saisies — EXÉCUTÉE");
const T = new Date("2026-11-09T12:00:00Z");
const ctx = { pays: "FR" as const, serieActive: false, codesPris: ["OPTFR"], maintenant: T };
const ok = verifierSaisieSerie({ code: "cgk", depuis: "2027-01-01" }, ctx);
vrai("saisie valide acceptée, code mis en majuscules", ok.ok && ok.code === "CGK");
vrai("au 1er janvier : seul le rappel des obligations du pays est signalé", ok.ok && ok.signalements.length === 1);
const mi = verifierSaisieSerie({ code: "CGK", depuis: "2027-03-15" }, ctx);
vrai("hors 1er janvier : signalé (deux séries la même année)", mi.ok && mi.signalements.some((x) => x.includes("DEUX séries")));
vrai("date d'effet PASSÉE : refusée", !verifierSaisieSerie({ code: "CGK", depuis: "2026-11-08" }, ctx).ok);
vrai("date d'effet aujourd'hui : acceptée", verifierSaisieSerie({ code: "CGK", depuis: "2026-11-09" }, ctx).ok);
vrai("code d'une AUTRE société : refusé (séries indépendantes)", !verifierSaisieSerie({ code: "optfr", depuis: "2027-01-01" }, ctx).ok);
vrai("code trop court / caractère interdit : refusé", !verifierSaisieSerie({ code: "C", depuis: "2027-01-01" }, ctx).ok && !verifierSaisieSerie({ code: "CG-K", depuis: "2027-01-01" }, ctx).ok);
vrai("série ACTIVE ou EMPLOYÉE : toute modification refusée", !verifierSaisieSerie({ code: "NEUF", depuis: "2027-01-01" }, { ...ctx, serieActive: true }).ok);
vrai("les cinq pays ont leur exigence et leur fuseau", (["FR", "CH", "LU", "BE", "CA"] as const).every((p) => OBLIGATIONS_PAYS[p]?.exigence && OBLIGATIONS_PAYS[p]?.fuseau));
vrai("date légale au Canada : à 3 h UTC le 1er janvier, c'est encore le 31 décembre à Toronto",
  aujourdhuiLegal("CA", new Date("2027-01-01T03:00:00Z")) === "2026-12-31");
vrai("date légale en France : à 23 h 30 UTC le 31 décembre, c'est déjà le 1er janvier à Paris",
  aujourdhuiLegal("FR", new Date("2026-12-31T23:30:00Z")) === "2027-01-01");

console.log("\n2. Migration 20261109000003 — LUE");
const M = lire("supabase/migrations/20261109000003_facturation_numero_a_emission.sql").toLowerCase();
vrai("date d'effet de la série (numerotation_depuis)", M.includes("add column if not exists numerotation_depuis date"));
vrai("code et date vont ensemble (contrainte)", M.includes("check ((code_numerotation is null) = (numerotation_depuis is null))"));
vrai("série active ou déjà employée : immuable en base", M.includes("garder_serie_societe") && M.includes("exists (select 1 from facture_counters c where c.entity_id = old.id)"));
vrai("… trigger posé APRÈS la création des compteurs qu'il lit", M.indexOf("create table if not exists facture_counters") < M.indexOf("create trigger trg_legal_entities_garder_serie"));
vrai("année de la facture lue à l'heure LÉGALE de la société", M.includes("annee_legale(new.entity_id, new.issued_at)") && !M.includes("extract(year from new.issued_at)"));
vrai("Canada : America/Toronto ; les quatre autres : Europe/Paris", M.includes("when 'ca' then 'america/toronto'") && M.includes("else 'europe/paris'"));
vrai("une facture déjà émise garde son numéro (brouillon ancien compris)", M.includes("son numéro ne change pas") && M.includes("old.num like 'brouillon-%' or old.num = ''"));

console.log("\n3. Serveur et écran — LUS");
const A = lire("app/(app)/settings/entities/actions.ts");
const i = A.indexOf("export async function definirSerieFacturation(");
const corps = A.slice(i);
vrai("définir une série : Super Admin seulement, en première instruction", i >= 0 && corps.indexOf("assertAdmin()") < corps.indexOf("lireSeries()"));
vrai("… validée AVANT l'écriture, et refusée si la migration manque", corps.includes("verifierSaisieSerie(") && corps.includes("migrationAppliquee"));
vrai("… tracée avec l'avant et l'après", corps.includes('action: "entity.invoice_series.set"') && corps.includes("before: { code: cible.code"));
const S = lire("lib/facturation/series-server.ts");
vrai("lecture compatible SANS la migration (select *)", S.includes('.from("legal_entities").select("*")') && S.includes('"code_numerotation" in lignes[0]'));
const U = lire("app/(app)/settings/entities/SeriesFacturation.tsx");
vrai("écran : une série figée n'offre plus de bouton", U.includes("{!figee && ("));
vrai("écran : confirmation qui dit que la série deviendra définitive", U.includes("ne se modifie plus"));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
