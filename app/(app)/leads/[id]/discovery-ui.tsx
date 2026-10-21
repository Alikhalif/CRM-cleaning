"use client";

// Briques communes aux formulaires de découverte (déménagement, transport).
//
// Elles vivaient en double dans chaque formulaire. Les partager évite qu'une
// correction — la validation du code postal, par exemple — ne soit appliquée
// qu'à une activité sur deux.

import type { Option } from "@/lib/discovery-metier";
import { validerCodePostal } from "@/lib/adresses";
import type { Country } from "@/lib/leads";

export type SetDetail = (k: string, v: unknown) => void;

export const field: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem",
};

export const lbl: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4,
};

/** Grille qui se replie toute seule : trois colonnes au bureau, une au téléphone. */
export const grille: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10,
};

export const str = (d: Record<string, unknown>, k: string): string =>
  typeof d[k] === "string" ? (d[k] as string) : d[k] != null ? String(d[k]) : "";

export const arr = (d: Record<string, unknown>, k: string): string[] =>
  Array.isArray(d[k]) ? (d[k] as string[]) : [];

export function Sel({ label, k, options, details, set }: {
  label: string; k: string; options: Option[];
  details: Record<string, unknown>; set: SetDetail;
}) {
  return (
    <label>
      <span style={lbl}>{label}</span>
      <select value={str(details, k)} onChange={(e) => set(k, e.target.value)} style={field}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Num({ label, k, details, set, step, placeholder }: {
  label: string; k: string; details: Record<string, unknown>; set: SetDetail;
  step?: string; placeholder?: string;
}) {
  return (
    <label>
      <span style={lbl}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={str(details, k)}
        onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={placeholder ?? "—"}
        style={field}
      />
    </label>
  );
}

/** Cases à cocher présentées en pastilles — plus rapides au doigt qu'une liste. */
export function Chips({ label, k, options, details, set }: {
  label: string; k: string; options: Option[];
  details: Record<string, unknown>; set: SetDetail;
}) {
  const choisis = arr(details, k);
  const bascule = (v: string) =>
    set(k, choisis.includes(v) ? choisis.filter((x) => x !== v) : [...choisis, v]);

  return (
    <div>
      <span style={lbl}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => {
          const actif = choisis.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => bascule(o.value)}
              aria-pressed={actif}
              style={{
                // 36 px de haut : confortable au doigt sans casser la densité
                // du bureau, où ces pastilles sont nombreuses.
                padding: "7px 12px", minHeight: 36, borderRadius: 999,
                fontSize: "0.75rem", cursor: "pointer",
                border: actif ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
                background: actif ? "var(--color-brand-500)" : "transparent",
                color: actif ? "#fff" : "var(--text-muted)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Un bloc d'adresse : rue, code postal, ville.
 *
 * La rue garde la clé historique (`adresseDepart` / `adresseArrivee`), si bien
 * que les dossiers déjà saisis conservent leur contenu et restent lisibles —
 * le commercial peut le répartir dans les nouveaux champs quand il repasse
 * dessus, sans rien perdre entre-temps.
 */
export function Adresse({ titre, cles, details, set, pays, onSortie, children }: {
  titre: string;
  cles: { rue: string; cp: string; ville: string };
  details: Record<string, unknown>;
  set: SetDetail;
  pays: Country | null;
  onSortie: () => void;
  /** Champs propres à l'activité (étage, ascenseur, accès) placés sous l'adresse. */
  children?: React.ReactNode;
}) {
  const cp = str(details, cles.cp);
  const verdict = validerCodePostal(cp, pays);

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <legend style={{ ...lbl, padding: 0 }}>{titre}</legend>
      <input
        value={str(details, cles.rue)}
        onChange={(e) => set(cles.rue, e.target.value)}
        onBlur={onSortie}
        placeholder="N° et nom de rue"
        aria-label={`${titre} — rue`}
        style={field}
      />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 2fr", gap: 8 }}>
        <div>
          <input
            value={cp}
            onChange={(e) => set(cles.cp, e.target.value)}
            onBlur={onSortie}
            placeholder="Code postal"
            inputMode="numeric"
            aria-label={`${titre} — code postal`}
            aria-invalid={verdict && !verdict.ok ? true : undefined}
            style={{
              ...field,
              borderColor: verdict && !verdict.ok ? "var(--tone-warning)" : "var(--border-strong)",
            }}
          />
          {/* Avertissement, jamais blocage : un format inattendu peut être un
              pays mal deviné, pas une faute du commercial. */}
          {verdict && !verdict.ok && (
            <span style={{ fontSize: "0.6875rem", color: "var(--tone-warning)" }}>
              Format attendu : {verdict.attendu}
            </span>
          )}
        </div>
        <input
          value={str(details, cles.ville)}
          onChange={(e) => set(cles.ville, e.target.value)}
          onBlur={onSortie}
          placeholder="Ville"
          aria-label={`${titre} — ville`}
          style={field}
        />
      </div>
      {children}
    </fieldset>
  );
}
