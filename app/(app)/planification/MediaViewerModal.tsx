"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { LeadMedia } from "@/lib/media-server";
import { loadDossierMedia } from "./actions";

type Props = {
  leadId: string;
  clientName: string;
  onClose: () => void;
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
};

// Visionneuse des photos/vidéos d'un dossier — accessible depuis la liste de
// planification (rôle planificatrice/admin). Charge à la demande les URLs
// signées ; grille de vignettes + lightbox plein écran + téléchargement.
export default function MediaViewerModal({ leadId, clientName, onClose }: Props) {
  const [media, setMedia] = useState<LeadMedia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadDossierMedia(leadId).then((r) => {
      if (!alive) return;
      if (r.ok) setMedia(r.media);
      else setError(r.error);
    });
    return () => { alive = false; };
  }, [leadId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (lightbox !== null) setLightbox(null); else onClose(); }
      if (media && lightbox !== null) {
        if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % media.length));
        if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + media.length) % media.length));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, media, onClose]);

  const current = media && lightbox !== null ? media[lightbox] : null;

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={overlay}>
      <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-lg)", padding: 20, width: "100%", maxWidth: 820, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="image" size={17} /> Photos &amp; vidéos — {clientName}
            {media && <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-muted)" }}>({media.length})</span>}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <Icon name="x" size={20} />
          </button>
        </div>

        {error && <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }} role="alert"><Icon name="alert" size={14} /> {error}</p>}

        {!media && !error && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", padding: "24px 0", textAlign: "center" }}>Chargement des médias…</p>
        )}

        {media && media.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", padding: "24px 0", textAlign: "center" }}>
            Aucune photo ni vidéo pour ce dossier.
          </p>
        )}

        {media && media.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {media.map((m, i) => (
              <figure key={m.id} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  title="Agrandir"
                  style={{ position: "relative", padding: 0, border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)", overflow: "hidden", cursor: "pointer", background: "var(--bg-surface-2)", aspectRatio: "1 / 1" }}
                >
                  {m.kind === "video" ? (
                    <>
                      <video src={m.url ?? undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted preload="metadata" />
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "rgba(0,0,0,0.25)" }}>
                        <Icon name="zap" size={22} />
                      </span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url ?? undefined} alt={m.comment ?? m.fileName} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  )}
                </button>
                <figcaption style={{ fontSize: "0.6875rem", color: "var(--text-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.comment ?? m.fileName}>
                  {m.comment || m.fileName}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {current && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 24, flexDirection: "column", gap: 12 }}
        >
          <div style={{ maxWidth: "92vw", maxHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {current.kind === "video" ? (
              <video src={current.url ?? undefined} controls autoPlay style={{ maxWidth: "92vw", maxHeight: "80vh", borderRadius: "var(--r-md)" }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url ?? undefined} alt={current.comment ?? current.fileName} style={{ maxWidth: "92vw", maxHeight: "80vh", objectFit: "contain", borderRadius: "var(--r-md)" }} />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#fff" }}>
            {media && media.length > 1 && (
              <button type="button" onClick={() => setLightbox((i) => (i === null ? i : (i - 1 + media.length) % media.length))} aria-label="Précédent" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "var(--r-sm)", padding: "6px 10px", cursor: "pointer" }}>
                <Icon name="chevron-down" size={18} />
              </button>
            )}
            <a href={current.url ?? "#"} download={current.fileName} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--color-brand-500)", color: "#fff", borderRadius: "var(--r-sm)", padding: "6px 14px", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
              <Icon name="document" size={15} /> Télécharger
            </a>
            {media && media.length > 1 && (
              <button type="button" onClick={() => setLightbox((i) => (i === null ? i : (i + 1) % media.length))} aria-label="Suivant" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "var(--r-sm)", padding: "6px 10px", cursor: "pointer" }}>
                <Icon name="chevron-down" size={18} />
              </button>
            )}
            <button type="button" onClick={() => setLightbox(null)} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "var(--r-sm)", padding: "6px 10px", cursor: "pointer" }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
