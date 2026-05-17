import QuoteEditor from "./QuoteEditor";
import {
  getClientsForPicker,
  getEntitiesForPicker,
  getPrestationsForPicker,
  getLeadContext,
} from "@/lib/devis-server";

export const metadata = { title: "Nouveau devis" };

// Next 16 passes searchParams as a Promise — must be awaited in server
// components. Page is fully async so the editor's bootstrap (clients,
// entities, prestations, optional lead pre-fill) happens server-side
// before the form ever renders.
type PageProps = {
  searchParams: Promise<{ lead?: string; client?: string }>;
};

export default async function NewQuotePage({ searchParams }: PageProps) {
  const { lead: leadParam, client: clientParam } = await searchParams;

  const [clients, entities, prestations, leadCtx] = await Promise.all([
    getClientsForPicker(),
    getEntitiesForPicker(),
    getPrestationsForPicker(),
    leadParam ? getLeadContext(leadParam) : Promise.resolve(null),
  ]);

  return (
    <QuoteEditor
      clients={clients}
      entities={entities}
      prestations={prestations}
      leadContext={leadCtx}
      preselectedClientId={clientParam ?? null}
    />
  );
}
