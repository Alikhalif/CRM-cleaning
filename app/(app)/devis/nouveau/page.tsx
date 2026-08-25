import NouveauDevis from "./NouveauDevis";
import { getDevisPageData } from "@/lib/devis/prefill";

export const metadata = { title: "Nouveau devis — OPTIMIVV" };

// Next 16 : searchParams est une Promise (à await côté serveur). Préremplissage
// + modèles de relance e-mail + variables réelles du lead via ?affaire=<id>.
type PageProps = {
  searchParams: Promise<{ affaire?: string }>;
};

export default async function NouveauDevisPage({ searchParams }: PageProps) {
  const { affaire } = await searchParams;
  const { prefill, templates, vars } = await getDevisPageData(affaire ?? null);
  // Modèle graphique du PDF selon le secteur : nettoyage → design OPTIMIVV
  // NETTOYAGE ; tout le reste (déménagement, débarras…) → design déménagement.
  const template = prefill?.sector === "nettoyage" ? "nettoyage" : "demenagement";
  return (
    <NouveauDevis
      prefill={prefill}
      leadId={prefill?.leadId ?? null}
      templates={templates}
      vars={vars}
      template={template}
    />
  );
}
