"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  DEFAULT_ACOMPTE_PCT,
  DEFAULT_PAYMENT_TERM,
  PAYMENT_TERMS,
  SECTOR_LABEL,
  formatEUR,
  type PaymentTermSlug,
} from "@/lib/leads";
import type {
  ClientOption,
  EntityOption,
  LeadContext,
  PrestationOption,
} from "@/lib/devis-server";
import { createDevis, type CreateDevisIntent, type DraftInput } from "./actions";
import styles from "./QuoteEditor.module.scss";

type DraftLine = {
  id: string;
  prestationId?: string;
  label: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  discountPct: number;
};

type Draft = {
  clientId: string;
  entityId: string;
  issuedAt: string;
  validUntil: string;
  paymentTermSlug: PaymentTermSlug;
  acomptePct: number;
  notes: string;
  lines: DraftLine[];
};

type Props = {
  clients: ClientOption[];
  entities: EntityOption[];
  prestations: PrestationOption[];
  leadContext: LeadContext | null;
  preselectedClientId: string | null;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeLineId(): string {
  return `dl_${Math.random().toString(36).slice(2, 9)}`;
}

function buildInitialDraft(
  clients: ClientOption[],
  entities: EntityOption[],
  leadContext: LeadContext | null,
  preselectedClientId: string | null,
): Draft {
  // Resolve a client id from either the explicit ?client= param or by
  // following the lead's source_lead_id → matching client (lead-origin
  // clients have source_lead_id = lead.id).
  const resolvedClient =
    (preselectedClientId && clients.find((c) => c.id === preselectedClientId)) ||
    (leadContext && clients.find((c) => c.sourceLeadId === leadContext.id)) ||
    null;

  const sector = leadContext?.sector ?? resolvedClient?.sectors[0] ?? null;
  const issuedAt = today();

  return {
    clientId: resolvedClient?.id ?? "",
    entityId: entities[0]?.id ?? "",
    issuedAt,
    validUntil: plusDays(issuedAt, 30),
    paymentTermSlug: sector ? DEFAULT_PAYMENT_TERM[sector] : "30j",
    acomptePct: sector ? DEFAULT_ACOMPTE_PCT[sector] : 0,
    notes: "",
    lines: [],
  };
}

export default function QuoteEditor({
  clients,
  entities,
  prestations,
  leadContext,
  preselectedClientId,
}: Props) {
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(() =>
    buildInitialDraft(clients, entities, leadContext, preselectedClientId),
  );
  const [picker, setPicker] = useState("");
  const [submitting, setSubmitting] = useState<CreateDevisIntent | "preview" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Derived ──────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const vatByRate = new Map<number, { ht: number; vat: number }>();
    let totalHt = 0;
    for (const l of draft.lines) {
      const lineHt = l.quantity * l.unitPriceHt * (1 - l.discountPct / 100);
      totalHt += lineHt;
      const cur = vatByRate.get(l.vatRate) ?? { ht: 0, vat: 0 };
      cur.ht += lineHt;
      cur.vat += (lineHt * l.vatRate) / 100;
      vatByRate.set(l.vatRate, cur);
    }
    const totalVat = [...vatByRate.values()].reduce((s, v) => s + v.vat, 0);
    const totalTtc = totalHt + totalVat;
    const acompteAmount = (totalTtc * draft.acomptePct) / 100;
    const soldeDu = totalTtc - acompteAmount;
    return {
      totalHt,
      totalVat,
      totalTtc,
      acompteAmount,
      soldeDu,
      vatBreakdown: [...vatByRate.entries()]
        .sort(([a], [b]) => a - b)
        .map(([rate, { vat }]) => ({ rate, vat })),
    };
  }, [draft.lines, draft.acomptePct]);

  // ── Field setters ────────────────────────────────────────────────────
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));

  const removeLine = (id: string) =>
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));

  const addLine = (prestation?: PrestationOption) => {
    const line: DraftLine = prestation
      ? {
          id: makeLineId(),
          prestationId: prestation.id,
          label: prestation.label,
          quantity: 1,
          unit: prestation.unit,
          unitPriceHt: prestation.unitPriceHt,
          vatRate: prestation.vatRate,
          discountPct: 0,
        }
      : {
          id: makeLineId(),
          label: "",
          quantity: 1,
          unit: "unité",
          unitPriceHt: 0,
          vatRate: 20,
          discountPct: 0,
        };
    setDraft((d) => ({ ...d, lines: [...d.lines, line] }));
  };

  const prestationsBySector = useMemo(() => {
    const by = new Map<string, PrestationOption[]>();
    for (const p of prestations) {
      const arr = by.get(p.sector) ?? [];
      arr.push(p);
      by.set(p.sector, arr);
    }
    return by;
  }, [prestations]);

  const onPickPrestation = (id: string) => {
    if (!id) return;
    if (id === "__blank__") {
      addLine();
    } else {
      const p = prestations.find((x) => x.id === id);
      if (p) addLine(p);
    }
    setPicker("");
  };

  // ── Submit ───────────────────────────────────────────────────────────
  const submit = (intent: CreateDevisIntent) => {
    setServerError(null);
    if (!draft.clientId) {
      setServerError("Sélectionnez un client avant d'enregistrer le devis.");
      return;
    }
    if (draft.lines.length === 0) {
      setServerError("Ajoutez au moins une ligne au devis.");
      return;
    }
    setSubmitting(intent);

    // Strip the client-only id field; the server doesn't need it.
    const payload: DraftInput = {
      clientId: draft.clientId,
      entityId: draft.entityId,
      issuedAt: draft.issuedAt,
      validUntil: draft.validUntil,
      paymentTermSlug: draft.paymentTermSlug,
      acomptePct: draft.acomptePct,
      notes: draft.notes,
      lines: draft.lines.map((l) => ({
        prestationId: l.prestationId,
        label: l.label,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceHt: l.unitPriceHt,
        vatRate: l.vatRate,
        discountPct: l.discountPct,
      })),
    };

    startTransition(async () => {
      const result = await createDevis(payload, intent);
      if (!result.ok) {
        setServerError(result.error);
        setSubmitting(null);
        return;
      }
      // Successful insert — jump to Comptabilité on the devis tab so the
      // user sees the new row immediately.
      router.push(`/comptabilite?tab=devis`);
    });
  };

  // Aperçu PDF: the draft doesn't exist in the DB yet, so we save as
  // brouillon first, then open the rendered PDF in a new tab. The user
  // can then continue editing or send from the document detail page.
  const preview = () => {
    setServerError(null);
    if (!draft.clientId) {
      setServerError("Sélectionnez un client avant d'afficher l'aperçu.");
      return;
    }
    if (draft.lines.length === 0) {
      setServerError("Ajoutez au moins une ligne avant d'afficher l'aperçu.");
      return;
    }
    setSubmitting("preview");
    const payload: DraftInput = {
      clientId: draft.clientId,
      entityId: draft.entityId,
      issuedAt: draft.issuedAt,
      validUntil: draft.validUntil,
      paymentTermSlug: draft.paymentTermSlug,
      acomptePct: draft.acomptePct,
      notes: draft.notes,
      lines: draft.lines.map((l) => ({
        prestationId: l.prestationId,
        label: l.label,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceHt: l.unitPriceHt,
        vatRate: l.vatRate,
        discountPct: l.discountPct,
      })),
    };
    startTransition(async () => {
      const result = await createDevis(payload, "draft");
      if (!result.ok) {
        setServerError(result.error);
        setSubmitting(null);
        return;
      }
      // Open the rendered PDF in a new tab and route the user to the
      // saved draft so they can keep editing or send it.
      window.open(`/api/documents/${result.id}/preview-pdf`, "_blank", "noopener,noreferrer");
      router.push(`/devis/${result.id}`);
    });
  };

  const selectedClient = clients.find((c) => c.id === draft.clientId);
  const selectedEntity = entities.find((e) => e.id === draft.entityId);

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/comptabilite?tab=devis" className={styles.breadcrumbLink}>
          Comptabilité
        </Link>
        <span aria-hidden="true">/</span>
        <span>Nouveau devis</span>
      </nav>
      <header>
        <h1 className={styles.title}>Nouveau devis</h1>
        <p className={styles.subtitle}>
          Éditeur ligne par ligne · pré-rempli depuis le lead/client de contexte
          {leadContext && (
            <> · contexte lead <strong>{leadContext.shortId}</strong> ({leadContext.clientName})</>
          )}
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* ── Document card ────────────────────────────────────────── */}
          <section className={styles.card}>
            <h2 className={styles.h2}>Document</h2>
            <div className={styles.grid}>
              <Field label="Client" required>
                <select
                  required
                  value={draft.clientId}
                  onChange={(e) => set("clientId", e.target.value)}
                  className={styles.input}
                >
                  <option value="">— Sélectionner —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.type === "pro" ? "(Pro)" : "(Part.)"}
                    </option>
                  ))}
                </select>
                <Link href="/clients/new" className={styles.fieldHint}>
                  + Créer un nouveau client
                </Link>
              </Field>

              <Field label="Entité émettrice">
                <select
                  value={draft.entityId}
                  onChange={(e) => set("entityId", e.target.value)}
                  className={styles.input}
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.legalName}</option>
                  ))}
                </select>
              </Field>

              <Field label="Date d'émission">
                <input
                  type="date"
                  value={draft.issuedAt}
                  onChange={(e) => set("issuedAt", e.target.value)}
                  className={styles.input}
                />
              </Field>

              <Field label="Valide jusqu'au">
                <input
                  type="date"
                  value={draft.validUntil}
                  onChange={(e) => set("validUntil", e.target.value)}
                  className={styles.input}
                />
              </Field>

              <Field label="Conditions de paiement">
                <select
                  value={draft.paymentTermSlug}
                  onChange={(e) => set("paymentTermSlug", e.target.value as PaymentTermSlug)}
                  className={styles.input}
                >
                  {Object.values(PAYMENT_TERMS).map((t) => (
                    <option key={t.slug} value={t.slug}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <Field label={`Acompte (${draft.acomptePct}%)`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={draft.acomptePct}
                  onChange={(e) => set("acomptePct", clamp(0, 100, +e.target.value))}
                  className={styles.input}
                />
              </Field>
            </div>
          </section>

          {/* ── Lines card ────────────────────────────────────────────── */}
          <section className={styles.card}>
            <h2 className={styles.h2}>
              Lignes
              <span className={styles.h2Count}>{draft.lines.length}</span>
            </h2>

            {draft.lines.length === 0 ? (
              <p className={styles.empty}>
                Aucune ligne. Sélectionnez une prestation ci-dessous pour démarrer.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colDescription}>Description</th>
                      <th className={styles.tNum}>Qté</th>
                      <th>Unité</th>
                      <th className={styles.tNum}>P.U. HT</th>
                      <th className={styles.tNum}>TVA %</th>
                      <th className={styles.tNum}>Remise %</th>
                      <th className={styles.tNum}>Total HT</th>
                      <th aria-label="Action" />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((line) => {
                      const lineHt =
                        line.quantity * line.unitPriceHt * (1 - line.discountPct / 100);
                      return (
                        <tr key={line.id}>
                          <td className={styles.colDescription}>
                            <input
                              type="text"
                              value={line.label}
                              onChange={(e) => updateLine(line.id, { label: e.target.value })}
                              className={styles.cellInput}
                              placeholder="Description de la ligne"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.id, { quantity: +e.target.value || 0 })
                              }
                              className={`${styles.cellInput} ${styles.tNum}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={line.unit}
                              onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                              className={styles.cellInput}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={line.unitPriceHt}
                              onChange={(e) =>
                                updateLine(line.id, { unitPriceHt: +e.target.value || 0 })
                              }
                              className={`${styles.cellInput} ${styles.tNum}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={line.vatRate}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  vatRate: clamp(0, 100, +e.target.value || 0),
                                })
                              }
                              className={`${styles.cellInput} ${styles.tNum}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={line.discountPct}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  discountPct: clamp(0, 100, +e.target.value || 0),
                                })
                              }
                              className={`${styles.cellInput} ${styles.tNum}`}
                            />
                          </td>
                          <td className={`${styles.tNum} ${styles.lineTotal}`}>
                            {formatEUR(lineHt)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.lineDelete}
                              onClick={() => removeLine(line.id)}
                              aria-label="Supprimer la ligne"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.addRow}>
              <select
                value={picker}
                onChange={(e) => onPickPrestation(e.target.value)}
                className={styles.input}
                aria-label="Ajouter une prestation"
              >
                <option value="">+ Ajouter depuis le catalogue…</option>
                <option value="__blank__">+ Ligne libre (sans prestation)</option>
                {[...prestationsBySector.entries()].map(([sector, list]) => (
                  <optgroup
                    key={sector}
                    label={SECTOR_LABEL[sector as keyof typeof SECTOR_LABEL]}
                  >
                    {list.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {formatEUR(p.unitPriceHt)} / {p.unit} · TVA {p.vatRate}%
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </section>

          {/* ── Notes ────────────────────────────────────────────────── */}
          <section className={styles.card}>
            <h2 className={styles.h2}>Notes</h2>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={styles.textarea}
              rows={3}
              placeholder="Conditions particulières, mentions complémentaires…"
            />
          </section>
        </div>

        {/* ── Sticky totals ────────────────────────────────────────────── */}
        <aside className={styles.aside}>
          <section className={styles.card}>
            <h2 className={styles.h2}>Récapitulatif</h2>
            <div className={styles.totals}>
              <Row label="Total HT" value={formatEUR(totals.totalHt)} />
              {totals.vatBreakdown.length === 0 ? (
                <Row label="TVA" value={formatEUR(0)} muted />
              ) : (
                totals.vatBreakdown.map((v) => (
                  <Row
                    key={v.rate}
                    label={`TVA ${v.rate} %`}
                    value={formatEUR(v.vat)}
                    muted
                  />
                ))
              )}
              <Row label="Total TTC" value={formatEUR(totals.totalTtc)} bold />
              {draft.acomptePct > 0 && (
                <>
                  <Row
                    label={`Acompte (${draft.acomptePct} %)`}
                    value={formatEUR(totals.acompteAmount)}
                    highlight
                  />
                  <Row label="Solde dû" value={formatEUR(totals.soldeDu)} muted />
                </>
              )}
            </div>

            {selectedClient && selectedEntity && (
              <p className={styles.contextHint}>
                Pour <strong>{selectedClient.name}</strong> · {selectedEntity.legalName}
              </p>
            )}

            {serverError && (
              <p className={styles.errorBox} role="alert">
                {serverError}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={submitting !== null}
                onClick={() => submit("draft")}
              >
                {submitting === "draft" ? "Enregistrement…" : "Sauvegarder brouillon"}
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={submitting !== null}
                onClick={preview}
              >
                Aperçu PDF
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={submitting !== null}
                onClick={() => submit("send")}
              >
                {submitting === "send" ? "Envoi…" : "Envoyer au client"}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) {
  const cls = [
    styles.totalRow,
    muted && styles.totalRowMuted,
    bold && styles.totalRowBold,
    highlight && styles.totalRowHighlight,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <span>{label}</span>
      <span className={styles.totalValue}>{value}</span>
    </div>
  );
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}
