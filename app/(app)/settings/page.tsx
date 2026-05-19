import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import PageShell from "../_shared/PageShell";

export const metadata = { title: "Paramètres" };

// Most sub-sections are still placeholders (utilisateurs, entités, secteurs,
// modèles, sources, intégrations). The audit log is the first real one.
export default function SettingsPage() {
  return (
    <>
      <PageShell
        title="Paramètres"
        subtitle="Utilisateurs · entités juridiques · secteurs · modèles · sources · intégrations."
        placeholder="6 sous-onglets · accès Super Admin uniquement"
      />
      <div
        style={{
          padding: "0 var(--sp-6) var(--sp-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-2)",
        }}
      >
        <Link
          href="/settings/integrations"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            padding: "var(--sp-3) var(--sp-4)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-md)",
            textDecoration: "none",
            color: "var(--text-primary)",
            background: "var(--bg-elevated)",
          }}
        >
          <Icon name="zap" size={16} />
          <span>
            <strong>Intégrations</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Activer / désactiver la séquence n8n automatique
            </span>
          </span>
        </Link>
        <Link
          href="/settings/audit"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            padding: "var(--sp-3) var(--sp-4)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-md)",
            textDecoration: "none",
            color: "var(--text-primary)",
            background: "var(--bg-elevated)",
          }}
        >
          <Icon name="settings" size={16} />
          <span>
            <strong>Journal d&apos;audit</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Voir tous les événements de conformité (CDC §8.2 · admin uniquement)
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
