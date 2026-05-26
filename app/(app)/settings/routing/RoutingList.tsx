"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { Commercial } from "@/lib/leads";
import RoutingRuleModal, { type ExistingRule } from "./RoutingRuleModal";
import { deleteRule, toggleRuleActive } from "./actions";
import styles from "./Routing.module.scss";

type Props = {
  rules: ExistingRule[];
  commerciaux: Commercial[];
};

export default function RoutingList({ rules, commerciaux }: Props) {
  const router = useRouter();
  const [modalTarget, setModalTarget] = useState<ExistingRule | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onToggle = (rule: ExistingRule) => {
    setBusyId(rule.id);
    startTransition(async () => {
      const r = await toggleRuleActive(rule.id, !rule.is_active);
      setBusyId(null);
      if (!r.ok) alert(`Échec : ${r.error}`);
      else router.refresh();
    });
  };

  const onDelete = (rule: ExistingRule) => {
    if (!confirm(`Supprimer définitivement la règle « ${rule.name} » ?`)) return;
    setBusyId(rule.id);
    startTransition(async () => {
      const r = await deleteRule(rule.id);
      setBusyId(null);
      if (!r.ok) alert(`Échec : ${r.error}`);
      else router.refresh();
    });
  };

  const commerciauxById = new Map(commerciaux.map((c) => [c.id, c]));

  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.h2}>Règles de routing</h2>
          <p className={styles.count}>
            {rules.length} règle{rules.length > 1 ? "s" : ""} configurée{rules.length > 1 ? "s" : ""} · {rules.filter((r) => r.is_active).length} active{rules.filter((r) => r.is_active).length > 1 ? "s" : ""}
          </p>
        </div>
        <button type="button" className={styles.newBtn} onClick={() => setModalTarget("new")}>
          <Icon name="check" size={14} /> Nouvelle règle
        </button>
      </div>

      {rules.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>
            Aucune règle configurée. Sans règle, les leads créés en mode auto (WF1 webhook) gardent
            leur owner d&apos;origine. Créez une règle pour automatiser l&apos;attribution.
          </p>
        </div>
      ) : (
        <ol className={styles.list}>
          {rules.map((rule) => (
            <li key={rule.id} className={styles.item} data-active={rule.is_active || undefined}>
              <span className={styles.priorityBadge}>#{rule.priority}</span>
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>
                  {rule.name}
                  {!rule.is_active && <span className={styles.inactiveTag}>Désactivée</span>}
                </div>
                <div className={styles.itemMeta}>
                  <strong>Si</strong> {formatConditions(rule.conditions)}
                </div>
                <div className={styles.itemMeta}>
                  <strong>Alors</strong> {formatAction(rule.action, commerciauxById)}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => onToggle(rule)}
                  disabled={busyId !== null}
                  title={rule.is_active ? "Désactiver" : "Activer"}
                >
                  <Icon name={rule.is_active ? "x" : "check"} size={14} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setModalTarget(rule)}
                  disabled={busyId !== null}
                  title="Modifier"
                >
                  <Icon name="edit" size={14} />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => onDelete(rule)}
                  disabled={busyId !== null}
                  title="Supprimer"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {modalTarget !== null && (
        <RoutingRuleModal
          existing={modalTarget === "new" ? null : modalTarget}
          commerciaux={commerciaux}
          onClose={() => setModalTarget(null)}
          onDone={() => {
            setModalTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function formatConditions(c: Record<string, unknown>): string {
  const bits: string[] = [];
  if (typeof c.surface_m2_gte === "number") bits.push(`superficie ≥ ${c.surface_m2_gte} m²`);
  if (typeof c.surface_m2_lt === "number") bits.push(`superficie < ${c.surface_m2_lt} m²`);
  if (typeof c.amount_gte === "number") bits.push(`montant ≥ ${c.amount_gte} €`);
  if (typeof c.sector === "string") bits.push(`secteur = ${c.sector}`);
  if (typeof c.source === "string") bits.push(`source = ${c.source}`);
  if (typeof c.client_is_premium === "boolean") bits.push(`client premium = ${c.client_is_premium ? "oui" : "non"}`);
  return bits.length === 0 ? "(toutes conditions)" : bits.join(" ET ");
}

function formatAction(a: Record<string, unknown>, commerciauxById: Map<string, Commercial>): string {
  if (a.assign_to_premium === true) return "attribuer au pool premium (round-robin)";
  if (typeof a.assign_to_user_id === "string") {
    const user = commerciauxById.get(a.assign_to_user_id);
    return `attribuer à ${user?.name ?? "(commercial inconnu)"}`;
  }
  return "(action non définie)";
}
