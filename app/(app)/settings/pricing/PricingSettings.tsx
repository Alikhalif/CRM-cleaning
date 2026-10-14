"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingParamsRow } from "@/lib/pricing/server";
import { savePricingParams, type PricingPatch } from "./actions";

// Écran d'administration des barèmes. Une carte par activité, repliée par
// défaut : on ne force personne à lire 13 champs pour les 8 activités.
//
// AUCUNE valeur n'est pré-remplie. Tant qu'une activité n'est pas activée ici,
// la découverte affiche « aucun barème configuré » — c'est voulu : une
// fourchette inventée serait annoncée à un vrai client.

type Props = { rows: PricingParamsRow[] };

// Clés d'options reconnues par le moteur, dérivées des champs de découverte.
// Toute autre clé est ignorée au calcul : on les liste pour éviter les fautes.
const OPTION_KEYS = [
  { key: "emballage", hint: "Déménagement — emballage partiel ou complet" },
  { key: "demontage", hint: "Déménagement — démontage / remontage" },
  { key: "monte_meubles", hint: "Déménagement — monte-meubles" },
  { key: "objets_lourds", hint: "Déménagement — objets spécifiques cochés" },
  { key: "tri", hint: "Débarras — tri demandé" },
];

const inp: React.CSSProperties = {
  width: "100%", padding: "7px 9px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem", minHeight: 40,
};
const lbl: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 3 };

export default function PricingSettings({ rows }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => <ActivityCard key={r.activityId} row={r} />)}
    </div>
  );
}

function ActivityCard({ row }: { row: PricingParamsRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [f, setF] = useState<PricingPatch>({
    enabled: row.enabled,
    basePrice: row.basePrice,
    unit: row.unit,
    pricePerUnit: row.pricePerUnit,
    includedKm: row.includedKm,
    pricePerKm: row.pricePerKm,
    pricePerFloorNoLift: row.pricePerFloorNoLift,
    urgencyPct: row.urgencyPct,
    difficultyPct: row.difficultyPct,
    options: row.options,
    minPrice: row.minPrice,
    rangeLowPct: row.rangeLowPct,
    rangeHighPct: row.rangeHighPct,
  });

  const set = <K extends keyof PricingPatch>(k: K, v: PricingPatch[K]) => setF((p) => ({ ...p, [k]: v }));
  const num = (k: keyof PricingPatch) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, (e.target.value === "" ? 0 : Number(e.target.value)) as PricingPatch[typeof k]);

  const onSave = () => {
    setErr(null); setSaved(null); setBusy(true);
    startTransition(async () => {
      const r = await savePricingParams(row.activityId, f);
      setBusy(false);
      if (!r.ok) { setErr(r.error); return; }
      // Horodatage réel de la confirmation serveur.
      setSaved(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
    });
  };

  return (
    <section style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "transparent", border: 0, cursor: "pointer", color: "var(--text-primary)", minHeight: 48, textAlign: "left" }}
      >
        <strong style={{ flex: 1 }}>{row.activityLabel}</strong>
        <span style={{ fontSize: "0.8125rem", color: f.enabled ? "var(--tone-success)" : "var(--text-muted)" }}>
          {f.enabled ? "Barème actif" : "Non configuré"}
        </span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
            <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ width: 20, height: 20 }} />
            <span>Proposer une fourchette pour cette activité</span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <label><span style={lbl}>Forfait de base (€)</span>
              <input type="number" min={0} step="1" value={f.basePrice} onChange={num("basePrice")} style={inp} /></label>
            <label><span style={lbl}>Inducteur</span>
              <select value={f.unit} onChange={(e) => set("unit", e.target.value as PricingPatch["unit"])} style={inp}>
                <option value="none">Aucun</option>
                <option value="m3">Volume (m³)</option>
                <option value="m2">Surface (m²)</option>
              </select></label>
            <label><span style={lbl}>Prix par unité (€)</span>
              <input type="number" min={0} step="0.5" value={f.pricePerUnit} onChange={num("pricePerUnit")} style={inp} /></label>
            <label><span style={lbl}>Km inclus</span>
              <input type="number" min={0} value={f.includedKm} onChange={num("includedKm")} style={inp} /></label>
            <label><span style={lbl}>Prix du km au-delà (€)</span>
              <input type="number" min={0} step="0.1" value={f.pricePerKm} onChange={num("pricePerKm")} style={inp} /></label>
            <label><span style={lbl}>Étage sans ascenseur (€)</span>
              <input type="number" min={0} step="1" value={f.pricePerFloorNoLift} onChange={num("pricePerFloorNoLift")} style={inp} /></label>
            <label><span style={lbl}>Majoration urgence (%)</span>
              <input type="number" min={0} step="1" value={f.urgencyPct} onChange={num("urgencyPct")} style={inp} /></label>
            <label><span style={lbl}>Majoration difficulté (%)</span>
              <input type="number" min={0} step="1" value={f.difficultyPct} onChange={num("difficultyPct")} style={inp} /></label>
            <label><span style={lbl}>Prix plancher (€)</span>
              <input type="number" min={0} step="1" value={f.minPrice} onChange={num("minPrice")} style={inp} /></label>
            <label><span style={lbl}>Fourchette basse (−%)</span>
              <input type="number" min={0} max={50} step="1" value={f.rangeLowPct} onChange={num("rangeLowPct")} style={inp} /></label>
            <label><span style={lbl}>Fourchette haute (+%)</span>
              <input type="number" min={0} max={50} step="1" value={f.rangeHighPct} onChange={num("rangeHighPct")} style={inp} /></label>
          </div>

          <div>
            <span style={lbl}>Options à prix fixe (€) — laissez à 0 celles qui ne s&apos;appliquent pas</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {OPTION_KEYS.map((o) => (
                <label key={o.key} title={o.hint}>
                  <span style={lbl}>{o.key}</span>
                  <input
                    type="number" min={0} step="1"
                    value={f.options[o.key] ?? 0}
                    onChange={(e) => set("options", { ...f.options, [o.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
                    style={inp}
                  />
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button" onClick={onSave} disabled={busy}
              style={{ padding: "11px 18px", minHeight: 44, borderRadius: "var(--r-md)", border: 0, background: "var(--color-brand-500)", color: "var(--text-inverted)", fontWeight: 700, cursor: "pointer" }}
            >
              {busy ? "Enregistrement…" : "Enregistrer le barème"}
            </button>
            {saved && <span style={{ color: "var(--tone-success)", fontSize: "0.875rem" }}>✓ Enregistré à {saved}</span>}
            {err && <span style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }}>{err}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
