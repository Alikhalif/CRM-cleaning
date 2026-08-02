import Link from "next/link";
import { getAllLeads } from "@/lib/leads-server";
import {
  DISCOVERY_OUTCOME_LABEL,
  SECTOR_LABEL,
  SECTOR_VAR,
  type Lead,
} from "@/lib/leads";

export const metadata = { title: "Découverte" };

// "Rubrique Découverte" (call 2026-07-11). Surfaces the qualification gap:
// active leads whose discovery hasn't been done yet — the relance list — plus
// a KPI of coverage and the leads waiting on photos (outcome "OK voir +").
// RLS scopes getAllLeads to the commercial's own leads, so this is naturally
// "mes découvertes".

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div
      style={{
        flex: "1 1 180px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: accent ?? "var(--text-primary)", marginTop: 4 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function SectorChip({ sector }: { sector: Lead["sector"] }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        background: `var(${SECTOR_VAR[sector]})`,
      }}
    >
      {SECTOR_LABEL[sector]}
    </span>
  );
}

function LeadRows({ rows }: { rows: Lead[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
            <th style={{ padding: "8px 10px" }}>Lead</th>
            <th style={{ padding: "8px 10px" }}>Secteur</th>
            <th style={{ padding: "8px 10px" }}>Ville</th>
            <th style={{ padding: "8px 10px" }}>Reçu</th>
            <th style={{ padding: "8px 10px" }}>Dernière action</th>
            <th style={{ padding: "8px 10px" }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <td style={{ padding: "10px" }}>
                <Link href={`/leads/${l.id}`} style={{ color: "var(--color-brand-500)", fontWeight: 600, textDecoration: "none" }}>
                  {l.client}
                </Link>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{l.shortId}</div>
              </td>
              <td style={{ padding: "10px" }}><SectorChip sector={l.sector} /></td>
              <td style={{ padding: "10px" }}>{l.city || "—"}</td>
              <td style={{ padding: "10px" }}>{dateFmt.format(new Date(l.receivedAt))}</td>
              <td style={{ padding: "10px", color: "var(--text-muted)" }}>{l.lastActionLabel || "—"}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>
                <Link href={`/leads/${l.id}`} style={{ color: "var(--color-brand-500)", textDecoration: "none", fontSize: "0.8125rem" }}>
                  Ouvrir →
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "16px 10px", color: "var(--text-muted)" }}>
                Aucun lead ici. 🎉
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function DecouvertePage() {
  const leads = await getAllLeads();
  const active = leads.filter((l) => l.status !== "perdu");
  const pending = active.filter((l) => !l.discoveryDoneAt);
  const done = active.filter((l) => l.discoveryDoneAt);
  // Découverte faite mais pas encore convertie (ni signé, ni encaissé) → à
  // relancer pour transformer.
  const doneToRelance = done.filter((l) => l.status !== "signe" && l.status !== "encaisse");
  const awaitingPhotos = active.filter((l) => l.discoveryOutcome === "ok_plus");
  const coverage = active.length ? Math.round((done.length / active.length) * 100) : 100;

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Découverte</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Phase de qualification avant devis — annonce du prix, issue, demande de photos.
          Relancez les leads dont la découverte n&apos;est pas faite.
        </p>
      </header>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Tile
          label="Découvertes à faire"
          value={String(pending.length)}
          hint="leads actifs sans découverte"
          accent="var(--tone-warning)"
        />
        <Tile label="Découvertes faites" value={String(done.length)} />
        <Tile label="Taux de couverture" value={`${coverage}%`} hint={`${done.length}/${active.length} leads actifs`} />
        <Tile label="En attente de photos" value={String(awaitingPhotos.length)} hint="issue « OK voir + »" />
      </div>

      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-lg)",
          padding: "16px 18px",
        }}
      >
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
          À relancer — découverte non faite
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {pending.length}</span>
        </h2>
        <LeadRows rows={pending} />
      </section>

      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-lg)",
          padding: "16px 18px",
        }}
      >
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
          À relancer — découverte faite
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {doneToRelance.length}</span>
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: -6, marginBottom: 12 }}>
          Découverte terminée, pas encore signé — à relancer pour convertir.
        </p>
        <LeadRows rows={doneToRelance} />
      </section>

      {awaitingPhotos.length > 0 && (
        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-lg)",
            padding: "16px 18px",
          }}
        >
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            En attente de photos ({DISCOVERY_OUTCOME_LABEL.ok_plus})
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {awaitingPhotos.length}</span>
          </h2>
          <LeadRows rows={awaitingPhotos} />
        </section>
      )}
    </div>
  );
}
