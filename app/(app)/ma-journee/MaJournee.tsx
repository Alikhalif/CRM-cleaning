"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  bucketOf, priorityOf, relativeFr, effectiveDue,
  TYPE_LABEL, TYPE_VERB, BUCKET_LABEL, PHOTO_SUBTYPE_LABEL,
  type ActionBucket, type ActionType, type CommercialAction,
} from "@/lib/commercial-actions/shared";
import type { ManagerData, CommercialRule, PhotoWaitingRow } from "@/lib/commercial-actions/read-server";
import { completeAction, snoozeAction, resumeAction, updateCommercialRule } from "./actions";
import styles from "./ma-journee.module.scss";

type Props = {
  actions: CommercialAction[];
  urgentAfterHours: number;
  isManager: boolean;
  isAdmin: boolean;
  manager: ManagerData | null;
  rules: CommercialRule[];
  photoWaiting: PhotoWaitingRow[];
  meName: string;
  serverNow: number;
  initialTab?: Tab;
};

type Tab = ActionBucket | "photos" | "equipe";

const TYPE_ICON: Record<ActionType, "phone" | "image" | "document" | "mail"> = {
  decouverte: "phone",
  photos: "image",
  devis: "document",
  relance: "mail",
};
const CHANNEL_LABEL: Record<"email" | "sms", string> = { email: "E-mail", sms: "SMS" };

export default function MaJournee({ actions, urgentAfterHours, isManager, isAdmin, manager, rules, photoWaiting, meName, serverNow, initialTab }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [tab, setTab] = useState<Tab>(initialTab ?? "a_faire");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Horloge : rafraîchit l'affichage relatif + les priorités toutes les 30 s.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<ActionBucket, CommercialAction[]> = { a_faire: [], en_retard: [], reportee: [], terminee: [] };
    for (const a of actions) g[bucketOf(a, now)].push(a);
    // tri par échéance croissante (les plus urgentes d'abord) sauf terminées (récentes d'abord)
    g.a_faire.sort((x, y) => effectiveDue(x) - effectiveDue(y));
    g.en_retard.sort((x, y) => effectiveDue(x) - effectiveDue(y));
    g.reportee.sort((x, y) => effectiveDue(x) - effectiveDue(y));
    g.terminee.sort((x, y) => new Date(y.closedAt ?? y.createdAt).getTime() - new Date(x.closedAt ?? x.createdAt).getTime());
    return g;
  }, [actions, now]);

  const counts = {
    a_faire: grouped.a_faire.length,
    en_retard: grouped.en_retard.length,
    reportee: grouped.reportee.length,
    terminee: grouped.terminee.length,
  };

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    startTransition(async () => {
      await fn();
      router.refresh();
      setBusyId(null);
    });
  };

  const TABS: { key: Tab; label: string; count?: number; tone?: string }[] = [
    { key: "a_faire", label: BUCKET_LABEL.a_faire, count: counts.a_faire },
    { key: "en_retard", label: BUCKET_LABEL.en_retard, count: counts.en_retard, tone: "retard" },
    { key: "reportee", label: BUCKET_LABEL.reportee, count: counts.reportee },
    { key: "photos", label: "Photos", count: photoWaiting.length, tone: photoWaiting.some((p) => p.status === "attente") ? "retard" : undefined },
    { key: "terminee", label: BUCKET_LABEL.terminee, count: counts.terminee },
    ...(isManager ? [{ key: "equipe" as Tab, label: "Équipe" }] : []),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Ma journée</h1>
          <p className={styles.subtitle}>
            {meName} · {counts.a_faire + counts.en_retard} action{counts.a_faire + counts.en_retard > 1 ? "s" : ""} à mener
            {counts.en_retard > 0 && <span className={styles.hotInline}> · {counts.en_retard} en retard</span>}
          </p>
        </div>
      </header>

      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className={`${styles.pill} ${t.tone === "retard" ? styles.pillRetard : ""}`}>{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "equipe" && manager ? (
        <ManagerView data={manager} now={now} isAdmin={isAdmin} rules={rules} />
      ) : tab === "photos" ? (
        <PhotoWaitingView rows={photoWaiting} now={now} showOwner={isManager} />
      ) : (
        <section className={styles.list}>
          {grouped[tab as ActionBucket].length === 0 ? (
            <EmptyState bucket={tab as ActionBucket} />
          ) : (
            grouped[tab as ActionBucket].map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                now={now}
                urgentAfterHours={urgentAfterHours}
                busy={pending && busyId === a.id}
                onComplete={() => run(a.id, () => completeAction(a.id))}
                onSnooze={(h) => run(a.id, () => snoozeAction(a.id, h))}
                onResume={() => run(a.id, () => resumeAction(a.id))}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({ bucket }: { bucket: ActionBucket }) {
  const msg =
    bucket === "en_retard" ? "Aucun retard. Tout est sous contrôle."
    : bucket === "reportee" ? "Aucune action reportée."
    : bucket === "terminee" ? "Aucune action terminée récemment."
    : "Rien à faire pour l'instant. Les actions apparaîtront ici automatiquement.";
  return (
    <div className={styles.empty}>
      <Icon name="check" size={22} />
      <p>{msg}</p>
    </div>
  );
}

function ActionCard({
  action, now, urgentAfterHours, busy, onComplete, onSnooze, onResume,
}: {
  action: CommercialAction;
  now: number;
  urgentAfterHours: number;
  busy: boolean;
  onComplete: () => void;
  onSnooze: (hours: number) => void;
  onResume: () => void;
}) {
  const bucket = bucketOf(action, now);
  const prio = priorityOf(action, urgentAfterHours, now);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!snoozeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setSnoozeOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [snoozeOpen]);

  const isDone = action.status === "terminee";
  const due = effectiveDue(action);
  const dueLabel = relativeFr(new Date(due).toISOString(), now);

  return (
    <article className={`${styles.card} ${styles[`type_${action.type}`]} ${prio === "urgent" ? styles.cardUrgent : bucket === "en_retard" ? styles.cardRetard : ""}`}>
      <div className={styles.cardIcon}><Icon name={TYPE_ICON[action.type]} size={16} /></div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={`${styles.badge} ${styles[`badge_${action.type}`]}`}>{TYPE_LABEL[action.type]}</span>
          {!isDone && action.type === "photos" && action.subtype === "a_verifier" && (
            <span className={`${styles.badge} ${styles.badgeVerify}`}>À vérifier</span>
          )}
          {!isDone && prio === "urgent" && <span className={`${styles.badge} ${styles.badgeUrgent}`}>Urgent</span>}
          {!isDone && bucket === "en_retard" && prio !== "urgent" && <span className={`${styles.badge} ${styles.badgeRetard}`}>En retard</span>}
          {action.reportCount > 0 && !isDone && <span className={styles.reported}>reporté ×{action.reportCount}</span>}
        </div>

        <h3 className={styles.cardTitle}>{TYPE_VERB[action.type]}</h3>
        {action.reason && <p className={styles.cardReason}>{action.reason}</p>}

        <div className={styles.cardMeta}>
          <Link href={`/leads/${action.leadId}`} className={styles.leadLink}>
            <Icon name="leads" size={13} /> {action.leadRef ?? "Lead"}{action.leadName ? ` · ${action.leadName}` : ""}
          </Link>
          <span className={`${styles.due} ${bucket === "en_retard" && !isDone ? styles.dueLate : ""}`}>
            <Icon name="alert" size={12} />
            {isDone ? `terminé ${action.closedAt ? relativeFr(action.closedAt, now) : ""}` : `échéance ${dueLabel}`}
          </span>
        </div>
      </div>

      {!isDone && (
        <div className={styles.cardActions}>
          {action.status === "reportee" ? (
            <button type="button" className={styles.btnGhost} disabled={busy} onClick={onResume}>Reprendre</button>
          ) : (
            <div className={styles.snoozeWrap} ref={menuRef}>
              <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => setSnoozeOpen((v) => !v)}>
                Reporter <Icon name="chevron-down" size={12} />
              </button>
              {snoozeOpen && (
                <div className={styles.snoozeMenu}>
                  <button type="button" onClick={() => { setSnoozeOpen(false); onSnooze(1); }}>Dans 1 h</button>
                  <button type="button" onClick={() => { setSnoozeOpen(false); onSnooze(3); }}>Dans 3 h</button>
                  <button type="button" onClick={() => { setSnoozeOpen(false); onSnooze(24); }}>Demain</button>
                  <button type="button" onClick={() => { setSnoozeOpen(false); onSnooze(72); }}>Dans 3 j</button>
                </div>
              )}
            </div>
          )}
          <button type="button" className={styles.btnPrimary} disabled={busy} onClick={onComplete}>
            <Icon name="check" size={14} /> Fait
          </button>
        </div>
      )}
      {isDone && (
        <div className={styles.cardActions}>
          <span className={styles.doneTag}><Icon name="check" size={13} /> {action.closedReason === "auto" ? "Auto" : "Fait"}</span>
        </div>
      )}
    </article>
  );
}

// ── Vue « Clients en attente de photos » ────────────────────────────────────
function PhotoWaitingView({ rows, now, showOwner }: { rows: PhotoWaitingRow[]; now: number; showOwner: boolean }) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="check" size={22} />
        <p>Aucun dossier en attente de photos.</p>
      </div>
    );
  }
  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>
        Clients en attente de photos
        <span className={styles.titleCount}>{rows.length}</span>
      </h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Client · dossier</th>
            <th>Demandé</th>
            <th>Dernier contact</th>
            <th>Canal</th>
            <th>Statut photos</th>
            <th>Prochaine relance</th>
            {showOwner && <th>Commercial</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const relanceLate = r.nextRelanceAt ? new Date(r.nextRelanceAt).getTime() < now : false;
            return (
              <tr key={r.leadId}>
                <td data-label="Client · dossier">
                  <Link href={`/leads/${r.leadId}?tab=media`} className={styles.leadLink}>
                    {r.leadRef ?? "Lead"}{r.leadName ? ` · ${r.leadName}` : ""}
                  </Link>
                </td>
                <td data-label="Demandé">{relativeFr(r.requestedAt, now)}</td>
                <td data-label="Dernier contact">{r.lastContactAt ? relativeFr(r.lastContactAt, now) : "—"}</td>
                <td data-label="Canal">{r.channel ? CHANNEL_LABEL[r.channel] : "—"}</td>
                <td data-label="Statut photos">
                  <span className={`${styles.photoStatus} ${r.status === "a_verifier" ? styles.photoVerify : styles.photoWait}`}>
                    {PHOTO_SUBTYPE_LABEL[r.status]}
                  </span>
                </td>
                <td data-label="Prochaine relance" className={relanceLate ? styles.hot : ""}>
                  {r.nextRelanceAt ? relativeFr(r.nextRelanceAt, now) : "—"}
                </td>
                {showOwner && <td data-label="Commercial">{r.ownerName ?? "—"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Vue manager (admin / planificateur) ─────────────────────────────────────
function ManagerView({ data, now, isAdmin, rules }: { data: ManagerData; now: number; isAdmin: boolean; rules: CommercialRule[] }) {
  const fmt = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : `${h} h`);
  return (
    <section className={styles.manager}>
      <div className={styles.kpis}>
        <Kpi label="À faire" value={data.totals.a_faire} />
        <Kpi label="En retard" value={data.totals.en_retard} tone="retard" />
        <Kpi label="Urgent" value={data.totals.urgent} tone="urgent" />
        <Kpi label="Terminées aujourd'hui" value={data.totals.termineesToday} tone="ok" />
      </div>

      <div className={styles.mgrGrid}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Par commercial</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>Commercial</th><th>À faire</th><th>En retard</th><th>Urgent</th></tr>
            </thead>
            <tbody>
              {data.byOwner.length === 0 && <tr><td colSpan={4} className={styles.tdEmpty}>Aucune action active.</td></tr>}
              {data.byOwner.map((o) => (
                <tr key={o.ownerId ?? "none"}>
                  <td data-label="Commercial">{o.ownerName}</td>
                  <td data-label="À faire">{o.open}</td>
                  <td data-label="En retard" className={o.en_retard > 0 ? styles.hot : ""}>{o.en_retard}</td>
                  <td data-label="Urgent" className={o.urgent > 0 ? styles.hot : ""}>{o.urgent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Par type · délai moyen de traitement</h2>
          <ul className={styles.typeList}>
            {(["decouverte", "photos", "devis", "relance"] as ActionType[]).map((t) => (
              <li key={t}>
                <span className={`${styles.badge} ${styles[`badge_${t}`]}`}>{TYPE_LABEL[t]}</span>
                <span className={styles.typeCounts}>{data.byType[t].open} actives · {data.byType[t].en_retard} en retard</span>
                <span className={styles.typeAvg}>{fmt(data.avgDelays[t])}</span>
              </li>
            ))}
          </ul>
          <p className={styles.mgrHint}>Délai moyen entre l&apos;apparition de l&apos;action et sa clôture (30 derniers jours).</p>
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Actions actives ({data.actions.length})</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>Type</th><th>Lead</th><th>Commercial</th><th>Échéance</th><th>État</th></tr>
          </thead>
          <tbody>
            {data.actions.length === 0 && <tr><td colSpan={5} className={styles.tdEmpty}>Aucune action active.</td></tr>}
            {data.actions.map((a) => {
              const bucket = bucketOf(a, now);
              return (
                <tr key={a.id}>
                  <td data-label="Type"><span className={`${styles.badge} ${styles[`badge_${a.type}`]}`}>{TYPE_LABEL[a.type]}</span></td>
                  <td data-label="Lead"><Link href={`/leads/${a.leadId}`} className={styles.leadLink}>{a.leadRef ?? "Lead"}{a.leadName ? ` · ${a.leadName}` : ""}</Link></td>
                  <td data-label="Commercial">{a.ownerName ?? "—"}</td>
                  <td data-label="Échéance" className={bucket === "en_retard" ? styles.hot : ""}>{relativeFr(new Date(effectiveDue(a)).toISOString(), now)}</td>
                  <td data-label="État">{BUCKET_LABEL[bucket]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAdmin && <ConfigPanel rules={rules} />}
    </section>
  );
}

// ── Panneau de configuration (Super Admin) : délais & activation ─────────────
function ConfigPanel({ rules }: { rules: CommercialRule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const byKey = new Map(rules.map((r) => [r.key, r]));
  const dec = byKey.get("decouverte");
  const dev = byKey.get("devis");
  const rel = byKey.get("relance");
  const pho = byKey.get("photos");
  const prio = byKey.get("priority");

  const [decMin, setDecMin] = useState(dec?.config.after_minutes ?? 10);
  const [devH, setDevH] = useState(dev?.config.after_hours ?? 24);
  const [relFirst, setRelFirst] = useState(rel?.config.first_after_days ?? 2);
  const [relEvery, setRelEvery] = useState(rel?.config.every_days ?? 3);
  const [phoH, setPhoH] = useState(pho?.config.first_after_hours ?? 24);
  const [urgentH, setUrgentH] = useState(prio?.config.urgent_after_hours ?? 48);
  const [decOn, setDecOn] = useState(dec?.enabled ?? true);
  const [devOn, setDevOn] = useState(dev?.enabled ?? true);
  const [relOn, setRelOn] = useState(rel?.enabled ?? true);
  const [phoOn, setPhoOn] = useState(pho?.enabled ?? true);

  const save = () => {
    setSaved(false);
    startTransition(async () => {
      await Promise.all([
        updateCommercialRule("decouverte", { enabled: decOn, config: { after_minutes: Number(decMin) } }),
        updateCommercialRule("photos", { enabled: phoOn, config: { first_after_hours: Number(phoH) } }),
        updateCommercialRule("devis", { enabled: devOn, config: { after_hours: Number(devH) } }),
        updateCommercialRule("relance", { enabled: relOn, config: { first_after_days: Number(relFirst), every_days: Number(relEvery) } }),
        updateCommercialRule("priority", { config: { urgent_after_hours: Number(urgentH) } }),
      ]);
      router.refresh();
      setSaved(true);
    });
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Réglages des délais</h2>
      <div className={styles.cfg}>
        <label className={styles.cfgRow}>
          <input type="checkbox" checked={decOn} onChange={(e) => setDecOn(e.target.checked)} />
          <span className={styles.cfgLabel}>Découverte après un appel</span>
          <span className={styles.cfgField}><input type="number" min={1} value={decMin} onChange={(e) => setDecMin(Number(e.target.value))} /> min</span>
        </label>
        <label className={styles.cfgRow}>
          <input type="checkbox" checked={phoOn} onChange={(e) => setPhoOn(e.target.checked)} />
          <span className={styles.cfgLabel}>Relance photos client non reçues</span>
          <span className={styles.cfgField}><input type="number" min={1} value={phoH} onChange={(e) => setPhoH(Number(e.target.value))} /> h</span>
        </label>
        <label className={styles.cfgRow}>
          <input type="checkbox" checked={devOn} onChange={(e) => setDevOn(e.target.checked)} />
          <span className={styles.cfgLabel}>Devis après la découverte</span>
          <span className={styles.cfgField}><input type="number" min={1} value={devH} onChange={(e) => setDevH(Number(e.target.value))} /> h</span>
        </label>
        <label className={styles.cfgRow}>
          <input type="checkbox" checked={relOn} onChange={(e) => setRelOn(e.target.checked)} />
          <span className={styles.cfgLabel}>Relance — première</span>
          <span className={styles.cfgField}><input type="number" min={1} value={relFirst} onChange={(e) => setRelFirst(Number(e.target.value))} /> j</span>
        </label>
        <label className={styles.cfgRow}>
          <span className={styles.cfgSpacer} />
          <span className={styles.cfgLabel}>Relance — puis toutes les</span>
          <span className={styles.cfgField}><input type="number" min={1} value={relEvery} onChange={(e) => setRelEvery(Number(e.target.value))} /> j</span>
        </label>
        <label className={styles.cfgRow}>
          <span className={styles.cfgSpacer} />
          <span className={styles.cfgLabel}>Passe en « urgent » après</span>
          <span className={styles.cfgField}><input type="number" min={1} value={urgentH} onChange={(e) => setUrgentH(Number(e.target.value))} /> h de retard</span>
        </label>
      </div>
      <div className={styles.cfgFoot}>
        {saved && <span className={styles.savedTag}><Icon name="check" size={13} /> Enregistré</span>}
        <button type="button" className={styles.btnPrimary} disabled={pending} onClick={save}>Enregistrer</button>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "retard" | "urgent" | "ok" }) {
  return (
    <div className={`${styles.kpi} ${tone ? styles[`kpi_${tone}`] : ""}`}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </div>
  );
}
