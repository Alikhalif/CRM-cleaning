"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  PIPELINE_COLUMNS,
  SECTOR_LABEL,
  SECTOR_VAR,
  SOURCE_LABEL,
  formatEUR,
  type Commercial,
  type Lead,
  type LeadStatus,
  type Source,
} from "@/lib/leads";
import styles from "./LeadsTable.module.scss";

type SortKey = "shortId" | "receivedAt" | "client" | "amount" | "lastActionAt" | "nextFollowupAt";
type SortState = { by: SortKey; dir: "asc" | "desc" };

const ALL_SOURCES: Source[] = [
  "google-ads",
  "meta-ads",
  "site-web",
  "telephone",
  "recommandation",
];

type Props = {
  leads: Lead[];
  commerciaux: Commercial[];
};

export default function LeadsTable({ leads, commerciaux }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<LeadStatus>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<Set<Source>>(new Set());
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [showPerdu, setShowPerdu] = useState(false);
  const [nrpOnly, setNrpOnly] = useState(false);
  const [sort, setSort] = useState<SortState>({ by: "receivedAt", dir: "desc" });

  const ownersById = useMemo(
    () => new Map(commerciaux.map((c) => [c.id, c])),
    [commerciaux],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const rows = leads.filter((l) => {
      if (!showPerdu && l.status === "perdu") return false;
      if (nrpOnly && !l.isNrp) return false;
      if (statusFilter.size > 0 && !statusFilter.has(l.status)) return false;
      if (sourceFilter.size > 0 && !sourceFilter.has(l.source)) return false;
      if (ownerFilter && l.ownerId !== ownerFilter) return false;
      if (q) {
        const hay = `${l.shortId} ${l.client} ${l.city} ${l.email} ${l.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => compareLeads(a, b, sort));
    return rows;
  }, [leads, search, statusFilter, sourceFilter, ownerFilter, showPerdu, nrpOnly, sort]);

  const toggleSet = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const setSortBy = (by: SortKey) => {
    setSort((s) =>
      s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: "desc" },
    );
  };

  const exportCsv = () => {
    const headers = [
      "ID",
      "Reçu le",
      "Client",
      "Type",
      "Email",
      "Téléphone",
      "Ville",
      "Secteur",
      "Commercial",
      "Source",
      "Montant TTC",
      "Statut",
      "Sous-statut envoi",
      "Sous-statut signature",
      "Dernière action",
      "Dernière action (date)",
      "Prochaine relance",
    ];
    const rows = filtered.map((l) => [
      l.shortId,
      l.receivedAt,
      l.client,
      l.isCompany ? "Pro" : "Particulier",
      l.email,
      l.phone,
      l.city,
      SECTOR_LABEL[l.sector],
      ownersById.get(l.ownerId)?.name ?? "",
      SOURCE_LABEL[l.source],
      String(l.amount),
      labelForStatus(l.status),
      l.subEnvoi ?? "",
      l.subSignature ?? "",
      l.lastActionLabel,
      l.lastActionAt,
      l.nextFollowupAt ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvField).join(";"))
      .join("\r\n");
    // BOM so Excel/LibreOffice on Windows render the accents correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Filtres et recherche">
        <div className={styles.searchBox}>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un lead, client, ville, email…"
            className={styles.searchInput}
            aria-label="Rechercher dans les leads"
          />
        </div>

        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className={styles.select}
          aria-label="Filtrer par commercial"
        >
          <option value="">Tous les commerciaux</option>
          {commerciaux.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          type="button"
          className={`${styles.toggle} ${showPerdu ? styles.toggleOn : ""}`}
          onClick={() => setShowPerdu((v) => !v)}
          aria-pressed={showPerdu}
        >
          Afficher perdus
        </button>

        <button type="button" className={styles.exportBtn} onClick={exportCsv}>
          <Icon name="check" size={14} /> Exporter CSV
        </button>
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Statut</span>
        {PIPELINE_COLUMNS
          // The "acompte_paye" pipeline column is derived from documents,
          // not a real LeadStatus — drop it from the leads-list filter.
          .filter((c): c is { status: LeadStatus; label: string; hint?: string } =>
            c.status !== "acompte_paye"
          )
          .map((c) => (
            <button
              key={c.status}
              type="button"
              className={`${styles.chip} ${statusFilter.has(c.status) ? styles.chipOn : ""}`}
              onClick={() => setStatusFilter((s) => toggleSet(s, c.status))}
              aria-pressed={statusFilter.has(c.status)}
            >
              {c.label}
            </button>
          ))}
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Source</span>
        {ALL_SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${sourceFilter.has(s) ? styles.chipOn : ""}`}
            onClick={() => setSourceFilter((cur) => toggleSet(cur, s))}
            aria-pressed={sourceFilter.has(s)}
          >
            {SOURCE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Filtre rapide</span>
        <button
          type="button"
          className={`${styles.chip} ${nrpOnly ? styles.chipOn : ""}`}
          onClick={() => setNrpOnly((v) => !v)}
          aria-pressed={nrpOnly}
          title="N'afficher que les leads marqués NRP (ne répond pas)"
        >
          NRP uniquement
        </button>
      </div>

      <p className={styles.count}>
        {filtered.length} lead{filtered.length > 1 ? "s" : ""}
        {!showPerdu && " · perdus masqués"}
        {nrpOnly && " · NRP uniquement"}
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortableTh label="ID"        col="shortId"        sort={sort} setSort={setSortBy} />
              <SortableTh label="Reçu"      col="receivedAt"     sort={sort} setSort={setSortBy} />
              <SortableTh label="Client"    col="client"         sort={sort} setSort={setSortBy} />
              <th className={styles.colPhone}>Téléphone</th>
              <th>Secteur</th>
              <th>Commercial</th>
              <th className={styles.colSource}>Source</th>
              <SortableTh label="Montant"   col="amount"         sort={sort} setSort={setSortBy} align="right" />
              <th>Statut</th>
              <SortableTh label="Dernière action" col="lastActionAt"   sort={sort} setSort={setSortBy} />
              <SortableTh label="Relance"   col="nextFollowupAt" sort={sort} setSort={setSortBy} align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const owner = ownersById.get(l.ownerId);
              return (
                <tr key={l.id} data-lost={l.status === "perdu" || undefined}>
                  <td className={styles.mono}>
                    <Link href={`/leads/${l.id}`} className={styles.idLink}>
                      {l.shortId}
                    </Link>
                  </td>
                  <td className={styles.nowrap}>{dateFmt.format(new Date(l.receivedAt))}</td>
                  <td>
                    <div className={styles.client}>
                      {l.isUrgent && (
                        <span className={styles.urgent} aria-label="Urgent">
                          <Icon name="alert" size={11} />
                        </span>
                      )}
                      <Link href={`/leads/${l.id}`} className={styles.clientLink}>
                        {l.client}
                      </Link>
                      {l.isNrp && (
                        <span className={styles.nrpBadge} title="Ne répond pas">
                          NRP
                        </span>
                      )}
                    </div>
                    <div className={styles.cityMuted}>{l.city}</div>
                  </td>
                  <td className={`${styles.colPhone} ${styles.mono}`}>{l.phone}</td>
                  <td>
                    <span
                      className={styles.sector}
                      style={{ ["--sc" as string]: `var(${SECTOR_VAR[l.sector]})` }}
                    >
                      {SECTOR_LABEL[l.sector]}
                    </span>
                  </td>
                  <td>
                    {owner ? (
                      <div className={styles.owner}>
                        <span
                          className={styles.avatar}
                          style={{ ["--av" as string]: owner.color }}
                          aria-hidden="true"
                        >
                          {owner.initials}
                        </span>
                        <span className={styles.ownerName}>{owner.name}</span>
                      </div>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td className={styles.colSource}>{SOURCE_LABEL[l.source]}</td>
                  <td className={styles.amount}>{formatEUR(l.amount)}</td>
                  <td>
                    <span className={styles.statusPill} data-status={l.status}>
                      {labelForStatus(l.status)}
                    </span>
                    {l.subEnvoi && (
                      <span className={styles.subBadge}>
                        {l.subEnvoi === "mano" ? "Mano" : "Auto"}
                      </span>
                    )}
                  </td>
                  <td>
                    <div>{l.lastActionLabel}</div>
                    <RelativeTime iso={l.lastActionAt} className={styles.muted} />
                  </td>
                  <td className={styles.nextFollowup}>
                    {l.nextFollowupAt ? (
                      <>
                        <div>{dateFmt.format(new Date(l.nextFollowupAt))}</div>
                        <div className={styles.muted} suppressHydrationWarning>
                          {relativeFromFuture(l.nextFollowupAt)}
                        </div>
                      </>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className={styles.empty}>
                  Aucun lead ne correspond aux filtres actuels.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Helpers

type SortableThProps = {
  label: string;
  col: SortKey;
  sort: SortState;
  setSort: (col: SortKey) => void;
  align?: "left" | "right";
};

function SortableTh({ label, col, sort, setSort, align = "left" }: SortableThProps) {
  const active = sort.by === col;
  return (
    <th data-align={align} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={styles.thBtn} onClick={() => setSort(col)}>
        {label}
        {active && (
          <span className={styles.sortGlyph} aria-hidden="true">
            {sort.dir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </button>
    </th>
  );
}

function compareLeads(a: Lead, b: Lead, s: SortState): number {
  const dir = s.dir === "asc" ? 1 : -1;
  switch (s.by) {
    case "shortId":      return a.shortId.localeCompare(b.shortId) * dir;
    case "client":       return a.client.localeCompare(b.client, "fr") * dir;
    case "amount":       return (a.amount - b.amount) * dir;
    case "receivedAt":   return (+new Date(a.receivedAt) - +new Date(b.receivedAt)) * dir;
    case "lastActionAt": return (+new Date(a.lastActionAt) - +new Date(b.lastActionAt)) * dir;
    case "nextFollowupAt": {
      // Empty values sort to the end regardless of direction.
      if (!a.nextFollowupAt && !b.nextFollowupAt) return 0;
      if (!a.nextFollowupAt) return 1;
      if (!b.nextFollowupAt) return -1;
      return (+new Date(a.nextFollowupAt) - +new Date(b.nextFollowupAt)) * dir;
    }
  }
}

function labelForStatus(status: LeadStatus): string {
  return PIPELINE_COLUMNS.find((c) => c.status === status)?.label ?? status;
}

// "dans 3 h", "dans 2 j" — short relative time pointing forward, French.
function relativeFromFuture(iso: string, base: Date = new Date()): string {
  const target = new Date(iso).getTime();
  const diff = target - base.getTime();
  if (diff <= 0) return "en retard";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `dans ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `dans ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `dans ${d} j`;
  const mo = Math.round(d / 30);
  return `dans ${mo} mois`;
}

// Wraps the cell in quotes if it contains a separator, quote, or newline,
// per RFC 4180 with `;` as our delimiter (French Excel default).
function escapeCsvField(v: string): string {
  if (/[";\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
