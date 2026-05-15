import { Suspense } from "react";
import QuoteEditor from "./QuoteEditor";

export const metadata = { title: "Nouveau devis" };

// QuoteEditor reads ?lead= and ?client= via useSearchParams — Next 16 requires
// a Suspense boundary around any client subtree that reads request-scoped APIs.
export default function NewQuotePage() {
  return (
    <Suspense fallback={null}>
      <QuoteEditor />
    </Suspense>
  );
}
