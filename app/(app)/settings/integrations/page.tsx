import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { getCurrentUserProfile } from "@/lib/users-server";
import { supabaseServer } from "@/lib/supabase/server";
import { toutesLesMentions } from "@/lib/generation/mentions-produits-server";
import MentionsProduits, { type SocieteMention } from "./MentionsProduits";
import styles from "./Integrations.module.scss";

export const metadata = { title: "Intégrations" };

/**
 * Sociétés émettrices et leur mention de produits (C1).
 *
 * Lecture par la session : la RLS de `legal_entities` s'applique, et cette
 * page est de toute façon réservée au Super Admin.
 */
async function societesEtMentions(): Promise<SocieteMention[]> {
  const supabase = await supabaseServer();
  const [{ data }, mentions] = await Promise.all([
    supabase
      .from("legal_entities")
      .select("id, legal_name, country")
      .is("deleted_at", null)
      .order("legal_name")
      .returns<{ id: string; legal_name: string | null; country: string | null }[]>(),
    toutesLesMentions(),
  ]);
  return (data ?? []).map((e) => ({
    id: e.id,
    nom: e.legal_name ?? "sans dénomination",
    pays: e.country,
    mention: mentions[e.id] ?? "",
  }));
}

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
      <MentionsProduits societes={await societesEtMentions()} />

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
