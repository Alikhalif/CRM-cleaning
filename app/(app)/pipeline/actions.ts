"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { isN8nSequenceEnabled } from "@/lib/app-settings";
import { notify } from "@/lib/notifications";
import { initiateCall } from "@/lib/ringover";
import type { LeadStatus, SubEnvoi, SubSignature } from "@/lib/leads";
import type { Database } from "@/lib/supabase/database.types";

type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

// Server actions that mutate `leads` from the Pipeline UI. All go through
// supabaseServer() (anon key + session cookie) so RLS is enforced: only the
// lead's owner or an admin can update.

type Result = { ok: true } | { ok: false; error: string };

function transitionLabel(target: LeadStatus): string {
  switch (target) {
    case "lead":     return "Replacé en lead entrant";
    case "envoye":   return "Devis envoyé";
    case "ouvert":   return "Lien ouvert";
    case "signe":    return "Devis signé";
    case "encaisse": return "Encaissement final";
    case "perdu":    return "Marqué perdu";
  }
}

export async function updateLeadStatus(id: string, target: LeadStatus): Promise<Result> {
  const supabase = await supabaseServer();
  // Sub-statuses get cleared when they no longer apply.
  const updates: LeadUpdate = {
    status: target,
    last_action_label: transitionLabel(target),
    last_action_at: new Date().toISOString(),
  };
  if (target === "lead") {
    updates.sub_envoi = null;
    updates.sub_signature = null;
  } else if (target === "envoye" || target === "ouvert") {
    updates.sub_signature = null;
  }

  // The `as never` cast is a known workaround for a postgrest-js generic
  // mismatch with @supabase/ssr — without it `.update()` infers `never` as
  // its parameter type. The `LeadUpdate` annotation above keeps type-safety
  // at construction; only the SDK boundary loses it.
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  await auditLog({ action: "lead.status.change", entityType: "lead", entityId: id, after: { status: target } });
  return { ok: true };
}

export async function updateLeadSubEnvoi(id: string, value: SubEnvoi): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    sub_envoi: value,
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  await auditLog({ action: "lead.sub_envoi.set", entityType: "lead", entityId: id, after: { subEnvoi: value } });
  return { ok: true };
}

export async function updateLeadSubSignature(id: string, value: SubSignature): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    sub_signature: value,
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  await auditLog({ action: "lead.sub_signature.set", entityType: "lead", entityId: id, after: { subSignature: value } });
  return { ok: true };
}

export type ContactInput = {
  // Identity — caller passes both sets; we only persist the relevant ones
  // based on the lead's existing is_company shape (toggling type is a
  // separate, heavier concern not handled here).
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
};

// Edit a lead's contact info. is_company is NOT changed here — that flips
// which name fields are authoritative and would warrant its own migration
// of any downstream client rows, so it's left to a dedicated flow later.
// The address is stored as JSON in client_address; we always overwrite the
// three known keys but preserve any other fields the LP form may have
// passed through (e.g. country, complement).
export async function updateLeadContact(
  id: string,
  isCompany: boolean,
  input: ContactInput,
): Promise<Result> {
  // Light validation — fuller checks (E.164 phone, MX-lookup email) belong
  // in a Zod schema once we add the dep. For now: required name, optional
  // email-shape sanity, accept any phone string the user types.
  if (isCompany && !input.company.trim()) {
    return { ok: false, error: "Raison sociale requise." };
  }
  if (!isCompany && !`${input.firstName} ${input.lastName}`.trim()) {
    return { ok: false, error: "Nom du contact requis." };
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { ok: false, error: "Format d'email invalide." };
  }

  const supabase = await supabaseServer();

  // Preserve any unknown address keys that came from the LP form.
  const { data: prior } = await supabase
    .from("leads")
    .select("client_address")
    .eq("id", id)
    .maybeSingle<{ client_address: Record<string, unknown> | null }>();
  const priorAddress = (prior?.client_address ?? {}) as Record<string, unknown>;
  const nextAddress = {
    ...priorAddress,
    line1: input.addressLine.trim() || null,
    postal_code: input.postalCode.trim() || null,
    city: input.city.trim() || null,
  };

  const updates: LeadUpdate = {
    client_first_name: isCompany ? null : (input.firstName.trim() || null),
    client_last_name: isCompany ? null : (input.lastName.trim() || null),
    client_company: isCompany ? input.company.trim() : null,
    client_email: input.email.trim() || null,
    client_phone: input.phone.trim() || null,
    client_address: nextAddress,
    last_action_label: "Coordonnées mises à jour",
    last_action_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  await auditLog({
    action: "lead.contact.update",
    entityType: "lead",
    entityId: id,
    after: {
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      addressLine: input.addressLine.trim() || null,
      postalCode: input.postalCode.trim() || null,
      city: input.city.trim() || null,
    },
  });
  return { ok: true };
}

// Reassign a lead to another commercial. RLS allows admin/planner/lead-owner
// to write, so a commercial can hand off their own lead (e.g. going on leave)
// without needing admin help. The new owner picks up the RLS scope on next
// read — no extra propagation needed.
export async function reassignLead(id: string, newOwnerId: string): Promise<Result> {
  if (!newOwnerId) return { ok: false, error: "Sélectionnez un commercial." };
  const supabase = await supabaseServer();

  // Capture a display name for the notification before mutating — the read
  // is RLS-scoped, but the inserting user already has access to the lead
  // (otherwise reassign would have been blocked).
  const { data: leadBefore } = await supabase
    .from("leads")
    .select("client_first_name, client_last_name, client_company, is_company, short_id")
    .eq("id", id)
    .maybeSingle<{
      client_first_name: string | null;
      client_last_name: string | null;
      client_company: string | null;
      is_company: boolean;
      short_id: string;
    }>();

  const updates: LeadUpdate = {
    owner_id: newOwnerId,
    last_action_label: "Lead réassigné",
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  await auditLog({ action: "lead.reassign", entityType: "lead", entityId: id, after: { ownerId: newOwnerId } });

  // Notify the new owner. Skip if reassigning to oneself — would be noise.
  const { data: { user: actor } } = await supabase.auth.getUser();
  if (leadBefore && actor && actor.id !== newOwnerId) {
    const clientLabel = leadBefore.is_company
      ? (leadBefore.client_company ?? leadBefore.short_id)
      : `${leadBefore.client_first_name ?? ""} ${leadBefore.client_last_name ?? ""}`.trim() ||
        leadBefore.short_id;
    await notify({
      userId: newOwnerId,
      kind: "lead.assigned",
      entityType: "lead",
      entityId: id,
      title: `Nouveau lead : ${clientLabel}`,
      body: `Lead ${leadBefore.short_id} vous a été réassigné.`,
      href: `/leads/${id}`,
    });
  }

  return { ok: true };
}

// Mark a lead as lost. CDC §2.3: perdu is a manual-only transition (no
// webhook can flip a lead into perdu, only a commercial can). The reason
// is stored as free text — the modal builds it from a preset category
// plus optional details ("Concurrence — devis 30% plus bas") so analytics
// can still group by category later via a `like` filter.
export async function markLeadLost(id: string, reason: string): Promise<Result> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Motif de perte requis." };
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    status: "perdu",
    lost_reason: trimmed,
    last_action_label: `Lead perdu — ${trimmed}`,
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  await auditLog({ action: "lead.lost", entityType: "lead", entityId: id, after: { reason: trimmed } });
  return { ok: true };
}

// Toggle the NRP (« Ne Répond Pas ») flag on a lead. The pipeline status
// stays as-is — NRP is an orthogonal annotation surfacing leads that
// haven't answered a contact attempt, so the commercial can filter them
// later and follow up. last_action_label updates so the activity log
// shows the toggle.
export async function setLeadNrp(id: string, nrp: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const now = new Date().toISOString();
  const updates: LeadUpdate = {
    is_nrp: nrp,
    nrp_at: nrp ? now : null,
    last_action_label: nrp ? "Lead marqué NRP" : "Lead NRP retiré",
    last_action_at: now,
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  await auditLog({ action: "lead.nrp.set", entityType: "lead", entityId: id, after: { nrp } });
  return { ok: true };
}

// Stub for the n8n WF2 trigger — for now it just flips the lead to
// envoye·auto + writes a timeline label, the same shape the mock used.
// When the n8n integration lands, replace the body with the JWT-signed
// POST to /webhook/relance-devis. Gated by the runtime app_settings
// toggle so an admin can disable it without a redeploy + a stale browser
// tab can't trigger the action when it's off (defense in depth — the UI
// hides the button via the same setting).
export async function launchSequence(id: string): Promise<Result> {
  if (!(await isN8nSequenceEnabled())) {
    return { ok: false, error: "Séquence n8n désactivée par l'administrateur." };
  }
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    status: "envoye",
    sub_envoi: "auto",
    last_action_label: "Séquence n8n lancée",
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${id}`);
  await auditLog({ action: "lead.sequence.launch", entityType: "lead", entityId: id });
  return { ok: true };
}

// Click-to-call: ring the commercial's Ringover device, which then dials
// the lead's phone. Runs in fake mode unless RINGOVER_API_KEY +
// RINGOVER_API_BASE are configured — fake mode still goes through the
// audit log so the activity is visible.
export async function callLead(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: lead, error } = await supabase
    .from("leads")
    .select("client_phone")
    .eq("id", id)
    .maybeSingle<{ client_phone: string | null }>();
  if (error || !lead) return { ok: false, error: "Lead introuvable." };
  if (!lead.client_phone) return { ok: false, error: "Ce lead n'a pas de téléphone." };

  const result = await initiateCall({
    fromAgentId: user.id, // Ringover maps Supabase user id → agent via env later
    toNumber: lead.client_phone,
    leadId: id,
  });
  if (!result.ok) return { ok: false, error: `Ringover : ${result.error}` };

  await auditLog({
    action: "lead.call.outbound",
    entityType: "lead",
    entityId: id,
    after: {
      toNumber: lead.client_phone,
      callId: result.callId,
      fake: result.fake,
    },
  });

  // Also bump last_action so the timeline reflects the call attempt.
  await supabase
    .from("leads")
    .update({
      last_action_label: result.fake ? "Appel (fake) lancé" : "Appel lancé",
      last_action_at: new Date().toISOString(),
    } as never)
    .eq("id", id);

  revalidatePath("/pipeline");
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}
