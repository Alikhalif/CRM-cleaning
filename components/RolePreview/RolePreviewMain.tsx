"use client";

import { useStoredValue } from "@/lib/client-store";
import { PREVIEW_ROLE_KEY } from "@/lib/role-preview";

// Enveloppe le contenu principal. Pendant un aperçu de rôle (A15), on rend la
// zone `inert` : elle devient réellement non interactive (aucun clic, focus ni
// soumission de formulaire) → lecture seule stricte. La barre latérale et la
// topbar restent hors de cette zone, donc actives pour naviguer / quitter
// l'aperçu. Hors aperçu, le comportement est strictement identique à avant.
export default function RolePreviewMain({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const previewRole = useStoredValue(PREVIEW_ROLE_KEY, "");
  const active = previewRole !== "";
  return (
    <main className={className} inert={active}>
      {children}
    </main>
  );
}
