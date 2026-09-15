"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, CONTRACT_STATUSES,
  PASSAGE_STATUS_GLYPH, PASSAGE_STATUS_LABEL, PASSAGE_STATUSES,
  type Contract, type ContractTemplate,
} from "@/lib/documents/contracts-types";
import { setContractStatus, renewContract, deleteContract, sendContract, updatePassage } from "./contracts-actions";
import ContractForm from "./ContractForm";
import styles from "./ClientDetail.module.scss";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDate = (d: string | null) => (d ? DATE.format(new Date(d)) : "—");
const fmtEur = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("fr-FR")} €`);

export default function ContractsPanel({
  clientId, contracts, templates, prefill,
}: {
  clientId: string;
  contracts: Contract[];
  templates: ContractTemplate[];
  prefill: Record<string, string>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && res.error) alert(res.error);
      router.refresh();
      setBusyId(null);
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.docHead}>
        <h2 className={styles.h2}>Contrats <span className={styles.h2Count}>{contracts.length}</span></h2>
        {templates.length > 0 && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setCreating((v) => !v)}>
            <Icon name="plus" size={14} /> Créer un contrat
          </button>
        )}
      </div>

      {creating && templates.length > 0 && (
        <ContractForm clientId={clientId} templates={templates} prefill={prefill} onDone={() => setCreating(false)} />
      )}

      {contracts.length === 0 ? (
        <p className={styles.empty}>Aucun contrat pour ce client. Cliquez sur « Créer un contrat » pour démarrer.</p>
      ) : (
        <ul className={styles.ctList}>
          {contracts.map((c) => {
            const busy = pending && busyId === c.id;
            return (
              <li key={c.id} className={styles.ctItem}>
                <div className={styles.ctMain}>
                  <div className={styles.ctTitleRow}>
                    <span className={styles.ctStatus} data-tone={CONTRACT_STATUS_TONE[c.status]}>
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </span>
                    <span className={styles.ctTitle}>{c.title}</span>
                    {c.ref && <span className={styles.mono}>{c.ref}</span>}
                  </div>
                  <div className={styles.ctMeta}>
                    {c.startDate && <span>Début {fmtDate(c.startDate)}</span>}
                    {c.endDate && <span>· Fin {fmtDate(c.endDate)}</span>}
                    {c.frequency && <span>· {c.frequency}</span>}
                    {c.passagesPerYear != null && <span>· {c.passagesDone}/{c.passagesPerYear} passages</span>}
                    {c.amount != null && <span>· {fmtEur(c.amount)}</span>}
                    {c.sentAt && <span>· envoyé</span>}
                  </div>

                  {c.passages.length > 0 && (
                    <div className={styles.passRow}>
                      {c.passages.map((p) => (
                        <div key={p.id} className={styles.passChip} data-status={p.status}>
                          <span aria-hidden="true">{PASSAGE_STATUS_GLYPH[p.status]}</span>
                          <span>Passage {p.index}</span>
                          <select
                            value={p.status}
                            disabled={busy}
                            onChange={(e) => run(c.id, () => updatePassage(p.id, { status: e.target.value }))}
                            aria-label={`Statut du passage ${p.index}`}
                          >
                            {PASSAGE_STATUSES.map((s) => <option key={s} value={s}>{PASSAGE_STATUS_LABEL[s]}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.ctActions}>
                  {c.pdfUrl && (
                    <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" className={styles.docLink} title="Voir le PDF">
                      <Icon name="external-link" size={15} />
                    </a>
                  )}
                  <select
                    className={styles.ctStatusSelect}
                    value={c.status}
                    disabled={busy}
                    onChange={(e) => run(c.id, () => setContractStatus(c.id, e.target.value))}
                    aria-label="Changer le statut"
                    title="Changer le statut"
                  >
                    {CONTRACT_STATUSES.map((st) => <option key={st} value={st}>{CONTRACT_STATUS_LABEL[st]}</option>)}
                  </select>
                  <button type="button" className={styles.ctBtn} disabled={busy} onClick={() => run(c.id, () => sendContract(c.id))} title="Envoyer au client">
                    <Icon name="mail" size={14} />
                  </button>
                  <button type="button" className={styles.ctBtn} disabled={busy} onClick={() => run(c.id, () => renewContract(c.id))} title="Renouveler">
                    <Icon name="check" size={14} />
                  </button>
                  <button type="button" className={styles.ctBtnDanger} disabled={busy} onClick={() => { if (confirm("Supprimer ce contrat ?")) run(c.id, () => deleteContract(c.id)); }} title="Supprimer">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
