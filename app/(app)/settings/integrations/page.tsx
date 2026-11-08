import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { getCurrentUserProfile } from "@/lib/users-server";
import {
  reglagesMentions, reglagesMentionsParSociete, societesEtPays,
} from "@/lib/generation/mentions-produits-server";
import MentionsProduits from "./MentionsProduits";
import GabaritsDevis from "./GabaritsDevis";
import { lireReglageGabarits } from "@/lib/devis/reglage-gabarits-server";
import { secteursEmployes } from "@/lib/devis/secteurs-server";
import styles from "./Integrations.module.scss";

export const metadata = { title: "Intégrations" };

export default async function IntegrationsPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <nav className={styles.breadcrumb}>
          <Link href="/settings" className={styles.breadcrumbLink}>Paramètres</Link>
          <span aria-hidden="true">/</span>
          <span>Intégrations</span>
        </nav>
        <h1 className={styles.title}>Intégrations</h1>
        <div className={styles.denied} role="alert">
          <Icon name="alert" size={16} />
          <div>
            <strong>Accès refusé.</strong> Cette page est réservée aux administrateurs.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/settings" className={styles.breadcrumbLink}>Paramètres</Link>
        <span aria-hidden="true">/</span>
        <span>Intégrations</span>
      </nav>

      <header className={styles.header}>
        <h1 className={styles.title}>Intégrations</h1>
        <p className={styles.subtitle}>
          Activez ou désactivez les flux automatiques sans redéployer.
        </p>
      </header>

      {/* La bascule « Séquence n8n (WF2) » a été retirée le 2026-11-04 avec
          l'envoi automatique des devis. On conserve la page et une note
          explicite plutôt qu'un écran vide : un administrateur qui vient y
          chercher le réglage doit comprendre qu'il a disparu volontairement. */}
      <MentionsProduits
        reglages={await reglagesMentions()}
        reglagesSocietes={await reglagesMentionsParSociete()}
        societes={await societesEtPays()}
      />

      <GabaritsDevis
        reglages={await lireReglageGabarits()}
        societes={await societesEtPays()}
        secteurs={await secteursEmployes()}
      />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Envoi des devis</h2>
            <p className={styles.cardDesc}>
              Les devis suivent un parcours unique : découverte, préparation,
              validation, puis envoi par le commercial. <strong>Aucun devis ne part
              automatiquement au client</strong>, et il n&apos;y a plus de réglage à
              activer.
            </p>
          </div>
          <span className={`${styles.state} ${styles.stateOff}`} aria-label="Manuel">
            Manuel
          </span>
        </div>
        <p className={styles.hint}>
          L&apos;ancienne séquence de relance automatique à quatre e-mails a été
          retirée. Les relances restent pilotées par le commercial depuis la fiche
          du dossier, et les notifications comme les alertes commerciales
          continuent de fonctionner normalement.
        </p>
      </section>
    </div>
  );
}
