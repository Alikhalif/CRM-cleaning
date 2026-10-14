import Link from "next/link";
import { getAllPricingParams } from "@/lib/pricing/server";
import PricingSettings from "./PricingSettings";

export const metadata = { title: "Barèmes tarifaires" };

export default async function PricingSettingsPage() {
  const rows = await getAllPricingParams();

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/settings" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>Paramètres</Link>
        <span aria-hidden> / </span>
        <span>Barèmes tarifaires</span>
      </nav>

      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Barèmes tarifaires</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4, maxWidth: 760, lineHeight: 1.6 }}>
          Ces paramètres alimentent la <strong>fourchette recommandée</strong> affichée au commercial
          pendant sa découverte. Rien n&apos;est pré-rempli&nbsp;: tant qu&apos;une activité n&apos;est pas
          activée ici, la découverte indique qu&apos;aucun barème n&apos;est configuré et ne propose aucun
          prix. Un chiffre inventé serait annoncé à un vrai client.
        </p>
        <p style={{ color: "var(--text-muted)", marginTop: 8, maxWidth: 760, lineHeight: 1.6, fontSize: "0.875rem" }}>
          Calcul&nbsp;: forfait + (volume ou surface × prix unitaire) + km au-delà des km inclus +
          étages sans ascenseur + options, puis majorations urgence et difficulté, puis plancher.
          La fourchette s&apos;ouvre ensuite de −% à +% autour de ce prix.
        </p>
      </header>

      <PricingSettings rows={rows} />
    </div>
  );
}
