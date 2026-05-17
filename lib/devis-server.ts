import "server-only";
import { supabaseServer } from "./supabase/server";
import type { PrestationUnit, Sector } from "./leads";

// Bootstrap data for the devis editor. Three lookups (clients, entities,
// prestations) plus optional pre-fill context (lead, client) — all parallel,
// all gated by RLS so a commercial only sees their own leads & related rows.

// Lightweight Client shape — just what the picker dropdown needs.
export type ClientOption = {
  id: string;
  name: string;
  type: "particulier" | "pro";
  sectors: Sector[];
  sourceLeadId?: string;
};

export type EntityOption = {
  id: string;
  legalName: string;
  defaultVatRate: number;
};

// Prestation joined with its activity slug so the editor can group the
// picker by sector without a second round-trip.
export type PrestationOption = {
  id: string;
  sector: Sector;
  label: string;
  unit: PrestationUnit;
  unitPriceHt: number;
  vatRate: number;
};

// Minimal lead context for prefill — enough to seed sector defaults and
// link the document to the originating lead.
export type LeadContext = {
  id: string;
  shortId: string;
  sector: Sector;
  clientName: string;
};

type ClientPickerRow = {
  id: string;
  name: string;
  type: "particulier" | "pro";
  source_lead_id: string | null;
  sectors: string[] | null;
};

type EntityPickerRow = {
  id: string;
  legal_name: string;
  default_vat_rate: number;
};

type PrestationRow = {
  id: string;
  label: string;
  unit: PrestationUnit;
  unit_price_ht: number;
  vat_rate: number;
  activity: { slug: Sector } | null;
};

type LeadContextRow = {
  id: string;
  short_id: string;
  is_company: boolean;
  client_first_name: string;
  client_last_name: string;
  client_company: string | null;
  activity: { slug: Sector } | null;
};

async function loadSectorMap(): Promise<Map<string, Sector>> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("id, slug")
    .returns<{ id: string; slug: Sector }[]>();
  return new Map((data ?? []).map((r) => [r.id, r.slug]));
}

export async function getClientsForPicker(): Promise<ClientOption[]> {
  const supabase = await supabaseServer();
  const [clientsRes, sectorMap] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, type, source_lead_id, sectors")
      .order("name", { ascending: true })
      .returns<ClientPickerRow[]>(),
    loadSectorMap(),
  ]);
  if (clientsRes.error || !clientsRes.data) return [];
  return clientsRes.data.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    sourceLeadId: c.source_lead_id ?? undefined,
    sectors: (c.sectors ?? [])
      .map((id) => sectorMap.get(id))
      .filter((s): s is Sector => s !== undefined),
  }));
}

export async function getEntitiesForPicker(): Promise<EntityOption[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("legal_entities")
    .select("id, legal_name, default_vat_rate")
    .order("legal_name", { ascending: true })
    .returns<EntityPickerRow[]>();
  if (error || !data) return [];
  return data.map((e) => ({
    id: e.id,
    legalName: e.legal_name,
    defaultVatRate: Number(e.default_vat_rate),
  }));
}

export async function getPrestationsForPicker(): Promise<PrestationOption[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("prestations")
    .select("id, label, unit, unit_price_ht, vat_rate, activity:activities(slug)")
    .eq("is_active", true)
    .order("label", { ascending: true })
    .returns<PrestationRow[]>();
  if (error || !data) return [];
  return data
    .filter((p): p is PrestationRow & { activity: { slug: Sector } } => p.activity !== null)
    .map((p) => ({
      id: p.id,
      sector: p.activity.slug,
      label: p.label,
      unit: p.unit,
      unitPriceHt: Number(p.unit_price_ht),
      vatRate: Number(p.vat_rate),
    }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Accepts either a UUID or a friendly short_id like "L-1051".
export async function getLeadContext(idOrShortId: string): Promise<LeadContext | null> {
  const supabase = await supabaseServer();
  const filter = UUID.test(idOrShortId)
    ? { id: idOrShortId }
    : { short_id: idOrShortId };
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, short_id, is_company, client_first_name, client_last_name, client_company, activity:activities(slug)",
    )
    .match(filter)
    .maybeSingle<LeadContextRow>();
  if (error || !data || !data.activity) return null;
  const clientName = data.is_company
    ? (data.client_company ?? `${data.client_first_name} ${data.client_last_name}`)
    : `${data.client_first_name} ${data.client_last_name}`;
  return {
    id: data.id,
    shortId: data.short_id,
    sector: data.activity.slug,
    clientName,
  };
}
