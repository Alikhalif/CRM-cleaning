"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import { ACTIVITY_TAG_GROUPS, ACTIVITY_TAG_LABEL, type ActivityTag } from "@/lib/documents/tags";
import { updateClientActivityTags } from "./documents-actions";
import styles from "./ClientDetail.module.scss";

// Section « Activités / Contrats » (§2) : cases à cocher multi-sélection.
// Le CRM proposera ensuite les documents/contrats correspondants.
export default function ClientActivityTags({ clientId, initialTags }: { clientId: string; initialTags: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTags));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const toggle = (tag: ActivityTag) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const save = () => {
    startTransition(async () => {
      await updateClientActivityTags(clientId, [...selected]);
      router.refresh();
      setDirty(false);
      setSaved(true);
    });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.h2}>Activités / Contrats</h2>
      <div className={styles.tagGroups}>
        {ACTIVITY_TAG_GROUPS.map((g) => (
          <div key={g.title} className={styles.tagGroup}>
            <p className={styles.tagGroupTitle}>{g.title}</p>
            <div className={styles.tagChecks}>
              {g.tags.map((tag) => {
                const on = selected.has(tag);
                return (
                  <label key={tag} className={`${styles.tagCheck} ${on ? styles.tagCheckOn : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(tag)} />
                    <span>{ACTIVITY_TAG_LABEL[tag]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.tagFoot}>
        {saved && !dirty && <span className={styles.savedTag}><Icon name="check" size={13} /> Enregistré</span>}
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={pending || !dirty} onClick={save}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </section>
  );
}
