"use client";

import { useState, useTransition } from "react";
import { setPerformantThreshold } from "./actions";

// Small admin control for the "Performant" surface threshold (CDC §7):
// Nettoyage leads with surface > this value (or urgent) route to the Performant
// pool. Default 100 m².

export default function ThresholdSetting({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await setPerformantThreshold(Number(value));
      setOk(r.ok);
      setMsg(r.ok ? "Enregistré ✓" : r.error);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "12px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-elevated)",
        marginBottom: "var(--sp-4)",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
        Seuil surface « Performant »
      </span>
      <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        Nettoyage urgent ou surface &gt; ce seuil → pool Performant
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: 90,
          padding: "6px 10px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--border-strong)",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
        }}
        aria-label="Seuil surface Performant (m²)"
      />
      <span style={{ color: "var(--text-muted)" }}>m²</span>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        style={{
          padding: "6px 14px",
          borderRadius: "var(--r-sm)",
          border: "none",
          background: "var(--color-brand-500)",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {pending ? "…" : "Enregistrer"}
      </button>
      {msg && (
        <span style={{ fontSize: "0.8125rem", color: ok ? "var(--tone-success, #14c890)" : "var(--tone-danger)" }}>
          {msg}
        </span>
      )}
    </div>
  );
}
