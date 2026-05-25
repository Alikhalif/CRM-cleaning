"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { LegalEntity } from "@/lib/leads";
import EntityFormModal from "./EntityFormModal";
import { deleteEntity } from "./actions";
import styles from "./Entities.module.scss";

type Props = { entities: LegalEntity[] };

export default function EntitiesList({ entities }: Props) {
  const router = useRouter();
  const [modalTarget, setModalTarget] = useState<LegalEntity | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (entity: LegalEntity) => {
    if (!confirm(`Supprimer définitivement « ${entity.legalName} » ?`)) return;
    setBusyId(entity.id);
    startTransition(async () => {
      const result = await deleteEntity(entity.id);
      setBusyId(null);
      if (!result.ok) {
        alert(`Échec : ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.h2}>Sociétés émettrices</h2>
          <p className={styles.count}>
            {entities.length} société{entities.length > 1 ? "s" : ""} configurée{entities.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setModalTarget("new")}
        >
          <Icon name="check" size={14} /> Nouvelle société
        </button>
      </div>

      {entities.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>Aucune société configurée. Cliquez sur « Nouvelle société » pour démarrer.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {entities.map((e) => (
            <li key={e.id} className={styles.item}>
              <span
                className={styles.colorDot}
                style={{ background: e.color }}
                aria-hidden="true"
              />
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>
                  {e.legalName}
                  <span className={styles.itemForm}>{e.legalForm}</span>
                </div>
                <div className={styles.itemMeta}>
                  SIRET {e.siret} · APE {e.apeCode} · TVA {e.vatNumber}
                </div>
                <div className={styles.itemMeta}>
                  {e.addressLine}, {e.postalCode} {e.city}
                </div>
                <div className={styles.itemMetaMono}>
                  IBAN {e.iban} · BIC {e.bic}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setModalTarget(e)}
                  disabled={busyId !== null}
                  title="Modifier"
                  aria-label={`Modifier ${e.legalName}`}
                >
                  <Icon name="edit" size={14} />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => onDelete(e)}
                  disabled={busyId !== null}
                  title="Supprimer"
                  aria-label={`Supprimer ${e.legalName}`}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalTarget !== null && (
        <EntityFormModal
          existing={modalTarget === "new" ? null : modalTarget}
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
