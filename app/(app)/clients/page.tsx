import ClientsList from "./ClientsList";
import styles from "./Clients.module.scss";
import { getAllClientsForList } from "@/lib/clients-server";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const rows = await getAllClientsForList();
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
      <ClientsList rows={rows} />
    </div>
  );
}
