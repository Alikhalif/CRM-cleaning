"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { Commercial } from "@/lib/leads";
import { createRule, updateRule, type RuleInput } from "./actions";
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

export type ExistingRule = {
  id: string;
  name: string;
  priority: number;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
  is_active: boolean;
};

type Props = {
  existing: ExistingRule | null;
  commerciaux: Commercial[];
  onClose: () => void;
  onDone: () => void;
};

function emptyInput(): RuleInput {
  return {
    name: "",
    priority: 100,
    isActive: true,
    surfaceM2Gte: null,
    surfaceM2Lt: null,
    sector: "",
    source: "",
    clientIsPremium: "any",
    amountGte: null,
    actionKind: "assign_to_premium",
    assignToUserId: "",
  };
}

function fromExisting(r: ExistingRule): RuleInput {
  const c = r.conditions;
  const a = r.action;
  return {
    name: r.name,
    priority: r.priority,
    isActive: r.is_active,
    surfaceM2Gte: typeof c.surface_m2_gte === "number" ? c.surface_m2_gte : null,
    surfaceM2Lt: typeof c.surface_m2_lt === "number" ? c.surface_m2_lt : null,
    sector: (typeof c.sector === "string" ? c.sector : "") as RuleInput["sector"],
    source: (typeof c.source === "string" ? c.source : "") as RuleInput["source"],
    clientIsPremium:
      typeof c.client_is_premium === "boolean"
        ? c.client_is_premium ? "true" : "false"
        : "any",
    amountGte: typeof c.amount_gte === "number" ? c.amount_gte : null,
    actionKind: a.assign_to_premium === true ? "assign_to_premium" : "assign_to_user_id",
    assignToUserId: typeof a.assign_to_user_id === "string" ? a.assign_to_user_id : "",
  };
}

export default function RoutingRuleModal({ existing, commerciaux, onClose, onDone }: Props) {
  const [v, setV] = useState<RuleInput>(() => existing ? fromExisting(existing) : emptyInput());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const set = <K extends keyof RuleInput>(key: K, val: RuleInput[K]) =>
    setV((cur) => ({ ...cur, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = existing ? await updateRule(existing.id, v) : await createRule(v);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} style={{ maxWidth: 640 }} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="rule-title" className={styles.title}>
              {existing ? "Modifier la règle" : "Nouvelle règle de routing"}
            </h2>
            <p className={styles.subtitle}>
              Conditions ET-logiques · première règle qui matche gagne (ordre par priorité croissante).
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={submitting} aria-label="Fermer">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.row}>
            <label className={styles.field} style={{ flex: 2 }}>
              <span className={styles.label}>Nom</span>
              <input
                ref={firstInputRef}
                type="text"
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                required
                className={styles.input}
                placeholder="ex. Gros chantier rénovation → commercial premium"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Priorité</span>
              <input
                type="number"
                value={v.priority}
                onChange={(e) => set("priority", Number(e.target.value))}
                className={styles.input}
              />
            </label>
            <label className={styles.field} style={{ flex: "0 0 auto", alignItems: "flex-start" }}>
              <span className={styles.label}>Active</span>
              <input
                type="checkbox"
                checked={v.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                style={{ width: 24, height: 24, marginTop: 8 }}
              />
            </label>
          </div>

          <fieldset style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)", padding: "var(--sp-3)" }}>
            <legend style={{ padding: "0 var(--sp-2)", fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
              Conditions (toutes optionnelles, ET-logique)
            </legend>

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Superficie ≥ (m²)</span>
                <input
                  type="number"
                  value={v.surfaceM2Gte ?? ""}
                  onChange={(e) => set("surfaceM2Gte", e.target.value ? Number(e.target.value) : null)}
                  className={styles.input}
                  placeholder="80"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Superficie &lt; (m²)</span>
                <input
                  type="number"
                  value={v.surfaceM2Lt ?? ""}
                  onChange={(e) => set("surfaceM2Lt", e.target.value ? Number(e.target.value) : null)}
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Montant ≥ (€)</span>
                <input
                  type="number"
                  value={v.amountGte ?? ""}
                  onChange={(e) => set("amountGte", e.target.value ? Number(e.target.value) : null)}
                  className={styles.input}
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Secteur</span>
                <select value={v.sector} onChange={(e) => set("sector", e.target.value as RuleInput["sector"])} className={styles.input}>
                  <option value="">Indifférent</option>
                  <option value="urgence">Urgence</option>
                  <option value="nettoyage">Nettoyage</option>
                  <option value="enr">ENR</option>
                  <option value="renovation">Rénovation</option>
                  <option value="debarras">Débarras</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Source</span>
                <select value={v.source} onChange={(e) => set("source", e.target.value as RuleInput["source"])} className={styles.input}>
                  <option value="">Indifférente</option>
                  <option value="google_ads">Google Ads</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="site_web">Site web</option>
                  <option value="telephone">Téléphone</option>
                  <option value="recommandation">Recommandation</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Client premium</span>
                <select
                  value={v.clientIsPremium}
                  onChange={(e) => set("clientIsPremium", e.target.value as RuleInput["clientIsPremium"])}
                  className={styles.input}
                >
                  <option value="any">Indifférent</option>
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)", padding: "var(--sp-3)" }}>
            <legend style={{ padding: "0 var(--sp-2)", fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
              Action
            </legend>

            <div className={styles.row} style={{ marginBottom: "var(--sp-2)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1 }}>
                <input
                  type="radio"
                  name="actionKind"
                  value="assign_to_premium"
                  checked={v.actionKind === "assign_to_premium"}
                  onChange={() => set("actionKind", "assign_to_premium")}
                />
                <span>Pool commerciaux <strong>premium</strong> (round-robin par charge)</span>
              </label>
            </div>
            <div className={styles.row}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flex: 1 }}>
                <input
                  type="radio"
                  name="actionKind"
                  value="assign_to_user_id"
                  checked={v.actionKind === "assign_to_user_id"}
                  onChange={() => set("actionKind", "assign_to_user_id")}
                />
                <span>Commercial spécifique :</span>
                <select
                  value={v.assignToUserId}
                  onChange={(e) => set("assignToUserId", e.target.value)}
                  className={styles.input}
                  disabled={v.actionKind !== "assign_to_user_id"}
                  style={{ flex: 1 }}
                >
                  <option value="">— sélectionner —</option>
                  {commerciaux.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          {error && (
            <p className={styles.error} role="alert">
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? "Enregistrement…" : existing ? "Mettre à jour" : "Créer la règle"}
          </button>
        </footer>
      </form>
    </div>
  );
}
