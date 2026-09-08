"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CertificatHotte.module.scss";
import type { CertPrefill } from "@/lib/cert-hotte/prefill";
import { CERT_OPERATIONS, type OpState, type CertHotteInput } from "@/lib/cert-hotte/types";

const SEG: { v: OpState; short: string }[] = [
  { v: "fait", short: "Fait" },
  { v: "nc", short: "N/C" },
  { v: "nr", short: "Non fait" },
];

const frToIso = (fr: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((fr || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const isoToFr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const todayIso = (): string => new Date().toISOString().slice(0, 10);

export default function CertificatHotte({ prefill }: { prefill: CertPrefill }) {
  const initDate = frToIso(prefill.dateIntervention) || todayIso();
  const [dateInt, setDateInt] = useState(initDate);
  const [tech, setTech] = useState(prefill.technicien || prefill.technicians[0] || "");
  const [ops, setOps] = useState<OpState[]>(CERT_OPERATIONS.map(() => "fait"));
  const [autre, setAutre] = useState("");
  const [passages, setPassages] = useState<1 | 2>(1);
  const [p1, setP1] = useState(initDate);
  const [p2, setP2] = useState("");
  const [obs, setObs] = useState("");

  const [busy, setBusy] = useState(false);
  const [genNum, setGenNum] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [joinFac, setJoinFac] = useState(Boolean(prefill.factureNum));
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const input: CertHotteInput = useMemo(
    () => ({
      client: prefill.client,
      dossierRef: prefill.dossierRef || undefined,
      factureNum: prefill.factureNum || undefined,
      dateIntervention: isoToFr(dateInt),
      technicien: tech || undefined,
      operations: ops,
      autre: autre.trim() ? { label: autre.trim(), state: "fait" } : null,
      passages,
      passage1: isoToFr(p1),
      passage2: passages === 2 ? isoToFr(p2) : undefined,
      observations: obs.trim() || undefined,
    }),
    [prefill, dateInt, tech, ops, autre, passages, p1, p2, obs],
  );
  const dataKey = useMemo(() => JSON.stringify(input), [input]);

  // Aperçu PDF réel (le certificat final), régénéré en debounce 500 ms.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/certificat-hotte", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: input, mode: "preview" }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        /* aborted / network — ignore */
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  useEffect(() => () => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
  }, []);

  const setOp = (i: number, v: OpState) =>
    setOps((prev) => prev.map((x, j) => (j === i ? v : x)));

  async function generer() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/certificat-hotte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: input,
          mode: "final",
          dossierId: prefill.dossierId,
          leadId: prefill.leadId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Erreur ${res.status}`);
      }
      const num = res.headers.get("X-Cert-Numero");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificat-hotte-${num || "optimivv"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setGenNum(num);
      setFlash({ tone: "ok", msg: `Certificat ${num} généré et archivé au dossier.` });
    } catch (e) {
      setFlash({ tone: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function envoyer() {
    setBusy(true);
    try {
      const res = await fetch("/api/certificat-hotte/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: input,
          dossierId: prefill.dossierId,
          leadId: prefill.leadId,
          joinFacture: joinFac,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.detail || j.error || `Erreur ${res.status}`);
      setConfirming(false);
      setGenNum(j.numero);
      setFlash({
        tone: "ok",
        msg: j.facture_jointe
          ? `Envoyé à ${j.envoye_a} (certificat + facture).`
          : `Certificat envoyé à ${j.envoye_a}.`,
      });
    } catch (e) {
      setFlash({ tone: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const c = prefill.client;
  const hasEmail = Boolean(c.email);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Certificat Hotte</h1>
          <p className={styles.subtitle}>
            {c.etablissement} · dossier {prefill.dossierRef || "—"} · nettoyage de hotte professionnelle
          </p>
        </div>
      </header>

      <div className={styles.layout}>
        {/* ---------------- Formulaire ---------------- */}
        <div className={styles.form}>
          <section className={styles.card}>
            <header><span className={styles.step}>1</span><span className={styles.h}>Établissement</span><span className={styles.spacer} /><span className={styles.prefill}>✓ prérempli</span></header>
            <div className={styles.body}>
              <div className={styles.kv}>
                <div className={`${styles.field} ${styles.wide}`}><label>Établissement</label><div className={`${styles.val} ${styles.locked}`}>{c.etablissement || "—"}</div></div>
                {c.raisonSociale && <div className={`${styles.field} ${styles.wide}`}><label>Raison sociale</label><div className={`${styles.val} ${styles.locked}`}>{c.raisonSociale}</div></div>}
                <div className={`${styles.field} ${styles.wide}`}><label>Adresse</label><div className={`${styles.val} ${styles.locked}`}>{[c.adresse, [c.cp, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</div></div>
                <div className={styles.field}><label>Responsable</label><div className={`${styles.val} ${styles.locked}`}>{c.responsable || "—"}</div></div>
                <div className={styles.field}><label>Téléphone</label><div className={`${styles.val} ${styles.locked}`}>{c.telephone || "—"}</div></div>
                <div className={`${styles.field} ${styles.wide}`}><label>Email</label><div className={`${styles.val} ${styles.locked}`}>{c.email || "— (requis pour l'envoi)"}</div></div>
                <div className={styles.field}><label>N° dossier</label><div className={`${styles.val} ${styles.locked}`}>{prefill.dossierRef || "—"}</div></div>
                <div className={styles.field}><label>N° facture</label><div className={`${styles.val} ${styles.locked}`}>{prefill.factureNum || "—"}</div></div>
              </div>
              <p className={styles.hint}>Repris automatiquement du dossier — aucune ressaisie.</p>
            </div>
          </section>

          <section className={styles.card}>
            <header><span className={styles.step}>2</span><span className={styles.h}>Intervention</span></header>
            <div className={styles.body}>
              <div className={styles.row}>
                <div className={styles.field}><label>Date d&apos;intervention</label><input type="date" value={dateInt} onChange={(e) => setDateInt(e.target.value)} /></div>
                <div className={styles.field}><label>Technicien</label>
                  <select value={tech} onChange={(e) => setTech(e.target.value)}>
                    {prefill.technicians.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <header><span className={styles.step}>3</span><span className={styles.h}>Opérations effectuées</span><span className={styles.spacer} />
              <button type="button" className={styles.mini} onClick={() => setOps(CERT_OPERATIONS.map(() => "fait"))}>Tout « Fait »</button>
            </header>
            <div className={styles.body}>
              <div className={styles.ops}>
                {CERT_OPERATIONS.map((label, i) => (
                  <div className={styles.op} key={i}>
                    <span className={styles.opLbl}>{label}</span>
                    <span className={styles.seg} role="group" aria-label={label}>
                      {SEG.map(({ v, short }) => (
                        <button type="button" key={v} data-v={v} aria-pressed={ops[i] === v} onClick={() => setOp(i, v)}>{short}</button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.field}><label>Autre (précisez)</label><input type="text" value={autre} onChange={(e) => setAutre(e.target.value)} placeholder="ex. filtres à charbon remplacés" /></div>
            </div>
          </section>

          <section className={styles.card}>
            <header><span className={styles.step}>4</span><span className={styles.h}>Nombre de passages</span></header>
            <div className={styles.body}>
              <div className={styles.passtoggle} role="group" aria-label="Nombre de passages">
                <button type="button" aria-pressed={passages === 1} onClick={() => setPassages(1)}>1 passage</button>
                <button type="button" aria-pressed={passages === 2} onClick={() => setPassages(2)}>2 passages</button>
              </div>
              <div className={styles.passdates}>
                <div className={styles.field}><label>Passage n°1</label><input type="date" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
                {passages === 2 && <div className={styles.field}><label>Passage n°2</label><input type="date" value={p2} onChange={(e) => setP2(e.target.value)} /></div>}
              </div>
              <p className={styles.hint}>Le 2ᵉ passage n&apos;apparaît sur le certificat que s&apos;il est sélectionné.</p>
            </div>
          </section>

          <section className={styles.card}>
            <header><span className={styles.step}>5</span><span className={styles.h}>Observations / réserves</span><span className={styles.spacer} /><span className={styles.opt}>facultatif</span></header>
            <div className={styles.body}>
              <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Anomalie constatée, élément non accessible, réparation recommandée…" />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.body}>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={generer} disabled={busy}>
                  {busy ? "Génération…" : "Valider et générer le certificat"}
                </button>
                {genNum && (
                  <div className={styles.postgen}>
                    <div className={styles.genline}>✓ Certificat <strong>{genNum}</strong> archivé au dossier</div>
                    <div className={styles.btnRow}>
                      <a className={styles.btnGhost} href={`/api/certificat-hotte/pdf?dossier=${prefill.dossierId}`} target="_blank" rel="noopener noreferrer">Télécharger</a>
                      <button type="button" className={styles.btnGhost} disabled={!hasEmail} title={hasEmail ? undefined : "Aucun e-mail client"} onClick={() => setConfirming(true)}>Envoyer au client</button>
                    </div>
                  </div>
                )}
              </div>
              {flash && <p className={flash.tone === "ok" ? styles.flashOk : styles.flashErr}>{flash.msg}</p>}
            </div>
          </section>
        </div>

        {/* ---------------- Aperçu PDF ---------------- */}
        <div className={styles.preview}>
          <div className={styles.previewCap}><span className={styles.dot} /> Certificat A4 — aperçu · <strong>1 page</strong></div>
          {previewUrl ? (
            <iframe title="Aperçu du certificat" src={previewUrl} className={styles.iframe} />
          ) : (
            <div className={styles.previewEmpty}>Génération de l&apos;aperçu…</div>
          )}
        </div>
      </div>

      {confirming && (
        <div className={styles.modalBackdrop} onClick={() => setConfirming(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Envoyer le certificat ?</h2>
            <p>Le certificat <strong>{genNum}</strong> sera envoyé à <strong className={styles.dest}>{c.email}</strong>.</p>
            <label className={styles.optRow}><input type="checkbox" checked={joinFac} onChange={(e) => setJoinFac(e.target.checked)} /> Joindre la facture {prefill.factureNum ? <strong>{prefill.factureNum}</strong> : "(si disponible)"}</label>
            <div className={styles.actions} style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirming(false)}>Annuler</button>
              <button type="button" className={styles.btnPrimary} onClick={envoyer} disabled={busy}>{busy ? "Envoi…" : "Envoyer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
