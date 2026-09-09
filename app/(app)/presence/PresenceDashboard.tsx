"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { STATUS_LABEL } from "@/lib/presence/taxonomy";
import { fmtDuration, fmtTime, fmtDelay, STATUS_DOT, SEVERITY_ICON } from "@/lib/presence/format";
import type { TeamRow, DashboardStats, AlertRow } from "@/lib/presence/types";
import { evaluateNowAction } from "./actions";
import styles from "./presence.module.scss";

const SEV_ORDER = { critical: 4, high: 3, warn: 2, watch: 1 } as const;

export default function PresenceDashboard({ team, stats, alerts }: { team: TeamRow[]; stats: DashboardStats; alerts: AlertRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  // « Maintenant » horodaté hors rendu (pureté React) → met à jour le retard.
  const [nowTs, setNowTs] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setNowTs(Date.now()));
    const i = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(i);
    };
  }, []);

  // Remontée temps réel : toute alerte créée/résolue rafraîchit la vue.
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel("presence-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => router.refresh())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [router]);

  const sortedAlerts = [...alerts].sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity] || +new Date(b.createdAt) - +new Date(a.createdAt));
  const filteredTeam = query
    ? team.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : team;

  const alertHref = (a: AlertRow): string | null => {
    if (a.entityType === "lead" && a.entityId) return `/leads/${a.entityId}`;
    if (a.entityType === "dossier") return `/planification`;
    if (a.entityType === "user" && a.userId) return `/presence/${a.userId}`;
    return null;
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Présence &amp; Actions</h1>
          <p className={styles.subtitle}>Centre de contrôle Super Admin · aujourd&apos;hui</p>
        </div>
        <div className={styles.headActions}>
          <Link href="/presence/parametres" className={styles.ghostBtn}><Icon name="settings" size={15} /> Paramètres</Link>
          <button type="button" className={styles.ghostBtn} disabled={pending}
            onClick={() => start(async () => { await evaluateNowAction(); router.refresh(); })}>
            <Icon name="zap" size={15} /> {pending ? "Analyse…" : "Rafraîchir"}
          </button>
        </div>
      </header>

      {/* Bandeau synthèse */}
      <div className={styles.statBar}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Présence</div>
          <div className={styles.statRow}>
            <span className={styles.big}>{stats.presence.active}</span>
            <span className={styles.statSeg}>🟢 {stats.presence.active} actifs</span>
            <span className={styles.statSeg}>🟠 {stats.presence.inactive} inactifs</span>
            <span className={styles.statSeg}>⚫ {stats.presence.offline} hors ligne</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Leads aujourd&apos;hui</div>
          <div className={styles.statRow}>
            <span className={styles.big}>{stats.leads.newToday}</span>
            <span className={styles.statSeg}>{stats.leads.treated} traités</span>
            <span className={`${styles.statSeg} ${stats.leads.pending ? styles.warnTxt : ""}`}>{stats.leads.pending} en attente</span>
          </div>
        </div>
        <div className={`${styles.statCard} ${stats.alerts.total ? styles.alertCard : ""}`}>
          <div className={styles.statLabel}>Alertes</div>
          <div className={styles.statRow}>
            <span className={styles.big}>{stats.alerts.total}</span>
            {stats.alerts.critical > 0 && <span className={styles.statSeg}>🚨 {stats.alerts.critical} critiques</span>}
            {stats.alerts.high > 0 && <span className={styles.statSeg}>🔴 {stats.alerts.high} importantes</span>}
            {stats.alerts.warn + stats.alerts.watch > 0 && <span className={styles.statSeg}>🟠 {stats.alerts.warn + stats.alerts.watch} à surveiller</span>}
            {stats.alerts.total === 0 && <span className={styles.okTxt}>Rien à signaler ✓</span>}
          </div>
        </div>
      </div>

      {/* Alertes en cours */}
      {sortedAlerts.length > 0 && (
        <section className={styles.panel}>
          <header className={styles.panelHead}><Icon name="alert" size={16} /> Alertes en cours <span className={styles.count}>{sortedAlerts.length}</span></header>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Heure</th><th>Type</th><th>Utilisateur</th><th>Dossier</th><th>Retard</th><th></th></tr></thead>
              <tbody>
                {sortedAlerts.map((a) => {
                  const href = alertHref(a);
                  return (
                    <tr key={a.id} data-sev={a.severity}>
                      <td className={styles.mono} data-label="Heure">{fmtTime(a.createdAt)}</td>
                      <td data-label="Type"><span className={styles.sevPill} data-sev={a.severity}>{SEVERITY_ICON[a.severity]} {a.title}</span></td>
                      <td data-label="Utilisateur">{a.userName ? <Link href={`/presence/${a.userId}`} className={styles.link}>{a.userName}</Link> : "—"}</td>
                      <td data-label="Dossier">{a.entityRef ?? (a.entityType === "lead" ? "lead" : "—")}</td>
                      <td className={styles.mono} data-label="Retard">{fmtDelay(a.delaySeconds ?? (nowTs ? Math.round((nowTs - +new Date(a.createdAt)) / 1000) : null))}</td>
                      <td className={styles.rowActions}>
                        {href && <Link href={href} className={styles.miniBtn}>Voir</Link>}
                        {a.userId && <Link href={`/presence/${a.userId}`} className={styles.miniBtn}>Activité</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Équipe aujourd'hui */}
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          Équipe aujourd&apos;hui
          <input className={styles.search} placeholder="Filtrer un commercial…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </header>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Utilisateur</th><th>Statut</th><th>1ʳᵉ connexion</th><th>Dernière activité</th><th>Temps actif</th><th>Actions</th><th>Leads traités</th><th>Alertes</th></tr>
            </thead>
            <tbody>
              {filteredTeam.map((u) => (
                <tr key={u.userId} className={styles.clickRow} onClick={() => router.push(`/presence/${u.userId}`)}>
                  <td className={styles.userCell}><span className={styles.userName}>{u.name}</span><span className={styles.roles}>{u.roles.join(" · ")}</span></td>
                  <td data-label="Statut"><span className={styles.statusChip} data-status={u.status}>{STATUS_DOT[u.status]} {STATUS_LABEL[u.status]}</span></td>
                  <td className={styles.mono} data-label="1ʳᵉ conn.">{fmtTime(u.firstSeenAt)}</td>
                  <td className={styles.mono} data-label="Dernière act.">{fmtTime(u.lastActiveAt)}</td>
                  <td className={styles.mono} data-label="Temps actif">{fmtDuration(u.activeSeconds)}</td>
                  <td className={styles.num} data-label="Actions">{u.actionsCount}</td>
                  <td className={styles.num} data-label="Leads traités">{u.leadsTreated}</td>
                  <td data-label="Alertes">{u.openAlerts > 0 ? <span className={styles.sevPill} data-sev={u.topSeverity ?? "warn"}>{u.openAlerts}</span> : <span className={styles.dim}>—</span>}</td>
                </tr>
              ))}
              {filteredTeam.length === 0 && <tr><td colSpan={8} className={styles.empty}>Aucun utilisateur.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
