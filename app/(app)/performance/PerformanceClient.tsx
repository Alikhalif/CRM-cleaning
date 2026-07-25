"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  SECTOR_LABEL,
  COUNTRY_LABEL,
  COUNTRIES,
  formatEUR,
  type Commercial,
  type Lead,
} from "@/lib/leads";

type Props = { leads: Lead[]; commerciaux: Commercial[] };

const PERIODS = [
  { key: "30", label: "30 derniers jours" },
  { key: "90", label: "90 derniers jours" },
  { key: "month", label: "Ce mois-ci" },
  { key: "all", label: "Tout l'historique" },
];

function cutoff(period: string): number {
  const now = Date.now();
  if (period === "30") return now - 30 * 864e5;
  if (period === "90") return now - 90 * 864e5;
  if (period === "month") {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  return 0;
}

const sel: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
};
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)", whiteSpace: "nowrap" };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default function PerformanceClient({ leads, commerciaux }: Props) {
  const [period, setPeriod] = useState("90");
  const [societe, setSociete] = useState("");
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const societes = useMemo(
    () => [...new Set(leads.map((l) => l.entityName).filter((s): s is string => Boolean(s)))].sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const c = cutoff(period);
    return leads.filter((l) => {
      if (new Date(l.receivedAt).getTime() < c) return false;
      if (societe && l.entityName !== societe) return false;
      if (country && l.country !== country) return false;
      if (sector && l.sector !== sector) return false;
      if (ownerId && l.ownerId !== ownerId) return false;
      return true;
    });
  }, [leads, period, societe, country, sector, ownerId]);

  const rows = useMemo(() => {
    const byOwner = new Map<string, Lead[]>();
    for (const l of filtered) {
      if (!l.ownerId) continue;
      const arr = byOwner.get(l.ownerId) ?? [];
      arr.push(l);
      byOwner.set(l.ownerId, arr);
    }
    return commerciaux
      .map((c) => {
        const ls = byOwner.get(c.id) ?? [];
        const signed = ls.filter((l) => l.status === "signe" || l.status === "encaisse");
        const recus = ls.length;
        return {
          name: c.name,
          recus,
          traites: ls.filter((l) => l.status !== "lead").length,
          signes: signed.length,
          conv: recus > 0 ? Math.round((signed.length / recus) * 100) : 0,
          urgents: ls.filter((l) => l.isUrgent).length,
          gros: ls.filter((l) => l.surfaceM2 != null && l.surfaceM2 > 100).length,
          ca: signed.reduce((s, l) => s + l.amount, 0),
        };
      })
      .filter((r) => r.recus > 0)
      .sort((a, b) => b.signes - a.signes || b.recus - a.recus);
  }, [filtered, commerciaux]);

  const totals = useMemo(
    () => rows.reduce(
      (t, r) => ({
        recus: t.recus + r.recus, traites: t.traites + r.traites, signes: t.signes + r.signes,
        urgents: t.urgents + r.urgents, gros: t.gros + r.gros, ca: t.ca + r.ca,
      }),
      { recus: 0, traites: 0, signes: 0, urgents: 0, gros: 0, ca: 0 },
    ),
    [rows],
  );

  const exportCsv = () => {
    const headers = ["Commercial", "Reçus", "Traités", "Signés", "Taux conversion %", "Urgents", "Surface > 100 m²", "CA signé (est.)"];
    const body = rows.map((r) => [r.name, r.recus, r.traites, r.signes, r.conv, r.urgents, r.gros, r.ca]);
    const csv = [headers, ...body]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Performance commerciale</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Résultats par commercial, filtrables par période, société, pays et secteur.
        </p>
      </header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={sel} aria-label="Période">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {societes.length > 0 && (
          <select value={societe} onChange={(e) => setSociete(e.target.value)} style={sel} aria-label="Société">
            <option value="">Toutes les sociétés</option>
            {societes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={sel} aria-label="Pays">
          <option value="">Tous les pays</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>)}
        </select>
        <select value={sector} onChange={(e) => setSector(e.target.value)} style={sel} aria-label="Secteur">
          <option value="">Tous les secteurs</option>
          {(Object.keys(SECTOR_LABEL) as (keyof typeof SECTOR_LABEL)[]).map((s) => <option key={s} value={s}>{SECTOR_LABEL[s]}</option>)}
        </select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={sel} aria-label="Commercial">
          <option value="">Tous les commerciaux</option>
          {commerciaux.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}
        >
          <Icon name="check" size={14} /> Exporter (Excel/CSV)
        </button>
      </div>

      <div style={{ overflowX: "auto", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
          <thead>
            <tr>
              <th style={th}>Commercial</th>
              <th style={{ ...th, textAlign: "right" }}>Reçus</th>
              <th style={{ ...th, textAlign: "right" }}>Traités</th>
              <th style={{ ...th, textAlign: "right" }}>Signés</th>
              <th style={{ ...th, textAlign: "right" }}>Conv.</th>
              <th style={{ ...th, textAlign: "right" }}>Urgents</th>
              <th style={{ ...th, textAlign: "right" }}>&gt;100 m²</th>
              <th style={{ ...th, textAlign: "right" }}>CA signé (est.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td style={{ ...td, fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</td>
                <td style={num}>{r.recus}</td>
                <td style={num}>{r.traites}</td>
                <td style={num}>{r.signes}</td>
                <td style={num}>{r.conv}%</td>
                <td style={num}>{r.urgents}</td>
                <td style={num}>{r.gros}</td>
                <td style={num}>{formatEUR(r.ca)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, color: "var(--text-muted)" }}>Aucune donnée pour ces filtres.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border-strong)", fontWeight: 700 }}>
                <td style={{ ...td, color: "var(--text-primary)" }}>Total</td>
                <td style={num}>{totals.recus}</td>
                <td style={num}>{totals.traites}</td>
                <td style={num}>{totals.signes}</td>
                <td style={num}>{totals.recus > 0 ? Math.round((totals.signes / totals.recus) * 100) : 0}%</td>
                <td style={num}>{totals.urgents}</td>
                <td style={num}>{totals.gros}</td>
                <td style={num}>{formatEUR(totals.ca)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
