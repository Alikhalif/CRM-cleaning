"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  formatEUR,
  type DevisStatus,
  type DocumentStatus,
  type DocumentType,
  type FactureStatus,
} from "@/lib/leads";
import {
  computeAccountingKpis,
  getAllDocumentsWithContext,
  MOCK_ENTITIES,
  type DocumentWithContext,
} from "@/lib/leads-mock";
import styles from "./Comptabilite.module.scss";

type Tab = "devis" | "acompte" | "finale";

const TABS: { value: Tab; label: string; type: DocumentType }[] = [
  { value: "devis",   label: "Devis",              type: "devis" },
  { value: "acompte", label: "Factures d'acompte", type: "acompte" },
  { value: "finale",  label: "Factures finales",   type: "finale" },
];

const DEVIS_STATUSES: DevisStatus[] = ["brouillon", "envoye", "ouvert", "signe", "refuse", "expire"];
const FACTURE_STATUSES: FactureStatus[] = ["brouillon", "envoye", "paye", "retard"];

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function Comptabilite() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "devis";
  const tabType = TABS.find((t) => t.value === tab)?.type ?? "devis";

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DocumentStatus>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const allRows = useMemo(() => getAllDocumentsWithContext(), []);
  const kpis = useMemo(() => computeAccountingKpis(allRows), [allRows]);

  const tabRows = useMemo(() => allRows.filter((r) => r.doc.type === tabType), [allRows, tabType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tabRows
      .filter((r) => {
        if (entityFilter && r.entity.id !== entityFilter) return false;
        if (statusFilter.size > 0 && !statusFilter.has(r.doc.status)) return false;
        if (q) {
          const hay = `${r.doc.num} ${r.lead.client} ${r.lead.city}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => +new Date(b.doc.issuedAt) - +new Date(a.doc.issuedAt));
  }, [tabRows, entityFilter, statusFilter, search]);

  const statusOptions: DocumentStatus[] =
    tabType === "devis" ? DEVIS_STATUSES : FACTURE_STATUSES;

  // Close any open kebab menu when clicking outside the table.
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!tableRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Comptabilité</h1>
          <p className={styles.subtitle}>
            Devis, factures d&apos;acompte et factures finales · multi-entités
          </p>
        </div>
        <Link href="/clients" className={styles.clientsLink}>
          Page clients →
        </Link>
      </header>

      <section className={styles.kpis}>
        <KpiCard
          label="Devis en attente"
          value={String(kpis.devisPending.count)}
          hint={`${formatEUR(kpis.devisPending.amountTtc)} TTC`}
          tone="info"
        />
        <KpiCard
          label="Acomptes à encaisser"
          value={String(kpis.acompteOutstanding.count)}
          hint={`${formatEUR(kpis.acompteOutstanding.amountTtc)} TTC`}
          tone="warning"
        />
        <KpiCard
          label="Finales à encaisser"
          value={String(kpis.finaleOutstanding.count)}
          hint={`${formatEUR(kpis.finaleOutstanding.amountTtc)} TTC`}
          tone="warning"
        />
        <KpiCard
          label="CA encaissé (mois)"
          value={formatEUR(kpis.caThisMonth)}
          hint="acomptes + finales payés"
          tone="success"
        />
      </section>

      <nav className={styles.tabs} aria-label="Type de document">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/comptabilite?tab=${t.value}`}
              scroll={false}
              className={`${styles.tab} ${active ? styles.tabOn : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              <span className={styles.tabCount}>
                {allRows.filter((r) => r.doc.type === t.type).length}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.toolbar} role="toolbar" aria-label="Filtres comptabilité">
        <div className={styles.searchBox}>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro, client ou ville…"
            className={styles.searchInput}
            aria-label="Rechercher"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className={styles.select}
          aria-label="Filtrer par entité"
        >
          <option value="">Toutes les entités</option>
          {MOCK_ENTITIES.map((e) => (
            <option key={e.id} value={e.id}>{e.legalName}</option>
          ))}
        </select>
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Statut</span>
        {statusOptions.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${statusFilter.has(s) ? styles.chipOn : ""}`}
            onClick={() =>
              setStatusFilter((cur) => {
                const next = new Set(cur);
                if (next.has(s)) next.delete(s);
                else next.add(s);
                return next;
              })
            }
            aria-pressed={statusFilter.has(s)}
          >
            {DOC_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <p className={styles.count}>
        {filtered.length} document{filtered.length > 1 ? "s" : ""} ·{" "}
        {DOC_TYPE_LABEL[tabType].toLowerCase()}
      </p>

      <div className={styles.tableWrap} ref={tableRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Client</th>
              <th>Entité</th>
              <th className={styles.colDate}>Émis le</th>
              <th className={styles.colDate}>{tabType === "devis" ? "Validité" : "Échéance"}</th>
              {tabType === "devis" && <th>Canal</th>}
              <th className={styles.tNum}>Total HT</th>
              <th className={styles.tNum}>Total TTC</th>
              <th>Statut</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Row
                key={r.doc.id}
                row={r}
                tabType={tabType}
                isMenuOpen={openMenu === r.doc.id}
                onToggleMenu={() => setOpenMenu(openMenu === r.doc.id ? null : r.doc.id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={tabType === "devis" ? 10 : 9} className={styles.empty}>
                  Aucun document ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "info" | "warning" | "success";
}) {
  return (
    <div className={styles.kpiCard} data-tone={tone}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiHint}>{hint}</p>
    </div>
  );
}

function Row({
  row,
  tabType,
  isMenuOpen,
  onToggleMenu,
}: {
  row: DocumentWithContext;
  tabType: DocumentType;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const { doc, lead, entity, totalHt } = row;
  const issued = new Date(doc.issuedAt);
  const validUntil = new Date(issued);
  validUntil.setDate(validUntil.getDate() + 30);

  const docHref = doc.type === "devis" ? `/devis/${doc.id}` : `/factures/${doc.id}`;

  // Canal column (devis only) — Mano / Auto / Manquant red badge if missing.
  const canal =
    doc.type === "devis"
      ? lead.subEnvoi === "mano"
        ? { label: "Mano", danger: false }
        : lead.subEnvoi === "auto"
          ? { label: "Auto", danger: false }
          : doc.status !== "brouillon"
            ? { label: "Manquant", danger: true }
            : null
      : null;

  return (
    <tr data-status={doc.status}>
      <td className={styles.mono}>
        <Link href={docHref} className={styles.numLink}>{doc.num}</Link>
      </td>
      <td>
        <div className={styles.clientName}>{lead.client}</div>
        <div className={styles.muted}>{lead.city}</div>
      </td>
      <td>
        <span className={styles.entityRow}>
          <span
            className={styles.entityDot}
            style={{ background: entity.color }}
            aria-hidden="true"
          />
          {entity.legalName}
        </span>
      </td>
      <td className={styles.colDate}>{DATE.format(issued)}</td>
      <td className={styles.colDate}>{DATE.format(validUntil)}</td>
      {tabType === "devis" && (
        <td>
          {canal && (
            <span className={`${styles.canalBadge} ${canal.danger ? styles.canalDanger : ""}`}>
              {canal.danger && <Icon name="alert" size={11} />}
              {canal.label}
            </span>
          )}
        </td>
      )}
      <td className={styles.tNum}>{formatEUR(totalHt)}</td>
      <td className={styles.tNum}>{formatEUR(doc.totalTtc)}</td>
      <td>
        <span className={styles.statusPill} data-status={doc.status}>
          {DOC_STATUS_LABEL[doc.status]}
        </span>
      </td>
      <td className={styles.actionsCell}>
        <div className={styles.actionsAnchor}>
          <button
            type="button"
            className={styles.kebab}
            onClick={onToggleMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label={`Actions pour ${doc.num}`}
          >
            <Icon name="more-vertical" size={16} />
          </button>
          {isMenuOpen && (
            <div className={styles.menu} role="menu">
              <Link href={docHref} className={styles.menuItem} role="menuitem">
                Voir le document
              </Link>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => alert(`Stub : POST /api/documents/${doc.id}/send (email).`)}
              >
                Envoyer par email
              </button>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => alert(`Stub : POST /api/documents/${doc.id}/duplicate (brouillon).`)}
              >
                Dupliquer
              </button>
              <Link href={`/leads/${lead.id}`} className={styles.menuItem} role="menuitem">
                Ouvrir le lead {lead.shortId}
              </Link>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
