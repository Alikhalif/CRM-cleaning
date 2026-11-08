"use client";
// Délais d'escalade des actions back-office — Super Admin (2026-11-09).
//
// Une action non traitée dans son délai REMONTE au Super Admin ; elle reste
// ouverte. Les valeurs initiales sont documentées dans le code
// (CONFIG_INITIALE) et rappelées ici ; tout ce qui est saisi est borné par la
// même fonction que celle qu'applique le moteur.
import { useState, useTransition } from "react";
import { enregistrerDelaisEscalade } from "./actions";
import { BORNES, CONFIG_INITIALE, type ConfigEscalade, type TypeAction } from "@/lib/actions-back-office/shared";
import styles from "./Integrations.module.scss";

const LIBELLES: Record<TypeAction, string> = {
  "dossier.a_planifier": "Intervention à planifier",
  "dossier.a_valider": "Intervention terminée, à valider",
  "facture.a_preparer": "Facture finale à préparer",
  "facture.a_emettre": "Facture préparée, à émettre",
  "facture.impayee": "Facture impayée",
  "acompte.impaye": "Acompte impayé",
};

export default function DelaisEscalade({ config }: { config: ConfigEscalade }) {
  const [valeurs, setValeurs] = useState<ConfigEscalade>(config);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const enregistrer = (c: ConfigEscalade) => demarrer(async () => {
    const r = await enregistrerDelaisEscalade(c);
    setMessage(r.ok
      ? { ok: true, texte: "Délais enregistrés et tracés. Ils s'appliquent dès la prochaine évaluation." }
      : { ok: false, texte: r.error });
  });

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Délais d&apos;escalade des actions back-office</h2>
      <p className={styles.cardDesc}>
        Une action attendue (valider une intervention, préparer ou émettre une facture,
        relancer un impayé) reste <strong>ouverte tant qu&apos;elle n&apos;est pas faite</strong>.
        Passé le délai ci-dessous, elle <strong>remonte au Super Admin</strong>. Bornes :
        {" "}{BORNES.heures[0]} à {BORNES.heures[1]} heures.
      </p>
      <table className={styles.tableDelais}>
        <thead>
          <tr><th scope="col">Action</th><th scope="col">Escalade après (heures)</th><th scope="col">Valeur initiale</th></tr>
        </thead>
        <tbody>
          {(Object.keys(LIBELLES) as TypeAction[]).map((t) => (
            <tr key={t}>
              <td data-label="Action">{LIBELLES[t]}</td>
              <td data-label="Escalade après (heures)">
                <input
                  type="number" min={BORNES.heures[0]} max={BORNES.heures[1]} value={valeurs.escaladeHeures[t]}
                  aria-label={`Escalade après, en heures : ${LIBELLES[t]}`}
                  onChange={(e) => setValeurs({ ...valeurs, escaladeHeures: { ...valeurs.escaladeHeures, [t]: Number(e.target.value) } })}
                />
              </td>
              <td data-label="Valeur initiale">{CONFIG_INITIALE.escaladeHeures[t]} h</td>
            </tr>
          ))}
          <tr>
            <td data-label="Action">Facture « impayée » — jours après l&apos;échéance</td>
            <td data-label="Escalade après (heures)">
              <input type="number" min={BORNES.jours[0]} max={BORNES.jours[1]} value={valeurs.factureImpayeeApresEcheanceJours}
                aria-label="Jours après l'échéance avant qu'une facture soit impayée"
                onChange={(e) => setValeurs({ ...valeurs, factureImpayeeApresEcheanceJours: Number(e.target.value) })} />
            </td>
            <td data-label="Valeur initiale">{CONFIG_INITIALE.factureImpayeeApresEcheanceJours} j</td>
          </tr>
          <tr>
            <td data-label="Action">Acompte « impayé » — jours après l&apos;émission</td>
            <td data-label="Escalade après (heures)">
              <input type="number" min={BORNES.jours[0]} max={BORNES.jours[1]} value={valeurs.acompteImpayeApresJours}
                aria-label="Jours après l'émission avant qu'un acompte soit impayé"
                onChange={(e) => setValeurs({ ...valeurs, acompteImpayeApresJours: Number(e.target.value) })} />
            </td>
            <td data-label="Valeur initiale">{CONFIG_INITIALE.acompteImpayeApresJours} j</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.cardActions}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={enCours} onClick={() => enregistrer(valeurs)}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>{" "}
        <button type="button" className={styles.btn} disabled={enCours} onClick={() => { setValeurs(CONFIG_INITIALE); enregistrer(CONFIG_INITIALE); }}>
          Revenir aux valeurs initiales
        </button>
      </p>
      {message && <p className={styles.hint} role="status">{message.ok ? "✓ " : "⚠️ "}{message.texte}</p>}
    </section>
  );
}
