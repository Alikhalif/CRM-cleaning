import "server-only";
import { supabaseServer } from "./supabase/server";
import type { DocumentType } from "./leads";
import type { Json } from "./supabase/database.types";

// Flat shape consumed by the ⌘K palette. Three queries (leads, clients,
// documents) run in parallel; RLS scopes the result to whatever the caller
// can already see in the rest of the app — a commercial only finds their
// own leads here.

export type PaletteEntity = {
  id: string; // unique across the whole index, prefixed by kind
  kind: "lead" | "client" | "document";
  label: string;
  sublabel: string;
  href: string;
};

type AddressJson = { line1?: string; postal_code?: string; city?: string };

type LeadIndexRow = {
  id: string;
  short_id: string;
  is_company: boolean;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_address: Json | null;
};

type ClientIndexRow = {
  id: string;
  name: string;
  email: string | null;
  address: Json | null;
};

type DocIndexRow = {
  id: string;
  num: string;
  type: DocumentType;
  lead: { client_first_name: string | null; client_last_name: string | null; client_company: string | null; is_company: boolean } | null;
};

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  devis: "Devis",
  acompte: "Facture d'acompte",
  finale: "Facture finale",
};

const DOC_TYPE_TO_PATH: Record<DocumentType, "devis" | "factures"> = {
  devis: "devis",
  acompte: "factures",
  finale: "factures",
};

function leadDisplayName(row: LeadIndexRow): string {
  if (row.is_company) return row.client_company ?? "—";
  return `${row.client_first_name ?? ""} ${row.client_last_name ?? ""}`.trim() || "Sans nom";
}

function leadDocDisplayName(
  lead: NonNullable<DocIndexRow["lead"]>,
): string {
  if (lead.is_company) return lead.client_company ?? "—";
  return `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim() || "Sans nom";
}

export async function getPaletteIndex(): Promise<PaletteEntity[]> {
  const supabase = await supabaseServer();

  const [leadsRes, clientsRes, docsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, short_id, is_company, client_first_name, client_last_name, " +
        "client_company, client_email, client_address",
      )
      .order("received_at", { ascending: false })
      .limit(500)
      .returns<LeadIndexRow[]>(),
    supabase
      .from("clients")
      .select("id, name, email, address")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<ClientIndexRow[]>(),
    supabase
      .from("documents")
      .select(
        "id, num, type, " +
        "lead:leads(client_first_name, client_last_name, client_company, is_company)",
      )
      .is("deleted_at", null)
      .order("issued_at", { ascending: false })
      .limit(500)
      .returns<DocIndexRow[]>(),
  ]);

  const entities: PaletteEntity[] = [];

  for (const row of leadsRes.data ?? []) {
    const addr = (row.client_address as AddressJson | null) ?? {};
    const city = addr.city ?? "";
    const subParts = [row.short_id, city, row.client_email ?? ""].filter(Boolean);
    entities.push({
      id: `lead-${row.id}`,
      kind: "lead",
      label: leadDisplayName(row),
      sublabel: subParts.join(" · "),
      href: `/leads/${row.id}`,
    });
  }

  for (const row of clientsRes.data ?? []) {
    const addr = (row.address as AddressJson | null) ?? {};
    const subParts = [addr.city ?? "", row.email ?? ""].filter(Boolean);
    entities.push({
      id: `client-${row.id}`,
      kind: "client",
      label: row.name,
      sublabel: subParts.join(" · "),
      href: `/clients/${row.id}`,
    });
  }

  for (const row of docsRes.data ?? []) {
    const clientName = row.lead ? leadDocDisplayName(row.lead) : null;
    const sublabel = clientName
      ? `${DOC_TYPE_LABEL[row.type]} · ${clientName}`
      : DOC_TYPE_LABEL[row.type];
    entities.push({
      id: `doc-${row.id}`,
      kind: "document",
      label: row.num,
      sublabel,
      href: `/${DOC_TYPE_TO_PATH[row.type]}/${row.id}`,
    });
  }

  return entities;
}
