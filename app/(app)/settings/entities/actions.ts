"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import { COUNTRY_LABEL, IDENTIFIANT_LEGAL, type Country, type LegalForm } from "@/lib/leads";

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
  representativeName: string;
  representativeTitle: string;
  representativeCompanyName: string;
  country: Country;
  /** Identifiant légal national. Cf. `IDENTIFIANT_LEGAL` dans lib/leads.ts. */
  siren: string;
};

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function validate(input: EntityInput): string | null {
  if (!input.legalName.trim()) return "Raison sociale requise.";
  if (!input.legalForm) return "Forme juridique requise.";
  if (!input.country) return "Pays d'établissement requis.";

  // Le SIRET à 14 chiffres n'existe QU'EN FRANCE. La règle précédente
  // s'appliquait à toutes les sociétés : aucune entité suisse, belge,
  // luxembourgeoise ou canadienne ne pouvait être enregistrée, alors que le
  // CRM opère dans ces cinq pays. On ne l'exige donc qu'en France, et on
  // demande ailleurs l'identifiant légal national.
  if (input.country === "FR") {
    if (!/^\d{14}$/.test(input.siret.replace(/\s/g, ""))) {
      return "SIRET invalide (14 chiffres attendus pour une société française).";
    }
  } else if (!input.siren.trim() && !input.siret.trim() && !input.vatNumber.trim()) {
    const l = IDENTIFIANT_LEGAL[input.country].label;
    return `Identifiant légal requis (${l}) pour une société ${COUNTRY_LABEL[input.country]}.`;
  }
  if (input.defaultVatRate < 0 || input.defaultVatRate > 100) {
    return "Taux de TVA invalide (0–100).";
  }
  return null;
}

/**
 * Charge utile d'écriture.
 *
 * `representative_company_name` est ajoutée par la migration
 * `20261104000001`, pas encore poussée au moment où ce code est écrit : les
 * types générés (`lib/supabase/database.types.ts`) l'ignorent donc. On élargit
 * le type ici plutôt que de retoucher à la main un fichier généré, qui serait
 * écrasé au prochain `supabase gen types`. Après `npx supabase db push` et
 * régénération, cette intersection devient redondante et peut disparaître.
 */
type EntityPayload = Omit<EntityInsert, "id"> & {
  representative_company_name: string | null;
};

function buildPayload(input: EntityInput): EntityPayload {
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
    // Volontairement PAS obligatoires côté formulaire : les sept sociétés
    // existantes en sont dépourvues, et imposer le champ bloquerait une
    // modification sans rapport. Le refus se fait là où il compte — à
    // l'émission d'un contrat de sous-traitance, par `controlerEntite()`.
    representative_name: input.representativeName.trim() || null,
    representative_title: input.representativeTitle.trim() || null,
    // Représentation par une personne morale : optionnelle, et c'est voulu.
    // La plupart des sociétés sont représentées par une personne physique.
    representative_company_name: input.representativeCompanyName.trim() || null,
    country: input.country,
    siren: input.siren.replace(/\s/g, "") || null,
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
