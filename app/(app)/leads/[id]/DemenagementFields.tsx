"use client";

import {
  EMBALLAGE, LOGEMENT_TYPE, OBJETS_SPECIFIQUES, OUI_NON, VOLUME_DEMENAGEMENT,
} from "@/lib/discovery-metier";
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

const CLES_DEPART = { rue: "adresseDepart", cp: "cpDepart", ville: "villeDepart" };
const CLES_ARRIVEE = { rue: "adresseArrivee", cp: "cpArrivee", ville: "villeArrivee" };

export default function DemenagementFields({ details, set, pays = null }: Props) {
  const { busy, erreur, calculer } = useDistance(details, set, CLES_DEPART, CLES_ARRIVEE);
  const surSortie = () => { void calculer(true); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
      <div style={grille}>
        <Sel label="Logement de départ" k="logementDepart" options={LOGEMENT_TYPE} details={details} set={set} />
        <Sel label="Logement d'arrivée" k="logementArrivee" options={LOGEMENT_TYPE} details={details} set={set} />
      </div>

      <Adresse
        titre="Adresse de départ"
        cles={CLES_DEPART}
        details={details}
        set={set}
        pays={pays}
        onSortie={surSortie}
      />
      <Adresse
        titre="Adresse d'arrivée"
        cles={CLES_ARRIVEE}
        details={details}
        set={set}
        pays={pays}
        onSortie={surSortie}
      />

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

      <div style={grille}>
        <Sel label="Volume estimé" k="volume" options={VOLUME_DEMENAGEMENT} details={details} set={set} />
        <Num label="Nombre d'étages départ" k="etagesDepart" details={details} set={set} />
        <Num label="Nombre d'étages arrivée" k="etagesArrivee" details={details} set={set} />
        <Sel label="Ascenseur départ" k="ascenseurDepart" options={OUI_NON} details={details} set={set} />
        <Sel label="Ascenseur arrivée" k="ascenseurArrivee" options={OUI_NON} details={details} set={set} />
        <Sel label="Monte-meubles nécessaire" k="monteMeubles" options={OUI_NON} details={details} set={set} />
        <Sel label="Emballage" k="emballage" options={EMBALLAGE} details={details} set={set} />
        <Sel label="Démontage / remontage" k="demontage" options={OUI_NON} details={details} set={set} />
      </div>

      <Chips
        label="Objets spécifiques"
        k="objetsSpecifiques"
        options={OBJETS_SPECIFIQUES}
        details={details}
        set={set}
      />
    </div>
  );
}
