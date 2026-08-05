"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  INTERVENANT_RUBRIC_ORDER,
  INTERVENANT_RUBRIC_LABEL,
  TEMPLATE_CATEGORY_LABEL,
  leadTemplateVars,
  renderTemplate,
  type TemplateCategory,
} from "@/lib/message-templates-shared";
import type { MessageTemplate } from "@/lib/message-templates-server";
import type { DossierWithContext } from "@/lib/dossiers-shared";
import { sendIntervenantEmail } from "./actions";

type Props = {
  row: DossierWithContext;
  templates: MessageTemplate[];
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

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Envoi d'un mail de mission au sous-traitant. Les variables sont remplies
// automatiquement avec les données du dossier (nom, adresse, date/heure,
// secteur + étage/accès/volume/contexte via la découverte) — MAIS l'email et
// le téléphone du client sont volontairement vidés (jamais transmis).
export default function SendIntervenantModal({ row, templates, onClose }: Props) {
  const { lead, dossier, technician } = row;

  const vars = useMemo(() => {
    const planned = dossier.plannedAt ? new Date(dossier.plannedAt) : null;
    const v = leadTemplateVars(lead, {
      societeName: lead.entityName ?? undefined,
      clientAddress: [lead.address, lead.postalCode, lead.city].filter(Boolean).join(", ") || lead.city || "",
      interventionDate: planned ? DATE.format(planned) : "",
      interventionHeure: planned ? HEURE.format(planned) : "",
    });
    v["client.email"] = "";      // jamais transmis à l'intervenant
    v["client.telephone"] = "";  // jamais transmis à l'intervenant
    return v;
  }, [lead, dossier.plannedAt]);

  // Regroupe les modèles par rubrique, dans l'ordre chronologique du cycle de
  // mission (Consultation → … → Clôture), chaque rubrique triée par sort_order.
  const grouped = useMemo(() => {
    const order = (c: TemplateCategory) => {
      const i = INTERVENANT_RUBRIC_ORDER.indexOf(c);
      return i === -1 ? INTERVENANT_RUBRIC_ORDER.length : i;
    };
    const byCat = new Map<TemplateCategory, MessageTemplate[]>();
    for (const t of templates) {
      const arr = byCat.get(t.category) ?? [];
      arr.push(t);
      byCat.set(t.category, arr);
    }
    return [...byCat.entries()]
      .sort((a, b) => order(a[0]) - order(b[0]))
      .map(([cat, list]) => ({
        cat,
        label: INTERVENANT_RUBRIC_LABEL[cat] ?? TEMPLATE_CATEGORY_LABEL[cat],
        list: [...list].sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name)),
      }));
  }, [templates]);

  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState(technician?.email ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (t.subject) setSubject(renderTemplate(t.subject, vars));
    setBody(renderTemplate(t.body, vars));
  };

  const send = async () => {
    if (!recipient.trim() || !subject.trim() || !body.trim()) return;
    setError(null);
    setSending(true);
    const res = await sendIntervenantEmail(dossier.id, { recipient: recipient.trim(), subject: subject.trim(), message: body });
    setSending(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
    >
      <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="mail" size={16} /> Envoyer à l&apos;intervenant — {lead.client}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: -6 }}>
          Auto-rempli avec les infos du dossier (adresse, étage, accès, volume…).
          L&apos;email et le téléphone du client ne sont jamais transmis.
        </p>

        {done ? (
          <p style={{ color: "var(--tone-success)", fontWeight: 600 }}>
            <Icon name="check" size={16} /> Email envoyé à l&apos;intervenant.
            <button type="button" onClick={onClose} style={{ marginLeft: 12, ...inp, width: "auto", cursor: "pointer", padding: "4px 12px" }}>Fermer</button>
          </p>
        ) : (
          <>
            <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Modèle
              <select style={inp} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">— Choisir un modèle —</option>
                {grouped.map((g) => (
                  <optgroup key={g.cat} label={g.label}>
                    {g.list.map((t) => (
                      <option key={t.id} value={t.id}>{t.name.replace(/^Intervenant — /, "")}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Email intervenant
              <input style={inp} type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="intervenant@exemple.fr" />
              {!technician && (
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--tone-warning)", marginTop: 2 }}>
                  Aucun intervenant assigné à ce dossier — saisissez l&apos;email manuellement.
                </span>
              )}
              {technician && !technician.email && (
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--tone-warning)", marginTop: 2 }}>
                  {technician.name} n&apos;a pas d&apos;email enregistré — saisissez-le.
                </span>
              )}
            </label>

            <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Objet
              <input style={inp} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet de l'email" />
            </label>

            <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Message
              <textarea style={{ ...inp, minHeight: 200, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Choisissez un modèle ou rédigez…" />
            </label>

            {templates.length === 0 && (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Aucun modèle intervenant. Créez-en dans Paramètres → Templates (destinataire « Intervenant »).
              </p>
            )}
            {error && <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }} role="alert"><Icon name="alert" size={14} /> {error}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={onClose} disabled={sending} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={send} disabled={sending || !recipient.trim() || !subject.trim() || !body.trim()} style={{ padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: sending ? 0.7 : 1 }}>
                <Icon name="check" size={14} /> {sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
