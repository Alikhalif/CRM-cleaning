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
          href="/settings/users"
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
          <Icon name="commerciaux" size={16} />
          <span>
            <strong>Utilisateurs</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Rôles et pools de routing premium / extrême (admin uniquement)
            </span>
          </span>
        </Link>
        <Link
          href="/settings/entities"
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
          <Icon name="comptabilite" size={16} />
          <span>
            <strong>Sociétés émettrices</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Créer / modifier les sociétés multi-entités (CDC §4.2 · admin uniquement)
            </span>
          </span>
        </Link>
        <Link
          href="/settings/routing"
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
          <Icon name="pipeline" size={16} />
          <span>
            <strong>Règles de routing des leads</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Automatiser l&apos;attribution des leads (superficie, secteur, source, premium…)
            </span>
          </span>
        </Link>
        <Link
          href="/settings/landing-pages"
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
          <Icon name="leads" size={16} />
          <span>
            <strong>Landing Pages</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Configurer chaque LP : token → pays + société + secteur + source (admin uniquement)
            </span>
          </span>
        </Link>
        <Link
          href="/settings/templates"
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
          <Icon name="edit" size={16} />
          <span>
            <strong>Templates mail &amp; SMS</strong>
            <br />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Messages réutilisables (relance, photos, RDV…) avec variables dynamiques (admin uniquement)
            </span>
          </span>
        </Link>
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
