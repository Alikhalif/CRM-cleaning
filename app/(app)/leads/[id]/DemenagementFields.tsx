"use client";

import { useRef, useState } from "react";
import {
  EMBALLAGE, LOGEMENT_TYPE, OBJETS_SPECIFIQUES, OUI_NON, VOLUME_DEMENAGEMENT, type Option,
} from "@/lib/discovery-metier";
import { composerAdresse, validerCodePostal } from "@/lib/adresses";
import type { Country } from "@/lib/leads";

type Props = {
  details: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  /** Pays du dossier — sert à valider le format du code postal. */
  pays?: Country | null;
};

const field: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "0.9375rem",
};
const lbl: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 };

const str = (d: Record<string, unknown>, k: string): string => (typeof d[k] === "string" ? (d[k] as string) : d[k] != null ? String(d[k]) : "");
const arr = (d: Record<string, unknown>, k: string): string[] => (Array.isArray(d[k]) ? (d[k] as string[]) : []);

function Sel({ label, k, options, details, set }: { label: string; k: string; options: Option[]; details: Record<string, unknown>; set: Props["set"] }) {
  return (
    <label>
      <span style={lbl}>{label}</span>
      <select value={str(details, k)} onChange={(e) => set(k, e.target.value)} style={field}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Num({ label, k, details, set }: { label: string; k: string; details: Record<string, unknown>; set: Props["set"] }) {
  return (
    <label>
      <span style={lbl}>{label}</span>
      <input type="number" min={0} value={str(details, k)} onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))} placeholder="—" style={field} />
    </label>
  );
}

/**
 * Un bloc d'adresse : rue, code postal, ville.
 *
 * La rue garde la clé historique (`adresseDepart` / `adresseArrivee`), si bien
 * que les vingt-cinq dossiers déjà saisis conservent leur contenu et restent
 * lisibles — le commercial peut le répartir dans les nouveaux champs quand il
 * repasse dessus, sans rien perdre entre-temps.
 */
function Adresse({
  titre, cles, details, set, pays, onSortie,
}: {
  titre: string;
  cles: { rue: string; cp: string; ville: string };
  details: Record<string, unknown>;
  set: Props["set"];
  pays: Country | null;
  onSortie: () => void;
}) {
  const cp = str(details, cles.cp);
  const verdict = validerCodePostal(cp, pays);

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <legend style={{ ...lbl, padding: 0 }}>{titre}</legend>
      <input
        value={str(details, cles.rue)}
        onChange={(e) => set(cles.rue, e.target.value)}
        onBlur={onSortie}
        placeholder="N° et nom de rue"
        aria-label={`${titre} — rue`}
        style={field}
      />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 2fr", gap: 8 }}>
        <div>
          <input
            value={cp}
            onChange={(e) => set(cles.cp, e.target.value)}
            onBlur={onSortie}
            placeholder="Code postal"
            inputMode="numeric"
            aria-label={`${titre} — code postal`}
            aria-invalid={verdict && !verdict.ok ? true : undefined}
            style={{
              ...field,
              borderColor: verdict && !verdict.ok ? "var(--tone-warning)" : "var(--border-strong)",
            }}
          />
          {/* Avertissement, jamais blocage : un format inattendu peut être un
              pays mal deviné, pas une faute du commercial. */}
          {verdict && !verdict.ok && (
            <span style={{ fontSize: "0.6875rem", color: "var(--tone-warning)" }}>
              Format attendu : {verdict.attendu}
            </span>
          )}
        </div>
        <input
          value={str(details, cles.ville)}
          onChange={(e) => set(cles.ville, e.target.value)}
          onBlur={onSortie}
          placeholder="Ville"
          aria-label={`${titre} — ville`}
          style={field}
        />
      </div>
    </fieldset>
  );
}

export default function DemenagementFields({ details, set, pays = null }: Props) {
  const [distBusy, setDistBusy] = useState(false);
  const [distErr, setDistErr] = useState<string | null>(null);
  // Dernier couple d'adresses effectivement calculé (voir calcDistance).
  const dernierCouple = useRef<string>("");
  // Verrou d'appel. Cliquer sur « Calculer » fait d'abord perdre le focus au
  // champ adresse : sans ce verrou, le blur et le clic lanceraient DEUX requêtes
  // simultanées vers Nominatim. Un ref, pas un state : il doit être à jour dans
  // le même tick, avant tout re-rendu.
  const enCours = useRef(false);

  const objets = arr(details, "objetsSpecifiques");
  const toggleObjet = (v: string) =>
    set("objetsSpecifiques", objets.includes(v) ? objets.filter((x) => x !== v) : [...objets, v]);

  // Calcul de la distance. `auto` = déclenché en sortant d'un champ adresse,
  // sans clic : le commercial oubliait le bouton et la distance manquait au
  // devis. Deux garde-fous, parce que Nominatim/OSRM sont des services publics
  // gratuits plafonnés (~1 req/s) :
  //   • on ne part QUE sur sortie de champ, jamais à chaque frappe ;
  //   • on mémorise le dernier couple d'adresses calculé, donc traverser les
  //     champs sans rien modifier ne redéclenche rien.
  // En mode auto on reste silencieux si les adresses sont incomplètes — c'est
  // l'état normal pendant la saisie, pas une erreur à afficher. Le bouton
  // « Calculer » reste la reprise manuelle (adresse corrigée, service tombé).
  const calcDistance = async (auto = false) => {
    // On recompose « rue, CP ville ». Les anciens dossiers n'ont que la rue —
    // qui contenait souvent la ville entière : composerAdresse les laisse
    // passer tels quels, donc leur distance continue de se calculer.
    const from = composerAdresse({
      rue: str(details, "adresseDepart"),
      cp: str(details, "cpDepart"),
      ville: str(details, "villeDepart"),
    }).trim();
    const to = composerAdresse({
      rue: str(details, "adresseArrivee"),
      cp: str(details, "cpArrivee"),
      ville: str(details, "villeArrivee"),
    }).trim();
    if (!from || !to) {
      if (!auto) setDistErr("Renseignez les deux adresses.");
      return;
    }
    const couple = `${from} » ${to}`;
    if (auto && couple === dernierCouple.current) return;
    if (enCours.current) return;
    enCours.current = true;
    dernierCouple.current = couple;
    setDistErr(null); setDistBusy(true);
    try {
      const r = await fetch(`/api/geo/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const d = (await r.json()) as { km?: number; error?: string };
      if (!r.ok || d.km == null) { setDistErr(d.error ?? "Calcul impossible."); return; }
      set("distanceKm", d.km);
    } catch {
      setDistErr("Service de distance indisponible — saisissez la distance à la main.");
    } finally {
      enCours.current = false;
      setDistBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Sel label="Logement de départ" k="logementDepart" options={LOGEMENT_TYPE} details={details} set={set} />
        <Sel label="Logement d'arrivée" k="logementArrivee" options={LOGEMENT_TYPE} details={details} set={set} />
      </div>

      <Adresse
        titre="Adresse de départ"
        cles={{ rue: "adresseDepart", cp: "cpDepart", ville: "villeDepart" }}
        details={details}
        set={set}
        pays={pays}
        onSortie={() => { void calcDistance(true); }}
      />
      <Adresse
        titre="Adresse d'arrivée"
        cles={{ rue: "adresseArrivee", cp: "cpArrivee", ville: "villeArrivee" }}
        details={details}
        set={set}
        pays={pays}
        onSortie={() => { void calcDistance(true); }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label style={{ flex: 1 }}>
          <span style={lbl}>Distance (km)</span>
          <input type="number" min={0} step="0.1" value={str(details, "distanceKm")} onChange={(e) => set("distanceKm", e.target.value === "" ? "" : Number(e.target.value))} placeholder="—" style={field} />
        </label>
        <button type="button" onClick={() => { void calcDistance(false); }} disabled={distBusy} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.8125rem" }} title="La distance se calcule seule dès que les deux adresses sont saisies — ce bouton force un nouveau calcul.">
          {distBusy ? "Calcul…" : "Recalculer"}
        </button>
      </div>
      {distErr && <p style={{ color: "var(--tone-danger)", fontSize: "0.8125rem", margin: 0 }}>{distErr}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Sel label="Volume estimé" k="volume" options={VOLUME_DEMENAGEMENT} details={details} set={set} />
        <Num label="Nombre d'étages départ" k="etagesDepart" details={details} set={set} />
        <Num label="Nombre d'étages arrivée" k="etagesArrivee" details={details} set={set} />
        <Sel label="Ascenseur départ" k="ascenseurDepart" options={OUI_NON} details={details} set={set} />
        <Sel label="Ascenseur arrivée" k="ascenseurArrivee" options={OUI_NON} details={details} set={set} />
        <Sel label="Monte-meubles nécessaire" k="monteMeubles" options={OUI_NON} details={details} set={set} />
        <Sel label="Emballage" k="emballage" options={EMBALLAGE} details={details} set={set} />
        <Sel label="Démontage / remontage" k="demontage" options={OUI_NON} details={details} set={set} />
      </div>

      <div>
        <span style={lbl}>Objets spécifiques</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {OBJETS_SPECIFIQUES.map((o) => {
            const active = objets.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggleObjet(o.value)} style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", cursor: "pointer", border: active ? "1px solid var(--color-brand-500)" : "1px solid var(--border-strong)", background: active ? "var(--color-brand-500)" : "transparent", color: active ? "#fff" : "var(--text-muted)" }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
