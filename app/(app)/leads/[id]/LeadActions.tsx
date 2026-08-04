"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import { canLaunchSequence, SECTOR_LABEL, SECTOR_VAR, type Commercial, type Lead } from "@/lib/leads";
import { startCall } from "@/lib/ringover-webphone";
import type { MessageTemplate } from "@/lib/message-templates-server";
import { launchSequence, setLeadNrp, stopAutoSequence } from "@/app/(app)/pipeline/actions";
import EditContactModal from "./EditContactModal";
import EmailModal from "./EmailModal";
import MarkLostModal from "./MarkLostModal";
import ReassignLeadModal from "./ReassignLeadModal";
import SmsModal from "./SmsModal";
import styles from "./LeadDetail.module.scss";

// Action buttons for the lead detail header.

type Props = {
  lead: Lead;
  commerciaux: Commercial[];
  n8nEnabled: boolean;
  // Capacité dérivée du profil du commercial connecté (auto selon le profil).
  // false → le click-to-call et la composition sont masqués (profil « Divers »).
  canUseRingover: boolean;
  smsTemplates: MessageTemplate[];
  emailTemplates: MessageTemplate[];
  // Variables réelles (BDD) déjà résolues côté serveur pour l'interpolation
  // des templates SMS / email (acompte, société, commercial, montants…).
  templateVars: Record<string, string>;
  // Boutons NRP (profil « Divers ») : SMS + email pré-remplis avec le modèle NRP.
  showNrp: boolean;
  nrpSmsBody: string;
  nrpEmailSubject: string;
  nrpEmailBody: string;
};

export default function LeadActions({ lead, commerciaux, n8nEnabled, canUseRingover, smsTemplates, emailTemplates, templateVars, showNrp, nrpSmsBody, nrpEmailSubject, nrpEmailBody }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  // Contenu de pré-remplissage quand on ouvre via un bouton NRP (sinon vide).
  const [smsInit, setSmsInit] = useState<string | undefined>(undefined);
  const [emailInit, setEmailInit] = useState<{ subject: string; body: string } | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Close the overflow menu on Escape for keyboard users.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
    // Compose l'appel dans le webphone Ringover intégré (audio dans le CRM) et
    // affiche le screen-pop designé. Si l'agent n'est pas encore connecté à
    // Ringover, le widget affiche l'écran de connexion.
    const name = lead.client;
    const initials =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || name.slice(0, 2).toUpperCase();
    startCall({
      phone: lead.phone,
      name,
      initials,
      sectorVar: SECTOR_VAR[lead.sector],
      sublabel: `${SECTOR_LABEL[lead.sector]}${lead.typeService ? ` · ${lead.typeService}` : ""}`,
      leadId: lead.id,
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
      {canUseRingover && lead.phone && (
        <button
          type="button"
          className={styles.btn}
          onClick={onCall}
          title="Appeler dans le webphone Ringover intégré (audio dans le CRM)"
        >
          <Icon name="phone" size={14} />
          Appeler
        </button>
      )}
      {canUseRingover && lead.phone && (
        <button
          type="button"
          className={styles.btn}
          onClick={() => { setSmsInit(undefined); setSmsModalOpen(true); }}
          title="Envoyer un SMS via Ringover (templates disponibles)"
        >
          <Icon name="edit" size={14} /> SMS
        </button>
      )}
      {lead.email && (
        <button
          type="button"
          className={styles.btn}
          onClick={() => { setEmailInit(undefined); setEmailModalOpen(true); }}
          title="Relance par email via Brevo (modèles disponibles)"
        >
          <Icon name="mail" size={14} /> Relance email
        </button>
      )}
      {showNrp && lead.phone && (
        <button
          type="button"
          className={styles.btn}
          onClick={() => { setSmsInit(nrpSmsBody); setSmsModalOpen(true); }}
          title="SMS de relance NRP (pré-rempli), envoi via le webphone"
        >
          <Icon name="edit" size={14} /> SMS NRP
        </button>
      )}
      {showNrp && lead.email && (
        <button
          type="button"
          className={styles.btn}
          onClick={() => { setEmailInit({ subject: nrpEmailSubject, body: nrpEmailBody }); setEmailModalOpen(true); }}
          title="Email de relance NRP (pré-rempli), envoi via Brevo"
        >
          <Icon name="mail" size={14} /> Email NRP
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
      <div className={styles.menuWrap}>
        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Plus d'actions"
        >
          <Icon name="more-vertical" size={14} /> Plus
        </button>
        {menuOpen && (
          <>
            <div
              className={styles.menuBackdrop}
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className={styles.menu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={busy !== null}
                onClick={() => {
                  setMenuOpen(false);
                  setContactModalOpen(true);
                }}
              >
                <Icon name="edit" size={15} /> Modifier coordonnées
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={busy !== null}
                onClick={() => {
                  setMenuOpen(false);
                  setReassignModalOpen(true);
                }}
              >
                <Icon name="commerciaux" size={15} /> Réassigner
              </button>
              {!closed && (
                <>
                  <div className={styles.menuDivider} aria-hidden />
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    disabled={busy !== null}
                    onClick={() => {
                      setMenuOpen(false);
                      setLostModalOpen(true);
                    }}
                  >
                    <Icon name="x" size={15} /> Marquer perdu
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

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

      {smsModalOpen && (
        <SmsModal
          lead={lead}
          templates={smsTemplates}
          vars={templateVars}
          initialBody={smsInit}
          onClose={() => setSmsModalOpen(false)}
        />
      )}

      {emailModalOpen && (
        <EmailModal
          lead={lead}
          templates={emailTemplates}
          vars={templateVars}
          initialSubject={emailInit?.subject}
          initialBody={emailInit?.body}
          onClose={() => setEmailModalOpen(false)}
        />
      )}
    </div>
  );
}
