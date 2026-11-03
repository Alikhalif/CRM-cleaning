import { getDevisARealiser } from "@/lib/devis-a-realiser/server";
import DevisARealiser from "./DevisARealiser";
import styles from "./DevisARealiser.module.scss";

export const metadata = { title: "Devis à réaliser" };
// Vue dérivée d'un état qui bouge à chaque envoi de devis : jamais mise en
// cache, sinon le compteur mentirait (§2 — actualisation en temps réel).
export const dynamic = "force-dynamic";

// Tous les dossiers dont la découverte est validée et dont le devis n'est pas
// parti (§1).
//
// AUCUNE GARDE DE RÔLE ICI, et c'est voulu : c'est une vue de travail
// commerciale, en amont de la signature. Le proxy garantit l'authentification,
// la RLS restreint les dossiers à ceux du commercial, et le filtre d'activité
// est appliqué dans `getDevisARealiser()`. La route n'est pas inscrite dans
// `RESTRICTED_MODULES` : le cloisonnement après-signature n'a pas à bouger.

export default async function DevisARealiserPage() {
  const data = await getDevisARealiser();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Devis à réaliser</h1>
          <p className={styles.subtitle}>
            Découverte terminée, devis pas encore envoyé. Un dossier quitte cette
            liste au moment où le devis part réellement — pas avant.
          </p>
        </div>
      </header>
      <DevisARealiser data={data} />
    </div>
  );
}
