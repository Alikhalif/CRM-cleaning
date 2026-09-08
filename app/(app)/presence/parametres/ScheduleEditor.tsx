"use client";

import { useMemo, useState, useTransition } from "react";
import type { SchedulesData } from "@/lib/presence/schedule-server";
import { setScheduleAction } from "../actions";
import styles from "../presence.module.scss";

// Ordre d'affichage Lundi → Dimanche (weekday Postgres : 0 = dimanche).
const DAYS: { wd: number; label: string }[] = [
  { wd: 1, label: "Lundi" },
  { wd: 2, label: "Mardi" },
  { wd: 3, label: "Mercredi" },
  { wd: 4, label: "Jeudi" },
  { wd: 5, label: "Vendredi" },
  { wd: 6, label: "Samedi" },
  { wd: 0, label: "Dimanche" },
];

type DayState = { on: boolean; start: string; end: string };

export default function ScheduleEditor({ data }: { data: SchedulesData }) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>(data.users[0]?.id ?? "");

  const initialFor = useMemo(() => {
    return (uid: string): Record<number, DayState> => {
      const sched = data.schedules[uid] ?? {};
      const out: Record<number, DayState> = {};
      for (const d of DAYS) {
        const s = sched[d.wd];
        out[d.wd] = s ? { on: true, start: s.start, end: s.end } : { on: false, start: "09:00", end: "18:00" };
      }
      return out;
    };
  }, [data.schedules]);

  const [days, setDays] = useState<Record<number, DayState>>(() => initialFor(data.users[0]?.id ?? ""));

  const onUser = (uid: string) => {
    setUserId(uid);
    setDays(initialFor(uid));
    setFlash(null);
  };
  const patch = (wd: number, p: Partial<DayState>) => setDays((prev) => ({ ...prev, [wd]: { ...prev[wd], ...p } }));

  const save = () =>
    start(async () => {
      const entries = DAYS.map((d) => ({
        weekday: d.wd,
        start: days[d.wd].on ? days[d.wd].start : null,
        end: days[d.wd].on ? days[d.wd].end : null,
      }));
      const r = await setScheduleAction(userId, entries);
      setFlash(r.ok ? "Horaires enregistrés." : r.error ?? "Erreur");
    });

  const applyWeekdays = () => {
    setDays((prev) => {
      const next = { ...prev };
      for (const d of DAYS) next[d.wd] = { on: d.wd >= 1 && d.wd <= 5, start: "09:00", end: "18:00" };
      return next;
    });
  };

  if (data.users.length === 0) {
    return <section className={styles.panel}><header className={styles.panelHead}>Horaires attendus</header><p className={styles.empty}>Aucun utilisateur actif.</p></section>;
  }

  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        Horaires attendus
        <select className={styles.search} value={userId} onChange={(e) => onUser(e.target.value)} style={{ marginLeft: "auto" }}>
          {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </header>
      {flash && <p className={styles.flashOk} style={{ padding: "0 16px" }}>{flash}</p>}
      <div className={styles.scheduleGrid}>
        {DAYS.map((d) => {
          const st = days[d.wd];
          return (
            <div key={d.wd} className={styles.scheduleRow} data-off={!st.on}>
              <label className={styles.toggle}>
                <input type="checkbox" checked={st.on} onChange={(e) => patch(d.wd, { on: e.target.checked })} />
                <span className={styles.dayLabel}>{d.label}</span>
              </label>
              <div className={styles.scheduleTimes}>
                <input type="time" value={st.start} disabled={!st.on} onChange={(e) => patch(d.wd, { start: e.target.value })} />
                <span className={styles.dim}>→</span>
                <input type="time" value={st.end} disabled={!st.on} onChange={(e) => patch(d.wd, { end: e.target.value })} />
                {!st.on && <span className={styles.dim}>repos</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.settingActions}>
        <button type="button" className={styles.miniBtn} onClick={applyWeekdays}>Lun–Ven 9h–18h</button>
        <button type="button" className={styles.primaryBtn} disabled={pending} onClick={save} style={{ marginLeft: 8 }}>
          {pending ? "Enregistrement…" : "Enregistrer les horaires"}
        </button>
      </div>
      <p className={styles.hint} style={{ padding: "0 16px 16px" }}>
        Sert uniquement à l&apos;alerte « non connecté » : un utilisateur est signalé absent s&apos;il n&apos;est pas connecté après son heure de début (+ délai de grâce).
      </p>
    </section>
  );
}
