import "server-only";
import { supabaseServer } from "./supabase/server";
import type { Database, Json } from "./supabase/database.types";

// Append-only audit trail (CDC §8.2). Every mutating server action writes a
// row here for compliance + forensics. RLS allows authenticated INSERT and
// admin-only SELECT — non-admins can't read each other's audit trail.
//
// Best-effort write: a failure here MUST NOT fail the user's action. We
// swallow errors and console.error, so a missing/down audit table doesn't
// silently break leads, devis, etc. The trade-off: a brief outage of the
// audit table is invisible to the user (which is the right call — the user
// did their work; we just lost a log entry).

type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

// Stable action namespace. Strings, not an enum, so call sites don't need
// to import every value — but documented here so we don't drift on naming.
//
//   lead.status.change      — status moved through pipeline
//   lead.sub_envoi.set      — Mano / Auto sub-status set
//   lead.sub_signature.set  — Sans / Avec acompte set
//   lead.nrp.set            — NRP flag toggled
//   lead.lost               — manually marked perdu
//   lead.reassign           — owner_id changed
//   lead.contact.update     — coordonnées edited
//   lead.sequence.launch    — n8n WF2 triggered
//   document.create         — devis inserted via the editor
//   document.duplicate      — copied as new brouillon
//   document.mark_sent      — brouillon → envoye (Mano path)
//   document.mark_paid      — invoice → paye
//   document.send_email     — Brevo transactional dispatched
//   dossier.planify         — a_planifier → planifie
//   dossier.edit            — schedule/technician/notes/flags edited
//   dossier.finalize        — planifie → finalise
//   dossier.sold            — → solde + payment_status=solde
//   dossier.acompte_paid    — invoice paid via Planification button
//   dossier.finale.create   — FAC- generated from a finalised dossier
export type AuditAction = string;
export type AuditEntityType = "lead" | "document" | "dossier" | "client" | "user";

export type AuditPayload = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  // Optional snapshots — useful for diffs in the audit UI later.
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export async function auditLog(payload: AuditPayload): Promise<void> {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    // Cast at the SDK boundary: callers pass JSON-serializable maps, but
    // Record<string, unknown> doesn't satisfy postgrest's strict Json type.
    // The contract is "you pass json-safe values" — we don't validate.
    const row: AuditLogInsert = {
      user_id: user?.id ?? null,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      before: (payload.before ?? null) as Json | null,
      after: (payload.after ?? null) as Json | null,
    };
    await supabase.from("audit_logs").insert(row as never);
  } catch (err) {
    // Never let an audit failure break the calling action. Log it server-side
    // so it's visible in Vercel logs / Sentry once that's wired.
    console.error("auditLog failed:", err);
  }
}
