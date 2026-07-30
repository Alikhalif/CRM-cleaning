"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { Lead } from "@/lib/leads";
import {
  TEMPLATE_CATEGORY_LABEL,
  leadTemplateVars,
  renderTemplate,
} from "@/lib/message-templates-shared";
import type { MessageTemplate } from "@/lib/message-templates-server";
import { sendSmsViaWebphone } from "@/lib/ringover-webphone";

type Props = {
  lead: Lead;
  templates: MessageTemplate[];
  commercialName: string;
  onClose: () => void;
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

export default function SmsModal({ lead, templates, commercialName, onClose }: Props) {
  const vars = useMemo(
    () => leadTemplateVars(lead, { commercialName, societeName: lead.entityName ?? undefined }),
    [lead, commercialName],
  );

  // Ne garder que les templates globaux ou ciblant le secteur du lead.
  const eligible = useMemo(
    () => templates.filter((t) => !t.activitySlug || t.activitySlug === lead.sector),
    [templates, lead.sector],
  );

  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = eligible.find((x) => x.id === id);
    if (t) setBody(renderTemplate(t.body, vars));
  };

  const send = () => {
    const content = body.trim();
    if (!content) return;
    if (!lead.phone) { alert("Ce lead n'a pas de numéro de téléphone."); return; }
    sendSmsViaWebphone(lead.phone, content);
    onClose();
  };

  const len = body.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
    >
      <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="phone" size={16} /> SMS à {lead.client}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: -6 }}>
          Envoyé via Ringover vers <strong>{lead.phone ?? "—"}</strong>.
        </p>

        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Template
          <select style={inp} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Choisir un template —</option>
            {eligible.map((t) => (
              <option key={t.id} value={t.id}>
                [{TEMPLATE_CATEGORY_LABEL[t.category]}] {t.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          <span>
            Message
            <span style={{ float: "right", color: len > 160 ? "var(--tone-danger)" : "var(--text-muted)" }}>
              {len} car. · {Math.max(1, Math.ceil(len / 160))} SMS
            </span>
          </span>
          <textarea
            style={{ ...inp, minHeight: 120, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Rédigez votre message ou choisissez un template…"
          />
        </label>

        {eligible.length === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Aucun template SMS pour ce secteur. Créez-en dans Paramètres → Templates.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
            Annuler
          </button>
          <button type="button" onClick={send} disabled={!body.trim()} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: body.trim() ? "pointer" : "default", opacity: body.trim() ? 1 : 0.6 }}>
            <Icon name="check" size={14} /> Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
