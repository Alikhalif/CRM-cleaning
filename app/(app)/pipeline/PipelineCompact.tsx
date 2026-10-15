"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  PIPELINE_CATS, PIPELINE_CAT_LABEL, PIPELINE_CAT_TONE,
  SITUATION_LABEL, SITUATION_TONE, pipelineCatOf,
  type PipelineCat, type SuiviRow,
} from "@/lib/suivi-shared";
import styles from "./PipelineCompact.module.scss";

// Pipeline — VUE, pas outil de gestion.
//
// Quatre cases, un compteur par case, un filtre appel/formulaire, une
// recherche, et une seule action par dossier : ouvrir le Suivi commercial.
// Tout le travail (découverte, relances, photos, devis, closing) appartient au
// Suivi : le dupliquer ici créerait deux endroits où faire la même chose.
//
// Les données viennent de getSuiviData, la MÊME source que le Suivi commercial :
// aucun second système de statuts, donc aucune désynchronisation possible.

type Origin = "all" | "phone" | "form";

const ORIGIN_LABEL: Record<Origin, string> = {
  all: "Tous",
  phone: "📞 Appels entrants",
  form: "📋 Formulaires",
};

const heure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const jour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function PipelineCompact({ rows }: { rows: SuiviRow[] }) {
  const [cat, setCat] = useState<PipelineCat | null>(null);
  const [origin, setOrigin] = useState<Origin>("all");
  const [q, setQ] = useState("");

  const parCat = useMemo(() => {
    const map = new Map<PipelineCat, SuiviRow[]>(PIPELINE_CATS.map((c) => [c, []]));
    const terme = q.trim().toLowerCase();
    for (const r of rows) {
      const c = pipelineCatOf(r.situation);
      if (!c) continue; // les dossiers perdus sortent du Pipeline
      if (origin !== "all" && r.origin !== origin) continue;
      if (terme && !`${r.client} ${r.shortId} ${r.phone} ${r.sectorLabel}`.toLowerCase().includes(terme)) continue;
      map.get(c)!.push(r);
    }
    // Les plus récents d'abord : le Pipeline sert à voir ce qui arrive.
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    }
    return map;
  }, [rows, origin, q]);

  const visibles = cat ? [cat] : PIPELINE_CATS;

  return (
    <div className={styles.wrap}>
      <div className={styles.counters}>
        {PIPELINE_CATS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.counter} ${cat === c ? styles.counterOn : ""}`}
            data-tone={PIPELINE_CAT_TONE[c]}
            onClick={() => setCat((v) => (v === c ? null : c))}
          >
            <span className={styles.counterValue}>{parCat.get(c)!.length}</span>
            <span className={styles.counterLabel}>{PIPELINE_CAT_LABEL[c]}</span>
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <div className={styles.search}>
          <Icon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un prospect…" aria-label="Rechercher" />
        </div>
        {(["all", "phone", "form"] as Origin[]).map((o) => (
          <button key={o} type="button" className={`${styles.chip} ${origin === o ? styles.chipOn : ""}`} onClick={() => setOrigin(o)}>
            {ORIGIN_LABEL[o]}
          </button>
        ))}
      </div>

      <div className={styles.cols} data-single={cat ? "1" : undefined}>
        {visibles.map((c) => {
          const list = parCat.get(c)!;
          return (
            <section key={c} className={styles.col}>
              <h2 className={styles.colHead} data-tone={PIPELINE_CAT_TONE[c]}>
                {PIPELINE_CAT_LABEL[c]} <span className={styles.colCount}>{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className={styles.empty}>—</p>
              ) : (
                <ul className={styles.list}>
                  {list.map((r) => <Card key={r.leadId} r={r} cat={c} />)}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({ r, cat }: { r: SuiviRow; cat: PipelineCat }) {
  // Une seule teinte par carte, posée en bordure latérale — jamais de fond
  // coloré : la consigne est un design blanc et sobre.
  const tone = cat === "nouveaux" ? "rouge" : SITUATION_TONE[r.situation];
  return (
    <li className={styles.card} data-tone={tone}>
      <div className={styles.cardTop}>
        <span className={styles.name}>{r.client}</span>
        <span className={styles.origin} title={r.origin === "phone" ? "Appel entrant" : "Formulaire"}>
          {r.origin === "phone" ? "📞" : "📋"}
        </span>
      </div>
      <div className={styles.meta}>
        {r.sectorLabel} · {r.shortId}
        <br />
        {/* Chaque case montre ce qui lui est utile, et rien d'autre : le
            Pipeline sert à lire en quelques secondes. */}
        {cat === "nouveaux" && <><span className={styles.untreated}>Non traité</span> · {heure(r.receivedAt)}</>}
        {cat === "decouverte" && <>{SITUATION_LABEL[r.situation]} · maj {jour(r.lastActionAt)}</>}
        {cat === "devis_envoyes" && (
          <>
            {SITUATION_LABEL[r.situation]}
            {r.devisSentAt && <> · envoyé le {jour(r.devisSentAt)}</>}
            {r.amount != null && <> · {r.amount.toLocaleString("fr-FR")} €</>}
          </>
        )}
        {cat === "signes" && (
          <>
            {r.signedAt ? `Signé le ${jour(r.signedAt)}` : "Signé"}
            {r.amount != null && <> · {r.amount.toLocaleString("fr-FR")} €</>}
          </>
        )}
      </div>
      <Link href={`/leads/${r.leadId}`} className={styles.open}>Ouvrir le suivi →</Link>
    </li>
  );
}
