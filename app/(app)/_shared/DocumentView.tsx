import Link from "next/link";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  PAYMENT_TERMS,
  formatEUR,
} from "@/lib/leads";
import type { DocumentDetail } from "@/lib/leads-mock";
import DocumentActions from "./DocumentActions";
import styles from "./DocumentView.module.scss";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type Props = { detail: DocumentDetail };

export default function DocumentView({ detail }: Props) {
  const { doc, entity, lead } = detail;
  const isInvoice = doc.type !== "devis";
  const isUnsigned = doc.type === "devis" && doc.status !== "signe" && doc.status !== "refuse";

  // Aggregate VAT by rate so we can display the breakdown legally.
  const vatBreakdown = aggregateVat(doc.lines);

  // Validity (devis) or échéance (factures): default 30 days from issue.
  const validUntil = new Date(doc.issuedAt);
  validUntil.setDate(validUntil.getDate() + 30);

  return (
    <div className={styles.page}>
      <DocumentActions doc={doc} />

      <article className={styles.document} aria-label={`${DOC_TYPE_LABEL[doc.type]} ${doc.num}`}>
        <header className={styles.head}>
          <div className={styles.entity}>
            <div
              className={styles.entityLogo}
              style={{ ["--ec" as string]: entity.color }}
              aria-hidden="true"
            >
              {entity.legalName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 3)
                .toUpperCase()}
            </div>
            <div className={styles.entityInfo}>
              <p className={styles.entityName}>{entity.legalName}</p>
              <p className={styles.entityMeta}>
                {entity.legalForm} · SIRET {entity.siret}
                <br />
                APE {entity.apeCode} · TVA {entity.vatNumber}
              </p>
              <p className={styles.entityMeta}>
                {entity.addressLine}
                <br />
                {entity.postalCode} {entity.city}
                <br />
                {entity.contactEmail} · {entity.contactPhone}
              </p>
            </div>
          </div>

          <div className={styles.docMeta}>
            <h1 className={styles.docType}>{DOC_TYPE_LABEL[doc.type].toUpperCase()}</h1>
            <p className={styles.docNum}>{doc.num}</p>
            <span className={styles.docStatus} data-status={doc.status}>
              {DOC_STATUS_LABEL[doc.status]}
            </span>
            <dl className={styles.docDates}>
              <div>
                <dt>Émis le</dt>
                <dd>{DATE.format(new Date(doc.issuedAt))}</dd>
              </div>
              <div>
                <dt>{isInvoice ? "Échéance" : "Validité"}</dt>
                <dd>{DATE.format(validUntil)}</dd>
              </div>
              {doc.relatedDevisNum && (
                <div>
                  <dt>Devis source</dt>
                  <dd className={styles.mono}>{doc.relatedDevisNum}</dd>
                </div>
              )}
            </dl>
          </div>
        </header>

        <section className={styles.client}>
          <p className={styles.clientLabel}>Adressé à</p>
          <p className={styles.clientName}>{lead.client}</p>
          <p className={styles.clientMeta}>
            {lead.address}
            <br />
            {lead.postalCode} {lead.city}
            <br />
            {lead.email} · {lead.phone}
            {lead.isCompany && lead.siret && (
              <>
                <br />
                SIRET {lead.siret}
                {lead.vatIntra && ` · TVA ${lead.vatIntra}`}
              </>
            )}
          </p>
        </section>

        {isUnsigned && (
          <aside className={styles.signatureBanner}>
            <strong>Signature électronique</strong> — Ce devis est destiné à être signé en ligne via
            le lien adressé par email. Aucune valeur engageante avant signature.
          </aside>
        )}

        <section className={styles.linesSection}>
          <table className={styles.lines}>
            <thead>
              <tr>
                <th>Description</th>
                <th className={styles.tNum}>Qté</th>
                <th>Unité</th>
                <th className={styles.tNum}>P.U. HT</th>
                <th className={styles.tNum}>TVA</th>
                <th className={styles.tNum}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.label}</td>
                  <td className={styles.tNum}>{line.quantity}</td>
                  <td>{line.unit}</td>
                  <td className={styles.tNum}>{formatEUR(line.unitPriceHt)}</td>
                  <td className={styles.tNum}>{line.vatRate} %</td>
                  <td className={styles.tNum}>{formatEUR(line.totalHt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.totalsRow}>
          <div className={styles.terms}>
            <p className={styles.termsLabel}>Conditions de paiement</p>
            <p>{PAYMENT_TERMS[doc.paymentTermSlug].label}</p>
            <p className={styles.termsBank}>
              Règlement par virement sur le compte&nbsp;:
              <br />
              <span className={styles.mono}>{maskIban(entity.iban)}</span> · BIC {entity.bic}
            </p>
            {lead.lostReason && doc.type === "devis" && doc.status === "refuse" && (
              <p className={styles.termsRefuse}>Motif de refus : {lead.lostReason}</p>
            )}
          </div>

          <div className={styles.totals}>
            <Row label="Total HT" value={formatEUR(doc.totalHt)} />
            {vatBreakdown.map((v) => (
              <Row
                key={v.rate}
                label={`TVA ${v.rate} %`}
                value={formatEUR(v.amount)}
                muted
              />
            ))}
            <Row label="Total TTC" value={formatEUR(doc.totalTtc)} bold />
            {doc.type === "devis" && doc.acompteAmount ? (
              <>
                <Row
                  label={`Acompte (${doc.acomptePct ?? 30} %)`}
                  value={formatEUR(doc.acompteAmount)}
                  highlight
                />
                <Row
                  label="Solde dû à la livraison"
                  value={formatEUR(doc.totalTtc - doc.acompteAmount)}
                  muted
                />
              </>
            ) : null}
            {doc.type === "finale" && (
              <Row
                label="Net à payer"
                value={formatEUR(doc.totalTtc)}
                highlight
              />
            )}
            {doc.type === "acompte" && (
              <Row
                label="Net à payer (TTC)"
                value={formatEUR(doc.totalTtc)}
                highlight
              />
            )}
          </div>
        </section>

        <footer className={styles.footer}>
          <p>{entity.legalMentions}</p>
          <p className={styles.footerLink}>
            Document généré depuis CGK CRM ·{" "}
            <Link href={`/leads/${lead.id}`} className={styles.link} data-no-print>
              Voir le lead {lead.shortId}
            </Link>
          </p>
        </footer>
      </article>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  muted,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) {
  const cls = [
    styles.totalRow,
    muted && styles.totalRowMuted,
    bold && styles.totalRowBold,
    highlight && styles.totalRowHighlight,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <span>{label}</span>
      <span className={styles.totalValue}>{value}</span>
    </div>
  );
}

function aggregateVat(lines: { totalHt: number; vatRate: number }[]) {
  const map = new Map<number, number>();
  for (const l of lines) {
    map.set(l.vatRate, (map.get(l.vatRate) ?? 0) + (l.totalHt * l.vatRate) / 100);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, amount]) => ({ rate, amount: Math.round(amount * 100) / 100 }));
}

// Display IBANs with most digits hidden, per CDC §8.5.
function maskIban(iban: string): string {
  const compact = iban.replace(/\s/g, "");
  if (compact.length < 8) return iban;
  const head = compact.slice(0, 4);
  const tail = compact.slice(-4);
  return `${head} •••• •••• •••• •••• ${tail}`;
}
