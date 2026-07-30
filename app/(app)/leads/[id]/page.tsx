import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  PIPELINE_COLUMNS,
  SECTOR_LABEL,
  COUNTRY_LABEL,
  SECTOR_VAR,
  SOURCE_LABEL,
  formatEUR,
  profileCapabilities,
} from "@/lib/leads";
import { getAllCommerciaux, getLeadDetail } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getActiveSmsTemplates } from "@/lib/message-templates-server";
import { isN8nSequenceEnabled } from "@/lib/app-settings";
import CallNotesCard from "./CallNotesCard";
import DiscoveryCard from "./DiscoveryCard";
import FollowupCard from "./FollowupCard";
import ImmobAnnotationCard from "./ImmobAnnotationCard";
import InterventionDelayCard from "./InterventionDelayCard";
import LeadActions from "./LeadActions";
import PipelineProgress from "./PipelineProgress";
import styles from "./LeadDetail.module.scss";

// CDC §3.5 — visible only if the current user holds the immobTravaux
// permission. Hardcoded true while the permission resolver lives outside
// the session claims; flip to false to verify it disappears.
const CURRENT_USER_HAS_IMMOB_TRAVAUX = true;

// Tabs the user can toggle via ?tab=… in the URL. Each one filters which
// sections of the page are visible. Default = informations.
const TABS = [
  { key: "informations", label: "Informations" },
  { key: "historique",   label: "Historique" },
  { key: "devis",        label: "Devis" },
  { key: "documents",    label: "Documents" },
  { key: "intervention", label: "Intervention" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  return { title: detail ? detail.lead.client : "Lead introuvable" };
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: TabKey =
    TABS.find((t) => t.key === tabParam)?.key ?? "informations";

  const [detail, commerciaux, n8nEnabled, me, smsTemplates] = await Promise.all([
    getLeadDetail(id),
    getAllCommerciaux(),
    isN8nSequenceEnabled(),
    getCurrentUserProfile(),
    getActiveSmsTemplates(),
  ]);
  if (!detail) notFound();

  // Capacités dérivées du profil (décision « auto selon le profil ») : un
  // commercial « Divers » (profil nettoyage) n'a pas accès au click-to-call.
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  const { canUseRingover } = profileCapabilities(me?.commercialProfiles ?? [], isAdmin);

  const { lead, owner, documents, timeline } = detail;
  const statusLabel =
    PIPELINE_COLUMNS.find((c) => c.status === lead.status)?.label ?? lead.status;

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

  // Ancienneté in days — purely visual. Date.now() is fine in a server
  // component (re-rendered per request); the purity lint rule is overzealous
  // here, so the helper isolates it.
  const ageDays = daysSince(lead.receivedAt);
  // Sum of devis amounts (use latest non-brouillon, fallback to estimate).
  const lastDevis = documents.find((d) => d.type === "devis" && d.status !== "brouillon");
  const devisAmount = lastDevis?.totalTtc ?? lead.amount;

  const devisCount = documents.filter((d) => d.type === "devis").length;
  const docsCount = documents.length;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/leads" className={styles.breadcrumbLink}>
          Leads
        </Link>
        <span aria-hidden="true">/</span>
        <span>{lead.client}</span>
      </nav>

      {/* ── Big header card with sector avatar + identity + actions + progress ── */}
      <section className={styles.heroCard}>
        <div className={styles.heroRow}>
          <span
            className={styles.heroAvatar}
            style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
            aria-hidden="true"
            title={SECTOR_LABEL[lead.sector]}
          >
            <Icon name={sectorIcon(lead.sector)} size={32} />
          </span>

          <div className={styles.heroIdentity}>
            <div className={styles.heroNameRow}>
              <h1 className={styles.heroName}>{lead.client}</h1>
              <span className={styles.heroId}>#{lead.shortId.replace(/^L-/, "")}</span>
              {lead.subEnvoi && (
                <span
                  className={styles.heroChannelChip}
                  data-channel={lead.subEnvoi}
                  title={lead.subEnvoi === "auto" ? "Séquence n8n" : "Envoi manuel"}
                >
                  <Icon name={lead.subEnvoi === "auto" ? "zap" : "edit"} size={11} />
                  {lead.subEnvoi === "auto" ? "Auto" : "Mano"}
                </span>
              )}
              {lead.isUrgent && (
                <span className={styles.urgentTag}>
                  <Icon name="alert" size={11} /> Urgent
                </span>
              )}
              {lead.isNrp && (
                <span className={`${styles.badge} ${styles.badgeNrp}`} title="Ne répond pas">
                  NRP
                </span>
              )}
            </div>
            <div className={styles.heroMeta}>
              <span
                className={styles.sector}
                style={{ ["--sc" as string]: `var(${SECTOR_VAR[lead.sector]})` }}
              >
                {SECTOR_LABEL[lead.sector]}
              </span>
              {lead.country && (
                <span className={styles.muted}>Pays : {COUNTRY_LABEL[lead.country]}</span>
              )}
              {lead.entityName && (
                <span className={styles.muted}>Société : {lead.entityName}</span>
              )}
              {lead.landingPage && (
                <span className={styles.muted}>LP : {lead.landingPage}</span>
              )}
              {lead.typeService && (
                <span className={styles.muted}>Type : {lead.typeService}</span>
              )}
              <span className={styles.heroLoc}>
                <Icon name="leads" size={11} /> {lead.city}
              </span>
              <span className={styles.muted}>
                Source : {SOURCE_LABEL[lead.source]}
              </span>
              <span className={styles.muted}>
                Créé <RelativeTime iso={lead.receivedAt} />
              </span>
              <span className={styles.statusPill} data-status={lead.status}>
                {statusLabel}
              </span>
            </div>
          </div>

          <LeadActions
            lead={lead}
            commerciaux={commerciaux}
            n8nEnabled={n8nEnabled}
            canUseRingover={canUseRingover}
            smsTemplates={smsTemplates}
            currentUserName={me?.displayName ?? ""}
          />
        </div>

        <PipelineProgress lead={lead} docs={documents.map((d) => ({ type: d.type, status: d.status }))} />
      </section>

      {/* ── 4 KPI cards ───────────────────────────────────────────────── */}
      <section className={styles.kpiRow}>
        <KpiCard
          icon="comptabilite"
          label="Montant devis"
          value={formatEUR(devisAmount)}
        />
        <KpiCard
          icon="leads"
          label="Ancienneté"
          value={`${ageDays} jour${ageDays > 1 ? "s" : ""}`}
        />
        <KpiCard
          icon="search"
          label="Source"
          value={SOURCE_LABEL[lead.source]}
        />
        <KpiCard
          icon="commerciaux"
          label="Commercial"
          value={owner?.name ?? "Non assigné"}
          accentColor={owner?.color}
          initials={owner?.initials}
        />
      </section>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <nav className={styles.tabs} aria-label="Sections du lead">
        {TABS.map((t) => {
          const count =
            t.key === "historique" ? timeline.length :
            t.key === "devis"      ? devisCount :
            t.key === "documents"  ? docsCount :
            null;
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/leads/${lead.id}?tab=${t.key}`}
              scroll={false}
              className={`${styles.tab} ${active ? styles.tabOn : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              {count !== null && <span className={styles.tabCount}>{count}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      {tab === "informations" && (
        <div className={styles.layout}>
          <main className={styles.main}>
            <DiscoveryCard
              lead={lead}
              hasEmail={Boolean(lead.email)}
              hasPhone={Boolean(lead.phone)}
            />
            <section className={styles.card}>
              <h2 className={styles.h2}>Coordonnées</h2>
              <dl className={styles.dl}>
                <div>
                  <dt>Client</dt>
                  <dd>{lead.client}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{lead.isCompany ? "Professionnel" : "Particulier"}</dd>
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
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${lead.email}`} className={styles.link}>
                      {lead.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Adresse</dt>
                  <dd>
                    {lead.address && (
                      <>
                        {lead.address}
                        <br />
                      </>
                    )}
                    {lead.postalCode} {lead.city}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{SOURCE_LABEL[lead.source]}</dd>
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
            </section>
          </main>

          <aside className={styles.aside}>
            <CallNotesCard
              leadId={lead.id}
              initialNotes={lead.notes ?? ""}
              initialNextFollowup={lead.nextFollowupAt}
            />
            <FollowupCard leadId={lead.id} currentFollowup={lead.nextFollowupAt} />
            {/* Post-signature gate: show as soon as the lead is signed,
                or keep showing if a delay was already captured (e.g. lead
                reverted to an earlier status — don't lose the answer). */}
            {(lead.status === "signe" || lead.status === "encaisse" || lead.interventionDelay) && (
              <InterventionDelayCard
                leadId={lead.id}
                initialDelay={lead.interventionDelay}
                initialNotes={lead.interventionDelayNotes ?? ""}
              />
            )}
            {CURRENT_USER_HAS_IMMOB_TRAVAUX && (
              <ImmobAnnotationCard
                leadId={lead.id}
                initialValue={lead.immobTravauxAnnotation ?? ""}
              />
            )}
          </aside>
        </div>
      )}

      {tab === "historique" && (
        <section className={styles.card}>
          <h2 className={styles.h2}>Activité</h2>
          {timeline.length === 0 ? (
            <p className={styles.empty}>Aucun événement sur ce lead.</p>
          ) : (
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
          )}
        </section>
      )}

      {(tab === "devis" || tab === "documents") && (
        <section className={styles.card}>
          <h2 className={styles.h2}>
            {tab === "devis" ? "Devis liés" : "Tous les documents"}
            <span className={styles.h2Count}>
              {tab === "devis" ? devisCount : docsCount}
            </span>
          </h2>
          {(() => {
            const rows =
              tab === "devis"
                ? documents.filter((d) => d.type === "devis")
                : documents;
            if (rows.length === 0) {
              return (
                <p className={styles.empty}>
                  {tab === "devis"
                    ? "Aucun devis pour ce lead. Cliquez sur « Générer devis » pour démarrer."
                    : "Aucun document émis pour ce lead."}
                </p>
              );
            }
            return (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Type</th>
                      <th>Société</th>
                      <th className={styles.tNum}>Total TTC</th>
                      <th>Date</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
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
                        <td>{d.entityName ?? "—"}</td>
                        <td className={styles.tNum}>{formatEUR(d.totalTtc)}</td>
                        <td>{dateFmt.format(new Date(d.issuedAt))}</td>
                        <td>
                          <span className={styles.docStatus} data-status={d.status}>
                            {DOC_STATUS_LABEL[d.status]}
                          </span>
                          {d.type === "devis" && d.status === "refuse" && (
                            <div style={{ marginTop: 4, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                              {d.refusalReason && <>Motif : {d.refusalReason}. </>}
                              <Link href={`/devis/new?from=${d.id}`} className={styles.link}>
                                Renvoyer moins cher
                              </Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>
      )}

      {tab === "intervention" && (
        <section className={styles.card}>
          <h2 className={styles.h2}>Intervention</h2>
          <p className={styles.empty}>
            Les détails de l&apos;intervention (date, intervenant, durée) apparaîtront ici
            une fois le dossier planifié depuis la page Planification.
          </p>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  accentColor,
  initials,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  value: string;
  accentColor?: string;
  initials?: string;
}) {
  return (
    <div className={styles.kpiCard}>
      {initials ? (
        <span
          className={styles.kpiAvatar}
          style={{ ["--av" as string]: accentColor ?? "var(--color-brand-500)" }}
          aria-hidden="true"
        >
          {initials}
        </span>
      ) : (
        <span className={styles.kpiIcon} aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      )}
      <div className={styles.kpiBody}>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue}>{value}</p>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 86_400_000));
}

function sectorIcon(sector: string): Parameters<typeof Icon>[0]["name"] {
  // Map sectors to icons from the inline set. Fallback to "leads" for safety.
  return {
    urgence: "zap",
    nettoyage: "check",
    nettoyage_difficile: "check",
    enr: "sun",
    renovation: "edit",
  }[sector] as Parameters<typeof Icon>[0]["name"] ?? "leads";
}
