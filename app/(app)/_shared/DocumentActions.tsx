"use client";

import { useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { CrmDocument } from "@/lib/leads";
import styles from "./DocumentView.module.scss";

// Action bar for the document view. Télécharger PDF triggers the browser
// print dialog (the page's print stylesheet hides chrome and lays out as A4).
// The other buttons stub their target endpoints in alerts — no persistence yet.

type Props = { doc: CrmDocument };

export default function DocumentActions({ doc }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const stub = (label: string, message: string) => {
    setBusy(label);
    setTimeout(() => {
      alert(message);
      setBusy(null);
    }, 0);
  };

  const isInvoice = doc.type !== "devis";
  const isPaid = doc.status === "paye";

  return (
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
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() =>
          stub("email", `Stub : POST /api/documents/${doc.id}/send (email vers le client).`)
        }
      >
        Envoyer par email
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() =>
          stub("dup", `Stub : POST /api/documents/${doc.id}/duplicate (nouveau brouillon).`)
        }
      >
        Dupliquer
      </button>
      {isInvoice && !isPaid && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSuccess}`}
          disabled={busy !== null}
          onClick={() =>
            stub(
              "paid",
              `Stub : POST /api/invoices/${doc.id}/mark-paid avec référence d'encaissement.`,
            )
          }
        >
          Marquer comme payée
        </button>
      )}
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() =>
          stub("regen", `Stub : POST /api/documents/${doc.id}/regenerate (re-génération PDF).`)
        }
      >
        Régénérer
      </button>
    </nav>
  );
}
