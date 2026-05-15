"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  DOSSIER_FLAG_LABEL,
  DOSSIER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SECTOR_LABEL,
  SECTOR_VAR,
  formatEUR,
  type DossierFlag,
  type DossierStatus,
  type PaymentStatus,
} from "@/lib/leads";
import {
  MOCK_TECHNICIANS,
  computePlanificationKpis,
  getAllDossiers,
  getOutstandingAcomptes,
  type DossierWithContext,
} from "@/lib/leads-mock";
import styles from "./Planification.module.scss";

const STATUSES: DossierStatus[] = ["a_planifier", "planifie", "finalise", "solde"];
const PAYMENT_STATUSES: PaymentStatus[] = [
  "acompte_non_paye",
  "acompte_paye",
  "partiel",
  "en_attente",
  "solde",
  "impaye",
];
const FLAGS: DossierFlag[] = ["a_rappeler", "attente_retour", "litige", "bloque"];

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function Planification() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DossierStatus>>(new Set());
  const [paymentFilter, setPaymentFilter] = useState<Set<PaymentStatus>>(new Set());
  const [flagFilter, setFlagFilter] = useState<Set<DossierFlag>>(new Set());
  const [technicianFilter, setTechnicianFilter] = useState<string>("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const allRows = useMemo(() => getAllDossiers(), []);
  const kpis = useMemo(() => computePlanificationKpis(allRows), [allRows]);
  const outstanding = useMemo(() => getOutstandingAcomptes(allRows), [allRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows
      .filter((r) => {
        if (statusFilter.size > 0 && !statusFilter.has(r.dossier.status)) return false;
        if (paymentFilter.size > 0 && !paymentFilter.has(r.dossier.paymentStatus)) return false;
        if (technicianFilter) {
          if (technicianFilter === "__none__" && r.dossier.technicianId) return false;
          if (technicianFilter !== "__none__" && r.dossier.technicianId !== technicianFilter) return false;
        }
        if (flagFilter.size > 0 && !r.dossier.flags.some((f) => flagFilter.has(f))) return false;
        if (q) {
          const hay = `${r.lead.client} ${r.lead.city} ${r.lead.shortId}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // À planifier first, then by planned date asc, then by updatedAt desc.
        const order: Record<DossierStatus, number> = {
          a_planifier: 0, planifie: 1, finalise: 2, solde: 3,
        };
        const so = order[a.dossier.status] - order[b.dossier.status];
        if (so !== 0) return so;
        if (a.dossier.plannedAt && b.dossier.plannedAt) {
          return +new Date(a.dossier.plannedAt) - +new Date(b.dossier.plannedAt);
        }
        return +new Date(b.dossier.updatedAt) - +new Date(a.dossier.updatedAt);
      });
  }, [allRows, search, statusFilter, paymentFilter, flagFilter, technicianFilter]);

  // Click-outside / Escape close any row menu.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const n = new Set(set);
    if (n.has(value)) n.delete(value);
    else n.add(value);
    return n;
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Planification</h1>
          <p className={styles.subtitle}>
            Dossiers en attente, planifiés, finalisés · suivi acomptes &amp; interventions
          </p>
        </div>
      </header>

      <section className={styles.kpis}>
        <KpiCard
          label="À planifier"
          value={String(kpis.byStatus.a_planifier)}
          hint="Dossiers à organiser"
          tone="info"
        />
        <KpiCard
          label="Planifiés"
          value={String(kpis.byStatus.planifie)}
          hint={`${kpis.interventionsThisWeek} cette semaine`}
          tone="brand"
        />
        <KpiCard
          label="Finalisés"
          value={String(kpis.byStatus.finalise)}
          hint="Intervention OK · à solder"
          tone="warning"
        />
        <KpiCard
          label="Soldés"
          value={String(kpis.byStatus.solde)}
          hint="Dossiers archivables"
          tone="success"
        />
      </section>

      {outstanding.length > 0 && (
        <section className={styles.acomptesEncart} aria-label="Acomptes à encaisser">
          <header className={styles.acomptesHeader}>
            <div>
              <h2 className={styles.acomptesTitle}>
                <Icon name="alert" size={16} /> Acomptes à encaisser
              </h2>
              <p className={styles.acomptesHint}>
                {outstanding.length} dossier{outstanding.length > 1 ? "s" : ""} en attente ·{" "}
                {formatEUR(kpis.acompteOutstanding.amountTtc)} TTC à percevoir avant planification.
              </p>
            </div>
          </header>
          <ul className={styles.acomptesList}>
            {outstanding.map((r) => (
              <li key={r.dossier.id} className={styles.acompteRow}>
                <div className={styles.acompteLeft}>
                  <Link href={`/leads/${r.lead.id}`} className={styles.acompteClient}>
                    {r.lead.client}
                  </Link>
                  <span className={styles.acompteMeta}>
                    {r.lead.city} ·{" "}
                    {r.acompteDoc && (
                      <Link
                        href={`/factures/${r.acompteDoc.id}`}
                        className={styles.acompteDocLink}
                      >
                        {r.acompteDoc.num}
                      </Link>
                    )}
                  </span>
                </div>
                <div className={styles.acompteRight}>
                  <span className={styles.acompteAmount}>
                    {r.acompteDoc ? formatEUR(r.acompteDoc.totalTtc) : "—"}
                  </span>
                  <button
                    type="button"
                    className={styles.encaisserBtn}
                    onClick={() =>
                      alert(
                        `Stub : POST /api/invoices/${r.acompteDoc?.id}/mark-paid · ` +
                          "déclenche la bascule du dossier en planifiable.",
                      )
                    }
                  >
                    Encaisser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.toolbar} role="toolbar" aria-label="Filtres planification">
        <div className={styles.searchBox}>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, ville ou ID lead…"
            className={styles.searchInput}
            aria-label="Rechercher"
          />
        </div>
        <select
          value={technicianFilter}
          onChange={(e) => setTechnicianFilter(e.target.value)}
          className={styles.select}
          aria-label="Filtrer par intervenant"
        >
          <option value="">Tous les intervenants</option>
          <option value="__none__">Sans intervenant</option>
          {MOCK_TECHNICIANS.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Statut</span>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${statusFilter.has(s) ? styles.chipOn : ""}`}
            onClick={() => setStatusFilter((cur) => toggle(cur, s))}
            aria-pressed={statusFilter.has(s)}
          >
            {DOSSIER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Paiement</span>
        {PAYMENT_STATUSES.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.chip} ${paymentFilter.has(p) ? styles.chipOn : ""}`}
            onClick={() => setPaymentFilter((cur) => toggle(cur, p))}
            aria-pressed={paymentFilter.has(p)}
          >
            {PAYMENT_STATUS_LABEL[p]}
          </button>
        ))}
      </div>

      <div className={styles.chipsRow}>
        <span className={styles.chipsLabel}>Drapeaux</span>
        {FLAGS.map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.chip} ${flagFilter.has(f) ? styles.chipOn : ""}`}
            onClick={() => setFlagFilter((cur) => toggle(cur, f))}
            aria-pressed={flagFilter.has(f)}
          >
            {DOSSIER_FLAG_LABEL[f]}
          </button>
        ))}
      </div>

      <p className={styles.count}>
        {filtered.length} dossier{filtered.length > 1 ? "s" : ""}
      </p>

      <div className={styles.tableWrap} ref={wrapRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Dossier</th>
              <th>Devis</th>
              <th>Statut</th>
              <th>Paiement</th>
              <th>Intervenant</th>
              <th>Intervention</th>
              <th>Drapeaux</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Row
                key={r.dossier.id}
                row={r}
                isMenuOpen={openMenu === r.dossier.id}
                onToggleMenu={() => setOpenMenu(openMenu === r.dossier.id ? null : r.dossier.id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  Aucun dossier ne correspond aux filtres.
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
  tone: "info" | "brand" | "warning" | "success";
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
  isMenuOpen,
  onToggleMenu,
}: {
  row: DossierWithContext;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const { dossier, lead, technician, devisDoc, finaleDoc, acompteDoc } = row;

  const stub = (message: string) => alert(message);

  return (
    <tr data-status={dossier.status}>
      <td>
        <Link href={`/leads/${lead.id}`} className={styles.dossierClient}>
          {lead.client}
        </Link>
        <div className={styles.dossierMeta}>
          <span
            className={styles.sectorChip}
            style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
          >
            {SECTOR_LABEL[lead.sector]}
          </span>
          <span>{lead.city}</span>
          <span className={styles.mono}>{lead.shortId}</span>
        </div>
      </td>
      <td>
        {devisDoc ? (
          <Link href={`/devis/${devisDoc.id}`} className={styles.docLink}>
            {devisDoc.num}
          </Link>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td>
        <span className={styles.statusPill} data-status={dossier.status}>
          {DOSSIER_STATUS_LABEL[dossier.status]}
        </span>
      </td>
      <td>
        <span className={styles.paymentPill} data-payment={dossier.paymentStatus}>
          {PAYMENT_STATUS_LABEL[dossier.paymentStatus]}
        </span>
        {acompteDoc && dossier.paymentStatus !== "solde" && (
          <div className={styles.paymentAmount}>
            {formatEUR(acompteDoc.totalTtc)} acompte
          </div>
        )}
      </td>
      <td>
        {technician ? (
          <span className={styles.intervenant}>
            <span
              className={styles.avatar}
              style={{ ["--av" as string]: technician.color }}
              aria-hidden="true"
            >
              {technician.initials}
            </span>
            {technician.name}
          </span>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td>
        {dossier.plannedAt ? (
          <>
            <div className={styles.plannedDate}>{DATE.format(new Date(dossier.plannedAt))}</div>
            {dossier.durationHours && (
              <div className={styles.muted}>{dossier.durationHours} h</div>
            )}
          </>
        ) : (
          <span className={styles.muted}>—</span>
        )}
      </td>
      <td>
        <div className={styles.flagsCell}>
          {dossier.flags.length === 0 ? (
            <span className={styles.muted}>—</span>
          ) : (
            dossier.flags.map((f) => (
              <span key={f} className={styles.flagChip} data-flag={f}>
                {DOSSIER_FLAG_LABEL[f]}
              </span>
            ))
          )}
        </div>
        {dossier.notes && (
          <p className={styles.dossierNote}>
            <RelativeTime iso={dossier.updatedAt} className={styles.muted} /> · {dossier.notes}
          </p>
        )}
      </td>
      <td className={styles.actionsCell}>
        <div className={styles.actionsAnchor}>
          <button
            type="button"
            className={styles.kebab}
            onClick={onToggleMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label={`Actions pour ${lead.client}`}
          >
            <Icon name="more-vertical" size={16} />
          </button>
          {isMenuOpen && (
            <div className={styles.menu} role="menu">
              {devisDoc && (
                <Link href={`/devis/${devisDoc.id}`} className={styles.menuItem} role="menuitem">
                  Consulter le devis
                </Link>
              )}
              {dossier.status === "a_planifier" && (
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    onToggleMenu();
                    stub(`Stub : PATCH /api/dossiers/${dossier.id} status=planifie + ouverture du planificateur.`);
                  }}
                >
                  Planifier l&apos;intervention
                </button>
              )}
              {dossier.status === "planifie" && (
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    onToggleMenu();
                    stub(`Stub : PATCH /api/dossiers/${dossier.id} status=finalise + génération facture finale.`);
                  }}
                >
                  Marquer comme réalisé
                </button>
              )}
              {dossier.status === "finalise" && !finaleDoc && (
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    onToggleMenu();
                    stub(`Stub : POST /api/dossiers/${dossier.id}/final-invoice (génère FAC-).`);
                  }}
                >
                  Émettre la facture finale
                </button>
              )}
              {finaleDoc && (
                <Link href={`/factures/${finaleDoc.id}`} className={styles.menuItem} role="menuitem">
                  Voir facture finale
                </Link>
              )}
              {dossier.status !== "solde" && dossier.paymentStatus !== "solde" && (
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    onToggleMenu();
                    stub(`Stub : PATCH /api/dossiers/${dossier.id} payment_status=solde + status=solde.`);
                  }}
                >
                  Marquer soldé
                </button>
              )}
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  onToggleMenu();
                  stub(`Stub : ouverture modale d'édition (intervenant, date, notes, drapeaux).`);
                }}
              >
                Modifier le dossier
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
