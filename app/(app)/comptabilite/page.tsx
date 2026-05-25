import { Suspense } from "react";
import Comptabilite from "./Comptabilite";
import { getAllDocumentsWithContext, getAllEntities } from "@/lib/documents-server";
import { getAllTechnicians } from "@/lib/planification-server";

export const metadata = { title: "Comptabilité" };

// useSearchParams is read inside <Comptabilite>; Next 16 requires a Suspense
// boundary around any client subtree that reads request-scoped APIs so the
// outer page can stream while the search-params render unblocks.
export default async function ComptabilitePage() {
  const [rows, entities, technicians] = await Promise.all([
    getAllDocumentsWithContext(),
    getAllEntities(),
    getAllTechnicians(),
  ]);

  return (
    <Suspense fallback={null}>
      <Comptabilite rows={rows} entities={entities} technicians={technicians} />
    </Suspense>
  );
}
