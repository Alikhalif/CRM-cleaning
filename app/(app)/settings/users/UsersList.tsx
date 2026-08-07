"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  COMMERCIAL_PROFILES,
  COMMERCIAL_PROFILE_LABEL,
  COUNTRIES,
  COUNTRY_LABEL,
} from "@/lib/leads";
import type { AdminUserRow, RoleOption, ActivityOption } from "@/lib/users-server";
import {
  assignRole,
  createUserWithPassword,
  inviteUser,
  removeRole,
  setRingoverAgentId,
  setUserActivities,
  setUserCountries,
  setUserEntity,
  setUserFlag,
  setUserProfiles,
  type Result,
} from "./actions";

type EntityOption = { id: string; name: string };
type Props = { users: AdminUserRow[]; roles: RoleOption[]; entities: EntityOption[]; activities: ActivityOption[] };

export default function UsersList({ users, roles, entities, activities }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Invite / create form state.
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);

  const run = (key: string, fn: () => Promise<Result>) => {
    setError(null);
    setOkMsg(null);
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

  const onInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const em = inviteEmail.trim();
    if (!em) return;
    setError(null);
    setOkMsg(null);
    setInviting(true);
    startTransition(async () => {
      const r = await inviteUser(em, inviteFirst, inviteLast);
      setInviting(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOkMsg(`Invitation envoyée à ${em}.`);
      setInviteEmail("");
      setInviteFirst("");
      setInviteLast("");
      router.refresh();
    });
  };

  // Accès direct : crée le compte avec mot de passe (email confirmé) — le
  // commercial se connecte tout de suite, sans email d'invitation.
  const onCreate = () => {
    const em = inviteEmail.trim();
    if (!em || invitePassword.length < 12) return;
    setError(null);
    setOkMsg(null);
    setInviting(true);
    startTransition(async () => {
      const r = await createUserWithPassword(em, inviteFirst, inviteLast, invitePassword);
      setInviting(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOkMsg(`Compte créé pour ${em}. Il peut se connecter avec ce mot de passe.`);
      setInviteEmail("");
      setInviteFirst("");
      setInviteLast("");
      setInvitePassword("");
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
      <form
        onSubmit={onInvite}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: "10px 12px 14px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="email@exemple.fr"
          required
          aria-label="Email à inviter"
          style={{ flex: "1 1 220px", padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
        />
        <input
          type="text"
          value={inviteFirst}
          onChange={(e) => setInviteFirst(e.target.value)}
          placeholder="Prénom"
          aria-label="Prénom"
          style={{ flex: "0 1 130px", padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
        />
        <input
          type="text"
          value={inviteLast}
          onChange={(e) => setInviteLast(e.target.value)}
          placeholder="Nom"
          aria-label="Nom"
          style={{ flex: "0 1 130px", padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
        />
        <input
          type="text"
          value={invitePassword}
          onChange={(e) => setInvitePassword(e.target.value)}
          placeholder="Mot de passe (12+ car.)"
          aria-label="Mot de passe (accès direct)"
          autoComplete="new-password"
          style={{ flex: "1 1 180px", padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={inviting || !inviteEmail.trim() || invitePassword.length < 12}
          title="Crée le compte avec ce mot de passe (accès immédiat, sans email)"
          style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: !inviteEmail.trim() || invitePassword.length < 12 ? 0.6 : 1 }}
        >
          {inviting ? "…" : "Créer (accès direct)"}
        </button>
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          title="Envoie un email d'invitation (le commercial choisit son mot de passe)"
          style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}
        >
          {inviting ? "…" : "Inviter par email"}
        </button>
      </form>
      <p style={{ padding: "0 12px 6px", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: -6 }}>
        <strong>Créer (accès direct)</strong> = compte activé tout de suite avec le mot de passe saisi (recommandé si l&apos;email d&apos;invitation ne passe pas).
        <strong> Inviter par email</strong> = le commercial reçoit un lien pour définir son propre mot de passe.
      </p>

      {okMsg && (
        <p style={{ color: "var(--tone-success, #14c890)", padding: "8px 12px", fontSize: "0.875rem" }} role="status">
          <Icon name="check" size={14} /> {okMsg}
        </p>
      )}
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
              <th style={th}>Profils commerciaux</th>
              <th style={th}>Activités (secteurs visibles)</th>
              <th style={th}>Pays</th>
              <th style={th}>Société</th>
              <th style={th}>N° Ringover</th>
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
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 260 }}>
                    {COMMERCIAL_PROFILES.map((p) => {
                      const active = u.commercialProfiles.includes(p);
                      const key = `prof-${u.id}-${p}`;
                      const next = active
                        ? u.commercialProfiles.filter((x) => x !== p)
                        : [...u.commercialProfiles, p];
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(key, () => setUserProfiles(u.id, next))}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            cursor: busy !== null ? "default" : "pointer",
                            border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
                            background: active ? "var(--color-brand-500)" : "transparent",
                            color: active ? "#fff" : "var(--text-muted)",
                          }}
                        >
                          {busy === key ? "…" : COMMERCIAL_PROFILE_LABEL[p]}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 300 }}>
                    {activities.map((a) => {
                      const active = u.activityIds.includes(a.id);
                      const key = `act-${u.id}-${a.id}`;
                      const next = active
                        ? u.activityIds.filter((x) => x !== a.id)
                        : [...u.activityIds, a.id];
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(key, () => setUserActivities(u.id, next))}
                          title={`${active ? "Retirer" : "Ajouter"} l'activité ${a.label}`}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            cursor: busy !== null ? "default" : "pointer",
                            border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
                            background: active ? "var(--color-brand-500)" : "transparent",
                            color: active ? "#fff" : "var(--text-muted)",
                          }}
                        >
                          {busy === key ? "…" : a.label}
                        </button>
                      );
                    })}
                    {activities.length === 0 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>—</span>}
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {COUNTRIES.map((c) => {
                      const active = u.countries.includes(c);
                      const key = `ctry-${u.id}-${c}`;
                      const next = active
                        ? u.countries.filter((x) => x !== c)
                        : [...u.countries, c];
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(key, () => setUserCountries(u.id, next))}
                          title={COUNTRY_LABEL[c]}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            cursor: busy !== null ? "default" : "pointer",
                            border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
                            background: active ? "var(--color-brand-500)" : "transparent",
                            color: active ? "#fff" : "var(--text-muted)",
                          }}
                        >
                          {busy === key ? "…" : c}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td style={td}>
                  <select
                    value={u.entityId ?? ""}
                    disabled={busy !== null}
                    onChange={(e) => run(`ent-${u.id}`, () => setUserEntity(u.id, e.target.value))}
                    title="Société de rattachement du commercial"
                    aria-label={`Société de ${u.displayName}`}
                    style={{
                      maxWidth: 150,
                      padding: "4px 8px",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <option value="">—</option>
                    {entities.map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <input
                    type="text"
                    defaultValue={u.ringoverAgentId}
                    placeholder="+339…"
                    title="Numéro Ringover du commercial en E.164 (fait sonner son poste)"
                    disabled={busy !== null}
                    onBlur={(e) => {
                      if (e.target.value !== u.ringoverAgentId) {
                        run(`ring-${u.id}`, () => setRingoverAgentId(u.id, e.target.value));
                      }
                    }}
                    style={{
                      width: 120,
                      padding: "4px 8px",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "0.8125rem",
                    }}
                    aria-label={`Identifiant Ringover de ${u.displayName}`}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...td, color: "var(--text-muted)" }}>
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
        Premium / Extrême = pools de routing (une règle « pool premium/extrême » y dispatche les leads).
        Les <strong>capacités</strong> (accès Ringover, création de lead) sont <strong>dérivées automatiquement des profils</strong> :
        Appel entrant, Diogène, Débarras/Déménagement, Performant et En attente y ont droit ; Nettoyage (Divers) ne reçoit que des devis.
        L&apos;invité reçoit un email d&apos;activation ; il apparaît dans la liste dès son compte créé, puis attribuez-lui ses rôles.
      </p>
    </div>
  );
}
