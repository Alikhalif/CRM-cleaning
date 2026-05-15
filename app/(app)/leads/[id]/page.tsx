import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  PIPELINE_COLUMNS,
  SECTOR_LABEL,
  SECTOR_VAR,
  SOURCE_LABEL,
  formatEUR,
  needsEnvoi,
  needsSignature,
} from "@/lib/leads";
import { getLeadDetail } from "@/lib/leads-mock";
import LeadActions from "./LeadActions";
import styles from "./LeadDetail.module.scss";

// In production this comes from the authenticated session + RLS-aware claims.
// Hardcoded here while auth isn't wired so the conditional Immobilier/Travaux
// section (CDC §3.5) renders something useful in mocks. Set to false to verify
// it disappears.
const CURRENT_USER_HAS_IMMOB_TRAVAUX = true;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const detail = getLeadDetail(id);
  return { title: detail ? detail.lead.client : "Lead introuvable" };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = getLeadDetail(id);
  if (!detail) notFound();

  const { lead, owner, documents, timeline } = detail;
  const statusLabel =
    PIPELINE_COLUMNS.find((c) => c.status === lead.status)?.label ?? lead.status;
  const showImmobTravaux = CURRENT_USER_HAS_IMMOB_TRAVAUX;
  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/leads" className={styles.breadcrumbLink}>
          Leads &amp; devis
        </Link>
        <span aria-hidden="true">/</span>
        <span className={styles.shortId}>{lead.shortId}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{lead.client}</h1>
            {lead.isUrgent && (
              <span className={styles.urgentTag}>
                <Icon name="alert" size={12} /> Urgent
              </span>
            )}
          </div>
          <div className={styles.tagRow}>
            <span
              className={styles.sector}
              style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
            >
              {SECTOR_LABEL[lead.sector]}
            </span>
            <span className={styles.statusPill} data-status={lead.status}>
              {statusLabel}
            </span>
            {needsEnvoi(lead) ? (
              <span className={`${styles.badge} ${styles.badgeDanger}`}>
                <Icon name="alert" size={11} /> Canal manquant
              </span>
            ) : (
              lead.subEnvoi && (
                <span className={styles.badge}>
                  {lead.subEnvoi === "mano" ? "Mano" : "Auto"}
                </span>
              )
            )}
            {needsSignature(lead) ? (
              <span className={`${styles.badge} ${styles.badgeDanger}`}>
                <Icon name="alert" size={11} /> Acompte ?
              </span>
            ) : (
              lead.subSignature && (
                <span className={styles.badge}>
                  {lead.subSignature === "avec" ? "Avec acompte" : "Sans acompte"}
                </span>
              )
            )}
            <span className={styles.muted}>· {SOURCE_LABEL[lead.source]}</span>
            <span className={styles.muted}>· {lead.city}</span>
          </div>
        </div>
        <LeadActions lead={lead} />
      </header>

      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.card}>
            <h2 className={styles.h2}>Coordonnées</h2>
            <dl className={styles.dl}>
              <div>
                <dt>Type</dt>
                <dd>{lead.isCompany ? "Professionnel" : "Particulier"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${lead.email}`} className={styles.link}>
                    {lead.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>
                  <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className={styles.link}>
                    {lead.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Adresse</dt>
                <dd>
                  {lead.address}
                  <br />
                  {lead.postalCode} {lead.city}
                </dd>
              </div>
              {lead.isCompany && lead.siret && (
                <div>
                  <dt>SIRET</dt>
                  <dd className={styles.mono}>{lead.siret}</dd>
                </div>
              )}
              {lead.isCompany && lead.vatIntra && (
                <div>
                  <dt>N° TVA intracom.</dt>
                  <dd className={styles.mono}>{lead.vatIntra}</dd>
                </div>
              )}
            </dl>
            {lead.notes && (
              <p className={styles.note}>
                <strong>Note : </strong>
                {lead.notes}
              </p>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>
              Devis &amp; factures
              <span className={styles.h2Count}>{documents.length}</span>
            </h2>
            {documents.length === 0 ? (
              <p className={styles.empty}>
                Aucun document émis pour ce lead. Cliquez sur « Générer devis » pour démarrer.
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
                        <td>{dateFmt.format(new Date(d.issuedAt))}</td>
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

          <section className={styles.card}>
            <h2 className={styles.h2}>Activité</h2>
            <ol className={styles.timeline}>
              {timeline.map((e) => (
                <li key={e.id} className={styles.timelineItem} data-kind={e.kind}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div className={styles.timelineBody}>
                    <p className={styles.timelineLabel}>{e.label}</p>
                    {e.sublabel && <p className={styles.timelineSub}>{e.sublabel}</p>}
                  </div>
                  <div className={styles.timelineTime}>
                    <time dateTime={e.at}>{dateTimeFmt.format(new Date(e.at))}</time>
                    <RelativeTime iso={e.at} className={styles.timelineRel} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {showImmobTravaux && (
            <section className={`${styles.card} ${styles.cardConfidential}`}>
              <h2 className={styles.h2}>
                <Icon name="alert" size={14} /> Annotation Immobilier / Travaux
                <span className={styles.confidentialTag}>Confidentiel</span>
              </h2>
              {lead.immobTravauxAnnotation ? (
                <p className={styles.note}>{lead.immobTravauxAnnotation}</p>
              ) : (
                <p className={styles.empty}>Aucune annotation pour ce lead.</p>
              )}
            </section>
          )}
        </main>

        <aside className={styles.aside}>
          <section className={styles.card}>
            <h2 className={styles.h2}>Aperçu</h2>
            <dl className={styles.dl}>
              <div>
                <dt>Montant estimé</dt>
                <dd className={styles.amount}>{formatEUR(lead.amount)}</dd>
              </div>
              <div>
                <dt>Commercial</dt>
                <dd>
                  {owner ? (
                    <span className={styles.ownerRow}>
                      <span
                        className={styles.ownerAvatar}
                        style={{ ["--av" as string]: owner.color }}
                        aria-hidden="true"
                      >
                        {owner.initials}
                      </span>
                      {owner.name}
                    </span>
                  ) : (
                    "Non assigné"
                  )}
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{SOURCE_LABEL[lead.source]}</dd>
              </div>
              <div>
                <dt>Reçu le</dt>
                <dd>
                  {dateFmt.format(new Date(lead.receivedAt))}
                  <span className={styles.muted}> · </span>
                  <RelativeTime iso={lead.receivedAt} className={styles.muted} />
                </dd>
              </div>
              <div>
                <dt>Dernière action</dt>
                <dd>
                  {lead.lastActionLabel}
                  <span className={styles.muted}> · </span>
                  <RelativeTime iso={lead.lastActionAt} className={styles.muted} />
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
