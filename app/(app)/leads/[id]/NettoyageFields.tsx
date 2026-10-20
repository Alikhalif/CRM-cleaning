"use client";

import Link from "next/link";
import {
  COMPLEMENTS, DEBARRAS_VOLUME, DECONTAMINATION_ORIGINE, DESODORISATION_ORIGINE,
  DIO_ACCESSIBILITE, DIO_DECHETS, DIO_ENCOMBREMENT, DIO_NUISIBLES, DIO_ODEURS,
  DIO_PRESTATIONS, DIO_VOLUME,
  ETAGE, ETAT_GENERAL, EXTERIEUR_ETAT, EXTERIEUR_REVETEMENT, EXTERIEUR_TYPE,
  EQUIPEMENTS, MURS, NOMBRE_0_3, OCCUPATION, PHOTOS_ETAT, TRAITEMENTS_SOL,
  PLAFONDS_ETAT, PLAFONDS_TYPE, SOLS, STATIONNEMENT, SURFACE_CONCERNEE,
  TYPE_BIEN_NETTOYAGE, TYPE_NETTOYAGE, URGENCE, VITRERIE_ACCES, VITRERIE_QUANTITE,
} from "@/lib/discovery-nettoyage";
import { OUI_NON, type Option } from "@/lib/discovery-metier";
import { WANTED_SLOT_LABEL, type WantedSlot } from "@/lib/leads";
import styles from "./NettoyageFields.module.scss";

// Découverte commerciale NETTOYAGE.
//
// Pensée pour être remplie PENDANT l'appel, en deux à trois minutes : on coche,
// on ne rédige pas. Les questions secondaires n'apparaissent que si la réponse
// précédente les rend utiles — un logement sans terrasse n'affiche aucun champ
// d'extérieur.
//
// L'ordre des blocs est celui d'une conversation téléphonique, pas celui de la
// base de données.

type Setter = (k: string, v: unknown) => void;
type Details = Record<string, unknown>;

const txt = (d: Details, k: string): string =>
  typeof d[k] === "string" ? (d[k] as string) : d[k] != null ? String(d[k]) : "";
const lst = (d: Details, k: string): string[] =>
  Array.isArray(d[k]) ? (d[k] as unknown[]).map(String) : [];

// ── Briques d'interface ────────────────────────────────────────────────
// Déclarées au niveau du module, jamais dans le rendu : un composant recréé à
// chaque rendu perdrait son état et refuserait le focus.

/** Choix unique libre — pour les valeurs qui ne vivent pas dans `details`. */
function ChoixLibre({ options, value, onPick, label }: {
  options: Option[]; value: string; onPick: (v: string) => void; label?: string;
}) {
  return (
    <div className={styles.champ}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.chips}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            // Recliquer sur le choix actif l'annule : une erreur de clic ne
            // doit pas obliger à recharger la page.
            onClick={() => onPick(value === o.value ? "" : o.value)}
            className={`${styles.chip} ${value === o.value ? styles.chipOn : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Choix unique stocké dans `details`. */
function Choix({ d, set, k, options, label }: {
  d: Details; set: Setter; k: string; options: Option[]; label?: string;
}) {
  return <ChoixLibre options={options} value={txt(d, k)} onPick={(v) => set(k, v)} label={label} />;
}

/** Choix multiple stocké dans `details`. */
function Multi({ d, set, k, options, label }: {
  d: Details; set: Setter; k: string; options: Option[]; label?: string;
}) {
  const sel = lst(d, k);
  return (
    <div className={styles.champ}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.chips}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => set(k, sel.includes(o.value) ? sel.filter((x) => x !== o.value) : [...sel, o.value])}
            className={`${styles.chip} ${sel.includes(o.value) ? styles.chipOn : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Nombre({ d, set, k, label }: { d: Details; set: Setter; k: string; label: string }) {
  return (
    <label className={styles.champ}>
      <span className={styles.label}>{label}</span>
      <input
        type="number" min={0} inputMode="decimal" className={styles.input}
        value={txt(d, k)} placeholder="—"
        onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))}
      />
    </label>
  );
}

type Props = {
  leadId: string;
  details: Details;
  set: Setter;
  // Champs portés par des colonnes du lead, pas par le JSONB. Ils sont affichés
  // ici pour respecter l'ordre de l'entretien, mais restent stockés là où ils
  // l'ont toujours été.
  surface: string;
  setSurface: (v: string) => void;
  etat: string;
  setEtat: (v: string) => void;
  wantedDate: string;
  setWantedDate: (v: string) => void;
  wantedSlot: string;
  setWantedSlot: (v: string) => void;
  wantedStart: string;
  setWantedStart: (v: string) => void;
  /** Vrai quand le lead est DÉJÀ classé Diogène : l'extension n'est plus une
   *  option, c'est l'activité du dossier. */
  dejaDiogene: boolean;
};

const CRENEAUX: WantedSlot[] = ["matin", "apres_midi", "heure_precise"];

export default function NettoyageFields(p: Props) {
  const { details: d, set, leadId } = p;
  const oui = (k: string) => txt(d, k) === "oui";
  const diogene = p.dejaDiogene || d.diogene === true;
  const comps = lst(d, "complements");

  return (
    <div className={styles.wrap}>
      {/* ── 1. Type de nettoyage ──────────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>1 · Type de nettoyage</h3>
        <Choix d={d} set={set} k="typeNettoyage" options={TYPE_NETTOYAGE} />
      </section>

      {/* ── 2. Le logement ────────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>2 · Le logement</h3>
        <Choix d={d} set={set} k="typeBienNet" options={TYPE_BIEN_NETTOYAGE} label="Type de bien" />
        <div className={styles.ligne}>
          <label className={styles.champ}>
            <span className={styles.label}>Surface intérieure (m²)</span>
            <input
              type="number" min={0} inputMode="decimal" className={styles.input}
              value={p.surface} onChange={(e) => p.setSurface(e.target.value)} placeholder="—"
            />
          </label>
          <Nombre d={d} set={set} k="nbPieces" label="Nombre de pièces" />
        </div>
        <ChoixLibre
          options={ETAT_GENERAL} value={p.etat} onPick={p.setEtat} label="État général"
        />
        <Choix d={d} set={set} k="occupation" options={OCCUPATION} label="Occupation" />
      </section>

      {/* ── 3. Intérieur ──────────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>3 · Éléments intérieurs</h3>

        <Choix d={d} set={set} k="vitrerie" options={OUI_NON} label="Nettoyage des vitres" />
        {oui("vitrerie") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="vitrerieQuantite" options={VITRERIE_QUANTITE} label="Quantité" />
            <Choix d={d} set={set} k="vitrerieAcces" options={VITRERIE_ACCES} label="Accessibilité" />
            {/* Vitrage supplémentaire facturé au m² DE VITRE, jamais au m² de
                logement : laisser vide si le barème à la quantité suffit. */}
            <Nombre d={d} set={set} k="vitrerieM2" label="Surface de vitrage à facturer (m²) — optionnel" />
            <Nombre d={d} set={set} k="nbVolets" label="Nombre de volets — optionnel" />
          </div>
        )}

        <Multi d={d} set={set} k="sols" options={SOLS} label="Revêtements de sol" />
        <Multi d={d} set={set} k="traitementsSol" options={TRAITEMENTS_SOL} label="Traitement de sol (au m²)" />
        <Multi d={d} set={set} k="equipements" options={EQUIPEMENTS} label="Équipements à nettoyer" />

        {/* Le lessivage est une prestation complémentaire : jamais incluse
            d'office dans le tarif (consigne client). */}
        <Choix d={d} set={set} k="murs" options={MURS} label="Nettoyage des murs" />
        {txt(d, "murs") === "murs_lessivage" && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="mursSurface" options={SURFACE_CONCERNEE} label="Surface concernée" />
          </div>
        )}

        <Choix d={d} set={set} k="plafonds" options={OUI_NON} label="Nettoyage des plafonds" />
        {oui("plafonds") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="plafondsType" options={PLAFONDS_TYPE} label="Type de nettoyage" />
            <Choix d={d} set={set} k="plafondsSurface" options={SURFACE_CONCERNEE} label="Surface concernée" />
            <Choix d={d} set={set} k="plafondsEtat" options={PLAFONDS_ETAT} label="État" />
          </div>
        )}

        <Choix d={d} set={set} k="cuisineAmenagee" options={OUI_NON} label="Cuisine aménagée" />
        {oui("cuisineAmenagee") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="cuisineEquipee" options={OUI_NON} label="Cuisine équipée" />
            <Choix d={d} set={set} k="cuisineInterieur" options={OUI_NON} label="Intérieur des équipements et placards" />
          </div>
        )}

        <Choix d={d} set={set} k="dressings" options={OUI_NON} label="Dressings ou placards" />
        {oui("dressings") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="dressingsInterieur" options={OUI_NON} label="Nettoyage intérieur" />
          </div>
        )}

        <div className={styles.ligne}>
          <Choix d={d} set={set} k="nbSdb" options={NOMBRE_0_3} label="Salles de bain / d'eau" />
          <Choix d={d} set={set} k="nbWc" options={NOMBRE_0_3} label="WC" />
        </div>
      </section>

      {/* ── 4. Extérieur ──────────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>4 · Terrasse et extérieurs</h3>
        <Choix d={d} set={set} k="exterieur" options={OUI_NON} label="Espace extérieur à nettoyer" />
        {oui("exterieur") && (
          <div className={styles.conditionnel}>
            <Multi d={d} set={set} k="exterieurTypes" options={EXTERIEUR_TYPE} label="Type d'espace" />
            <Nombre d={d} set={set} k="exterieurSurfaceM2" label="Surface extérieure (m²)" />
            <Multi d={d} set={set} k="exterieurRevetements" options={EXTERIEUR_REVETEMENT} label="Revêtement" />
            <Choix d={d} set={set} k="exterieurEtat" options={EXTERIEUR_ETAT} label="État de saleté" />
            <p className={styles.note}>
              La surface extérieure est chiffrée séparément de l&apos;intérieur.
            </p>
          </div>
        )}
      </section>

      {/* ── 5. Options complémentaires ────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>5 · Options complémentaires</h3>
        <Multi d={d} set={set} k="complements" options={COMPLEMENTS} />

        {comps.includes("desinfection") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="desinfectionSurface" options={SURFACE_CONCERNEE} label="Désinfection — surface" />
            {txt(d, "desinfectionSurface") === "partielle" && (
              <Nombre d={d} set={set} k="desinfectionM2" label="Surface désinfectée (m²)" />
            )}
          </div>
        )}
        {comps.includes("decontamination") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="decontaminationOrigine" options={DECONTAMINATION_ORIGINE} label="Décontamination — origine" />
            <Choix d={d} set={set} k="decontaminationSurface" options={SURFACE_CONCERNEE} label="Décontamination — surface" />
          </div>
        )}
        {comps.includes("desodorisation") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="desodorisationOrigine" options={DESODORISATION_ORIGINE} label="Désodorisation — origine" />
          </div>
        )}
        {comps.includes("debarras") && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="debarrasVolume" options={DEBARRAS_VOLUME} label="Débarras — volume estimé" />
          </div>
        )}
      </section>

      {/* ── 6. Accès et date ──────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>6 · Accès et date souhaitée</h3>
        <div className={styles.ligne}>
          <Choix d={d} set={set} k="etage" options={ETAGE} label="Étage" />
          <Choix d={d} set={set} k="ascenseur" options={OUI_NON} label="Ascenseur" />
        </div>
        <Choix d={d} set={set} k="stationnement" options={STATIONNEMENT} label="Stationnement" />
        <div className={styles.ligne}>
          <label className={styles.champ}>
            <span className={styles.label}>Date souhaitée</span>
            <input
              type="date" className={styles.input}
              value={p.wantedDate} onChange={(e) => p.setWantedDate(e.target.value)}
            />
          </label>
          <ChoixLibre
            options={CRENEAUX.map((v) => ({ value: v, label: WANTED_SLOT_LABEL[v] }))}
            value={p.wantedSlot}
            onPick={p.setWantedSlot}
            label="Créneau souhaité"
          />
        </div>
        {p.wantedSlot === "heure_precise" && (
          <label className={styles.champ}>
            <span className={styles.label}>Heure</span>
            <input
              type="time" className={styles.input}
              value={p.wantedStart} onChange={(e) => p.setWantedStart(e.target.value)}
            />
          </label>
        )}
        <Choix d={d} set={set} k="urgence" options={URGENCE} label="Urgence" />
      </section>

      {/* ── 7. Diogène — extension facultative ────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>7 · Cas particulier</h3>
        {p.dejaDiogene ? (
          <p className={styles.dioActif}>🔵 Ce dossier est classé <strong>Diogène</strong>.</p>
        ) : (
          <button
            type="button"
            className={`${styles.dioBtn} ${diogene ? styles.dioBtnOn : ""}`}
            onClick={() => set("diogene", !diogene)}
            aria-pressed={diogene}
          >
            🔵 DIOGÈNE
          </button>
        )}
        {diogene && !p.dejaDiogene && (
          <p className={styles.dioAvertissement}>
            À l&apos;enregistrement, ce dossier sera reclassé en activité <strong>Diogène</strong> et
            confié à un commercial habilité. Rien n&apos;est perdu : mêmes coordonnées, mêmes photos,
            même historique, même numéro de dossier.
          </p>
        )}

        {diogene && (
          <div className={styles.conditionnel}>
            <Choix d={d} set={set} k="dioEncombrement" options={DIO_ENCOMBREMENT} label="Niveau d'encombrement" />
            <Multi d={d} set={set} k="dioDechets" options={DIO_DECHETS} label="Nature des déchets" />
            <Choix d={d} set={set} k="dioVolume" options={DIO_VOLUME} label="Volume à évacuer" />
            <Choix d={d} set={set} k="dioAccessibilite" options={DIO_ACCESSIBILITE} label="Accessibilité intérieure" />
            <Choix d={d} set={set} k="dioNuisibles" options={OUI_NON} label="Présence de nuisibles" />
            {oui("dioNuisibles") && (
              <Multi d={d} set={set} k="dioNuisiblesTypes" options={DIO_NUISIBLES} label="Lesquels" />
            )}
            <Choix d={d} set={set} k="dioOdeurs" options={DIO_ODEURS} label="Odeurs" />
            <Multi d={d} set={set} k="dioPrestations" options={DIO_PRESTATIONS} label="Prestations nécessaires" />
          </div>
        )}
      </section>

      {/* ── 8. Photos ─────────────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h3 className={styles.h3}>8 · Photos</h3>
        <div className={styles.ligne}>
          <Choix d={d} set={set} k="photosEtat" options={PHOTOS_ETAT} />
          <Link href={`/leads/${leadId}?tab=media`} className={styles.lienPhotos}>
            Voir les photos du dossier →
          </Link>
        </div>
      </section>
    </div>
  );
}
