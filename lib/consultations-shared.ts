// Pure helpers/types for the "demandes de chiffrage" domain — NO I/O, no server-only.
// Safe to import from client components. Supabase reads live in consultations-server.ts.

export type ConsultationStatus = "envoyee" | "repondue" | "retenue" | "refusee" | "expiree";

export const CONSULT_STATUS_LABEL: Record<ConsultationStatus, string> = {
  envoyee: "En attente",
  repondue: "Réponse reçue",
  retenue: "Mission attribuée",
  refusee: "Refusée",
  expiree: "Expirée",
};

export type ConsultationOverview = {
  id: string;
  leadId: string;
  leadShortId: string;
  clientName: string;
  sectorLabel: string;
  delaiLabel: string | null;
  intervenantEmail: string;
  intervenantName: string | null;
  status: ConsultationStatus;
  montantPropose: number | null;
  disponibilites: string | null;
  notes: string | null;
  sentAt: string;
  respondedAt: string | null;
  attributedAt: string | null;
  mediaCount: number;
  relances: number;
  siblingCount: number; // nb d'intervenants consultés pour ce dossier
};
