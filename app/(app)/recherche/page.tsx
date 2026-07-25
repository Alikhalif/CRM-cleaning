import SearchClient from "./SearchClient";

export const metadata = { title: "Recherche" };

// CDC §12 — recherche globale : téléphone, nom, prénom, email, adresse, ville,
// n° de dossier → la fiche complète. RLS-scoped par le server action.

export default function RecherchePage() {
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: 820 }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Recherche globale</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Retrouvez un dossier par téléphone, nom, email, ville ou numéro de document.
        </p>
      </header>
      <SearchClient />
    </div>
  );
}
