"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import { canLaunchSequence, type Commercial, type Lead } from "@/lib/leads";
import { setLeadNrp } from "@/app/(app)/pipeline/actions";
import EditContactModal from "./EditContactModal";
import MarkLostModal from "./MarkLostModal";
import ReassignLeadModal from "./ReassignLeadModal";
import styles from "./LeadDetail.module.scss";

// Action buttons for the lead detail header. All handlers are stubs — they
// confirm intent and surface what they *would* do once Supabase + n8n are
// wired. None of them mutate persisted state today.

type Props = { lead: Lead; commerciaux: Commercial[] };

export default function LeadActions({ lead, commerciaux }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const onToggleNrp = () => {
    setBusy("nrp");
    startTransition(async () => {
      const result = await setLeadNrp(lead.id, !lead.isNrp);
      setBusy(null);
      if (!result.ok) {
        alert(`Échec de la mise à jour : ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

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

  const onLostDone = () => {
    setLostModalOpen(false);
    router.refresh();
  };

  const onContactDone = () => {
    setContactModalOpen(false);
    router.refresh();
  };

  const onReassignDone = () => {
    setReassignModalOpen(false);
    router.refresh();
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
        className={`${styles.btn} ${lead.isNrp ? styles.btnNrpOn : ""}`}
        disabled={busy !== null}
        onClick={onToggleNrp}
        title={lead.isNrp ? "Retirer le marqueur NRP" : "Marquer comme ne répondant pas"}
      >
        {busy === "nrp" ? "…" : lead.isNrp ? "Retirer NRP" : "Marquer NRP"}
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() => setContactModalOpen(true)}
      >
        Modifier coordonnées
      </button>
      <button
        type="button"
        className={styles.btn}
        disabled={busy !== null}
        onClick={() => setReassignModalOpen(true)}
      >
        Réassigner
      </button>
      {!closed && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={busy !== null}
          onClick={() => setLostModalOpen(true)}
        >
          <Icon name="x" size={14} /> Marquer perdu
        </button>
      )}

      {lostModalOpen && (
        <MarkLostModal
          lead={lead}
          onClose={() => setLostModalOpen(false)}
          onDone={onLostDone}
        />
      )}

      {contactModalOpen && (
        <EditContactModal
          lead={lead}
          onClose={() => setContactModalOpen(false)}
          onDone={onContactDone}
        />
      )}

      {reassignModalOpen && (
        <ReassignLeadModal
          lead={lead}
          commerciaux={commerciaux}
          onClose={() => setReassignModalOpen(false)}
          onDone={onReassignDone}
        />
      )}
    </div>
  );
}
