"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  DOC_CATEGORY_LABEL, DOC_KIND_LABEL, DOC_KINDS,
  type ClientDocument, type DocCategory, type DocKind,
} from "@/lib/documents/types";
import { uploadClientDocument, deleteClientDocument } from "./documents-actions";
import styles from "./ClientDetail.module.scss";

const CATEGORY_FILTERS: (DocCategory | "all")[] = ["all", "hotte", "desinsectisation", "deratisation", "nuisibles", "nettoyage", "autre"];
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export default function ClientDocuments({ clientId, documents }: { clientId: string; documents: ClientDocument[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<DocCategory | "all">("all");
  const [showUpload, setShowUpload] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocKind>("piece_jointe");
  const [category, setCategory] = useState<string>("");
  const [title, setTitle] = useState("");

  const rows = filter === "all" ? documents : documents.filter((d) => d.category === filter);

  const submit = () => {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setError("Sélectionnez au moins un fichier."); return; }
    setError(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    fd.append("kind", kind);
    if (category) fd.append("category", category);
    if (title.trim()) fd.append("title", title.trim());
    startTransition(async () => {
      const res = await uploadClientDocument(clientId, fd);
      if (!res.ok) { setError(res.error); return; }
      if (fileRef.current) fileRef.current.value = "";
      setTitle(""); setShowUpload(false);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      await deleteClientDocument(id);
      router.refresh();
      setBusyId(null);
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.docHead}>
        <h2 className={styles.h2}>Documents &amp; Contrats <span className={styles.h2Count}>{documents.length}</span></h2>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowUpload((v) => !v)}>
          <Icon name="plus" size={14} /> Ajouter un document
        </button>
      </div>

      {showUpload && (
        <div className={styles.uploadPanel}>
          <div className={styles.uploadRow}>
            <label className={styles.uploadField}>
              <span>Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
                {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className={styles.uploadField}>
              <span>Activité</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                {CATEGORY_FILTERS.filter((c) => c !== "all").map((c) => (
                  <option key={c} value={c}>{DOC_CATEGORY_LABEL[c as DocCategory]}</option>
                ))}
              </select>
            </label>
            <label className={`${styles.uploadField} ${styles.uploadTitle}`}>
              <span>Intitulé (optionnel)</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Contrat hotte 2026" />
            </label>
          </div>
          <div className={styles.uploadRow}>
            <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className={styles.fileInput} />
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={pending} onClick={submit}>
              {pending ? "Envoi…" : "Téléverser"}
            </button>
          </div>
          {error && <p className={styles.uploadError}><Icon name="alert" size={13} /> {error}</p>}
          <p className={styles.uploadHint}>PDF ou image, 25 Mo max. Le document est classé automatiquement sous le client.</p>
        </div>
      )}

      <div className={styles.docFilters}>
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.chip} ${filter === c ? styles.chipOn : ""}`}
            onClick={() => setFilter(c)}
          >
            {c === "all" ? "Tous" : DOC_CATEGORY_LABEL[c as DocCategory]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>Aucun document {filter !== "all" ? "dans cette catégorie" : "pour ce client"}.</p>
      ) : (
        <ul className={styles.docList}>
          {rows.map((d) => (
            <li key={`${d.source}:${d.id}`} className={styles.docItem}>
              <span className={styles.docIcon}><Icon name="document" size={16} /></span>
              <div className={styles.docBody}>
                <div className={styles.docTitleRow}>
                  <span className={styles.docTitle}>{d.title}</span>
                  <span className={styles.docBadge}>{DOC_KIND_LABEL[d.kind]}</span>
                  {d.category && <span className={styles.docCat}>{DOC_CATEGORY_LABEL[d.category]}</span>}
                  {d.signed && <span className={styles.docSigned}><Icon name="check" size={11} /> Signé</span>}
                  {d.source === "cert_hotte" && <span className={styles.docRO} title="Certificat hotte (lecture seule)">certif. hotte</span>}
                </div>
                <div className={styles.docMeta}>
                  {d.ref && <span className={styles.mono}>{d.ref}</span>}
                  <span>{DATE.format(new Date(d.createdAt))}</span>
                  {d.createdByName && <span>· {d.createdByName}</span>}
                  {d.status && <span>· {d.status}</span>}
                </div>
              </div>
              <div className={styles.docActions}>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className={styles.docLink} title="Ouvrir / télécharger">
                    <Icon name="external-link" size={15} />
                  </a>
                ) : (
                  <span className={styles.docNoFile} title="Aucun fichier">—</span>
                )}
                {d.canDelete && (
                  <button type="button" className={styles.docDel} disabled={pending && busyId === d.id} onClick={() => remove(d.id)} title="Supprimer" aria-label="Supprimer le document">
                    <Icon name="x" size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
