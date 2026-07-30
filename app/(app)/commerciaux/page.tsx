import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { getCommerciauxStats, type CommercialStats } from "@/lib/commerciaux-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getEntitiesForPicker } from "@/lib/devis-server";
import { formatEUR } from "@/lib/leads";
import AddCommercialButton from "./AddCommercialButton";
import Sparkline from "./Sparkline";
import styles from "./Commerciaux.module.scss";

export const metadata = { title: "Commerciaux" };

// Sortable columns the user can pick via the URL query — server-rendered
// resort (no client JS for sorting). Default = CA signé desc.
type SortKey =
  | "name"
  | "leads"
  | "sent"
  | "signed"
  | "rate"
  | "ca"
  | "encaisse"
  | "panier";
const ALLOWED_SORTS: SortKey[] = [
  "name", "leads", "sent", "signed", "rate", "ca", "encaisse", "panier",
];

type Props = {
  searchParams: Promise<{ sort?: string; dir?: string }>;
};

export default async function CommerciauxPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sort = (ALLOWED_SORTS.includes(sp.sort as SortKey) ? sp.sort : "ca") as SortKey;
  const dir = sp.dir === "asc" ? "asc" : "desc";

  const [profile, allStats, entities] = await Promise.all([
    getCurrentUserProfile(),
    getCommerciauxStats(),
    getEntitiesForPicker(),
  ]);
  const entityOptions = entities.map((e) => ({ id: e.id, name: e.legalName }));

  // Admin-only — CDC §3 sets Commerciaux visibility to Super Admin.
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Commerciaux</h1>
        </header>
        <p className={styles.denied}>
          <Icon name="alert" size={14} /> Accès réservé aux Super Admin.
          {profile && profile.roles.length > 0 && (
            <> Rôles actuels : {profile.roles.map((r) => r.label).join(", ")}.</>
          )}
        </p>
      </div>
    );
  }

  const stats = [...allStats].sort((a, b) => compareStats(a, b, sort, dir));

  // Aggregate KPIs across all commerciaux.
  const totals = stats.reduce(
    (acc, s) => {
      acc.leads += s.leadsCount;
      acc.sent += s.devisSentCount;
      acc.signed += s.devisSignedCount;
      acc.caSigned += s.caSigned;
      acc.caEncaisse += s.caEncaisse;
      if (s.caSigned > 0 && (!acc.topPerformer || s.caSigned > acc.topPerformer.caSigned)) {
        acc.topPerformer = s;
      }
      return acc;
    },
    {
      leads: 0,
      sent: 0,
      signed: 0,
      caSigned: 0,
      caEncaisse: 0,
      topPerformer: null as CommercialStats | null,
    },
  );

  const globalRate = totals.sent > 0 ? totals.signed / totals.sent : 0;
  const activeCount = stats.filter((s) => s.leadsCount > 0 || s.devisSentCount > 0).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Commerciaux</h1>
          <p className={styles.subtitle}>
            Classement de performance · {activeCount} actif{activeCount > 1 ? "s" : ""} sur {stats.length}
          </p>
        </div>
        <AddCommercialButton entities={entityOptions} />
      </header>

      <section className={styles.kpis}>
        <KpiCard
          label="CA signé"
          value={formatEUR(totals.caSigned)}
          hint={`${totals.signed} devis signés`}
          tone="brand"
        />
        <KpiCard
          label="CA encaissé"
          value={formatEUR(totals.caEncaisse)}
          hint="acomptes + finales payés"
          tone="success"
        />
        <KpiCard
          label="Taux de transfo global"
          value={`${(globalRate * 100).toFixed(0)} %`}
          hint={`${totals.signed} / ${totals.sent} envoyés`}
          tone="info"
        />
        <KpiCard
          label="Top performer"
          value={totals.topPerformer?.commercial.name ?? "—"}
          hint={
            totals.topPerformer
              ? `${formatEUR(totals.topPerformer.caSigned)} CA signé`
              : "Aucun devis signé sur la période"
          }
          tone="warning"
        />
      </section>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortHeader col="name" label="Commercial" sort={sort} dir={dir} align="left" />
              <SortHeader col="leads" label="Leads" sort={sort} dir={dir} align="right" />
              <SortHeader col="sent" label="Devis envoyés" sort={sort} dir={dir} align="right" />
              <SortHeader col="signed" label="Signés" sort={sort} dir={dir} align="right" />
              <SortHeader col="rate" label="Taux" sort={sort} dir={dir} align="right" />
              <SortHeader col="ca" label="CA signé" sort={sort} dir={dir} align="right" />
              <SortHeader col="encaisse" label="CA encaissé" sort={sort} dir={dir} align="right" />
              <SortHeader col="panier" label="Panier moyen" sort={sort} dir={dir} align="right" />
              <th>Tendance 30j</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  Aucun commercial enregistré.
                </td>
              </tr>
            )}
            {stats.map((s, idx) => (
              <tr key={s.commercial.id} data-rank={idx + 1}>
                <td className={styles.cellName}>
                  <span className={styles.rank}>{idx + 1}</span>
                  <span
                    className={styles.avatar}
                    style={{ ["--av" as string]: s.commercial.color }}
                    aria-hidden="true"
                  >
                    {s.commercial.initials}
                  </span>
                  <div className={styles.nameBlock}>
                    <div className={styles.nameMain}>{s.commercial.name}</div>
                    <div className={styles.nameSub}>{s.commercial.email}</div>
                  </div>
                </td>
                <td className={styles.num}>{s.leadsCount}</td>
                <td className={styles.num}>{s.devisSentCount}</td>
                <td className={styles.num}>{s.devisSignedCount}</td>
                <td className={styles.num}>
                  <span className={styles.rate} data-tone={rateTone(s.conversionRate)}>
                    {s.devisSentCount > 0 ? `${(s.conversionRate * 100).toFixed(0)} %` : "—"}
                  </span>
                </td>
                <td className={`${styles.num} ${styles.bold}`}>{formatEUR(s.caSigned)}</td>
                <td className={styles.num}>{formatEUR(s.caEncaisse)}</td>
                <td className={styles.num}>
                  {s.panierMoyen > 0 ? formatEUR(s.panierMoyen) : "—"}
                </td>
                <td>
                  <Sparkline values={s.sparkline30d} color={s.commercial.color} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "info" | "brand" | "warning" | "success";
}) {
  return (
    <div className={styles.kpiCard} data-tone={tone}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiHint}>{hint}</p>
    </div>
  );
}

function SortHeader({
  col,
  label,
  sort,
  dir,
  align,
}: {
  col: SortKey;
  label: string;
  sort: SortKey;
  dir: "asc" | "desc";
  align: "left" | "right";
}) {
  const active = sort === col;
  // Toggle dir if clicking the active column; otherwise switch column with
  // a sensible default (desc for numeric columns, asc for name).
  const nextDir = active ? (dir === "asc" ? "desc" : "asc") : col === "name" ? "asc" : "desc";
  const href = `/commerciaux?sort=${col}&dir=${nextDir}`;
  return (
    <th className={align === "right" ? styles.thNum : undefined}>
      <Link href={href} className={`${styles.sortHeader} ${active ? styles.sortActive : ""}`}>
        {label}
        {active && (
          <Icon name={dir === "asc" ? "chevron-down" : "chevron-down"} size={11} />
        )}
      </Link>
    </th>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function compareStats(
  a: CommercialStats,
  b: CommercialStats,
  sort: SortKey,
  dir: "asc" | "desc",
): number {
  let cmp = 0;
  switch (sort) {
    case "name":     cmp = a.commercial.name.localeCompare(b.commercial.name, "fr"); break;
    case "leads":    cmp = a.leadsCount - b.leadsCount; break;
    case "sent":     cmp = a.devisSentCount - b.devisSentCount; break;
    case "signed":   cmp = a.devisSignedCount - b.devisSignedCount; break;
    case "rate":     cmp = a.conversionRate - b.conversionRate; break;
    case "ca":       cmp = a.caSigned - b.caSigned; break;
    case "encaisse": cmp = a.caEncaisse - b.caEncaisse; break;
    case "panier":   cmp = a.panierMoyen - b.panierMoyen; break;
  }
  return dir === "asc" ? cmp : -cmp;
}

function rateTone(rate: number): "good" | "ok" | "bad" {
  if (rate >= 0.5) return "good";
  if (rate >= 0.25) return "ok";
  return "bad";
}
