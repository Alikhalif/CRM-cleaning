import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { ContractStatus } from "./contracts-types";

// Agrégation pour la page « Documents & Contrats » (§13). Requêtes bornées,
// lecture service-role (la page vérifie la session). Les alertes sont calculées
// à la lecture (toujours fraîches) : contrats à renouveler/expirant, en attente
// de signature, certificats à générer/envoyer, passages à planifier.

const EXPIRY_DAYS = 30;   // « expire prochainement »
const DONE_LOOKBACK_DAYS = 120;

export type DashContract = {
  id: string; ref: string | null; clientId: string; clientName: string;
  category: string | null; title: string; status: ContractStatus;
  startDate: string | null; endDate: string | null;
  passagesPerYear: number | null; passagesDone: number; amount: number | null;
  expiringSoon: boolean;
};
export type DashPassage = { passageId: string; clientId: string; clientName: string; contractRef: string | null; contractTitle: string; category: string | null; index: number };
export type DashCert = { clientId: string | null; clientName: string; dossierId: string; numero?: string | null; category: string };

export type DocumentsDashboard = {
  counts: {
    actifs: number; aRenouveler: number; expirent: number; enAttenteSignature: number;
    certGenerer: number; certEnvoyer: number; passagesAPlanifier: number;
  };
  contracts: DashContract[];
  passagesToPlan: DashPassage[];
  certsToSend: DashCert[];
  certsToGenerate: DashCert[];
};

export async function getDocumentsDashboard(): Promise<DocumentsDashboard> {
  const sb = await supabaseServiceRole();
  const now = Date.now();
  const expiryCut = new Date(now + EXPIRY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const doneCut = new Date(now - DONE_LOOKBACK_DAYS * 86_400_000).toISOString();

  const [contractsRes, certsRes, dossiersRes] = await Promise.all([
    sb.from("contracts")
      .select("id, ref, client_id, category, title, status, start_date, end_date, passages_per_year, passages_done, amount")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; ref: string | null; client_id: string; category: string | null; title: string; status: string; start_date: string | null; end_date: string | null; passages_per_year: number | null; passages_done: number; amount: number | null }[]>(),
    sb.from("cert_hotte").select("id, dossier_id, lead_id, numero, client_nom, sent_at")
      .returns<{ id: string; dossier_id: string | null; lead_id: string | null; numero: string; client_nom: string | null; sent_at: string | null }[]>(),
    sb.from("dossiers").select("id, lead_id, status, realized_at")
      .in("status", ["finalise", "solde"] as never[])
      .gte("realized_at", doneCut)
      .returns<{ id: string; lead_id: string; status: string; realized_at: string | null }[]>(),
  ]);

  const contractRows = contractsRes.data ?? [];
  const certRows = certsRes.data ?? [];
  const dossierRows = dossiersRes.data ?? [];

  // Noms clients + tags (pour la catégorie « hotte » côté certificats à générer).
  const clientIds = [...new Set(contractRows.map((c) => c.client_id))];
  const leadIds = [...new Set([...certRows.map((c) => c.lead_id), ...dossierRows.map((d) => d.lead_id)].filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  const clientByLead = new Map<string, { id: string; name: string; hotte: boolean }>();
  await Promise.all([
    clientIds.length
      ? sb.from("clients").select("id, name").in("id", clientIds).then(({ data }) => {
          for (const c of (data ?? []) as { id: string; name: string }[]) nameById.set(c.id, c.name);
        })
      : Promise.resolve(),
    leadIds.length
      ? sb.from("clients").select("id, name, source_lead_id, activity_tags").in("source_lead_id", leadIds).then(({ data }) => {
          for (const c of (data ?? []) as { id: string; name: string; source_lead_id: string | null; activity_tags: string[] | null }[]) {
            if (c.source_lead_id) clientByLead.set(c.source_lead_id, { id: c.id, name: c.name, hotte: (c.activity_tags ?? []).includes("hotte") });
          }
        })
      : Promise.resolve(),
  ]);

  const contracts: DashContract[] = contractRows.map((c) => ({
    id: c.id, ref: c.ref, clientId: c.client_id, clientName: nameById.get(c.client_id) ?? "Client",
    category: c.category, title: c.title, status: c.status as ContractStatus,
    startDate: c.start_date, endDate: c.end_date, passagesPerYear: c.passages_per_year,
    passagesDone: c.passages_done, amount: c.amount != null ? Number(c.amount) : null,
    expiringSoon: Boolean((c.status === "actif" || c.status === "a_renouveler") && c.end_date && c.end_date <= expiryCut),
  }));

  // Compteurs contrats.
  let actifs = 0, aRenouveler = 0, expirent = 0, enAttenteSignature = 0;
  for (const c of contracts) {
    if (c.status === "actif") actifs += 1;
    if (c.status === "a_renouveler") aRenouveler += 1;
    if (c.status === "en_attente_signature") enAttenteSignature += 1;
    if ((c.status === "actif" || c.status === "a_renouveler") && c.endDate && c.endDate <= expiryCut) expirent += 1;
  }

  // Passages à planifier (contrats non résiliés/expirés).
  const activeContractIds = contracts.filter((c) => c.status === "actif" || c.status === "a_renouveler" || c.status === "en_attente_signature").map((c) => c.id);
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const passagesToPlan: DashPassage[] = [];
  if (activeContractIds.length) {
    const { data } = await sb.from("contract_passages")
      .select("id, contract_id, index, status")
      .in("contract_id", activeContractIds as never[])
      .eq("status", "a_planifier")
      .returns<{ id: string; contract_id: string; index: number; status: string }[]>();
    for (const p of data ?? []) {
      const c = contractById.get(p.contract_id);
      if (!c) continue;
      passagesToPlan.push({ passageId: p.id, clientId: c.clientId, clientName: c.clientName, contractRef: c.ref, contractTitle: c.title, category: c.category, index: p.index });
    }
  }

  // Certificats à envoyer (cert_hotte sans sent_at).
  const certsToSend: DashCert[] = certRows
    .filter((c) => !c.sent_at)
    .map((c) => {
      const cl = c.lead_id ? clientByLead.get(c.lead_id) : undefined;
      return { clientId: cl?.id ?? null, clientName: cl?.name ?? c.client_nom ?? "Client", dossierId: c.dossier_id ?? "", numero: c.numero, category: "hotte" };
    })
    .filter((c) => c.dossierId);

  // Certificats à générer : interventions hotte réalisées sans certificat.
  const certDossierIds = new Set(certRows.map((c) => c.dossier_id).filter(Boolean) as string[]);
  const certsToGenerate: DashCert[] = [];
  for (const d of dossierRows) {
    if (certDossierIds.has(d.id)) continue;
    const cl = clientByLead.get(d.lead_id);
    if (!cl || !cl.hotte) continue; // uniquement les clients hotte
    certsToGenerate.push({ clientId: cl.id, clientName: cl.name, dossierId: d.id, category: "hotte" });
  }

  return {
    counts: {
      actifs, aRenouveler, expirent, enAttenteSignature,
      certGenerer: certsToGenerate.length, certEnvoyer: certsToSend.length, passagesAPlanifier: passagesToPlan.length,
    },
    contracts, passagesToPlan, certsToSend, certsToGenerate,
  };
}
