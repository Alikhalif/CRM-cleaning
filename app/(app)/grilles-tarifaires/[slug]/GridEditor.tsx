"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  BAND_SECTIONS, SECTION_LABEL, SECTIONS, STATUS_LABEL,
  type Grid, type GridLine, type GridSection, type PricingGrid,
} from "@/lib/pricing/grid-types";
import { computeGrid, type GridInput } from "@/lib/pricing/grid-compute";
import { publishGrid, saveGrid, type GridSettings } from "../actions";
import styles from "./Editor.module.scss";

// Éditeur d'une grille + simulateur. Le Super Admin teste AVANT de publier :
// une grille en brouillon n'est jamais utilisée par un commercial.

const euro = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

export default function GridEditor({ initial }: { initial: PricingGrid }) {
  const router = useRouter();
  const [grid, setGrid] = useState<Grid>(initial.grid ?? {});
  const [s, setS] = useState<GridSettings>({
    visibleToCommercial: initial.visibleToCommercial,
    visibleToSubcontractor: initial.visibleToSubcontractor,
    allowCommercialOverride: initial.allowCommercialOverride,
    maxDiscountPct: initial.maxDiscountPct,
    floorPrice: initial.floorPrice,
    positioningPct: initial.positioningPct,
    vatRate: initial.vatRate,
    rounding: initial.rounding,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const setLine = (section: GridSection, i: number, patch: Partial<GridLine>) =>
    setGrid((g) => {
      const list = [...(g[section] ?? [])];
      list[i] = { ...list[i], ...patch };
      return { ...g, [section]: list };
    });

  const addLine = (section: GridSection) =>
    setGrid((g) => ({
      ...g,
      [section]: [
        ...(g[section] ?? []),
        section === "majorations"
          ? { key: `custom_${Date.now()}`, label: "Nouvelle majoration", minPct: 0, maxPct: 0 }
          : { key: `custom_${Date.now()}`, label: "Nouveau paramètre", min: 0, max: 0 },
      ],
    }));

  const removeLine = (section: GridSection, i: number) =>
    setGrid((g) => ({ ...g, [section]: (g[section] ?? []).filter((_, j) => j !== i) }));

  const run = (key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setErr(null); setSaved(null); setBusy(key);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) { setErr(r.error); return; }
      // Horodatage réel de la confirmation serveur.
      setSaved(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
    });
  };

  const onSave = () => run("save", () => saveGrid(initial.activityId, grid, s));
  const onPublish = () => {
    const ok = window.confirm(
      `Publier « ${initial.activityLabel} » ?\n\nLes modifications non enregistrées ne seront pas publiées : enregistrez d'abord.`,
    );
    if (ok) run("publish", () => publishGrid(initial.activityId));
  };

  return (
    <div className={styles.wrap}>
      <nav className={styles.crumbs}>
        <Link href="/grilles-tarifaires">Grilles tarifaires</Link>
        <span aria-hidden> / </span>
        <span>{initial.activityLabel}</span>
      </nav>

      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{initial.activityLabel}</h1>
          <p className={styles.sub}>
            Statut&nbsp;: <strong>{STATUS_LABEL[initial.status]}</strong> · version {initial.version}
            {initial.status === "brouillon" && " — aucun commercial ne voit ces tarifs."}
          </p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSave} disabled={busy !== null}>
            {busy === "save" ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" className={styles.btn} onClick={onPublish} disabled={busy !== null}>
            {busy === "publish" ? "…" : "Publier la grille"}
          </button>
        </div>
      </header>
      {saved && <p className={styles.ok}>✓ Enregistré à {saved}</p>}
      {err && <p className={styles.err}>{err}</p>}

      <Simulateur grid={grid} settings={s} base={initial} />

      {/* ── Réglages généraux ─────────────────────────────────────────── */}
      <section className={styles.block}>
        <h2 className={styles.h2}>Réglages</h2>
        <div className={styles.settings}>
          <Toggle label="Fourchette visible par les commerciaux" value={s.visibleToCommercial}
            onChange={(v) => setS({ ...s, visibleToCommercial: v })}
            hint="Ils ne voient jamais la grille — seulement le résultat du calcul." />
          <Toggle label="Visible par les sous-traitants" value={s.visibleToSubcontractor}
            onChange={(v) => setS({ ...s, visibleToSubcontractor: v })}
            hint="Fermé par défaut." />
          <Toggle label="Le commercial peut modifier le prix conseillé" value={s.allowCommercialOverride}
            onChange={(v) => setS({ ...s, allowCommercialOverride: v })} />
          <Num label="Position du prix conseillé (%)" value={s.positioningPct}
            onChange={(v) => setS({ ...s, positioningPct: v })}
            hint="75 % = plutôt haut dans la fourchette." />
          <Num label="Remise maximale autorisée (%)" value={s.maxDiscountPct}
            onChange={(v) => setS({ ...s, maxDiscountPct: v })} />
          <Num label="Prix plancher (€)" value={s.floorPrice} onChange={(v) => setS({ ...s, floorPrice: v })} />
          <Num label="Arrondi commercial (€)" value={s.rounding} onChange={(v) => setS({ ...s, rounding: v })}
            hint="0 = pas d'arrondi." />
          <label className={styles.field}>
            <span className={styles.lbl}>TVA (%)</span>
            <input type="number" min={0} step="0.1" className={styles.inp}
              value={s.vatRate ?? ""} placeholder="non configurée"
              onChange={(e) => setS({ ...s, vatRate: e.target.value === "" ? null : Number(e.target.value) })} />
            <span className={styles.hint}>Vide = montants annoncés HT, aucun taux supposé.</span>
          </label>
        </div>
      </section>

      {/* ── Sections de la grille ─────────────────────────────────────── */}
      {SECTIONS.map((section) => (
        <section key={section} className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.h2}>{SECTION_LABEL[section]}</h2>
            <button type="button" className={styles.btnSmall} onClick={() => addLine(section)}>+ Ajouter</button>
          </div>
          {(grid[section] ?? []).length === 0 ? (
            <p className={styles.empty}>Aucun paramètre. Ajoutez-en un pour commencer.</p>
          ) : (
            <div className={styles.lines}>
              {(grid[section] ?? []).map((l, i) => (
                <div key={l.key + i} className={styles.line} data-custom={l.custom ? "1" : undefined}>
                  <input className={styles.lineLabel} value={l.label}
                    onChange={(e) => setLine(section, i, { label: e.target.value })} aria-label="Libellé" />
                  {BAND_SECTIONS.includes(section) && (
                    <>
                      <input type="number" className={styles.small} value={l.from ?? 0} aria-label="De"
                        onChange={(e) => setLine(section, i, { from: Number(e.target.value) })} />
                      <input type="number" className={styles.small} value={l.to ?? ""} placeholder="∞" aria-label="À"
                        onChange={(e) => setLine(section, i, { to: e.target.value === "" ? null : Number(e.target.value) })} />
                    </>
                  )}
                  {section === "majorations" ? (
                    <>
                      <input type="number" className={styles.small} value={l.minPct ?? 0} aria-label="% min"
                        onChange={(e) => setLine(section, i, { minPct: Number(e.target.value) })} />
                      <input type="number" className={styles.small} value={l.maxPct ?? 0} aria-label="% max"
                        onChange={(e) => setLine(section, i, { maxPct: Number(e.target.value) })} />
                    </>
                  ) : (
                    <>
                      <input type="number" className={styles.small} value={l.min ?? 0} aria-label="€ min"
                        onChange={(e) => setLine(section, i, { min: Number(e.target.value) })} />
                      <input type="number" className={styles.small} value={l.max ?? 0} aria-label="€ max"
                        onChange={(e) => setLine(section, i, { max: Number(e.target.value) })} />
                    </>
                  )}
                  <label className={styles.customBox} title="Calcul personnalisé : le moteur refuse de chiffrer et demande une validation.">
                    <input type="checkbox" checked={Boolean(l.custom)}
                      onChange={(e) => setLine(section, i, { custom: e.target.checked })} />
                    <span>sur devis</span>
                  </label>
                  <button type="button" className={styles.del} onClick={() => removeLine(section, i)} aria-label="Supprimer">×</button>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ── Simulateur ────────────────────────────────────────────────────────
// Teste la grille EN COURS D'ÉDITION, pas celle enregistrée : on veut voir
// l'effet d'un changement avant de le sauver.
function Simulateur({ grid, settings, base }: { grid: Grid; settings: GridSettings; base: PricingGrid }) {
  const [quantity, setQuantity] = useState(25);
  const [distanceKm, setDistanceKm] = useState(120);
  const [fd, setFd] = useState(3);
  const [fa, setFa] = useState(0);
  const [opts, setOpts] = useState<string[]>([]);
  const [majs, setMajs] = useState<string[]>([]);

  const toggle = (arr: string[], set: (v: string[]) => void, k: string) =>
    set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  const res = useMemo(() => {
    const input: GridInput = { quantity, distanceKm, floorsDepart: fd, floorsArrivee: fa, options: opts, majorations: majs };
    // On force le statut « active » : le simulateur sert justement à tester une
    // grille en brouillon. La publication reste un geste séparé.
    return computeGrid({ ...base, ...settings, grid, status: "active" }, input);
  }, [grid, settings, base, quantity, distanceKm, fd, fa, opts, majs]);

  const optionSections: GridSection[] = ["access", "heavy", "demontage", "emballage", "materiel"];

  return (
    <section className={styles.block} id="simulateur">
      <h2 className={styles.h2}>Tester ma grille</h2>
      <p className={styles.hint}>
        Simulation sur la grille affichée ci-dessous, y compris vos modifications non enregistrées.
      </p>

      <div className={styles.simInputs}>
        <Num label="Volume / surface" value={quantity} onChange={setQuantity} />
        <Num label="Distance (km)" value={distanceKm} onChange={setDistanceKm} />
        <Num label="Étages départ" value={fd} onChange={setFd} />
        <Num label="Étages arrivée" value={fa} onChange={setFa} />
      </div>

      <div className={styles.chips}>
        {optionSections.flatMap((sec) => (grid[sec] ?? []).map((l) => (
          <button key={sec + l.key} type="button"
            className={`${styles.chip} ${opts.includes(l.key) ? styles.chipOn : ""}`}
            onClick={() => toggle(opts, setOpts, l.key)}>{l.label}</button>
        )))}
        {(grid.majorations ?? []).map((l) => (
          <button key={"maj" + l.key} type="button"
            className={`${styles.chip} ${majs.includes(l.key) ? styles.chipOn : ""}`}
            onClick={() => toggle(majs, setMajs, l.key)}>{l.label}</button>
        ))}
      </div>

      {res.ok ? (
        <div className={styles.result}>
          <div className={styles.range}>{euro(res.min)} – {euro(res.max)}</div>
          <div className={styles.conseille}>Prix conseillé : <strong>{euro(res.conseille)}</strong>
            {res.vatRate != null ? ` TTC (TVA ${res.vatRate} %)` : " HT"}</div>
          <ul className={styles.detail}>
            {res.lines.map((l, i) => (
              <li key={i}><span>{l.label}</span><span>{euro(l.min)} – {euro(l.max)}</span></li>
            ))}
            {res.majorations.map((m, i) => (
              <li key={"m" + i}><span>{m.label}</span><span>+{m.minPct} % à +{m.maxPct} %</span></li>
            ))}
          </ul>
          {res.assumptions.length > 0 && <p className={styles.hint}>{res.assumptions.join(" · ")}</p>}
        </div>
      ) : (
        <p className={styles.err}>
          {res.reason === "manquant" && `Calcul impossible — il manque : ${res.missing.join(", ")}.`}
          {res.reason === "validation" && `Validation tarifaire nécessaire : ${res.missing.join(", ")}.`}
          {res.reason === "vide" && "Aucun paramètre chiffré ne s'applique à cette simulation."}
          {res.reason === "brouillon" && "Grille non publiée."}
        </p>
      )}
    </section>
  );
}

function Num({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.lbl}>{label}</span>
      <input type="number" className={styles.inp} value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className={styles.hint}> {hint}</span>}
      </span>
    </label>
  );
}
