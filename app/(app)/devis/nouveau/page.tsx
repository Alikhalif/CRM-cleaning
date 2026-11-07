import NouveauDevis from "./NouveauDevis";
import { getDevisPageData } from "@/lib/devis/prefill";
import { identitePourLead } from "@/lib/devis/entite-emettrice";
import { lireReglageGabarits } from "@/lib/devis/reglage-gabarits-server";
import { resoudreGabarit } from "@/lib/devis/gabarits";

export const metadata = { title: "Nouveau devis — OPTIMIVV" };

// Next 16 : searchParams est une Promise (à await côté serveur). Préremplissage
// + modèles de relance e-mail + variables réelles du lead via ?affaire=<id>.
type PageProps = {
  searchParams: Promise<{ affaire?: string }>;
};

export default async function NouveauDevisPage({ searchParams }: PageProps) {
  const { affaire } = await searchParams;
  const { prefill, templates, motifSansModele, vars } = await getDevisPageData(affaire ?? null);

  // ── Société émettrice et modèle graphique (Lot B) ─────────────────
  //
  // Le modèle était choisi par un ternaire sur le secteur, et le titre de
  // l'écran annonçait « OPTIMIVV » quelle que soit la société. Les deux
  // viennent désormais de la base : la société du dossier, et le gabarit que
  // le réglage lui associe.
  //
  // ⚠️ C'est un AFFICHAGE. L'identité réellement imprimée est résolue une
  // seconde fois côté serveur, dans `/api/devis`, qui ne fait confiance à
  // aucune valeur venue du navigateur.
  const identite = affaire ? await identitePourLead(affaire) : null;
  const gabarit = identite?.secteur
    ? resoudreGabarit({
      entityId: identite.entityId,
      secteur: identite.secteur,
      type: "devis",
      reglages: await lireReglageGabarits(),
    }).gabarit
    : null;
  const template: "nettoyage" | "demenagement" =
    gabarit === "optimivv_nettoyage"
      ? "nettoyage"
      : gabarit === "optimivv_demenagement"
        ? "demenagement"
        : prefill?.sector === "nettoyage"
          ? "nettoyage"
          : "demenagement";

  return (
    <NouveauDevis
      prefill={prefill}
      leadId={prefill?.leadId ?? null}
      templates={templates}
      motifSansModele={motifSansModele}
      vars={vars}
      template={template}
      societe={identite?.enseigne || null}
    />
  );
}
