import Link from "next/link";
import { notFound } from "next/navigation";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  CLIENT_ORIGIN_LABEL,
  CLIENT_TYPE_LABEL,
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  SECTOR_LABEL,
  SECTOR_VAR,
  formatEUR,
} from "@/lib/leads";
import { getClientById, getClientStats } from "@/lib/leads-mock";
import styles from "./ClientDetail.module.scss";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const client = getClientById(id);
  return { title: client ? client.name : "Client introuvable" };
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const client = getClientById(id);
  if (!client) notFound();

  const { documents, caEncaisse, caSigne, lastActivityAt } = getClientStats(client);

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/clients" className={styles.breadcrumbLink}>Clients</Link>
        <span aria-hidden="true">/</span>
        <span>{client.name}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{client.name}</h1>
          </div>
          <div className={styles.tagRow}>
            <span className={styles.typePill} data-type={client.type}>
              {CLIENT_TYPE_LABEL[client.type]}
            </span>
            <span className={styles.originPill} data-origin={client.origin}>
              {CLIENT_ORIGIN_LABEL[client.origin]}
            </span>
            {client.sectors.map((s) => (
              <span
                key={s}
                className={styles.sectorChip}
                style={{ ["--sc" as string]: `var(${SECTOR_VAR[s]})` }}
              >
                {SECTOR_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          <Link
            href={`/devis/new?client=${client.id}`}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            Nouveau devis
          </Link>
          {client.sourceLeadId && (
            <Link href={`/leads/${client.sourceLeadId}`} className={styles.btn}>
              Voir le lead d&apos;origine
            </Link>
          )}
        </div>
      </header>

      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.card}>
            <h2 className={styles.h2}>Coordonnées</h2>
            <dl className={styles.dl}>
              {client.type === "pro" && client.contactName && (
                <div>
                  <dt>Contact référent</dt>
                  <dd>{client.contactName}</dd>
                </div>
              )}
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${client.email}`} className={styles.link}>{client.email}</a>
                </dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>
                  <a href={`tel:${client.phone.replace(/\s/g, "")}`} className={styles.link}>
                    {client.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Adresse</dt>
                <dd>
                  {client.address}
                  <br />
                  {client.postalCode} {client.city}
                </dd>
              </div>
              {client.type === "pro" && client.siret && (
                <div>
                  <dt>SIRET</dt>
                  <dd className={styles.mono}>{client.siret}</dd>
                </div>
              )}
              {client.type === "pro" && client.vatIntra && (
                <div>
                  <dt>N° TVA intracom.</dt>
                  <dd className={styles.mono}>{client.vatIntra}</dd>
                </div>
              )}
            </dl>
            {client.note && (
              <p className={styles.note}>
                <strong>Note : </strong>
                {client.note}
              </p>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>
              Documents émis
              <span className={styles.h2Count}>{documents.length}</span>
            </h2>
            {documents.length === 0 ? (
              <p className={styles.empty}>
                Aucun document n&apos;a été émis pour ce client.
                {client.origin === "direct" && " Cliquez sur « Nouveau devis » pour démarrer."}
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Type</th>
                      <th className={styles.tNum}>Total TTC</th>
                      <th>Date</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.id}>
                        <td className={styles.mono}>
                          <Link
                            href={`${d.type === "devis" ? "/devis" : "/factures"}/${d.id}`}
                            className={styles.link}
                          >
                            {d.num}
                          </Link>
                        </td>
                        <td>{DOC_TYPE_LABEL[d.type]}</td>
                        <td className={styles.tNum}>{formatEUR(d.totalTtc)}</td>
                        <td>{DATE.format(new Date(d.issuedAt))}</td>
                        <td>
                          <span className={styles.docStatus} data-status={d.status}>
                            {DOC_STATUS_LABEL[d.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        <aside className={styles.aside}>
          <section className={styles.card}>
            <h2 className={styles.h2}>Aperçu</h2>
            <dl className={styles.dl}>
              <div>
                <dt>CA encaissé</dt>
                <dd className={styles.amount}>{formatEUR(caEncaisse)}</dd>
              </div>
              <div>
                <dt>CA signé</dt>
                <dd>{formatEUR(caSigne)}</dd>
              </div>
              <div>
                <dt>Documents émis</dt>
                <dd>{documents.length}</dd>
              </div>
              <div>
                <dt>Client depuis</dt>
                <dd>{DATE.format(new Date(client.createdAt))}</dd>
              </div>
              <div>
                <dt>Dernière activité</dt>
                <dd>
                  <RelativeTime iso={lastActivityAt} />
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
