"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { assertAdmin } from "@/lib/access-server";
import { lireSeries } from "@/lib/facturation/series-server";
import { verifierSaisieSerie } from "@/lib/facturation/series-shared";
import {
  decryptField,
  encryptField,
  isFieldEncryptionConfigured,
} from "@/lib/crypto/field-encryption";
import {
  masquer,
  validerBic,
  validerCoordonnee,
} from "@/lib/entities/coordonnees-bancaires";
import { paysReconnu } from "@/lib/generation/mentions-produits";
import type { Database } from "@/lib/supabase/database.types";
import {
  buildPayload,
  texte,
  validate,
  type EntityInput,
} from "@/lib/entities-shared";

// ⚠️ NE RIEN RÉEXPORTER D'ICI, PAS MÊME UN TYPE.
//
// Ce fichier portait `export type { EntityInput };` pour que le formulaire
// garde son import historique. TypeScript efface bien cette ligne — mais le
// chargeur d'actions serveur de Turbopack énumère les exports du module et a
// émis une liaison de réexport pour `EntityInput`, symbole qui n'existe pas à
// l'exécution :
//
//   ReferenceError: EntityInput is not defined
//     at module evaluation (… settings/entities/page/actions.js)
//
// L'erreur survenait à l'ÉVALUATION du module, donc au premier POST du
// formulaire — et ni `tsc`, ni ESLint, ni `npm run build` ne l'ont vue : le
// build compile sans jamais évaluer ce module.
//
// La règle est donc stricte : un module `"use server"` n'exporte QUE des
// fonctions asynchrones. Les types vivent dans `lib/entities-shared.ts`, d'où
// les consommateurs les importent directement.

// Admin-only CRUD on legal_entities. RLS already enforces admin-write via
// the existing "legal_entities writable by admin" policy, so non-admin
// callers get a clear error from Postgres.

type EntityUpdate = Database["public"]["Tables"]["legal_entities"]["Update"];

export type Result = { ok: true; id?: string } | { ok: false; error: string };


export async function createEntity(input: EntityInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("legal_entities")
    .insert(buildPayload(input) as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: `Échec création : ${error?.message ?? "inconnu"}.` };
  revalidatePath("/settings/entities");
  revalidatePath("/comptabilite");
  revalidatePath("/devis/new");
  await auditLog({
    action: "entity.create",
    entityType: "user",
    entityId: data.id,
    after: { legalName: texte(input.legalName) },
  });
  return { ok: true, id: data.id };
}

export async function updateEntity(id: string, input: EntityInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("legal_entities")
    .update(buildPayload(input) as EntityUpdate as never)
    .eq("id", id);
  if (error) return { ok: false, error: `Échec mise à jour : ${error.message}.` };
  revalidatePath("/settings/entities");
  revalidatePath("/comptabilite");
  revalidatePath("/devis/new");
  await auditLog({
    action: "entity.update",
    entityType: "user",
    entityId: id,
    after: { legalName: texte(input.legalName) },
  });
  return { ok: true };
}

export async function deleteEntity(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  // Refuse if entity has any documents — preserves accounting integrity.
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Suppression refusée : ${count} document(s) sont rattachés à cette société. Désactivez plutôt manuellement.`,
    };
  }
  const { error } = await supabase.from("legal_entities").delete().eq("id", id);
  if (error) return { ok: false, error: `Échec suppression : ${error.message}.` };
  revalidatePath("/settings/entities");
  await auditLog({
    action: "entity.delete",
    entityType: "user",
    entityId: id,
  });
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════════
//  Coordonnées bancaires — Super Admin SEUL (anomalie D17)
// ══════════════════════════════════════════════════════════════════════
//
// ── POURQUOI UNE ACTION À PART ──────────────────────────────────────
//
// Les champs `iban` et `bic` avaient été RETIRÉS du formulaire le 2026-11-05 :
// `buildPayload()` ne les écrit pas, et c'est précisément ce qui a préservé
// les valeurs des deux sociétés qui en ont une — y mettre une chaîne vide les
// aurait effacées à la première modification de la fiche.
//
// Le client a rouvert le sujet le 2026-11-09 : « L'IBAN doit pouvoir être
// modifié depuis la fiche société, uniquement par le Super Admin ou un
// utilisateur disposant d'une autorisation administrative spécifique. »
//
// D'où une action SÉPARÉE, et non un retour des champs dans `buildPayload` :
//
//   · elle écrit EXACTEMENT deux colonnes, donc aucune autre ne peut être
//     effacée par un formulaire incomplet ;
//   · elle est gardée pour le SEUL Super Admin, là où `updateEntity` est
//     ouverte au back-office ;
//   · elle chiffre, ce que `buildPayload` ne fait pour aucun champ ;
//   · et elle laisse une trace, ce qu'une mise à jour ordinaire ne fait pas.
export async function modifierCoordonneesBancaires(
  entityId: string,
  input: { iban: string; bic: string },
): Promise<Result> {
  // ── Garde 1 : le Super Admin, et lui seul ─────────────────────────
  //
  // `assertBackOffice()` laisserait passer la planification : juste pour un
  // dossier, faux pour un compte bancaire. Modifier l'IBAN d'une société
  // change le compte sur lequel ses clients paient.
  const droit = await assertAdmin();
  if (!droit.ok) return { ok: false, error: droit.error };

  const supabase = await supabaseServer();

  // ── L'état actuel, pour valider contre le bon pays et tracer l'écart ──
  const { data: avant, error: eLecture } = await supabase
    .from("legal_entities")
    .select("id, legal_name, country, iban, bic")
    .eq("id", entityId)
    .maybeSingle<{
      id: string;
      legal_name: string | null;
      country: string | null;
      iban: string | null;
      bic: string | null;
    }>();
  if (eLecture || !avant) {
    return { ok: false, error: `Société introuvable : ${eLecture?.message ?? "aucune ligne"}.` };
  }

  const pays = paysReconnu(avant.country);
  if (!pays) {
    return {
      ok: false,
      error:
        "Le pays de cette société n'est pas renseigné ou n'est pas reconnu. " +
        "Une coordonnée bancaire se valide CONTRE un pays : renseignez-le " +
        "d'abord (Réglages › Sociétés émettrices).",
    };
  }

  // ── Garde 2 : la forme, contre le pays de la société ──────────────
  const vIban = validerCoordonnee(input.iban, pays);
  if (!vIban.ok) return { ok: false, error: `IBAN — ${vIban.motif}` };
  const vBic = validerBic(input.bic, pays);
  if (!vBic.ok) return { ok: false, error: `BIC — ${vBic.motif}` };

  // ── Garde 3 : pas de chiffrement, pas d'écriture ──────────────────
  //
  // Écrire une coordonnée bancaire en clair alors qu'on vient de la déclarer
  // confidentielle serait un recul. Si la clé manque, on refuse en le disant.
  const aChiffrer = vIban.valeurNormalisee !== "" || vBic.valeurNormalisee !== "";
  if (aChiffrer && !isFieldEncryptionConfigured()) {
    return {
      ok: false,
      error:
        "FIELD_ENCRYPTION_KEY absente : les coordonnées bancaires seraient " +
        "stockées en clair. Modification refusée.",
    };
  }

  // Une valeur vide reste `null` en base : c'est ce qui permet d'effacer, et
  // les documents n'impriment alors aucune ligne bancaire.
  const nouveauIban = vIban.valeurNormalisee === "" ? null : encryptField(vIban.valeurNormalisee);
  const nouveauBic = vBic.valeurNormalisee === "" ? null : encryptField(vBic.valeurNormalisee);

  const { error: eMaj } = await supabase
    .from("legal_entities")
    .update({ iban: nouveauIban, bic: nouveauBic } as never)
    .eq("id", entityId);
  if (eMaj) return { ok: false, error: `Échec de l'enregistrement : ${eMaj.message}.` };

  // ── La trace, et c'est elle qui fait l'historique ─────────────────
  //
  // `audit_logs` est APPEND-ONLY et écrit par la clé de service : il est déjà
  // l'historique dont le client a besoin. Aucune table nouvelle, donc aucune
  // migration — et une migration de moins est une autorisation de moins à
  // demander.
  //
  // ⚠️ LA VALEUR N'Y ENTRE JAMAIS EN CLAIR. Le journal est lisible par les
  // administrateurs et conservé des années, alors que la colonne est
  // chiffrée : y écrire l'IBAN annulerait le chiffrement qu'on vient de
  // poser. Seul le masque y figure — assez pour reconnaître un changement de
  // compte, trop peu pour virer de l'argent.
  await auditLog({
    action: "entity.bank_change",
    entityType: "user",
    entityId,
    before: {
      societe: avant.legal_name,
      pays,
      iban: masquer(avant.iban ? decryptField(avant.iban) : ""),
      bic: masquer(avant.bic ? decryptField(avant.bic) : ""),
    },
    after: {
      societe: avant.legal_name,
      pays,
      iban: masquer(vIban.valeurNormalisee),
      bic: masquer(vBic.valeurNormalisee),
      chiffre: aChiffrer,
    },
  });

  revalidatePath("/settings/entities");
  // Les documents reprennent la coordonnée de LEUR société émettrice : on
  // invalide donc aussi les écrans qui les rendent.
  revalidatePath("/comptabilite");
  revalidatePath("/devis");

  return { ok: true, id: entityId };
}

// ── Série de factures d'une société (D26, décision du client du 2026-11-09) ──
// Super Admin seul, comme les coordonnées bancaires : la série porte la
// numérotation légale de la société. La base garde les invariants (format,
// code unique, série active ou employée immuable — 20261109000003) ; cette
// action les vérifie AVANT, pour un message clair, puis trace.
export async function definirSerieFacturation(
  entityId: string,
  input: { code: string; depuis: string },
): Promise<{ ok: true; signalements: string[] } | { ok: false; error: string }> {
  const droit = await assertAdmin();
  if (!droit.ok) return { ok: false, error: droit.error };

  const { migrationAppliquee, series } = await lireSeries();
  if (!migrationAppliquee) {
    return { ok: false, error: "La migration des séries (20261109000003) n'est pas appliquée sur cette base." };
  }
  const cible = series.find((s) => s.id === entityId);
  if (!cible) return { ok: false, error: "Société introuvable." };

  const verdict = verifierSaisieSerie(input, {
    pays: cible.pays,
    serieActive: cible.active || cible.employee,
    codesPris: series.filter((s) => s.id !== entityId && s.code).map((s) => s.code as string),
  });
  if (!verdict.ok) return { ok: false, error: verdict.erreur };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("legal_entities")
    .update({ code_numerotation: verdict.code, numerotation_depuis: verdict.depuis } as never)
    .eq("id", entityId);
  if (error) return { ok: false, error: `Série refusée : ${error.message}` };

  await auditLog({
    action: "entity.invoice_series.set",
    // Même convention que les autres actions sur les sociétés (IBAN compris) :
    // `AuditEntityType` n'a pas de valeur « société » ; l'élargir toucherait la base.
    entityType: "user",
    entityId,
    before: { code: cible.code, depuis: cible.depuis },
    after: { code: verdict.code, depuis: verdict.depuis },
  });
  revalidatePath("/settings/entities");
  return { ok: true, signalements: verdict.signalements };
}
