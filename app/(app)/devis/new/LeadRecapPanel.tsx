import type { LeadContext } from "@/lib/devis-server";
import {
  DELAI_SOUHAITE_LABEL,
  ETAT_SALETE_LABEL,
  PRICE_RANGE_LABEL,
  REACTION_PRIX_LABEL,
  SECTOR_LABEL,
  SECTOR_VAR,
  STATUT_CLIENT_LABEL,
  formatEUR,
  type DelaiSouhaite,
  type EtatSalete,
  type ReactionPrix,
  type StatutClient,
} from "@/lib/leads";

// Récapitulatif du lead + de sa fiche Découverte, affiché en haut de l'écran
// de génération du devis : le commercial a tout sous les yeux (coordonnées +
// qualification) sans revenir sur la fiche.

type Props = { lead: LeadContext };

const wrap: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--r-lg)",
  padding: "16px 18px",
  marginBottom: "var(--sp-4)",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};
const dim = (v?: string | null) => (v && v.trim() ? v : "—");

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function LeadRecapPanel({ lead }: Props) {
  const priceRange = lead.priceRange ? (PRICE_RANGE_LABEL[lead.priceRange] ?? lead.priceRange) : null;
  const delai = lead.delaiSouhaite ? (DELAI_SOUHAITE_LABEL[lead.delaiSouhaite as DelaiSouhaite] ?? lead.delaiSouhaite) : null;
  const reaction = lead.reactionPrix ? (REACTION_PRIX_LABEL[lead.reactionPrix as ReactionPrix] ?? lead.reactionPrix) : null;
  const statut = lead.statutClient ? (STATUT_CLIENT_LABEL[lead.statutClient as StatutClient] ?? lead.statutClient) : null;
  const salete = lead.etatSalete ? (ETAT_SALETE_LABEL[lead.etatSalete as EtatSalete] ?? lead.etatSalete) : null;

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Lead {lead.shortId} · {lead.clientName}
        </h2>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: `color-mix(in srgb, var(${SECTOR_VAR[lead.sector]}) 16%, transparent)`, color: `var(${SECTOR_VAR[lead.sector]})` }}>
          {SECTOR_LABEL[lead.sector]}
        </span>
      </div>

      {/* Coordonnées */}
      <div style={grid}>
        <Item label="Téléphone" value={dim(lead.phone)} />
        <Item label="Email" value={dim(lead.email)} />
        <Item label="Ville" value={dim(lead.city)} />
        <Item label="Type de prestation" value={dim(lead.typeService)} />
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "14px 0" }} />

      {/* Découverte */}
      <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
        Découverte{lead.discoveryDoneAt ? "" : " — non renseignée"}
      </div>
      <div style={grid}>
        <Item label="Surface" value={lead.surfaceM2 != null ? `${lead.surfaceM2} m²` : "—"} />
        <Item label="Délai souhaité" value={dim(delai)} />
        <Item label="Fourchette de prix" value={dim(priceRange)} />
        <Item label="Prix annoncé" value={lead.announcedPrice != null ? formatEUR(lead.announcedPrice) : "—"} />
        <Item label="Réaction au prix" value={dim(reaction)} />
        <Item label="Statut du client" value={dim(statut)} />
        <Item label="État de saleté" value={dim(salete)} />
        <div>
          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 3 }}>Acompte négocié</div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: lead.acompteNegocie != null ? "var(--color-brand-500)" : "var(--text-primary)" }}>
            {lead.acompteNegocie != null ? `${lead.acompteNegocie} %` : "—"}
          </div>
        </div>
      </div>

      {(lead.contexteIntervention || lead.notes) && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {lead.contexteIntervention && (
            <div>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 3 }}>Contexte de l&apos;intervention</div>
              <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{lead.contexteIntervention}</div>
            </div>
          )}
          {lead.notes && (
            <div>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 3 }}>Notes d&apos;appel</div>
              <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{lead.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
