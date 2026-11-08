// Test RÉEL de la numérotation des factures — doubles clics et émissions
// simultanées — À LANCER SUR LA RECETTE UNIQUEMENT.
//
//   npm run recette:facturation                (lit .env.recette)
//   npm run recette:facturation -- .env.recette
//
// ── POURQUOI CE TEST EXISTE ──────────────────────────────────────────
//
// Le client l'a demandé : « Teste notamment les doubles clics et les
// émissions simultanées. » Une course ne se prouve pas en lisant du code :
// il faut plusieurs connexions qui frappent la même ligne au même instant.
// Chaque requête HTTP vers PostgREST est une transaction distincte — 10
// requêtes lancées ensemble sont 10 transactions concurrentes.
//
// ── DEUX VERROUS AVANT LA MOINDRE ÉCRITURE ───────────────────────────
//
//   1. `evaluerCible()` (lib/env/cible.ts) : mode `recette` déclaré, aucun
//      motif bloquant — notamment une URL égale à CGK_SUPABASE_URL_PRODUCTION ;
//   2. le MARQUEUR `cgk_environnement = 'recette'`, posé à la main dans la
//      base de recette (supabase/recette/00_marqueur_environnement.sql). La
//      production ne l'a pas : même un fichier d'environnement faux ne la
//      fait pas écrire.
//
// ── CE QU'IL LAISSE DERRIÈRE LUI ─────────────────────────────────────
//
// Des factures ÉMISES fictives, sur une société fictive (code TSTCONC). Elles
// ne peuvent PAS être supprimées : c'est précisément ce que le test prouve.
// Elles restent en recette, identifiables par leur société.
//
// ⚠️ ÉTAT : écrit le 2026-11-09, JAMAIS EXÉCUTÉ — aucune base de recette
// n'existe encore. Il échouera peut-être à son premier lancement ; c'est le
// rôle d'un premier lancement.

import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bloquants, evaluerCible, modeEffectif, type Config } from "@/lib/env/cible";
import { aujourdhuiLegal } from "@/lib/facturation/series-shared";
import { evaluerActionsBackOffice } from "@/lib/actions-back-office/engine-server";

const CODE = "TSTCONC";
const ANNEE = new Date().getFullYear();

let ko = 0;
let ok = 0;
function vrai(nom: string, cond: boolean, detail = "") {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
  if (cond) ok++; else ko++;
}

function lireEnv(fichier: string): Record<string, string> {
  if (!existsSync(fichier)) return {};
  const out: Record<string, string> = {};
  for (const brut of readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const l = brut.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i <= 0) continue;
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[l.slice(0, i).trim()] = v;
  }
  return out;
}

function config(env: Record<string, string>): Config {
  return {
    cgkEnv: env.CGK_ENV,
    nodeEnv: env.NODE_ENV ?? "development",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseUrlProduction: env.CGK_SUPABASE_URL_PRODUCTION,
    brevoApiKey: env.BREVO_API_KEY,
    smtpHost: env.SMTP_HOST,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    devisEmailTransport: env.DEVIS_EMAIL_TRANSPORT,
    envoiReelAutorise: env.CGK_ENVOI_REEL,
    destinatairesAutorises: env.CGK_DESTINATAIRES_AUTORISES,
    signatureBaseUrl: env.SIGNATURE_BASE_URL,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    domainesPublics: env.CGK_DOMAINES_PUBLICS,
    ringoverApiKey: env.RINGOVER_API_KEY,
    docusignClientId: env.DOCUSIGN_CLIENT_ID,
    docusignEnv: env.DOCUSIGN_ENV,
    fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY,
    empreinteCleProduction: env.CGK_EMPREINTE_CLE_PRODUCTION,
    cronSecret: env.PRESENCE_CRON_SECRET,
  } as Config;
}

const ESC = (n: string) => Number(n.split("-").pop());

async function compteur(sb: SupabaseClient, entite: string): Promise<number> {
  const { data } = await sb.from("facture_counters").select("next_value")
    .eq("entity_id", entite).eq("doc_type", "finale").eq("year", ANNEE).maybeSingle();
  return (data as { next_value: number } | null)?.next_value ?? 1;
}

async function brouillon(sb: SupabaseClient, entite: string, ttc = 120): Promise<{ id: string; num: string }> {
  const { data, error } = await sb.from("documents").insert({
    type: "finale", num: "", status: "brouillon", entity_id: entite,
    total_ht: ttc / 1.2, total_vat: ttc - ttc / 1.2, total_ttc: ttc, notes: "TEST CONCURRENCE — recette",
  }).select("id, num").single();
  if (error || !data) throw new Error(`brouillon : ${error?.message}`);
  const { error: lErr } = await sb.from("document_lines").insert({
    document_id: data.id, label: "Ligne de test", quantity: 1, unit: "forfait",
    unit_price_ht: ttc / 1.2, vat_rate: 20, discount_pct: 0, total_ht: ttc / 1.2, order_index: 0,
  });
  if (lErr) throw new Error(`ligne : ${lErr.message}`);
  return data as { id: string; num: string };
}

const emettre = (sb: SupabaseClient, id: string) =>
  sb.from("documents").update({ status: "envoye" }).eq("id", id).eq("status", "brouillon").select("id, num");

async function main() {
  const fichier = process.argv[2] ?? ".env.recette";
  if (fichier.endsWith(".env.local")) {
    console.error("Refus : .env.local pointe sur la production. Ce test ne lit que la recette.");
    process.exit(2);
  }
  const env = lireEnv(fichier);
  const c = config(env);
  const verdict = evaluerCible(c);
  const bloq = bloquants(verdict);
  console.log(`Fichier : ${fichier} · mode : ${modeEffectif(c)} · motifs bloquants : ${bloq.length}`);
  if (modeEffectif(c) !== "recette" || bloq.length > 0) {
    for (const g of bloq) console.error(`  ✗ ${g.code} — ${g.message}`);
    console.error("Refus : la cible n'est pas une recette vérifiée. Aucune écriture.");
    process.exit(2);
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error("Refus : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente du fichier.");
    process.exit(2);
  }
  const sb = createClient(url, cle, { auth: { persistSession: false } });

  // Second verrou : le marqueur posé DANS la base de recette.
  const { data: marqueur, error: mErr } = await sb.from("cgk_environnement").select("nom").eq("nom", "recette").maybeSingle();
  if (mErr || !marqueur) {
    console.error("Refus : marqueur `cgk_environnement = recette` introuvable dans cette base.");
    console.error("  Si c'est bien la recette : jouez supabase/recette/00_marqueur_environnement.sql. Sinon, c'est que la protection a fonctionné.");
    process.exit(2);
  }
  console.log("Marqueur de recette : présent. Début des écritures fictives.\n");

  // Société fictive dédiée : sa série ne croise celle d'aucune autre.
  let { data: ent } = await sb.from("legal_entities").select("id").eq("code_numerotation", CODE).maybeSingle();
  if (!ent) {
    const r = await sb.from("legal_entities").insert({
      legal_name: "SOCIÉTÉ FICTIVE — TEST CONCURRENCE", legal_form: "SAS", siret: "00000000000000",
      address: { line1: "1 rue du Test", postal_code: "75000", city: "Paris" }, code_numerotation: CODE,
      country: "FR", numerotation_depuis: aujourdhuiLegal("FR"),
    }).select("id").single();
    if (r.error) throw new Error(`société fictive : ${r.error.message}`);
    ent = r.data;
  }
  const entite = (ent as { id: string }).id;

  console.log("1. Un brouillon ne consomme AUCUN numéro");
  const c0 = await compteur(sb, entite);
  const b = await brouillon(sb, entite);
  vrai("le brouillon porte un numéro PROVISOIRE", b.num.startsWith("BROUILLON-"), b.num);
  const del = await sb.from("documents").delete().eq("id", b.id);
  vrai("un brouillon se supprime", !del.error, del.error?.message);
  vrai("le compteur n'a pas bougé", (await compteur(sb, entite)) === c0);

  console.log("\n2. DOUBLE CLIC — 10 émissions simultanées de la MÊME facture");
  const d = await brouillon(sb, entite);
  const c1 = await compteur(sb, entite);
  const rafale = await Promise.all(Array.from({ length: 10 }, () => emettre(sb, d.id)));
  const gagnants = rafale.filter((r) => !r.error && (r.data?.length ?? 0) === 1);
  vrai("exactement UNE émission a abouti", gagnants.length === 1, `${gagnants.length} gagnant(s)`);
  vrai("aucune requête en erreur (les perdantes ne trouvent simplement plus de brouillon)", rafale.every((r) => !r.error));
  const num = (gagnants[0]?.data?.[0] as { num: string } | undefined)?.num ?? "";
  vrai("numéro définitif, préfixé de la société", new RegExp(`^FAC-${CODE}-${ANNEE}-\\d{4}$`).test(num), num);
  vrai("le compteur a avancé d'UN seul cran", (await compteur(sb, entite)) === c1 + 1);

  console.log("\n3. ÉMISSIONS SIMULTANÉES — 20 factures différentes au même instant");
  const lot = [];
  for (let i = 0; i < 20; i++) lot.push(await brouillon(sb, entite));
  const c2 = await compteur(sb, entite);
  const res = await Promise.all(lot.map((x) => emettre(sb, x.id)));
  const nums = res.map((r) => (r.data?.[0] as { num: string } | undefined)?.num ?? "");
  vrai("les 20 émissions ont abouti", res.every((r) => !r.error && (r.data?.length ?? 0) === 1));
  vrai("20 numéros DISTINCTS", new Set(nums).size === 20);
  const n = nums.map(ESC).sort((a, z) => a - z);
  vrai("numéros CONSÉCUTIFS, sans trou", n.every((v, i) => i === 0 || v === n[i - 1] + 1), n.join(","));
  vrai("la série reprend juste après le double clic", n[0] === ESC(num) + 1);
  vrai("le compteur a avancé de 20, pas plus", (await compteur(sb, entite)) === c2 + 20);

  console.log("\n4. Une facture ÉMISE est figée — y compris pour le service-role");
  const cible = lot[0].id;
  const refuse = async (nom: string, p: PromiseLike<{ error: unknown }>) => {
    const r = await p;
    vrai(nom, !!r.error, r.error ? "" : "ACCEPTÉ — la protection ne tient pas");
  };
  await refuse("renuméroter : refusé", sb.from("documents").update({ num: "FAC-FAUX-0001" }).eq("id", cible));
  await refuse("modifier le montant : refusé", sb.from("documents").update({ total_ttc: 1 }).eq("id", cible));
  await refuse("repasser en brouillon : refusé", sb.from("documents").update({ status: "brouillon" }).eq("id", cible));
  await refuse("supprimer logiquement : refusé", sb.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", cible));
  await refuse("supprimer physiquement : refusé", sb.from("documents").delete().eq("id", cible));
  await refuse("ajouter une ligne : refusé", sb.from("document_lines").insert({
    document_id: cible, label: "ajout", quantity: 1, unit: "u", unit_price_ht: 1, vat_rate: 20, discount_pct: 0, total_ht: 1, order_index: 9,
  }));
  const paye = await sb.from("documents").update({ status: "paye", paid_at: new Date().toISOString() }).eq("id", cible);
  vrai("l'encaissement, lui, reste possible", !paye.error, paye.error?.message);

  console.log("\n5. Annulation : motif obligatoire, une seule fois");
  const aAnnuler = lot[1].id;
  await refuse("annuler sans motif : refusé", sb.from("documents").update({ annulee_at: new Date().toISOString() }).eq("id", aAnnuler));
  const an = await sb.from("documents").update({ annulee_at: new Date().toISOString(), annulation_motif: "Test de recette — erreur de destinataire" }).eq("id", aAnnuler);
  vrai("annuler avec motif : accepté", !an.error, an.error?.message);
  await refuse("ré-annuler / modifier l'annulation : refusé", sb.from("documents").update({ annulation_motif: "autre" }).eq("id", aAnnuler));
  const { data: garde } = await sb.from("documents").select("num").eq("id", aAnnuler).single();
  vrai("la facture annulée garde son numéro", (garde as { num: string } | null)?.num === nums[1]);


  console.log("\n6. CINQ PAYS — cinq séries indépendantes, émissions croisées simultanées");
  const PAYS = ["FR", "CH", "LU", "BE", "CA"] as const;
  const entites: Record<string, string> = {};
  for (const p of PAYS) {
    const code = `TST${p}`;
    let { data: e } = await sb.from("legal_entities").select("id").eq("code_numerotation", code).maybeSingle();
    if (!e) {
      const r = await sb.from("legal_entities").insert({
        legal_name: `SOCIÉTÉ FICTIVE ${p} — TEST`, legal_form: "SAS", siret: "00000000000000",
        address: { line1: "1 rue du Test", postal_code: "00000", city: "Test" },
        country: p, code_numerotation: code, numerotation_depuis: aujourdhuiLegal(p),
      }).select("id").single();
      if (r.error) throw new Error(`société ${p} : ${r.error.message}`);
      e = r.data;
    }
    entites[p] = (e as { id: string }).id;
  }
  const brouillons: { pays: string; id: string }[] = [];
  for (const p of PAYS) for (let i = 0; i < 3; i++) brouillons.push({ pays: p, id: (await brouillon(sb, entites[p])).id });
  const emis = await Promise.all(brouillons.map(async (x) => ({ pays: x.pays, r: await emettre(sb, x.id) })));
  vrai("les 15 émissions croisées ont abouti", emis.every((x) => !x.r.error && (x.r.data?.length ?? 0) === 1));
  for (const p of PAYS) {
    const nums = emis.filter((x) => x.pays === p).map((x) => (x.r.data?.[0] as { num: string } | undefined)?.num ?? "");
    vrai(`${p} : les 3 numéros portent le code de SA société`, nums.every((n) => n.startsWith(`FAC-TST${p}-`)), nums.join(", "));
    const n = nums.map(ESC).sort((a, z) => a - z);
    vrai(`${p} : consécutifs dans SA série, sans trou`, n.every((v, i) => i === 0 || v === n[i - 1] + 1), n.join(","));
  }
  const tous = emis.map((x) => (x.r.data?.[0] as { num: string } | undefined)?.num ?? "");
  vrai("aucun numéro partagé entre deux sociétés", new Set(tous).size === tous.length);
  await refuse("changer le code d'une série qui a servi : refusé", sb.from("legal_entities").update({ code_numerotation: "TSTXX" }).eq("id", entites.FR));

  console.log("\n7. ENCAISSEMENT — refus en base selon le RÔLE (comptes de test)");
  const ident = (r: string) => ({ email: env[`CGK_TEST_${r}_EMAIL`], mdp: env[`CGK_TEST_${r}_MOT_DE_PASSE`] });
  const com = ident("COMMERCIAL");
  const pla = ident("PLANIFICATION");
  if (!com.email || !com.mdp || !pla.email || !pla.mdp) {
    console.log("  NON EXÉCUTÉE — CGK_TEST_COMMERCIAL_* et CGK_TEST_PLANIFICATION_* absents de .env.recette.");
    console.log("  (Mots de passe des comptes de test : chez vous seulement, jamais dans le dépôt.)");
  } else {
    const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const session = async (e: string, m: string) => {
      const cl = createClient(url, anon, { auth: { persistSession: false } });
      const { data, error } = await cl.auth.signInWithPassword({ email: e, password: m });
      if (error || !data.user) throw new Error(`connexion ${e} : ${error?.message}`);
      return { cl, uid: data.user.id };
    };
    const C = await session(com.email, com.mdp);
    const Pl = await session(pla.email, pla.mdp);
    // Un lead DU commercial, et une facture émise sur ce lead : la RLS lui en
    // donne l'écriture — c'est précisément ce que le trigger doit arrêter.
    const { data: lead, error: lErr } = await sb.from("leads").insert({
      short_id: `T-${Date.now()}`, owner_id: C.uid, client_last_name: "Fictif", status: "signe",
    }).select("id").single();
    if (lErr || !lead) throw new Error(`lead de test : ${lErr?.message}`);
    const leadId = (lead as { id: string }).id;
    const { data: fac, error: fErr } = await sb.from("documents").insert({
      type: "finale", num: "", status: "brouillon", entity_id: entite, lead_id: leadId,
      total_ht: 100, total_vat: 20, total_ttc: 120,
    }).select("id").single();
    if (fErr || !fac) throw new Error(`facture de test : ${fErr?.message}`);
    const facId = (fac as { id: string }).id;
    await sb.from("document_lines").insert({ document_id: facId, label: "Ligne", quantity: 1, unit: "u", unit_price_ht: 100, vat_rate: 20, discount_pct: 0, total_ht: 100, order_index: 0 });
    await emettre(sb, facId);

    const vu = await C.cl.from("documents").select("status").eq("id", facId).maybeSingle();
    vrai("le commercial VOIT sa facture et son état de paiement", !vu.error && !!vu.data);
    await refuse("le commercial ne la marque PAS payée (refus en base)", C.cl.from("documents").update({ status: "paye", paid_at: new Date().toISOString() }).eq("id", facId));
    await refuse("le commercial ne passe PAS son lead à « encaissé » (refus en base)", C.cl.from("leads").update({ status: "encaisse" }).eq("id", leadId));
    const okPl = await Pl.cl.from("documents").update({ status: "paye", paid_at: new Date().toISOString() }).eq("id", facId).select("id");
    vrai("la planification, elle, valide l'encaissement", !okPl.error && (okPl.data?.length ?? 0) === 1, okPl.error?.message);
  }


  console.log("\n8. NOTIFICATIONS — naissance, persistance, statut, escalade (moteur réel)");
  // Le moteur lit l'environnement au moment de l'appel : on lui donne celui
  // de la RECETTE, déjà vérifiée par les deux verrous ci-dessus.
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = cle;
  const { data: ld, error: ldErr } = await sb.from("leads").insert({
    short_id: `N-${Date.now()}`, client_last_name: "Notification", country: "FR", status: "signe",
  }).select("id").single();
  if (ldErr || !ld) throw new Error(`lead : ${ldErr?.message}`);
  const { data: dos, error: dErr } = await sb.from("dossiers").insert({ lead_id: (ld as { id: string }).id, status: "finalise" })
    .select("id").single();
  if (dErr || !dos) throw new Error(`dossier : ${dErr?.message}`);
  const dossierId = (dos as { id: string }).id;
  const cleAValider = `dossier.a_valider:${dossierId}`;
  const ouvertes = async (c: string) =>
    ((await sb.from("actions_back_office").select("id").eq("cle", c).is("fermee_at", null)).data ?? []).length;

  const b1 = await evaluerActionsBackOffice();
  vrai("passe 1 : le moteur tourne", b1.ok, b1.ok ? "" : b1.raison);
  vrai("intervention terminée → action « à valider » OUVERTE", (await ouvertes(cleAValider)) === 1);
  await evaluerActionsBackOffice();
  vrai("passe 2 : toujours UNE seule action (aucun doublon)", (await ouvertes(cleAValider)) === 1);
  const [p1, p2] = await Promise.all([evaluerActionsBackOffice(), evaluerActionsBackOffice()]);
  vrai("deux passes SIMULTANÉES : toujours une seule", p1.ok && p2.ok && (await ouvertes(cleAValider)) === 1);

  const { data: notifs } = await sb.from("notifications").select("id, user_id").eq("kind", "action.dossier.a_valider").eq("entity_id", dossierId);
  const parUtilisateur = new Map<string, number>();
  for (const n of (notifs ?? []) as { user_id: string }[]) parUtilisateur.set(n.user_id, (parUtilisateur.get(n.user_id) ?? 0) + 1);
  vrai("chaque planificateur du pays notifié UNE fois, malgré quatre passes", [...parUtilisateur.values()].every((v) => v === 1));
  if ((notifs ?? []).length === 0) console.log("  info  aucun planificateur ne couvre FR sur cette recette : aucune notification attendue");

  await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("entity_id", dossierId);
  await evaluerActionsBackOffice();
  vrai("notification LUE : l'action reste OUVERTE", (await ouvertes(cleAValider)) === 1);

  const futur = new Date(Date.now() + 49 * 3_600_000);
  const be = await evaluerActionsBackOffice(futur);
  const { data: esc } = await sb.from("actions_back_office").select("escaladee_at").eq("cle", cleAValider).is("fermee_at", null).single();
  vrai("passé le délai : ESCALADÉE au Super Admin, et toujours ouverte", be.ok && !!(esc as { escaladee_at: string | null } | null)?.escaladee_at);
  await evaluerActionsBackOffice(new Date(futur.getTime() + 3_600_000));
  const { data: escN } = await sb.from("notifications").select("user_id").eq("kind", "action.escalade").eq("entity_id", dossierId);
  const escParAdmin = new Map<string, number>();
  for (const n of (escN ?? []) as { user_id: string }[]) escParAdmin.set(n.user_id, (escParAdmin.get(n.user_id) ?? 0) + 1);
  vrai("l'escalade est notifiée aux administrateurs", escParAdmin.size >= 1);
  vrai("… UNE fois chacun, malgré une seconde passe après le délai", [...escParAdmin.values()].every((v) => v === 1));

  const v = await sb.from("dossiers").update({ status: "valide" }).eq("id", dossierId);
  vrai("changement de statut : terminée → validée", !v.error, v.error?.message);
  await evaluerActionsBackOffice();
  vrai("l'action « à valider » se FERME d'elle-même", (await ouvertes(cleAValider)) === 0);
  const { data: fermee } = await sb.from("actions_back_office").select("raison_fermeture").eq("cle", cleAValider).not("fermee_at", "is", null).single();
  vrai("… pour la raison « action effectuée »", (fermee as { raison_fermeture: string } | null)?.raison_fermeture === "action_effectuee");
  vrai("… et l'action suivante naît : « facture à préparer »", (await ouvertes(`facture.a_preparer:${dossierId}`)) === 1);
  await refuse("une action fermée ne se rouvre pas", sb.from("actions_back_office").update({ fermee_at: null, raison_fermeture: null }).eq("cle", cleAValider).not("fermee_at", "is", null));
  await refuse("une action ne se supprime pas", sb.from("actions_back_office").delete().eq("cle", cleAValider));

  console.log(`\n${ok} ok · ${ko} échec(s)`);
  process.exit(ko === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`Arrêt : ${(e as Error).message}`);
  process.exit(1);
});
