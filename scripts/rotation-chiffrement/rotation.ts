// Procédure unifiée D14 + D17 — rotation des clés et premier chiffrement des
// coordonnées bancaires.
//
//   npm run rotation                      → SIMULATION (défaut, n'écrit rien)
//   npm run rotation -- --ecrire          → écrit, hors production uniquement
//   npm run rotation -- --env .env.recette
//
// ── CE SCRIPT EST INACTIF PAR DÉFAUT ────────────────────────────────
//
// Sans `--ecrire`, il lit, décide, compte et rapporte. Aucune écriture. C'est
// le mode « simulation obligatoire » demandé : on voit exactement ce qui
// serait fait avant que quoi que ce soit le soit.
//
// ── ET IL REFUSE LA PRODUCTION, SANS CONDITION ──────────────────────
//
// Il n'existe AUCUN drapeau pour écrire en production. Ce n'est pas un oubli :
// la consigne du client est « aucune modification de production », et la façon
// la plus simple de la tenir est qu'aucun chemin de code ne le permette. Le
// jour où la rotation en production sera autorisée, ce refus sera levé
// explicitement, et ce sera visible dans un diff.
//
// ── LES CINQ GARDES ─────────────────────────────────────────────────
//
//   1. la cible ne doit pas être la production (sinon refus) ;
//   2. une sauvegarde doit être déclarée (sinon refus d'écrire) ;
//   3. une seule valeur illisible refuse le LOT ENTIER ;
//   4. chaque écriture est RELUE et vérifiée avant de passer au lot suivant ;
//   5. aucune valeur, aucune clé, aucun secret n'est imprimé.

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  clesDeLecture,
  decryptField,
  ecritureV2Active,
  encryptField,
} from "@/lib/crypto/field-encryption";
import {
  type ColonneChiffree,
  type ResumeLot,
  COLONNES_CHIFFREES,
  LOT_VIDE,
  additionner,
  autorisationEcriture,
  conversionTerminee,
  deciderRotation,
  resumer,
} from "@/lib/crypto/rotation";
import { hoteDe, modeEffectif } from "@/lib/env/cible";

const TAILLE_LOT = 200;

// ── Arguments ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ECRIRE = args.includes("--ecrire");
const FICHIER_ENV = (() => {
  const i = args.indexOf("--env");
  return i >= 0 && args[i + 1] ? args[i + 1] : ".env.local";
})();

// ── Lecture du fichier d'environnement ───────────────────────────────
//
// Comme `verif:cible` : c'est Next qui charge `.env.local`, pas Node. Le
// script doit donc le lire lui-même pour voir ce que l'application verrait.

function lireEnv(chemin: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(chemin)) return out;
  for (const brute of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i <= 0) continue;
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = lireEnv(FICHIER_ENV);
// Les fonctions de chiffrement lisent `process.env` : on l'alimente depuis le
// fichier, sans jamais imprimer une valeur.
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const barre = "═".repeat(74);
const ligne = "─".repeat(74);

console.log(barre);
console.log("  ROTATION DU CHIFFREMENT — D14 (clés) + D17 (coordonnées bancaires)");
console.log(barre);
console.log(`Fichier d'environnement : ${FICHIER_ENV}${existsSync(FICHIER_ENV) ? "" : "  ⚠️ INTROUVABLE"}`);
console.log(`Mode                    : ${ECRIRE ? "ÉCRITURE" : "SIMULATION (aucune écriture)"}`);
console.log("");

// ── GARDE 1 — la cible n'est pas la production ───────────────────────

const mode = modeEffectif({ cgkEnv: env.CGK_ENV, nodeEnv: "development" });
const hoteCible = hoteDe(env.NEXT_PUBLIC_SUPABASE_URL);
const hoteProd = hoteDe(env.CGK_SUPABASE_URL_PRODUCTION);

console.log(`Mode déclaré            : ${mode}`);
console.log(`Base visée              : ${hoteCible ?? "(non définie)"}`);
console.log(`Production déclarée     : ${hoteProd ?? "(non déclarée)"}`);
console.log("");

function refuser(raison: string): never {
  console.error(`REFUS — ${raison}`);
  console.error("Rien n'a été lu, rien n'a été écrit.");
  process.exit(1);
}

if (!hoteCible) refuser("NEXT_PUBLIC_SUPABASE_URL n'est pas définie : la cible est inconnue.");
if (mode === "production") {
  refuser(
    "le mode déclaré est « production ». Ce script N'A AUCUN chemin d'écriture " +
      "en production, par construction. Visez une base de recette.",
  );
}
if (hoteProd && hoteCible === hoteProd) {
  refuser(`la base visée EST la production (${hoteCible}).`);
}
if (!hoteProd) {
  console.warn(
    "⚠️  CGK_SUPABASE_URL_PRODUCTION n'est pas déclarée : impossible de " +
      "vérifier que la cible n'est pas la production. Déclarez-la.",
  );
  if (ECRIRE) refuser("écriture refusée tant que la production n'est pas déclarée.");
}

// ── GARDE 2 — une sauvegarde doit être déclarée ──────────────────────

const SAUVEGARDE = (env.CGK_ROTATION_SAUVEGARDE ?? "").trim();
if (ECRIRE && !SAUVEGARDE) {
  refuser(
    "aucune sauvegarde déclarée. Posez CGK_ROTATION_SAUVEGARDE avec la " +
      "référence de votre sauvegarde (date, identifiant de snapshot, chemin du " +
      "dump). Le script ne vérifie pas qu'elle existe — il vérifie que vous " +
      "l'avez affirmée, et il la journalise.",
  );
}

// ── Les clés ─────────────────────────────────────────────────────────

const cles = clesDeLecture();
if (cles.length === 0) refuser("aucune clé de chiffrement exploitable (FIELD_ENCRYPTION_KEY).");
const kidCible = cles[0].kid;

console.log(`Clés de lecture         : ${cles.length}`);
console.log(`Clé cible (kid)         : ${kidCible}`);
console.log(`Écriture en encv2       : ${ecritureV2Active() ? "oui" : "NON — posez CGK_CHIFFREMENT_V2=oui"}`);
if (SAUVEGARDE) console.log(`Sauvegarde déclarée     : ${SAUVEGARDE}`);
console.log("");

if (ECRIRE && !ecritureV2Active()) {
  refuser(
    "CGK_CHIFFREMENT_V2 n'est pas posée : les écritures resteraient en encv1, " +
      "sans identifiant de clé — donc sans reprise possible. C'est tout " +
      "l'objet de la procédure.",
  );
}

// ── Le client Supabase ───────────────────────────────────────────────

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!service) refuser("SUPABASE_SERVICE_ROLE_KEY absente : la lecture des colonnes chiffrées l'exige.");

const sb = createClient(url, service, { auth: { persistSession: false } });

// ── La passe, colonne par colonne ────────────────────────────────────

type Anomalie = { table: string; colonne: string; etiquette: string; motif: string };

const illisibles: Anomalie[] = [];
let global: ResumeLot = { ...LOT_VIDE };
let ecrites = 0;
let verifiees = 0;

async function traiter(c: ColonneChiffree): Promise<ResumeLot> {
  let resume: ResumeLot = { ...LOT_VIDE };
  let dernierId: string | null = null;

  for (;;) {
    let q = sb
      .from(c.table)
      .select(`id, ${c.etiquette}, ${c.colonne}`)
      .not(c.colonne, "is", null)
      .order("id", { ascending: true })
      .limit(TAILLE_LOT);
    if (dernierId) q = q.gt("id", dernierId);

    const { data, error } = await q;
    if (error) {
      // Une colonne absente (migration non appliquée) n'est pas une erreur de
      // la procédure : on le dit et on passe.
      console.log(`    ⚠️  ${c.table}.${c.colonne} illisible : ${error.message}`);
      return resume;
    }
    const lignes = (data ?? []) as unknown as Record<string, string | null>[];
    if (lignes.length === 0) break;

    const decisions = lignes.map((l) =>
      deciderRotation(l[c.colonne], {
        kidCible,
        chiffrerLeClair: c.enClairAujourdhui,
        dechiffrer: decryptField,
      }),
    );
    const r = resumer(decisions);
    resume = additionner(resume, r);

    for (const [i, d] of decisions.entries()) {
      if (d.action !== "illisible") continue;
      illisibles.push({
        table: c.table,
        colonne: c.colonne,
        etiquette: String(lignes[i][c.etiquette] ?? lignes[i].id ?? "?"),
        motif: d.motif,
      });
    }

    // ── GARDE 3 — une seule illisible refuse le LOT ENTIER ──────────
    const feu = autorisationEcriture(r);
    if (ECRIRE && !feu.ok) {
      console.error(`    REFUS D'ÉCRITURE — ${feu.raison}`);
      dernierId = String(lignes[lignes.length - 1].id);
      continue; // on continue de COMPTER, sans jamais écrire
    }

    if (ECRIRE) {
      for (const [i, d] of decisions.entries()) {
        if (d.action !== "a_convertir" || d.clair === undefined) continue;
        const id = String(lignes[i].id);
        const nouvelle = encryptField(d.clair);

        const { error: eMaj } = await sb
          .from(c.table)
          .update({ [c.colonne]: nouvelle } as never)
          .eq("id", id);
        if (eMaj) {
          console.error(`    échec d'écriture sur ${c.table} ${id} : ${eMaj.message}`);
          continue;
        }
        ecrites++;

        // ── GARDE 4 — relire et vérifier ────────────────────────────
        const { data: relu } = await sb
          .from(c.table)
          .select(c.colonne)
          .eq("id", id)
          .maybeSingle<Record<string, string | null>>();
        const apres = relu?.[c.colonne] ?? "";
        if (apres && decryptField(apres) === d.clair) {
          verifiees++;
        } else {
          console.error(
            `    🔴 INTÉGRITÉ : ${c.table} ${id} relu ne rend pas la même valeur. ` +
              "ARRÊT. Votre sauvegarde est la référence.",
          );
          process.exit(2);
        }
      }
    }

    dernierId = String(lignes[lignes.length - 1].id);
    if (lignes.length < TAILLE_LOT) break;
  }

  return resume;
}

// ── Programme ────────────────────────────────────────────────────────

(async () => {
  for (const c of COLONNES_CHIFFREES) {
    console.log(`${ligne}`);
    console.log(`${c.table}.${c.colonne}`);
    console.log(`  ${c.pourquoi}`);
    console.log(`  ${c.enClairAujourdhui ? "premier chiffrement (volet D17)" : "rotation (volet D14)"}`);
    const r = await traiter(c);
    global = additionner(global, r);
    console.log(
      `  vides ${r.vides} · laissées ${r.laissees} · déjà faites ${r.dejaConverties} ` +
        `· à convertir ${r.aConvertir} · ILLISIBLES ${r.illisibles}`,
    );
  }

  console.log("");
  console.log(barre);
  console.log("  RÉSUMÉ");
  console.log(barre);
  console.log(`Colonnes traitées       : ${COLONNES_CHIFFREES.length}`);
  console.log(`Valeurs examinées       : ${global.total}`);
  console.log(`  vides                 : ${global.vides}`);
  console.log(`  clair laissé           : ${global.laissees}`);
  console.log(`  déjà converties        : ${global.dejaConverties}`);
  console.log(`  à convertir            : ${global.aConvertir}`);
  console.log(`  ILLISIBLES             : ${global.illisibles}`);
  if (ECRIRE) {
    console.log(`Écrites                 : ${ecrites}`);
    console.log(`Relues et vérifiées     : ${verifiees}`);
  }
  console.log("");

  if (illisibles.length > 0) {
    console.log("🔴 VALEURS ILLISIBLES — rien n'a été écrit pour elles :");
    for (const a of illisibles.slice(0, 40)) {
      console.log(`  ${a.table}.${a.colonne} [${a.etiquette}] — ${a.motif}`);
    }
    if (illisibles.length > 40) console.log(`  … et ${illisibles.length - 40} autres`);
    console.log("");
    console.log("Déclarez la clé manquante dans FIELD_ENCRYPTION_KEYS_ANCIENNES,");
    console.log("ou constatez la perte AVANT de poursuivre. Les réécrire les");
    console.log("perdrait définitivement.");
    console.log(barre);
    process.exit(1);
  }

  if (!ECRIRE) {
    console.log("SIMULATION terminée. Aucune écriture.");
    console.log(
      global.aConvertir > 0
        ? `Pour convertir les ${global.aConvertir} valeurs : relancez avec --ecrire.`
        : "Rien à convertir : la base est déjà au format cible.",
    );
  } else if (conversionTerminee(global)) {
    console.log("CONVERSION TERMINÉE — toutes les valeurs sont scellées par la clé cible.");
    console.log("");
    console.log("⚠️  NE RETIREZ PAS ENCORE l'ancienne clé. Relancez d'abord ce");
    console.log("    script en SIMULATION : il doit annoncer « rien à convertir ».");
    console.log("    Le retrait de FIELD_ENCRYPTION_KEYS_ANCIENNES est le point");
    console.log("    de non-retour.");
  } else {
    console.log(`Conversion INCOMPLÈTE : ${global.aConvertir} valeur(s) restante(s).`);
    console.log("Relancez : la reprise est sans risque, l'identifiant de clé dit");
    console.log("toujours ce qui reste à faire.");
  }
  console.log(barre);
})().catch((e) => {
  console.error("Échec inattendu :", e instanceof Error ? e.message : e);
  process.exit(3);
});
