import "server-only";
import { supabaseServer } from "./supabase/server";
import { buildTimeline, type AuditTimelineEvent } from "./leads-shared";
import { supabaseServiceRole } from "./supabase/service";
import type {
  Commercial,
  CrmDocument,
  DocumentStatus,
  DocumentType,
  Lead,
  LeadStatus,
  Sector,
  Source,
  SubEnvoi,
  SubSignature,
  SubSignatureMode,
  TimelineEvent,
} from "./leads";
import type { Json } from "./supabase/database.types";

// Server-side data layer for the lead detail page. Returns the same UI-shaped
// LeadDetail that lib/leads-mock.ts:getLeadDetail returns, so the page can
// swap data sources by changing one import.

export type LeadDetail = {
  lead: Lead;
  owner: Commercial | undefined;
  documents: CrmDocument[];
  timeline: TimelineEvent[];
  // Le lecteur détient-il la permission confidentielle immob_travaux (CDC §3.5) ?
  canImmobTravaux: boolean;
};

// Le champ immob_travaux (annotation Immobilier/Travaux) est confidentiel : il
// n'est visible que par un admin ou un utilisateur détenant la permission
// granulaire `immob_travaux`. Résolu côté serveur via les RPC security-definer
// (évaluées pour auth.uid()). NE JAMAIS se fier à un flag hardcodé côté page.
export async function currentUserHasImmobTravaux(): Promise<boolean> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  // Lecture via service-role, strictement scopée à l'id de l'utilisateur courant
  // (pas d'IDOR) : la RLS de user_permissions ne garantit pas la self-lecture.
  const admin = await supabaseServiceRole();
  const [permRes, rolesRes] = await Promise.all([
    admin
      .from("user_permissions")
      .select("permission_key")
      .eq("user_id", user.id)
      .eq("permission_key", "immob_travaux")
      .maybeSingle(),
    admin
      .from("user_roles")
      .select("roles(slug)")
      .eq("user_id", user.id)
      .returns<{ roles: { slug: string } | null }[]>(),
  ]);
  if (permRes.data) return true;
  return (rolesRes.data ?? []).some((r) => r.roles?.slug === "admin");
}

// DB source slugs use snake_case (google_ads); UI uses kebab-case (google-ads).
// The two diverged before the seed was finalised — bridge here until we
// unify on one form.
const SOURCE_DB_TO_UI: Record<string, Source> = {
  google_ads: "google-ads",
  meta_ads: "meta-ads",
  site_web: "site-web",
  telephone: "telephone",
  recommandation: "recommandation",
};

type AddressJson = { line1?: string; postal_code?: string; city?: string };

function parseAddress(raw: Json | null): { address: string; postalCode: string; city: string } {
  const a = (raw as AddressJson | null) ?? {};
  return { address: a.line1 ?? "", postalCode: a.postal_code ?? "", city: a.city ?? "" };
}

type OwnerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  color: string | null;
};

function mapOwner(o: OwnerRow): Commercial {
  const name = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || "Sans nom";
  const initials =
    ((o.first_name?.[0] ?? "") + (o.last_name?.[0] ?? "")).toUpperCase() || "??";
  return { id: o.id, name, initials, color: o.color ?? "#5b4bcc" };
}

// PostgREST returns embedded joins as objects (one-to-one) or arrays (one-to-many);
// for our nested-belongs-to relations here it's always object-or-null.
// Exported so lib/documents-server.ts can reuse the same join shape.
export type LeadRowJoined = {
  id: string;
  short_id: string;
  is_company: boolean;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: Json | null;
  estimated_amount: number | null;
  owner_id: string | null;
  status: LeadStatus;
  sub_envoi: SubEnvoi | null;
  sub_signature: SubSignature | null;
  sub_signature_mode: SubSignatureMode | null;
  received_at: string;
  last_action_label: string | null;
  last_action_at: string | null;
  next_followup_at: string | null;
  is_urgent: boolean;
  surface_m2?: number | null;
  is_nrp: boolean;
  nrp_at: string | null;
  lost_reason: string | null;
  immob_travaux_annotation: string | null;
  intervention_delay: string | null;
  intervention_delay_notes: string | null;
  notes: string | null;
  type_service?: string | null;
  country?: string | null;
  entity_id?: string | null;
  entity?: { legal_name: string } | null;
  landing_page?: { name: string } | null;
  // Découverte columns — optional so selects that don't fetch them still map.
  announced_price?: number | null;
  discovery_outcome?: string | null;
  discovery_done_at?: string | null;
  photos_requested_at?: string | null;
  delai_souhaite?: string | null;
  price_range?: string | null;
  reaction_prix?: string | null;
  statut_client?: string | null;
  etat_salete?: string | null;
  contexte_intervention?: string | null;
  acompte_negocie?: number | null;
  discovery_details?: Record<string, unknown> | null;
  is_extreme?: boolean | null;
  activity: { slug: string } | null;
  source: { slug: string } | null;
  owner: OwnerRow | null;
};

export function mapLead(row: LeadRowJoined, canImmob = false): Lead {
  const { address, postalCode, city } = parseAddress(row.client_address);
  const displayName = row.is_company
    ? row.client_company ?? "—"
    : `${row.client_first_name ?? ""} ${row.client_last_name ?? ""}`.trim();
  return {
    id: row.id,
    shortId: row.short_id,
    client: displayName || "Sans nom",
    isCompany: row.is_company,
    firstName: row.client_first_name ?? undefined,
    lastName: row.client_last_name ?? undefined,
    company: row.client_company ?? undefined,
    email: row.client_email ?? "",
    phone: row.client_phone ?? "",
    address,
    postalCode,
    city,
    sector: (row.activity?.slug ?? "nettoyage") as Sector,
    typeService: row.type_service ?? undefined,
    country: (row.country ?? undefined) as Lead["country"],
    entityId: row.entity_id ?? undefined,
    entityName: row.entity?.legal_name ?? undefined,
    landingPage: row.landing_page?.name ?? undefined,
    source: SOURCE_DB_TO_UI[row.source?.slug ?? ""] ?? "google-ads",
    amount: row.estimated_amount ?? 0,
    ownerId: row.owner_id ?? "",
    status: row.status,
    subEnvoi: row.sub_envoi,
    subSignature: row.sub_signature,
    subSignatureMode: row.sub_signature_mode,
    receivedAt: row.received_at,
    lastActionLabel: row.last_action_label ?? "",
    lastActionAt: row.last_action_at ?? row.received_at,
    nextFollowupAt: row.next_followup_at ?? undefined,
    isUrgent: row.is_urgent || undefined,
    surfaceM2: row.surface_m2 ?? undefined,
    isNrp: row.is_nrp,
    nrpAt: row.nrp_at ?? undefined,
    lostReason: row.lost_reason ?? undefined,
    // Confidentiel (CDC §3.5) : omis du payload si le lecteur n'a pas la permission.
    immobTravauxAnnotation: canImmob ? (row.immob_travaux_annotation ?? undefined) : undefined,
    interventionDelay: (row.intervention_delay ?? undefined) as Lead["interventionDelay"],
    interventionDelayNotes: row.intervention_delay_notes ?? undefined,
    notes: row.notes ?? undefined,
    announcedPrice: row.announced_price ?? undefined,
    discoveryOutcome: (row.discovery_outcome ?? undefined) as Lead["discoveryOutcome"],
    discoveryDoneAt: row.discovery_done_at ?? undefined,
    photosRequestedAt: row.photos_requested_at ?? undefined,
    delaiSouhaite: (row.delai_souhaite ?? undefined) as Lead["delaiSouhaite"],
    priceRange: row.price_range ?? undefined,
    reactionPrix: (row.reaction_prix ?? undefined) as Lead["reactionPrix"],
    statutClient: (row.statut_client ?? undefined) as Lead["statutClient"],
    etatSalete: (row.etat_salete ?? undefined) as Lead["etatSalete"],
    contexteIntervention: row.contexte_intervention ?? undefined,
    acompteNegocie: row.acompte_negocie ?? undefined,
    discoveryDetails: row.discovery_details ?? undefined,
    isExtreme: row.is_extreme ?? false,
  };
}

type DocumentRow = {
  id: string;
  num: string;
  type: DocumentType;
  status: DocumentStatus;
  lead_id: string | null;
  total_ttc: number;
  issued_at: string;
  signed_at: string | null;
  paid_at: string | null;
  acompte_pct: number | null;
  acompte_amount: number | null;
  refusal_reason: string | null;
  entity: { legal_name: string } | null;
};

function mapDocument(row: DocumentRow): CrmDocument {
  return {
    id: row.id,
    num: row.num,
    type: row.type,
    status: row.status,
    leadId: row.lead_id ?? "",
    totalTtc: Number(row.total_ttc),
    issuedAt: row.issued_at,
    signedAt: row.signed_at ?? undefined,
    paidAt: row.paid_at ?? undefined,
    acomptePct: row.acompte_pct ?? undefined,
    acompteAmount: row.acompte_amount ?? undefined,
    refusalReason: row.refusal_reason ?? undefined,
    entityName: row.entity?.legal_name ?? undefined,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// All leads, ordered by most recent activity. Used by the /leads list page.
// Client-side filter/sort/search still happens in LeadsTable — for 16 leads
// that's free. Once volumes grow past ~1k rows we'll want server-side
// pagination + filter pushdown.
export async function getAllLeads(): Promise<Lead[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
        id, short_id, is_company,
        client_first_name, client_last_name, client_company,
        client_email, client_phone, client_address,
        estimated_amount, owner_id, status, sub_envoi, sub_signature, sub_signature_mode,
        received_at, last_action_label, last_action_at, next_followup_at,
        is_urgent, surface_m2, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
        intervention_delay, intervention_delay_notes, notes, type_service, country,
        entity_id, entity:legal_entities(legal_name), landing_page:landing_pages(name),
        announced_price, discovery_outcome, discovery_done_at,
        photos_requested_at, delai_souhaite, price_range, reaction_prix,
        statut_client, etat_salete, contexte_intervention, acompte_negocie, discovery_details, is_extreme,
        activity:activities(slug),
        source:lead_sources(slug),
        owner:users!leads_owner_id_fkey(id, first_name, last_name, color)
      `,
    )
    .order("last_action_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  const leads = (data as unknown as LeadRowJoined[]).map((r) => mapLead(r));

  // Batch-fetch minimal docs per lead so the Kanban can bucket cards into
  // "Acompte encaissé" / "Encaissement final" without an N+1 round-trip.
  // Cheap: same RLS as the leads query, single IN-list.
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, type, status, lead_id")
      .in("lead_id", leadIds)
      .returns<{ id: string; type: "devis" | "acompte" | "finale"; status: string; lead_id: string }[]>();
    const byLead = new Map<string, { id: string; type: "devis" | "acompte" | "finale"; status: string }[]>();
    for (const d of docs ?? []) {
      const arr = byLead.get(d.lead_id) ?? [];
      arr.push({ id: d.id, type: d.type, status: d.status });
      byLead.set(d.lead_id, arr);
    }
    for (const lead of leads) lead.documents = byLead.get(lead.id) ?? [];
  }

  return leads;
}

// All commerciaux for the filter dropdown + owner avatars. Until Supabase
// Auth is wired and users have rows, this returns an empty list and the
// dropdown collapses to just "Tous les commerciaux" — which is what we want.
export async function getAllCommerciaux(): Promise<Commercial[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, color")
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error || !data) return [];
  return (data as OwnerRow[]).map(mapOwner);
}

export async function getLeadDetail(idOrShortId: string): Promise<LeadDetail | null> {
  const supabase = await supabaseServer();

  // Friendly URLs: accept both UUIDs and short_ids like "L-1035".
  const filter = UUID.test(idOrShortId)
    ? { id: idOrShortId }
    : { short_id: idOrShortId };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select(
      `
        id, short_id, is_company,
        client_first_name, client_last_name, client_company,
        client_email, client_phone, client_address,
        estimated_amount, owner_id, status, sub_envoi, sub_signature, sub_signature_mode,
        received_at, last_action_label, last_action_at, next_followup_at,
        is_urgent, surface_m2, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
        intervention_delay, intervention_delay_notes, notes, type_service, country,
        entity_id, entity:legal_entities(legal_name), landing_page:landing_pages(name),
        announced_price, discovery_outcome, discovery_done_at,
        photos_requested_at, delai_souhaite, price_range, reaction_prix,
        statut_client, etat_salete, contexte_intervention, acompte_negocie, discovery_details, is_extreme,
        activity:activities(slug),
        source:lead_sources(slug),
        owner:users!leads_owner_id_fkey(id, first_name, last_name, color)
      `,
    )
    .match(filter)
    .maybeSingle<LeadRowJoined>();

  if (leadErr || !lead) return null;

  const { data: docs } = await supabase
    .from("documents")
    .select(
      "id, num, type, status, lead_id, total_ttc, issued_at, signed_at, paid_at, " +
      "acompte_pct, acompte_amount, refusal_reason, entity:legal_entities(legal_name)",
    )
    .eq("lead_id", lead.id)
    .order("issued_at", { ascending: false });

  const canImmob = await currentUserHasImmobTravaux();
  const uiLead = mapLead(lead, canImmob);
  const uiDocs = (docs ?? []).map((d) => mapDocument(d as DocumentRow));
  const owner = lead.owner ? mapOwner(lead.owner) : undefined;

  // Audit events for this lead — read via service-role because audit_logs
  // RLS is "admin only" by design (CDC §8.2). The caller is already proven
  // to have access to the lead above (RLS-scoped fetch returned a row), so
  // the bypass is contained and safe — we filter to events about this
  // specific lead only.
  const auditEvents = await fetchLeadAuditEvents(lead.id);
  const timeline = buildTimeline(uiLead, uiDocs, auditEvents);

  return { lead: uiLead, owner, documents: uiDocs, timeline, canImmobTravaux: canImmob };
}

// Contact phone of a legal entity — used to fill {societe.telephone} in the
// relance templates (callback number). Empty string when unknown.
export async function getLegalEntityPhone(entityId: string): Promise<string> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("legal_entities")
    .select("contact_phone")
    .eq("id", entityId)
    .maybeSingle<{ contact_phone: string | null }>();
  return data?.contact_phone ?? "";
}

// ── Audit-event → timeline mapper ────────────────────────────────────
// Stays in the server file (uses service-role) but produces the pure
// AuditTimelineEvent shape that buildTimeline (in leads-shared.ts) merges.

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  after: Json | null;
};

async function fetchLeadAuditEvents(leadId: string): Promise<AuditTimelineEvent[]> {
  const supabase = await supabaseServiceRole();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, created_at, after")
    .eq("entity_type", "lead")
    .eq("entity_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<AuditRow[]>();
  if (error || !data) return [];

  const out: AuditTimelineEvent[] = [];
  for (const row of data) {
    const event = mapAuditRowToTimeline(row);
    if (event) out.push(event);
  }
  return out;
}

function mapAuditRowToTimeline(row: AuditRow): AuditTimelineEvent | null {
  const after = (row.after ?? {}) as Record<string, unknown>;

  // Phone calls — outbound initiate + webhook event states.
  if (row.action === "lead.call.outbound") {
    const fake = after.fake === true;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "call",
      label: fake ? "Appel sortant (Ringover fake)" : "Appel sortant lancé",
      sublabel: typeof after.toNumber === "string" ? `vers ${after.toNumber}` : undefined,
    };
  }
  if (row.action.startsWith("lead.call.outbound.")) {
    const phase = row.action.replace("lead.call.outbound.", "");
    const labelByPhase: Record<string, string> = {
      ringing: "Appel sortant — sonnerie",
      answered: "Appel sortant — répondu",
      ended: "Appel sortant — terminé",
      missed: "Appel sortant — manqué",
    };
    const dur = typeof after.durationSeconds === "number" ? `${after.durationSeconds}s` : undefined;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "call",
      label: labelByPhase[phase] ?? `Appel — ${phase}`,
      sublabel: dur,
    };
  }
  if (row.action.startsWith("lead.call.inbound.")) {
    const phase = row.action.replace("lead.call.inbound.", "");
    const labelByPhase: Record<string, string> = {
      ringing: "Appel entrant — sonnerie",
      answered: "Appel entrant — répondu",
      ended: "Appel entrant — terminé",
      missed: "Appel entrant — manqué",
    };
    const from = typeof after.from === "string" ? after.from : undefined;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "call",
      label: labelByPhase[phase] ?? `Appel entrant — ${phase}`,
      sublabel: from ? `de ${from}` : undefined,
    };
  }

  // Outbound relance email sent from the lead page (Brevo).
  if (row.action === "lead.relance.email") {
    const recipient = typeof after.recipient === "string" ? after.recipient : undefined;
    const subject = typeof after.subject === "string" ? after.subject : undefined;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "email",
      label: "Email de relance envoyé",
      sublabel: [subject, recipient].filter(Boolean).join(" · ") || undefined,
    };
  }

  // Outbound SMS sent from the lead page (Ringover webphone).
  if (row.action === "lead.sms.sent") {
    const recipient = typeof after.recipient === "string" ? after.recipient : undefined;
    const preview = typeof after.preview === "string" ? after.preview : undefined;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "sms",
      label: recipient ? `SMS envoyé — ${recipient}` : "SMS envoyé",
      sublabel: preview,
    };
  }

  // Email reply from a client (matched via doc number in subject).
  if (row.action === "lead.email.reply") {
    const from = typeof after.from === "string" ? after.from : "(inconnu)";
    const subject = typeof after.subject === "string" ? after.subject : undefined;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "email-reply",
      label: `Réponse email reçue — ${from}`,
      sublabel: subject,
    };
  }

  // Metadata changes worth surfacing.
  if (row.action === "lead.contact.update") {
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "note",
      label: "Coordonnées modifiées",
    };
  }
  if (row.action === "lead.nrp.set") {
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "note",
      label: after.nrp === true ? "Marqué NRP (ne répond pas)" : "NRP retiré",
    };
  }
  if (row.action === "lead.reassign") {
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "note",
      label: "Lead réassigné",
    };
  }
  if (row.action === "lead.sequence.launch") {
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "email",
      label: "Séquence n8n lancée",
    };
  }

  // Status changes — only surface for actions not already covered by the
  // doc-issued / doc-signed / lost branches in buildTimeline.
  if (row.action === "lead.status.change") {
    const status = typeof after.status === "string" ? after.status : "(inconnu)";
    // The "perdu" status is already rendered from lead.status === "perdu";
    // doc-related statuses are already shown via the doc events. Skip dupes.
    if (status === "perdu" || status === "signe" || status === "envoye") return null;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      kind: "status",
      label: `Statut → ${status}`,
    };
  }

  // Anything else — drop silently (auth events, etc. don't belong on a lead timeline).
  return null;
}
