import Link from "next/link";
import styles from "./Decouverte.module.scss";
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

// Date ET heure, en heure de Paris : deux découvertes du même jour doivent
// se distinguer dans la liste.
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Création de la découverte, à défaut l'arrivée du dossier. */
const creeLe = (l: Lead): string => l.discoveryStartedAt ?? l.receivedAt;

/**
 * Du plus récent au plus ancien, sur la date de CRÉATION.
 *
 * getAllLeads trie par dernière action : une vieille découverte simplement
 * rouverte remontait donc en tête. Le client demande l'inverse — l'ordre
 * doit rester stable quand on consulte un dossier.
 */
function parCreationDecroissante(a: Lead, b: Lead): number {
  const ta = new Date(creeLe(a)).getTime();
  const tb = new Date(creeLe(b)).getTime();
  const va = Number.isFinite(ta) ? ta : Number.NEGATIVE_INFINITY;
  const vb = Number.isFinite(tb) ? tb : Number.NEGATIVE_INFINITY;
  if (va !== vb) return vb - va;
  // Départage stable : la liste ne se réorganise pas d'un affichage à l'autre.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Secteur</th>
            <th>Ville</th>
            <th>Créé le</th>
            <th>Dernière action</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td data-label="Lead">
                <span>
                  <Link href={`/leads/${l.id}`} className={styles.client}>{l.client}</Link>
                  <span className={styles.ref}> {l.shortId}</span>
                </span>
              </td>
              <td data-label="Secteur"><SectorChip sector={l.sector} /></td>
              <td data-label="Ville">{l.city || "—"}</td>
              <td data-label="Créé le">{dateFmt.format(new Date(creeLe(l)))}</td>
              <td data-label="Dernière action" className={styles.muted}>{l.lastActionLabel || "—"}</td>
              <td data-label="" className={styles.right}>
                <Link href={`/leads/${l.id}`} className={styles.open}>Ouvrir →</Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className={styles.empty}>
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
  // Classement chronologique décroissant appliqué une fois, en amont : les
  // trois listes qui en découlent en héritent.
  const active = leads
    .filter((l) => l.status !== "perdu")
    .sort(parCreationDecroissante);
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
