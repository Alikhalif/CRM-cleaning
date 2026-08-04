"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { SubSignatureMode } from "@/lib/leads";
import { markDocumentSigned, type MarkSignedResult } from "./document-actions";
// Reuses the shared planification modal SCSS (overlay/card/footer pattern).
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

// Two-way signature capture (call 2026-08-02). A devis can be signed:
//   1. logiciel      — via the e-signature software (client signs online)
//   2. planificateur — marked signed manually by the planner (who now holds
//                      the power to move a lead to « signé »)
// The chosen mode is stored on the lead (sub_signature_mode) for analytics.
// Either way, signing generates the acompte and creates the dossier.

type Props = {
  docId: string;
  docNum: string;
  acomptePct?: number | null;
  onClose: () => void;
  onSigned: (result: MarkSignedResult) => void;
};

const OPTIONS: {
  mode: SubSignatureMode;
  title: string;
  desc: string;
  icon: "document" | "planification";
}[] = [
  {
    mode: "logiciel",
    title: "Via le logiciel de signature",
    desc: "Signature électronique — le client a signé en ligne.",
    icon: "document",
  },
  {
    mode: "planificateur",
    title: "Par le/la planificateur·rice",
    desc: "Accord confirmé — le/la planificateur·rice enregistre la signature.",
    icon: "planification",
  },
];

export default function MarkSignedModal({ docId, docNum, acomptePct, onClose, onSigned }: Props) {
  const [submitting, setSubmitting] = useState<SubSignatureMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const choose = async (mode: SubSignatureMode) => {
    setError(null);
    setSubmitting(mode);
    const result = await markDocumentSigned(docId, mode);
    if (!result.ok) {
      setSubmitting(null);
      setError(result.error);
      return;
    }
    onSigned(result);
  };

  const hasAcompte = !!acomptePct && acomptePct > 0;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-signed-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h2 id="mark-signed-title" className={styles.title}>
              Marquer le devis signé
            </h2>
            <p className={styles.subtitle}>
              {docNum} — comment la signature a-t-elle été obtenue&nbsp;?
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={submitting !== null}
            aria-label="Fermer"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className={styles.body}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => choose(opt.mode)}
                disabled={submitting !== null}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-surface)",
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting && submitting !== opt.mode ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: "999px",
                    background: "var(--tone-success-bg, rgba(34,197,94,0.12))",
                    color: "var(--tone-success)",
                  }}
                >
                  <Icon name={opt.icon} size={18} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, color: "var(--text-primary)" }}>
                    {submitting === opt.mode ? "Signature…" : opt.title}
                  </span>
                  <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {opt.desc}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {hasAcompte && (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 12 }}>
              Une facture d&apos;acompte ({acomptePct}%) sera générée automatiquement,
              et le dossier apparaîtra en Planification.
            </p>
          )}
          {!hasAcompte && (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 12 }}>
              Le dossier apparaîtra en Planification.
            </p>
          )}

          {error && (
            <p className={styles.error} role="alert" style={{ marginTop: 10 }}>
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onClose}
            disabled={submitting !== null}
          >
            Annuler
          </button>
        </footer>
      </div>
    </div>
  );
}
