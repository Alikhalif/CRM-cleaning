"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { demandePourDossier } from "@/lib/generation/demande-depuis-dossier";
import type {
  DossierContrat,
  EntiteChoisissable,
} from "@/lib/sous-traitance/contrats-shared";
import styles from "./DossierDetail.module.scss";

// Demande de tarif à envoyer à plusieurs prestataires.
//
// ELLE RÉDIGE, ELLE N'ENVOIE PAS. Le texte est préparé, relu par la
// planificatrice, puis copié dans son client de messagerie. Aucun e-mail ne
// part du CRM : la consigne demandait la « préparation des e-mails
// prestataires », pas leur envoi.
//
// CONFIDENTIALITÉ. Une demande de tarif part à des prestataires dont AUCUN
// n'est encore retenu. Elle ne porte donc ni l'adresse complète, ni le nom du
// client, ni son téléphone, ni son courriel, ni le numéro d'appartement, ni le
// prix de vente. Le générateur relit son propre texte en y cherchant les
// vraies valeurs du dossier ET les formes qui désignent un logement : si une
// seule ressort, il refuse de le rendre, et ce composant affiche laquelle.
//
// En revanche le NIVEAU sort — « 2e étage », avec ou sans ascenseur — depuis
// l'arbitrage client du 2026-11-06 : il situe un effort, pas une personne, et
// sans lui le prestataire chiffre à l'aveugle.
//
// Le bon de mission, lui, porte l'adresse complète — mais il ne part qu'au
// prestataire RETENU. Deux destinataires, deux contenus.

type Props = {
  dossier: DossierContrat;
  /** Société émettrice sélectionnée, pour signer la demande. */
  entite: EntiteChoisissable | null;
};

export default function DemandeTarif({ dossier, entite }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);

  const resultat = useMemo(
    () =>
      demandePourDossier({
        mission: {
          secteurSlug: dossier.mission.secteurSlug,
          adresse: dossier.mission.adresse,
          codePostal: dossier.mission.codePostal,
          ville: dossier.mission.ville,
          surfaceM2: dossier.mission.surfaceM2,
          volumeDebarras: dossier.mission.volumeDebarras,
          niveauDifficulte: dossier.mission.niveauDifficulte,
          dateSouhaitee: dossier.mission.dateSouhaitee,
          // Niveau et ascenseur : autorisés depuis l'arbitrage du 2026-11-06,
          // parce qu'ils situent un EFFORT, pas une personne. L'étage est
          // filtré par `etageLogistique()` — seul un niveau reconnu sort.
          etage: dossier.mission.etage,
          ascenseur: dossier.mission.ascenseur,
          acces: dossier.mission.acces,
          consignes: dossier.mission.consignes,
        },
        client: {
          nom: dossier.client.nom,
          prenom: dossier.client.prenom,
          societe: dossier.client.societe,
          telephone: dossier.client.telephone,
          email: dossier.client.email,
          adresse: dossier.client.adresse,
          codePostal: dossier.client.codePostal,
          ville: dossier.client.ville,
        },
        // Prestations RECONNUES au devis signé. Les lignes non reconnues sont
        // volontairement écartées : elles sont « à vérifier », et une demande
        // de tarif ne doit pas porter une prestation incertaine.
        prestations: dossier.reprise.correspondances.map((c) => ({ label: c.prestation })),
        signatureEntite: entite?.legal_name ?? null,
      }),
    [dossier, entite],
  );

  const texteComplet = resultat.ok
    ? `${resultat.demande.objet}\n\n${resultat.demande.corps}`
    : "";

  function copier() {
    if (!texteComplet) return;
    navigator.clipboard?.writeText(texteComplet).then(
      () => { setCopie(true); window.setTimeout(() => setCopie(false), 2500); },
      () => setCopie(false),
    );
  }

  return (
    <section className={styles.card} style={{ marginTop: "var(--sp-4)" }}>
      <h3 className={styles.h3}>Demande de tarif aux prestataires</h3>

      {!resultat.ok ? (
        <>
          <p className={styles.warn}>
            Demande non préparée : {resultat.raison}.
          </p>
          {resultat.fuites.length > 0 && (
            <ul className={styles.muted} style={{ margin: "var(--sp-2) 0 0", paddingLeft: "1.2em" }}>
              {resultat.fuites.map((f, i) => (
                <li key={i}>
                  <strong>{f.champ}</strong> apparaît dans le texte : « {f.extrait} »
                </li>
              ))}
            </ul>
          )}
          <p className={styles.muted} style={{ marginTop: "var(--sp-2)" }}>
            Rien n&apos;est proposé plutôt qu&apos;un texte qui laisserait sortir une
            information confidentielle du dossier.
          </p>
        </>
      ) : (
        <>
          <p className={styles.muted}>
            Prête à être envoyée à plusieurs prestataires. Elle ne contient ni
            l&apos;adresse complète, ni le nom du client, ni ses coordonnées, ni le
            numéro d&apos;appartement, ni le prix de vente — seuls le code postal et
            la ville. Le niveau et l&apos;ascenseur y figurent : sans eux, le
            prestataire ne peut pas chiffrer l&apos;accès.
          </p>

          {resultat.demande.manquant.length > 0 && (
            <p className={styles.warn} style={{ marginTop: "var(--sp-2)" }}>
              Absent de la découverte, donc non mentionné :{" "}
              {resultat.demande.manquant.join(", ")}.
            </p>
          )}

          <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginTop: "var(--sp-3)" }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setOuvert((o) => !o)}
              aria-expanded={ouvert}
            >
              <Icon name="document" size={14} />
              {ouvert ? "Masquer le texte" : "Voir le texte"}
            </button>
            <button type="button" className={styles.btnPrimary} onClick={copier}>
              <Icon name={copie ? "check" : "mail"} size={14} />
              {copie ? "Copié" : "Copier la demande"}
            </button>
          </div>

          {ouvert && (
            <>
              <p className={styles.muted} style={{ marginTop: "var(--sp-3)", marginBottom: "var(--sp-1)" }}>
                <strong>Objet :</strong> {resultat.demande.objet}
              </p>
              {/* Modifiable : la planificatrice ajuste avant d'envoyer. Le
                  contrôle de fuite a porté sur le texte généré ; une retouche
                  manuelle reste sous sa responsabilité, comme un e-mail
                  qu'elle écrirait elle-même. */}
              <textarea
                readOnly
                value={texteComplet}
                rows={18}
                className={styles.preLigne}
                style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "0.82rem", lineHeight: 1.6 }}
                aria-label="Texte de la demande de tarif"
              />
            </>
          )}

          <p className={styles.muted} style={{ marginTop: "var(--sp-2)" }}>
            Aucun e-mail n&apos;est envoyé par le CRM : copiez le texte dans votre
            messagerie.
          </p>
        </>
      )}
    </section>
  );
}
