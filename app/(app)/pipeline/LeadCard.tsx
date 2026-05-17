"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  PIPELINE_COLUMNS,
  SECTOR_LABEL,
  SECTOR_VAR,
  canLaunchSequence,
  formatEUR,
  needsEnvoi,
  needsSignature,
  type Commercial,
  type Lead,
  type LeadStatus,
  type SubEnvoi,
  type SubSignature,
} from "@/lib/leads";
import styles from "./LeadCard.module.scss";

type Props = {
  lead: Lead;
  owner: Commercial | undefined;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMove: (id: string, target: LeadStatus) => void;
  onSetEnvoi: (id: string, value: SubEnvoi) => void;
  onSetSignature: (id: string, value: SubSignature) => void;
  onSetNrp: (id: string, nrp: boolean) => void;
  onLaunchSequence: (lead: Lead) => void;
};

export default function LeadCard({
  lead,
  owner,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
  onSetEnvoi,
  onSetSignature,
  onSetNrp,
  onLaunchSequence,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sequenceEligible = canLaunchSequence(lead);
  const missingEnvoi = needsEnvoi(lead);
  const missingSignature = needsSignature(lead);

  // Click-outside / Escape to close the kebab menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <article
      ref={rootRef}
      className={styles.card}
      data-status={lead.status}
      data-dragging={isDragging || undefined}
      data-lost={lead.status === "perdu" || undefined}
      draggable
      onDragStart={(e) => {
        // Some browsers won't initiate a drag without a payload.
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(lead.id);
      }}
      onDragEnd={onDragEnd}
      aria-label={`${lead.client} · ${formatEUR(lead.amount)}`}
    >
      <header className={styles.head}>
        <span
          className={styles.sector}
          style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
        >
          {SECTOR_LABEL[lead.sector]}
        </span>
        <span className={styles.shortId}>{lead.shortId}</span>
        <button
          type="button"
          className={styles.kebab}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Actions"
        >
          <Icon name="more-vertical" size={16} />
        </button>
      </header>

      <Link href={`/leads/${lead.id}`} className={styles.body} draggable={false}>
        <h3 className={styles.client}>
          {lead.isUrgent && (
            <span className={styles.urgent} aria-label="Urgent">
              <Icon name="alert" size={12} />
            </span>
          )}
          {lead.client}
        </h3>
        <p className={styles.city}>{lead.city}</p>
        <p className={styles.amount}>{formatEUR(lead.amount)}</p>
      </Link>

      <footer className={styles.foot}>
        <div className={styles.badges}>
          {lead.isNrp && (
            <span className={`${styles.badge} ${styles.badgeNrp}`} title="Ne répond pas">
              NRP
            </span>
          )}
          {missingEnvoi && (
            <span className={`${styles.badge} ${styles.badgeDanger}`}>
              <Icon name="alert" size={11} /> Canal manquant
            </span>
          )}
          {!missingEnvoi && lead.subEnvoi && (
            <span className={styles.badge}>{lead.subEnvoi === "mano" ? "Mano" : "Auto"}</span>
          )}
          {missingSignature && (
            <span className={`${styles.badge} ${styles.badgeDanger}`}>
              <Icon name="alert" size={11} /> Acompte ?
            </span>
          )}
          {!missingSignature && lead.subSignature && (
            <span className={styles.badge}>
              {lead.subSignature === "avec" ? "Avec acompte" : "Sans acompte"}
            </span>
          )}
        </div>

        <div
          className={styles.owner}
          title={owner?.name ?? "Non assigné"}
          style={{ ["--av" as string]: owner?.color ?? "var(--text-muted)" }}
          aria-label={`Commercial : ${owner?.name ?? "non assigné"}`}
        >
          {owner?.initials ?? "—"}
        </div>
      </footer>

      <p className={styles.lastAction}>
        {lead.lastActionLabel} · <RelativeTime iso={lead.lastActionAt} />
      </p>

      {sequenceEligible && (
        <button
          type="button"
          className={styles.sequenceBtn}
          onClick={() => onLaunchSequence(lead)}
        >
          <Icon name="zap" size={14} /> Lancer séquence
        </button>
      )}

      {menuOpen && (
        <div className={styles.menu} role="menu">
          {sequenceEligible && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                setMenuOpen(false);
                onLaunchSequence(lead);
              }}
            >
              <Icon name="zap" size={14} /> Lancer séquence
            </button>
          )}

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onSetNrp(lead.id, !lead.isNrp);
              setMenuOpen(false);
            }}
          >
            {lead.isNrp ? "Retirer NRP" : "Marquer NRP (ne répond pas)"}
          </button>

          {(lead.status === "envoye" || lead.status === "ouvert") && (
            <>
              <div className={styles.menuLabel}>Canal d&apos;envoi</div>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onSetEnvoi(lead.id, "mano");
                  setMenuOpen(false);
                }}
              >
                {lead.subEnvoi === "mano" && <Icon name="check" size={14} />} Mano
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onSetEnvoi(lead.id, "auto");
                  setMenuOpen(false);
                }}
              >
                {lead.subEnvoi === "auto" && <Icon name="check" size={14} />} Auto
              </button>
            </>
          )}

          {lead.status === "signe" && (
            <>
              <div className={styles.menuLabel}>Modalité de paiement</div>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onSetSignature(lead.id, "sans");
                  setMenuOpen(false);
                }}
              >
                {lead.subSignature === "sans" && <Icon name="check" size={14} />} Sans acompte
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onSetSignature(lead.id, "avec");
                  setMenuOpen(false);
                }}
              >
                {lead.subSignature === "avec" && <Icon name="check" size={14} />} Avec acompte
              </button>
            </>
          )}

          <div className={styles.menuLabel}>Déplacer vers</div>
          {PIPELINE_COLUMNS.filter((c) => c.status !== lead.status).map((c) => (
            <button
              key={c.status}
              type="button"
              className={styles.menuItem}
              onClick={() => {
                onMove(lead.id, c.status);
                setMenuOpen(false);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
