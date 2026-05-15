import Link from "next/link";
import NewClientForm from "./NewClientForm";
import styles from "./NewClient.module.scss";

export const metadata = { title: "Nouveau client" };

export default function NewClientPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/clients" className={styles.breadcrumbLink}>Clients</Link>
        <span aria-hidden="true">/</span>
        <span>Nouveau</span>
      </nav>
      <header>
        <h1 className={styles.title}>Nouveau client</h1>
        <p className={styles.subtitle}>
          Onboarder un client direct (hors acquisition digitale)
        </p>
      </header>
      <NewClientForm />
    </div>
  );
}
