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
  searchParams: Promise<{
    lead?: string;
    client?: string;
    from?: string;
    brouillon?: string;
  }>;
};

export default async function NewQuotePage({ searchParams }: PageProps) {
  const {
    lead: leadParam,
    client: clientParam,
    from: fromParam,
    brouillon: brouillonParam,
  } = await searchParams;

  // Deux reprises possibles, qui lisent la MÊME source (`getDevisPrefill`) et
  // ne diffèrent que par ce qu'elles font à l'enregistrement :
  //
  //   ?from=<devisId>      — re-devis moins cher : crée un SECOND document,
  //                          sur une autre société, à un prix inférieur.
  //   ?brouillon=<devisId> — modification : écrit EN PLACE dans le brouillon,
  //                          sans nouveau numéro ni doublon dans
  //                          « Devis à réaliser ». C'est le chemin de retour
  //                          d'un devis préparé depuis la découverte.
  //
  // `brouillon` l'emporte si les deux sont fournis : écrire en place est le
  // geste le moins destructeur des deux.
  const sourceId = brouillonParam ?? fromParam;
  const prefill = sourceId ? await getDevisPrefill(sourceId) : null;
  // Pas de mode modification si le document est introuvable (mauvais
  // identifiant, ou devis d'un autre commercial écarté par la RLS) : l'éditeur
  // retombe alors sur la création classique plutôt que d'échouer à l'écriture.
  const brouillonId = brouillonParam && prefill ? prefill.sourceId : null;

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
      brouillonId={brouillonId}
    />
  );
}
