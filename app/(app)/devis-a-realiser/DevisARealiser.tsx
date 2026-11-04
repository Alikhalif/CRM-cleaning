"use client";

// Liste des devis à réaliser (§4 et §7 du cahier du 2026-11-03).
//
// Vue de LECTURE et d'orientation : on y repère un dossier, on l'ouvre, on
// prépare le devis dans la fiche existante. Aucun statut n'est posé depuis
// cet écran — tout se dérive de l'état réel du dossier, donc il n'y a rien à
// cocher ici, et aucune fiche client n'est dupliquée (§4, §14).

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import {
  FILTRES_VIDES, STATUTS, STATUT_COURT, STATUT_LABEL, URGENCE_LABEL,
  ancienneteLabel, appliquerFiltres, compareAnciennete, compter,
  type DevisARealiserData, type Filtres, type LigneDevis, type StatutDevis,
} from "@/lib/devis-a-realiser/shared";
import { setSeuilsDevis } from "./actions";
import styles from "./DevisARealiser.module.scss";

const F_JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Paris",
});
const F_MOMENT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Paris",
});

const jour = (iso: string | null) => (iso ? F_JOUR.format(new Date(iso)) : "—");
const moment = (iso: string | null) => (iso ? F_MOMENT.format(new Date(iso)) : "—");

export default function DevisARealiser({ data }: { data: DevisARealiserData }) {
  const [f, setF] = useState<Filtres>(FILTRES_VIDES);
  const [vert, setVert] = useState(String(data.seuils.vertH));
  const [orange, setOrange] = useState(String(data.seuils.orangeH));
  const [reglage, setReglage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const set = <K extends keyof Filtres>(k: K, v: Filtres[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  // Les plus anciens d'abord : cette vue sert à rattraper les retards (§7).
  const lignes = useMemo(
    () => appliquerFiltres(data.lignes, f).sort(compareAnciennete),
    [data.lignes, f],
  );
  const vus = useMemo(() => compter(lignes), [lignes]);

  const actifs = Object.entries(f).filter(([k, v]) => {
    if (k === "ancienneteMin") return Number(v) > 0;
    return typeof v === "string" && v !== "";
  }).length;

  return (
    <div className={styles.wrap}>
      {/* ── Compteurs ─────────────────────────────────────────────── */}
      <section className={styles.cards} aria-label="Synthèse">
        <div className={styles.card} data-ton="total">
          <span className={styles.cardValue}>{data.compteurs.total}</span>
          <span className={styles.cardLabel}>devis à réaliser</span>
        </div>
        <div className={styles.card} data-ton="prioritaire">
          <span className={styles.cardValue}>{data.compteurs.enRetard}</span>
          <span className={styles.cardLabel}>
            au-delà de {data.seuils.orangeH} h
          </span>
        </div>
        <div className={styles.card} data-ton="attente">
          <span className={styles.cardValue}>{data.compteurs.parStatut.pret_a_envoyer}</span>
          <span className={styles.cardLabel}>prêts à envoyer</span>
        </div>
        <div className={styles.card} data-ton="photos">
          <span className={styles.cardValue}>{data.compteurs.photosManquantes}</span>
          <span className={styles.cardLabel}>photos manquantes</span>
        </div>
      </section>

      {/* ── Les deux catégories de la liste ───────────────────────────
          Consigne du 2026-11-04 : la liste porte DEUX familles de dossiers,
          et il faut que ça se voie. Elles sont déjà distinguées par les
          statuts ci-dessous — on l'écrit, plutôt que d'ajouter un second
          découpage qui dirait la même chose autrement. */}
      <p className={styles.deuxCategories}>
        <strong>
          À générer ({data.compteurs.parStatut.a_realiser + data.compteurs.parStatut.attente_infos})
        </strong>{" "}
        — découverte terminée, aucun devis préparé : ouvrez le dossier et cliquez
        « Générer le devis ».
        {"  ·  "}
        <strong>
          Brouillons à finaliser ({data.compteurs.parStatut.en_preparation + data.compteurs.parStatut.pret_a_envoyer})
        </strong>{" "}
        — un devis existe en brouillon : reprenez-le, corrigez-le, puis envoyez-le.
      </p>

      {/* ── Onglets par statut ────────────────────────────────────── */}
      <div className={styles.onglets} role="tablist" aria-label="Statut du devis">
        <button
          type="button" role="tab" aria-selected={f.statut === ""}
          className={f.statut === "" ? `${styles.onglet} ${styles.ongletOn}` : styles.onglet}
          onClick={() => set("statut", "")}
        >
          Tous <span className={styles.pastille}>{data.compteurs.total}</span>
        </button>
        {STATUTS.map((s: StatutDevis) => (
          <button
            key={s} type="button" role="tab" aria-selected={f.statut === s}
            title={STATUT_LABEL[s]}
            className={f.statut === s ? `${styles.onglet} ${styles.ongletOn}` : styles.onglet}
            onClick={() => set("statut", f.statut === s ? "" : s)}
          >
            {STATUT_COURT[s]}{" "}
            <span className={styles.pastille}>{data.compteurs.parStatut[s]}</span>
          </button>
        ))}
      </div>

      {/* ── Recherche et filtres ──────────────────────────────────── */}
      <section className={styles.filtres} aria-label="Filtres">
        <label className={styles.recherche}>
          <Icon name="search" size={15} />
          <input
            type="search"
            value={f.recherche}
            onChange={(e) => set("recherche", e.target.value)}
            placeholder="Nom, téléphone ou numéro de dossier…"
            aria-label="Rechercher un dossier"
          />
        </label>

        {data.isBackOffice && data.commerciaux.length > 0 && (
          <label className={styles.filtre}>
            <span>Commercial</span>
            <select value={f.commercial} onChange={(e) => set("commercial", e.target.value)}>
              <option value="">Tous</option>
              {data.commerciaux.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        {data.prestations.length > 1 && (
          <label className={styles.filtre}>
            <span>Prestation</span>
            <select value={f.prestation} onChange={(e) => set("prestation", e.target.value)}>
              <option value="">Toutes</option>
              {data.prestations.map((p) => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </label>
        )}

        {data.societes.length > 1 && (
          <label className={styles.filtre}>
            <span>Société</span>
            <select value={f.societe} onChange={(e) => set("societe", e.target.value)}>
              <option value="">Toutes</option>
              {data.societes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}

        {data.pays.length > 1 && (
          <label className={styles.filtre}>
            <span>Pays</span>
            <select value={f.pays} onChange={(e) => set("pays", e.target.value)}>
              <option value="">Tous</option>
              {data.pays.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}

        <label className={styles.filtre}>
          <span>Photos</span>
          <select value={f.photos} onChange={(e) => set("photos", e.target.value)}>
            <option value="">Indifférent</option>
            <option value="non">Reçues</option>
            <option value="oui">Manquantes</option>
          </select>
        </label>

        <label className={styles.filtre}>
          <span>Ancienneté min.</span>
          <select
            value={String(f.ancienneteMin)}
            onChange={(e) => set("ancienneteMin", Number(e.target.value))}
          >
            <option value="0">Toutes</option>
            <option value={String(data.seuils.vertH)}>+ de {data.seuils.vertH} h</option>
            <option value={String(data.seuils.orangeH)}>+ de {data.seuils.orangeH} h</option>
            <option value="48">+ de 48 h</option>
            <option value="168">+ de 7 jours</option>
          </select>
        </label>

        <label className={styles.filtre}>
          <span>Découverte depuis</span>
          <input type="date" value={f.depuis} onChange={(e) => set("depuis", e.target.value)} />
        </label>
        <label className={styles.filtre}>
          <span>jusqu&apos;au</span>
          <input type="date" value={f.jusqu} onChange={(e) => set("jusqu", e.target.value)} />
        </label>

        {actifs > 0 && (
          <button type="button" className={styles.reset} onClick={() => setF(FILTRES_VIDES)}>
            <Icon name="x" size={14} /> Réinitialiser
          </button>
        )}
      </section>

      <p className={styles.compte}>
        {lignes.length} dossier{lignes.length > 1 ? "s" : ""}
        {lignes.length !== data.compteurs.total ? ` sur ${data.compteurs.total}` : ""}
        {vus.photosManquantes > 0 ? ` · ${vus.photosManquantes} sans photos` : ""}
      </p>

      {/* ── Le tableau ────────────────────────────────────────────── */}
      {lignes.length === 0 ? (
        <p className={styles.vide}>
          {data.compteurs.total === 0
            ? "Aucun devis en attente : toutes les découvertes terminées ont donné lieu à un envoi."
            : "Aucun dossier ne correspond aux filtres."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Intervention</th>
                <th scope="col">Prestation</th>
                <th scope="col">Commercial</th>
                <th scope="col">Découverte</th>
                <th scope="col">Attente</th>
                <th scope="col">Statut</th>
                <th scope="col">Dernière modif.</th>
                <th scope="col" className={styles.right}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l: LigneDevis) => (
                <tr key={l.leadId} data-urgence={l.urgence}>
                  <td data-label="Client">
                    <span className={styles.cellPrincipale}>
                      {l.client}
                      {l.isUrgent && <span className={styles.urgent} title="Dossier urgent">!</span>}
                    </span>
                    <span className={styles.cellSecondaire}>
                      {l.shortId}
                      {l.phone ? (
                        <>
                          {" · "}
                          <a href={`tel:${l.phone}`} className={styles.tel}>{l.phone}</a>
                        </>
                      ) : null}
                    </span>
                  </td>

                  <td data-label="Intervention">
                    <span className={styles.cellPrincipale}>
                      {l.adresse || <span className={styles.manque}>adresse à compléter</span>}
                    </span>
                    <span className={styles.cellSecondaire}>
                      {[l.codePostal, l.ville].filter(Boolean).join(" ") || "—"}
                      {l.pays && l.pays !== "FR" ? ` · ${l.pays}` : ""}
                    </span>
                  </td>

                  <td data-label="Prestation">
                    <span className={styles.cellPrincipale}>{l.prestation}</span>
                    <span className={styles.cellSecondaire}>
                      {l.societe ?? <span className={styles.manque}>société non rattachée</span>}
                    </span>
                  </td>

                  <td data-label="Commercial">
                    {l.commercial ?? <span className={styles.manque}>non affecté</span>}
                  </td>

                  <td data-label="Découverte">
                    <span className={styles.cellPrincipale}>{moment(l.decouverteLe)}</span>
                    <span className={styles.cellSecondaire}>
                      lead du {jour(l.arriveeLe)}
                    </span>
                  </td>

                  <td data-label="Attente">
                    <span className={styles.badgeUrgence} data-urgence={l.urgence}>
                      {ancienneteLabel(l.heures)}
                    </span>
                    <span className={styles.cellSecondaire}>{URGENCE_LABEL[l.urgence]}</span>
                  </td>

                  <td data-label="Statut">
                    <span className={styles.badgeStatut} data-statut={l.statut}>
                      {STATUT_COURT[l.statut]}
                    </span>
                    {/* §12 — indication SÉPARÉE du statut : un devis prêt ne
                        doit pas masquer des photos manquantes. */}
                    {l.photosManquantes && (
                      <span className={styles.badgePhotos} title={
                        l.photosDemandeesLe
                          ? `Photos demandées le ${moment(l.photosDemandeesLe)}`
                          : "Photos attendues"
                      }>
                        <Icon name="image" size={12} /> Photos manquantes
                      </span>
                    )}
                    {l.preparationLe && (
                      <span className={styles.cellSecondaire}>
                        préparé depuis le {jour(l.preparationLe)}
                      </span>
                    )}
                  </td>

                  {/* Dernière retouche du brouillon. « — » signifie qu'aucun
                      brouillon n'existe encore : le devis reste à générer. */}
                  <td data-label="Dernière modif.">
                    {l.modifieLe ? (
                      <span className={styles.cellPrincipale}>{moment(l.modifieLe)}</span>
                    ) : (
                      <span className={styles.manque}>devis à générer</span>
                    )}
                  </td>

                  <td data-label="Action" className={styles.right}>
                    {/* Quand un brouillon existe, on y mène directement : la
                        colonne annonçait « En préparation » sans donner accès
                        au document. */}
                    <div className={styles.actionsLigne}>
                      {l.devisId && (
                        <Link href={`/devis/${l.devisId}`} className={styles.ouvrir}>
                          Ouvrir le devis
                        </Link>
                      )}
                      <Link
                        href={`/leads/${l.leadId}`}
                        className={`${styles.ouvrir} ${l.devisId ? styles.ouvrirSecondaire : ""}`}
                      >
                        Ouvrir le dossier
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.isAdmin ? (
        <section className={styles.reglage} aria-label="Seuils d'alerte">
          <div className={styles.reglageTexte}>
            <strong>Seuils d&apos;alerte</strong>
            <span>
              Vert en dessous du premier seuil, orange jusqu&apos;au second, rouge
              au-delà. Ces seuils changent une couleur et le compteur « en
              retard » — jamais un montant ni un statut de dossier.
            </span>
          </div>
          <label className={styles.filtre}>
            <span>Vert sous (h)</span>
            <input
              type="number" min="1" step="1" value={vert}
              onChange={(e) => setVert(e.target.value)}
            />
          </label>
          <label className={styles.filtre}>
            <span>Orange jusqu&apos;à (h)</span>
            <input
              type="number" min="2" step="1" value={orange}
              onChange={(e) => setOrange(e.target.value)}
            />
          </label>
          <button
            type="button" className={styles.enregistrer} disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                setReglage(null);
                const r = await setSeuilsDevis(Number(vert), Number(orange));
                setReglage(
                  r.ok
                    ? { ton: "ok", texte: "Seuils enregistrés." }
                    : { ton: "ko", texte: r.error },
                );
              })
            }
          >
            Enregistrer
          </button>
          {reglage && (
            <span className={reglage.ton === "ok" ? styles.ok : styles.ko} role="status">
              {reglage.texte}
            </span>
          )}
        </section>
      ) : (
        <p className={styles.legende}>
          Seuils d&apos;alerte : vert sous {data.seuils.vertH} h, orange jusqu&apos;à{" "}
          {data.seuils.orangeH} h, rouge au-delà. Modifiables par le Super Admin.
        </p>
      )}
    </div>
  );
}
