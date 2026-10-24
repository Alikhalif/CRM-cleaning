import { redirect } from "next/navigation";

// « Ma journée » est devenue « Mes actions » (2026-10-24).
//
// L'ancienne adresse est CONSERVÉE et redirige, plutôt que supprimée : la
// bannière du tableau de bord, la fiche lead et la supervision y renvoient
// encore, et le périmètre de cette refonte interdit de toucher à ces
// modules. Aucun lien existant ne casse, et rien d'autre n'a eu à bouger.
//
// Le paramètre `tab` est transmis tel quel : /ma-journee?tab=photos ouvre
// toujours la section « dossiers en attente de photos ».

export default async function MaJourneeRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(tab ? `/mes-actions?tab=${encodeURIComponent(tab)}` : "/mes-actions");
}
