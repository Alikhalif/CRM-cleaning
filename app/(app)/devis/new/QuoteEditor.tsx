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
  DevisPrefill,
  EntityOption,
  LeadContext,
  PrestationOption,
} from "@/lib/devis-server";
import {
  createDevis,
  updateDevisBrouillon,
  type CreateDevisIntent,
  type DraftInput,
} from "./actions";
import LeadRecapPanel from "./LeadRecapPanel";
import RedactionAssistee from "./RedactionAssistee";
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
  prefill: DevisPrefill | null;
  /**
   * Brouillon repris pour MODIFICATION (`?brouillon=<id>`).
   *
   * Quand il est fourni, l'éditeur écrit en place au lieu de créer un second
   * document : c'est ce qui permet de corriger un devis préparé depuis la
   * découverte sans laisser deux brouillons dans « Devis à réaliser », et
   * sans consommer un deuxième numéro.
   */
  brouillonId: string | null;
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
  prefill: DevisPrefill | null,
): Draft {
  // Resolve a client id from the prefill source, the explicit ?client= param,
  // or by following the lead's source_lead_id → matching client (lead-origin
  // clients have source_lead_id = lead.id).
  const resolvedClient =
    (prefill?.clientId && clients.find((c) => c.id === prefill.clientId)) ||
    (preselectedClientId && clients.find((c) => c.id === preselectedClientId)) ||
    (leadContext && clients.find((c) => c.sourceLeadId === leadContext.id)) ||
    null;

  const sector = leadContext?.sector ?? resolvedClient?.sectors[0] ?? null;
  const issuedAt = today();

  return {
    clientId: resolvedClient?.id ?? "",
    // Keep the source société pre-selected so the commercial consciously
    // switches to another one for the cheaper re-quote.
    entityId: prefill?.entityId ?? entities[0]?.id ?? "",
    issuedAt,
    validUntil: plusDays(issuedAt, 30),
    paymentTermSlug: sector ? DEFAULT_PAYMENT_TERM[sector] : "30j",
    acomptePct: prefill ? prefill.acomptePct : sector ? DEFAULT_ACOMPTE_PCT[sector] : 0,
    notes: prefill?.notes ?? "",
    lines: (prefill?.lines ?? []).map((l) => ({
      id: makeLineId(),
      prestationId: l.prestationId,
      label: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unitPriceHt: l.unitPriceHt,
      vatRate: l.vatRate,
      discountPct: l.discountPct,
    })),
  };
}

export default function QuoteEditor({
  clients,
  entities,
  prestations,
  leadContext,
  preselectedClientId,
  prefill,
  brouillonId,
}: Props) {
  const router = useRouter();
  // Mode « modification d'un brouillon » : même formulaire, écriture en place.
  const modeModification = brouillonId !== null;

  const [draft, setDraft] = useState<Draft>(() =>
    buildInitialDraft(clients, entities, leadContext, preselectedClientId, prefill),
  );
  const [picker, setPicker] = useState("");
  const [submitting, setSubmitting] = useState<CreateDevisIntent | "preview" | null>(null);
  // Visualisation (§6 du cahier du 2026-11-06). `apercuId` est l'identifiant du
  // brouillon enregistré dont on montre le PDF ; `apercuCle` force le
  // rechargement de l'iframe après « Actualiser », sans remonter le composant.
  const [apercuId, setApercuId] = useState<string | null>(null);
  const [apercuCle, setApercuCle] = useState(0);
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

  // §17.5 — « Régénérer le titre ». La DÉSIGNATION du devis est portée par
  // le libellé de la première ligne de prestation : c'est ce que
  // `genererDevisDepuisDecouverte` y écrit, et ce que le PDF affiche.
  //
  // Si le brouillon n'a aucune ligne — cas d'un devis repris à la main —
  // le titre n'a nulle part où aller : on en crée une, à zéro euro, pour
  // ne pas perdre le texte. Aucun montant n'est jamais déduit du titre
  // (interdiction 17 du §19).
  const setTitrePrestation = (titre: string) =>
    setDraft((d) => {
      if (d.lines.length === 0) {
        return {
          ...d,
          lines: [{
            id: makeLineId(), label: titre, quantity: 1, unit: "forfait",
            unitPriceHt: 0, vatRate: 20, discountPct: 0,
          }],
        };
      }
      return {
        ...d,
        lines: d.lines.map((l, i) => (i === 0 ? { ...l, label: titre } : l)),
      };
    });

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
    setDraft((d) => {
      // Un service porteur d'une description (bibliothèque de devis) pré-remplit
      // ses conditions/prestations comprises dans les notes du devis.
      const desc = prestation?.description?.trim();
      const notes =
        desc && prestation
          ? [d.notes.trim(), `${prestation.label} :\n${desc}`].filter(Boolean).join("\n\n")
          : d.notes;
      return { ...d, lines: [...d.lines, line], notes };
    });
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
      // En modification, on écrit EN PLACE. L'intention « envoyer » n'est pas
      // proposée dans ce mode : l'envoi se fait depuis la fiche du document,
      // où il vit déjà, pour ne pas dupliquer ce processus.
      const result = brouillonId
        ? await updateDevisBrouillon(brouillonId, payload)
        : await createDevis(payload, intent);
      if (!result.ok) {
        setServerError(result.error);
        setSubmitting(null);
        return;
      }
      if (brouillonId) {
        router.push(`/devis/${brouillonId}`);
        return;
      }
      // Email send is best-effort when intent="send" — if Brevo refused,
      // the devis is saved but no email left. Surface the warning + park
      // the user on the document detail page so they can retry from the
      // SendEmailModal (which shows the same Brevo error live).
      if (result.emailWarning) {
        setServerError(result.emailWarning);
        setSubmitting(null);
        router.push(`/devis/${result.id}`);
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
      // Même règle qu'à l'enregistrement : en modification on met à jour le
      // brouillon existant, sans en créer un second pour voir un aperçu.
      const result = brouillonId
        ? await updateDevisBrouillon(brouillonId, payload)
        : await createDevis(payload, "draft");
      if (!result.ok) {
        setServerError(result.error);
        setSubmitting(null);
        return;
      }
      // ── POURQUOI UNE MODALE, ET PLUS UN ONGLET + REDIRECTION ──────
      //
      // L'aperçu ouvrait le PDF dans un onglet puis faisait `router.push`
      // vers la fiche du devis : le commercial perdait son écran de
      // rédaction et devait y revenir à la main. Le §6 demande une
      // visualisation dont on « retourne à la rédaction » — donc sans
      // quitter l'éditeur.
      //
      // Le PDF affiché est celui de `/api/documents/[id]/preview-pdf`,
      // c'est-à-dire EXACTEMENT le document final : aucun moteur de rendu
      // n'est dupliqué, et la modale ne peut rien envoyer.
      setApercuId(result.id);
      setApercuCle((n) => n + 1);
      setSubmitting(null);
      // Le brouillon vient d'être créé : les enregistrements suivants doivent
      // le mettre à jour, pas en créer un second.
      if (!brouillonId) router.replace(`/devis/new?brouillon=${result.id}`, { scroll: false });
    });
  };

  /** Réenregistre le brouillon et recharge le PDF affiché. */
  const actualiserApercu = () => preview();

  const selectedClient = clients.find((c) => c.id === draft.clientId);
  const selectedEntity = entities.find((e) => e.id === draft.entityId);

  const apercu = apercuId ? (
    <div
      className={styles.apercuFond}
      role="dialog"
      aria-modal="true"
      aria-label="Visualisation du devis"
      onClick={(e) => { if (e.target === e.currentTarget) setApercuId(null); }}
    >
      <div className={styles.apercuPanneau}>
        <div className={styles.apercuBarre}>
          <h2 className={styles.apercuTitre}>
            Visualisation — le devis tel que le client le recevra
          </h2>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={submitting !== null}
            onClick={actualiserApercu}
            title="Réenregistrer le brouillon et recharger le document"
          >
            {submitting === "preview" ? "Actualisation…" : "Actualiser"}
          </button>
          <a
            className={styles.btnGhost}
            href={`/api/documents/${apercuId}/preview-pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external-link" size={16} />
            Ouvrir dans un onglet
          </a>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setApercuId(null)}
          >
            Retour à la rédaction
          </button>
        </div>
        {/* Le MÊME rendu que le document final : la route d'aperçu est celle
            qu'utilise la fiche du devis. Rien n'est réimplémenté ici, donc la
            visualisation ne peut pas diverger du PDF émis. */}
        <iframe
          key={apercuCle}
          className={styles.apercuCadre}
          src={`/api/documents/${apercuId}/preview-pdf#toolbar=1`}
          title="Devis en prévisualisation"
        />
        <p className={styles.apercuPied}>
          Le brouillon a été enregistré pour produire ce document. <strong>Aucun envoi
          n&apos;a été déclenché</strong> : le devis part depuis sa fiche, après votre
          validation. Fermez cette fenêtre pour reprendre la rédaction — vos
          modifications sont conservées.
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.page}>
      {apercu}
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/comptabilite?tab=devis" className={styles.breadcrumbLink}>
          Comptabilité
        </Link>
        <span aria-hidden="true">/</span>
        <span>{modeModification ? "Modifier le brouillon" : "Nouveau devis"}</span>
      </nav>
      <header>
        <h1 className={styles.title}>
          {modeModification
            ? `Modifier le brouillon${prefill?.sourceNum ? ` ${prefill.sourceNum}` : ""}`
            : prefill
              ? "Nouveau devis (moins cher)"
              : "Nouveau devis"}
        </h1>
        <p className={styles.subtitle}>
          {modeModification
            ? "Les modifications remplacent le brouillon : aucun second devis n'est créé."
            : "Éditeur ligne par ligne · pré-rempli depuis le lead/client de contexte"}
          {leadContext && (
            <> · contexte lead <strong>{leadContext.shortId}</strong> ({leadContext.clientName})</>
          )}
        </p>
      </header>

      {/* Le bandeau « re-devis moins cher » n'a pas de sens en modification :
          la source du préremplissage est le brouillon lui-même, pas un devis
          refusé. */}
      {prefill && !modeModification && (
        <div
          role="status"
          style={{
            marginTop: "var(--sp-3)",
            padding: "var(--sp-3) var(--sp-4)",
            borderRadius: "var(--r-md)",
            background: "color-mix(in srgb, var(--tone-warning) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--tone-warning) 45%, transparent)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          <strong>Re-devis à prix inférieur</strong> — basé sur{" "}
          <strong>{prefill.sourceNum}</strong>, refusé à{" "}
          <strong>{formatEUR(prefill.sourceTotalTtc)}</strong> TTC
          {prefill.sourceRefusalReason ? <> (motif : {prefill.sourceRefusalReason})</> : null}.
          {" "}Les lignes sont reprises ; choisissez une autre <strong>société émettrice</strong>{" "}
          et proposez un montant <strong>inférieur</strong> avant d&apos;envoyer.
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* Récap lead + découverte — tout sous les yeux pour créer le devis. */}
          {leadContext && <LeadRecapPanel lead={leadContext} />}
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

          {/* ── Rédaction assistée (§17) ──────────────────────────────── */}
          <RedactionAssistee
            brouillonId={brouillonId}
            notes={draft.notes}
            titre={draft.lines[0]?.label ?? ""}
            onNotes={(t) => set("notes", t)}
            onTitre={setTitrePrestation}
          />

          {/* ── Notes ────────────────────────────────────────────────── */}
          <section className={styles.card}>
            <h2 className={styles.h2}>Notes</h2>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={styles.textarea}
              rows={16}
              placeholder="PRESTATION · DÉTAIL DE LA PRESTATION · RÉSERVES — ou conditions particulières."
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
                className={modeModification ? styles.btnPrimary : styles.btnGhost}
                disabled={submitting !== null}
                onClick={() => submit("draft")}
              >
                {submitting === "draft"
                  ? "Enregistrement…"
                  : modeModification
                    ? "Enregistrer les modifications"
                    : "Sauvegarder brouillon"}
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={submitting !== null}
                onClick={preview}
                title="Voir le devis tel que le client le recevra"
              >
                <Icon name="eye" size={16} />
                {submitting === "preview" ? "Préparation…" : "Visualisation"}
              </button>
              {/* Pas d'envoi depuis ce mode : le devis part depuis sa fiche,
                  où le processus existe déjà (e-mail, signature, « marquer
                  envoyé »). Un second chemin d'envoi se désynchroniserait. */}
              {!modeModification && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={submitting !== null}
                  onClick={() => submit("send")}
                >
                  {submitting === "send" ? "Envoi…" : "Envoyer au client"}
                </button>
              )}
            </div>
            {modeModification && (
              <p className={styles.fieldHint} style={{ marginTop: "var(--sp-2)" }}>
                L&apos;envoi au client se fait depuis la fiche du devis, après
                enregistrement.
              </p>
            )}
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
