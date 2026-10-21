"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  autosaveDiscovery, recordDiscovery, saveDiscovery, setLeadActivity, switchToDiogene,
} from "@/app/(app)/pipeline/actions";
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
import NettoyageFields from "./NettoyageFields";
import { estFamilleNettoyage } from "@/lib/discovery-nettoyage";
import DemenagementFields from "./DemenagementFields";
import ArgumentaireModal from "./ArgumentaireModal";
import { computeGrid } from "@/lib/pricing/grid-compute";
import { buildGridInput } from "@/lib/pricing/grid-discovery";
import { buildPitch, montantLabel } from "@/lib/pricing/argumentaire";
import type { PricingGrid } from "@/lib/pricing/grid-types";
import styles from "./LeadDetail.module.scss";

// Fiche Découverte guidée qui S'ADAPTE au secteur : champs communs (surface,
// délai, fourchette, prix, réaction, contexte, acompte) + un bloc métier propre
// à l'activité (nettoyage → statut/saleté ; débarras / déménagement → champs
// techniques dédiés, stockés en JSONB). Jamais mélangés.

type Props = {
  lead: Lead;
  // Grille tarifaire de l'activité. null, ou en brouillon, = aucune
  // fourchette proposée. Le Super Admin seul décide de la publier.
  pricingGrid: PricingGrid | null;
};

// Heure d'enregistrement, fuseau FIXÉ : le serveur rend en UTC, le commercial
// est à Paris. Sans ce paramètre, l'heure affichée saute à l'hydratation.
const HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});
const heureParis = (iso: string) => HEURE_PARIS.format(new Date(iso));

const field: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem",
};
const lbl: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 };

export default function DiscoveryCard({ lead, pricingGrid }: Props) {
  const router = useRouter();
  const leadId = lead.id;

  const isDebarras = lead.sector === "debarras";
  const isDemenagement = lead.sector === "demenagement";
  const isNettoyage = !isDebarras && !isDemenagement;
  // Questionnaire nettoyage détaillé : nettoyage, nettoyage difficile, urgence
  // et Diogène. ENR et Rénovation gardent la découverte générique — poser des
  // panneaux n'a rien à voir avec nettoyer un logement.
  const isFamilleNet = estFamilleNettoyage(lead.sector);
  const dejaDiogene = lead.sector === "diogene";

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
  const [arguOpen, setArguOpen] = useState(false);
  const [, startTransition] = useTransition();

  const run = (
    key: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    apresSucces?: () => void,
  ) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      // Rien ne passe au vert si la sauvegarde a échoué : le message d'erreur
      // s'affiche et la saisie reste intacte.
      if (!r.ok) { setError(r.error); return; }
      apresSucces?.();
      router.refresh();
    });
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
    const { input, approx, nonCaptes } = buildGridInput({
      sector: lead.sector,
      surfaceM2: surface.trim() ? Number(surface) : null,
      details,
      delaiSouhaite: delai || null,
      isUrgent: Boolean(lead.isUrgent),
      etatSalete: salete || null,
    });
    return { result: computeGrid(pricingGrid, input), input, approx, nonCaptes };
  }, [pricingGrid, lead.sector, lead.isUrgent, surface, details, delai, salete]);

  // Argumentaire de closing. Dérivé des MÊMES données que le prix : il se
  // réécrit tout seul dès qu'une option de la découverte change, sans que le
  // commercial ait à rouvrir quoi que ce soit.
  const pitch = useMemo(() => {
    const r = pricing.result;
    if (!r.ok) return null;
    return buildPitch({
      sector: lead.sector,
      conseille: r.conseille,
      min: r.min,
      max: r.max,
      vatRate: r.vatRate,
      lines: r.lines,
      majorations: r.majorations,
      input: pricing.input,
      details,
      etatSalete: salete || null,
      delaiSouhaite: delai || null,
      reactionPrix: reaction || null,
      wantedDate: wantedDate || null,
      isUrgent: Boolean(lead.isUrgent),
      reserves: [
        ...(pricing.approx ? ["volume donné en tranche"] : []),
        ...r.assumptions,
        ...(pricing.nonCaptes.length ? [`non pris en compte : ${pricing.nonCaptes.join(", ")}`] : []),
      ],
    });
  }, [pricing, lead.sector, lead.isUrgent, details, salete, delai, reaction, wantedDate]);

  // Une seule construction de la charge utile : l'enregistrement manuel et
  // l'enregistrement automatique écrivent exactement la même chose.
  const buildPayload = () => ({
    surfaceM2: surface.trim() ? Number(surface) : null,
    announcedPrice: price.trim() ? Number(price) : null,
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
    // Le questionnaire nettoyage vit lui aussi dans `details` : il ne faut
    // surtout plus l'effacer comme le faisait l'ancienne découverte.
    details,
    // Recommandation du moteur au moment de l'enregistrement (A-07).
    // Seul saveDiscovery la fige ; l'enregistrement automatique l'ignore.
    priceRecommended: pricing.result.ok ? pricing.result.conseille : null,
    priceRecommendedMin: pricing.result.ok ? pricing.result.min : null,
    priceRecommendedMax: pricing.result.ok ? pricing.result.max : null,
    pricingGridVersion: pricingGrid?.version ?? null,
  });

  const onSave = () => {
    const payload = buildPayload();
    if (payload.surfaceM2 != null && Number.isNaN(payload.surfaceM2)) { setError("Surface invalide."); return; }
    if (payload.announcedPrice != null && Number.isNaN(payload.announcedPrice)) { setError("Prix annoncé invalide."); return; }

    // Bascule Diogène : le commercial perd le dossier au profit de l'équipe
    // habilitée. C'est irréversible d'un clic, donc on demande confirmation.
    const basculer = isFamilleNet && !dejaDiogene && details.diogene === true;
    if (basculer) {
      const ok = window.confirm(
        "Classer ce dossier en activité Diogène ?\n\n"
        + "Il sera confié à un commercial habilité Diogène. Les coordonnées, les photos, "
        + "l'historique et le numéro de dossier sont conservés.",
      );
      if (!ok) return;
    }

    const instantane = payloadJson;
    run(
      "save",
      async () => {
        const r = await saveDiscovery(leadId, payload);
        if (!r.ok || !basculer) return r;
        // La découverte est enregistrée AVANT la bascule : si la réaffectation
        // échoue, la saisie du commercial est déjà en sécurité.
        return switchToDiogene(leadId);
      },
      () => {
        setEnregistreA(new Date().toISOString());
        setPayloadEnregistre(instantane);
      },
    );
  };

  // ── Enregistrement automatique ──────────────────────────────────────
  // Deux secondes et demie après la dernière frappe. On compare la charge
  // utile sérialisée : sans cela, un simple re-rendu déclencherait une
  // écriture. `discovery_done_at` n'est pas touché (cf. autosaveDiscovery) —
  // c'est le bouton « Enregistrer » qui déclare la découverte terminée.
  const [autoEtat, setAutoEtat] = useState<"" | "encours" | "ok">("");
  const dernierEnvoi = useRef<string | null>(null);
  const payloadJson = JSON.stringify(buildPayload());

  // ── Bouton « Enregistrer la découverte » ────────────────────────────
  // Vert dès qu'une sauvegarde a réussi, et il le reste : la valeur initiale
  // vient de la base (`discoveryDoneAt`), donc l'état survit à la fermeture de
  // la fiche, à l'actualisation et à la reconnexion.
  //
  // Dès qu'un champ change, la charge utile diffère de celle enregistrée et le
  // bouton redevient neutre — le commercial voit qu'il lui reste quelque chose
  // à faire.
  const [enregistreA, setEnregistreA] = useState<string | null>(lead.discoveryDoneAt ?? null);
  const [payloadEnregistre, setPayloadEnregistre] = useState<string>(payloadJson);
  const modifieDepuis = payloadEnregistre !== payloadJson;
  const estEnregistre = enregistreA !== null && !modifieDepuis;

  useEffect(() => {
    if (dernierEnvoi.current === null) { dernierEnvoi.current = payloadJson; return; }
    if (dernierEnvoi.current === payloadJson) return;
    const t = setTimeout(async () => {
      dernierEnvoi.current = payloadJson;
      setAutoEtat("encours");
      const r = await autosaveDiscovery(leadId, JSON.parse(payloadJson));
      setAutoEtat(r.ok ? "ok" : "");
      if (!r.ok) setError(r.error);
    }, 2500);
    return () => clearTimeout(t);
  }, [payloadJson, leadId]);

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
        {/* Trace de l'enregistrement automatique : le commercial doit voir que
            sa saisie est en sécurité sans avoir à cliquer. */}
        {autoEtat && (
          <span className={styles.muted} style={{ fontSize: "0.75rem" }}>
            {autoEtat === "encours" ? "Enregistrement…" : "Brouillon enregistré"}
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
      {isDemenagement && (
        <DemenagementFields details={details} set={setDetail} pays={lead.country ?? null} />
      )}
      {isFamilleNet && (
        <NettoyageFields
          leadId={leadId}
          details={details}
          set={setDetail}
          surface={surface}
          setSurface={setSurface}
          etat={salete}
          setEtat={setSalete}
          wantedDate={wantedDate}
          setWantedDate={setWantedDate}
          wantedSlot={wantedSlot}
          setWantedSlot={setWantedSlot}
          wantedStart={wantedStart}
          setWantedStart={setWantedStart}
          dejaDiogene={dejaDiogene}
        />
      )}

      {/* ── Champs communs à toutes les activités ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
        {!isDemenagement && !isFamilleNet && (
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
            {/* L'état général est demandé dans le bloc « Le logement » du
                questionnaire nettoyage : on ne le redemande pas ici. */}
            {!isFamilleNet && (
              <label>
                <span style={lbl}>État de saleté</span>
                <select value={salete} onChange={(e) => setSalete(e.target.value)} style={field}>
                  <option value="">—</option>
                  {ETATS_SALETE.map((s) => <option key={s} value={s}>{ETAT_SALETE_LABEL[s]}</option>)}
                </select>
              </label>
            )}
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

      {/* ── Prix estimatif recommandé ─────────────────────────
          Un prix, une fourchette, un bouton. Le détail du calcul n'a pas sa
          place ici : le commercial annonce un montant, il n'audite pas une
          grille. Tout le reste est dans l'argumentaire. */}
      <div className={styles.pricingBox} data-state={pricing.result.ok ? "ok" : "ko"}>
        <div className={styles.pricingTitle}>Prix estimatif recommandé</div>
        {pricing.result.ok ? (
          <>
            <div className={styles.pricingPrice}>
              {montantLabel(pricing.result.conseille, pricing.result.vatRate)}
            </div>
            <div className={styles.pricingTitle}>Fourchette recommandée à annoncer</div>
            <div className={styles.pricingRange}>
              {pricing.result.min.toLocaleString("fr-FR")} – {montantLabel(pricing.result.max, pricing.result.vatRate)}
            </div>
            {/* A-07 — le barème a changé depuis le calcul enregistré. On le
                DIT, au lieu de laisser un montant bouger en silence. */}
            {lead.priceRecommended != null
              && lead.priceRecommended !== pricing.result.conseille && (
              <p className={styles.pricingNote}>
                À l&apos;enregistrement de la découverte, le tarif recommandé était de{" "}
                <strong>{lead.priceRecommended.toLocaleString("fr-FR")} €</strong>. Le barème a
                changé depuis : vérifiez ce qui a été annoncé au client avant d&apos;utiliser
                le nouveau montant.
              </p>
            )}
            <button type="button" className={styles.pricingCta} onClick={() => setArguOpen(true)}>
              💬 Argumentaire commercial
            </button>
          </>
        ) : (
          <p className={styles.pricingNote}>
            {pricing.result.reason === "brouillon" &&
              `La grille ${sectorLabel.toLowerCase()} n'est pas publiée. Le Super Admin doit la valider dans « Grilles tarifaires ».`}
            {pricing.result.reason === "vide" &&
              `Aucun barème ne s'applique à ce dossier pour ${sectorLabel.toLowerCase()}.`}
            {pricing.result.reason === "diffusion" &&
              `Le barème ${sectorLabel.toLowerCase()} existe et il est publié, mais il n'est pas `
              + "ouvert à votre rôle. Le Super Admin doit activer « Fourchette visible par les commerciaux »."}
            {pricing.result.reason === "manquant" &&
              `Calcul impossible — il manque : ${pricing.result.missing.join(", ")}.`}
            {pricing.result.reason === "validation" &&
              `Validation tarifaire du super administrateur nécessaire : ${pricing.result.missing.join(", ")}.`}
          </p>
        )}
      </div>

      {arguOpen && pitch && pricing.result.ok && (
        <ArgumentaireModal
          pitch={pitch}
          conseille={pricing.result.conseille}
          min={pricing.result.min}
          max={pricing.result.max}
          vatRate={pricing.result.vatRate}
          onClose={() => setArguOpen(false)}
        />
      )}

      {/* Le MÊME bouton change d'apparence : aucun libellé ni bouton ajouté. */}
      <button
        type="button"
        className={`${styles.btn} ${estEnregistre ? styles.btnSaved : styles.btnPrimary}`}
        disabled={busy !== null}
        onClick={onSave}
        style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
        aria-live="polite"
      >
        {busy === "save"
          ? "Enregistrement…"
          : estEnregistre
            ? `✓ Enregistré à ${heureParis(enregistreA!)}`
            : "Enregistrer la découverte"}
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
