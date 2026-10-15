import { Suspense } from "react";
import SuiviCommercial from "./SuiviCommercial";
import Supervision from "./Supervision";
import styles from "./Leads.module.scss";
import { getSuiviData } from "@/lib/suivi-server";
import { getSupervisionData, getSupervisionScope, type Periode } from "@/lib/supervision-server";

export const metadata = { title: "Suivi commercial" };

// Deux interfaces, un seul module — elles ne s'adressent pas aux mêmes gens.
//
//   • Commercial  → espace de TRAVAIL : ses dossiers, classés par étape, avec
//     les actions pour avancer jusqu'à la signature.
//   • Super Admin / Superviseur → COCKPIT de supervision : indicateurs, alertes,
//     performances par commercial, pays et activité. On y lit une situation,
//     on n'y traite pas de dossier.
//
// La route reste /leads : des dizaines de liens pointent vers /leads/[id].
//
// Tout le filtrage (propriétaire, activités, périmètre du superviseur) est fait
// côté serveur — les lignes hors périmètre ne sont pas envoyées au navigateur.

const PERIODES_VALIDES = ["today", "yesterday", "7d", "30d", "mtd"];

export default async function SuiviCommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  // Un superviseur (ou le Super Admin) reçoit le cockpit ; tout autre rôle
  // reçoit son espace de travail.
  const scope = await getSupervisionScope();

  if (scope) {
    const { periode: brut } = await searchParams;
    const periode = (PERIODES_VALIDES.includes(brut ?? "") ? brut : "30d") as Periode;
    const data = await getSupervisionData(periode);
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Supervision commerciale</h1>
            <p className={styles.subtitle}>
              Comprendre la situation sans ouvrir un dossier — indicateurs, anomalies, performances.
            </p>
          </div>
        </header>
        {data && (
          <Suspense fallback={null}>
            <Supervision data={data} />
          </Suspense>
        )}
      </div>
    );
  }

  const data = await getSuiviData();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Suivi commercial</h1>
          <p className={styles.subtitle}>
            Un dossier, une situation, une prochaine action — du premier appel à la signature.
          </p>
        </div>
      </header>
      <SuiviCommercial {...data} />
    </div>
  );
}
