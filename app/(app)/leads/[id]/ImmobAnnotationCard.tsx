"use client";

import Icon from "@/components/Icon/Icon";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateImmobTravauxAnnotation } from "@/app/(app)/pipeline/actions";
import styles from "./LeadDetail.module.scss";

// Confidential Immobilier/Travaux annotation (CDC §3.5). Visibility is
// already gated on the parent page by the immobTravaux permission — this
// component just renders the inline editor with a save button.

type Props = {
  leadId: string;
  initialValue: string;
};

export default function ImmobAnnotationCard({ leadId, initialValue }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const save = () => {
    setSaving(true);
    startTransition(async () => {
      const result = await updateImmobTravauxAnnotation(leadId, value);
      setSaving(false);
      if (!result.ok) {
        alert(`Échec : ${result.error}`);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setValue(initialValue);
    setEditing(false);
  };

  return (
    <section className={`${styles.card} ${styles.cardConfidential}`}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}>
          <Icon name="alert" size={14} /> Annotation Immobilier / Travaux
          <span className={styles.confidentialTag}>Confidentiel</span>
        </h2>
        {!editing && (
          <button type="button" className={styles.linkBtn} onClick={() => setEditing(true)}>
            <Icon name="edit" size={12} /> {initialValue ? "Modifier" : "Ajouter"}
          </button>
        )}
      </header>

      {editing ? (
        <>
          <textarea
            className={styles.notesArea}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="Contexte immobilier ou travaux confidentiel pour ce lead…"
            autoFocus
          />
          <div className={styles.cardActions}>
            <button type="button" className={styles.btnGhost} onClick={cancel} disabled={saving}>
              Annuler
            </button>
            <button type="button" className={styles.btnPrimary} onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </>
      ) : initialValue ? (
        <p className={styles.note}>{initialValue}</p>
      ) : (
        <p className={styles.empty}>
          Aucune annotation. Cliquez sur Ajouter pour documenter le contexte immobilier ou travaux de ce lead.
        </p>
      )}
    </section>
  );
}
