import "server-only";
import { supabaseServer } from "./supabase/server";
import {
  SECTOR_LABEL,
  DELAI_SOUHAITE_LABEL,
  type Sector,
  type DelaiSouhaite,
} from "./leads";
import {
  CONSULT_STATUS_LABEL,
  type ConsultationStatus,
  type ConsultationOverview,
} from "./consultations-shared";

// Vue agrégée des demandes de chiffrage (toutes consultations intervenants,
// jointes au dossier + intervenant). RLS : réservé admin / planificatrice.
// Les types + labels partagés vivent dans consultations-shared.ts (client-safe).

export { CONSULT_STATUS_LABEL };
export type { ConsultationStatus, ConsultationOverview };

type Row = {
  id: string;
  lead_id: string;
  intervenant_email: string;
  status: string;
  montant_propose: number | null;
  disponibilites: string | null;
  notes: string | null;
  sent_at: string;
  responded_at: string | null;
  attributed_at: string | null;
  media_count: number;
  relances: number;
  lead: {
    short_id: string | null;
    client_first_name: string | null;
    client_last_name: string | null;
    client_company: string | null;
    is_company: boolean;
    delai_souhaite: string | null;
    activity: { slug: string } | null;
  } | null;
  intervenant: { name: string } | null;
};

export async function getConsultations(): Promise<ConsultationOverview[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("intervenant_consultations")
    .select(
      `id, lead_id, intervenant_email, status, montant_propose, disponibilites, notes,
       sent_at, responded_at, attributed_at, media_count, relances,
       lead:leads(short_id, client_first_name, client_last_name, client_company, is_company, delai_souhaite, activity:activities(slug)),
       intervenant:technicians(name)`,
    )
    .order("sent_at", { ascending: false })
    .returns<Row[]>();
  if (error || !data) return [];

  // Nombre d'intervenants consultés par dossier.
  const perLead = new Map<string, number>();
  for (const r of data) perLead.set(r.lead_id, (perLead.get(r.lead_id) ?? 0) + 1);

  return data.map((r) => {
    const l = r.lead;
    const clientName = l?.is_company
      ? (l.client_company ?? "(société)")
      : `${l?.client_first_name ?? ""} ${l?.client_last_name ?? ""}`.trim() || "(client)";
    const sectorSlug = l?.activity?.slug as Sector | undefined;
    const delai = l?.delai_souhaite as DelaiSouhaite | null;
    return {
      id: r.id,
      leadId: r.lead_id,
      leadShortId: l?.short_id ?? "—",
      clientName,
      sectorLabel: sectorSlug ? SECTOR_LABEL[sectorSlug] : "—",
      delaiLabel: delai ? DELAI_SOUHAITE_LABEL[delai] : null,
      intervenantEmail: r.intervenant_email,
      intervenantName: r.intervenant?.name ?? null,
      status: r.status as ConsultationStatus,
      montantPropose: r.montant_propose,
      disponibilites: r.disponibilites,
      notes: r.notes,
      sentAt: r.sent_at,
      respondedAt: r.responded_at,
      attributedAt: r.attributed_at,
      mediaCount: r.media_count,
      relances: r.relances,
      siblingCount: perLead.get(r.lead_id) ?? 1,
    };
  });
}
