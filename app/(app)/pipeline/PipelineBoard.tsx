"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { setStoredValue, useStoredValue } from "@/lib/client-store";
import {
  PIPELINE_COLUMNS,
  SECTOR_LABEL,
  SECTOR_VAR,
  formatEUR,
  needsEnvoi,
  needsSignature,
  pipelineColumnFor,
  unpaidInvoiceId,
  type Commercial,
  type Lead,
  type LeadStatus,
  type PipelineColumnKey,
  type SubEnvoi,
  type SubSignature,
} from "@/lib/leads";
import LeadCard from "./LeadCard";
import {
  launchSequence as launchSequenceAction,
  setLeadNrp,
  updateLeadStatus,
  updateLeadSubEnvoi,
  updateLeadSubSignature,
} from "./actions";
import { markDocumentPaid } from "@/app/(app)/_shared/document-actions";
import styles from "./PipelineBoard.module.scss";

const VIEW_KEY = "cgk-pipeline-view";
type View = "kanban" | "liste";

const COLUMN_ORDER: Record<PipelineColumnKey, number> = {
  lead: 0, envoye: 1, ouvert: 2, signe: 3, acompte_paye: 4, encaisse: 5, perdu: 6,
};

type Props = {
  initialLeads: Lead[];
  commerciaux: Commercial[];
  n8nEnabled: boolean;
};

export default function PipelineBoard({ initialLeads, commerciaux, n8nEnabled }: Props) {
  // Local state seeded from the server fetch. Optimistic updates apply
  // immediately; the server action runs in a transition and rolls back on
  // error.
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<PipelineColumnKey | null>(null);
  const [, startTransition] = useTransition();

  const view: View =
    useStoredValue(VIEW_KEY, "kanban") === "liste" ? "liste" : "kanban";
  const setView = (next: View) => setStoredValue(VIEW_KEY, next);

  const ownersById = useMemo(
    () => new Map(commerciaux.map((c) => [c.id, c])),
    [commerciaux],
  );

  const byColumn = useMemo(() => {
    const map = new Map<PipelineColumnKey, Lead[]>();
    for (const col of PIPELINE_COLUMNS) map.set(col.status, []);
    const sorted = [...leads].sort(
      (a, b) => +new Date(b.lastActionAt) - +new Date(a.lastActionAt),
    );
    // Use pipelineColumnFor (status + paid documents) so Acompte / Encaisse
    // columns get populated automatically when invoices flip to paid.
    for (const lead of sorted) map.get(pipelineColumnFor(lead))?.push(lead);
    return map;
  }, [leads]);

  // Flat list (Liste view) — same data, sorted by pipeline column then activity.
  const flat = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const so = COLUMN_ORDER[pipelineColumnFor(a)] - COLUMN_ORDER[pipelineColumnFor(b)];
        if (so !== 0) return so;
        return +new Date(b.lastActionAt) - +new Date(a.lastActionAt);
      }),
    [leads],
  );

  // Optimistic helper: applies a transform locally, runs the server action,
  // rolls back if the server says no.
  const optimistic = (
    transform: (curr: Lead[]) => Lead[],
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => {
    const previous = leads;
    setLeads(transform);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setLeads(previous);
        alert(`Échec de la mise à jour : ${result.error}`);
      }
    });
  };

  const move = (id: string, target: PipelineColumnKey) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const currentCol = pipelineColumnFor(lead);
    if (currentCol === target) return;

    // CDC monotone: forbid backward moves through Acompte / Encaissé /
    // Perdu (you can't "un-pay" or "un-lose" by drag).
    if (COLUMN_ORDER[currentCol] > COLUMN_ORDER[target] && target !== "lead" && target !== "envoye" && target !== "ouvert" && target !== "signe") {
      alert("Ce mouvement n'est pas autorisé (CDC §2.2 — pipeline monotone).");
      return;
    }

    // Drop into "Acompte encaissé" → mark the lead's unpaid acompte invoice as paid.
    if (target === "acompte_paye") {
      const acompteId = unpaidInvoiceId(lead, "acompte");
      if (!acompteId) {
        alert("Aucune facture d'acompte à encaisser pour ce lead.");
        return;
      }
      optimistic(
        (curr) =>
          curr.map((l) =>
            l.id === id
              ? {
                  ...l,
                  documents: (l.documents ?? []).map((d) =>
                    d.id === acompteId ? { ...d, status: "paye" } : d,
                  ),
                  lastActionLabel: "Acompte encaissé",
                  lastActionAt: new Date().toISOString(),
                }
              : l,
          ),
        () => markDocumentPaid(acompteId),
      );
      return;
    }

    // Drop into "Encaissement final" → mark the lead's unpaid finale invoice as paid.
    // The markDocumentPaid action already cascades dossier.payment_status = 'solde'.
    if (target === "encaisse") {
      const finaleId = unpaidInvoiceId(lead, "finale");
      if (!finaleId) {
        // No unpaid finale — fall through to the regular status update.
        // Useful for legacy leads where status=encaisse but no doc was tagged.
        optimistic(
          (curr) => curr.map((l) => (l.id === id ? applyStatusChange(l, "encaisse") : l)),
          () => updateLeadStatus(id, "encaisse"),
        );
        return;
      }
      optimistic(
        (curr) =>
          curr.map((l) =>
            l.id === id
              ? {
                  ...l,
                  status: "encaisse",
                  documents: (l.documents ?? []).map((d) =>
                    d.id === finaleId ? { ...d, status: "paye" } : d,
                  ),
                  lastActionLabel: "Facture finale encaissée",
                  lastActionAt: new Date().toISOString(),
                }
              : l,
          ),
        () => markDocumentPaid(finaleId),
      );
      return;
    }

    // Otherwise — regular status-only update (lead / envoye / ouvert / signe / perdu).
    optimistic(
      (curr) => curr.map((l) => (l.id === id ? applyStatusChange(l, target as LeadStatus) : l)),
      () => updateLeadStatus(id, target as LeadStatus),
    );
  };

  const setEnvoi = (id: string, value: SubEnvoi) =>
    optimistic(
      (curr) => curr.map((l) => (l.id === id ? { ...l, subEnvoi: value } : l)),
      () => updateLeadSubEnvoi(id, value),
    );

  const setSignature = (id: string, value: SubSignature) =>
    optimistic(
      (curr) => curr.map((l) => (l.id === id ? { ...l, subSignature: value } : l)),
      () => updateLeadSubSignature(id, value),
    );

  const setNrp = (id: string, nrp: boolean) =>
    optimistic(
      (curr) =>
        curr.map((l) =>
          l.id === id
            ? {
                ...l,
                isNrp: nrp,
                nrpAt: nrp ? new Date().toISOString() : undefined,
                lastActionLabel: nrp ? "Lead marqué NRP" : "Lead NRP retiré",
                lastActionAt: new Date().toISOString(),
              }
            : l,
        ),
      () => setLeadNrp(id, nrp),
    );

  const launchSequence = (lead: Lead) => {
    if (
      !confirm(
        `Lancer la séquence de relance n8n pour « ${lead.client} » ?\n\n` +
          "4 emails Brevo seront programmés. La séquence s'arrête dès que le client signe ou répond.",
      )
    )
      return;
    optimistic(
      (curr) =>
        curr.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                status: "envoye",
                subEnvoi: "auto",
                lastActionLabel: "Séquence n8n lancée",
                lastActionAt: new Date().toISOString(),
              }
            : l,
        ),
      () => launchSequenceAction(lead.id),
    );
  };

  return (
    <>
      <div className={styles.viewToolbar}>
        <div className={styles.viewToggle} role="tablist" aria-label="Affichage">
          <button
            type="button"
            role="tab"
            aria-selected={view === "kanban"}
            className={`${styles.viewBtn} ${view === "kanban" ? styles.viewBtnOn : ""}`}
            onClick={() => setView("kanban")}
          >
            <Icon name="pipeline" size={14} /> Kanban
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "liste"}
            className={`${styles.viewBtn} ${view === "liste" ? styles.viewBtnOn : ""}`}
            onClick={() => setView("liste")}
          >
            <Icon name="leads" size={14} /> Liste
          </button>
        </div>
        <span className={styles.viewCount}>
          {leads.length} carte{leads.length > 1 ? "s" : ""}
        </span>
      </div>

      {view === "liste" ? (
        <ListView
          rows={flat}
          ownersById={ownersById}
          onMove={move}
          onLaunchSequence={launchSequence}
          n8nEnabled={n8nEnabled}
        />
      ) : (
        <div className={styles.board}>
          {PIPELINE_COLUMNS.map((col) => {
            const cards = byColumn.get(col.status) ?? [];
            const total = cards.reduce((s, l) => s + l.amount, 0);
            const isHover = hoverColumn === col.status && draggingId !== null;

            return (
              <section
                key={col.status}
                className={styles.column}
                data-status={col.status}
                data-hover={isHover || undefined}
                onDragOver={(e) => {
                  if (draggingId) e.preventDefault();
                }}
                onDragEnter={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  setHoverColumn(col.status);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (hoverColumn === col.status) setHoverColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingId) move(draggingId, col.status);
                  setDraggingId(null);
                  setHoverColumn(null);
                }}
                aria-label={`${col.label} — ${cards.length} carte${cards.length > 1 ? "s" : ""}`}
              >
                <header className={styles.colHead}>
                  <div className={styles.colTitleRow}>
                    <h2 className={styles.colTitle}>{col.label}</h2>
                    <span className={styles.colCount}>{cards.length}</span>
                  </div>
                  <p className={styles.colTotal}>{formatEUR(total)}</p>
                </header>

                <div className={styles.colBody}>
                  {cards.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      owner={ownersById.get(lead.ownerId)}
                      isDragging={draggingId === lead.id}
                      onDragStart={setDraggingId}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setHoverColumn(null);
                      }}
                      onMove={move}
                      onSetEnvoi={setEnvoi}
                      onSetSignature={setSignature}
                      onSetNrp={setNrp}
                      onLaunchSequence={launchSequence}
                      n8nEnabled={n8nEnabled}
                    />
                  ))}
                  {cards.length === 0 && (
                    <p className={styles.empty}>{col.hint ?? "Aucune carte"}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Liste view ──────────────────────────────────────────────────────────
// Same data as the Kanban, rendered as a compact sortable-by-status table.
// Status changes happen through inline `<select>` cells so the user can still
// move cards without dragging.

type ListViewProps = {
  rows: Lead[];
  ownersById: Map<string, Commercial>;
  onMove: (id: string, target: PipelineColumnKey) => void;
  onLaunchSequence: (lead: Lead) => void;
  n8nEnabled: boolean;
};

function ListView({ rows, ownersById, onMove, onLaunchSequence, n8nEnabled }: ListViewProps) {
  return (
    <div className={styles.listWrap}>
      <table className={styles.listTable}>
        <thead>
          <tr>
            <th>Client</th>
            <th>Statut</th>
            <th>Secteur</th>
            <th className={styles.tNum}>Montant</th>
            <th>Commercial</th>
            <th>Badges</th>
            <th>Dernière action</th>
            <th aria-label="Action" />
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const owner = ownersById.get(lead.ownerId);
            return (
              <tr key={lead.id} data-status={lead.status} data-lost={lead.status === "perdu" || undefined}>
                <td>
                  <Link href={`/leads/${lead.id}`} className={styles.listClient}>
                    {lead.client}
                  </Link>
                  <div className={styles.listSub}>
                    <span className={styles.mono}>{lead.shortId}</span> · {lead.city}
                  </div>
                </td>
                <td>
                  <select
                    value={lead.status}
                    onChange={(e) => onMove(lead.id, e.target.value as LeadStatus)}
                    className={styles.listSelect}
                    aria-label={`Statut · ${lead.client}`}
                  >
                    {PIPELINE_COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>{c.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span
                    className={styles.listSector}
                    style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
                  >
                    {SECTOR_LABEL[lead.sector]}
                  </span>
                </td>
                <td className={styles.tNum}>{formatEUR(lead.amount)}</td>
                <td>
                  {owner ? (
                    <span className={styles.listOwner}>
                      <span
                        className={styles.listAvatar}
                        style={{ ["--av" as string]: owner.color }}
                        aria-hidden="true"
                      >
                        {owner.initials}
                      </span>
                      <span className={styles.listOwnerName}>{owner.name}</span>
                    </span>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td>
                  <div className={styles.listBadges}>
                    {needsEnvoi(lead) && (
                      <span className={styles.listBadgeDanger}>Canal manquant</span>
                    )}
                    {!needsEnvoi(lead) && lead.subEnvoi && (
                      <span className={styles.listBadge}>
                        {lead.subEnvoi === "mano" ? "Mano" : "Auto"}
                      </span>
                    )}
                    {needsSignature(lead) && (
                      <span className={styles.listBadgeDanger}>Acompte ?</span>
                    )}
                    {!needsSignature(lead) && lead.subSignature && (
                      <span className={styles.listBadge}>
                        {lead.subSignature === "avec" ? "Avec acompte" : "Sans acompte"}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div>{lead.lastActionLabel}</div>
                  <RelativeTime iso={lead.lastActionAt} className={styles.muted} />
                </td>
                <td>
                  {n8nEnabled &&
                    (lead.status === "lead" ||
                      (lead.status === "envoye" && lead.subEnvoi === "mano")) && (
                    <button
                      type="button"
                      className={styles.listAction}
                      onClick={() => onLaunchSequence(lead)}
                      title="Lancer la séquence n8n"
                    >
                      <Icon name="zap" size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className={styles.listEmpty}>
                Aucun lead.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Status transitions can clear sub-statuses that are no longer applicable.
function applyStatusChange(lead: Lead, target: LeadStatus): Lead {
  const next: Lead = {
    ...lead,
    status: target,
    lastActionLabel: transitionLabel(target),
    lastActionAt: new Date().toISOString(),
  };
  if (target === "lead") {
    next.subEnvoi = null;
    next.subSignature = null;
  } else if (target === "envoye" || target === "ouvert") {
    next.subSignature = null;
  }
  return next;
}

function transitionLabel(target: LeadStatus): string {
  switch (target) {
    case "lead":     return "Replacé en lead entrant";
    case "envoye":   return "Devis envoyé";
    case "ouvert":   return "Lien ouvert";
    case "signe":    return "Devis signé";
    case "encaisse": return "Encaissement final";
    case "perdu":    return "Marqué perdu";
  }
}
