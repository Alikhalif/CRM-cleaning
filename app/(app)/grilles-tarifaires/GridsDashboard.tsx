"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUS_LABEL, type GridStatus, type PricingGrid } from "@/lib/pricing/grid-types";
import { publishGrid, setGridStatus } from "./actions";
import styles from "./Grilles.module.scss";

type Row = PricingGrid & { configured: number; total: number };

const dateFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "jamais";

export default function GridsDashboard({ grids }: { grids: Row[] }) {
  return (
    <div className={styles.cards}>
      {grids.map((g) => <GridCard key={g.activityId} g={g} />)}
    </div>
  );
}

function GridCard({ g }: { g: Row }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setErr(null);
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) { setErr(r.error); return; }
      router.refresh();
    });
  };

  // Publier est irréversible dans les faits (la version est figée dans
  // l'historique) : on demande confirmation, avec le nom de l'activité.
  const onPublish = () => {
    const ok = window.confirm(
      `Publier la grille « ${g.activityLabel} » ?\n\n` +
        "Elle deviendra la référence utilisée dans les découvertes commerciales.\n" +
        "La version actuelle sera archivée dans l'historique.",
    );
    if (ok) run(() => publishGrid(g.activityId));
  };

  const onToggle = () => {
    const next: GridStatus = g.status === "active" ? "inactive" : "active";
    run(() => setGridStatus(g.activityId, next));
  };

  const jamaisPubliee = g.status === "brouillon";

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardName}>{g.activityLabel}</span>
        <span className={styles.badge} data-s={g.status}>{STATUS_LABEL[g.status]}</span>
      </div>

      <div className={styles.meta}>
        {g.configured} paramètre{g.configured > 1 ? "s" : ""} chiffré{g.configured > 1 ? "s" : ""}
        {g.total > 0 && <> sur {g.total}</>}
        <br />
        Modifiée le {dateFr(g.updatedAt)} · version {g.version}
        <br />
        {g.visibleToCommercial
          ? "Fourchette visible par les commerciaux"
          : "Fourchette masquée aux commerciaux"}
      </div>

      <div className={styles.actions}>
        <Link href={`/grilles-tarifaires/${g.activitySlug}`} className={`${styles.btn} ${styles.btnPrimary}`}>
          Modifier la grille
        </Link>
        <Link href={`/grilles-tarifaires/${g.activitySlug}#simulateur`} className={styles.btn}>
          Aperçu du calcul
        </Link>
        {jamaisPubliee ? (
          <button type="button" className={styles.btn} onClick={onPublish} disabled={busy || g.configured === 0}
            title={g.configured === 0 ? "Aucun tarif saisi : rien à publier." : "Rendre cette grille officielle"}>
            {busy ? "…" : "Publier"}
          </button>
        ) : (
          <button type="button" className={styles.btn} onClick={onToggle} disabled={busy}>
            {busy ? "…" : g.status === "active" ? "Désactiver" : "Activer"}
          </button>
        )}
      </div>

      {err && <p className={styles.err}>{err}</p>}
    </section>
  );
}
