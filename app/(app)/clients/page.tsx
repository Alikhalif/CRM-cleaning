import ClientsList from "./ClientsList";
import styles from "./Clients.module.scss";
import { getAllClientsForList } from "@/lib/clients-server";
import { hasScope } from "@/lib/access-server";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const [rows, peutCreer] = await Promise.all([
    getAllClientsForList(),
    // Même règle que la garde de /clients/new : on ne montre pas un bouton
    // qui mène à un 404.
    hasScope("backOffice"),
  ]);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Clients</h1>
          <p className={styles.subtitle}>
            Clients issus de leads convertis et clients onboardés directement
          </p>
        </div>
      </header>
      <ClientsList rows={rows} peutCreer={peutCreer} />
    </div>
  );
}
