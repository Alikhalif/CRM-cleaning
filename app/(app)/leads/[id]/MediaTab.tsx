"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { LeadMedia } from "@/lib/media-server";
import { deleteLeadMedia, shareLeadMediaWithIntervenant, updateMediaComment, uploadLeadMedia } from "./media-actions";
import styles from "./MediaTab.module.scss";

type Props = { leadId: string; media: LeadMedia[]; canComment: boolean };

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

function humanSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function MediaTab({ leadId, media, canComment }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTo, setShareTo] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareResult, setShareResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const doShare = async () => {
    if (!shareTo.trim()) return;
    setShareBusy(true); setShareResult(null);
    const res = await shareLeadMediaWithIntervenant(leadId, shareTo.trim(), shareMsg);
    setShareBusy(false);
    setShareResult(res.ok ? "✅ Médias envoyés à l'intervenant." : `❌ ${res.error}`);
    if (res.ok) { setShareTo(""); setShareMsg(""); }
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const res = await uploadLeadMedia(leadId, fd);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  };

  const onDelete = (m: LeadMedia) => {
    if (!confirm(`Supprimer « ${m.fileName} » ? Cette action est définitive.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteLeadMedia(m.id);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  };

  // Fermeture / navigation de la lightbox au clavier.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : Math.min(i + 1, media.length - 1)));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, media.length]);

  const current = lightbox !== null ? media[lightbox] : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.dropzone}>
        <span className={styles.dropInfo}>
          Photos &amp; vidéos du dossier — centralisées, accessibles à la planificatrice.
          <br />Formats image/vidéo · 100 Mo max par fichier.
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={(e) => onFiles(e.target.files)}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {media.length > 0 && (
            <button
              type="button"
              className={styles.uploadBtn}
              style={{ background: "transparent", color: "var(--color-brand-500)", border: "1px solid var(--border-strong)" }}
              onClick={() => setShareOpen((o) => !o)}
            >
              <Icon name="mail" size={16} /> Partager à l&apos;intervenant
            </button>
          )}
          <button
            type="button"
            className={styles.uploadBtn}
            data-busy={busy ? "1" : undefined}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="plus" size={16} /> {busy ? "Envoi…" : "Ajouter des fichiers"}
          </button>
        </div>
      </div>

      {shareOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Envoie <strong>tous les médias</strong> du dossier par email (liens valables 7 jours) à l&apos;intervenant.
          </span>
          <input type="email" value={shareTo} onChange={(e) => setShareTo(e.target.value)} placeholder="intervenant@exemple.fr"
            style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <textarea value={shareMsg} onChange={(e) => setShareMsg(e.target.value)} placeholder="Message (optionnel)…" rows={2}
            style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)", fontFamily: "inherit", resize: "vertical" }} />
          {shareResult && <span style={{ fontSize: "0.8125rem", color: shareResult.startsWith("✅") ? "var(--tone-success)" : "var(--tone-danger)" }}>{shareResult}</span>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShareOpen(false)} style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>Fermer</button>
            <button type="button" onClick={doShare} disabled={shareBusy || !shareTo.trim()} style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: shareBusy ? 0.7 : 1 }}>
              {shareBusy ? "Envoi…" : "Envoyer les liens"}
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert"><Icon name="alert" size={14} /> {error}</p>}

      {media.length === 0 ? (
        <div className={styles.empty}>
          Aucune photo ni vidéo pour ce dossier. Ajoutez-les ici pour qu&apos;elles soient
          disponibles pour la planification.
        </div>
      ) : (
        <div className={styles.grid}>
          {media.map((m, i) => (
            <MediaCard
              key={m.id}
              m={m}
              canComment={canComment}
              onOpen={() => setLightbox(i)}
              onDelete={() => onDelete(m)}
            />
          ))}
        </div>
      )}

      {current && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
        >
          <button type="button" className={styles.lightClose} aria-label="Fermer" onClick={() => setLightbox(null)}>×</button>
          {current.kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url ?? ""} alt={current.fileName} className={styles.lightMedia} />
          ) : (
            <video src={current.url ?? ""} className={styles.lightMedia} controls autoPlay />
          )}
          <div className={styles.lightBar}>
            <button
              type="button"
              className={styles.lightBtn}
              disabled={lightbox === 0}
              onClick={() => setLightbox((idx) => (idx === null ? idx : Math.max(idx - 1, 0)))}
            >
              ← Précédent
            </button>
            <span className={styles.lightName}>{current.fileName}</span>
            <a className={styles.lightBtn} href={current.url ?? "#"} download={current.fileName} target="_blank" rel="noopener noreferrer">
              Télécharger
            </a>
            <button
              type="button"
              className={styles.lightBtn}
              disabled={lightbox === media.length - 1}
              onClick={() => setLightbox((idx) => (idx === null ? idx : Math.min(idx + 1, media.length - 1)))}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaCard({
  m, canComment, onOpen, onDelete,
}: {
  m: LeadMedia;
  canComment: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [comment, setComment] = useState(m.comment ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = comment.trim() !== (m.comment ?? "").trim();

  const save = async () => {
    setSaving(true);
    await updateMediaComment(m.id, comment);
    setSaving(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.thumb} onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
        <span className={styles.kindTag}>{m.kind === "photo" ? "Photo" : "Vidéo"}</span>
        {m.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url ?? ""} alt={m.fileName} loading="lazy" />
        ) : (
          <>
            <video src={m.url ?? ""} muted preload="metadata" />
            <span className={styles.playBadge}>▶</span>
          </>
        )}
      </div>
      <div className={styles.meta}>
        <span className={styles.fileName} title={m.fileName}>{m.fileName}</span>
        <span className={styles.sub}>
          {dateFmt.format(new Date(m.createdAt))}
          {m.uploaderName ? ` · ${m.uploaderName}` : ""}
          {m.sizeBytes ? ` · ${humanSize(m.sizeBytes)}` : ""}
        </span>

        {canComment ? (
          <>
            <textarea
              className={styles.commentBox}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Commentaire interne…"
            />
            {dirty && (
              <button type="button" className={styles.iconAction} disabled={saving} onClick={save}>
                <Icon name="check" size={13} /> {saving ? "…" : "Enregistrer"}
              </button>
            )}
          </>
        ) : (
          m.comment && <span className={styles.sub}>💬 {m.comment}</span>
        )}

        <div className={styles.cardActions}>
          <a className={styles.iconAction} href={m.url ?? "#"} download={m.fileName} target="_blank" rel="noopener noreferrer">
            <Icon name="document" size={13} /> Télécharger
          </a>
          {m.canDelete && (
            <button type="button" className={styles.iconAction} data-danger="1" onClick={onDelete}>
              <Icon name="x" size={13} /> Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
