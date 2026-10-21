"use client";

// Découverte TRANSPORT.
//
// Le transport déplace des OBJETS désignés, là où le déménagement vide un
// logement entier. La découverte suit donc l'ordre de l'appel : ce qu'on
// transporte, d'où, vers où, à quelles conditions.

import { ACCES, OPTIONS_TRANSPORT, OUI_NON, TYPE_OBJET } from "@/lib/discovery-metier";
import type { Country } from "@/lib/leads";
import {
  Adresse, Chips, Num, Sel, field, grille, lbl, str, type SetDetail,
} from "./discovery-ui";
import { useDistance } from "./use-distance";

type Props = {
  details: Record<string, unknown>;
  set: SetDetail;
  /** Pays du dossier — sert à valider le format du code postal. */
  pays?: Country | null;
};

const CLES_ENLEVEMENT = { rue: "adresseEnlevement", cp: "cpEnlevement", ville: "villeEnlevement" };
const CLES_LIVRAISON = { rue: "adresseLivraison", cp: "cpLivraison", ville: "villeLivraison" };

export default function TransportFields({ details, set, pays = null }: Props) {
  const { busy, erreur, calculer } = useDistance(details, set, CLES_ENLEVEMENT, CLES_LIVRAISON, pays);
  const surSortie = () => { void calculer(true); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
      {/* ── A. Objets à transporter ───────────────────────────────── */}
      <div style={grille}>
        <Sel label="Type d'objet" k="typeObjet" options={TYPE_OBJET} details={details} set={set} />
        <Num label="Quantité" k="quantiteObjets" details={details} set={set} placeholder="Nombre d'objets" />
        <Num label="Poids estimé (kg)" k="poidsKg" details={details} set={set} placeholder="Total" />
        <Num label="Volume estimé (m³)" k="volumeM3" details={details} set={set} step="0.1" placeholder="Si connu" />
      </div>

      <label>
        <span style={lbl}>Description des objets</span>
        <textarea
          value={str(details, "descriptionObjets")}
          onChange={(e) => set("descriptionObjets", e.target.value)}
          rows={2}
          placeholder="Nature, dimensions, état, contraintes particulières…"
          style={{ ...field, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      {/* ── B. Adresse d'enlèvement ───────────────────────────────── */}
      <Adresse
        titre="Adresse d'enlèvement"
        cles={CLES_ENLEVEMENT}
        details={details}
        set={set}
        pays={pays}
        onSortie={surSortie}
      >
        <div style={grille}>
          <Num label="Étage" k="etageEnlevement" details={details} set={set} />
          <Sel label="Ascenseur" k="ascenseurEnlevement" options={OUI_NON} details={details} set={set} />
          <Sel label="Accessibilité" k="accesEnlevement" options={ACCES} details={details} set={set} />
        </div>
      </Adresse>

      {/* ── C. Adresse de livraison ───────────────────────────────── */}
      <Adresse
        titre="Adresse de livraison"
        cles={CLES_LIVRAISON}
        details={details}
        set={set}
        pays={pays}
        onSortie={surSortie}
      >
        <div style={grille}>
          <Num label="Étage" k="etageLivraison" details={details} set={set} />
          <Sel label="Ascenseur" k="ascenseurLivraison" options={OUI_NON} details={details} set={set} />
          <Sel label="Accessibilité" k="accesLivraison" options={ACCES} details={details} set={set} />
        </div>
      </Adresse>

      {/* ── F. Distance ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label style={{ flex: 1 }}>
          <span style={lbl}>Distance (km)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={str(details, "distanceKm")}
            onChange={(e) => set("distanceKm", e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="—"
            style={field}
          />
        </label>
        <button
          type="button"
          onClick={() => { void calculer(false); }}
          disabled={busy}
          style={{
            flexShrink: 0, padding: "8px 12px", minHeight: 38,
            borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)",
            background: "transparent", color: "var(--text-primary)",
            cursor: "pointer", fontSize: "0.8125rem",
          }}
          title="La distance se calcule seule dès que les deux adresses sont saisies — ce bouton force un nouveau calcul."
        >
          {busy ? "Calcul…" : "Recalculer"}
        </button>
      </div>
      {erreur && <p style={{ color: "var(--tone-danger)", fontSize: "0.8125rem", margin: 0 }}>{erreur}</p>}

      {/* ── D. Options ────────────────────────────────────────────── */}
      <Chips
        label="Options et contraintes"
        k="optionsTransport"
        options={OPTIONS_TRANSPORT}
        details={details}
        set={set}
      />

      <div style={grille}>
        <label>
          <span style={lbl}>Date souhaitée</span>
          <input
            type="date"
            value={str(details, "dateSouhaitee")}
            onChange={(e) => set("dateSouhaitee", e.target.value)}
            style={field}
          />
        </label>
        {/* ── E. Photos ───────────────────────────────────────────── */}
        <Sel label="Photos demandées" k="photosDemandees" options={OUI_NON} details={details} set={set} />
        <Sel label="Photos réceptionnées" k="photosRecues" options={OUI_NON} details={details} set={set} />
      </div>
    </div>
  );
}
