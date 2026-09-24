import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import type { Database, Json } from "./supabase/database.types";

// Append-only audit trail (CDC §8.2). Every mutating server action writes a
// row here for compliance + forensics. RLS allows admin-only SELECT — non-admins
// can't read each other's audit trail.
//
// Recette 2026-09-24 · Correctif P1 : l'INSERT passe désormais par le
// SERVICE-ROLE. Auparavant il passait par la session (clé anon + cookie) et la
// policy `with check (user_id = auth.uid())` REFUSAIT tout écrit sans session —
// donc TOUS les événements automatiques (webhooks WF1, réponses Brevo, appels
// Ringover, signature e-sign publique, callbacks n8n) n'étaient PAS tracés, ce
// qui cassait aussi le moteur d'actions commerciales (qui lit audit_logs). On
// résout quand même l'utilisateur courant via la session (best-effort) pour
// renseigner user_id ; l'écriture, elle, ne dépend plus d'une session.
//
// Best-effort write: a failure here MUST NOT fail the user's action. We
// swallow errors and console.error, so a missing/down audit table doesn't
// silently break leads, devis, etc.

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
    // Résolution de l'auteur via la session — best-effort : en contexte
    // sessionless (webhook, page publique /sign, cron) il n'y a pas de cookie
    // d'auth → user_id reste null, ce qui est correct (événement système).
    let userId: string | null = null;
    try {
      const session = await supabaseServer();
      const { data: { user } } = await session.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // pas de contexte requête / pas de session → user_id null
    }
    // Cast at the SDK boundary: callers pass JSON-serializable maps, but
    // Record<string, unknown> doesn't satisfy postgrest's strict Json type.
    // The contract is "you pass json-safe values" — we don't validate.
    const row: AuditLogInsert = {
      user_id: userId,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      before: (payload.before ?? null) as Json | null,
      after: (payload.after ?? null) as Json | null,
    };
    // Écriture via service-role (jamais refusée par la RLS ; user_id contrôlé
    // par ce module, jamais par l'appelant).
    const admin = await supabaseServiceRole();
    await admin.from("audit_logs").insert(row as never);
  } catch (err) {
    // Never let an audit failure break the calling action. Log it server-side
    // so it's visible in Vercel logs / Sentry once that's wired.
    console.error("auditLog failed:", err);
  }
}
