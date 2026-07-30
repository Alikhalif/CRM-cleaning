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
  // Récap affiché sur l'écran de génération du devis (coordonnées + découverte).
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  typeService: string | null;
  surfaceM2: number | null;
  announcedPrice: number | null;
  priceRange: string | null;
  delaiSouhaite: string | null;
  reactionPrix: string | null;
  statutClient: string | null;
  etatSalete: string | null;
  acompteNegocie: number | null;
  contexteIntervention: string | null;
  notes: string | null;
  discoveryDoneAt: string | null;
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
  client_phone: string | null;
  client_email: string | null;
  client_address: { city?: string; line1?: string } | null;
  type_service: string | null;
  surface_m2: number | null;
  announced_price: number | null;
  price_range: string | null;
  delai_souhaite: string | null;
  reaction_prix: string | null;
  statut_client: string | null;
  etat_salete: string | null;
  acompte_negocie: number | null;
  contexte_intervention: string | null;
  notes: string | null;
  discovery_done_at: string | null;
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

// ── Re-quote prefill ────────────────────────────────────────────────
// Powers "Renvoyer un devis moins cher" (call 2026-06-10): a refused devis
// can seed a brand-new one — same client + same lines — so the commercial
// just switches the issuing société and lowers the prices. Reuses the normal
// QuoteEditor + createDevis path; nothing is mutated on the source document.

export type DevisPrefillLine = {
  prestationId?: string;
  label: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  discountPct: number;
};

export type DevisPrefill = {
  sourceId: string;
  sourceNum: string;
  sourceTotalTtc: number; // the refused price — shown so the user undercuts it
  sourceRefusalReason?: string;
  clientId: string | null;
  entityId: string | null; // source société — the editor lets the user switch it
  notes: string;
  acomptePct: number;
  lines: DevisPrefillLine[];
};

type PrefillDocRow = {
  id: string;
  num: string;
  type: string;
  total_ttc: number | string;
  client_id: string | null;
  entity_id: string | null;
  notes: string | null;
  acompte_pct: number | null;
  refusal_reason: string | null;
};

type PrefillLineRow = {
  prestation_id: string | null;
  label: string;
  quantity: number | string;
  unit: string;
  unit_price_ht: number | string;
  vat_rate: number | string;
  discount_pct: number | string;
};

export async function getDevisPrefill(devisId: string): Promise<DevisPrefill | null> {
  const supabase = await supabaseServer();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, num, type, total_ttc, client_id, entity_id, notes, acompte_pct, refusal_reason")
    .eq("id", devisId)
    .maybeSingle<PrefillDocRow>();
  if (!doc || doc.type !== "devis") return null;

  const { data: lines } = await supabase
    .from("document_lines")
    .select("prestation_id, label, quantity, unit, unit_price_ht, vat_rate, discount_pct")
    .eq("document_id", devisId)
    .order("order_index", { ascending: true })
    .returns<PrefillLineRow[]>();

  return {
    sourceId: doc.id,
    sourceNum: doc.num,
    sourceTotalTtc: Number(doc.total_ttc),
    sourceRefusalReason: doc.refusal_reason ?? undefined,
    clientId: doc.client_id ?? null,
    entityId: doc.entity_id ?? null,
    notes: doc.notes ?? "",
    acomptePct: Number(doc.acompte_pct ?? 0),
    lines: (lines ?? []).map((l) => ({
      prestationId: l.prestation_id ?? undefined,
      label: l.label,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPriceHt: Number(l.unit_price_ht),
      vatRate: Number(l.vat_rate),
      discountPct: Number(l.discount_pct),
    })),
  };
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
      "id, short_id, is_company, client_first_name, client_last_name, client_company, " +
      "client_phone, client_email, client_address, type_service, surface_m2, announced_price, " +
      "price_range, delai_souhaite, reaction_prix, statut_client, etat_salete, acompte_negocie, " +
      "contexte_intervention, notes, discovery_done_at, activity:activities(slug)",
    )
    .match(filter)
    .maybeSingle<LeadContextRow>();
  if (error || !data || !data.activity) return null;
  const clientName = data.is_company
    ? (data.client_company ?? `${data.client_first_name} ${data.client_last_name}`)
    : `${data.client_first_name} ${data.client_last_name}`;
  const addr = data.client_address ?? {};
  return {
    id: data.id,
    shortId: data.short_id,
    sector: data.activity.slug,
    clientName,
    phone: data.client_phone,
    email: data.client_email,
    city: addr.city ?? null,
    address: addr.line1 ?? null,
    typeService: data.type_service,
    surfaceM2: data.surface_m2,
    announcedPrice: data.announced_price,
    priceRange: data.price_range,
    delaiSouhaite: data.delai_souhaite,
    reactionPrix: data.reaction_prix,
    statutClient: data.statut_client,
    etatSalete: data.etat_salete,
    acompteNegocie: data.acompte_negocie,
    contexteIntervention: data.contexte_intervention,
    notes: data.notes,
    discoveryDoneAt: data.discovery_done_at,
  };
}
