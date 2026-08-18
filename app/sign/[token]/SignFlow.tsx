"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicSignatureView } from "@/lib/signature-server";
import type { SignatureType } from "@/lib/signature-shared";
import { recordDocumentView, submitSignature } from "./actions";
import styles from "./SignFlow.module.scss";

type Props = { token: string; view: PublicSignatureView };

// Identifiant de session client (aléatoire, pour corréler les événements de la
// piste d'audit). Non sensible.
function newSessionId(): string {
  try { return crypto.randomUUID(); } catch { return `s_${Math.random().toString(36).slice(2)}`; }
}

const STEPS = ["Identité", "Document", "Consentement", "Signature", "Validation"] as const;

export default function SignFlow({ token, view }: Props) {
  const [step, setStep] = useState(0);
  const [sessionId] = useState(newSessionId);
  const viewedRef = useRef(false);
  const [consent, setConsent] = useState(false);
  const [sigType, setSigType] = useState<SignatureType>("drawn");
  const [typedName, setTypedName] = useState(view.recipientName ?? "");
  const [drawnData, setDrawnData] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Marque la consultation du document au passage sur l'étape Document.
  useEffect(() => {
    if (step === 1 && !viewedRef.current) {
      viewedRef.current = true;
      recordDocumentView(token, sessionId).catch(() => {});
    }
  }, [step, token, sessionId]);

  const canNext =
    step === 0 ? true :
    step === 1 ? true :
    step === 2 ? consent :
    step === 3 ? (sigType === "typed" ? typedName.trim().length > 1 : !!drawnData) :
    true;

  const doSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const res = await submitSignature(token, {
      signatureType: sigType,
      typedName: sigType === "typed" ? typedName.trim() : undefined,
      signatureImage: sigType === "drawn" ? drawnData : null,
      consent,
      sessionId,
    });
    setSubmitting(false);
    setConfirming(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(res.ref);
  };

  if (done) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 60 }} aria-hidden>✅</div>
          <h1 className={styles.title}>Document signé</h1>
          <p className={styles.muted}>
            Merci ! Votre signature a bien été enregistrée. Un e-mail de confirmation avec le devis
            signé vous a été envoyé.
          </p>
          <p className={styles.ref}>Référence : {done}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <header className={styles.head}>
          <div>
            <div className={styles.entity}>{view.entityName}</div>
            <h1 className={styles.title}>Signature du devis {view.docNum}</h1>
          </div>
          <div className={styles.amount}>{view.amountTtc.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</div>
        </header>

        <ol className={styles.steps}>
          {STEPS.map((label, i) => (
            <li key={label} className={`${styles.step} ${i === step ? styles.stepOn : ""} ${i < step ? styles.stepDone : ""}`}>
              <span className={styles.stepNum}>{i < step ? "✓" : i + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </li>
          ))}
        </ol>

        <div className={styles.body}>
          {step === 0 && (
            <div className={styles.section}>
              <p className={styles.lead}>Bonjour {view.recipientName ?? ""}, veuillez vérifier votre identité avant de signer.</p>
              <Field label="Nom" value={view.recipientName ?? "—"} />
              <Field label="E-mail" value={view.recipientEmail} />
              {view.acompteAmount ? <Field label="Acompte à régler" value={view.acompteAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} /> : null}
            </div>
          )}

          {step === 1 && (
            <div className={styles.section}>
              <p className={styles.lead}>Consultez l&apos;intégralité du document ci-dessous.</p>
              {view.originalUrl ? (
                <object data={view.originalUrl} type="application/pdf" className={styles.pdf}>
                  <a href={view.originalUrl} target="_blank" rel="noreferrer">Ouvrir le document (PDF)</a>
                </object>
              ) : (
                <p className={styles.muted}>Aperçu indisponible.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className={styles.section}>
              <label className={styles.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{view.consentText}</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className={styles.section}>
              <div className={styles.tabs}>
                <button type="button" className={sigType === "drawn" ? styles.tabOn : styles.tab} onClick={() => setSigType("drawn")}>Signer (tracé)</button>
                <button type="button" className={sigType === "typed" ? styles.tabOn : styles.tab} onClick={() => setSigType("typed")}>Signer (nom)</button>
              </div>
              {sigType === "drawn" ? (
                <SignaturePad onChange={setDrawnData} />
              ) : (
                <div>
                  <input className={styles.input} value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Nom et prénom" />
                  <div className={styles.typedPreview}>{typedName || "Votre nom"}</div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className={styles.section}>
              <p className={styles.lead}>Vérifiez avant de valider :</p>
              <Field label="Signataire" value={view.recipientName ?? "—"} />
              <Field label="Document" value={`Devis ${view.docNum} · ${view.entityName}`} />
              <Field label="Méthode" value={sigType === "drawn" ? "Signature tracée" : `Signature typographique — ${typedName}`} />
              <p className={styles.small}>En validant, vous confirmez votre accord et l&apos;utilisation de la signature électronique.</p>
            </div>
          )}
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          {step > 0 && !submitting && (
            <button type="button" className={styles.btnGhost} onClick={() => setStep((s) => s - 1)}>Retour</button>
          )}
          {step < 4 && (
            <button type="button" className={styles.btnPrimary} disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continuer</button>
          )}
          {step === 4 && (
            <button type="button" className={styles.btnPrimary} disabled={submitting} onClick={() => setConfirming(true)}>
              Signer et valider le document
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !submitting) setConfirming(false); }}>
          <div className={styles.confirm}>
            <h2>Confirmer la signature</h2>
            <p className={styles.muted}>Cette action est définitive. Confirmez-vous la signature du devis {view.docNum} ?</p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} disabled={submitting} onClick={() => setConfirming(false)}>Annuler</button>
              <button type="button" className={styles.btnPrimary} disabled={submitting} onClick={doSubmit}>
                {submitting ? "Signature…" : "Confirmer et signer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  );
}

// Canvas de signature — doigt (tactile), souris, trackpad. Exporte un PNG.
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (ctx) { ctx.scale(dpr, dpr); ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#111827"; }
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e: React.PointerEvent) => { drawing.current = true; last.current = pos(e); (e.target as Element).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d");
    const p = pos(e);
    if (ctx && last.current) { ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    last.current = p;
    if (empty) setEmpty(false);
  };
  const end = () => {
    drawing.current = false; last.current = null;
    if (!empty && ref.current) onChange(ref.current.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); ctx?.clearRect(0, 0, c.width, c.height);
    setEmpty(true); onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        className={styles.canvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{ touchAction: "none" }}
      />
      <div className={styles.padRow}>
        <span className={styles.small}>Signez dans le cadre avec le doigt ou la souris.</span>
        <button type="button" className={styles.btnGhost} onClick={clear}>Effacer</button>
      </div>
    </div>
  );
}
