"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { isN8nSequenceEnabled } from "@/lib/app-settings";
import { notify } from "@/lib/notifications";
import { initiateCall } from "@/lib/ringover";
import { resolveOwner } from "@/lib/routing";
import { sendBrevoEmail, sendBrevoSms } from "@/lib/brevo";
import { buildPhotoRequestEmail, buildPhotoRequestSms } from "@/lib/templates";
import type { DiscoveryOutcome, LeadStatus, SubEnvoi, SubSignature } from "@/lib/leads";
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

  // When the Kanban drag lands on `signe`, find the lead's most recent
  // envoye/ouvert devis and sign it via the shared markDocumentSigned
  // action — that's the single entry-point that also triggers the auto
  // deposit invoice (CDC §2.3). If no devis exists yet, this is a no-op:
  // the lead status change still stands, the commercial will issue the
  // devis next and mark it signed from the document detail.
  if (target === "signe") {
    const { data: devis } = await supabase
      .from("documents")
      .select("id")
      .eq("lead_id", id)
      .eq("type", "devis")
      .in("status", ["envoye", "ouvert"])
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (devis?.id) {
      const { markDocumentSigned } = await import("@/app/(app)/_shared/document-actions");
      await markDocumentSigned(devis.id);
    }
  }

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

// ── Découverte (call 2026-07-11) ─────────────────────────────────────
// Records the discovery outcome + announced price. Ok / Ok voir + just mark
// the discovery as done (last_action reflects which); Refus additionally sends
// the lead to `perdu` with the reason, mirroring markLeadLost. Columns were
// added in migration 20260713000001 (not yet in generated types → cast).
export async function recordDiscovery(
  leadId: string,
  input: { announcedPrice: number | null; outcome: DiscoveryOutcome; reason?: string },
): Promise<Result> {
  const { announcedPrice, outcome } = input;
  const supabase = await supabaseServer();
  const now = new Date().toISOString();

  if (outcome === "refus") {
    const reason = (input.reason ?? "").trim() || "Prix annoncé refusé (découverte)";
    const updates = {
      announced_price: announcedPrice,
      discovery_outcome: "refus",
      discovery_done_at: now,
      status: "perdu",
      lost_reason: reason,
      last_action_label: `Découverte refusée — ${reason}`,
      last_action_at: now,
    };
    const { error } = await supabase.from("leads").update(updates as never).eq("id", leadId);
    if (error) return { ok: false, error: error.message };
  } else {
    const label =
      outcome === "ok"
        ? "Découverte OK — prêt pour devis"
        : "Découverte OK voir + — photos à demander";
    const updates = {
      announced_price: announcedPrice,
      discovery_outcome: outcome,
      discovery_done_at: now,
      last_action_label: label,
      last_action_at: now,
    };
    const { error } = await supabase.from("leads").update(updates as never).eq("id", leadId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/decouverte");
  revalidatePath("/pipeline");
  await auditLog({
    action: "lead.discovery.record",
    entityType: "lead",
    entityId: leadId,
    after: { outcome, announcedPrice },
  });
  return { ok: true };
}

type PhotoLeadRow = {
  is_company: boolean;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  owner: { first_name: string | null; last_name: string | null } | null;
};

// Sends the "demande de photos" template (Brevo email or SMS) so the client
// can supply what's needed to build the devis, and stamps photos_requested_at.
export async function requestPhotos(
  leadId: string,
  channel: "email" | "sms",
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "is_company, client_first_name, client_last_name, client_company, " +
      "client_email, client_phone, owner:users!leads_owner_id_fkey(first_name, last_name)",
    )
    .eq("id", leadId)
    .maybeSingle<PhotoLeadRow>();
  if (!lead) return { ok: false, error: "Lead introuvable." };

  const clientName = lead.is_company
    ? (lead.client_company ?? "")
    : `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim();
  const commercialName = lead.owner
    ? `${lead.owner.first_name ?? ""} ${lead.owner.last_name ?? ""}`.trim() || "Votre conseiller"
    : "Votre conseiller";

  if (channel === "email") {
    if (!lead.client_email) return { ok: false, error: "Aucun email pour ce client." };
    const tpl = buildPhotoRequestEmail({
      clientName: clientName || "Madame, Monsieur",
      commercialName,
    });
    const res = await sendBrevoEmail({
      to: lead.client_email,
      toName: clientName || undefined,
      subject: tpl.subject,
      htmlContent: tpl.htmlContent,
    });
    if (!res.ok) return { ok: false, error: `Échec envoi email : ${res.error}` };
  } else {
    if (!lead.client_phone) return { ok: false, error: "Aucun téléphone pour ce client." };
    const content = buildPhotoRequestSms({ clientName: clientName || "", commercialName });
    const res = await sendBrevoSms({ to: lead.client_phone, content });
    if (!res.ok) return { ok: false, error: `Échec envoi SMS : ${res.error}` };
  }

  const now = new Date().toISOString();
  await supabase
    .from("leads")
    .update({
      photos_requested_at: now,
      last_action_label: `Demande de photos (${channel === "email" ? "email" : "SMS"})`,
      last_action_at: now,
    } as never)
    .eq("id", leadId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/decouverte");
  await auditLog({
    action: "lead.photos.request",
    entityType: "lead",
    entityId: leadId,
    after: { channel },
  });
  return { ok: true };
}

// "Automatique" button — flips the lead to envoye·auto and triggers the
// n8n WF2 workflow. The workflow polls /api/leads/:id/status between
// each email; flipping sub_envoi back to 'mano' (via stopAutoSequence) is
// what interrupts it. Gated by the runtime app_settings toggle so an admin
// can disable it without a redeploy.
//
// Required env to actually call n8n:
//   N8N_WF2_TRIGGER_URL=https://n8n.example.com/webhook/relance-devis
//   N8N_WF2_TRIGGER_SECRET=<same value as WF2_TRIGGER_SECRET on the n8n host>
// If either is unset we still flip the DB state (so the UI works in dev) but
// log a warning instead of POSTing.
export async function launchSequence(id: string): Promise<Result> {
  if (!(await isN8nSequenceEnabled())) {
    return { ok: false, error: "Séquence n8n désactivée par l'administrateur." };
  }
  const supabase = await supabaseServer();

  const { data: lead, error: fetchErr } = await supabase
    .from("leads")
    .select("id, status, sub_envoi, client_email, client_first_name, client_last_name, client_company, is_company, owner_id")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      sub_envoi: string | null;
      client_email: string | null;
      client_first_name: string | null;
      client_last_name: string | null;
      client_company: string | null;
      is_company: boolean;
      owner_id: string | null;
    }>();
  if (fetchErr || !lead) return { ok: false, error: "Lead introuvable." };
  if (!lead.client_email) {
    return { ok: false, error: "Email client manquant — séquence impossible." };
  }
  // Refuse if a sequence is already running for this lead — pressing Auto
  // twice would spawn a parallel n8n execution and double the emails. The
  // simple workflow has no idempotency table, so the guard lives here.
  if (lead.status === "envoye" && lead.sub_envoi === "auto") {
    return { ok: false, error: "Une séquence automatique est déjà en cours pour ce lead." };
  }

  const updates: LeadUpdate = {
    status: "envoye",
    sub_envoi: "auto",
    last_action_label: "Séquence n8n lancée",
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // POST to n8n (best-effort: failures here don't roll back the DB flip —
  // the commercial can re-trigger from the UI if needed, and the workflow
  // is idempotent at the lead level via the `active` check).
  const triggerUrl = process.env.N8N_WF2_TRIGGER_URL;
  const triggerSecret = process.env.N8N_WF2_TRIGGER_SECRET;
  if (triggerUrl && triggerSecret) {
    let commercialName = "Notre équipe";
    if (lead.owner_id) {
      const { data: owner } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", lead.owner_id)
        .maybeSingle<{ first_name: string | null; last_name: string | null }>();
      const composed = [owner?.first_name, owner?.last_name].filter(Boolean).join(" ").trim();
      if (composed) commercialName = composed;
    }
    const firstName =
      (lead.is_company ? lead.client_company : lead.client_first_name) ?? "";
    try {
      const res = await fetch(triggerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trigger-Secret": triggerSecret,
        },
        body: JSON.stringify({
          lead_id: lead.id,
          client_email: lead.client_email,
          client_first_name: firstName,
          commercial_name: commercialName,
        }),
      });
      if (!res.ok) {
        console.warn(`[launchSequence] n8n returned ${res.status} for lead ${id}`);
      }
    } catch (err) {
      console.warn(`[launchSequence] n8n trigger failed for lead ${id}:`, err);
    }
  } else {
    console.warn("[launchSequence] N8N_WF2_TRIGGER_URL/SECRET unset — skipping n8n call.");
  }

  revalidatePath("/pipeline");
  revalidatePath(`/leads/${id}`);
  await auditLog({ action: "lead.sequence.launch", entityType: "lead", entityId: id });
  return { ok: true };
}

// "Manuel" button — interrupts the auto-sequence. The workflow polls the
// status endpoint between each email; flipping sub_envoi to 'mano' makes
// the next poll return active=false, and the workflow exits cleanly at the
// next check (within 24h–120h depending on which step it's on).
//
// We don't kill the n8n execution itself — the workflow's own short-circuit
// is enough and avoids needing an n8n API key in the CRM.
export async function stopAutoSequence(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    sub_envoi: "mano",
    last_action_label: "Séquence interrompue — mode manuel",
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${id}`);
  await auditLog({
    action: "lead.sequence.stop",
    entityType: "lead",
    entityId: id,
    after: { subEnvoi: "mano" },
  });
  return { ok: true };
}

export type NewLeadInput = {
  isCompany: boolean;
  // Identity — caller passes the relevant set based on isCompany.
  firstName: string;
  lastName: string;
  companyName: string;
  // Contact
  email: string;
  phone: string;
  // Address (optional)
  addressLine: string;
  postalCode: string;
  city: string;
  // Routing — required
  activitySlug: "urgence" | "nettoyage" | "enr" | "renovation" | "debarras" | "demenagement";
  sourceSlug:
    | "google_ads"
    | "meta_ads"
    | "site_web"
    | "telephone"
    | "recommandation";
  ownerId: string;
  estimatedAmount: number | null;
  surfaceM2: number | null;
  notes: string;
  // Free-text sub-qualifier within the sector.
  typeService?: string;
  // "Demande extrême" — feeds the commercial-extrême routing tier.
  isExtreme?: boolean;
  // When true, run the routing engine BEFORE saving and let it override
  // ownerId. Off by default for the manual /pipeline modal (the commercial
  // has already picked who); the WF1 inbound webhook will pass true.
  autoRoute?: boolean;
};

export type CreateLeadResult =
  | { ok: true; id: string; shortId: string }
  | { ok: false; error: string };

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

// Create a new lead from the "Nouveau lead" modal. Computes the next
// short_id (L-####) by reading the current max — racy under heavy
// concurrent inserts, but adequate for low/medium volume. If we need
// guaranteed-unique short_ids at scale, replace with a SQL sequence.
export async function createLead(input: NewLeadInput): Promise<CreateLeadResult> {
  // ── Validate ──────────────────────────────────────────────────────
  if (input.isCompany && !input.companyName.trim()) {
    return { ok: false, error: "Raison sociale requise pour un compte pro." };
  }
  if (!input.isCompany && !`${input.firstName} ${input.lastName}`.trim()) {
    return { ok: false, error: "Nom du contact requis." };
  }
  if (!input.phone.trim()) {
    return { ok: false, error: "Téléphone requis." };
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { ok: false, error: "Format d'email invalide." };
  }
  if (!input.ownerId) {
    return { ok: false, error: "Sélectionnez un commercial responsable." };
  }

  const supabase = await supabaseServer();

  // ── Resolve activity + source ids ─────────────────────────────────
  const { data: activity } = await supabase
    .from("activities")
    .select("id")
    .eq("slug", input.activitySlug)
    .maybeSingle<{ id: string }>();
  if (!activity) return { ok: false, error: "Activité introuvable." };

  const { data: source } = await supabase
    .from("lead_sources")
    .select("id")
    .eq("slug", input.sourceSlug)
    .maybeSingle<{ id: string }>();
  if (!source) return { ok: false, error: "Source de lead introuvable." };

  // ── Compute next short_id ─────────────────────────────────────────
  // Read the highest existing "L-NNNN" via lexical sort. Bypass RLS via
  // service-role so commerciaux can see the global counter, not just
  // their own leads' ids.
  const svc = await supabaseServiceRole();
  const { data: maxRow } = await svc
    .from("leads")
    .select("short_id")
    .ilike("short_id", "L-%")
    .order("short_id", { ascending: false })
    .limit(1)
    .maybeSingle<{ short_id: string }>();
  const lastN = maxRow ? parseInt(maxRow.short_id.replace(/^L-/, ""), 10) || 1000 : 1000;
  const nextShortId = `L-${lastN + 1}`;

  // ── Auto-routing (opt-in via input.autoRoute) ─────────────────────
  // Runs the routing rules engine and overrides ownerId if a rule matches.
  // The manual /pipeline modal leaves autoRoute=false (commercial picked).
  let resolvedOwnerId = input.ownerId;
  let routingTrace: string | null = null;
  if (input.autoRoute) {
    const decision = await resolveOwner({
      surfaceM2: input.surfaceM2,
      sectorSlug: input.activitySlug,
      sourceSlug: input.sourceSlug,
      clientIsPremium: false, // no client yet at lead creation — TODO when lead → client conversion happens
      estimatedAmount: input.estimatedAmount,
      isExtreme: input.isExtreme ?? false,
    });
    if (decision) {
      resolvedOwnerId = decision.ownerId;
      routingTrace = `${decision.matchedRuleName} — ${decision.reason}`;
    }
  }

  // ── Insert the lead ───────────────────────────────────────────────
  const payload: LeadInsert = {
    short_id: nextShortId,
    is_company: input.isCompany,
    client_first_name: input.isCompany ? null : (input.firstName.trim() || null),
    client_last_name:  input.isCompany ? null : (input.lastName.trim() || null),
    client_company:    input.isCompany ? input.companyName.trim() : null,
    client_email: input.email.trim() || null,
    client_phone: input.phone.trim() || null,
    client_address: {
      line1: input.addressLine.trim() || null,
      postal_code: input.postalCode.trim() || null,
      city: input.city.trim() || null,
    },
    estimated_amount: input.estimatedAmount,
    surface_m2: input.surfaceM2,
    owner_id: resolvedOwnerId,
    activity_id: activity.id,
    source_id: source.id,
    status: "lead",
    received_at: new Date().toISOString(),
    last_action_label: "Lead créé manuellement",
    last_action_at: new Date().toISOString(),
    notes: input.notes.trim() || null,
  };
  // is_extreme isn't in the generated types yet (migration 20260713000002).
  (payload as Record<string, unknown>).is_extreme = input.isExtreme ?? false;
  (payload as Record<string, unknown>).type_service = input.typeService?.trim() || null;

  const { data: inserted, error } = await supabase
    .from("leads")
    .insert(payload as never)
    .select("id, short_id")
    .maybeSingle<{ id: string; short_id: string }>();
  if (error || !inserted) {
    return { ok: false, error: `Échec de la création : ${error?.message ?? "inconnu"}.` };
  }

  await auditLog({
    action: "lead.create",
    entityType: "lead",
    entityId: inserted.id,
    after: {
      shortId: inserted.short_id,
      activity: input.activitySlug,
      source: input.sourceSlug,
      ownerOverride: routingTrace ? { ownerId: resolvedOwnerId, trace: routingTrace } : null,
    },
  });

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { ok: true, id: inserted.id, shortId: inserted.short_id };
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

// Persist the "Notes d'appel" textarea on the lead detail page. Writes to
// the shared `notes` column. Debounced client-side; called once per pause.
export async function updateLeadNotes(id: string, notes: string): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    notes: notes.trim() || null,
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${id}`);
  await auditLog({
    action: "lead.notes.update",
    entityType: "lead",
    entityId: id,
    after: { length: notes.length },
  });
  return { ok: true };
}

// Quick-relance: set the next_followup_at marker on the lead. The
// optional `hours` argument is added to now(); null clears the marker.
export async function setLeadFollowup(id: string, hours: number | null): Promise<Result> {
  const supabase = await supabaseServer();
  const nextAt = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
  const updates: LeadUpdate = {
    next_followup_at: nextAt,
    last_action_label: hours === null
      ? "Relance annulée"
      : `À rappeler ${hours <= 24 ? "sous 24H" : hours <= 48 ? "sous 48H" : "après 48 heures"}`,
    last_action_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${id}`);
  await auditLog({
    action: "lead.followup.set",
    entityType: "lead",
    entityId: id,
    after: { hours, nextAt },
  });
  return { ok: true };
}

// Post-signature delay capture. delay = null clears the choice;
// delay = enum value sets the bucket. Notes are independent (may be set
// even with no bucket selected). Both are autosaved by the card.
export async function updateInterventionDelay(
  id: string,
  delay: "sous_72h" | "1_semaine" | "15_jours" | "1_mois" | "personnalise" | null,
  notes: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    intervention_delay: delay,
    intervention_delay_notes: notes.trim() || null,
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${id}`);
  revalidatePath("/planification");
  await auditLog({
    action: "lead.intervention_delay.update",
    entityType: "lead",
    entityId: id,
    after: { delay, hasNotes: notes.trim().length > 0 },
  });
  return { ok: true };
}

// Inline editor for the confidential Immobilier/Travaux annotation.
// Guarded server-side by the immobTravaux permission once that's wired.
export async function updateImmobTravauxAnnotation(
  id: string,
  annotation: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: LeadUpdate = {
    immob_travaux_annotation: annotation.trim() || null,
  };
  const { error } = await supabase.from("leads").update(updates as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${id}`);
  await auditLog({
    action: "lead.immob_travaux.update",
    entityType: "lead",
    entityId: id,
  });
  return { ok: true };
}
