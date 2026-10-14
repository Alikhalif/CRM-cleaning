"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { recordDiscovery, saveDiscovery, setLeadActivity } from "@/app/(app)/pipeline/actions";
import {
  ACOMPTE_STEPS,
  DELAI_SOUHAITE,
  DELAI_SOUHAITE_LABEL,
  ETATS_SALETE,
  ETAT_SALETE_LABEL,
  PRICE_RANGES,
  REACTIONS_PRIX,
  REACTION_PRIX_LABEL,
  STATUTS_CLIENT,
  STATUT_CLIENT_LABEL,
  WANTED_SLOTS,
  WANTED_SLOT_LABEL,
  type WantedSlot,
  type DiscoveryOutcome,
  type Lead,
} from "@/lib/leads";
import DebarrasFields from "./DebarrasFields";
import DemenagementFields from "./DemenagementFields";
import { computeRange, type PricingParams } from "@/lib/pricing/compute";
import { buildPricingInput } from "@/lib/pricing/discovery-input";
import styles from "./LeadDetail.module.scss";

// Fiche Découverte guidée qui S'ADAPTE au secteur : champs communs (surface,
// délai, fourchette, prix, réaction, contexte, acompte) + un bloc métier propre
// à l'activité (nettoyage → statut/saleté ; débarras / déménagement → champs
// techniques dédiés, stockés en JSONB). Jamais mélangés.

type Props = {
  lead: Lead;
  // Paramètres tarifaires de l'activité. null = non configurés par
  // l'administrateur → aucune fourchette n'est proposée.
  pricingParams: PricingParams | null;
};

const field: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem",
};
const lbl: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 };

export default function DiscoveryCard({ lead, pricingParams }: Props) {
  const router = useRouter();
  const leadId = lead.id;

  const isDebarras = lead.sector === "debarras";
  const isDemenagement = lead.sector === "demenagement";
  const isNettoyage = !isDebarras && !isDemenagement;

  const [surface, setSurface] = useState(lead.surfaceM2 != null ? String(lead.surfaceM2) : "");
  const [price, setPrice] = useState(lead.announcedPrice != null ? String(lead.announcedPrice) : "");
  const [priceRange, setPriceRange] = useState(lead.priceRange ?? "");
  const [delai, setDelai] = useState<string>(lead.delaiSouhaite ?? "");
  const [reaction, setReaction] = useState<string>(lead.reactionPrix ?? "");
  const [statut, setStatut] = useState<string>(lead.statutClient ?? "");
  const [salete, setSalete] = useState<string>(lead.etatSalete ?? "");
  const [acompte, setAcompte] = useState<string>(lead.acompteNegocie != null ? String(lead.acompteNegocie) : "");
  const [contexte, setContexte] = useState(lead.contexteIntervention ?? "");
  const [wantedDate, setWantedDate] = useState(lead.wantedDate ?? "");
  const [wantedSlot, setWantedSlot] = useState<string>(lead.wantedSlot ?? "");
  const [wantedStart, setWantedStart] = useState(lead.wantedTimeStart ?? "");
  const [wantedEnd, setWantedEnd] = useState(lead.wantedTimeEnd ?? "");
  // Champs techniques métier (débarras / déménagement).
  const [details, setDetails] = useState<Record<string, unknown>>(lead.discoveryDetails ?? {});
  const setDetail = (k: string, v: unknown) => setDetails((d) => ({ ...d, [k]: v }));

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  };

  const onSave = () => {
    const surfaceM2 = surface.trim() ? Number(surface) : null;
    const announcedPrice = price.trim() ? Number(price) : null;
    if (surfaceM2 != null && Number.isNaN(surfaceM2)) { setError("Surface invalide."); return; }
    if (announcedPrice != null && Number.isNaN(announcedPrice)) { setError("Prix annoncé invalide."); return; }
    run("save", () =>
      saveDiscovery(leadId, {
        surfaceM2,
        announcedPrice,
        priceRange: priceRange || null,
        delaiSouhaite: delai || null,
        reactionPrix: reaction || null,
        // Champs nettoyage uniquement — null pour les autres métiers.
        statutClient: isNettoyage ? (statut || null) : null,
        etatSalete: isNettoyage ? (salete || null) : null,
        contexteIntervention: contexte,
        acompteNegocie: acompte !== "" ? Number(acompte) : null,
        wantedDate: wantedDate || null,
        wantedSlot: wantedSlot || null,
        wantedTimeStart: wantedStart || null,
        wantedTimeEnd: wantedEnd || null,
        details: isNettoyage ? {} : details,
      }),
    );
  };

  const onOutcome = (outcome: DiscoveryOutcome) => {
    const announcedPrice = price.trim() ? Number(price) : null;
    let reason: string | undefined;
    if (outcome === "refus") {
      const r = window.prompt("Motif du refus (prix annoncé refusé) :", "");
      if (r === null) return;
      reason = r;
    }
    run(`outcome-${outcome}`, () => recordDiscovery(leadId, { announcedPrice, outcome, reason }));
  };


  // Fourchette recommandée. Recalculée à chaque modification de la découverte
  // (c'est une dérivée de l'état, pas une étape à déclencher) : le commercial
  // la lit pendant son appel, sans cliquer sur quoi que ce soit.
  const pricing = useMemo(() => {
    const { input, approx } = buildPricingInput({
      sector: lead.sector,
      surfaceM2: surface.trim() ? Number(surface) : null,
      details,
      delaiSouhaite: delai || null,
      isUrgent: Boolean(lead.isUrgent),
      isExtreme: Boolean(lead.isExtreme),
    });
    return { result: computeRange(pricingParams, input), approx };
  }, [pricingParams, lead.sector, lead.isUrgent, lead.isExtreme, surface, details, delai]);

  const sectorLabel = isDebarras ? "Débarras" : isDemenagement ? "Déménagement" : "Nettoyage";

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}><Icon name="search" size={14} /> Découverte · {sectorLabel}</h2>
        {lead.discoveryDoneAt && (
          <span className={styles.savedBadge} data-state="saved">
            <Icon name="check" size={11} /> Faite <RelativeTime iso={lead.discoveryDoneAt} />
          </span>
        )}
      </header>

      {/* ── Sélecteur du type de prestation (métier débarras/déménagement) ── */}
      {(isDebarras || isDemenagement) && (
        <div style={{ marginBottom: 12 }}>
          <span style={lbl}>Type de prestation</span>
          <div style={{ display: "flex", gap: 6 }}>
            {([["debarras", "Débarras"], ["demenagement", "Déménagement"]] as const).map(([slug, label]) => {
              const active = lead.sector === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => { if (!active) run(`act-${slug}`, () => setLeadActivity(leadId, slug)); }}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: "var(--r-sm)", cursor: active ? "default" : "pointer",
                    fontWeight: 600, fontSize: "0.875rem",
                    border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)",
                    background: active ? "var(--color-brand-500)" : "transparent",
                    color: active ? "#fff" : "var(--text-primary)",
                  }}
                >
                  {busy === `act-${slug}` ? "…" : label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bloc métier (adapté au secteur) ─────────────────────────── */}
      {isDebarras && <DebarrasFields details={details} set={setDetail} />}
      {isDemenagement && <DemenagementFields details={details} set={setDetail} />}

      {/* ── Champs communs à toutes les activités ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
        {!isDemenagement && (
          <label>
            <span style={lbl}>{isDebarras ? "Surface approximative (m²)" : "Surface (m²)"}</span>
            <input type="number" min={0} step="0.01" inputMode="decimal" value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="—" style={field} />
          </label>
        )}
        <label>
          <span style={lbl}>Délai souhaité</span>
          <select value={delai} onChange={(e) => setDelai(e.target.value)} style={field}>
            <option value="">—</option>
            {DELAI_SOUHAITE.map((d) => <option key={d} value={d}>{DELAI_SOUHAITE_LABEL[d]}</option>)}
          </select>
        </label>
        <label>
          <span style={lbl}>Fourchette de prix annoncée</span>
          <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} style={field}>
            <option value="">—</option>
            {PRICE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label>
          <span style={lbl}>Prix annoncé (€ TTC)</span>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" style={field} />
        </label>
        <label>
          <span style={lbl}>Réaction au prix</span>
          <select value={reaction} onChange={(e) => setReaction(e.target.value)} style={field}>
            <option value="">—</option>
            {REACTIONS_PRIX.map((r) => <option key={r} value={r}>{REACTION_PRIX_LABEL[r]}</option>)}
          </select>
        </label>
        {isNettoyage && (
          <>
            <label>
              <span style={lbl}>Statut du client</span>
              <select value={statut} onChange={(e) => setStatut(e.target.value)} style={field}>
                <option value="">—</option>
                {STATUTS_CLIENT.map((s) => <option key={s} value={s}>{STATUT_CLIENT_LABEL[s]}</option>)}
              </select>
            </label>
            <label>
              <span style={lbl}>État de saleté</span>
              <select value={salete} onChange={(e) => setSalete(e.target.value)} style={field}>
                <option value="">—</option>
                {ETATS_SALETE.map((s) => <option key={s} value={s}>{ETAT_SALETE_LABEL[s]}</option>)}
              </select>
            </label>
          </>
        )}
        <label>
          <span style={lbl}>Acompte négocié (closing)</span>
          <select value={acompte} onChange={(e) => setAcompte(e.target.value)} style={field}>
            <option value="">—</option>
            {ACOMPTE_STEPS.map((a) => <option key={a} value={a}>{a} %</option>)}
          </select>
        </label>
      </div>

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={lbl}>Contexte de l&apos;intervention</span>
        <textarea
          value={contexte}
          onChange={(e) => setContexte(e.target.value)}
          placeholder={isDemenagement ? "Mutation, achat, vente, fin de bail, succession, transfert entreprise…" : "Succession, décès, Diogène, fin de bail, vente, expulsion, EHPAD, liquidation…"}
          style={{ ...field, minHeight: 70, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
        />
      </label>

      {/* ── Date et créneau SOUHAITÉS par le client ──────────────────────
          Souhait, pas confirmation : la planification garde la main sur la
          date réelle. Le libellé le dit explicitement pour qu'aucun
          commercial ne promette un créneau au téléphone. */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, marginBottom: 12 }}>
        <div className={styles.muted} style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
          Souhait du client — à confirmer par la planification
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <label>
            <span style={lbl}>Date souhaitée</span>
            <input type="date" value={wantedDate} onChange={(e) => setWantedDate(e.target.value)} style={field} />
          </label>
          <label>
            <span style={lbl}>Créneau souhaité</span>
            <select value={wantedSlot} onChange={(e) => setWantedSlot(e.target.value)} style={field}>
              <option value="">—</option>
              {WANTED_SLOTS.map((v) => (
                <option key={v} value={v}>{WANTED_SLOT_LABEL[v as WantedSlot]}</option>
              ))}
            </select>
          </label>
          {(wantedSlot === "heure_precise" || wantedSlot === "personnalise") && (
            <label>
              <span style={lbl}>{wantedSlot === "personnalise" ? "De" : "À"}</span>
              <input type="time" value={wantedStart} onChange={(e) => setWantedStart(e.target.value)} style={field} />
            </label>
          )}
          {wantedSlot === "personnalise" && (
            <label>
              <span style={lbl}>À</span>
              <input type="time" value={wantedEnd} onChange={(e) => setWantedEnd(e.target.value)} style={field} />
            </label>
          )}
        </div>
      </div>

      {/* ── Fourchette tarifaire recommandée ──────────────────────────── */}
      <div className={styles.pricingBox} data-state={pricing.result.ok ? "ok" : "ko"}>
        <div className={styles.pricingTitle}>Fourchette tarifaire recommandée à annoncer au client</div>
        {pricing.result.ok ? (
          <>
            <div className={styles.pricingRange}>
              <span>{pricing.result.min.toLocaleString("fr-FR")} €</span>
              <span className={styles.pricingDash}>—</span>
              <span>{pricing.result.max.toLocaleString("fr-FR")} €</span>
            </div>
            <ul className={styles.pricingLines}>
              {pricing.result.lines.map((l, i) => (
                <li key={i}><span>{l.label}</span><span>{Math.round(l.amount).toLocaleString("fr-FR")} €</span></li>
              ))}
            </ul>
            {(pricing.approx || pricing.result.assumptions.length > 0) && (
              <p className={styles.pricingNote}>
                {[...(pricing.approx ? ["volume donné en tranche — milieu retenu"] : []), ...pricing.result.assumptions].join(" · ")}
              </p>
            )}
            <p className={styles.pricingNote}>Indicatif — ne vaut pas devis.</p>
          </>
        ) : pricing.result.reason === "not_configured" ? (
          <p className={styles.pricingNote}>
            Aucun barème configuré pour {sectorLabel.toLowerCase()}. Un Super Admin doit
            renseigner les paramètres tarifaires de cette activité (Paramètres › Tarifs).
          </p>
        ) : (
          <p className={styles.pricingNote}>
            Calcul impossible — il manque&nbsp;: {pricing.result.missing.join(", ")}.
          </p>
        )}
      </div>

      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy !== null} onClick={onSave} style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}>
        {busy === "save" ? "Enregistrement…" : "Enregistrer la découverte"}
      </button>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, marginBottom: 12 }}>
        <div className={styles.muted} style={{ fontSize: "0.8125rem", marginBottom: 6 }}>Issue de la découverte</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy !== null} onClick={() => onOutcome("ok")}>
            {busy === "outcome-ok" ? "…" : "OK"}
          </button>
          <button type="button" className={styles.btn} disabled={busy !== null} onClick={() => onOutcome("ok_plus")}>
            {busy === "outcome-ok_plus" ? "…" : "OK voir +"}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy !== null} onClick={() => onOutcome("refus")}>
            {busy === "outcome-refus" ? "…" : "Refus"}
          </button>
        </div>
      </div>

      {error && <p className={styles.errorMessage}>{error}</p>}
    </section>
  );
}
