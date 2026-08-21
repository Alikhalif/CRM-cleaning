"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { Lead } from "@/lib/leads";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
  renderTemplate,
  type TemplateCategory,
} from "@/lib/message-templates-shared";
import type { MessageTemplate } from "@/lib/message-templates-server";
import { sendLeadRelanceEmail } from "@/app/(app)/pipeline/actions";

type Props = {
  lead: Lead;
  templates: MessageTemplate[];
  // Variables réelles (BDD) résolues côté serveur.
  vars: Record<string, string>;
  // Objet / corps pré-remplis (ex. bouton « Email NRP »).
  initialSubject?: string;
  initialBody?: string;
  // Titre de la modale (défaut « Relance par email »).
  heading?: string;
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

// "Relance par email" — mirror of SmsModal but for email (Brevo). Same
// role-scoped template picker + variable interpolation; adds subject +
// recipient. Sends via the sendLeadRelanceEmail server action.
export default function EmailModal({ lead, templates, vars, initialSubject, initialBody, heading, onClose }: Props) {
  const router = useRouter();

  // Ne garder que les templates globaux ou ciblant le secteur du lead.
  const eligible = useMemo(
    () => templates.filter((t) => !t.activitySlug || t.activitySlug === lead.sector),
    [templates, lead.sector],
  );

  // Regroupe par rubrique (catégorie) dans l'ordre du parcours métier, chaque
  // rubrique triée par sort_order — sélecteur structuré en optgroups.
  const grouped = useMemo(() => {
    const order = (c: TemplateCategory) => {
      const i = TEMPLATE_CATEGORIES.indexOf(c);
      return i === -1 ? TEMPLATE_CATEGORIES.length : i;
    };
    const byCat = new Map<TemplateCategory, MessageTemplate[]>();
    for (const t of eligible) {
      const arr = byCat.get(t.category) ?? [];
      arr.push(t);
      byCat.set(t.category, arr);
    }
    return [...byCat.entries()]
      .sort((a, b) => order(a[0]) - order(b[0]))
      .map(([cat, list]) => ({
        cat,
        label: TEMPLATE_CATEGORY_LABEL[cat],
        list: [...list].sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name)),
      }));
  }, [eligible]);

  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState(lead.email ?? "");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = eligible.find((x) => x.id === id);
    if (!t) return;
    if (t.subject) setSubject(renderTemplate(t.subject, vars));
    setBody(renderTemplate(t.body, vars));
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) return;
    setError(null);
    setSending(true);
    const res = await sendLeadRelanceEmail(lead.id, {
      recipient: recipient.trim(),
      subject: subject.trim(),
      message: body,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
    >
      <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="mail" size={16} /> {heading ?? "Relance par email"} — {lead.client}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: -6 }}>
          Envoyé via Brevo. Choisissez un modèle ou rédigez librement.
        </p>

        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Modèle
          <select style={inp} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Choisir un modèle —</option>
            {grouped.map((g) => (
              <optgroup key={g.cat} label={g.label}>
                {g.list.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Destinataire
          <input style={inp} type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@exemple.fr" />
        </label>

        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Objet
          <input style={inp} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet de l'email" />
        </label>

        <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Message
          <textarea
            style={{ ...inp, minHeight: 160, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Rédigez votre message ou choisissez un modèle…"
          />
        </label>

        {eligible.length === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Aucun modèle email pour votre profil. Créez-en dans Paramètres → Templates.
          </p>
        )}

        {error && (
          <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }} role="alert">
            <Icon name="alert" size={14} /> {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={sending} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
            Annuler
          </button>
          <button type="button" onClick={send} disabled={sending || !subject.trim() || !body.trim()} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: (subject.trim() && body.trim()) ? "pointer" : "default", opacity: (subject.trim() && body.trim()) ? 1 : 0.6 }}>
            <Icon name="check" size={14} /> {sending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
