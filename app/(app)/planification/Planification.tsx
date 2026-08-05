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
  COUNTRIES,
  COUNTRY_LABEL,
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
  startDossierRealisation,
  type EditDossierInput,
  type PlanifyInput,
} from "./actions";
import ConfirmInterventionModal from "./ConfirmInterventionModal";
import EditDossierModal from "./EditDossierModal";
import PlanifyDossierModal from "./PlanifyDossierModal";
import SendIntervenantModal from "./SendIntervenantModal";
import MediaViewerModal from "./MediaViewerModal";
import type { MessageTemplate } from "@/lib/message-templates-server";
import styles from "./Planification.module.scss";

const STATUSES: DossierStatus[] = ["a_planifier", "planifie", "en_cours", "finalise", "solde"];
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

// Date du jour au format "YYYY-MM-DD" (heure locale). Composant client → new
// Date() autorisé.
function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Props = {
  initialRows: DossierWithContext[];
  technicians: Technician[];
  intervenantTemplates: MessageTemplate[];
};

export default function Planification({ initialRows, technicians, intervenantTemplates }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DossierStatus>>(new Set());
  const [paymentFilter, setPaymentFilter] = useState<Set<PaymentStatus>>(new Set());
  const [flagFilter, setFlagFilter] = useState<Set<DossierFlag>>(new Set());
  const [technicianFilter, setTechnicianFilter] = useState<string>("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  // Filtre par date d'intervention (dossier.plannedAt), format "YYYY-MM-DD".
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [planifyTarget, setPlanifyTarget] = useState<DossierWithContext | null>(null);
  const [editTarget, setEditTarget] = useState<DossierWithContext | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DossierWithContext | null>(null);
  const [intervenantTarget, setIntervenantTarget] = useState<DossierWithContext | null>(null);
  const [mediaTarget, setMediaTarget] = useState<DossierWithContext | null>(null);
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
        if (countryFilter && r.lead.country !== countryFilter) return false;
        // Filtre par date d'intervention planifiée. Un dossier sans date est
        // exclu dès qu'une borne est posée.
        if (dateFrom || dateTo) {
          const day = r.dossier.plannedAt ? r.dossier.plannedAt.slice(0, 10) : null;
          if (!day) return false;
          if (dateFrom && day < dateFrom) return false;
          if (dateTo && day > dateTo) return false;
        }
        if (q) {
          const hay = `${r.lead.client} ${r.lead.city} ${r.lead.shortId}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<DossierStatus, number> = {
          a_planifier: 0, planifie: 1, en_cours: 2, finalise: 3, solde: 4,
        };
        const so = order[a.dossier.status] - order[b.dossier.status];
        if (so !== 0) return so;
        if (a.dossier.plannedAt && b.dossier.plannedAt) {
          return +new Date(a.dossier.plannedAt) - +new Date(b.dossier.plannedAt);
        }
        return +new Date(b.dossier.updatedAt) - +new Date(a.dossier.updatedAt);
      });
  }, [rows, search, statusFilter, paymentFilter, flagFilter, technicianFilter, countryFilter, dateFrom, dateTo]);

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

  const onStartRealisation = (r: DossierWithContext) =>
    optimistic(
      r.dossier.id,
      (row) => ({
        ...row,
        dossier: { ...row.dossier, status: "en_cours", updatedAt: new Date().toISOString() },
      }),
      () => startDossierRealisation(r.dossier.id),
    );

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

      {(kpis.byStatus.a_planifier > 0 || outstanding.length > 0) && (
        <section
          className={styles.notifBanner}
          role="status"
          aria-live="polite"
        >
          <span className={styles.notifPulse} aria-hidden="true" />
          <span className={styles.notifIcon} aria-hidden="true">
            <Icon name="bell" size={22} />
          </span>
          <div className={styles.notifBody}>
            <p className={styles.notifTitle}>
              {kpis.byStatus.a_planifier > 0
                ? `${kpis.byStatus.a_planifier} dossier${kpis.byStatus.a_planifier > 1 ? "s" : ""} à planifier`
                : "Acomptes en attente d'encaissement"}
            </p>
            <p className={styles.notifSub}>
              {[
                kpis.byStatus.a_planifier > 0 &&
                  `${kpis.byStatus.a_planifier} à organiser, toutes activités confondues`,
                outstanding.length > 0 &&
                  `${outstanding.length} acompte${outstanding.length > 1 ? "s" : ""} à encaisser (${formatEUR(kpis.acompteOutstanding.amountTtc)} TTC)`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </section>
      )}

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
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className={styles.select}
          aria-label="Filtrer par pays"
        >
          <option value="">Tous les pays</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.chip} ${dateFrom === todayStr() && dateTo === todayStr() ? styles.chipOn : ""}`}
          onClick={() => {
            const t = todayStr();
            if (dateFrom === t && dateTo === t) { setDateFrom(""); setDateTo(""); }
            else { setDateFrom(t); setDateTo(t); }
          }}
          aria-pressed={dateFrom === todayStr() && dateTo === todayStr()}
          title="Interventions planifiées aujourd'hui"
        >
          Aujourd&apos;hui
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Intervention du
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.select}
            aria-label="Date d'intervention — du"
          />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          au
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.select}
            aria-label="Date d'intervention — au"
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            className={styles.select}
            style={{ cursor: "pointer" }}
            onClick={() => { setDateFrom(""); setDateTo(""); }}
          >
            Effacer dates
          </button>
        )}
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
                onConfirmEmail={() => setConfirmTarget(r)}
                onSendIntervenant={() => setIntervenantTarget(r)}
                onViewMedia={() => setMediaTarget(r)}
                onStartRealisation={() => onStartRealisation(r)}
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
      {confirmTarget && (
        <ConfirmInterventionModal
          row={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={() => setConfirmTarget(null)}
        />
      )}
      {intervenantTarget && (
        <SendIntervenantModal
          row={intervenantTarget}
          templates={intervenantTemplates}
          onClose={() => setIntervenantTarget(null)}
        />
      )}
      {mediaTarget && (
        <MediaViewerModal
          leadId={mediaTarget.lead.id}
          clientName={mediaTarget.lead.client}
          onClose={() => setMediaTarget(null)}
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
  onConfirmEmail,
  onSendIntervenant,
  onViewMedia,
  onStartRealisation,
  onFinalize,
  onGenerateFinale,
  onSold,
}: {
  row: DossierWithContext;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onPlanify: () => void;
  onEdit: () => void;
  onConfirmEmail: () => void;
  onSendIntervenant: () => void;
  onViewMedia: () => void;
  onStartRealisation: () => void;
  onFinalize: () => void;
  onGenerateFinale: () => void;
  onSold: () => void;
}) {
  const { dossier, lead, technician, devisDoc, finaleDoc, acompteDoc } = row;

  // Suivi du paiement : part réglée / total du devis → pourcentage (0, 50, 100…).
  // Réglé = factures payées (acompte + finale) ; un dossier soldé compte 100 %.
  const totalTtc = devisDoc?.totalTtc ?? 0;
  const paidTtc =
    dossier.paymentStatus === "solde"
      ? totalTtc
      : (acompteDoc?.status === "paye" ? acompteDoc.totalTtc : 0) +
        (finaleDoc?.status === "paye" ? finaleDoc.totalTtc : 0);
  const paidPct = totalTtc > 0 ? Math.round((paidTtc / totalTtc) * 100) : 0;

  // Menu ⋯ : positionné en `fixed` (calculé depuis le rect du bouton) pour
  // échapper au clipping de `.tableWrap { overflow-x:auto }`. On rabat vers le
  // haut quand il n'y a pas la place en dessous (bas de viewport).
  const kebabRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    // `place` ne s'exécute que dans un rAF / un callback d'évènement — jamais
    // de setState synchrone dans le corps de l'effet (règle react-hooks).
    const place = () => {
      const btn = kebabRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const W = 250;
      const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
      const menuH = menuRef.current?.offsetHeight ?? 320;
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < menuH + 16 && r.top > spaceBelow) {
        setMenuPos({ bottom: window.innerHeight - r.top + 6, left });
      } else {
        setMenuPos({ top: r.bottom + 6, left });
      }
    };
    const raf = requestAnimationFrame(place);
    // Recalcule si l'on scrolle (liste ou fenêtre) ou redimensionne.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isMenuOpen]);

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
        {totalTtc > 0 && (
          <div className={styles.paymentAmount}>
            <strong
              className={styles.paidPct}
              data-full={paidPct >= 100 ? "1" : undefined}
            >
              {paidPct} %
            </strong>{" "}
            · {formatEUR(paidTtc)} / {formatEUR(totalTtc)}
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
        <div className={styles.actionsWrap}>
        {finaleDoc ? (
          <Link
            href={`/factures/${finaleDoc.id}`}
            className={styles.genFactureBtn}
            data-variant="view"
            title="Voir la facture finale"
          >
            <Icon name="document" size={14} /> Facture
          </Link>
        ) : (
          <button
            type="button"
            className={styles.genFactureBtn}
            onClick={onGenerateFinale}
            disabled={dossier.status !== "finalise"}
            title={
              dossier.status === "finalise"
                ? "Générer la facture finale"
                : "Disponible une fois le dossier finalisé (intervention réalisée)"
            }
          >
            <Icon name="document" size={14} /> Générer facture
          </button>
        )}
        <button
          type="button"
          className={styles.kebab}
          onClick={onViewMedia}
          title="Photos & vidéos du dossier"
          aria-label={`Photos et vidéos de ${lead.client}`}
        >
          <Icon name="image" size={16} />
        </button>
        <div className={styles.actionsAnchor}>
          <button
            ref={kebabRef}
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
            <div
              ref={menuRef}
              className={styles.menu}
              role="menu"
              style={
                menuPos
                  ? { top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left }
                  : { visibility: "hidden" }
              }
            >
              {(dossier.status === "a_planifier" || dossier.status === "planifie" || dossier.status === "en_cours") && (
                <div className={styles.menuLabel}>Intervention</div>
              )}
              {dossier.status === "a_planifier" && (
                <button type="button" className={styles.menuItem} data-variant="primary" role="menuitem"
                  onClick={() => { onToggleMenu(); onPlanify(); }}>
                  <Icon name="planification" size={15} /> Planifier l&apos;intervention
                </button>
              )}
              {dossier.status === "planifie" && (
                <button type="button" className={styles.menuItem} role="menuitem"
                  onClick={() => { onToggleMenu(); onStartRealisation(); }}>
                  <Icon name="zap" size={15} /> Démarrer la réalisation
                </button>
              )}
              {(dossier.status === "planifie" || dossier.status === "en_cours") && (
                <button type="button" className={styles.menuItem} data-variant="success" role="menuitem"
                  onClick={() => { onToggleMenu(); onFinalize(); }}>
                  <Icon name="check" size={15} /> Marquer comme réalisé
                </button>
              )}
              {(dossier.status === "planifie" || dossier.status === "en_cours") && (
                <button type="button" className={styles.menuItem} role="menuitem"
                  onClick={() => { onToggleMenu(); onPlanify(); }}>
                  <Icon name="planification" size={15} /> Reprogrammer (non présenté)
                </button>
              )}

              {(dossier.status === "a_planifier" || dossier.status === "planifie" || dossier.status === "en_cours") && (
                <div className={styles.menuDivider} />
              )}
              <div className={styles.menuLabel}>Communication</div>
              {dossier.status === "planifie" && lead.email && dossier.plannedAt && (
                <button type="button" className={styles.menuItem} role="menuitem"
                  onClick={() => { onToggleMenu(); onConfirmEmail(); }}>
                  <Icon name="mail" size={15} /> Confirmation au client
                </button>
              )}
              <button type="button" className={styles.menuItem} role="menuitem"
                onClick={() => { onToggleMenu(); onSendIntervenant(); }}>
                <Icon name="mail" size={15} /> Envoyer à l&apos;intervenant
              </button>

              <div className={styles.menuDivider} />
              <div className={styles.menuLabel}>Documents &amp; facturation</div>
              {devisDoc && (
                <Link href={`/devis/${devisDoc.id}`} className={styles.menuItem} role="menuitem">
                  <Icon name="document" size={15} /> Consulter le devis
                </Link>
              )}
              {dossier.status === "finalise" && !finaleDoc && (
                <button type="button" className={styles.menuItem} data-variant="primary" role="menuitem"
                  onClick={() => { onToggleMenu(); onGenerateFinale(); }}>
                  <Icon name="comptabilite" size={15} /> Émettre la facture finale
                </button>
              )}
              {finaleDoc && (
                <Link href={`/factures/${finaleDoc.id}`} className={styles.menuItem} role="menuitem">
                  <Icon name="document" size={15} /> Voir la facture finale
                </Link>
              )}
              {dossier.status !== "solde" && dossier.paymentStatus !== "solde" && (
                <button type="button" className={styles.menuItem} data-variant="success" role="menuitem"
                  onClick={() => { onToggleMenu(); onSold(); }}>
                  <Icon name="check" size={15} /> Marquer soldé
                </button>
              )}

              <div className={styles.menuDivider} />
              <button type="button" className={styles.menuItem} role="menuitem"
                onClick={() => { onToggleMenu(); onEdit(); }}>
                <Icon name="edit" size={15} /> Modifier le dossier
              </button>
            </div>
          )}
        </div>
        </div>
      </td>
    </tr>
  );
}
