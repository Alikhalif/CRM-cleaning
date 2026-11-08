// Facturation — validation de l'intervention, numéro à l'émission, factures
// émises figées (décisions du client du 2026-11-09).
//
// ── NIVEAU DE PREUVE, DIT D'EMBLÉE ────────────────────────────────────
//
//   1. le CALCUL de la facture finale est EXÉCUTÉ ici : preuve réelle ;
//   2. la MIGRATION et les GARDES applicatives sont LUES : preuve que la
//      règle est écrite, et écrite au bon endroit — PAS qu'elle tient en base ;
//   3. les doubles clics et émissions SIMULTANÉES ne se prouvent qu'en base,
//      à plusieurs connexions : `scripts/recette-facturation/concurrence.mjs`,
//      à lancer sur la RECETTE. Il n'a jamais tourné (aucune base disponible).
//
// Lecture de fichiers locaux. Ni réseau, ni base, ni secret.

import { existsSync, readFileSync } from "node:fs";
import { calculerFinale, estNumeroProvisoire, numeroAffiche } from "@/lib/facturation/finale-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const lire = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const proche = (a: number, b: number) => Math.abs(a - b) < 0.005;

function corpsDe(src: string, nom: string): string {
  const i = src.indexOf(`export async function ${nom}(`);
  if (i < 0) return "";
  const j = src.indexOf("\nexport ", i + 1);
  return src.slice(i, j < 0 ? undefined : j);
}
const avant = (corps: string, a: string, b: string) => {
  const i = corps.indexOf(a); const j = corps.indexOf(b);
  return i >= 0 && j >= 0 && i < j;
};

// ── 1. Le calcul de la facture finale — EXÉCUTÉ ──────────────────────
console.log("\n1. Facture finale : prestations du devis, acomptes déduits un par un");

const devis = {
  num: "DEV-2026-0042",
  totalHt: 1000, totalVat: 200, totalTtc: 1200,
  lignes: [
    { label: "Nettoyage cuisine", quantity: 1, unit: "forfait", unitPriceHt: 600, vatRate: 20, discountPct: 0, totalHt: 600 },
    { label: "Dégraissage hotte", quantity: 2, unit: "u", unitPriceHt: 200, vatRate: 20, discountPct: 0, totalHt: 400 },
  ],
};
const acompte = { num: "FA-2026-0007", emiseAt: "2026-10-01T09:00:00Z", totalHt: 300, totalVat: 60, totalTtc: 360 };

const c = calculerFinale({ devis, acomptes: [acompte] });
vrai("le calcul aboutit", c.ok);
if (c.ok) {
  vrai("les DEUX prestations du devis sont reprises, dans l'ordre", c.lignes[0].label === "Nettoyage cuisine" && c.lignes[1].label === "Dégraissage hotte");
  const ded = c.lignes.find((l) => l.label.includes("FA-2026-0007"));
  vrai("l'acompte est déduit par une ligne qui NOMME sa facture", !!ded);
  vrai("… et qui porte sa date d'émission", !!ded && ded.label.includes("01/10/2026"));
  vrai("… en négatif, pour son montant HT", !!ded && proche(ded.totalHt, -300));
  vrai("total HT = devis − acompte (700)", proche(c.totalHt, 700));
  vrai("TVA = devis − acompte (140)", proche(c.totalVat, 140));
  vrai("total TTC = 840", proche(c.totalTtc, 840));
  vrai("acompte déduit = 360 TTC", proche(c.acompteDeduit, 360));
  vrai("aucun signalement sur un devis cohérent", c.signalements.length === 0);
  vrai("ordre des lignes continu (0, 1, 2)", c.lignes.map((l) => l.orderIndex).join(",") === "0,1,2");
}

const deux = calculerFinale({ devis, acomptes: [acompte, { ...acompte, num: "FA-2026-0011", totalHt: 100, totalVat: 20, totalTtc: 120 }] });
vrai("DEUX acomptes : deux lignes de déduction, total 720 TTC", deux.ok && deux.lignes.length === 4 && proche(deux.totalTtc, 720));

const sans = calculerFinale({ devis, acomptes: [] });
vrai("sans acompte : la finale vaut le devis (1 200 TTC)", sans.ok && proche(sans.totalTtc, 1200) && sans.acompteDeduit === 0);

const couvert = calculerFinale({ devis, acomptes: [{ ...acompte, totalHt: 1000, totalVat: 200, totalTtc: 1200 }] });
vrai("acomptes couvrant tout le devis : REFUS (rien à facturer)", !couvert.ok);

const ancien = calculerFinale({ devis: { ...devis, lignes: [] }, acomptes: [] });
vrai("devis ancien SANS lignes : repris en une ligne fidèle, pas bloqué", ancien.ok && ancien.lignes.length === 1 && proche(ancien.totalTtc, 1200));
vrai("… et c'est SIGNALÉ", ancien.ok && ancien.signalements.length === 1);

const vide = calculerFinale({ devis: { ...devis, lignes: [], totalHt: 0, totalVat: 0, totalTtc: 0 }, acomptes: [] });
vrai("devis sans ligne NI montant : refus", !vide.ok);

const corrompu = calculerFinale({ devis: { ...devis, totalHt: 1100 }, acomptes: [] });
vrai("lignes ≠ total du devis : SIGNALÉ, pas imprimé en silence", corrompu.ok && corrompu.signalements.length === 1);

vrai("numéro provisoire reconnu", estNumeroProvisoire("BROUILLON-8F3A2C91B0D4") && estNumeroProvisoire(""));
vrai("numéro légal non confondu avec un provisoire", !estNumeroProvisoire("FAC-2026-0001") && !estNumeroProvisoire("FAC-CGK-2027-0001"));
vrai("un brouillon s'affiche « non numérotée »", numeroAffiche("BROUILLON-8F3A2C91B0D4") === "Brouillon — non numérotée");
vrai("un numéro légal s'affiche tel quel", numeroAffiche("FA-2026-0007") === "FA-2026-0007");

// ── 2. La migration — LUE (preuve d'écriture, pas d'exécution) ───────
console.log("\n2. Migration 20261109000003 — ce qu'elle écrit (non exécutée)");

const M = lire("supabase/migrations/20261109000003_facturation_numero_a_emission.sql").toLowerCase();
const fn = (nom: string) => {
  const i = M.indexOf(`create or replace function ${nom}(`);
  if (i < 0) return "";
  return M.slice(i, M.indexOf("$$;", M.indexOf("$$", i) + 2) + 3);
};
vrai("la migration existe", M.length > 0);
vrai("elle se déclare PRÉPARÉE, NON APPLIQUÉE", M.includes("préparée, non appliquée"));

const insertion = fn("assign_doc_num");
vrai("insertion d'un brouillon de facture → numéro PROVISOIRE", /if new.status = 'brouillon' then\s+[\s\S]{0,120}new.num\s+:= numero_provisoire\(\)/.test(insertion));
vrai("les DEVIS gardent leur numérotation (next_doc_num inchangé)", insertion.includes("-- devis : inchangé.") && insertion.includes("next_doc_num(new.type"));
vrai("une finale rattachée exige une intervention VALIDÉE", insertion.includes("x.status = 'valide'"));
vrai("un remplacement exige une facture ANNULÉE du même type", insertion.includes("d.annulee_at is not null") && insertion.includes("d.type = new.type"));

const maj = fn("proteger_facture");
vrai("ÉMISSION (brouillon → autre) : numéro définitif alloué DANS le trigger", /if new.status <> 'brouillon' then[\s\S]{0,300}allouer_numero_facture\(/.test(maj));
vrai("… à la date d'émission (chronologie garantie)", /new.issued_at := now\(\);\s+new.num := allouer_numero_facture/.test(maj));
vrai("… un brouillon ANCIEN déjà numéroté garde son numéro (pas de trou)", maj.includes("old.num like 'brouillon-%' or old.num = ''"));
vrai("facture émise : numéro immuable", maj.includes("son numéro ne change pas"));
vrai("facture émise : ne redevient pas brouillon", maj.includes("ne redevient pas un brouillon"));
vrai("facture émise : suppression logique refusée", maj.includes("elle ne se supprime pas"));
vrai("facture émise : montants, société, client, dates figés", maj.includes("son contenu est figé") && maj.includes("new.total_ttc") && maj.includes("new.entity_id") && maj.includes("new.issued_at"));
vrai("annulation : motif obligatoire", maj.includes("une annulation exige un motif"));
vrai("annulation : réservée au Super Admin en base aussi", maj.includes("not is_admin()"));
vrai("annulation : enregistrée une fois, jamais défaite", maj.includes("son annulation est déjà enregistrée"));

vrai("suppression PHYSIQUE d'une facture émise refusée (vaut aussi pour le service-role)", fn("interdire_suppression_facture").includes("suppression interdite") && M.includes("before delete on documents"));
vrai("lignes d'une facture émise figées (insert, update, delete)", fn("proteger_lignes_facture").includes("ses lignes sont figées") && M.includes("before insert or update or delete on document_lines"));

const alloc = fn("allouer_numero_facture");
vrai("allocation : SECURITY DEFINER", alloc.includes("security definer"));
vrai("allocation : incrément verrouillé (insert … on conflict do update)", alloc.includes("on conflict (entity_id, doc_type, year)") && alloc.includes("do update set next_value = facture_counters.next_value + 1"));
vrai("allocation : société sans code → série historique INCHANGÉE", /if v_code is null then[\s\S]{0,200}return next_doc_num\(p_type, p_year\)/.test(alloc));
vrai("allocation : série par société, préfixée de son code", alloc.includes("v_prefix || '-' || v_code || '-' || p_year::text"));
vrai("allocation : AUCUNE session ne peut l'appeler directement", M.includes("revoke all on function allouer_numero_facture(uuid, document_type, integer) from public"));
vrai("les triggers qui l'appellent sont SECURITY DEFINER", insertion.includes("security definer") && maj.includes("security definer"));
vrai("code de numérotation : format contraint et unique", M.includes("'^[a-z0-9]{2,8}$'") && M.includes("uq_legal_entities_code_numerotation"));

vrai("une seule finale ACTIVE par devis (annulée = place libérée)", /uq_finale_active_par_devis[\s\S]{0,140}annulee_at is null/.test(M));
vrai("une seule finale ACTIVE par dossier", /uq_finale_active_par_dossier[\s\S]{0,160}annulee_at is null/.test(M));
vrai("l'ancien index (place libérée par SUPPRESSION) est retiré", M.includes("drop index if exists uq_one_finale_per_devis"));
vrai("le nouvel index est créé AVANT la suppression de l'ancien", M.indexOf("uq_finale_active_par_devis") < M.indexOf("drop index if exists uq_one_finale_per_devis"));
vrai("reprise de l'existant AVANT la pose des protections", M.indexOf("set emise_at = issued_at") < M.indexOf("create trigger trg_documents_proteger_facture"));

const V = lire("supabase/migrations/20261109000002_dossier_validation_historique.sql").toLowerCase();
const E = lire("supabase/migrations/20261109000001_dossier_statut_valide.sql").toLowerCase();
vrai("l'état `valide` est ajouté seul dans sa migration (contrainte des ENUM)", E.includes("add value if not exists 'valide' after 'finalise'") && !E.includes("create table"));
vrai("historique des validations : append-only, même pour le service-role", V.includes("before update or delete on dossier_validations"));
vrai("historique : une annulation exige un motif", V.includes("action <> 'annulation' or coalesce(btrim(motif), '') <> ''"));
vrai("historique : on n'écrit qu'en son propre nom", V.includes("user_id = auth.uid()"));
vrai("historique : lecture back-office seulement", V.includes("using (is_admin() or is_planificateur())"));
vrai("transition : on ne valide qu'une intervention TERMINÉE", V.includes("new.status = 'valide' and old.status <> 'finalise'"));

// ── 3. Les gardes applicatives — LUES ─────────────────────────────────
console.log("\n3. Actions serveur : qui peut, et dans quel ordre");

const P = lire("app/(app)/planification/actions.ts");
const val = corpsDe(P, "validerIntervention");
vrai("validerIntervention : back-office, avant toute écriture", avant(val, "assertBackOffice()", ".update("));
vrai("… ne valide qu'un dossier `finalise` (filtre en base, double clic inoffensif)", val.includes('.eq("status", "finalise")'));
vrai("… historise dans dossier_validations", val.includes('from("dossier_validations").insert'));
vrai("… défait la validation si l'historique échoue", val.includes("Validation annulée"));
vrai("… et l'inscrit au journal d'audit", val.includes('action: "dossier.validate"'));

const ann = corpsDe(P, "annulerValidationIntervention");
vrai("annulation de validation : motif obligatoire", ann.includes("Le motif de l'annulation est obligatoire"));
vrai("… refusée si une facture finale active existe", ann.includes('.eq("type", "finale")') && ann.includes('.is("annulee_at", null)'));
vrai("… rétablit la validation si l'historique échoue", ann.includes("Validation rétablie"));

const fin = corpsDe(P, "finalizeDossier");
vrai("« terminée » ne se pose que depuis planifié / en cours (pas de dé-validation détournée)", fin.includes('.in("status", ["planifie", "en_cours"])'));

const gen = corpsDe(P, "generateFactureFinale");
// Condition EXACTE : un motif plus lâche (« contient !== valide ») laissait
// passer une mutation qui ajoutait `&& status !== "finalise"` — vérifié le
// 2026-11-09 par mutation volontaire.
vrai("facture finale : exige une intervention VALIDÉE, et elle seule", /if \(dossier\.status !== "valide"\) \{/.test(gen));
vrai("… naît en BROUILLON", gen.includes('status: "brouillon"'));
vrai("… sans numéro posé par l'application", gen.includes('num: "", // brouillon'));
vrai("… rattachée au dossier", gen.includes("dossier_id: dossier.id"));
vrai("… reprend les lignes du DEVIS SIGNÉ", gen.includes('.eq("status", "signe")') && gen.includes('from("document_lines")'));
vrai("… ne déduit que les acomptes ÉMIS et non annulés", gen.includes('.neq("status", "brouillon")') && gen.includes('.is("annulee_at", null)'));
vrai("… renvoie la finale existante au lieu d'en créer une seconde", gen.includes("finaleActive(supabase, dossier.id, devis.id)"));
vrai("… course perdue (23505) : renvoie la gagnante", gen.includes('insErr?.code === "23505"'));
vrai("… désigne la finale annulée qu'elle remplace", gen.includes("remplace_document_id: annulee?.id ?? null"));

const D = lire("app/(app)/_shared/document-actions.ts");
const em = corpsDe(D, "emettreFacture");
vrai("émission : back-office, en première instruction", em.indexOf("assertBackOffice()") >= 0 && em.indexOf("assertBackOffice()") < em.indexOf("getDocumentById("));
vrai("… contrôle l'identité légale de la société (même garde qu'un devis)", em.includes("planifierRendu(detail)"));
vrai("… UPDATE filtré sur `brouillon` (double clic = aucun second numéro)", em.includes('.eq("status", "brouillon")'));
vrai("… l'application ne calcule JAMAIS le numéro", !/num:\s*["`]/.test(em));
vrai("… déjà émise : renvoie le numéro existant (idempotent)", em.includes("dejaEmise: true"));
vrai("… tracée", em.includes('action: "document.emit"'));

const an = corpsDe(D, "annulerFacture");
vrai("annulation de facture : Super Admin seulement", an.indexOf("assertAdmin()") >= 0 && an.indexOf("assertAdmin()") < an.indexOf("supabaseServer()"));
vrai("… motif d'au moins 10 caractères", an.includes("m.length < 10"));
vrai("… jamais une suppression (UPDATE de annulee_at)", an.includes("annulee_at: new Date()") && !an.includes(".delete("));
vrai("… une facture encaissée relève de l'avoir, pas de l'annulation", an.includes('doc.status === "paye"'));
vrai("… tracée", an.includes('action: "document.cancel"'));

const sig = corpsDe(D, "markDocumentSigned");
vrai("acompte : créé en BROUILLON", sig.includes('type: "acompte",') && /type: "acompte",\s+num: "",\s+status: "brouillon"/.test(sig));
vrai("acompte : ligne posée AVANT l'émission (les lignes émises sont figées)", avant(sig, 'from("document_lines")', '.update({ status: "envoye" }'));
vrai("acompte : émission filtrée sur `brouillon`", /update\(\{ status: "envoye" \} as never\)\s+\.eq\("id", ins\.id\)\s+\.eq\("status", "brouillon"\)/.test(sig));

vrai("« Marquer envoyé » n'émet plus une facture", corpsDe(D, "markDocumentSent").includes('detail.doc.type !== "devis"'));
vrai("une facture BROUILLON ne part pas par courriel", corpsDe(D, "sendDocumentByEmail").includes('detail.doc.type !== "devis" && detail.doc.status === "brouillon"'));
vrai("une facture ne se duplique pas", corpsDe(D, "duplicateDocument").includes("Une facture ne se duplique pas"));
const paye = corpsDe(D, "markDocumentPaid");
vrai("encaissement : refusé sur un brouillon", paye.includes('doc.status === "brouillon"'));
vrai("encaissement : refusé sur une facture annulée", paye.includes("doc.annulee_at"));
vrai("encaissement : lit `*` — fonctionne avec ET sans la migration", paye.includes('.select("*")'));

// ── 4. L'écran ────────────────────────────────────────────────────────
console.log("\n4. Écrans : les boutons suivent les droits et l'état");

const A = lire("app/(app)/_shared/DocumentActions.tsx");
vrai("« Émettre la facture » : brouillon ET back-office", A.includes("{isInvoiceDraft && peutEmettre && ("));
vrai("« Envoyer par email » : jamais sur un brouillon ni une facture annulée", A.includes("{!isInvoiceDraft && !annulee && ("));
vrai("« Dupliquer » : devis seulement", A.includes("{!isInvoice && ("));
vrai("« Marquer payée » : facture émise, non annulée", A.includes("{isInvoice && !isPaid && !isInvoiceDraft && !annulee && ("));
vrai("« Annuler la facture » : Super Admin, émise, non encaissée", A.includes("!isPaid && !annulee && peutAnnuler && ("));
vrai("l'émission prévient AVANT qu'elle est irréversible", A.includes("ne pourra plus être modifiée"));

const W = lire("app/(app)/_shared/DocumentView.tsx");
vrai("les droits viennent du SERVEUR (canAccessScope sur les rôles réels)", W.includes('canAccessScope(roles, "backOffice")') && W.includes('canAccessScope(roles, "admin")'));
vrai("le numéro provisoire n'est jamais affiché comme un numéro", W.includes("numeroAffiche(doc.num)"));
vrai("une facture annulée le dit, avec son motif", W.includes("Facture annulée"));
vrai("le PDF n'imprime jamais un numéro provisoire", lire("lib/pdf/DocumentPdf.tsx").includes("numeroAffiche(doc.num)"));
vrai("la comptabilité non plus", lire("app/(app)/comptabilite/Comptabilite.tsx").includes("numeroAffiche(doc.num)"));

const PL = lire("app/(app)/planification/Planification.tsx");
vrai("Planification : « Valider l'intervention » sur une intervention terminée", /dossier\.status === "finalise" && \([\s\S]{0,200}onValider\(\)/.test(PL));
vrai("Planification : « Préparer la facture finale » sur une intervention validée seulement", /dossier\.status === "valide" && !finaleDoc && \([\s\S]{0,200}onGenerateFinale\(\)/.test(PL));
vrai("Planification : le bouton de la ligne n'est actif qu'une fois validée", PL.includes('disabled={dossier.status !== "valide"}'));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
