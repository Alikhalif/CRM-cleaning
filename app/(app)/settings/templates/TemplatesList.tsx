"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
  TEMPLATE_CHANNELS,
  TEMPLATE_CHANNEL_LABEL,
  TEMPLATE_VARIABLES,
} from "@/lib/message-templates-shared";
import type { MessageTemplate } from "@/lib/message-templates-server";
import { createTemplate, updateTemplate, deleteTemplate, type TemplateInput, type Result } from "./actions";

type Props = { templates: MessageTemplate[]; sectors: { id: string; label: string }[] };

const empty: TemplateInput = {
  channel: "sms",
  category: "relance",
  name: "",
  subject: "",
  body: "",
  activityId: "",
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
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle" };
const lbl: React.CSSProperties = { fontSize: "0.8125rem", color: "var(--text-muted)", display: "block" };

export default function TemplatesList({ templates, sectors }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; input: TemplateInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const openNew = () => { setError(null); setEditing({ id: null, input: { ...empty } }); };
  const openEdit = (t: MessageTemplate) => {
    setError(null);
    setEditing({
      id: t.id,
      input: {
        channel: t.channel,
        category: t.category,
        name: t.name,
        subject: t.subject ?? "",
        body: t.body,
        activityId: t.activityId ?? "",
        isActive: t.isActive,
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
    run(() => (id ? updateTemplate(id, input) : createTemplate(input)), () => setEditing(null));
  };

  const remove = (t: MessageTemplate) => {
    if (!confirm(`Supprimer le template « ${t.name} » ?`)) return;
    run(() => deleteTemplate(t.id));
  };

  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) =>
    setEditing((e) => (e ? { ...e, input: { ...e.input, [k]: v } } : e));

  // Insert a {variable} at the caret in the body textarea.
  const insertVar = (key: string) => {
    const token = `{${key}}`;
    const ta = bodyRef.current;
    if (!ta || !editing) { set("body", (editing?.input.body ?? "") + token); return; }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const next = ta.value.slice(0, start) + token + ta.value.slice(end);
    set("body", next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const isSms = editing?.input.channel === "sms";
  const smsLen = editing?.input.body.length ?? 0;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", padding: "8px 4px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px" }}>
        <button type="button" onClick={openNew} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          + Nouveau template
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
              <th style={th}>Canal</th>
              <th style={th}>Catégorie</th>
              <th style={th}>Nom</th>
              <th style={th}>Secteur</th>
              <th style={th}>Active</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td style={td}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: t.channel === "sms" ? "color-mix(in srgb, var(--color-brand-500) 14%, transparent)" : "var(--bg-surface-2)", color: t.channel === "sms" ? "var(--color-brand-500)" : "var(--text-secondary, var(--text-muted))" }}>
                    {TEMPLATE_CHANNEL_LABEL[t.channel]}
                  </span>
                </td>
                <td style={td}>{TEMPLATE_CATEGORY_LABEL[t.category]}</td>
                <td style={{ ...td, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</td>
                <td style={td}>{t.activityLabel ?? "Tous"}</td>
                <td style={td}>{t.isActive ? "✅" : "—"}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" onClick={() => openEdit(t)} style={{ background: "none", border: "none", color: "var(--color-brand-500)", cursor: "pointer", marginRight: 10 }}>
                    Modifier
                  </button>
                  <button type="button" onClick={() => remove(t)} style={{ background: "none", border: "none", color: "var(--tone-danger)", cursor: "pointer" }}>
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: "var(--text-muted)" }}>Aucun template.</td></tr>
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
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {editing.id ? "Modifier le template" : "Nouveau template"}
            </h2>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>
                <span style={lbl}>Canal</span>
                <select style={inp} value={editing.input.channel} onChange={(e) => set("channel", e.target.value as TemplateInput["channel"])}>
                  {TEMPLATE_CHANNELS.map((c) => <option key={c} value={c}>{TEMPLATE_CHANNEL_LABEL[c]}</option>)}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <span style={lbl}>Catégorie</span>
                <select style={inp} value={editing.input.category} onChange={(e) => set("category", e.target.value as TemplateInput["category"])}>
                  {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{TEMPLATE_CATEGORY_LABEL[c]}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 2 }}>
                <span style={lbl}>Nom (interne)</span>
                <input style={inp} value={editing.input.name} onChange={(e) => set("name", e.target.value)} placeholder="Relance 1" />
              </label>
              <label style={{ flex: 1 }}>
                <span style={lbl}>Secteur</span>
                <select style={inp} value={editing.input.activityId} onChange={(e) => set("activityId", e.target.value)}>
                  <option value="">Tous</option>
                  {sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {!isSms && (
              <label>
                <span style={lbl}>Sujet (email)</span>
                <input style={inp} value={editing.input.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Votre devis {lead.type_service}" />
              </label>
            )}

            <label>
              <span style={lbl}>
                Corps du message{isSms && <span style={{ float: "right", color: smsLen > 160 ? "var(--tone-danger)" : "var(--text-muted)" }}>{smsLen} car. · {Math.max(1, Math.ceil(smsLen / 160))} SMS</span>}
              </span>
              <textarea
                ref={bodyRef}
                style={{ ...inp, minHeight: 130, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                value={editing.input.body}
                onChange={(e) => set("body", e.target.value)}
                placeholder="Bonjour {client.prenom}, …"
              />
            </label>

            <div>
              <span style={{ ...lbl, marginBottom: 4 }}>Insérer une variable :</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    title={v.label}
                    style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary, var(--text-muted))", fontSize: "0.75rem", fontFamily: "var(--font-mono, ui-monospace, monospace)", cursor: "pointer" }}
                  >
                    {"{"}{v.key}{"}"}
                  </button>
                ))}
              </div>
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
