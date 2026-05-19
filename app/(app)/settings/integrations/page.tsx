import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { APP_SETTING_KEYS, isN8nSequenceEnabled } from "@/lib/app-settings";
import { getCurrentUserProfile } from "@/lib/users-server";
import { setBooleanSetting } from "./actions";
import styles from "./Integrations.module.scss";

export const metadata = { title: "Intégrations" };

// Form-action wrappers — Next requires (formData) => void | Promise<void>.
// The real setBooleanSetting returns a Result we keep for programmatic
// callers; here we drop it.
async function enableN8n() {
  "use server";
  await setBooleanSetting(APP_SETTING_KEYS.n8nSequenceEnabled, true);
}
async function disableN8n() {
  "use server";
  await setBooleanSetting(APP_SETTING_KEYS.n8nSequenceEnabled, false);
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

  const n8nOn = await isN8nSequenceEnabled();

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

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Séquence n8n (WF2)</h2>
            <p className={styles.cardDesc}>
              Active le bouton « Lancer séquence » dans le pipeline et le détail du lead.
              Quatre emails de relance Brevo s&apos;enchaînent jusqu&apos;à signature ou opt-out.
              CDC §2.3.
            </p>
          </div>
          <span
            className={`${styles.state} ${n8nOn ? styles.stateOn : styles.stateOff}`}
            aria-label={n8nOn ? "Activé" : "Désactivé"}
          >
            {n8nOn ? "Activé" : "Désactivé"}
          </span>
        </div>
        <div className={styles.cardActions}>
          {n8nOn ? (
            <form action={disableN8n}>
              <button type="submit" className={`${styles.btn} ${styles.btnDanger}`}>
                <Icon name="x" size={14} /> Désactiver
              </button>
            </form>
          ) : (
            <form action={enableN8n}>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                <Icon name="check" size={14} /> Activer
              </button>
            </form>
          )}
        </div>
        {!n8nOn && (
          <p className={styles.hint}>
            Tant que cette option est désactivée, le bouton « Lancer séquence » est masqué
            partout dans l&apos;application. L&apos;action serveur refuse également les
            appels — un onglet périmé qui tenterait d&apos;exécuter la séquence recevrait
            une erreur claire.
          </p>
        )}
      </section>
    </div>
  );
}
