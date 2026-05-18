import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/users-server";
import styles from "./AuditLog.module.scss";

export const metadata = { title: "Journal d'audit" };

// Admin-only viewer for the audit_logs table. RLS already restricts SELECT
// to admins, but we double-check the current user's role server-side so we
// can render a clear 403 rather than an empty table.

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  after: Record<string, unknown> | null;
  actor: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
};

const PAGE_SIZE = 100;

// Short, dense rendering for the after-payload — most rows just need 1–3
// key/value pairs visible. Truncate long strings; show nested objects as JSON.
function formatAfter(after: Record<string, unknown> | null): string {
  if (!after || Object.keys(after).length === 0) return "—";
  return Object.entries(after)
    .map(([k, v]) => {
      let s: string;
      if (v === null) s = "null";
      else if (typeof v === "string") s = v;
      else if (typeof v === "number" || typeof v === "boolean") s = String(v);
      else s = JSON.stringify(v);
      if (s.length > 80) s = s.slice(0, 80) + "…";
      return `${k}: ${s}`;
    })
    .join(" · ");
}

function actorName(actor: AuditRow["actor"]): string {
  if (!actor) return "Système";
  const composed = `${actor.first_name ?? ""} ${actor.last_name ?? ""}`.trim();
  return composed || actor.email;
}

export default async function AuditLogPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <nav className={styles.breadcrumb}>
          <Link href="/settings" className={styles.breadcrumbLink}>Paramètres</Link>
          <span aria-hidden="true">/</span>
          <span>Journal d&apos;audit</span>
        </nav>
        <header>
          <h1 className={styles.title}>Journal d&apos;audit</h1>
        </header>
        <div className={styles.denied} role="alert">
          <Icon name="alert" size={16} />
          <div>
            <strong>Accès refusé.</strong> Le journal d&apos;audit est réservé aux administrateurs.
            Vos rôles : {profile?.roles.length ? profile.roles.map((r) => r.label).join(", ") : "aucun"}.
          </div>
        </div>
      </div>
    );
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, created_at, action, entity_type, entity_id, after, actor:users(id, first_name, last_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)
    .returns<AuditRow[]>();

  if (error) {
    return (
      <div className={styles.page}>
        <header><h1 className={styles.title}>Journal d&apos;audit</h1></header>
        <p className={styles.error}>Impossible de charger les événements : {error.message}</p>
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/settings" className={styles.breadcrumbLink}>Paramètres</Link>
        <span aria-hidden="true">/</span>
        <span>Journal d&apos;audit</span>
      </nav>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Journal d&apos;audit</h1>
          <p className={styles.subtitle}>
            {rows.length} événement{rows.length > 1 ? "s" : ""} récent{rows.length > 1 ? "s" : ""} ·
            CDC §8.2 · rétention 5 ans
          </p>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Acteur</th>
              <th>Action</th>
              <th>Entité</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={styles.colDate}>
                  <div className={styles.timestamp}>{new Date(row.created_at).toLocaleString("fr-FR")}</div>
                  <RelativeTime iso={row.created_at} className={styles.muted} />
                </td>
                <td>{actorName(row.actor)}</td>
                <td>
                  <code className={styles.action}>{row.action}</code>
                </td>
                <td>
                  <span className={styles.entityType}>{row.entity_type}</span>
                  {row.entity_id && (
                    <div className={styles.entityId}>{row.entity_id.slice(0, 8)}…</div>
                  )}
                </td>
                <td className={styles.detail}>{formatAfter(row.after)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  Aucun événement enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
