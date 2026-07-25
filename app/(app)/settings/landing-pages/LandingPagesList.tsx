"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import { COUNTRIES, COUNTRY_LABEL } from "@/lib/leads";
import type { LandingPageRow, LpOptions } from "@/lib/landing-pages-server";
import {
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  type LpInput,
  type Result,
} from "./actions";

type Props = { pages: LandingPageRow[]; options: LpOptions };

const empty: LpInput = {
  token: "",
  name: "",
  country: "",
  entityId: "",
  activityId: "",
  sourceId: "",
  isActive: true,
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "0.9375rem",
};
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)" };

export default function LandingPagesList({ pages, options }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; input: LpInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const openNew = () => { setError(null); setEditing({ id: null, input: { ...empty } }); };
  const openEdit = (p: LandingPageRow) => {
    setError(null);
    setEditing({
      id: p.id,
      input: {
        token: p.token,
        name: p.name,
        country: (p.country ?? "") as LpInput["country"],
        entityId: p.entityId ?? "",
        activityId: p.activityId ?? "",
        sourceId: p.sourceId ?? "",
        isActive: p.isActive,
      },
    });
  };

  const run = (fn: () => Promise<Result>, onOk?: () => void) => {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      onOk?.();
      router.refresh();
    });
  };

  const save = () => {
    if (!editing) return;
    const { id, input } = editing;
    run(() => (id ? updateLandingPage(id, input) : createLandingPage(input)), () => setEditing(null));
  };

  const remove = (p: LandingPageRow) => {
    if (!confirm(`Supprimer la landing page « ${p.name} » ?`)) return;
    run(() => deleteLandingPage(p.id));
  };

  const set = <K extends keyof LpInput>(k: K, v: LpInput[K]) =>
    setEditing((e) => (e ? { ...e, input: { ...e.input, [k]: v } } : e));

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", padding: "8px 4px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px" }}>
        <button
          type="button"
          onClick={openNew}
          style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          + Nouvelle landing page
        </button>
      </div>

      {error && !editing && (
        <p style={{ color: "var(--tone-danger)", padding: "8px 12px", fontSize: "0.875rem" }} role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
          <thead>
            <tr>
              <th style={th}>Token</th>
              <th style={th}>Nom</th>
              <th style={th}>Pays</th>
              <th style={th}>Société</th>
              <th style={th}>Secteur</th>
              <th style={th}>Source</th>
              <th style={th}>Active</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td style={{ ...td, fontFamily: "monospace" }}>{p.token}</td>
                <td style={{ ...td, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</td>
                <td style={td}>{p.country ? COUNTRY_LABEL[p.country] : "—"}</td>
                <td style={td}>{p.entityName ?? "—"}</td>
                <td style={td}>{p.activityLabel ?? "—"}</td>
                <td style={td}>{p.sourceLabel ?? "—"}</td>
                <td style={td}>{p.isActive ? "✅" : "—"}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" onClick={() => openEdit(p)} style={{ background: "none", border: "none", color: "var(--color-brand-500)", cursor: "pointer", marginRight: 10 }}>
                    Modifier
                  </button>
                  <button type="button" onClick={() => remove(p)} style={{ background: "none", border: "none", color: "var(--tone-danger)", cursor: "pointer" }}>
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, color: "var(--text-muted)" }}>Aucune landing page configurée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setEditing(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {editing.id ? "Modifier la landing page" : "Nouvelle landing page"}
            </h2>

            <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Token (champ <code>lp</code> envoyé par le formulaire)
              <input style={inp} value={editing.input.token} onChange={(e) => set("token", e.target.value)} placeholder="nettoyage-suisse" />
            </label>
            <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Nom
              <input style={inp} value={editing.input.name} onChange={(e) => set("name", e.target.value)} placeholder="Nettoyage Suisse" />
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Pays
                <select style={inp} value={editing.input.country} onChange={(e) => set("country", e.target.value as LpInput["country"])}>
                  <option value="">—</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>)}
                </select>
              </label>
              <label style={{ flex: 1, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Société
                <select style={inp} value={editing.input.entityId} onChange={(e) => set("entityId", e.target.value)}>
                  <option value="">—</option>
                  {options.entities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Secteur
                <select style={inp} value={editing.input.activityId} onChange={(e) => set("activityId", e.target.value)}>
                  <option value="">—</option>
                  {options.activities.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
              <label style={{ flex: 1, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Source
                <select style={inp} value={editing.input.sourceId} onChange={(e) => set("sourceId", e.target.value)}>
                  <option value="">—</option>
                  {options.sources.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "var(--text-primary)" }}>
              <input type="checkbox" checked={editing.input.isActive} onChange={(e) => set("isActive", e.target.checked)} style={{ width: 18, height: 18 }} />
              Active
            </label>

            {error && <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }} role="alert"><Icon name="alert" size={14} /> {error}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setEditing(null)} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
                Annuler
              </button>
              <button type="button" onClick={save} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
