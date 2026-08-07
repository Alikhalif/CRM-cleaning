import Link from "next/link";
import {
  getAllUsersForAdmin,
  getAllRoles,
  getAllActivities,
  getCurrentUserProfile,
} from "@/lib/users-server";
import { getEntitiesForPicker } from "@/lib/devis-server";
import UsersList from "./UsersList";

export const metadata = { title: "Utilisateurs" };

// Admin-only. RLS gates the writes; we also gate the UI so non-admins get a
// friendly message rather than an empty table. This is where a commercial is
// flagged into the premium / extrême routing pools and given roles.

export default async function UsersPage() {
  const [users, roles, me, entities, activities] = await Promise.all([
    getAllUsersForAdmin(),
    getAllRoles(),
    getCurrentUserProfile(),
    getEntitiesForPicker(),
    getAllActivities(),
  ]);
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  const entityOptions = entities.map((e) => ({ id: e.id, name: e.legalName }));

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/settings" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>
          Paramètres
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Utilisateurs</span>
      </nav>

      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Utilisateurs</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Rôles et pools de routing (premium / extrême). Les changements sont journalisés (audit).
        </p>
      </header>

      {!isAdmin ? (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          <strong>Accès restreint</strong> — la gestion des utilisateurs est réservée aux comptes{" "}
          <strong>Admin</strong>. Vos rôles : {(me?.roles ?? []).map((r) => r.slug).join(", ") || "(aucun)"}.
        </div>
      ) : (
        <UsersList users={users} roles={roles} entities={entityOptions} activities={activities} />
      )}
    </div>
  );
}
