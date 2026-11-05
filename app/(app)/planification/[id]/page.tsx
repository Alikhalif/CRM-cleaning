import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  getContratsDuDossier,
  getDossierContrat,
  getEntitesEmettrices,
  getPrestataires,
} from "@/lib/sous-traitance/contrats-server";
import { optionsModeles } from "@/lib/sous-traitance/contrats-shared";
import { getEtatsDocuSign, getSignaturesDuDossier } from "@/lib/docusign/lecture-server";
import ContratSousTraitance from "./ContratSousTraitance";
import styles from "./DossierDetail.module.scss";

export const metadata = { title: "Dossier d'intervention" };

// Fiche d'un dossier d'intervention, côté planification.
//
// La page n'existait pas : la planification était une liste, et le cahier des
// charges demande d'« ouvrir le dossier de l'intervention » pour y générer un
// contrat de sous-traitance. Elle est donc AJOUTÉE, sans toucher à la liste —
// qui reçoit seulement un lien vers elle.
//
// Aucune garde d'accès à écrire ici : le `layout.tsx` de `/planification`
// appelle déjà `requireBackOffice()`, et une garde de layout couvre toutes les
// sous-routes. Un commercial qui tape l'URL reçoit un 404.

export default async function DossierPage({
  params,
}: {
  // Next 16 : `params` est une promesse.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dossier = await getDossierContrat(id);
  if (!dossier) notFound();

  const [prestataires, entites, contrats] = await Promise.all([
    getPrestataires(),
    getEntitesEmettrices(),
    getContratsDuDossier(id),
  ]);

  // État du raccordement DocuSign (§6) et signatures en cours. Les deux
  // lectures dépendent de ce qui précède : les entités pour les états, les
  // contrats pour les enveloppes.
  const [etatsDocuSign, signatures] = await Promise.all([
    getEtatsDocuSign(entites.map((e) => e.id)),
    getSignaturesDuDossier(contrats.map((c) => c.id)),
  ]);

  const dateFr = dossier.mission.date
    ? new Date(dossier.mission.date + "T12:00:00").toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  return (
    <div className={styles.wrap}>
      <nav className={styles.crumb}>
        <Link href="/planification">Planification</Link>
        <span aria-hidden="true"> › </span>
        <span>{dossier.leadShortId}</span>
      </nav>

      <header className={styles.head}>
        <div className={styles.who}>
          <h1 className={styles.name}>{dossier.nomClientAffiche}</h1>
          <p className={styles.sub}>
            {dossier.leadShortId}
            {dossier.mission.type ? ` · ${dossier.mission.type}` : ""}
          </p>
        </div>
        <span className={styles.statut}>{dossier.statut.replace(/_/g, " ")}</span>
      </header>

      <section className={styles.card} aria-labelledby="h-intervention">
        <h2 id="h-intervention" className={styles.h2}>
          <Icon name="calendar" size={16} /> Intervention
        </h2>
        <dl className={styles.readGrid}>
          <div>
            <dt className={styles.k}>Date</dt>
            <dd className={styles.v}>
              {dateFr ?? <span className={styles.vide}>non planifiée</span>}
              {dossier.mission.heureDebut ? ` à ${dossier.mission.heureDebut}` : ""}
            </dd>
          </div>
          <div>
            <dt className={styles.k}>Adresse du chantier</dt>
            <dd className={styles.v}>
              {dossier.mission.adresse || <span className={styles.vide}>non renseignée</span>}
            </dd>
          </div>
          <div>
            <dt className={styles.k}>Étage</dt>
            <dd className={styles.v}>
              {dossier.mission.etage || <span className={styles.vide}>non renseigné</span>}
            </dd>
          </div>
          <div>
            <dt className={styles.k}>Conditions d&apos;accès</dt>
            <dd className={styles.v}>
              {dossier.mission.acces || <span className={styles.vide}>non renseignées</span>}
            </dd>
          </div>
          <div>
            <dt className={styles.k}>Surface</dt>
            <dd className={styles.v}>
              {dossier.mission.surfaceM2 != null
                ? `${dossier.mission.surfaceM2} m²`
                : <span className={styles.vide}>non renseignée</span>}
            </dd>
          </div>
          <div>
            <dt className={styles.k}>Durée prévue</dt>
            <dd className={styles.v}>
              {dossier.mission.dureeHeures != null
                ? `${dossier.mission.dureeHeures} h`
                : <span className={styles.vide}>non renseignée</span>}
            </dd>
          </div>
        </dl>

        {/* Vitrerie — reprise de la découverte commerciale. La planificatrice
            organise l'intervention sans ressaisir les vitrages, et lit le même
            texte que celui porté par le devis. */}
        {dossier.vitrerie && (
          <>
            <h3 className={styles.h3}>Vitrerie</h3>
            <p className={styles.preLigne}>{dossier.vitrerie}</p>
          </>
        )}

        <h3 className={styles.h3}>Client final</h3>
        <dl className={styles.readGrid}>
          <div>
            <dt className={styles.k}>Téléphone</dt>
            <dd className={styles.v}>{dossier.client.telephone || <span className={styles.vide}>—</span>}</dd>
          </div>
          <div>
            <dt className={styles.k}>Courriel</dt>
            <dd className={styles.v}>{dossier.client.email || <span className={styles.vide}>—</span>}</dd>
          </div>
          <div>
            <dt className={styles.k}>Adresse de facturation</dt>
            <dd className={styles.v}>{dossier.client.adresse || <span className={styles.vide}>—</span>}</dd>
          </div>
        </dl>
      </section>

      {/* Le bloc demandé au §4 du cahier des charges. */}
      <ContratSousTraitance
        dossier={dossier}
        prestataires={prestataires}
        entites={entites}
        modeles={optionsModeles()}
        contrats={contrats}
        etatsDocuSign={etatsDocuSign}
        signatures={signatures}
      />
    </div>
  );
}
