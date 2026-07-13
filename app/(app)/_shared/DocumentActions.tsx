"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import type { CrmDocument, Lead, LegalEntity } from "@/lib/leads";
import {
  duplicateDocument,
  markDocumentPaid,
  markDocumentSent,
  markDocumentSigned,
} from "./document-actions";
import MarkRefusedModal from "./MarkRefusedModal";
import SendEmailModal from "./SendEmailModal";
import styles from "./DocumentView.module.scss";

// Action bar for the document view. Every button is real — "Aperçu PDF"
// streams from the server-rendered PDF route, "Envoyer par email" pushes
// through Brevo with the PDF attached.
//
// `?send=1` query param auto-opens the SendEmailModal — used by the
// Comptabilité row menu to deep-link straight into the send flow.

type Props = { doc: CrmDocument; lead: Lead; entity: LegalEntity };

export default function DocumentActions({ doc, lead, entity }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Auto-open the send modal when arriving via /?send=1 (the Comptabilité
  // row menu links here). One-shot — clears the param after opening so a
  // page refresh doesn't re-open the modal forever.
  const [emailOpen, setEmailOpen] = useState(() => searchParams.get("send") === "1");
  const [refusedOpen, setRefusedOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (searchParams.get("send") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("send");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

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
  const onMarkSigned = () => {
    const msg =
      doc.acomptePct && doc.acomptePct > 0
        ? `Marquer le devis ${doc.num} comme signé ?\n\nUne facture d'acompte (${doc.acomptePct}%) sera générée automatiquement.`
        : `Marquer le devis ${doc.num} comme signé ?`;
    if (!confirm(msg)) return;
    setError(null);
    setBusy("signed");
    startTransition(async () => {
      const result = await markDocumentSigned(doc.id);
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // If an acompte was created, deep-link to it so the planificatrice can
      // see it immediately. Otherwise just refresh.
      if (result.acompteId) {
        router.push(`/factures/${result.acompteId}`);
        return;
      }
      router.refresh();
    });
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
  // Sign is meaningful when the devis has been sent/opened but not yet
  // signed/refused — the same window during which the client can still act.
  const canSign =
    doc.type === "devis" && (doc.status === "envoye" || doc.status === "ouvert");
  // Refusal is only meaningful on a devis that hasn't been signed/refused already.
  const canRefuse = doc.type === "devis" && doc.status !== "signe" && doc.status !== "refuse";
  // Once refused, offer the cheaper re-quote flow (call 2026-06-10): seed a new
  // devis from this one so the commercial switches société and lowers the price.
  const isRefusedDevis = doc.type === "devis" && doc.status === "refuse";

  return (
    <>
      <nav className={styles.actions} aria-label="Actions document" data-no-print>
        <a
          href={`/api/documents/${doc.id}/preview-pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.btn} ${styles.btnPrimary}`}
          aria-disabled={busy !== null}
        >
          <Icon name="check" size={14} /> Aperçu PDF
        </a>

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
          onClick={() => setEmailOpen(true)}
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

        {canSign && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSuccess}`}
            disabled={busy !== null}
            onClick={onMarkSigned}
            title={
              doc.acomptePct && doc.acomptePct > 0
                ? `Signature + génération auto de la facture d'acompte (${doc.acomptePct}%)`
                : "Marquer le devis comme signé"
            }
          >
            <Icon name="check" size={14} />
            {busy === "signed" ? "Signature…" : "Marquer signé"}
          </button>
        )}

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

        {canRefuse && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy !== null}
            onClick={() => setRefusedOpen(true)}
          >
            Marquer refusé
          </button>
        )}

        {isRefusedDevis && (
          <Link
            href={`/devis/new?from=${doc.id}`}
            className={`${styles.btn} ${styles.btnPrimary}`}
            title="Créer un nouveau devis moins cher (autre société), lignes reprises"
          >
            <Icon name="check" size={14} /> Renvoyer moins cher
          </Link>
        )}

      </nav>

      {error && (
        <p className={styles.errorBanner} role="alert" data-no-print>
          <Icon name="alert" size={14} /> {error}
        </p>
      )}

      {emailOpen && (
        <SendEmailModal
          doc={doc}
          defaultRecipient={lead.email}
          defaultRecipientName={lead.client}
          entityName={entity.legalName}
          onClose={() => setEmailOpen(false)}
          onDone={() => {
            setEmailOpen(false);
            router.refresh();
          }}
        />
      )}

      {refusedOpen && (
        <MarkRefusedModal
          docId={doc.id}
          docNum={doc.num}
          onClose={() => setRefusedOpen(false)}
          onDone={() => {
            setRefusedOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
