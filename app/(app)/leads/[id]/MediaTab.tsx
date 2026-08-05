"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { LeadMedia, Consultation } from "@/lib/media-server";
import { deleteLeadMedia, sendConsultation, updateConsultationResponse, updateMediaComment, uploadLeadMedia } from "./media-actions";
import styles from "./MediaTab.module.scss";

type Tech = { id: string; name: string; email: string };

type Props = {
  leadId: string;
  media: LeadMedia[];
  canComment: boolean;
  // Partage/consultation réservé à la planificatrice (+ admin).
  canShare: boolean;
  consultationSubject: string;
  consultationBody: string;
  consultationTemplateName: string;
  technicians: Tech[];
  consultations: Consultation[];
};

const CONSULT_STATUS_LABEL: Record<string, string> = {
  envoyee: "Envoyée", repondue: "Répondue", retenue: "Retenue", refusee: "Refusée",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

function humanSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function MediaTab({
  leadId, media, canComment,
  canShare, consultationSubject, consultationBody, consultationTemplateName, technicians, consultations,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTechId, setShareTechId] = useState("");
  const [shareTo, setShareTo] = useState("");
  const [shareSubject, setShareSubject] = useState(consultationSubject);
  const [shareBody, setShareBody] = useState(consultationBody);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareResult, setShareResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pickTech = (id: string) => {
    setShareTechId(id);
    const t = technicians.find((x) => x.id === id);
    if (t) setShareTo(t.email);
  };

  const doSend = async () => {
    if (!shareTo.trim() || !shareSubject.trim() || !shareBody.trim()) return;
    setShareBusy(true); setShareResult(null);
    const res = await sendConsultation(leadId, {
      recipient: shareTo.trim(),
      subject: shareSubject.trim(),
      message: shareBody,
      intervenantId: shareTechId || undefined,
      templateName: consultationTemplateName,
    });
    setShareBusy(false);
    if (!res.ok) { setShareResult(`❌ ${res.error}`); return; }
    setShareResult("✅ Consultation envoyée à l'intervenant.");
    router.refresh();
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
          {canShare && media.length > 0 && (
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

      {shareOpen && canShare && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            <strong>Demande de chiffrage</strong> à l&apos;intervenant : brief technique pré-rempli + médias (liens 7 j).
            L&apos;<strong>adresse du chantier n&apos;est pas transmise</strong> à cette étape.
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={shareTechId} onChange={(e) => pickTech(e.target.value)}
              style={{ flex: "1 1 180px", padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
              <option value="">— Choisir un intervenant —</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
            </select>
            <input type="email" value={shareTo} onChange={(e) => { setShareTo(e.target.value); setShareTechId(""); }} placeholder="ou email manuel…"
              style={{ flex: "1 1 180px", padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <input value={shareSubject} onChange={(e) => setShareSubject(e.target.value)} placeholder="Objet"
            style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <textarea value={shareBody} onChange={(e) => setShareBody(e.target.value)} rows={9}
            style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)", fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} />
          {shareResult && <span style={{ fontSize: "0.8125rem", color: shareResult.startsWith("✅") ? "var(--tone-success)" : "var(--tone-danger)" }}>{shareResult}</span>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShareOpen(false)} style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>Fermer</button>
            <button type="button" onClick={doSend} disabled={shareBusy || !shareTo.trim() || !shareBody.trim()} style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: shareBusy ? 0.7 : 1 }}>
              {shareBusy ? "Envoi…" : "Envoyer la consultation"}
            </button>
          </div>
        </div>
      )}

      {canShare && consultations.length > 0 && (
        <ConsultationsHistory consultations={consultations} onRefresh={() => router.refresh()} />
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

// ── Historique des consultations intervenants + saisie des réponses ────────
const CONSULT_STATUSES = ["envoyee", "repondue", "retenue", "refusee"] as const;

function ConsultationsHistory({ consultations, onRefresh }: { consultations: Consultation[]; onRefresh: () => void }) {
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)", padding: "12px 14px" }}>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        Consultations envoyées <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· {consultations.length}</span>
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {consultations.map((c) => <ConsultationRow key={c.id} c={c} onRefresh={onRefresh} />)}
      </div>
    </div>
  );
}

function ConsultationRow({ c, onRefresh }: { c: Consultation; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(c.status);
  const [montant, setMontant] = useState(c.montantPropose != null ? String(c.montantPropose) : "");
  const [dispo, setDispo] = useState(c.disponibilites ?? "");
  const [notes, setNotes] = useState(c.notes ?? "");
  const [saving, setSaving] = useState(false);

  const fld: React.CSSProperties = {
    padding: "6px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)",
    background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 13,
  };

  const save = async () => {
    setSaving(true);
    await updateConsultationResponse(c.id, {
      status,
      montantPropose: montant.trim() ? Number(montant) : null,
      disponibilites: dispo,
      notes,
    });
    setSaving(false);
    setOpen(false);
    onRefresh();
  };

  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.intervenantEmail}</strong>
        <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, fontWeight: 700,
          background: "color-mix(in oklab, var(--color-brand-500) 14%, transparent)", color: "var(--color-brand-500)" }}>
          {CONSULT_STATUS_LABEL[c.status] ?? c.status}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{dateFmt.format(new Date(c.sentAt))} · {c.mediaCount} média(s)</span>
        {c.montantPropose != null && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tone-success)" }}>{c.montantPropose} €</span>}
        {c.disponibilites && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {c.disponibilites}</span>}
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--color-brand-500)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {open ? "Fermer" : "Réponse"}
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...fld, flex: "1 1 120px" }}>
              {CONSULT_STATUSES.map((s) => <option key={s} value={s}>{CONSULT_STATUS_LABEL[s]}</option>)}
            </select>
            <input value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant proposé (€)" inputMode="decimal" style={{ ...fld, flex: "1 1 140px" }} />
            <input value={dispo} onChange={(e) => setDispo(e.target.value)} placeholder="Disponibilités" style={{ ...fld, flex: "1 1 160px" }} />
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)…" style={fld} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={save} disabled={saving} style={{ padding: "5px 14px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {saving ? "…" : "Enregistrer la réponse"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
