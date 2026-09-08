"use client";

import { useState, useTransition } from "react";
import type { AlertRule } from "@/lib/presence/types";
import { updateRuleAction, setThresholdsAction } from "../actions";
import styles from "../presence.module.scss";

const THRESHOLD_LABELS: Record<string, string> = {
  heartbeat_seconds: "Cadence du battement (s)",
  active_window_seconds: "Fenêtre d'activité (s)",
  inactive_after_minutes: "Inactif après (min)",
  offline_after_minutes: "Hors ligne après (min)",
};
const RULE_FIELD_LABELS: Record<string, string> = {
  watch_minutes: "À surveiller (min)",
  warn_minutes: "Retard (min)",
  critical_minutes: "Critique (min)",
  grace_minutes: "Délai de grâce (min)",
  minutes: "Seuil (min)",
  hours: "Seuil (heures)",
  days: "Seuil (jours)",
};

export default function AlertSettings({ rules, thresholds }: { rules: AlertRule[]; thresholds: Record<string, number> }) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [th, setTh] = useState<Record<string, number>>(thresholds);
  const [ruleState, setRuleState] = useState<AlertRule[]>(rules);

  const saveThresholds = () =>
    start(async () => {
      const r = await setThresholdsAction(th);
      setFlash(r.ok ? "Seuils de présence enregistrés." : r.error ?? "Erreur");
    });

  const saveRule = (rule: AlertRule) =>
    start(async () => {
      const r = await updateRuleAction(rule.key, { enabled: rule.enabled, config: rule.config });
      setFlash(r.ok ? `Règle « ${rule.label} » enregistrée.` : r.error ?? "Erreur");
    });

  const patchRule = (key: string, patch: Partial<AlertRule>) =>
    setRuleState((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <>
      {flash && <p className={styles.flashOk}>{flash}</p>}

      <section className={styles.panel}>
        <header className={styles.panelHead}>Présence — seuils</header>
        <div className={styles.settingsGrid}>
          {Object.keys(THRESHOLD_LABELS).map((k) => (
            <label key={k} className={styles.settingField}>
              <span>{THRESHOLD_LABELS[k]}</span>
              <input type="number" min={1} value={th[k] ?? ""} onChange={(e) => setTh({ ...th, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <div className={styles.settingActions}>
          <button type="button" className={styles.primaryBtn} disabled={pending} onClick={saveThresholds}>Enregistrer les seuils</button>
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHead}>Règles d&apos;alerte</header>
        <div className={styles.rulesList}>
          {ruleState.map((rule) => (
            <div key={rule.key} className={styles.ruleCard} data-off={!rule.enabled}>
              <div className={styles.ruleHead}>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={rule.enabled} onChange={(e) => patchRule(rule.key, { enabled: e.target.checked })} />
                  <strong>{rule.label}</strong>
                </label>
                <button type="button" className={styles.miniBtn} disabled={pending} onClick={() => saveRule(rule)}>Enregistrer</button>
              </div>
              <div className={styles.ruleFields}>
                {Object.keys(rule.config).map((ck) => (
                  <label key={ck} className={styles.settingField}>
                    <span>{RULE_FIELD_LABELS[ck] ?? ck}</span>
                    <input
                      type="number"
                      min={0}
                      value={Number(rule.config[ck] ?? 0)}
                      onChange={(e) => patchRule(rule.key, { config: { ...rule.config, [ck]: Number(e.target.value) } })}
                    />
                  </label>
                ))}
                {Object.keys(rule.config).length === 0 && <span className={styles.dim}>Aucun paramètre.</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
