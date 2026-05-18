"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import type { ClientType, Sector } from "@/lib/leads";

// Per CDC §3, the clients module is admin/planner only. Commerciaux landing
// on this page (e.g. via the /devis/new "+ Créer un client" link) will hit
// RLS on submit and get a clear server message — UX-wise we surface it as a
// banner above the form, no silent failure.

type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

export type CreateClientInput = {
  type: ClientType;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  siret: string;
  vatIntra: string;
  // UI sends sector slugs; we resolve to activity UUIDs server-side because
  // clients.sectors is uuid[] referencing activities.id.
  sectors: Sector[];
  note: string;
};

export type CreateClientResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createDirectClient(
  input: CreateClientInput,
): Promise<CreateClientResult> {
  // ── 1. Validate ──────────────────────────────────────────────────────
  if (!input.name.trim()) return { ok: false, error: "Nom requis." };
  if (!input.email.trim()) return { ok: false, error: "Email requis." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { ok: false, error: "Format d'email invalide." };
  }
  if (!input.phone.trim()) return { ok: false, error: "Téléphone requis." };
  if (!input.address.trim() || !input.postalCode.trim() || !input.city.trim()) {
    return { ok: false, error: "Adresse complète requise (rue, CP, ville)." };
  }
  if (input.type === "pro" && !input.siret.trim()) {
    return { ok: false, error: "SIRET requis pour les professionnels." };
  }

  const supabase = await supabaseServer();

  // ── 2. Resolve sector slugs → activity UUIDs ─────────────────────────
  let sectorIds: string[] = [];
  if (input.sectors.length > 0) {
    const { data: activities, error: actErr } = await supabase
      .from("activities")
      .select("id, slug")
      .in("slug", input.sectors)
      .returns<{ id: string; slug: Sector }[]>();
    if (actErr) {
      return { ok: false, error: `Activités introuvables : ${actErr.message}` };
    }
    sectorIds = (activities ?? []).map((a) => a.id);
  }

  // ── 3. Build the address jsonb the way leads-server reads it back ────
  const addressJson = {
    line1: input.address.trim(),
    postal_code: input.postalCode.trim(),
    city: input.city.trim(),
  };

  // ── 4. INSERT ────────────────────────────────────────────────────────
  const payload: ClientInsert = {
    type: input.type,
    source: "direct",
    name: input.name.trim(),
    contact_name: input.type === "pro" ? (input.contactName.trim() || null) : null,
    email: input.email.trim(),
    phone: input.phone.trim(),
    address: addressJson,
    siret: input.type === "pro" ? input.siret.trim() : null,
    vat_intra: input.type === "pro" ? (input.vatIntra.trim() || null) : null,
    sectors: sectorIds,
    note: input.note.trim() || null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("clients")
    .insert(payload as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (insErr || !inserted) {
    return { ok: false, error: `Échec de la création : ${insErr?.message ?? "inconnu"}.` };
  }

  revalidatePath("/clients");
  await auditLog({
    action: "client.create",
    entityType: "client",
    entityId: inserted.id,
    after: { type: input.type, name: input.name.trim() },
  });
  return { ok: true, id: inserted.id };
}
