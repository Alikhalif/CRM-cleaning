import SuiviCommercial from "./SuiviCommercial";
import styles from "./Leads.module.scss";
import { getSuiviData } from "@/lib/suivi-server";

export const metadata = { title: "Suivi commercial" };

// « Suivi commercial » — remplace l'ancien tableau « Leads & devis ».
//
// La ROUTE reste /leads : des dizaines de liens pointent vers /leads/[id]
// (pipeline, palette ⌘K, notifications, e-mails internes). Changer l'URL les
// aurait tous cassés pour un gain nul — c'est l'onglet et l'interface qui
// changent, pas l'adresse.
//
// Tout le filtrage (propriétaire + activités autorisées) est fait côté serveur
// dans getSuiviData : les dossiers hors périmètre ne sont pas envoyés au
// navigateur. Voir l'avertissement en tête de lib/suivi-server.ts.

export default async function SuiviCommercialPage() {
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
