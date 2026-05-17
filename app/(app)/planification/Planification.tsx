"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  type Technician,
} from "@/lib/leads";
import {
  computePlanificationKpis,
  getOutstandingAcomptes,
  type DossierWithContext,
} from "@/lib/dossiers-shared";
import {
  editDossier,
  finalizeDossier,
  generateFactureFinale,
  markAcomptePaid,
  planifyDossier,
  soldDossier,
  type EditDossierInput,
  type PlanifyInput,
} from "./actions";
import EditDossierModal from "./EditDossierModal";
import PlanifyDossierModal from "./PlanifyDossierModal";
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

type Props = {
  initialRows: DossierWithContext[];
  technicians: Technician[];
};

export default function Planification({ initialRows, technicians }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DossierStatus>>(new Set());
  const [paymentFilter, setPaymentFilter] = useState<Set<PaymentStatus>>(new Set());
  const [flagFilter, setFlagFilter] = useState<Set<DossierFlag>>(new Set());
  const [technicianFilter, setTechnicianFilter] = useState<string>("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [planifyTarget, setPlanifyTarget] = useState<DossierWithContext | null>(null);
  const [editTarget, setEditTarget] = useState<DossierWithContext | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const kpis = useMemo(() => computePlanificationKpis(rows), [rows]);
  const outstanding = useMemo(() => getOutstandingAcomptes(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
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
  }, [rows, search, statusFilter, paymentFilter, flagFilter, technicianFilter]);

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

  // Generic optimistic helper — patch the local row, call the server, roll
  // back on failure. Same pattern the pipeline uses.
  const optimistic = (
    dossierId: string,
    patch: (r: DossierWithContext) => DossierWithContext,
    runServer: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => {
    setServerError(null);
    const previous = rows;
    setRows((cur) =>
      cur.map((r) => (r.dossier.id === dossierId ? patch(r) : r)),
    );
    startTransition(async () => {
      const result = await runServer();
      if (!result.ok) {
        setRows(previous);
        setServerError(result.error);
      }
    });
  };

  const onFinalize = (r: DossierWithContext) =>
    optimistic(
      r.dossier.id,
      (row) => ({
        ...row,
        dossier: { ...row.dossier, status: "finalise", updatedAt: new Date().toISOString() },
      }),
      () => finalizeDossier(r.dossier.id),
    );

  const onSold = (r: DossierWithContext) =>
    optimistic(
      r.dossier.id,
      (row) => ({
        ...row,
        dossier: {
          ...row.dossier,
          status: "solde",
          paymentStatus: "solde",
          updatedAt: new Date().toISOString(),
        },
      }),
      () => soldDossier(r.dossier.id),
    );

  // The modal calls into the action directly (not via the optimistic helper)
  // so it can show its own submitting state + inline error. On success we
  // patch local state to reflect the new schedule, close the modal, and let
  // revalidatePath refresh other routes in the background.
  const onPlanifySubmit = async (input: PlanifyInput) => {
    if (!planifyTarget) return { ok: false as const, error: "Aucun dossier sélectionné." };
    const result = await planifyDossier(planifyTarget.dossier.id, input);
    if (result.ok) {
      setRows((cur) =>
        cur.map((r) =>
          r.dossier.id === planifyTarget.dossier.id
            ? {
                ...r,
                dossier: {
                  ...r.dossier,
                  status: "planifie",
                  plannedAt: input.plannedAt,
                  technicianId: input.technicianId ?? undefined,
                  durationHours: input.durationHours ?? undefined,
                  updatedAt: new Date().toISOString(),
                },
                technician: input.technicianId
                  ? technicians.find((t) => t.id === input.technicianId)
                  : undefined,
              }
            : r,
        ),
      );
    }
    return result;
  };

  // Edit follows the same shape as planify: the modal owns its own submit
  // state + error display; we patch local rows on success and let
  // revalidatePath refresh elsewhere.
  const onEditSubmit = async (input: EditDossierInput) => {
    if (!editTarget) return { ok: false as const, error: "Aucun dossier sélectionné." };
    const result = await editDossier(editTarget.dossier.id, input);
    if (result.ok) {
      setRows((cur) =>
        cur.map((r) =>
          r.dossier.id === editTarget.dossier.id
            ? {
                ...r,
                dossier: {
                  ...r.dossier,
                  plannedAt: input.plannedAt ?? undefined,
                  technicianId: input.technicianId ?? undefined,
                  durationHours: input.durationHours ?? undefined,
                  notes: input.notes ?? undefined,
                  flags: input.flags,
                  updatedAt: new Date().toISOString(),
                },
                technician: input.technicianId
                  ? technicians.find((t) => t.id === input.technicianId)
                  : undefined,
              }
            : r,
        ),
      );
    }
    return result;
  };

  // Finale generation is a write that ends with a navigation — we route the
  // user to the new document so they can review/send it. No optimistic patch
  // is needed since the page is unmounting.
  const onGenerateFinale = (r: DossierWithContext) => {
    setServerError(null);
    startTransition(async () => {
      const result = await generateFactureFinale(r.dossier.id);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.push(`/factures/${result.id}`);
    });
  };

  const onMarkAcomptePaid = (r: DossierWithContext) => {
    if (!r.acompteDoc) return;
    const acompteId = r.acompteDoc.id;
    optimistic(
      r.dossier.id,
      (row) => ({
        ...row,
        dossier: {
          ...row.dossier,
          paymentStatus: "acompte_paye",
          updatedAt: new Date().toISOString(),
        },
        acompteDoc: row.acompteDoc
          ? { ...row.acompteDoc, status: "paye", paidAt: new Date().toISOString() }
          : row.acompteDoc,
      }),
      () => markAcomptePaid(acompteId, r.dossier.id),
    );
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

      {serverError && (
        <p className={styles.errorBanner} role="alert">
          <Icon name="alert" size={14} /> {serverError}
        </p>
      )}

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
                    onClick={() => onMarkAcomptePaid(r)}
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
          {technicians.map((t) => (
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
                onPlanify={() => setPlanifyTarget(r)}
                onEdit={() => setEditTarget(r)}
                onFinalize={() => onFinalize(r)}
                onGenerateFinale={() => onGenerateFinale(r)}
                onSold={() => onSold(r)}
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

      {planifyTarget && (
        <PlanifyDossierModal
          row={planifyTarget}
          technicians={technicians}
          onClose={() => setPlanifyTarget(null)}
          onSubmit={onPlanifySubmit}
        />
      )}
      {editTarget && (
        <EditDossierModal
          row={editTarget}
          technicians={technicians}
          onClose={() => setEditTarget(null)}
          onSubmit={onEditSubmit}
        />
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
  onPlanify,
  onEdit,
  onFinalize,
  onGenerateFinale,
  onSold,
}: {
  row: DossierWithContext;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onPlanify: () => void;
  onEdit: () => void;
  onFinalize: () => void;
  onGenerateFinale: () => void;
  onSold: () => void;
}) {
  const { dossier, lead, technician, devisDoc, finaleDoc, acompteDoc } = row;

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
                    onPlanify();
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
                    onFinalize();
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
                    onGenerateFinale();
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
                    onSold();
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
                  onEdit();
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
