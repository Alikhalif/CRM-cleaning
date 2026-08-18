"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import { formatEUR } from "@/lib/leads";
import { SIGNATURE_STATUS_LABEL, SIGNATURE_STATUS_TONE, isSignatureTerminal, type SignatureStatus } from "@/lib/signature-shared";
import type { SignatureDetail } from "@/lib/signature-server";
import { cancelSignature } from "@/app/(app)/_shared/signature-actions";

const card: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-lg)", padding: 18 };
const h2: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 };
const rowSt: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.875rem" };
const label: React.CSSProperties = { color: "var(--text-muted)" };

function DocLink({ href, icon, children }: { href: string | null; icon: "document" | "check"; children: React.ReactNode }) {
  if (!href) return <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{children} — indisponible</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: "var(--r-sm)", background: "var(--bg-surface-2)", border: "1px solid var(--border-strong)", color: "var(--text-primary)", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
      <Icon name={icon} size={15} /> {children}
    </a>
  );
}

export default function SignatureDetailView({ detail }: { detail: SignatureDetail }) {
  const router = useRouter();
  const { row, events, originalUrl, signedUrl, certificateUrl } = detail;
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const onCancel = () => {
    if (!confirm("Annuler cette demande de signature ? Le lien deviendra inutilisable.")) return;
    setBusy(true);
    startTransition(async () => {
      await cancelSignature(row.id);
      setBusy(false);
      router.refresh();
    });
  };

  const canCancel = !isSignatureTerminal(row.status as SignatureStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>{row.ref}</h1>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: SIGNATURE_STATUS_TONE[row.status as SignatureStatus] }} />
            {SIGNATURE_STATUS_LABEL[row.status as SignatureStatus]}
          </span>
        </div>
        {canCancel && (
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ padding: "8px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--tone-danger)", background: "transparent", color: "var(--tone-danger)", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
            {busy ? "…" : "Annuler la demande"}
          </button>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <section style={card}>
          <div style={h2}>Client &amp; devis</div>
          <div style={rowSt}><span style={label}>Client</span><span style={{ fontWeight: 600 }}>{row.clientName}</span></div>
          <div style={rowSt}><span style={label}>E-mail</span><span>{row.recipientEmail}</span></div>
          {row.recipientPhone && <div style={rowSt}><span style={label}>Téléphone</span><span>{row.recipientPhone}</span></div>}
          <div style={rowSt}><span style={label}>Société</span><span>{row.entityName}</span></div>
          <div style={rowSt}><span style={label}>Devis</span><span>{row.docNum}</span></div>
          <div style={rowSt}><span style={label}>Commercial</span><span>{row.ownerName ?? "—"}</span></div>
          <div style={{ ...rowSt, borderBottom: "none" }}><span style={label}>Montant</span><span style={{ fontWeight: 700 }}>{formatEUR(row.amountTtc)}</span></div>
        </section>

        <section style={card}>
          <div style={h2}>Documents &amp; preuve</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <DocLink href={originalUrl} icon="document">Devis original</DocLink>
            <DocLink href={signedUrl} icon="check">Devis signé</DocLink>
            <DocLink href={certificateUrl} icon="document">Certificat de preuve</DocLink>
          </div>
          {(row.originalSha256 || row.signedSha256) && (
            <div style={{ marginTop: 12, fontSize: "0.6875rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
              {row.originalSha256 && <div>SHA-256 original : {row.originalSha256}</div>}
              {row.signedSha256 && <div>SHA-256 signé : {row.signedSha256}</div>}
              {row.signerIp && <div>IP signataire : {row.signerIp}</div>}
            </div>
          )}
        </section>
      </div>

      <section style={card}>
        <div style={h2}>Historique</div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {events.map((e, i) => (
            <li key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < events.length - 1 ? "1px solid var(--border-subtle)" : "none", fontSize: "0.875rem" }}>
              <span style={{ width: 150, color: "var(--text-muted)", fontFamily: "var(--font-geist-mono, monospace)", fontSize: "0.75rem", flexShrink: 0 }}>{e.at}</span>
              <span style={{ flex: 1, color: "var(--text-primary)" }}>{e.label}</span>
              {e.device && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{e.device}{e.ip ? ` · ${e.ip}` : ""}</span>}
            </li>
          ))}
          {events.length === 0 && <li style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Aucun événement.</li>}
        </ol>
      </section>
    </div>
  );
}
