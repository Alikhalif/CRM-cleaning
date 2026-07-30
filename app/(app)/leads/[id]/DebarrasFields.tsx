"use client";

import { ACCES, ENCOMBREMENT, OUI_NON, TYPE_BIEN, VOLUME_DEBARRAS, type Option } from "@/lib/discovery-metier";

type Props = { details: Record<string, unknown>; set: (k: string, v: unknown) => void };

const field: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem",
};
const lbl: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 };

function s(details: Record<string, unknown>, k: string): string {
  const v = details[k];
  return typeof v === "string" ? v : "";
}

function Select({ label, k, options, details, set }: { label: string; k: string; options: Option[]; details: Record<string, unknown>; set: Props["set"] }) {
  return (
    <label>
      <span style={lbl}>{label}</span>
      <select value={s(details, k)} onChange={(e) => set(k, e.target.value)} style={field}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default function DebarrasFields({ details, set }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
      <Select label="Type de bien" k="typeBien" options={TYPE_BIEN} details={details} set={set} />
      <Select label="Volume estimé" k="volume" options={VOLUME_DEBARRAS} details={details} set={set} />
      <Select label="Niveau d'encombrement" k="encombrement" options={ENCOMBREMENT} details={details} set={set} />
      <Select label="Accès" k="acces" options={ACCES} details={details} set={set} />
      <Select label="Propriétaire" k="proprietaire" options={OUI_NON} details={details} set={set} />
      <Select label="Tri demandé" k="triDemande" options={OUI_NON} details={details} set={set} />
      <Select label="Valorisation possible" k="valorisation" options={OUI_NON} details={details} set={set} />
    </div>
  );
}
