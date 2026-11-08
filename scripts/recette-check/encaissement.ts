// D29 — l'encaissement se valide au back-office ; D30 — la facture OPTIMIVV
// aussi. Décision du client du 2026-11-09.
//
// Niveau de preuve : LU (migration, gardes serveur, écran). Le refus réel d'un
// compte commercial en base ne se prouve qu'en recette : C17, et la section
// « rôles » de `npm run recette:facturation`.

import { existsSync, readFileSync } from "node:fs";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
function corpsDe(src: string, nom: string): string {
  const i = src.indexOf(`export async function ${nom}(`);
  if (i < 0) return "";
  const j = src.indexOf("\nexport ", i + 1);
  return src.slice(i, j < 0 ? undefined : j);
}

console.log("\n1. En base — migration 20261109000005 (lue, non exécutée)");
const M = lire("supabase/migrations/20261109000005_encaissement_back_office.sql").toLowerCase();
vrai("préparée, non appliquée", M.includes("préparée, non appliquée"));
vrai("facture : passage à « payé » refusé hors back-office", M.includes("new.status = 'paye' and old.status is distinct from 'paye'"));
vrai("facture : retour arrière depuis « payé » refusé aussi", M.includes("old.status = 'paye' and new.status is distinct from 'paye'"));
vrai("facture : date et référence de paiement protégées", M.includes("new.paid_at is distinct from old.paid_at") && M.includes("new.payment_reference is distinct from old.payment_reference"));
vrai("back-office = is_admin() OU is_planificateur()", M.includes("if auth.uid() is null or is_admin() or is_planificateur() then"));
vrai("les devis ne sont pas concernés (le commercial garde ses devis)", M.includes("if old.type not in ('acompte', 'finale') then"));
vrai("lead « encaissé » : refusé hors back-office", M.includes("new.status = 'encaisse' and old.status is distinct from 'encaisse'") && M.includes("not (is_admin() or is_planificateur())"));
vrai("la LECTURE n'est pas touchée (aucune politique modifiée)", !M.includes("create policy") && !M.includes("drop policy"));

console.log("\n2. Côté serveur — avant toute lecture ou écriture");
const D = lire("app/(app)/_shared/document-actions.ts");
const paye = corpsDe(D, "markDocumentPaid");
vrai("markDocumentPaid : assertBackOffice() en première instruction", paye.indexOf("assertBackOffice()") >= 0 && paye.indexOf("assertBackOffice()") < paye.indexOf("supabaseServer()"));
const P = lire("app/(app)/pipeline/actions.ts");
const st = corpsDe(P, "updateLeadStatus");
vrai("updateLeadStatus(« encaissé ») : back-office exigé", /if \(target === "encaisse"\) \{\s+const g = await assertBackOffice\(\);/.test(st));
vrai("… et les AUTRES colonnes du pipeline restent au commercial", !/^\s+const g = await assertBackOffice\(\);\s+if \(!g\.ok\) return g;\s+const supabase/m.test(st));
const PL = lire("app/(app)/planification/actions.ts");
vrai("markAcomptePaid (Planification) : déjà gardé", corpsDe(PL, "markAcomptePaid").includes("assertBackOffice()"));

console.log("\n3. Côté écran — le pipeline du commercial est préservé");
const B = lire("app/(app)/pipeline/PipelineBoard.tsx");
vrai("glisser vers « Acompte encaissé » / « Encaissement final » : expliqué, pas tenté", B.includes('if ((target === "acompte_paye" || target === "encaisse") && !peutEncaisser)'));
vrai("le refus vient AVANT toute mise à jour optimiste", B.indexOf("!peutEncaisser)") < B.indexOf("const acompteId = unpaidInvoiceId(lead, \"acompte\")"));
vrai("le droit vient des rôles réels (page serveur)", lire("app/(app)/pipeline/page.tsx").includes("peutEncaisser={isAdmin || isPlanner}"));
vrai("fiche facture : « Marquer payée » au back-office seulement", lire("app/(app)/_shared/DocumentActions.tsx").includes("!annulee && peutEmettre && ("));

console.log("\n4. D30 — la facture OPTIMIVV ne s'émet plus librement");
for (const r of ["app/api/devis/route.ts", "app/api/devis/envoyer/route.ts"]) {
  const s = lire(r);
  vrai(`${r} : facture réservée au back-office (403)`, s.includes('if (docType === "facture" && !(await hasScope("backOffice")))'));
  vrai(`${r} : la garde précède l'allocation du numéro`, s.indexOf('hasScope("backOffice")') < s.indexOf("allocateNumero(docType)"));
}
const AP = lire("app/api/devis/route.ts");
vrai("aperçu d'une facture : « APERÇU », jamais le prochain numéro réel", /const numeroApercu = docType === "facture"\s+\? "APERÇU"/.test(AP));
vrai("aperçu d'un devis : inchangé (numéro lu sans être consommé)", AP.includes("input.numero || (await peekNumero(docType))"));
const N = lire("app/(app)/devis/nouveau/NouveauDevis.tsx");
vrai("le bouton « Facture » n'est proposé qu'au back-office", N.includes("{peutFacturer && ("));
vrai("… droit calculé côté serveur", lire("app/(app)/devis/nouveau/page.tsx").includes('peutFacturer={await hasScope("backOffice")}'));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
