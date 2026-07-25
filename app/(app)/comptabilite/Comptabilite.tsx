"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  SECTOR_LABEL,
  SECTOR_VAR,
  SOURCE_LABEL,
  formatEUR,
  type DevisStatus,
  type DocumentStatus,
  type DocumentType,
  type FactureStatus,
  type LegalEntity,
  type Sector,
  type Source,
  type Technician,
} from "@/lib/leads";
import { computeAccountingKpis, type DocumentWithContext } from "@/lib/documents-shared";
import { duplicateDocument } from "../_shared/document-actions";
import styles from "./Comptabilite.module.scss";

type Tab = "devis" | "acompte" | "finale" | "fournisseurs";

const TABS: { value: Tab; label: string; type?: DocumentType }[] = [
  { value: "devis",        label: "Devis",              type: "devis" },
  { value: "acompte",      label: "Factures d'acompte", type: "acompte" },
  { value: "finale",       label: "Factures finales",   type: "finale" },
  { value: "fournisseurs", label: "Fournisseurs" },
];

const DEVIS_STATUSES: DevisStatus[] = ["brouillon", "envoye", "ouvert", "signe", "refuse", "expire"];
const FACTURE_STATUSES: FactureStatus[] = ["brouillon", "envoye", "paye", "retard"];

// Filter dropdown enumerations — sectors + sources are hard-coded enums in
// leads.ts so no DB fetch needed for those two.
const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation", "debarras", "demenagement", "diogene"];
const SOURCES: Source[] = ["google-ads", "meta-ads", "site-web", "telephone", "recommandation"];

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type Props = {
  rows: DocumentWithContext[];
  entities: LegalEntity[];
  technicians: Technician[];
};

export default function Comptabilite({ rows: allRows, entities, technicians }: Props) {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) ?? "devis";
  const tabType = TABS.find((t) => t.value === tab)?.type ?? "devis";
  const isFournisseurs = tab === "fournisseurs";

  const router = useRouter();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState<"" | Sector>("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | Source>("");
  const [statusFilter, setStatusFilter] = useState<Set<DocumentStatus>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDuplicate = (docId: string, docType: DocumentType) => {
    setBusyDoc(docId);
    startTransition(async () => {
      const result = await duplicateDocument(docId);
      setBusyDoc(null);
      if (!result.ok) {
        alert(`Échec de la duplication : ${result.error}`);
        return;
      }
      const href = docType === "devis" ? `/devis/${result.id}` : `/factures/${result.id}`;
      router.push(href);
    });
  };

  const kpis = useMemo(() => computeAccountingKpis(allRows), [allRows]);

  const tabRows = useMemo(() => allRows.filter((r) => r.doc.type === tabType), [allRows, tabType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tabRows
      .filter((r) => {
        if (entityFilter && r.entity.id !== entityFilter) return false;
        if (activityFilter && r.lead.sector !== activityFilter) return false;
        if (sourceFilter && r.lead.source !== sourceFilter) return false;
        if (technicianFilter) {
          if (technicianFilter === "__none__") {
            if (r.dossier?.technicianId) return false;
          } else if (r.dossier?.technicianId !== technicianFilter) {
            return false;
          }
        }
        if (statusFilter.size > 0 && !statusFilter.has(r.doc.status)) return false;
        if (q) {
          const hay = `${r.doc.num} ${r.lead.client} ${r.lead.city}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => +new Date(b.doc.issuedAt) - +new Date(a.doc.issuedAt));
  }, [tabRows, entityFilter, activityFilter, sourceFilter, technicianFilter, statusFilter, search]);

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
            Devis, factures d&apos;acompte, factures finales et fichier clients
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/clients" className={styles.headerBtn}>
            <Icon name="commerciaux" size={14} /> Voir clients
          </Link>
          <Link href="/clients/new" className={styles.headerBtn}>
            <Icon name="check" size={14} /> Nouveau client
          </Link>
          <Link href="/devis/new" className={`${styles.headerBtn} ${styles.headerBtnPrimary}`}>
            <Icon name="comptabilite" size={14} /> Nouveau devis
          </Link>
        </div>
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
          const count = t.type
            ? allRows.filter((r) => r.doc.type === t.type).length
            : 0; // Fournisseurs — coming-soon stub, no real count yet
          return (
            <Link
              key={t.value}
              href={`/comptabilite?tab=${t.value}`}
              scroll={false}
              className={`${styles.tab} ${active ? styles.tabOn : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              <span className={styles.tabCount}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {isFournisseurs ? (
        <section className={styles.fournisseursEmpty}>
          <Icon name="comptabilite" size={48} />
          <h2 className={styles.fournisseursTitle}>Fichier fournisseurs</h2>
          <p className={styles.fournisseursBody}>
            Gestion des fournisseurs (factures entrantes, comptes IBAN, suivi des règlements)
            en préparation pour la prochaine itération.
          </p>
        </section>
      ) : (
        <>
          <div className={styles.toolbar} role="toolbar" aria-label="Filtres comptabilité">
            <div className={styles.searchBox}>
              <Icon name="search" size={16} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher numéro, client…"
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
              <option value="">Toutes entités</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.legalName}</option>
              ))}
            </select>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as "" | Sector)}
              className={styles.select}
              aria-label="Filtrer par activité"
            >
              <option value="">Toutes activités</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{SECTOR_LABEL[s]}</option>
              ))}
            </select>
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className={styles.select}
              aria-label="Filtrer par intervenant"
            >
              <option value="">Tous intervenants</option>
              <option value="__none__">Sans intervenant</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as "" | Source)}
              className={styles.select}
              aria-label="Filtrer par apporteur"
            >
              <option value="">Tous apporteurs</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
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
              <th>Entité émettrice</th>
              <th className={styles.colDate}>Date</th>
              <th className={styles.colDate}>{tabType === "devis" ? "Validité" : "Échéance"}</th>
              {tabType === "devis" && <th>Canal</th>}
              <th>Activité</th>
              <th>Intervenant</th>
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
                onDuplicate={() => onDuplicate(r.doc.id, r.doc.type)}
                isBusy={busyDoc === r.doc.id}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={tabType === "devis" ? 12 : 11} className={styles.empty}>
                  Aucun document ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
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
  onDuplicate,
  isBusy,
}: {
  row: DocumentWithContext;
  tabType: DocumentType;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onDuplicate: () => void;
  isBusy: boolean;
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
      <td>
        <span
          className={styles.activityPill}
          style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
        >
          {SECTOR_LABEL[lead.sector]}
        </span>
      </td>
      <td>
        {row.dossier?.technicianId ? (
          <div className={styles.intervenantCell}>
            <span
              className={styles.intervenantAvatar}
              style={{ ["--av" as string]: row.dossier.technicianColor ?? "#5b4bcc" }}
              aria-hidden="true"
            >
              {row.dossier.technicianInitials}
            </span>
            <div className={styles.intervenantBody}>
              <div className={styles.intervenantName}>{row.dossier.technicianName}</div>
              <div className={styles.intervenantStatus}>
                {dossierStatusLabel(row.dossier.status)}
                {row.dossier.plannedAt && (
                  <> · {DATE.format(new Date(row.dossier.plannedAt))}</>
                )}
              </div>
            </div>
          </div>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
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
              <Link
                href={`${docHref}?send=1`}
                className={styles.menuItem}
                role="menuitem"
              >
                Envoyer par email
              </Link>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                disabled={isBusy}
                onClick={() => {
                  onToggleMenu();
                  onDuplicate();
                }}
              >
                {isBusy ? "Duplication…" : "Dupliquer"}
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

// ── Helpers ───────────────────────────────────────────────────────────

function dossierStatusLabel(status: "a_planifier" | "planifie" | "finalise" | "solde"): string {
  return {
    a_planifier: "À planifier",
    planifie:    "Planifié",
    finalise:    "Réalisé",
    solde:       "Soldé",
  }[status];
}
