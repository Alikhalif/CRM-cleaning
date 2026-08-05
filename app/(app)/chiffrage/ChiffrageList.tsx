"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  CONSULT_STATUS_LABEL,
  type ConsultationOverview,
  type ConsultationStatus,
} from "@/lib/consultations-shared";
import { attributeConsultation, closeConsultation, relanceConsultation } from "./actions";

type Props = { consultations: ConsultationOverview[] };

const EN_COURS: ConsultationStatus[] = ["envoyee", "repondue"];
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });

function daysBetween(aIso: string, bIso: string): number {
  return Math.max(0, Math.round((+new Date(bIso) - +new Date(aIso)) / 86400000));
}

const STATUS_COLOR: Record<ConsultationStatus, string> = {
  envoyee: "var(--tone-info)",
  repondue: "var(--color-brand-500)",
  retenue: "var(--tone-success)",
  refusee: "var(--tone-danger)",
  expiree: "var(--text-muted)",
};

const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.75rem", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.3 };
const td: React.CSSProperties = { padding: "9px 10px", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle", whiteSpace: "nowrap" };

export default function ChiffrageList({ consultations }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"en_cours" | "historique">("en_cours");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => {
    const filtered = consultations.filter((c) =>
      tab === "en_cours" ? EN_COURS.includes(c.status) : !EN_COURS.includes(c.status),
    );
    // Regroupe par dossier (comparaison des offres) puis montant croissant.
    return filtered.sort((a, b) => {
      if (a.leadShortId !== b.leadShortId) return a.leadShortId < b.leadShortId ? -1 : 1;
      const ma = a.montantPropose ?? Infinity, mb = b.montantPropose ?? Infinity;
      if (ma !== mb) return ma - mb;
      return +new Date(b.sentAt) - +new Date(a.sentAt);
    });
  }, [consultations, tab]);

  const enCoursCount = consultations.filter((c) => EN_COURS.includes(c.status)).length;
  const histoCount = consultations.length - enCoursCount;

  const run = (id: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null); setBusyId(id);
    startTransition(async () => {
      const r = await fn();
      setBusyId(null);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  };

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, background: "var(--bg-surface-2)", padding: 4, borderRadius: "var(--r-md)", marginBottom: 12 }}>
        {(["en_cours", "historique"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem",
              background: tab === t ? "var(--bg-elevated)" : "transparent", color: tab === t ? "var(--text-primary)" : "var(--text-muted)" }}>
            {t === "en_cours" ? `En cours (${enCoursCount})` : `Historique (${histoCount})`}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--tone-danger)", fontSize: "0.875rem", marginBottom: 8 }} role="alert"><Icon name="alert" size={14} /> {error}</p>}

      <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "var(--bg-surface-2)" }}>
              <th style={th}>Statut</th>
              <th style={th}>Dossier</th>
              <th style={th}>Client</th>
              <th style={th}>Prestation</th>
              <th style={th}>Intervenant</th>
              <th style={th}>Montant</th>
              <th style={th}>Dispos</th>
              <th style={th}>Envoyée</th>
              <th style={th}>Souhaitée</th>
              <th style={th}>Délai</th>
              <th style={th}>Nb</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[c.status] }} />
                    {CONSULT_STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td style={{ ...td }}>
                  <Link href={`/leads/${c.leadId}?tab=media`} style={{ color: "var(--color-brand-500)", textDecoration: "none", fontWeight: 600 }}>{c.leadShortId}</Link>
                </td>
                <td style={td}>{c.clientName}</td>
                <td style={td}>{c.sectorLabel}</td>
                <td style={td}>{c.intervenantName ?? c.intervenantEmail}</td>
                <td style={{ ...td, fontWeight: 600, color: c.montantPropose != null ? "var(--tone-success)" : "var(--text-muted)" }}>
                  {c.montantPropose != null ? `${c.montantPropose} €` : "—"}
                </td>
                <td style={{ ...td, whiteSpace: "normal", maxWidth: 140 }}>{c.disponibilites ?? "—"}</td>
                <td style={td}>{dateFmt.format(new Date(c.sentAt))}</td>
                <td style={td}>{c.delaiLabel ?? "—"}</td>
                <td style={td}>
                  {c.respondedAt ? `${daysBetween(c.sentAt, c.respondedAt)} j` : `${daysBetween(c.sentAt, new Date().toISOString())} j`}
                  {c.relances > 0 && <span style={{ color: "var(--tone-warning)", fontSize: 11 }}> · {c.relances} relance(s)</span>}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span title="Intervenants consultés pour ce dossier" style={{ fontWeight: 600 }}>{c.siblingCount}</span>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {tab === "en_cours" ? (
                    <span style={{ display: "inline-flex", gap: 8 }}>
                      <button type="button" disabled={busyId === c.id} onClick={() => run(c.id, () => relanceConsultation(c.id))}
                        style={{ background: "none", border: "none", color: "var(--color-brand-500)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Relancer</button>
                      <button type="button" disabled={busyId === c.id} onClick={() => run(c.id, () => attributeConsultation(c.id))}
                        style={{ background: "none", border: "none", color: "var(--tone-success)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Attribuer</button>
                      <button type="button" disabled={busyId === c.id} onClick={() => { if (confirm("Clôturer cette demande ?")) run(c.id, () => closeConsultation(c.id, "refusee")); }}
                        style={{ background: "none", border: "none", color: "var(--tone-danger)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Clôturer</button>
                    </span>
                  ) : (
                    <Link href={`/leads/${c.leadId}?tab=media`} style={{ color: "var(--color-brand-500)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>Détail →</Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={12} style={{ ...td, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
                {tab === "en_cours" ? "Aucune demande de chiffrage en cours." : "Aucune demande terminée."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
        Les lignes d&apos;un même dossier sont regroupées (montant croissant) pour comparer les offres. « Nb » = intervenants consultés pour ce dossier.
        Le montant et les disponibilités se saisissent depuis l&apos;onglet Photos &amp; Vidéos du lead (bouton « Réponse »).
      </p>
    </div>
  );
}
