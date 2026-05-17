import "server-only";
import { supabaseServer } from "./supabase/server";
import { computeClientStats } from "./clients-shared";
import type {
  Client,
  ClientOrigin,
  ClientType,
  CrmDocument,
  DocumentStatus,
  DocumentType,
  Sector,
} from "./leads";
import type { ClientStats } from "./clients-shared";
import type { Json } from "./supabase/database.types";

// Server-side data layer for /clients (list) and /clients/[id] (detail).
// Returns UI-shaped Client + ClientStats so pages can swap data sources.

type AddressJson = { line1?: string; postal_code?: string; city?: string };

type ClientRow = {
  id: string;
  type: ClientType;
  source: ClientOrigin;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: Json | null;
  siret: string | null;
  vat_intra: string | null;
  source_lead_id: string | null;
  sectors: string[] | null;
  note: string | null;
  created_at: string;
};

type DocRow = {
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
};

function mapClient(row: ClientRow, sectorById: Map<string, Sector>): Client {
  const a = (row.address as AddressJson | null) ?? {};
  return {
    id: row.id,
    type: row.type,
    origin: row.source,
    sourceLeadId: row.source_lead_id ?? undefined,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: a.line1 ?? "",
    postalCode: a.postal_code ?? "",
    city: a.city ?? "",
    siret: row.siret ?? undefined,
    vatIntra: row.vat_intra ?? undefined,
    sectors: (row.sectors ?? [])
      .map((id) => sectorById.get(id))
      .filter((s): s is Sector => s !== undefined),
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function mapDoc(row: DocRow): CrmDocument {
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
  };
}

const CLIENT_SELECT =
  "id, type, source, name, contact_name, email, phone, address, " +
  "siret, vat_intra, source_lead_id, sectors, note, created_at";

const DOC_SELECT =
  "id, num, type, status, lead_id, total_ttc, issued_at, " +
  "signed_at, paid_at, acompte_pct, acompte_amount";

// Sectors are stored as activity UUIDs; the UI uses slugs. One query
// resolves the (4-row) lookup table once per request.
async function loadSectorMap(): Promise<Map<string, Sector>> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("id, slug")
    .returns<{ id: string; slug: string }[]>();
  const map = new Map<string, Sector>();
  for (const row of data ?? []) {
    map.set(row.id, row.slug as Sector);
  }
  return map;
}

// List-page row shape — matches the internal type the ClientsList component
// previously built client-side from getAllClients() + getClientStats().
export type ClientListRow = {
  client: Client;
  caEncaisse: number;
  lastActivityAt: string;
};

export async function getAllClientsForList(): Promise<ClientListRow[]> {
  const supabase = await supabaseServer();

  const [clientsRes, sectorMap] = await Promise.all([
    supabase.from("clients").select(CLIENT_SELECT).order("created_at", { ascending: false }),
    loadSectorMap(),
  ]);

  const clientRows = (clientsRes.data as ClientRow[] | null) ?? [];
  const clients = clientRows.map((c) => mapClient(c, sectorMap));

  // Pre-fetch all documents for clients that have a source lead, batched.
  const sourceLeadIds = Array.from(
    new Set(clients.map((c) => c.sourceLeadId).filter((x): x is string => Boolean(x))),
  );
  const docsByLead = new Map<string, CrmDocument[]>();
  if (sourceLeadIds.length > 0) {
    const { data: docsData } = await supabase
      .from("documents")
      .select(DOC_SELECT)
      .in("lead_id", sourceLeadIds);
    for (const row of (docsData as DocRow[] | null) ?? []) {
      const doc = mapDoc(row);
      const arr = docsByLead.get(doc.leadId) ?? [];
      arr.push(doc);
      docsByLead.set(doc.leadId, arr);
    }
  }

  return clients.map((client) => {
    const leadDocs = client.sourceLeadId ? (docsByLead.get(client.sourceLeadId) ?? []) : [];
    const stats = computeClientStats(client, leadDocs);
    return {
      client,
      caEncaisse: stats.caEncaisse,
      lastActivityAt: stats.lastActivityAt,
    };
  });
}

// Detail-page helpers — keep the mock's two-call shape so the page barely changes.
export async function getClientById(id: string): Promise<Client | null> {
  const supabase = await supabaseServer();
  const [clientRes, sectorMap] = await Promise.all([
    supabase.from("clients").select(CLIENT_SELECT).eq("id", id).maybeSingle<ClientRow>(),
    loadSectorMap(),
  ]);
  if (clientRes.error || !clientRes.data) return null;
  return mapClient(clientRes.data, sectorMap);
}

export async function getClientStats(client: Client): Promise<ClientStats> {
  if (!client.sourceLeadId) {
    return computeClientStats(client, []);
  }
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("documents")
    .select(DOC_SELECT)
    .eq("lead_id", client.sourceLeadId);
  const docs = ((data as DocRow[] | null) ?? []).map(mapDoc);
  return computeClientStats(client, docs);
}
