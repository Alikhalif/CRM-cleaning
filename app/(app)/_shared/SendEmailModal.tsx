"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { DOC_TYPE_LABEL, type CrmDocument } from "@/lib/leads";
import { buildFinalInvoiceMessage } from "@/lib/templates";
import {
  TEMPLATE_CATEGORY_LABEL,
  renderTemplate,
} from "@/lib/message-templates-shared";
import type { MessageTemplate } from "@/lib/message-templates-server";
import {
  sendDocumentByEmail,
  type SendEmailInput,
  type Result,
} from "./document-actions";
// Reuse the planification modal stylesheet — same overlay/footer pattern.
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

type Props = {
  doc: CrmDocument;
  // Pre-fill values that need lead context — caller provides them since
  // CrmDocument alone doesn't carry the recipient.
  defaultRecipient: string;
  defaultRecipientName: string;
  entityName: string;
  // Role-scoped email templates + their interpolation vars. Optional — when
  // provided, a "Modèle" picker fills subject + message.
  emailTemplates?: MessageTemplate[];
  templateVars?: Record<string, string>;
  onClose: () => void;
  onDone: () => void;
};

export default function SendEmailModal({
  doc,
  defaultRecipient,
  defaultRecipientName,
  entityName,
  emailTemplates = [],
  templateVars = {},
  onClose,
  onDone,
}: Props) {
  // Facture finale gets a dedicated accompaniment template; other docs keep
  // the generic default. Both stay editable before send.
  const finaleTpl =
    doc.type === "finale"
      ? buildFinalInvoiceMessage({ clientName: defaultRecipientName, docNum: doc.num, entityName })
      : null;
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState(
    finaleTpl ? finaleTpl.subject : `${DOC_TYPE_LABEL[doc.type]} ${doc.num} — ${entityName}`,
  );
  const [message, setMessage] = useState(
    finaleTpl
      ? finaleTpl.message
      : `Bonjour ${defaultRecipientName || ""},

Veuillez trouver ci-joint ${doc.type === "devis" ? "notre devis" : "votre facture"} ${doc.num}.

N'hésitez pas à revenir vers nous pour toute question.

Cordialement,
${entityName}`,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = emailTemplates.find((x) => x.id === id);
    if (!t) return;
    if (t.subject) setSubject(renderTemplate(t.subject, templateVars));
    setMessage(renderTemplate(t.body, templateVars));
  };

  const firstInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload: SendEmailInput = { recipient, subject, message };
    const result: Result = await sendDocumentByEmail(doc.id, payload);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-email-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="send-email-title" className={styles.title}>
              Envoyer par email
            </h2>
            <p className={styles.subtitle}>
              {doc.num} · PDF joint, envoyé via Brevo
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className={styles.body}>
          {emailTemplates.length > 0 && (
            <label className={styles.field}>
              <span className={styles.label}>Modèle</span>
              <select
                className={styles.input}
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">— Choisir un modèle —</option>
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{TEMPLATE_CATEGORY_LABEL[t.category]}] {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Destinataire</span>
            <input
              ref={firstInputRef}
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
              className={styles.input}
              placeholder="client@exemple.fr"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Objet</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className={styles.input}
              required
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={submitting || !recipient}
          >
            {submitting ? "Envoi…" : "Envoyer"}
          </button>
        </footer>
      </form>
    </div>
  );
}
