"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon/Icon";
import { canLaunchSequence, type Lead } from "@/lib/leads";
import styles from "./LeadDetail.module.scss";

// Action buttons for the lead detail header. All handlers are stubs — they
// confirm intent and surface what they *would* do once Supabase + n8n are
// wired. None of them mutate persisted state today.

type Props = { lead: Lead };

export default function LeadActions({ lead }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const stub = (action: string, message: string) => {
    setBusy(action);
    // Yield to the browser so the button transition is visible before the alert blocks.
    setTimeout(() => {
      alert(message);
      setBusy(null);
    }, 0);
  };

  const onLaunch = () => {
    if (
      !confirm(
        `Lancer la séquence de relance n8n pour « ${lead.client} » ?\n\n` +
          "4 emails Brevo seront programmés. La séquence s'arrête dès que le client signe ou répond.",
      )
    )
      return;
    stub("sequence", "Stub : POST /webhook/relance-devis vers n8n.");
  };

  const onLost = () => {
    if (!confirm("Marquer ce lead comme perdu ?")) return;
    stub("lost", "Stub : PATCH /api/leads/{id} status=perdu.");
  };

  const eligible = canLaunchSequence(lead);
  const closed = lead.status === "encaisse" || lead.status === "perdu";

  return (
    <div className={styles.actions}>
      {!closed && (
        <Link
          href={`/devis/new?lead=${lead.id}`}
          className={`${styles.btn} ${styles.btnPrimary}`}
          aria-disabled={busy !== null}
        >
          <Icon name="check" size={14} /> Générer devis
        </Link>
      )}
      {eligible && (
        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={onLaunch}
        >
          <Icon name="zap" size={14} /> Lancer séquence
        </button>
      )}
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() => stub("edit", "Stub : modale d'édition des coordonnées.")}
      >
        Modifier coordonnées
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() => stub("reassign", "Stub : modale de réassignation à un autre commercial.")}
      >
        Réassigner
      </button>
      {!closed && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={busy !== null}
          onClick={onLost}
        >
          <Icon name="x" size={14} /> Marquer perdu
        </button>
      )}
    </div>
  );
}
