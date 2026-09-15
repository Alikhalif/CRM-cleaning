import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import type { ClientIntervention } from "@/lib/documents/contracts-server";
import styles from "./ClientDetail.module.scss";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const fmt = (d: string | null) => (d ? DATE.format(new Date(d)) : "—");

const DOSSIER_STATUS_LABEL: Record<string, string> = {
  a_planifier: "À planifier",
  planifie: "Planifié",
  en_cours: "En cours",
  finalise: "Finalisé",
  solde: "Soldé",
};

// Interventions du client (dossiers de son lead) + accès au certificat hotte.
// La génération réutilise le module existant : lien vers /certificat-hotte?dossier=…
// (aucune modification du flux certificat).
export default function ClientInterventions({ interventions }: { interventions: ClientIntervention[] }) {
  if (interventions.length === 0) return null;
  return (
    <section className={styles.card}>
      <h2 className={styles.h2}>
        Interventions &amp; certificats
        <span className={styles.h2Count}>{interventions.length}</span>
      </h2>
      <ul className={styles.docList}>
        {interventions.map((it) => (
          <li key={it.dossierId} className={styles.docItem}>
            <span className={styles.docIcon}><Icon name="planification" size={16} /></span>
            <div className={styles.docBody}>
              <div className={styles.docTitleRow}>
                <span className={styles.docTitle}>
                  Intervention {it.realizedAt ? `réalisée le ${fmt(it.realizedAt)}` : it.plannedAt ? `du ${fmt(it.plannedAt)}` : ""}
                </span>
                <span className={styles.docCat}>{DOSSIER_STATUS_LABEL[it.status] ?? it.status}</span>
                {it.hasCert && <span className={styles.docSigned}><Icon name="check" size={11} /> Certificat {it.certNumero}</span>}
              </div>
              {it.technicianName && <div className={styles.docMeta}><span>Technicien : {it.technicianName}</span></div>}
            </div>
            <div className={styles.docActions}>
              <Link
                href={`/certificat-hotte?dossier=${it.dossierId}`}
                className={styles.ctBtn}
                title={it.hasCert ? "Voir / renvoyer le certificat" : "Générer le certificat hotte"}
              >
                <Icon name="document" size={15} />
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.uploadHint}>Le certificat de conformité hotte est pré-rempli automatiquement depuis l&apos;intervention.</p>
    </section>
  );
}
