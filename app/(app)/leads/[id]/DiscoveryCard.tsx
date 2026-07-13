"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { recordDiscovery, requestPhotos } from "@/app/(app)/pipeline/actions";
import { DISCOVERY_OUTCOME_LABEL, type DiscoveryOutcome } from "@/lib/leads";
import styles from "./LeadDetail.module.scss";

// Découverte encart (call 2026-07-11): record the announced price + an outcome
// (OK → prêt pour devis, OK voir + → photos, Refus → lead perdu) and fire the
// "demande de photos" template by email or SMS. Lives in the lead aside.

type Props = {
  leadId: string;
  initialAnnouncedPrice?: number;
  initialOutcome?: DiscoveryOutcome;
  discoveryDoneAt?: string;
  photosRequestedAt?: string;
  hasEmail: boolean;
  hasPhone: boolean;
};

const inputStyle: React.CSSProperties = {
  flex: "0 0 140px",
  padding: "8px 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "0.9375rem",
};

export default function DiscoveryCard({
  leadId,
  initialAnnouncedPrice,
  initialOutcome,
  discoveryDoneAt,
  photosRequestedAt,
  hasEmail,
  hasPhone,
}: Props) {
  const router = useRouter();
  const [price, setPrice] = useState(
    initialAnnouncedPrice != null ? String(initialAnnouncedPrice) : "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const onOutcome = (outcome: DiscoveryOutcome) => {
    const announcedPrice = price.trim() ? Number(price) : null;
    if (announcedPrice != null && Number.isNaN(announcedPrice)) {
      setError("Prix annoncé invalide.");
      return;
    }
    let reason: string | undefined;
    if (outcome === "refus") {
      const r = window.prompt("Motif du refus (prix annoncé refusé) :", "");
      if (r === null) return; // cancelled
      reason = r;
    }
    run(`outcome-${outcome}`, () => recordDiscovery(leadId, { announcedPrice, outcome, reason }));
  };

  const onPhotos = (channel: "email" | "sms") =>
    run(`photos-${channel}`, () => requestPhotos(leadId, channel));

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}>
          <Icon name="search" size={14} /> Découverte
        </h2>
        {discoveryDoneAt && (
          <span className={styles.savedBadge} data-state="saved">
            <Icon name="check" size={11} /> Faite <RelativeTime iso={discoveryDoneAt} />
          </span>
        )}
      </header>

      <label
        style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 4 }}
      >
        Prix annoncé (€ TTC)
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="—"
          style={inputStyle}
        />
        {initialOutcome && (
          <span className={styles.muted} style={{ fontSize: "0.8125rem" }}>
            Issue : <strong>{DISCOVERY_OUTCOME_LABEL[initialOutcome]}</strong>
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={busy !== null}
          onClick={() => onOutcome("ok")}
        >
          {busy === "outcome-ok" ? "…" : "OK"}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={busy !== null}
          onClick={() => onOutcome("ok_plus")}
        >
          {busy === "outcome-ok_plus" ? "…" : "OK voir +"}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={busy !== null}
          onClick={() => onOutcome("refus")}
        >
          {busy === "outcome-refus" ? "…" : "Refus"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
        <div className={styles.muted} style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
          Demande de photos pour établir le devis
          {photosRequestedAt && (
            <>
              {" · "}
              <Icon name="check" size={11} /> envoyée <RelativeTime iso={photosRequestedAt} />
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={styles.btn}
            disabled={busy !== null || !hasEmail}
            onClick={() => onPhotos("email")}
            title={hasEmail ? "Envoyer la demande par email" : "Aucun email pour ce client"}
          >
            {busy === "photos-email" ? "Envoi…" : "Email"}
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={busy !== null || !hasPhone}
            onClick={() => onPhotos("sms")}
            title={hasPhone ? "Envoyer la demande par SMS" : "Aucun téléphone pour ce client"}
          >
            {busy === "photos-sms" ? "Envoi…" : "SMS"}
          </button>
        </div>
      </div>

      {error && <p className={styles.errorMessage}>{error}</p>}
    </section>
  );
}
