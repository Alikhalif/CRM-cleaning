"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import type { LegalForm } from "@/lib/leads";

// Admin-only CRUD on legal_entities. RLS already enforces admin-write via
// the existing "legal_entities writable by admin" policy, so non-admin
// callers get a clear error from Postgres.

type EntityInsert = Database["public"]["Tables"]["legal_entities"]["Insert"];
type EntityUpdate = Database["public"]["Tables"]["legal_entities"]["Update"];

export type EntityInput = {
  legalName: string;
  legalForm: LegalForm;
  siret: string;
  apeCode: string;
  vatNumber: string;
  addressLine: string;
  postalCode: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  iban: string;
  bic: string;
  defaultVatRate: number;
  legalMentions: string;
  color: string;
};

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function validate(input: EntityInput): string | null {
  if (!input.legalName.trim()) return "Raison sociale requise.";
  if (!input.legalForm) return "Forme juridique requise.";
  if (!/^\d{14}$/.test(input.siret.replace(/\s/g, ""))) {
    return "SIRET invalide (14 chiffres attendus).";
  }
  if (input.defaultVatRate < 0 || input.defaultVatRate > 100) {
    return "Taux de TVA invalide (0–100).";
  }
  return null;
}

function buildPayload(input: EntityInput): Omit<EntityInsert, "id"> {
  return {
    legal_name: input.legalName.trim(),
    legal_form: input.legalForm,
    siret: input.siret.replace(/\s/g, ""),
    ape_code: input.apeCode.trim(),
    vat_number: input.vatNumber.trim(),
    address: {
      line1: input.addressLine.trim() || null,
      postal_code: input.postalCode.trim() || null,
      city: input.city.trim() || null,
    },
    contact_email: input.contactEmail.trim() || null,
    contact_phone: input.contactPhone.trim() || null,
    iban: input.iban.replace(/\s/g, "") || "",
    bic: input.bic.trim() || "",
    default_vat_rate: input.defaultVatRate,
    legal_mentions: input.legalMentions.trim() || null,
    color: input.color || "#5b4bcc",
  };
}

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
    after: { legalName: input.legalName.trim() },
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
    after: { legalName: input.legalName.trim() },
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
