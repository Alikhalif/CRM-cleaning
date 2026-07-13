import QuoteEditor from "./QuoteEditor";
import {
  getClientsForPicker,
  getEntitiesForPicker,
  getPrestationsForPicker,
  getLeadContext,
  getDevisPrefill,
} from "@/lib/devis-server";
import { ensureClientFromLead } from "@/app/(app)/clients/new/actions";

export const metadata = { title: "Nouveau devis" };

// Next 16 passes searchParams as a Promise — must be awaited in server
// components. Page is fully async so the editor's bootstrap (clients,
// entities, prestations, optional lead pre-fill) happens server-side
// before the form ever renders.
//
// Lead → Client auto-conversion (CDC §3): when arriving with ?lead=,
// resolve the lead context first; if found, idempotently ensure a
// `clients` row exists with source_lead_id == leadId before loading the
// client picker. The editor then has the lead's client ready to pre-
// select — no manual "+ Créer un client" detour for the commercial.
type PageProps = {
  searchParams: Promise<{ lead?: string; client?: string; from?: string }>;
};

export default async function NewQuotePage({ searchParams }: PageProps) {
  const { lead: leadParam, client: clientParam, from: fromParam } = await searchParams;

  // ?from=<devisId> — re-quote flow: seed the editor from an existing (usually
  // refused) devis so the commercial can switch société and lower the price.
  const prefill = fromParam ? await getDevisPrefill(fromParam) : null;

  // Resolve the lead first so the conversion can run before the clients
  // list is read. The rest of the bootstrap stays parallel.
  const leadCtx = leadParam ? await getLeadContext(leadParam) : null;
  let convertedClientId: string | null = null;
  if (leadCtx) {
    const conv = await ensureClientFromLead(leadCtx.id);
    if (conv.ok) convertedClientId = conv.clientId;
  }

  const [clients, entities, prestations] = await Promise.all([
    getClientsForPicker(),
    getEntitiesForPicker(),
    getPrestationsForPicker(),
  ]);

  return (
    <QuoteEditor
      clients={clients}
      entities={entities}
      prestations={prestations}
      leadContext={leadCtx}
      preselectedClientId={clientParam ?? prefill?.clientId ?? convertedClientId ?? null}
      prefill={prefill}
    />
  );
}
