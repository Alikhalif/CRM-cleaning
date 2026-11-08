"use client";
// Séries de factures par société — Super Admin seul (D26, 2026-11-09).
//
// Une série se PRÉPARE (code + date d'effet) et ne bascule qu'à sa date :
// avant, la série historique continue. Une fois active, ou dès qu'une facture
// y a été numérotée, elle est figée — en base comme ici. Aucune facture déjà
// émise n'est renumérotée : la série ne s'applique qu'aux émissions futures.
import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import { definirSerieFacturation } from "./actions";
import { COUNTRY_LABEL, type Country } from "@/lib/leads";
import type { EtatSerie } from "@/lib/facturation/series-server";
import styles from "./Entities.module.scss";

type Props = { migrationAppliquee: boolean; series: EtatSerie[] };

function exemple(code: string | null, depuis: string | null): string {
  const annee = depuis ? depuis.slice(0, 4) : String(new Date().getFullYear() + 1);
  return `FAC-${code ?? "CODE"}-${annee}-0001`;
}

export default function SeriesFacturation({ migrationAppliquee, series }: Props) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [depuis, setDepuis] = useState(`${new Date().getFullYear() + 1}-01-01`);
  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const enregistrer = (s: EtatSerie) => {
    if (!confirm(
      `Préparer la série ${code.toUpperCase() || "?"} pour ${s.nom}, effective le ${depuis} ?\n\n`
      + "Avant cette date, rien ne change. À cette date, la série devient définitive et ne se modifie plus.",
    )) return;
    demarrer(async () => {
      const r = await definirSerieFacturation(s.id, { code, depuis });
      if (r.ok) {
        setMessage({ ton: "ok", texte: `Série préparée pour ${s.nom}.` + (r.signalements.length ? ` ⚠️ ${r.signalements.join(" ")}` : "") });
        setOuverte(null);
        setCode("");
      } else {
        setMessage({ ton: "ko", texte: r.error });
      }
    });
  };

  return (
    <section className={styles.emptyCard} style={{ marginTop: "var(--sp-6)" }}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.h}>Séries de factures</h2>
          <p className={styles.subtitle}>
            Réservé au <strong>Super Admin</strong>. Chaque société peut avoir sa{" "}
            <strong>propre série</strong>, indépendante des autres. Elle se prépare à
            l&apos;avance et ne s&apos;applique qu&apos;<strong>à partir de sa date d&apos;effet</strong> ;
            les factures déjà émises <strong>ne sont jamais renumérotées</strong>.
          </p>
        </div>
      </div>

      {!migrationAppliquee ? (
        <p className={styles.itemMetaAlert}>
          <Icon name="alert" size={14} /> La migration des séries n&apos;est pas appliquée sur
          cette base : toutes les sociétés partagent la série historique (D26).
        </p>
      ) : (
        <>
          <p className={styles.itemMetaAlert}>
            <Icon name="alert" size={14} /> Date recommandée : un <strong>1er janvier</strong>,
            pour qu&apos;une société n&apos;ait jamais deux séries la même année. À fixer avec
            l&apos;expert-comptable.
          </p>
          <ul className={styles.list}>
            {series.map((s) => {
              const figee = s.active || s.employee;
              return (
                <li key={s.id} className={styles.item}>
                  <div className={styles.itemBody}>
                    <span className={styles.itemTitle}>{s.nom}</span>{" "}
                    <span className={styles.itemMeta}>{s.pays ? COUNTRY_LABEL[s.pays as Country] : "pays non renseigné"}</span>
                    <div className={styles.itemMeta}>
                      {s.code
                        ? <>Série <strong>{s.code}</strong> — {figee ? "active depuis" : "effective le"} {s.depuis} · ex. {exemple(s.code, s.depuis)}</>
                        : <>Série historique commune</>}
                      {figee && <> · <strong>figée</strong></>}
                    </div>
                  </div>
                  {!figee && (
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        disabled={enCours}
                        aria-expanded={ouverte === s.id}
                        onClick={() => { setOuverte(ouverte === s.id ? null : s.id); setMessage(null); setCode(s.code ?? ""); }}
                      >
                        {s.code ? "Modifier la série préparée" : "Préparer une série"}
                      </button>
                    </div>
                  )}
                  {ouverte === s.id && (
                    <div className={styles.itemForm}>
                      <label>
                        Code (2 à 8 lettres ou chiffres)
                        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
                      </label>
                      <label>
                        Date d&apos;effet
                        <input type="date" value={depuis} onChange={(e) => setDepuis(e.target.value)} />
                      </label>
                      <p className={styles.itemMeta}>Exemple de numéro : {exemple(code || null, depuis)}</p>
                      <button type="button" className={styles.newBtn} disabled={enCours || !code} onClick={() => enregistrer(s)}>
                        {enCours ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {message && (
        <p className={message.ton === "ok" ? styles.itemMeta : styles.itemMetaAlert} role="status">{message.texte}</p>
      )}
    </section>
  );
}
