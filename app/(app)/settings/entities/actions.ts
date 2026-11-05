"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
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
