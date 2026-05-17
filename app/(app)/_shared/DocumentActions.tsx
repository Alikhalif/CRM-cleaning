"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import type { CrmDocument } from "@/lib/leads";
import {
  duplicateDocument,
  markDocumentPaid,
  markDocumentSent,
} from "./document-actions";
import styles from "./DocumentView.module.scss";

// Action bar for the document view.
// - "Télécharger PDF" still uses window.print (the page's print stylesheet
//   lays out as A4 and hides chrome) — no signed-URL PDF route yet.
// - "Envoyer par email" + "Régénérer" stay stubs (need Brevo + a PDF
//   rendering layer respectively).
// - "Marquer envoyé", "Marquer payée", "Dupliquer" are real.

type Props = { doc: CrmDocument };

export default function DocumentActions({ doc }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stub = (label: string, message: string) => {
    setBusy(label);
    setTimeout(() => {
      alert(message);
      setBusy(null);
    }, 0);
  };

  const run = (label: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(label);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const onMarkSent = () => run("sent", () => markDocumentSent(doc.id));
  const onMarkPaid = () => {
    if (!confirm(`Marquer la facture ${doc.num} comme payée ?`)) return;
    run("paid", () => markDocumentPaid(doc.id));
  };
  const onDuplicate = () => {
    setError(null);
    setBusy("dup");
    startTransition(async () => {
      const result = await duplicateDocument(doc.id);
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Navigate to the freshly duplicated doc so the user can edit it.
      const href = doc.type === "devis" ? `/devis/${result.id}` : `/factures/${result.id}`;
      router.push(href);
    });
  };

  const isDevisDraft = doc.type === "devis" && doc.status === "brouillon";
  const isInvoice = doc.type !== "devis";
  const isPaid = doc.status === "paye";

  return (
    <>
      <nav className={styles.actions} aria-label="Actions document" data-no-print>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={busy !== null}
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
        >
          <Icon name="check" size={14} /> Télécharger PDF
        </button>

        {isDevisDraft && (
          <button
            type="button"
            className={styles.btn}
            disabled={busy !== null}
            onClick={onMarkSent}
          >
            {busy === "sent" ? "Envoi…" : "Marquer envoyé"}
          </button>
        )}

        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={() =>
            stub("email", `Stub : POST /api/documents/${doc.id}/send (Brevo — pas encore wired).`)
          }
        >
          Envoyer par email
        </button>

        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={onDuplicate}
        >
          {busy === "dup" ? "Duplication…" : "Dupliquer"}
        </button>

        {isInvoice && !isPaid && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSuccess}`}
            disabled={busy !== null}
            onClick={onMarkPaid}
          >
            {busy === "paid" ? "Mise à jour…" : "Marquer payée"}
          </button>
        )}

        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={() =>
            stub("regen", `Stub : POST /api/documents/${doc.id}/regenerate (PDF — pas encore wired).`)
          }
        >
          Régénérer
        </button>
      </nav>

      {error && (
        <p className={styles.errorBanner} role="alert" data-no-print>
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </>
  );
}
