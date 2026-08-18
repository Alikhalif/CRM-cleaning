"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEUR } from "@/lib/leads";
import {
  SIGNATURE_FILTERS,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_TONE,
} from "@/lib/signature-shared";
import type { SignatureListRow } from "@/lib/signature-server";

type Props = { rows: SignatureListRow[] };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "9px 10px", borderTop: "1px solid var(--border-subtle)", whiteSpace: "nowrap" };

export default function SignaturesList({ rows }: Props) {
  const [tab, setTab] = useState<string>("tous");

  const filtered = useMemo(() => {
    if (tab === "tous") return rows;
    const f = SIGNATURE_FILTERS.find((x) => x.key === tab);
    if (!f) return rows;
    return rows.filter((r) => f.statuses.includes(r.status));
  }, [rows, tab]);

  const count = (key: string) => {
    if (key === "tous") return rows.length;
    const f = SIGNATURE_FILTERS.find((x) => x.key === key);
    return f ? rows.filter((r) => f.statuses.includes(r.status)).length : 0;
  };

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, background: "var(--bg-surface-2)", padding: 4, borderRadius: "var(--r-md)", marginBottom: 12, flexWrap: "wrap" }}>
        {[{ key: "tous", label: "Tous" }, ...SIGNATURE_FILTERS].map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ padding: "6px 12px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.8125rem",
              background: tab === t.key ? "var(--bg-elevated)" : "transparent", color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)" }}>
            {t.label} ({count(t.key)})
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: 980 }}>
          <thead>
            <tr style={{ background: "var(--bg-surface-2)" }}>
              <th style={th}>Référence</th>
              <th style={th}>Statut</th>
              <th style={th}>Client</th>
              <th style={th}>Société</th>
              <th style={th}>Devis</th>
              <th style={th}>Commercial</th>
              <th style={th}>Montant</th>
              <th style={th}>Envoyée</th>
              <th style={th}>Ouverte</th>
              <th style={th}>Signée</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <Link href={`/signatures/${r.id}`} style={{ color: "var(--color-brand-500)", textDecoration: "none", fontWeight: 600 }}>{r.ref}</Link>
                </td>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: SIGNATURE_STATUS_TONE[r.status] }} />
                    {SIGNATURE_STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td style={td}>{r.clientName}</td>
                <td style={td}>{r.entityName}</td>
                <td style={td}>{r.docNum}</td>
                <td style={td}>{r.ownerName ?? "—"}</td>
                <td style={{ ...td, fontWeight: 600 }}>{formatEUR(r.amountTtc)}</td>
                <td style={td}>{fmt(r.sentAt)}</td>
                <td style={td}>{fmt(r.openedAt)}</td>
                <td style={{ ...td, color: r.signedAt ? "var(--tone-success)" : "var(--text-muted)", fontWeight: r.signedAt ? 600 : 400 }}>{fmt(r.signedAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ ...td, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>Aucune demande de signature.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
