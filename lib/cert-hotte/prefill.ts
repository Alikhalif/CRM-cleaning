import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { CertClient } from "./types";

// Données de préremplissage de l'écran « Certificat Hotte » à partir d'un
// dossier (?dossier=<uuid>). Lecture RLS-scopée (la planificatrice ne voit que
// ses dossiers) — le dossier EST l'intervention (pas de table interventions).
export type CertPrefill = {
  dossierId: string;
  leadId: string;
  sector: string;
  client: CertClient;
  dossierRef: string; // short_id du lead (ex. L-1087)
  factureNum: string | null;
  dateIntervention: string; // JJ/MM/AAAA
  technicien: string;
  technicians: string[];
};

type Addr = { line1?: string | null; postal_code?: string | null; city?: string | null };
type DossierRow = {
  id: string;
  planned_at: string | null;
  realized_at: string | null;
  lead: {
    id: string;
    short_id: string | null;
    is_company: boolean | null;
    client_first_name: string | null;
    client_last_name: string | null;
    client_company: string | null;
    client_email: string | null;
    client_phone: string | null;
    client_address: Addr | null;
    activity: { slug: string } | null;
  } | null;
  technician: { name: string | null } | null;
};

const isoToFr = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const todayFr = (): string => isoToFr(new Date().toISOString());

export async function getCertHottePageData(
  dossierId?: string | null,
): Promise<CertPrefill | null> {
  if (!dossierId) return null;
  const supabase = await supabaseServer();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select(
      `id, planned_at, realized_at,
       lead:leads(id, short_id, is_company, client_first_name, client_last_name,
         client_company, client_email, client_phone, client_address,
         activity:activities(slug)),
       technician:technicians(name)`,
    )
    .eq("id", dossierId)
    .maybeSingle<DossierRow>();

  if (!dossier || !dossier.lead) return null;
  const l = dossier.lead;

  const contact = [l.client_first_name, l.client_last_name].filter(Boolean).join(" ").trim();
  const etablissement = l.client_company || contact || "";
  const addr = (l.client_address ?? {}) as Addr;

  // Facture liée (facture finale en priorité, sinon acompte) via le lead.
  const { data: facture } = await supabase
    .from("documents")
    .select("num, type, issued_at")
    .eq("lead_id", l.id)
    .in("type", ["finale", "acompte"])
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ num: string }>();

  // Liste des techniciens actifs (menu déroulant), assigné en tête.
  const { data: techs } = await supabase
    .from("technicians")
    .select("name")
    .eq("is_active", true)
    .order("name")
    .returns<{ name: string | null }[]>();
  const assigned = dossier.technician?.name ?? "";
  const technicians = [
    ...(assigned ? [assigned] : []),
    ...(techs ?? [])
      .map((t) => t.name ?? "")
      .filter((n) => n && n !== assigned),
  ];

  return {
    dossierId: dossier.id,
    leadId: l.id,
    sector: l.activity?.slug ?? "nettoyage",
    client: {
      etablissement,
      raisonSociale: l.client_company || undefined,
      responsable: contact || undefined,
      adresse: addr.line1 || undefined,
      cp: addr.postal_code || undefined,
      ville: addr.city || undefined,
      telephone: l.client_phone || undefined,
      email: l.client_email || undefined,
    },
    dossierRef: l.short_id || "",
    factureNum: facture?.num ?? null,
    dateIntervention: isoToFr(dossier.realized_at) || isoToFr(dossier.planned_at) || todayFr(),
    technicien: assigned,
    technicians: technicians.length ? technicians : ["Équipe OPTIMIVV"],
  };
}
