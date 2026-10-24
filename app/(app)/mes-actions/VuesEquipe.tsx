"use client";

// Vues secondaires de « Mes actions », réservées au manager et au Super
// Admin : photos en attente, pilotage de l'équipe, réglage des règles.
//
// Ce code est REPRIS TEL QUEL de l'ancien module « Ma journée ». Il n'a pas
// été réécrit : la refonte porte sur l'écran du commercial, et ces trois
// vues fonctionnent. Les extraire ici permet à la nouvelle page de rester
// lisible sans rien perdre de l'existant.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  bucketOf, effectiveDue, relativeFr,
  BUCKET_LABEL, TYPE_LABEL, PHOTO_SUBTYPE_LABEL,
  type ActionType,
} from "@/lib/commercial-actions/shared";
import type { ManagerData, CommercialRule, PhotoWaitingRow } from "@/lib/commercial-actions/read-server";
import { updateCommercialRule } from "@/app/(app)/ma-journee/actions";
import styles from "./mes-actions.module.scss";

const CHANNEL_LABEL: Record<"email" | "sms", string> = { email: "E-mail", sms: "SMS" };

export function PhotoWaitingView({ rows, now, showOwner }: { rows: PhotoWaitingRow[]; now: number; showOwner: boolean }) {
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
export function ManagerView({ data, now, isAdmin, rules }: { data: ManagerData; now: number; isAdmin: boolean; rules: CommercialRule[] }) {
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
            {(["prise_en_charge", "decouverte", "photos", "devis", "relance"] as ActionType[]).map((t) => (
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
