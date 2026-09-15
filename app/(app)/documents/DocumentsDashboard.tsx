"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/documents/contracts-types";
import { DOC_CATEGORY_LABEL, type DocCategory } from "@/lib/documents/types";
import type { DocumentsDashboard as Data } from "@/lib/documents/dashboard-server";
import styles from "./documents.module.scss";

const FILTERS: (DocCategory | "all")[] = ["all", "hotte", "desinsectisation", "deratisation"];
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
const fmtDate = (d: string | null) => (d ? DATE.format(new Date(d)) : "—");
const fmtEur = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("fr-FR")} €`);

export default function DocumentsDashboard({ data }: { data: Data }) {
  const [filter, setFilter] = useState<DocCategory | "all">("all");

  const contracts = useMemo(() => data.contracts.filter((c) => filter === "all" || c.category === filter), [data.contracts, filter]);
  const passages = useMemo(() => data.passagesToPlan.filter((p) => filter === "all" || p.category === filter), [data.passagesToPlan, filter]);
  const certsGen = useMemo(() => data.certsToGenerate.filter((c) => filter === "all" || c.category === filter), [data.certsToGenerate, filter]);
  const certsSend = useMemo(() => data.certsToSend.filter((c) => filter === "all" || c.category === filter), [data.certsToSend, filter]);
  const enAttente = useMemo(() => contracts.filter((c) => c.status === "en_attente_signature"), [contracts]);

  const k = useMemo(() => ({
    actifs: contracts.filter((c) => c.status === "actif").length,
    aRenouveler: contracts.filter((c) => c.status === "a_renouveler").length,
    expirent: contracts.filter((c) => c.expiringSoon).length,
    enAttente: enAttente.length,
    certGenerer: certsGen.length,
    certEnvoyer: certsSend.length,
    passages: passages.length,
  }), [contracts, enAttente, certsGen, certsSend, passages]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Documents &amp; Contrats</h1>
          <p className={styles.subtitle}>Vue centrale des contrats, certificats et échéances.</p>
        </div>
      </header>

      <div className={styles.kpis}>
        <Kpi label="Contrats actifs" value={k.actifs} tone="ok" />
        <Kpi label="À renouveler" value={k.aRenouveler} tone="warn" />
        <Kpi label="Expirent ≤ 30 j" value={k.expirent} tone={k.expirent > 0 ? "warn" : undefined} />
        <Kpi label="En attente signature" value={k.enAttente} tone="info" />
        <Kpi label="Certificats à générer" value={k.certGenerer} tone={k.certGenerer > 0 ? "warn" : undefined} />
        <Kpi label="Certificats à envoyer" value={k.certEnvoyer} tone={k.certEnvoyer > 0 ? "warn" : undefined} />
        <Kpi label="Passages à planifier" value={k.passages} tone={k.passages > 0 ? "warn" : undefined} />
      </div>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`${styles.chip} ${filter === f ? styles.chipOn : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "Tous" : DOC_CATEGORY_LABEL[f as DocCategory]}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {/* ── Contrats ── */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Contrats <span className={styles.count}>{contracts.length}</span></h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Réf.</th><th>Client</th><th>Catégorie</th><th>Statut</th><th>Période</th><th>Passages</th><th className={styles.num}>Montant</th></tr>
              </thead>
              <tbody>
                {contracts.length === 0 && <tr><td colSpan={7} className={styles.empty}>Aucun contrat.</td></tr>}
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Réf." className={styles.mono}>{c.ref ?? "—"}</td>
                    <td data-label="Client"><Link href={`/clients/${c.clientId}?tab=documents`} className={styles.link}>{c.clientName}</Link></td>
                    <td data-label="Catégorie">{c.category ? DOC_CATEGORY_LABEL[c.category as DocCategory] ?? c.category : "—"}</td>
                    <td data-label="Statut"><span className={styles.status} data-tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</span></td>
                    <td data-label="Période">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}{c.expiringSoon && <span className={styles.warnDot} title="Expire bientôt"> ⚠️</span>}</td>
                    <td data-label="Passages">{c.passagesPerYear != null ? `${c.passagesDone}/${c.passagesPerYear}` : "—"}</td>
                    <td data-label="Montant" className={styles.num}>{fmtEur(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Colonne alertes ── */}
        <div className={styles.alertsCol}>
          <AlertList
            title="Passages à planifier" tone="warn" count={passages.length}
            empty="Tous les passages sont planifiés."
            items={passages.map((p) => ({
              key: p.passageId,
              main: `${p.clientName}`,
              sub: `${p.contractTitle}${p.contractRef ? ` · ${p.contractRef}` : ""} · Passage ${p.index}`,
              href: `/clients/${p.clientId}?tab=documents`,
              action: { label: "Planifier", href: "/planification" },
            }))}
          />
          <AlertList
            title="Certificats à générer" tone="warn" count={certsGen.length}
            empty="Aucun certificat en attente."
            items={certsGen.map((c) => ({
              key: c.dossierId,
              main: c.clientName,
              sub: "Intervention hotte réalisée",
              href: `/certificat-hotte?dossier=${c.dossierId}`,
              action: { label: "Générer", href: `/certificat-hotte?dossier=${c.dossierId}` },
            }))}
          />
          <AlertList
            title="Certificats à envoyer" tone="info" count={certsSend.length}
            empty="Aucun certificat à envoyer."
            items={certsSend.map((c) => ({
              key: c.dossierId,
              main: c.clientName,
              sub: c.numero ?? "",
              href: `/certificat-hotte?dossier=${c.dossierId}`,
              action: { label: "Ouvrir", href: `/certificat-hotte?dossier=${c.dossierId}` },
            }))}
          />
          <AlertList
            title="En attente de signature" tone="info" count={enAttente.length}
            empty="Aucun contrat en attente."
            items={enAttente.map((c) => ({
              key: c.id,
              main: c.clientName,
              sub: `${c.title}${c.ref ? ` · ${c.ref}` : ""}`,
              href: `/clients/${c.clientId}?tab=documents`,
              action: { label: "Ouvrir", href: `/clients/${c.clientId}?tab=documents` },
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "info" }) {
  return (
    <div className={`${styles.kpi} ${tone ? styles[`kpi_${tone}`] : ""}`}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </div>
  );
}

type AlertItem = { key: string; main: string; sub: string; href: string; action: { label: string; href: string } };
function AlertList({ title, tone, count, empty, items }: { title: string; tone: "warn" | "info"; count: number; empty: string; items: AlertItem[] }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title} <span className={`${styles.count} ${count > 0 ? styles[`count_${tone}`] : ""}`}>{count}</span></h2>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.alertList}>
          {items.map((it) => (
            <li key={it.key} className={styles.alertItem}>
              <Link href={it.href} className={styles.alertMain}>
                <span className={styles.alertName}>{it.main}</span>
                {it.sub && <span className={styles.alertSub}>{it.sub}</span>}
              </Link>
              <Link href={it.action.href} className={styles.alertBtn}>{it.action.label} <Icon name="chevron-down" size={12} /></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
