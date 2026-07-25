"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { SECTOR_LABEL } from "@/lib/leads";
import { globalSearch, type SearchResults } from "./actions";

const DOC_TYPE_LABEL: Record<string, string> = {
  devis: "Devis",
  acompte: "Facture d'acompte",
  finale: "Facture finale",
};

export default function SearchClient() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults>({ leads: [], documents: [] });
  const [searched, setSearched] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const query = q.trim();
    // All setState goes through the timer callback (async) — React 19's
    // set-state-in-effect rule forbids synchronous setState in an effect body.
    const t = setTimeout(() => {
      if (query.length < 2) {
        setRes({ leads: [], documents: [] });
        setSearched(false);
        return;
      }
      start(async () => {
        const r = await globalSearch(query);
        setRes(r);
        setSearched(true);
      });
    }, query.length < 2 ? 0 : 300);
    return () => clearTimeout(t);
  }, [q]);

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--r-lg)",
    padding: "8px 4px",
  };
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderTop: "1px solid var(--border-subtle)",
    textDecoration: "none",
    color: "var(--text-primary)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "10px 14px" }}>
        <Icon name="search" size={18} />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Téléphone, nom, prénom, email, ville, n° de dossier (DEV/FA/FAC)…"
          style={{ flex: 1, border: "none", background: "transparent", color: "var(--text-primary)", fontSize: "1rem", outline: "none" }}
          aria-label="Recherche globale"
        />
        {pending && <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>…</span>}
      </div>

      {searched && res.leads.length === 0 && res.documents.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Aucun résultat pour « {q} ».</p>
      )}

      {res.leads.length > 0 && (
        <section style={cardStyle}>
          <h2 style={{ padding: "8px 14px", fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Leads / Clients · {res.leads.length}
          </h2>
          {res.leads.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} style={row}>
              <span style={{ fontFamily: "monospace", color: "var(--text-muted)", minWidth: 64 }}>{l.shortId}</span>
              <span style={{ fontWeight: 600 }}>{l.client}</span>
              <span style={{ color: "var(--text-muted)" }}>{l.phone}</span>
              <span style={{ color: "var(--text-muted)" }}>{l.city}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--text-muted)" }}>{SECTOR_LABEL[l.sector]}</span>
            </Link>
          ))}
        </section>
      )}

      {res.documents.length > 0 && (
        <section style={cardStyle}>
          <h2 style={{ padding: "8px 14px", fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Documents · {res.documents.length}
          </h2>
          {res.documents.map((d) => (
            <Link key={d.id} href={`${d.type === "devis" ? "/devis" : "/factures"}/${d.id}`} style={row}>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{d.num}</span>
              <span style={{ color: "var(--text-muted)" }}>{DOC_TYPE_LABEL[d.type] ?? d.type}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--color-brand-500)" }}>Ouvrir →</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
