"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { TechnicianAdmin } from "@/lib/technicians-server";
import {
  createTechnician,
  updateTechnician,
  toggleTechnicianActive,
  type TechnicianInput,
  type Result,
} from "./actions";

type Props = { technicians: TechnicianAdmin[]; sectors: { id: string; label: string }[] };

const empty: TechnicianInput = {
  name: "", email: "", initials: "", color: "#5b4bcc",
  sectorIds: [], basePostalCode: "", serviceDepartments: [], isActive: true,
};

const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem",
};
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle" };
const lbl: React.CSSProperties = { fontSize: "0.8125rem", color: "var(--text-muted)", display: "block" };

export default function TechniciansList({ technicians, sectors }: Props) {
  const router = useRouter();
  const sectorLabel = new Map(sectors.map((s) => [s.id, s.label]));
  const [editing, setEditing] = useState<{ id: string | null; input: TechnicianInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const openNew = () => { setError(null); setEditing({ id: null, input: { ...empty } }); };
  const openEdit = (t: TechnicianAdmin) => {
    setError(null);
    setEditing({
      id: t.id,
      input: {
        name: t.name, email: t.email ?? "", initials: t.initials, color: t.color,
        sectorIds: t.sectorIds, basePostalCode: t.basePostalCode ?? "",
        serviceDepartments: t.serviceDepartments, isActive: t.isActive,
      },
    });
  };

  const run = (fn: () => Promise<Result>, onOk?: () => void) => {
    setError(null); setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      onOk?.(); router.refresh();
    });
  };

  const save = () => {
    if (!editing) return;
    const { id, input } = editing;
    run(() => (id ? updateTechnician(id, input) : createTechnician(input)), () => setEditing(null));
  };

  const set = <K extends keyof TechnicianInput>(k: K, v: TechnicianInput[K]) =>
    setEditing((e) => (e ? { ...e, input: { ...e.input, [k]: v } } : e));

  const toggleSector = (id: string) =>
    setEditing((e) => e ? { ...e, input: { ...e.input, sectorIds: e.input.sectorIds.includes(id) ? e.input.sectorIds.filter((x) => x !== id) : [...e.input.sectorIds, id] } } : e);

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", padding: "8px 4px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px" }}>
        <button type="button" onClick={openNew} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          + Nouvel intervenant
        </button>
      </div>

      {error && !editing && (
        <p style={{ color: "var(--tone-danger)", padding: "8px 12px", fontSize: "0.875rem" }} role="alert"><Icon name="alert" size={14} /> {error}</p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
          <thead>
            <tr>
              <th style={th}>Intervenant</th>
              <th style={th}>Email</th>
              <th style={th}>Secteurs</th>
              <th style={th}>Départements</th>
              <th style={th}>Actif</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {technicians.map((t) => (
              <tr key={t.id} style={{ opacity: t.isActive ? 1 : 0.55 }}>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: t.color, color: "#fff", fontSize: 11, fontWeight: 700 }}>{t.initials}</span>
                    <strong style={{ color: "var(--text-primary)" }}>{t.name}</strong>
                  </span>
                </td>
                <td style={td}>{t.email ?? <span style={{ color: "var(--tone-warning)" }}>— manquant</span>}</td>
                <td style={td}>{t.sectorIds.map((id) => sectorLabel.get(id) ?? "?").join(", ") || "—"}</td>
                <td style={td}>{t.serviceDepartments.join(", ") || "—"}</td>
                <td style={td}>
                  <button type="button" onClick={() => run(() => toggleTechnicianActive(t.id, !t.isActive))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}>
                    {t.isActive ? "✅" : "—"}
                  </button>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button type="button" onClick={() => openEdit(t)} style={{ background: "none", border: "none", color: "var(--color-brand-500)", cursor: "pointer" }}>Modifier</button>
                </td>
              </tr>
            ))}
            {technicians.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: "var(--text-muted)" }}>Aucun intervenant.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !busy) setEditing(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>{editing.id ? "Modifier l'intervenant" : "Nouvel intervenant"}</h2>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 2 }}><span style={lbl}>Nom</span>
                <input style={inp} value={editing.input.name} onChange={(e) => set("name", e.target.value)} placeholder="Entreprise / Nom" />
              </label>
              <label style={{ flex: 1 }}><span style={lbl}>Initiales</span>
                <input style={inp} value={editing.input.initials} onChange={(e) => set("initials", e.target.value)} placeholder="auto" maxLength={3} />
              </label>
              <label style={{ width: 64 }}><span style={lbl}>Couleur</span>
                <input type="color" style={{ ...inp, padding: 2, height: 38 }} value={editing.input.color} onChange={(e) => set("color", e.target.value)} />
              </label>
            </div>

            <label><span style={lbl}>Email (pour les mails de mission)</span>
              <input style={inp} type="email" value={editing.input.email} onChange={(e) => set("email", e.target.value)} placeholder="intervenant@exemple.fr" />
            </label>

            <div>
              <span style={{ ...lbl, marginBottom: 4 }}>Secteurs d&apos;intervention</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sectors.map((s) => {
                  const on = editing.input.sectorIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSector(s.id)}
                      style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${on ? "var(--color-brand-500)" : "var(--border-strong)"}`, background: on ? "color-mix(in srgb, var(--color-brand-500) 16%, transparent)" : "transparent", color: on ? "var(--color-brand-500)" : "var(--text-secondary, var(--text-muted))", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                      {on ? "✓ " : ""}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}><span style={lbl}>Code postal (dépôt)</span>
                <input style={inp} value={editing.input.basePostalCode} onChange={(e) => set("basePostalCode", e.target.value)} placeholder="74100" />
              </label>
              <label style={{ flex: 2 }}><span style={lbl}>Départements couverts (séparés par virgule)</span>
                <input style={inp} value={editing.input.serviceDepartments.join(", ")} onChange={(e) => set("serviceDepartments", e.target.value.split(",").map((d) => d.trim()).filter(Boolean))} placeholder="74, 73, 01" />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "var(--text-primary)" }}>
              <input type="checkbox" checked={editing.input.isActive} onChange={(e) => set("isActive", e.target.checked)} style={{ width: 18, height: 18 }} /> Actif
            </label>

            {error && <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }} role="alert"><Icon name="alert" size={14} /> {error}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setEditing(null)} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={save} disabled={busy} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
