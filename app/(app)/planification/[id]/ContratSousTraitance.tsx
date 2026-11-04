"use client";

// Bloc « Contrat de sous-traitance » du dossier d'intervention.
//
// C'est le parcours demandé, dans l'ordre : prestataire → entité émettrice →
// tarif négocié → modèle parmi les neuf → génération → prévisualisation →
// signature → archivage.
//
// ⚠️ LE PRIX CLIENT N'EST PAS DANS CE COMPOSANT. Il n'est pas affiché, pas
// reçu en props, pas calculé. La planificatrice saisit le tarif du
// sous-traitant à la main ; aucun pourcentage n'est proposé, aucun montant
// prérempli depuis le devis. C'est l'exigence du §6, et la seule façon de la
// tenir est qu'il n'existe aucun chemin de données entre les deux.

import { useMemo, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  calculerTotaux,
  lignesDepuisCodes,
  MODE_PRIX_LABEL,
  saisieVide,
  type LignePrestation,
  type ModePrix,
  type SaisieMontants,
} from "@/lib/sous-traitance/montants";
import { UNITE_LABEL, type Unite } from "@/lib/sous-traitance/prestations";
import type { ModeleContrat } from "@/lib/sous-traitance/clauses";
import {
  STATUT_CONTRAT_LABEL,
  classerPrestataires,
  estFige,
  type ContratResume,
  type DocumentAssemble,
  type DossierContrat,
  type EntiteChoisissable,
  type OptionModele,
  type PrestataireChoisissable,
} from "@/lib/sous-traitance/contrats-shared";
import {
  annulerContrat,
  assemblerDocument,
  emettreContrat,
  enregistrerContrat,
  envoyerEnSignature,
  resynchroniserSignature,
  urlPieceArchivee,
} from "./actions";
import type { EtatConnexion, SignatureContrat } from "@/lib/docusign/vues";
import styles from "./DossierDetail.module.scss";

type Props = {
  dossier: DossierContrat;
  prestataires: PrestataireChoisissable[];
  entites: EntiteChoisissable[];
  modeles: OptionModele[];
  contrats: ContratResume[];
  /** État du raccordement DocuSign, par entité juridique (§6). */
  etatsDocuSign: Record<string, EtatConnexion>;
  /** Signatures en cours ou achevées, par contrat. */
  signatures: SignatureContrat[];
};

const euros = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function ContratSousTraitance({
  dossier, prestataires, entites, modeles, contrats, etatsDocuSign, signatures,
}: Props) {
  // Le contrat déjà engagé sur ce dossier, s'il existe.
  const engage = contrats.find((c) => estFige(c.statut));
  const brouillon = contrats.find((c) => ["brouillon", "pret_a_envoyer", "a_completer"].includes(c.statut));

  const [technicianId, setTechnicianId] = useState(
    brouillon?.technicianId ?? dossier.technicianIdAffecte ?? "",
  );
  const [entityId, setEntityId] = useState(brouillon?.entityId ?? "");
  const [modele, setModele] = useState<ModeleContrat | "">(
    brouillon?.modele ?? dossier.modeleSuggere ?? "",
  );
  const [formeJuridique, setFormeJuridique] = useState("");
  const [qualiteRepresentant, setQualiteRepresentant] = useState("");

  // Chiffrage : les lignes partent des prestations reconnues sur le devis,
  // SANS PRIX. Les prix se négocient, le CRM n'en propose aucun.
  const [montants, setMontants] = useState<SaisieMontants>(() => ({
    ...saisieVide("detaille"),
    lignes: lignesDepuisCodes(dossier.reprise.codes),
  }));

  const [apercu, setApercu] = useState<DocumentAssemble | null>(null);
  const [apercuId, setApercuId] = useState<string | null>(brouillon?.id ?? null);
  const [onglet, setOnglet] = useState<"contrat" | "mission" | "rapport">("contrat");
  const [message, setMessage] = useState<{ ton: "ok" | "ko" | "info"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const signatureDe = (contractId: string): SignatureContrat | null =>
    signatures.find((s) => s.contractId === contractId) ?? null;

  // Raccordement de l'entité SÉLECTIONNÉE : c'est lui qui décide si le bouton
  // d'envoi peut être actif (§6). Montrer un bouton qui échouerait à l'appel
  // serait pire que l'absence de bouton.
  const docusign = entityId ? etatsDocuSign[entityId] ?? null : null;
  const configGlobale = Object.values(etatsDocuSign)[0] ?? null;

  function onResynchroniser(envelopeId: string) {
    demarrer(async () => {
      setMessage(null);
      const r = await resynchroniserSignature(envelopeId);
      setMessage(r.ok
        ? { ton: "ok", texte: r.message ?? "État mis à jour." }
        : { ton: "ko", texte: r.error });
    });
  }

  function onTelecharger(storagePath: string) {
    demarrer(async () => {
      setMessage(null);
      const r = await urlPieceArchivee(storagePath);
      if (!r.ok) { setMessage({ ton: "ko", texte: r.error }); return; }
      // URL signée, valable une heure : on l'ouvre sans jamais la conserver.
      window.open(r.url, "_blank", "noopener,noreferrer");
    });
  }

  const prestataire = prestataires.find((p) => p.technicianId === technicianId) ?? null;
  const entite = entites.find((e) => e.id === entityId) ?? null;

  // ── Recherche des prestataires référencés ────────────────────────────
  //
  // Classement sur ce qui est RÉELLEMENT en base : activité couverte,
  // département d'intervention, dossier administratif, historique. Rien sur la
  // disponibilité — le CRM n'a aucun calendrier de sous-traitant, et inventer
  // un « disponible » serait pire que de ne rien dire.
  const classes = useMemo(
    () => classerPrestataires(prestataires, {
      secteur: dossier.mission.secteurSlug,
      codePostal: dossier.mission.codePostal || dossier.client.codePostal,
    }),
    [prestataires, dossier.mission.secteurSlug, dossier.mission.codePostal, dossier.client.codePostal],
  );
  const correspondants = classes.filter((x) => x.corr.correspond);
  const autres = classes.filter((x) => !x.corr.correspond);
  const correspondanceChoisie = classes.find(
    (x) => x.prestataire.technicianId === technicianId,
  )?.corr ?? null;
  const optionModele = modeles.find((m) => m.valeur === modele) ?? null;
  const totaux = useMemo(() => calculerTotaux(montants), [montants]);

  // Ce qui bloque l'enregistrement, dit explicitement plutôt que par un
  // bouton grisé sans explication.
  const blocages: string[] = [];
  if (!technicianId) blocages.push("sélectionner le sous-traitant");
  if (!entityId) blocages.push("sélectionner l'entité juridique émettrice");
  if (!modele) blocages.push("sélectionner le modèle de contrat");
  if (optionModele && !optionModele.emissible) blocages.push("choisir un modèle dont le texte est disponible");
  if (entite && !entite.utilisable) blocages.push(`compléter l'entité (${entite.manquants.join(", ")})`);
  if (prestataire && !prestataire.utilisable) blocages.push(`compléter la fiche du prestataire (${prestataire.manquants.join(", ")})`);
  if (totaux.totalHt <= 0) blocages.push("renseigner le tarif du sous-traitant");

  function majLigne(i: number, patch: Partial<LignePrestation>) {
    setMontants((m) => ({ ...m, lignes: m.lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  }

  async function enregistrer(): Promise<string | null> {
    if (!technicianId || !entityId || !modele) return null;
    const r = await enregistrerContrat({
      dossierId: dossier.dossierId,
      technicianId,
      entityId,
      modele: modele as ModeleContrat,
      montants,
      complements: {
        prestataireFormeJuridique: formeJuridique,
        prestataireQualiteRepresentant: qualiteRepresentant,
      },
    });
    if (!r.ok) { setMessage({ ton: "ko", texte: r.error }); return null; }
    return r.id ?? null;
  }

  function onEnregistrer() {
    demarrer(async () => {
      setMessage(null);
      const id = await enregistrer();
      if (id) setMessage({ ton: "ok", texte: "Tarif et sélection enregistrés." });
    });
  }

  function onPrevisualiser() {
    demarrer(async () => {
      setMessage(null);
      const id = brouillon?.id ?? (await enregistrer());
      if (!id) return;
      const r = await assemblerDocument(id);
      if (!r.ok) { setMessage({ ton: "ko", texte: r.error }); return; }
      setApercuId(id);
      setApercu(r.document);
      if (r.document.manquantes.length > 0) {
        setMessage({
          ton: "info",
          texte: "Aperçu affiché. Informations obligatoires encore manquantes : "
            + r.document.manquantes.map((m) => m.libelle).join(", ") + ".",
        });
      }
    });
  }

  function onGenerer() {
    demarrer(async () => {
      setMessage(null);
      const id = brouillon?.id ?? (await enregistrer());
      if (!id) return;
      const r = await emettreContrat(id);
      setMessage(r.ok
        ? { ton: "ok", texte: r.message ?? "Contrat généré." }
        : { ton: "ko", texte: r.error });
    });
  }

  function onEnvoyer(contratId: string) {
    demarrer(async () => {
      setMessage(null);
      const r = await envoyerEnSignature(contratId);
      setMessage(r.ok
        ? { ton: "ok", texte: r.message ?? "Envoyé." }
        : { ton: "ko", texte: r.error });
    });
  }

  function onAnnuler(contratId: string) {
    const motif = window.prompt("Motif d'annulation du contrat ?");
    if (!motif) return;
    demarrer(async () => {
      const r = await annulerContrat(contratId, motif);
      setMessage(r.ok
        ? { ton: "ok", texte: "Contrat annulé." }
        : { ton: "ko", texte: r.error });
    });
  }

  return (
    <section className={styles.card} aria-labelledby="h-contrat">
      <h2 id="h-contrat" className={styles.h2}>
        <Icon name="subcontractor" size={16} /> Contrat de sous-traitance
      </h2>

      {message && (
        <p
          className={
            message.ton === "ok" ? styles.ok : message.ton === "ko" ? styles.error : styles.info
          }
          role="status"
        >
          {message.texte}
        </p>
      )}

      {/* ── État du raccordement DocuSign (§6) ─────────────────────── */}
      {configGlobale && !configGlobale.configure && (
        <p className={styles.warn}>
          <strong>Signature électronique non configurée.</strong> Variables absentes :{" "}
          {configGlobale.manquant.join(", ")}. Les contrats se génèrent et se
          téléchargent, mais aucun envoi en signature n&apos;est possible.
        </p>
      )}
      {configGlobale?.configure && !configGlobale.chiffrementActif && (
        <p className={styles.error}>
          <strong>FIELD_ENCRYPTION_KEY absente.</strong> Le raccordement DocuSign est
          refusé : les jetons ne pourraient pas être chiffrés.
        </p>
      )}
      {configGlobale?.configure && configGlobale.chiffrementActif && entityId && docusign && (
        docusign.connecte ? (
          <p className={styles.info}>
            DocuSign raccordé — compte {docusign.compte} ·{" "}
            environnement <strong>{docusign.environnement === "demo" ? "bac à sable" : "production"}</strong>
            {docusign.joursAvantReautorisation != null && docusign.joursAvantReautorisation <= 7
              ? ` · ⚠️ réautorisation nécessaire dans ${docusign.joursAvantReautorisation} jour(s)`
              : ""}
          </p>
        ) : (
          <p className={styles.warn}>
            L&apos;entité sélectionnée n&apos;est pas raccordée à DocuSign
            {docusign.derniereErreur ? ` (${docusign.derniereErreur})` : ""}. Un Super
            Admin doit l&apos;autoriser depuis Réglages › Sociétés. Le contrat peut être
            généré et téléchargé en attendant.
          </p>
        )
      )}

      {/* ── Contrats déjà émis ──────────────────────────────────────── */}
      {contrats.length > 0 && (
        <div className={styles.contratList}>
          {contrats.map((c) => (
            <div key={c.id} className={styles.contratRow}>
              <div className={styles.contratMain}>
                <span className={styles.contratRef}>{c.ref ?? "sans numéro"}</span>
                <span className={styles.contratMeta}>
                  {c.modeleLabel} · version {c.modeleVersion}
                  {c.technicianNom ? ` · ${c.technicianNom}` : ""}
                  {c.entityNom ? ` · émis par ${c.entityNom}` : ""}
                </span>
                <span className={styles.contratMeta}>
                  {euros(c.totalHt)} HT
                  {c.totalTtc != null ? ` · ${euros(c.totalTtc)} TTC` : " · TVA à déterminer"}
                </span>
              </div>
              <div className={styles.contratActions}>
                <span className={styles.badge} data-statut={c.statut}>
                  {STATUT_CONTRAT_LABEL[c.statut] ?? c.statut}
                </span>
                <a
                  className={styles.link}
                  href={`/api/sous-traitance/contrats/${c.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="document" size={14} /> PDF
                </a>
                {/* L'envoi n'est proposé que si l'entité est RÉELLEMENT
                    raccordée et qu'aucune enveloppe n'est déjà en cours. */}
                {["pret_a_envoyer"].includes(c.statut) && !signatureDe(c.id) && (
                  <button
                    type="button" className={styles.link}
                    onClick={() => onEnvoyer(c.id)}
                    disabled={enCours || !(c.entityId && etatsDocuSign[c.entityId]?.connecte)}
                    title={
                      c.entityId && etatsDocuSign[c.entityId]?.connecte
                        ? "Créer l'enveloppe DocuSign et l'envoyer aux deux signataires"
                        : "Entité non raccordée à DocuSign"
                    }
                  >
                    Envoyer à la signature
                  </button>
                )}
                {c.statut !== "signe" && c.statut !== "annule" && (
                  <button type="button" className={styles.danger} onClick={() => onAnnuler(c.id)} disabled={enCours}>
                    Annuler
                  </button>
                )}
              </div>

              {/* ── État de la signature électronique ──────────────── */}
              {(() => {
                const sig = signatureDe(c.id);
                if (!sig) return null;
                return (
                  <div className={styles.signature} data-ton={sig.ton}>
                    <div className={styles.signatureHaut}>
                      <span className={styles.signatureStatut} data-ton={sig.ton}>
                        {sig.statutLabel}
                      </span>
                      <span className={styles.contratMeta}>
                        DocuSign · {sig.envelopeId}
                      </span>
                      <button
                        type="button" className={styles.link}
                        onClick={() => onResynchroniser(sig.envelopeId)}
                        disabled={enCours}
                        title="Relire l'état réel chez DocuSign"
                      >
                        Actualiser
                      </button>
                    </div>

                    {sig.signataires.length > 0 && (
                      <ul className={styles.signataires}>
                        {sig.signataires.map((s) => (
                          <li key={s.email}>
                            <strong>{s.nom ?? s.email}</strong>
                            <span className={styles.contratMeta}>
                              {" "}· {s.statut}
                              {s.signeLe ? ` le ${new Date(s.signeLe).toLocaleString("fr-FR")}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {sig.archiveLe ? (
                      <div className={styles.contratActions}>
                        {sig.pieces.map((piece) => (
                          <button
                            key={piece.id} type="button" className={styles.link}
                            onClick={() => onTelecharger(piece.storagePath)}
                            disabled={enCours}
                          >
                            <Icon name="document" size={14} />{" "}
                            {piece.documentType === "certificat_signature"
                              ? "Certificat de signature"
                              : "Contrat signé"}
                          </button>
                        ))}
                      </div>
                    ) : sig.statut === "signe_toutes_parties" ? (
                      <p className={styles.warn}>
                        Signé chez DocuSign, archivage en cours. Les pièces apparaîtront
                        ici dès leur téléchargement.
                        {sig.archivageErreur ? ` Dernière erreur : ${sig.archivageErreur}` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {engage ? (
        <p className={styles.info}>
          Un contrat est engagé sur ce dossier. Pour en modifier le périmètre ou le
          montant, passez par un avenant — un contrat envoyé ou signé n&apos;est jamais
          réécrit.
        </p>
      ) : (
        <>
          {/* ── 1. Le sous-traitant ─────────────────────────────────── */}
          <h3 className={styles.h3}>1 · Sous-traitant</h3>
          <div className={styles.formGrid}>
            <label>
              Prestataire
              {/* Les prestataires qui couvrent l'activité ET le département du
                  chantier remontent en tête, avec le motif du classement.
                  Aucun n'est masqué : une fiche incomplète se complète, elle
                  ne doit pas disparaître de la liste. */}
              <select
                className={styles.select}
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {correspondants.length > 0 && (
                  <optgroup label="Correspondent à la mission">
                    {correspondants.map(({ prestataire: p, corr }) => (
                      <option key={p.technicianId} value={p.technicianId}>
                        {p.raisonSociale ?? p.nom}
                        {corr.motifs.length ? ` — ${corr.motifs.join(", ")}` : ""}
                        {p.utilisable ? "" : " · fiche incomplète"}
                      </option>
                    ))}
                  </optgroup>
                )}
                {autres.length > 0 && (
                  <optgroup label="Autres prestataires référencés">
                    {autres.map(({ prestataire: p, corr }) => (
                      <option key={p.technicianId} value={p.technicianId}>
                        {p.raisonSociale ?? p.nom}
                        {corr.motifs.length ? ` — ${corr.motifs.join(", ")}` : ""}
                        {p.utilisable ? "" : " · fiche incomplète"}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            <label>
              Forme juridique
              <input
                value={formeJuridique}
                onChange={(e) => setFormeJuridique(e.target.value)}
                placeholder="SARL, SAS, EI…"
              />
            </label>
            <label>
              Qualité du représentant
              <input
                value={qualiteRepresentant}
                onChange={(e) => setQualiteRepresentant(e.target.value)}
                placeholder="Gérant, Président…"
              />
            </label>
          </div>
          {prestataire && (
            <dl className={styles.readGrid}>
              <div>
                <dt className={styles.k}>SIRET</dt>
                <dd className={styles.v}>{prestataire.siret ?? <span className={styles.vide}>—</span>}</dd>
              </div>
              <div>
                <dt className={styles.k}>Siège</dt>
                <dd className={styles.v}>{prestataire.adresse ?? <span className={styles.vide}>—</span>}</dd>
              </div>
              <div>
                <dt className={styles.k}>Représentant légal</dt>
                <dd className={styles.v}>{prestataire.dirigeant ?? <span className={styles.vide}>—</span>}</dd>
              </div>
              <div>
                <dt className={styles.k}>Courriel</dt>
                <dd className={styles.v}>{prestataire.email ?? <span className={styles.vide}>—</span>}</dd>
              </div>
              <div>
                <dt className={styles.k}>Téléphone</dt>
                <dd className={styles.v}>{prestataire.telephone ?? <span className={styles.vide}>—</span>}</dd>
              </div>
              {/* Activités, zone et compétences : lues sur la fiche technicien,
                  où elles étaient déjà saisies sans jamais être affichées ici. */}
              <div>
                <dt className={styles.k}>Activités couvertes</dt>
                <dd className={styles.v}>
                  {prestataire.secteurs.length > 0
                    ? prestataire.secteurs.join(", ")
                    : <span className={styles.vide}>aucune déclarée</span>}
                </dd>
              </div>
              <div>
                <dt className={styles.k}>Secteur géographique</dt>
                <dd className={styles.v}>
                  {prestataire.departements.length > 0
                    ? `départements ${prestataire.departements.join(", ")}`
                    : prestataire.codePostalBase
                      ? `rattaché au ${prestataire.codePostalBase}`
                      : <span className={styles.vide}>aucun déclaré</span>}
                </dd>
              </div>
              {prestataire.competences.length > 0 && (
                <div>
                  <dt className={styles.k}>Compétences</dt>
                  <dd className={styles.v}>{prestataire.competences.join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className={styles.k}>Historique</dt>
                <dd className={styles.v}>
                  {prestataire.nbInterventions > 0
                    ? `${prestataire.nbInterventions} intervention${prestataire.nbInterventions > 1 ? "s" : ""} confiée${prestataire.nbInterventions > 1 ? "s" : ""}`
                    : <span className={styles.vide}>jamais encore missionné</span>}
                </dd>
              </div>
              <div>
                <dt className={styles.k}>Correspondance mission</dt>
                <dd className={styles.v}>
                  {correspondanceChoisie?.correspond
                    ? "Activité et secteur couverts"
                    : correspondanceChoisie?.motifs.length
                      ? correspondanceChoisie.motifs.join(" · ")
                      : <span className={styles.vide}>non vérifiable</span>}
                </dd>
              </div>
              <div>
                <dt className={styles.k}>Statut administratif</dt>
                <dd className={styles.v}>
                  {prestataire.utilisable
                    ? "Dossier complet"
                    : `À compléter : ${prestataire.manquants.join(", ")}`}
                </dd>
              </div>
            </dl>
          )}
          {/* La disponibilité n'est PAS affichée : le CRM ne porte aucun
              calendrier de sous-traitant. L'annoncer serait une invention. */}
          {prestataire && (
            <p className={styles.muted}>
              La disponibilité n&apos;est pas suivie dans le CRM : à confirmer
              auprès du prestataire avant d&apos;émettre le contrat.
            </p>
          )}
          {prestataire && !prestataire.utilisable && (
            <p className={styles.warn}>
              Fiche incomplète : {prestataire.manquants.join(", ")}. À compléter dans la
              bibliothèque des sous-traitants avant d&apos;émettre le contrat.
            </p>
          )}

          {/* ── 2. L'entité émettrice ───────────────────────────────── */}
          <h3 className={styles.h3}>2 · Entité juridique donneuse d&apos;ordre</h3>
          <div className={styles.formGrid}>
            <label>
              Société émettrice <span className={styles.req}>obligatoire</span>
              <select
                className={styles.select}
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {entites.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.legal_name ?? "sans dénomination"}
                    {e.country && e.country !== "FR" ? ` · ${e.country}` : ""}
                    {e.utilisable ? "" : " (incomplète)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {entite && !entite.utilisable && (
            <p className={styles.warn}>
              Cette entité ne peut pas signer : il manque {entite.manquants.join(", ")}.
              Le contrat porterait « [à compléter] » là où la loi attend l&apos;identité du
              signataire. À compléter dans Réglages › Sociétés.
            </p>
          )}

          {/* ── 3. Le tarif ─────────────────────────────────────────── */}
          <h3 className={styles.h3}>3 · Tarif convenu avec le sous-traitant</h3>
          <p className={styles.muted}>
            Montant négocié avec le prestataire. Il est indépendant du prix facturé au
            client, qui n&apos;apparaît ni ici ni dans le contrat.
          </p>
          <div className={styles.formGrid}>
            <label>
              Mode
              <select
                className={styles.select}
                value={montants.mode}
                onChange={(e) => setMontants((m) => ({ ...m, mode: e.target.value as ModePrix }))}
              >
                {(Object.keys(MODE_PRIX_LABEL) as ModePrix[]).map((k) => (
                  <option key={k} value={k}>{MODE_PRIX_LABEL[k]}</option>
                ))}
              </select>
            </label>
            {montants.mode === "forfait" && (
              <label>
                Forfait global HT
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={montants.forfaitHt ?? ""}
                  onChange={(e) =>
                    setMontants((m) => ({
                      ...m,
                      forfaitHt: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </label>
            )}
            <label>
              Taux de TVA (%)
              <input
                type="number" min="0" step="0.1" inputMode="decimal"
                value={montants.tauxTva ?? ""}
                placeholder="à déterminer"
                onChange={(e) =>
                  setMontants((m) => ({
                    ...m,
                    tauxTva: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          {montants.mode === "detaille" && (
            <div className={styles.lignes}>
              {montants.lignes.length === 0 && (
                <p className={styles.muted}>
                  Aucune prestation reconnue sur le devis. Ajoutez les lignes à chiffrer.
                </p>
              )}
              {montants.lignes.map((l, i) => (
                <div key={`${l.code ?? "libre"}-${i}`} className={styles.ligne}>
                  <span className={styles.ligneLabel}>{l.label}</span>
                  <label className={styles.ligneChamp}>
                    <span>Qté</span>
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={l.quantite ?? ""}
                      disabled={l.unite === "forfait"}
                      onChange={(e) =>
                        majLigne(i, { quantite: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className={styles.ligneChamp}>
                    <span>Unité</span>
                    <select
                      className={styles.select}
                      value={l.unite}
                      onChange={(e) => majLigne(i, { unite: e.target.value as Unite })}
                    >
                      {(Object.keys(UNITE_LABEL) as Unite[]).map((u) => (
                        <option key={u} value={u}>{UNITE_LABEL[u]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.ligneChamp}>
                    <span>P.U. HT</span>
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={l.prixUnitaireHt ?? ""}
                      onChange={(e) =>
                        majLigne(i, {
                          prixUnitaireHt: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => setMontants((m) => ({ ...m, lignes: m.lignes.filter((_, j) => j !== i) }))}
                    aria-label={`Retirer ${l.label}`}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.link}
                onClick={() =>
                  setMontants((m) => ({
                    ...m,
                    lignes: [...m.lignes, {
                      code: null, label: "Prestation à préciser", quantite: null,
                      unite: "forfait", prixUnitaireHt: null,
                      fournituresIncluses: true, materielInclus: true, aVerifier: true,
                    }],
                  }))
                }
              >
                <Icon name="plus" size={14} /> Ajouter une ligne
              </button>
            </div>
          )}

          <div className={styles.totaux}>
            <span>Total HT <strong>{euros(totaux.totalHt)}</strong></span>
            <span>
              TVA <strong>{totaux.tva == null ? "à déterminer" : euros(totaux.tva)}</strong>
            </span>
            <span>
              Total TTC{" "}
              <strong>{totaux.totalTtc == null ? "à déterminer" : euros(totaux.totalTtc)}</strong>
            </span>
          </div>
          {totaux.incomplets.length > 0 && (
            <ul className={styles.incomplets}>
              {totaux.incomplets.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}

          {/* ── 4. Le modèle, parmi les neuf ────────────────────────── */}
          <h3 className={styles.h3}>4 · Modèle de contrat</h3>
          {dossier.modeleSuggere && (
            <p className={styles.muted}>
              Suggestion du CRM d&apos;après les prestations du devis :{" "}
              {modeles.find((m) => m.valeur === dossier.modeleSuggere)?.label
                ?? "aucun des neuf modèles"}
              . La planificatrice garde le choix final.
            </p>
          )}
          <div className={styles.formGrid}>
            <label className={styles.wide}>
              Contrat
              <select
                className={styles.select}
                value={modele}
                onChange={(e) => setModele(e.target.value as ModeleContrat | "")}
              >
                <option value="">— Sélectionner —</option>
                {modeles.map((m) => (
                  <option key={m.valeur} value={m.valeur} disabled={!m.emissible}>
                    {m.label}
                    {m.emissible ? ` · ${m.nbArticles} articles` : " · texte non disponible"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {optionModele && !optionModele.emissible && (
            <p className={styles.warn}>
              <strong>{optionModele.label}</strong> — {optionModele.motifBlocage}
            </p>
          )}
          {optionModele?.emissible && (
            <p className={styles.muted}>
              {optionModele.titreDocument} · {optionModele.nbArticles} articles, plus les
              deux annexes.
            </p>
          )}

          {dossier.reprise.aVerifier.length > 0 && (
            <p className={styles.warn}>
              {dossier.reprise.aVerifier.length} ligne(s) du devis sans correspondance dans
              la bibliothèque : {dossier.reprise.aVerifier.map((l) => l.label).join(" · ")}.
              Elles ne sont pas écartées — vérifiez qu&apos;elles sont bien couvertes.
            </p>
          )}

          {/* ── 5. Actions ──────────────────────────────────────────── */}
          <h3 className={styles.h3}>5 · Génération et signature</h3>
          {blocages.length > 0 && (
            <p className={styles.warn}>
              Avant de générer : {blocages.join(" · ")}.
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={onEnregistrer} disabled={enCours || !technicianId || !entityId || !modele}>
              Enregistrer le tarif
            </button>
            <button type="button" className={styles.btn} onClick={onPrevisualiser} disabled={enCours || !technicianId || !entityId || !modele}>
              <Icon name="document" size={14} /> Prévisualiser
            </button>
            <button type="button" className={styles.btnPrimary} onClick={onGenerer} disabled={enCours || blocages.length > 0}>
              Générer le contrat
            </button>
          </div>
        </>
      )}

      {/* ── Aperçu ────────────────────────────────────────────────── */}
      {apercu && (
        <div className={styles.apercu}>
          <div className={styles.apercuHead}>
            <h3 className={styles.h3}>{apercu.titre}</h3>
            <span className={styles.apercuActions}>
              {apercuId && (
                <a
                  className={styles.link}
                  href={`/api/sous-traitance/contrats/${apercuId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="document" size={14} /> Ouvrir le PDF
                </a>
              )}
              <button type="button" className={styles.link} onClick={() => setApercu(null)}>
                Fermer l&apos;aperçu
              </button>
            </span>
          </div>
          <div className={styles.tabs} role="tablist">
            {([
              ["contrat", `Contrat · ${apercu.articles.length} articles`],
              ["mission", "Annexe 1 · Bon de mission"],
              ["rapport", "Annexe 2 · Rapport de fin d'intervention"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={onglet === k}
                className={onglet === k ? `${styles.tab} ${styles.tabOn}` : styles.tab}
                onClick={() => setOnglet(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {onglet === "contrat" && (
            <div className={styles.doc}>
              {apercu.articles.map((a) => (
                <article key={a.numero} className={styles.article}>
                  <h4>Article {a.numero} — {a.titre}</h4>
                  <p>{a.corps}</p>
                  {a.reference && <p className={styles.ref}>{a.reference}</p>}
                </article>
              ))}
            </div>
          )}

          {onglet === "mission" && (
            <div className={styles.doc}>
              {apercu.bonMission.blocs.map((b) => (
                <article key={b.titre} className={styles.article}>
                  <h4>{b.titre}</h4>
                  {b.lignes.map((l, i) => <p key={i}>{l}</p>)}
                </article>
              ))}
              {apercu.bonMission.pied.map((l, i) => (
                <p key={i} className={styles.ref}>{l}</p>
              ))}
            </div>
          )}

          {onglet === "rapport" && (
            <div className={styles.doc}>
              <p className={styles.muted}>
                Formulaire remis au prestataire. Il est rempli APRÈS l&apos;intervention :
                une prestation prévue n&apos;est jamais réputée réalisée.
              </p>
              <ol className={styles.rubriques}>
                {apercu.rapport.rubriques.map((r, i) => (
                  <li key={`${r.numero}-${i}`}>
                    {r.numero != null ? `${r.numero}. ` : ""}{r.titre}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
