import { Suspense } from "react";
import SuiviCommercial from "./SuiviCommercial";
import Supervision from "./Supervision";
import styles from "./Leads.module.scss";
import { getSuiviData } from "@/lib/suivi-server";
import { getSupervisionData, type Periode } from "@/lib/supervision-server";
import { getPerimetreSuperviseur } from "@/lib/supervision-perimetre-server";
import { getDevisARealiserCount } from "@/lib/devis-a-realiser/server";
import BoutonDevisARealiser from "@/components/DevisARealiser/BoutonDevisARealiser";

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
  const perimetre = await getPerimetreSuperviseur();

  if (perimetre) {
    const { periode: brut } = await searchParams;
    const periode = (PERIODES_VALIDES.includes(brut ?? "") ? brut : "30d") as Periode;
    const [data, devis] = await Promise.all([
      getSupervisionData(periode),
      getDevisARealiserCount(),
    ]);
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Supervision commerciale</h1>
            <p className={styles.subtitle}>
              Comprendre la situation sans ouvrir un dossier — indicateurs, anomalies, performances.
            </p>
          </div>
          <BoutonDevisARealiser total={devis.total} enRetard={devis.enRetard} />
        </header>
        {/* Périmètre non configuré = AUCUN accès (décision client « Option A »).
            On le dit explicitement : un cockpit vide sans explication ferait
            croire à une panne, et le superviseur appellerait le support au lieu
            du Super Admin. */}
        {data && !data.configure ? (
          <PerimetreNonConfigure />
        ) : (
          data && (
            <Suspense fallback={null}>
              <Supervision data={data} />
            </Suspense>
          )
        )}
      </div>
    );
  }

  const [data, devis] = await Promise.all([getSuiviData(), getDevisARealiserCount()]);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Suivi commercial</h1>
          <p className={styles.subtitle}>
            Un dossier, une situation, une prochaine action — du premier appel à la signature.
          </p>
        </div>
        {/* §2 — le compteur est visible là où le commercial travaille, pas
            seulement sur une page dédiée qu'il faudrait penser à ouvrir. */}
        <BoutonDevisARealiser total={devis.total} enRetard={devis.enRetard} />
      </header>
      <SuiviCommercial {...data} />
    </div>
  );
}

// Écran du superviseur dont le périmètre n'a pas encore été attribué.
//
// Volontairement sans chiffre et sans lien vers un dossier : tant que le Super
// Admin n'a rien accordé, il n'y a RIEN à montrer — pas même un total.
function PerimetreNonConfigure() {
  return (
    <div
      style={{
        margin: "0 var(--sp-6) var(--sp-6)",
        padding: "var(--sp-6)",
        border: "1px solid var(--border-subtle)",
        borderLeft: "3px solid var(--tone-warning)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        maxWidth: 680,
      }}
    >
      <strong style={{ color: "var(--text-primary)" }}>Périmètre de supervision non configuré</strong>
      <p style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Votre compte porte le rôle Superviseur, mais aucun périmètre ne lui a encore été attribué.
        Tant que c&apos;est le cas, aucune donnée commerciale ne vous est accessible — ce n&apos;est pas
        une panne, c&apos;est la règle de sécurité du module.
      </p>
      <p style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Demandez au Super Admin de définir vos <strong>pays</strong>, vos <strong>activités</strong>,
        les <strong>commerciaux</strong> que vous supervisez et vos <strong>droits d&apos;intervention</strong>.
      </p>
    </div>
  );
}
