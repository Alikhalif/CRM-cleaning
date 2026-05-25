import Icon from "@/components/Icon/Icon";
import type { Lead, LeadStatus } from "@/lib/leads";
import styles from "./LeadDetail.module.scss";

// CDC §2.2 pipeline visualised as a 6-stage stepper:
//   Lead → Envoyé → Ouvert → Signé → Acompte encaissé → Encaissement final
//
// "Acompte encaissé" maps to documents.type='acompte' with status='paye'
// for the lead. "Encaissement final" maps to documents.type='finale' with
// status='paye'. The stepper highlights the most-advanced stage reached,
// not the lead.status alone — that's how it ends up green on "Acompte
// encaissé" even when the lead.status is still "signe".

type Stage = {
  key: "lead" | "envoye" | "ouvert" | "signe" | "acompte_paye" | "finale_paye";
  label: string;
};

const STAGES: Stage[] = [
  { key: "lead",          label: "Lead" },
  { key: "envoye",        label: "Envoyé" },
  { key: "ouvert",        label: "Ouvert" },
  { key: "signe",         label: "Signé" },
  { key: "acompte_paye",  label: "Acompte encaissé" },
  { key: "finale_paye",   label: "Encaissement final" },
];

// Lead status → minimum stage reached purely from leads.status.
const STATUS_TO_STAGE_INDEX: Record<LeadStatus, number> = {
  lead:      0,
  envoye:    1,
  ouvert:    2,
  signe:     3,
  encaisse:  5, // CDC final: maps to "Encaissement final"
  perdu:    -1, // off-track — handled separately
};

type Props = {
  lead: Lead;
  // Documents already fetched on the page — used to detect paid acompte
  // (stage 4) and paid finale (stage 5) without an extra query.
  docs: { type: "devis" | "acompte" | "finale"; status: string }[];
};

export default function PipelineProgress({ lead, docs }: Props) {
  // Compute reached stage from status + paid invoices.
  let reachedIdx = STATUS_TO_STAGE_INDEX[lead.status];
  const hasPaidAcompte = docs.some((d) => d.type === "acompte" && d.status === "paye");
  const hasPaidFinale  = docs.some((d) => d.type === "finale"  && d.status === "paye");
  if (hasPaidAcompte && reachedIdx < 4) reachedIdx = 4;
  if (hasPaidFinale  && reachedIdx < 5) reachedIdx = 5;

  const lost = lead.status === "perdu";

  return (
    <ol className={styles.progress} data-lost={lost || undefined} aria-label="Avancement du lead">
      {STAGES.map((stage, idx) => {
        const reached = !lost && idx <= reachedIdx;
        const isCurrent = !lost && idx === reachedIdx;
        return (
          <li
            key={stage.key}
            className={styles.progressItem}
            data-state={
              lost ? "lost" :
              reached && !isCurrent ? "done" :
              isCurrent ? "current" :
              "todo"
            }
          >
            <span className={styles.progressDot} aria-hidden="true">
              {reached && !isCurrent ? (
                <Icon name="check" size={12} />
              ) : (
                <span className={styles.progressIndex}>{idx + 1}</span>
              )}
            </span>
            <span className={styles.progressLabel}>{stage.label}</span>
            {idx < STAGES.length - 1 && <span className={styles.progressBar} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
