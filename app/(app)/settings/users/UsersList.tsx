"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { AdminUserRow, RoleOption } from "@/lib/users-server";
import { assignRole, removeRole, setUserFlag, type Result } from "./actions";

type Props = { users: AdminUserRow[]; roles: RoleOption[] };

export default function UsersList({ users, roles }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (key: string, fn: () => Promise<Result>) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem" };
  const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle" };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-lg)",
        padding: "8px 4px",
      }}
    >
      {error && (
        <p style={{ color: "var(--tone-danger)", padding: "8px 12px", fontSize: "0.875rem" }} role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
          <thead>
            <tr>
              <th style={th}>Utilisateur</th>
              <th style={th}>Rôles</th>
              <th style={th}>Premium</th>
              <th style={th}>Extrême</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.displayName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {roles.map((role) => {
                      const active = u.roleSlugs.includes(role.slug);
                      const key = `role-${u.id}-${role.id}`;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            run(key, () =>
                              active ? removeRole(u.id, role.id) : assignRole(u.id, role.id),
                            )
                          }
                          title={active ? `Retirer le rôle ${role.label}` : `Attribuer le rôle ${role.label}`}
                          style={{
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "0.8125rem",
                            cursor: busy !== null ? "default" : "pointer",
                            border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
                            background: active ? "var(--color-brand-500)" : "transparent",
                            color: active ? "#fff" : "var(--text-muted)",
                          }}
                        >
                          {busy === key ? "…" : role.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={u.isPremium}
                    disabled={busy !== null}
                    onChange={(e) => run(`prem-${u.id}`, () => setUserFlag(u.id, "is_premium", e.target.checked))}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                    aria-label={`Premium pour ${u.displayName}`}
                  />
                </td>
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={u.isExtreme}
                    disabled={busy !== null}
                    onChange={(e) => run(`extr-${u.id}`, () => setUserFlag(u.id, "is_extreme", e.target.checked))}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                    aria-label={`Extrême pour ${u.displayName}`}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, color: "var(--text-muted)" }}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
        Premium / Extrême = pools de routing (une règle « pool premium/extrême » y dispatche les leads).
        L&apos;invitation d&apos;un nouvel utilisateur par email arrivera dans une prochaine itération.
      </p>
    </div>
  );
}
