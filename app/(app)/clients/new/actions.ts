"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import type { Database, Json } from "@/lib/supabase/database.types";
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

// ── Lead → Client auto-conversion (CDC §3) ─────────────────────────────
//
// Idempotent: if a client with source_lead_id == leadId already exists,
// returns its id without writing anything. Otherwise creates a client by
// copying the lead's contact data (name, email, phone, address, sector)
// and stamping `source='lead'` so the comptabilité can distinguish
// lead-originated customers from direct walk-ins.
//
// Called server-side from /devis/new?lead=... so the QuoteEditor's client
// dropdown always has the lead's client ready to pre-select. Service-role
// is used because commerciaux must be able to convert their own lead even
// when RLS on clients restricts INSERT to admin/planner.

type LeadFetchRow = {
  id: string;
  is_company: boolean;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: Json | null;
  activity_id: string | null;
};

export type EnsureClientResult =
  | { ok: true; clientId: string; created: boolean }
  | { ok: false; error: string };

export async function ensureClientFromLead(leadId: string): Promise<EnsureClientResult> {
  if (!leadId) return { ok: false, error: "leadId requis." };

  const supabase = await supabaseServer();

  // Step 1 — idempotency check: does a client already point to this lead?
  // Reads via the user's session so RLS catches "lead belongs to another
  // commercial" before we attempt to copy data they can't see.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("source_lead_id", leadId)
    .maybeSingle<{ id: string }>();
  if (existing) return { ok: true, clientId: existing.id, created: false };

  // Step 2 — fetch the lead. RLS scopes — if the caller can't see this lead,
  // we short-circuit with a clean error rather than leaking via service-role.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select(
      "id, is_company, client_first_name, client_last_name, client_company, " +
      "client_email, client_phone, client_address, activity_id",
    )
    .eq("id", leadId)
    .maybeSingle<LeadFetchRow>();
  if (leadErr || !lead) return { ok: false, error: "Lead introuvable ou inaccessible." };

  // Step 3 — derive the client fields from the lead row.
  const composedName = lead.is_company
    ? (lead.client_company ?? "Société sans nom")
    : `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim() || "Sans nom";
  const contactName =
    lead.is_company
      ? `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim() || null
      : null;
  const sectors = lead.activity_id ? [lead.activity_id] : [];

  // Step 4 — INSERT via service-role to bypass the admin-only RLS on
  // clients.INSERT. The conversion is a system-driven derivation of an
  // existing visible lead, not a free-form client creation, so this is
  // safe — we're not exposing arbitrary insertion.
  const svc = await supabaseServiceRole();
  const payload: Database["public"]["Tables"]["clients"]["Insert"] = {
    type: lead.is_company ? "pro" : "particulier",
    source: "lead",
    name: composedName,
    contact_name: contactName,
    email: lead.client_email,
    phone: lead.client_phone,
    address: lead.client_address,
    source_lead_id: lead.id,
    sectors,
  };
  const { data: inserted, error: insErr } = await svc
    .from("clients")
    .insert(payload as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (insErr || !inserted) {
    return { ok: false, error: `Échec de la conversion : ${insErr?.message ?? "inconnu"}.` };
  }

  revalidatePath("/clients");
  revalidatePath(`/leads/${leadId}`);
  await auditLog({
    action: "client.create_from_lead",
    entityType: "client",
    entityId: inserted.id,
    after: { lead_id: leadId, name: composedName, type: payload.type },
  });
  return { ok: true, clientId: inserted.id, created: true };
}
