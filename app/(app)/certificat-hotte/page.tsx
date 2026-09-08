import Link from "next/link";
import CertificatHotte from "./CertificatHotte";
import { getCertHottePageData } from "@/lib/cert-hotte/prefill";

export const metadata = { title: "Certificat Hotte — OPTIMIVV" };

// Next 16 : searchParams est une Promise. Préremplissage depuis un dossier
// (?dossier=<uuid>). Lecture RLS-scopée : si le dossier n'est pas accessible,
// on n'affiche pas le formulaire.
type PageProps = {
  searchParams: Promise<{ dossier?: string }>;
};

export default async function CertificatHottePage({ searchParams }: PageProps) {
  const { dossier } = await searchParams;
  const prefill = await getCertHottePageData(dossier ?? null);

  if (!prefill) {
    return (
      <div style={{ padding: "40px", maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Certificat Hotte</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Ouvrez un certificat depuis un dossier de nettoyage de hotte (Planification →
          menu du dossier → « Certificat Hotte »). Le dossier fournit
          automatiquement les coordonnées de l&apos;établissement.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/planification" style={{ color: "var(--color-brand-600)" }}>
            ← Retour à la planification
          </Link>
        </p>
      </div>
    );
  }

  return <CertificatHotte prefill={prefill} />;
}
