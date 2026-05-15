import { Suspense } from "react";
import Comptabilite from "./Comptabilite";

export const metadata = { title: "Comptabilité" };

// useSearchParams is read inside <Comptabilite>; Next 16 requires a Suspense
// boundary around any client subtree that reads request-scoped APIs so the
// outer page can stream while the search-params render unblocks.
export default function ComptabilitePage() {
  return (
    <Suspense fallback={null}>
      <Comptabilite />
    </Suspense>
  );
}
