"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import { SECTOR_LABEL, COUNTRY_LABEL, type Commercial, type Lead } from "@/lib/leads";
import { assignLeadsBulk } from "@/app/(app)/pipeline/actions";

type Props = { leads: Lead[]; commerciaux: Commercial[] };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)" };

export default function UnassignedList({ leads, commerciaux }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allChecked = leads.length > 0 && selected.size === leads.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(leads.map((l) => l.id)));

  const assign = () => {
    setError(null); setOk(null);
    start(async () => {
      const r = await assignLeadsBulk([...selected], ownerId);
      if (!r.ok) { setError(r.error); return; }
      setOk(`${selected.size} lead(s) attribué(s).`);
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", padding: "8px 4px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <strong style={{ color: "var(--text-primary)" }}>{selected.size}</strong>
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>sélectionné(s) →</span>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
          aria-label="Commercial cible"
        >
          <option value="">— commercial —</option>
          {commerciaux.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={pending || selected.size === 0 || !ownerId}
          style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "none", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: selected.size === 0 || !ownerId ? 0.5 : 1 }}
        >
          {pending ? "Attribution…" : "Attribuer la sélection"}
        </button>
        {ok && <span style={{ color: "var(--tone-success, #14c890)", fontSize: "0.875rem" }}><Icon name="check" size={14} /> {ok}</span>}
        {error && <span style={{ color: "var(--tone-danger)", fontSize: "0.875rem" }}><Icon name="alert" size={14} /> {error}</span>}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 32 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Tout sélectionner" />
              </th>
              <th style={th}>Reçu</th>
              <th style={th}>Client</th>
              <th style={th}>Société</th>
              <th style={th}>Pays</th>
              <th style={th}>Secteur</th>
              <th style={th}>Landing page</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td style={td}>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Sélectionner ${l.client}`} />
                </td>
                <td style={td}>{dateFmt.format(new Date(l.receivedAt))}</td>
                <td style={td}>
                  <Link href={`/leads/${l.id}`} style={{ color: "var(--color-brand-500)", fontWeight: 600, textDecoration: "none" }}>{l.client}</Link>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{l.city}</div>
                </td>
                <td style={td}>{l.entityName ?? "—"}</td>
                <td style={td}>{l.country ? COUNTRY_LABEL[l.country] : "—"}</td>
                <td style={td}>{SECTOR_LABEL[l.sector]}</td>
                <td style={td}>{l.landingPage ?? "—"}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, color: "var(--text-muted)" }}>Aucun lead en attente d&apos;affectation. 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
