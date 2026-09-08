"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { STATUS_LABEL, COUNTER_LABELS } from "@/lib/presence/taxonomy";
import { fmtDuration, fmtTime, fmtTimeSec, fmtDelay, STATUS_DOT, SEVERITY_ICON } from "@/lib/presence/format";
import type { UserDaySummary, AlertRow, ActionEvent } from "@/lib/presence/types";
import styles from "../presence.module.scss";

// Ordre d'affichage des compteurs « travail effectué ».
const COUNTER_ORDER = [
  "leads_consultes", "leads_traites", "relances", "appels",
  "devis_crees", "devis_envoyes", "factures", "rdv",
  "dossiers_finalises", "notes", "statuts",
];

export default function UserDetail({ summary, alerts, actions, day }: { summary: UserDaySummary; alerts: AlertRow[]; actions: ActionEvent[]; day: string }) {
  const [showAll, setShowAll] = useState(false);
  const s = summary;

  // Timeline présence : segments proportionnels sur la plage du jour.
  const tStart = s.timeline.length ? +new Date(s.timeline[0].start) : 0;
  const tEnd = s.timeline.length ? +new Date(s.timeline[s.timeline.length - 1].end) : 0;
  const span = Math.max(1, tEnd - tStart);

  const chrono = [...actions].reverse(); // du matin au soir

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link href="/presence" className={styles.back}><Icon name="chevron-down" size={14} /> Retour à l&apos;équipe</Link>
          <h1 className={styles.title}>{s.name}</h1>
          <p className={styles.subtitle}>
            <span className={styles.statusChip} data-status={s.status}>{STATUS_DOT[s.status]} {STATUS_LABEL[s.status]}</span>
            {" · "}Activité du {new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
      </header>

      {/* Synthèse du jour */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>Activité du jour — synthèse</header>
        <div className={styles.metrics}>
          <Metric label="1ʳᵉ connexion" value={fmtTime(s.firstSeenAt)} />
          <Metric label="Dernière activité" value={fmtTime(s.lastActiveAt ?? s.lastSeenAt)} />
          <Metric label="Temps connecté" value={fmtDuration(s.sessionSeconds)} />
          <Metric label="Temps actif CRM" value={fmtDuration(s.activeSeconds)} strong />
          <Metric label="Temps inactif estimé" value={fmtDuration(s.inactiveSeconds)} />
          <Metric label="Sessions" value={String(s.sessionsCount || (s.firstSeenAt ? 1 : 0))} />
        </div>
      </section>

      {/* Timeline de présence */}
      {s.timeline.length > 0 && (
        <section className={styles.panel}>
          <header className={styles.panelHead}>Présence — {fmtTime(s.timeline[0].start)} → {fmtTime(s.timeline[s.timeline.length - 1].end)}</header>
          <div className={styles.presenceBar}>
            {s.timeline.map((seg, i) => (
              <div
                key={i}
                className={seg.kind === "active" ? styles.segActive : styles.segInactive}
                style={{ width: `${((+new Date(seg.end) - +new Date(seg.start)) / span) * 100}%` }}
                title={`${seg.kind === "active" ? "Actif" : "Inactif"} ${fmtTime(seg.start)}–${fmtTime(seg.end)} (${fmtDuration(seg.seconds)})`}
              />
            ))}
          </div>
          <div className={styles.legend}>
            <span><span className={styles.dotActive} /> Actif</span>
            <span><span className={styles.dotInactive} /> Inactif</span>
          </div>
        </section>
      )}

      {/* Travail effectué */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>Travail effectué</header>
        <div className={styles.counters}>
          {COUNTER_ORDER.map((k) => (
            <div key={k} className={styles.counter}>
              <span className={styles.counterNum}>{s.counters[k] ?? 0}</span>
              <span className={styles.counterLbl}>{COUNTER_LABELS[k] ?? k}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Alertes du jour */}
      {alerts.length > 0 && (
        <section className={styles.panel}>
          <header className={styles.panelHead}><Icon name="alert" size={16} /> Alertes du jour <span className={styles.count}>{alerts.length}</span></header>
          <ul className={styles.alertList}>
            {alerts.map((a) => (
              <li key={a.id} data-status={a.status}>
                <span className={styles.sevPill} data-sev={a.severity}>{SEVERITY_ICON[a.severity]}</span>
                <span className={styles.alertTitle}>{a.title}</span>
                <span className={styles.alertMeta}>
                  {fmtTime(a.createdAt)}
                  {a.status === "resolved" ? ` → résolue ${fmtTime(a.resolvedAt)} (retard ${fmtDelay(a.delaySeconds)})` : " · en cours"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Historique complet */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          Actions — {actions.length}
          <button type="button" className={styles.ghostBtn} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Réduire" : "Voir toutes les actions"}
          </button>
        </header>
        {showAll && (
          <ol className={styles.timeline}>
            {chrono.map((e) => (
              <li key={e.id}>
                <span className={styles.tlTime}>{fmtTimeSec(e.at)}</span>
                <span className={styles.tlDot} data-cat={e.category} />
                <span className={styles.tlBody}>
                  <span className={styles.tlVerb}>{e.verb}</span>
                  {e.entityRef && <span className={styles.tlRef}>{e.entityType === "lead" ? <Link href={`/leads/${e.entityId}`} className={styles.link}>{e.entityRef}</Link> : e.entityRef}</span>}
                  {statusDiff(e)}
                </span>
              </li>
            ))}
            {chrono.length === 0 && <li className={styles.empty}>Aucune action ce jour.</li>}
          </ol>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLbl}>{label}</span>
      <span className={strong ? styles.metricValStrong : styles.metricVal}>{value}</span>
    </div>
  );
}

// Affiche « ancien → nouveau » pour les changements de statut.
function statusDiff(e: ActionEvent): React.ReactNode {
  if (e.action !== "lead.status.change") return null;
  const from = (e.before?.status ?? e.before?.from) as string | undefined;
  const to = (e.after?.status ?? e.after?.to) as string | undefined;
  if (!from && !to) return null;
  return <span className={styles.tlDiff}>{from ?? "?"} → {to ?? "?"}</span>;
}
