import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import {
  getCommercialDetail,
  getCommerciauxStats,
} from "@/lib/commerciaux-server";
import { getAllLeads } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import {
  COMMERCIAL_PROFILE_LABEL,
  COUNTRY_LABEL,
  PIPELINE_COLUMNS,
  SECTOR_LABEL,
  SECTOR_VAR,
  formatEUR,
  type CommercialProfile,
  type Country,
  type Sector,
} from "@/lib/leads";
import Sparkline from "../Sparkline";

export const metadata = { title: "Fiche commercial" };

const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--r-lg)",
  padding: "16px 18px",
};
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-subtle)", whiteSpace: "nowrap" };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export default async function CommercialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [me, detail, allStats, allLeads] = await Promise.all([
    getCurrentUserProfile(),
    getCommercialDetail(id),
    getCommerciauxStats(),
    getAllLeads(),
  ]);

  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Fiche commercial</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
          <Icon name="alert" size={14} /> Accès réservé aux Super Admin.
        </p>
      </div>
    );
  }
  if (!detail) notFound();

  const stats = allStats.find((s) => s.commercial.id === id);
  const leads = allLeads.filter((l) => l.ownerId === id);

  // Répartitions.
  const byStatus = new Map<string, number>();
  const bySector = new Map<Sector, number>();
  for (const l of leads) {
    byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);
    bySector.set(l.sector, (bySector.get(l.sector) ?? 0) + 1);
  }

  const kpis = [
    { label: "Leads reçus", value: String(stats?.leadsCount ?? 0) },
    { label: "Devis envoyés", value: String(stats?.devisSentCount ?? 0) },
    { label: "Signés", value: String(stats?.devisSignedCount ?? 0) },
    { label: "Taux de transfo", value: `${Math.round((stats?.conversionRate ?? 0) * 100)} %` },
    { label: "CA signé", value: formatEUR(stats?.caSigned ?? 0) },
    { label: "CA encaissé", value: formatEUR(stats?.caEncaisse ?? 0) },
    { label: "Panier moyen", value: stats && stats.panierMoyen > 0 ? formatEUR(stats.panierMoyen) : "—" },
  ];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/commerciaux" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>Commerciaux</Link>
        <span aria-hidden="true"> / </span>
        <span>{detail.displayName}</span>
      </nav>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{ width: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", background: detail.color, color: "#fff", fontSize: "1.25rem", fontWeight: 700, flexShrink: 0 }}
          aria-hidden="true"
        >
          {detail.initials}
        </span>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
            {detail.displayName}
            <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: detail.isActive ? "color-mix(in srgb, var(--tone-success, #14c890) 16%, transparent)" : "var(--bg-surface-2)", color: detail.isActive ? "var(--tone-success, #14c890)" : "var(--text-muted)" }}>
              {detail.isActive ? "Actif" : "Inactif"}
            </span>
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: 2 }}>{detail.email}</p>
        </div>
      </header>

      {/* Informations */}
      <section style={card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Informations</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <Info label="Rôles" value={detail.roles.length ? detail.roles.join(", ") : "—"} />
          <Info label="Société" value={detail.entityName ?? "—"} />
          <Info label="N° Ringover" value={detail.ringoverAgentId || "—"} />
          <Info label="Premium / Extrême" value={[detail.isPremium ? "Premium" : null, detail.isExtreme ? "Extrême" : null].filter(Boolean).join(" · ") || "—"} />
          <Info label="Créé le" value={fmtDate(detail.createdAt)} />
          <Info label="Dernière connexion" value={fmtDate(detail.lastLoginAt)} />
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 5 }}>Profils commerciaux</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {detail.commercialProfiles.length ? detail.commercialProfiles.map((p) => (
                <span key={p} style={{ padding: "3px 9px", borderRadius: 999, fontSize: "0.75rem", background: "color-mix(in srgb, var(--color-brand-500) 14%, transparent)", color: "var(--color-brand-500)", fontWeight: 600 }}>
                  {COMMERCIAL_PROFILE_LABEL[p as CommercialProfile] ?? p}
                </span>
              )) : <span style={{ color: "var(--text-muted)" }}>—</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 5 }}>Pays couverts</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {detail.countries.length ? detail.countries.map((c) => (
                <span key={c} title={COUNTRY_LABEL[c as Country] ?? c} style={{ padding: "3px 9px", borderRadius: 999, fontSize: "0.75rem", background: "var(--bg-surface-2)", color: "var(--text-primary)", fontWeight: 600 }}>
                  {c}
                </span>
              )) : <span style={{ color: "var(--text-muted)" }}>Tous</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Statistiques */}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Statistiques</h2>
          <Sparkline values={stats?.sparkline30d ?? new Array(30).fill(0)} color={detail.color} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ background: "var(--bg-surface-2)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{k.label}</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Répartitions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <section style={card}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Leads par étape</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PIPELINE_COLUMNS.map((col) => (
              <div key={col.status} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9375rem" }}>
                <span style={{ color: "var(--text-secondary, var(--text-muted))" }}>{col.label}</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{byStatus.get(col.status) ?? 0}</span>
              </div>
            ))}
          </div>
        </section>
        <section style={card}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Leads par secteur</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...bySector.entries()].sort((a, b) => b[1] - a[1]).map(([sector, n]) => (
              <div key={sector} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9375rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: `var(${SECTOR_VAR[sector]})` }} aria-hidden="true" />
                  {SECTOR_LABEL[sector]}
                </span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{n}</span>
              </div>
            ))}
            {bySector.size === 0 && <span style={{ color: "var(--text-muted)" }}>Aucun lead.</span>}
          </div>
        </section>
      </div>

      {/* Ses leads / activités */}
      <section style={{ ...card, padding: "8px 4px" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", padding: "10px 14px 4px" }}>
          Leads & activités · {leads.length}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
            <thead>
              <tr>
                <th style={th}>Client</th>
                <th style={th}>Ville</th>
                <th style={th}>Secteur</th>
                <th style={th}>Statut</th>
                <th style={{ ...th, textAlign: "right" }}>Montant</th>
                <th style={{ ...th, textAlign: "right" }}>Reçu</th>
              </tr>
            </thead>
            <tbody>
              {leads
                .slice()
                .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt))
                .map((l) => (
                  <tr key={l.id}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <Link href={`/leads/${l.id}`} style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>{l.client}</Link>
                    </td>
                    <td style={td}>{l.city || "—"}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(${SECTOR_VAR[l.sector]})` }} aria-hidden="true" />
                        {SECTOR_LABEL[l.sector]}
                      </span>
                    </td>
                    <td style={td}>{PIPELINE_COLUMNS.find((c) => c.status === l.status)?.label ?? l.status}</td>
                    <td style={num}>{l.amount > 0 ? formatEUR(l.amount) : "—"}</td>
                    <td style={num}><RelativeTime iso={l.receivedAt} /></td>
                  </tr>
                ))}
              {leads.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, color: "var(--text-muted)" }}>Aucun lead attribué.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
