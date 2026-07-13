"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import { canLaunchSequence, type Commercial, type Lead } from "@/lib/leads";
import { callLead, launchSequence, setLeadNrp, stopAutoSequence } from "@/app/(app)/pipeline/actions";
import EditContactModal from "./EditContactModal";
import MarkLostModal from "./MarkLostModal";
import ReassignLeadModal from "./ReassignLeadModal";
import styles from "./LeadDetail.module.scss";

// Action buttons for the lead detail header.

type Props = { lead: Lead; commerciaux: Commercial[]; n8nEnabled: boolean };

export default function LeadActions({ lead, commerciaux, n8nEnabled }: Props) {
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

  const onCall = () => {
    if (!lead.phone) {
      alert("Ce lead n'a pas de numéro de téléphone.");
      return;
    }
    if (!confirm(`Lancer un appel vers ${lead.phone} via Ringover ?`)) return;
    setBusy("call");
    startTransition(async () => {
      const result = await callLead(lead.id);
      setBusy(null);
      if (!result.ok) {
        alert(`Échec de l'appel : ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const onLaunchAuto = () => {
    if (
      !confirm(
        `Activer le mode automatique pour « ${lead.client} » ?\n\n` +
          "4 emails Brevo seront enchaînés via n8n (J+0, J+1, J+4, J+9). " +
          "La séquence s'arrête dès que le client signe, refuse, ou que vous repassez en mode manuel.",
      )
    )
      return;
    setBusy("auto");
    startTransition(async () => {
      const result = await launchSequence(lead.id);
      setBusy(null);
      if (!result.ok) {
        alert(`Échec du démarrage : ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const onSwitchManual = () => {
    if (
      !confirm(
        `Passer « ${lead.client} » en mode manuel ?\n\n` +
          "La séquence automatique sera interrompue avant le prochain email. " +
          "Vous gérerez les relances vous-même.",
      )
    )
      return;
    setBusy("manual");
    startTransition(async () => {
      const result = await stopAutoSequence(lead.id);
      setBusy(null);
      if (!result.ok) {
        alert(`Échec : ${result.error}`);
        return;
      }
      router.refresh();
    });
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

  const eligible = canLaunchSequence(lead, n8nEnabled);
  const closed = lead.status === "encaisse" || lead.status === "perdu";
  // The Auto/Manuel toggle is shown whenever a sequence could be running or
  // started. Manuel is the interrupt; Auto is the launcher.
  const inSequenceZone =
    n8nEnabled && (lead.status === "envoye" || lead.status === "ouvert");
  const isAutoActive = inSequenceZone && lead.subEnvoi === "auto";

  return (
    <div className={styles.actions}>
      {lead.phone && (
        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={onCall}
          title="Click-to-call via Ringover"
        >
          <Icon name="phone" size={14} />
          {busy === "call" ? "Appel…" : "Appeler"}
        </button>
      )}
      {!closed && (
        <Link
          href={`/devis/new?lead=${lead.id}`}
          className={`${styles.btn} ${styles.btnPrimary}`}
          aria-disabled={busy !== null}
        >
          <Icon name="check" size={14} /> Générer devis
        </Link>
      )}
      {(eligible || inSequenceZone) && (
        <div
          className={styles.modeToggle}
          role="group"
          aria-label="Mode de relance"
        >
          <button
            type="button"
            className={`${styles.btn} ${isAutoActive ? styles.btnPrimary : ""}`}
            disabled={busy !== null || isAutoActive}
            onClick={onLaunchAuto}
            title="Lance la séquence n8n (4 emails Brevo)"
            aria-pressed={isAutoActive}
          >
            <Icon name="zap" size={14} />
            {busy === "auto" ? "Démarrage…" : "Automatique"}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${!isAutoActive && inSequenceZone ? styles.btnPrimary : ""}`}
            disabled={busy !== null || (!isAutoActive && !inSequenceZone)}
            onClick={onSwitchManual}
            title={
              isAutoActive
                ? "Interrompt la séquence automatique au prochain check"
                : "Mode manuel actif — vous gérez les relances"
            }
            aria-pressed={!isAutoActive && inSequenceZone}
          >
            <Icon name="phone" size={14} />
            {busy === "manual" ? "Arrêt…" : "Manuel"}
          </button>
        </div>
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
