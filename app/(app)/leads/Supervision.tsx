"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { SupervisionData } from "@/lib/supervision-server";
import {
  FILTRES_VIDES, PERIODES, PERIODE_LABEL,
  appliquerFiltres, calculerAlertes, calculerKpi, money,
  parActivite, parCommercial, parPays, statutDe,
  type Bloc, type Filtres, type Periode,
} from "@/lib/supervision-shared";
import styles from "./Supervision.module.scss";

// Centre de supervision commerciale — Super Admin et superviseurs.
//
// Ce n'est PAS l'interface du commercial : on ne travaille pas des dossiers
// ici, on lit une situation. Le dirigeant doit comprendre son organisation en
// quelques secondes, sans ouvrir un seul client.
//
// Les filtres pays / activité / commercial se recalculent instantanément côté
// client, sur les mêmes faits et avec le MÊME code d'agrégation que le serveur.
// Seule la période repasse par le serveur : elle change le jeu de données.

export default function Supervision({ data }: { data: SupervisionData }) {
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState<Filtres>(FILTRES_VIDES);

  const rows = useMemo(() => appliquerFiltres(data.rows, f), [data.rows, f]);
  const kpi = useMemo(() => calculerKpi(rows), [rows]);
  const commerciaux = useMemo(() => parCommercial(rows), [rows]);
  const pays = useMemo(() => parPays(rows), [rows]);
  const activites = useMemo(() => parActivite(rows), [rows]);
  const alertes = useMemo(() => calculerAlertes(rows), [rows]);

  const setPeriode = (p: Periode) => {
    const q = new URLSearchParams(params.toString());
    q.set("periode", p);
    router.push(`/leads?${q.toString()}`);
  };

  const reset = () => setF(FILTRES_VIDES);
  const actif = f.pays || f.activite || f.commercial;

  return (
    <div className={styles.wrap}>
      {/* ── Filtres ──────────────────────────────────────────────────── */}
      <div className={styles.filtres}>
        <select value={data.periode} onChange={(e) => setPeriode(e.target.value as Periode)} aria-label="Période">
          {PERIODES.map((p) => <option key={p} value={p}>{PERIODE_LABEL[p]}</option>)}
        </select>
        {data.filtres.pays.length > 1 && (
          <select value={f.pays} onChange={(e) => setF({ ...f, pays: e.target.value })} aria-label="Pays">
            <option value="">Tous les pays</option>
            {data.filtres.pays.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        )}
        {data.filtres.activites.length > 1 && (
          <select value={f.activite} onChange={(e) => setF({ ...f, activite: e.target.value })} aria-label="Activité">
            <option value="">Toutes les activités</option>
            {data.filtres.activites.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        )}
        {data.filtres.commerciaux.length > 1 && (
          <select value={f.commercial} onChange={(e) => setF({ ...f, commercial: e.target.value })} aria-label="Commercial">
            <option value="">Tous les commerciaux</option>
            {data.filtres.commerciaux.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        {actif && <button type="button" className={styles.reset} onClick={reset}>Réinitialiser</button>}
      </div>

      {/* ── Zone 1 : synthèse ────────────────────────────────────────── */}
      <div className={styles.kpis}>
        <Kpi label="Leads reçus" value={kpi.leads} />
        <Kpi label="Traités" value={kpi.traites} tone="vert" />
        <Kpi label="En attente" value={kpi.enAttente} tone={kpi.enAttente > 0 ? "rouge" : undefined} />
        <Kpi label="Découvertes" value={kpi.decouvertes} />
        <Kpi label="Devis envoyés" value={kpi.devisEnvoyes} />
        <Kpi label="Devis signés" value={kpi.signes} tone="vert" />
        <Kpi
          label="CA signé"
          value={kpi.devise ? money(kpi.caSigne, kpi.devise) : `${money(kpi.caSigne, "EUR")} *`}
          tone="vert"
          hint={kpi.devise ? undefined : "euros seulement — devises mixtes, voir le détail par pays"}
        />
        <Kpi
          label="Conversion"
          value={kpi.tauxConversion == null ? "—" : `${kpi.tauxConversion} %`}
          hint={kpi.tauxConversion == null ? "aucun devis envoyé sur la période" : "signés / envoyés"}
        />
        <Kpi
          label="Réactivité"
          value={kpi.reactiviteMin == null ? "—" : kpi.reactiviteMin < 60 ? `${kpi.reactiviteMin} min` : `${Math.round(kpi.reactiviteMin / 60)} h`}
          hint={kpi.reactiviteMin == null ? "donnée indisponible" : "délai moyen de 1re prise en charge"}
        />
      </div>

      {/* ── Zone 2 : alertes ─────────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h2 className={styles.h2}>Points nécessitant votre attention</h2>
        {alertes.length === 0 ? (
          <p className={styles.rien}>Rien à signaler sur ce périmètre.</p>
        ) : (
          <ul className={styles.alertes}>
            {alertes.map((a) => (
              <li key={a.key} className={styles.alerte} data-p={a.priorite}>
                <span className={styles.alerteTitre}>{a.titre}</span>
                <span className={styles.alerteDetail}>{a.detail}</span>
                {a.href && <Link href={a.href} className={styles.alerteLien}>Voir →</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Zone 3 : commerciaux ─────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h2 className={styles.h2}>Performance de mes commerciaux</h2>
        {commerciaux.length === 0 ? (
          <p className={styles.rien}>Aucun dossier sur ce périmètre.</p>
        ) : (
          <div className={styles.cartes}>
            {commerciaux.map((b) => (
              <BlocCarte
                key={b.key} b={b} statut={statutDe(b)}
                onClick={() => setF({ ...f, commercial: f.commercial === b.key ? "" : b.key })}
                actif={f.commercial === b.key}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Zone 4 : pays et activités ───────────────────────────────── */}
      <div className={styles.deux}>
        <section className={styles.bloc}>
          <h2 className={styles.h2}>Performance par pays</h2>
          {pays.length === 0 ? <p className={styles.rien}>—</p> : (
            <div className={styles.cartes}>
              {pays.map((b) => (
                <BlocCarte key={b.key} b={b}
                  onClick={() => setF({ ...f, pays: f.pays === b.key ? "" : b.key })}
                  actif={f.pays === b.key} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.bloc}>
          <h2 className={styles.h2}>Performance par activité</h2>
          {activites.length === 0 ? <p className={styles.rien}>—</p> : (
            <div className={styles.cartes}>
              {activites.map((b) => (
                <BlocCarte key={b.key} b={b}
                  onClick={() => setF({ ...f, activite: f.activite === b.key ? "" : b.key })}
                  actif={f.activite === b.key} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Zone 5 : flux ────────────────────────────────────────────── */}
      <section className={styles.bloc}>
        <h2 className={styles.h2}>Activité commerciale en direct</h2>
        {data.flux.length === 0 ? (
          <p className={styles.rien}>Aucun événement tracé sur ce périmètre.</p>
        ) : (
          <ul className={styles.flux}>
            {data.flux.map((e, i) => (
              <li key={i}>
                <span className={styles.fluxHeure}>
                  {new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={styles.fluxQuoi}>{e.libelle}</span>
                {e.qui && <span className={styles.fluxQui}>{e.qui}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: number | string; tone?: "vert" | "rouge"; hint?: string }) {
  return (
    <div className={styles.kpi} data-tone={tone} title={hint}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</span>
      {hint && <span className={styles.kpiHint}>{hint}</span>}
    </div>
  );
}

function BlocCarte({ b, statut, onClick, actif }: { b: Bloc; statut?: "normal" | "attention" | "urgent"; onClick: () => void; actif: boolean }) {
  return (
    <button type="button" className={`${styles.carte} ${actif ? styles.carteOn : ""}`} data-statut={statut} onClick={onClick}>
      <span className={styles.carteNom}>{b.label}</span>
      <span className={styles.carteChiffres}>
        <b>{b.leads}</b> leads · {b.traites} traités · {b.devisEnvoyes} devis · <b>{b.signes}</b> signés
      </span>
      <span className={styles.carteBas}>
        {money(b.caSigne, b.devise)}
        {b.tauxConversion != null && <> · {b.tauxConversion} %</>}
        {b.enRetard > 0 && <span className={styles.retard}> · {b.enRetard} en retard</span>}
      </span>
    </button>
  );
}
