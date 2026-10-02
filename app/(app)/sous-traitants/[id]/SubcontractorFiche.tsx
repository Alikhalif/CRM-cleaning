"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SubcoDetail } from "@/lib/subcontractors-server";
import {
  INSURANCE_STATUS_LABEL, INVOICE_STATUS_LABEL, DOC_TYPE_LABEL,
  formatFrDate, money, type SubcontractorDocType, type InvoiceStatus,
} from "@/lib/subcontractors-shared";
import {
  saveSubcontractorProfile, uploadSubcontractorDocument, setDocumentContractSigned,
  deleteSubcontractorDocument, uploadSubcontractorInvoice, updateInvoiceStatus, deleteSubcontractorInvoice,
} from "../actions";
import s from "./SubcontractorFiche.module.scss";

type Tab = "identite" | "documents" | "interventions" | "factures" | "timeline";
const TABS: { key: Tab; label: string }[] = [
  { key: "identite", label: "Identité" },
  { key: "documents", label: "Documents & Conformité" },
  { key: "interventions", label: "Historique interventions" },
  { key: "factures", label: "Factures" },
  { key: "timeline", label: "Timeline" },
];

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  return <span className={`${s.pill} ${s[tone]}`}>{children}</span>;
}

export default function SubcontractorFiche({ detail }: { detail: SubcoDetail }) {
  const { identity: id, conformity: c } = detail;
  const [tab, setTab] = useState<Tab>("documents");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>, after?: () => void) {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error);
      else { after?.(); router.refresh(); }
    });
  }

  const insTone = c.assurance === "valide" ? "ok" : c.assurance === "bientot_expiree" ? "warn" : "bad";

  return (
    <div className={s.wrap}>
      <div className={s.crumb}><Link href="/sous-traitants">Sous-traitants</Link> / {id.name}</div>

      <header className={s.head}>
        <span className={s.avatar} style={{ background: id.color }}>{id.initials}</span>
        <div className={s.who}>
          <h1 className={s.name}>{id.name}{!id.isActive && <span className={s.inactive}> (inactif)</span>}</h1>
          <p className={s.company}>{id.raisonSociale || id.nomCommercial || "Société non renseignée"}{id.siret ? ` · SIRET ${id.siret}` : ""}</p>
          <div className={s.sectors}>{id.sectors.map((sec) => <span key={sec} className={s.sector}>{sec}</span>)}</div>
        </div>
        <div className={s.synthesis}>
          <Pill tone={c.isComplete ? "ok" : "bad"}>{c.isComplete ? "DOSSIER COMPLET" : "DOSSIER INCOMPLET"}</Pill>
          {c.issues.length > 0 && <ul className={s.issues}>{c.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      </header>

      <nav className={s.tabs}>
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`${s.tab} ${tab === t.key ? s.tabOn : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </nav>

      {err && <div className={s.error}>{err}</div>}
      {pending && <div className={s.pendingBar}>Traitement…</div>}

      {tab === "identite" && <IdentiteTab detail={detail} run={run} />}

      {tab === "documents" && (
        <div className={s.section}>
          <div className={s.confGrid}>
            <div className={s.confItem}><span>Kbis</span><Pill tone={c.kbis === "present" ? "ok" : "bad"}>{c.kbis === "present" ? "Présent" : "Manquant"}</Pill></div>
            <div className={s.confItem}><span>Assurance décennale</span><Pill tone={insTone}>{INSURANCE_STATUS_LABEL[c.assurance]}{c.assuranceEndDate ? ` (${formatFrDate(c.assuranceEndDate)})` : ""}</Pill></div>
            <div className={s.confItem}><span>Carte d&apos;identité dirigeant</span><Pill tone={c.cni === "present" ? "ok" : "bad"}>{c.cni === "present" ? "Présente" : "Manquante"}</Pill></div>
            <div className={s.confItem}><span>Contrat de sous-traitance</span><Pill tone={c.contrat === "signe" ? "ok" : "bad"}>{c.contrat === "signe" ? "Signé" : "Non signé"}</Pill></div>
          </div>

          <AddDocumentForm technicianId={id.technicianId} run={run} />

          <h3 className={s.h3}>Documents ({detail.documents.length})</h3>
          {detail.documents.length === 0 ? <p className={s.muted}>Aucun document.</p> : (
            <div className={s.docList}>
              {detail.documents.map((d) => (
                <div key={d.id} className={`${s.docRow} ${d.isCurrent ? "" : s.old}`}>
                  <div className={s.docMain}>
                    <span className={s.docType}>{d.docTypeLabel}{d.version > 1 ? ` · v${d.version}` : ""}{!d.isCurrent ? " · ancienne version" : ""}</span>
                    <span className={s.docTitle}>{d.title}</span>
                    <span className={s.docMeta}>
                      {d.docType === "assurance_decennale" && d.endDate ? `Échéance ${formatFrDate(d.endDate)}` : d.issuedDate ? `Daté du ${formatFrDate(d.issuedDate)}` : ""}
                      {d.insurer ? ` · ${d.insurer}` : ""}{d.contractNumber ? ` · n° ${d.contractNumber}` : ""}
                      {d.docType === "contrat_sous_traitance" ? ` · ${d.status === "signe" ? "signé" : "non signé"}` : ""}
                    </span>
                  </div>
                  <div className={s.docActions}>
                    {d.url && <a href={d.url} target="_blank" rel="noreferrer" className={s.link}>Ouvrir</a>}
                    {d.docType === "contrat_sous_traitance" && d.isCurrent && (
                      <button type="button" className={s.link} onClick={() => run(() => setDocumentContractSigned(d.id, d.status !== "signe"))}>
                        {d.status === "signe" ? "Marquer non signé" : "Marquer signé"}
                      </button>
                    )}
                    <button type="button" className={s.danger} onClick={() => run(() => deleteSubcontractorDocument(d.id))}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "interventions" && (
        <div className={s.section}>
          <h3 className={s.h3}>Interventions ({detail.interventions.length})</h3>
          {detail.interventions.length === 0 ? <p className={s.muted}>Aucune intervention rattachée.</p> : (
            <div className={s.table}>
              {detail.interventions.map((it) => (
                <div key={it.dossierId} className={s.intRow}>
                  <div className={s.intMain}>
                    <span className={s.intRef}>{it.shortId ?? "Dossier"} · {it.clientName ?? "Client"}</span>
                    <span className={s.docMeta}>
                      {it.city ? `${it.city} · ` : ""}{it.plannedAt ? `Planifié ${formatFrDate(it.plannedAt)}` : "Non planifié"}
                      {it.realizedAt ? ` · Réalisé ${formatFrDate(it.realizedAt)}` : ""} · {it.mediaCount} photo(s)/vidéo(s)
                    </span>
                    <span className={s.docMeta}>
                      {it.devisNum ? `Devis ${it.devisNum}` : ""}{it.finaleNum ? ` · Facture ${it.finaleNum}` : ""}
                      {it.invoice ? ` · Facture ST ${it.invoice.numero ?? ""} (${INVOICE_STATUS_LABEL[it.invoice.status]})` : ""}
                    </span>
                  </div>
                  <div className={s.docActions}>
                    <Pill tone="neutral">{it.status}</Pill>
                    <Link href={`/leads/${it.leadId}`} className={s.link}>Ouvrir le dossier</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "factures" && (
        <div className={s.section}>
          <AddInvoiceForm technicianId={id.technicianId} interventions={detail.interventions} run={run} />
          <h3 className={s.h3}>Factures reçues ({detail.invoices.length})</h3>
          {detail.invoices.length === 0 ? <p className={s.muted}>Aucune facture.</p> : (
            <div className={s.table}>
              {detail.invoices.map((inv) => (
                <div key={inv.id} className={s.intRow}>
                  <div className={s.intMain}>
                    <span className={s.intRef}>{inv.numero ?? "Facture"} {inv.interventionLabel ? `· ${inv.interventionLabel}` : ""}</span>
                    <span className={s.docMeta}>
                      Reçue {formatFrDate(inv.receivedAt)}{inv.invoiceDate ? ` · datée ${formatFrDate(inv.invoiceDate)}` : ""}
                      {" · "}{money(inv.amountTtc)} TTC{inv.amountHt != null ? ` (${money(inv.amountHt)} HT)` : ""}
                      {inv.paidAt ? ` · réglée ${formatFrDate(inv.paidAt)}` : ""}
                    </span>
                  </div>
                  <div className={s.docActions}>
                    <select className={s.select} value={inv.status} onChange={(e) => run(() => updateInvoiceStatus(inv.id, e.target.value as InvoiceStatus))}>
                      {(["recue", "a_regler", "reglee", "litige"] as InvoiceStatus[]).map((st) => <option key={st} value={st}>{INVOICE_STATUS_LABEL[st]}</option>)}
                    </select>
                    {inv.url && <a href={inv.url} target="_blank" rel="noreferrer" className={s.link}>Ouvrir</a>}
                    <button type="button" className={s.danger} onClick={() => run(() => deleteSubcontractorInvoice(inv.id))}>Suppr.</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className={s.section}>
          <h3 className={s.h3}>Chronologie</h3>
          {detail.timeline.length === 0 ? <p className={s.muted}>Aucun événement.</p> : (
            <ul className={s.timeline}>
              {detail.timeline.map((e, i) => (
                <li key={i} className={s.tlItem}>
                  <span className={s.tlDate}>{formatFrDate(e.at)}</span>
                  <span className={`${s.tlDot} ${s[`tl_${e.kind}`] ?? ""}`} />
                  <span className={s.tlLabel}>{e.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Onglet Identité ─────────────────────────────────────────────────────────
function IdentiteTab({ detail, run }: { detail: SubcoDetail; run: (fn: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>) => void }) {
  const id = detail.identity;
  const [form, setForm] = useState({
    raisonSociale: id.raisonSociale ?? "", nomCommercial: id.nomCommercial ?? "", dirigeant: id.dirigeant ?? "",
    siret: id.siret ?? "", siren: id.siren ?? "", adresse: id.adresse ?? "", cpVille: id.cpVille ?? "",
    phone: id.phone ?? "", notes: id.notes ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className={s.section}>
      <div className={s.readGrid}>
        <div><span className={s.k}>Intervenant</span><span className={s.v}>{id.name}</span></div>
        <div><span className={s.k}>Email</span><span className={s.v}>{id.email ?? "—"}</span></div>
        <div><span className={s.k}>Secteurs</span><span className={s.v}>{id.sectors.join(", ") || "—"}</span></div>
        <div><span className={s.k}>Code postal base</span><span className={s.v}>{id.basePostalCode ?? "—"}</span></div>
        <div><span className={s.k}>Départements desservis</span><span className={s.v}>{id.serviceDepartments.join(", ") || "—"}</span></div>
        <div><span className={s.k}>Statut</span><span className={s.v}>{id.isActive ? "Actif" : "Inactif"}</span></div>
      </div>
      <p className={s.muted}>L&apos;identité de base provient de la fiche Intervenant (Paramètres). Les informations administratives ci-dessous sont propres à ce module.</p>

      <form className={s.form} onSubmit={(e) => { e.preventDefault(); run(() => saveSubcontractorProfile(id.technicianId, form)); }}>
        <div className={s.formGrid}>
          <label>Raison sociale<input value={form.raisonSociale} onChange={set("raisonSociale")} /></label>
          <label>Nom commercial<input value={form.nomCommercial} onChange={set("nomCommercial")} /></label>
          <label>Dirigeant<input value={form.dirigeant} onChange={set("dirigeant")} /></label>
          <label>SIRET<input value={form.siret} onChange={set("siret")} /></label>
          <label>SIREN<input value={form.siren} onChange={set("siren")} /></label>
          <label>Téléphone<input value={form.phone} onChange={set("phone")} /></label>
          <label className={s.wide}>Adresse<input value={form.adresse} onChange={set("adresse")} /></label>
          <label>Code postal / Ville<input value={form.cpVille} onChange={set("cpVille")} /></label>
          <label className={s.wide}>Notes<textarea value={form.notes} onChange={set("notes")} rows={2} /></label>
        </div>
        <button type="submit" className={s.primary}>Enregistrer l&apos;identité</button>
      </form>
    </div>
  );
}

// ── Formulaire ajout document ───────────────────────────────────────────────
function AddDocumentForm({ technicianId, run }: { technicianId: string; run: (fn: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>, after?: () => void) => void }) {
  const [docType, setDocType] = useState<SubcontractorDocType>("kbis");
  const [open, setOpen] = useState(false);

  return (
    <div className={s.addBox}>
      {!open ? (
        <button type="button" className={s.primary} onClick={() => setOpen(true)}>+ Ajouter un document</button>
      ) : (
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => uploadSubcontractorDocument(technicianId, fd), () => setOpen(false));
          }}
        >
          <div className={s.formGrid}>
            <label>Type
              <select name="docType" value={docType} onChange={(e) => setDocType(e.target.value as SubcontractorDocType)}>
                {(Object.keys(DOC_TYPE_LABEL) as SubcontractorDocType[]).map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label>Intitulé<input name="title" defaultValue={DOC_TYPE_LABEL[docType]} required /></label>
            <label>Date du document<input type="date" name="issuedDate" /></label>
            <label className={s.wide}>Fichier (PDF ou image)<input type="file" name="file" accept="application/pdf,image/*" /></label>

            {docType === "assurance_decennale" && (
              <>
                <label>Compagnie d&apos;assurance<input name="insurer" /></label>
                <label>N° de contrat<input name="contractNumber" /></label>
                <label>Début de validité<input type="date" name="startDate" /></label>
                <label>Fin de validité<input type="date" name="endDate" /></label>
                <label className={s.wide}>Activités garanties<input name="activities" /></label>
              </>
            )}
            {docType === "contrat_sous_traitance" && (
              <label className={s.check}><input type="checkbox" name="signed" /> Contrat signé</label>
            )}
            <label className={s.wide}>Notes<input name="notes" /></label>
          </div>
          <div className={s.formActions}>
            <button type="submit" className={s.primary}>Ajouter</button>
            <button type="button" className={s.ghost} onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Formulaire ajout facture ────────────────────────────────────────────────
function AddInvoiceForm({ technicianId, interventions, run }: {
  technicianId: string;
  interventions: SubcoDetail["interventions"];
  run: (fn: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>, after?: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.addBox}>
      {!open ? (
        <button type="button" className={s.primary} onClick={() => setOpen(true)}>+ Ajouter une facture du sous-traitant</button>
      ) : (
        <form
          className={s.form}
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => uploadSubcontractorInvoice(technicianId, fd), () => setOpen(false)); }}
        >
          <div className={s.formGrid}>
            <label>N° facture<input name="numero" /></label>
            <label>Intervention rattachée
              <select name="dossierId" defaultValue="">
                <option value="">— Aucune —</option>
                {interventions.map((it) => <option key={it.dossierId} value={it.dossierId}>{it.shortId ?? "Dossier"} · {it.clientName ?? ""}</option>)}
              </select>
            </label>
            <label>Date facture<input type="date" name="invoiceDate" /></label>
            <label>Date de réception<input type="date" name="receivedAt" /></label>
            <label>Montant HT<input name="amountHt" inputMode="decimal" /></label>
            <label>TVA<input name="vatAmount" inputMode="decimal" /></label>
            <label>Montant TTC<input name="amountTtc" inputMode="decimal" /></label>
            <label>Statut
              <select name="status" defaultValue="recue">
                {(["recue", "a_regler", "reglee", "litige"] as InvoiceStatus[]).map((st) => <option key={st} value={st}>{INVOICE_STATUS_LABEL[st]}</option>)}
              </select>
            </label>
            <label className={s.wide}>Fichier (PDF ou image)<input type="file" name="file" accept="application/pdf,image/*" /></label>
            <label className={s.wide}>Notes<input name="notes" /></label>
          </div>
          <div className={s.formActions}>
            <button type="submit" className={s.primary}>Enregistrer la facture</button>
            <button type="button" className={s.ghost} onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}
