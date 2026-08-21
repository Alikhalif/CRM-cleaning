"use client";

import { useRef, useState } from "react";
import styles from "./SignerDevis.module.scss";
import { submitDevisSignature } from "./actions";

type Props = {
  token: string;
  numero: string;
  clientNom: string;
  pdfUrl: string | null;
};

export default function SignerDevis({ token, numero, clientNom, pdfUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [nom, setNom] = useState(clientNom || "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    drawing.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    if (!hasSig) setHasSig(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1b4a";
    ctx.stroke();
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasSig(false);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const img = hasSig ? canvasRef.current?.toDataURL("image/png") : undefined;
      const res = await submitDevisSignature(token, { nom, imageDataUrl: img });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(res.numero);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={styles.page}>
        <div className={`${styles.card} ${styles.doneCard}`}>
          <div className={styles.doneEmoji} aria-hidden>
            ✅
          </div>
          <h1>Merci, c&apos;est signé&nbsp;!</h1>
          <p>
            Votre devis <strong>{done}</strong> a bien été signé « Bon pour accord ».
            Un exemplaire signé vous est transmis par e-mail. Vous pouvez fermer
            cette page.
          </p>
        </div>
      </div>
    );
  }

  const ready = !busy && nom.trim().length > 0 && consent && hasSig;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.head}>
          <div className={styles.brand}>OPTIMIVV DÉMÉNAGEMENT</div>
          <div className={styles.sub}>Signature de votre devis · N° {numero}</div>
        </header>

        {pdfUrl ? (
          <iframe className={styles.pdf} src={pdfUrl} title={`Devis ${numero}`} />
        ) : (
          <div className={styles.pdfEmpty}>Aperçu du devis indisponible.</div>
        )}

        <div className={styles.form}>
          <label className={styles.field}>
            <span>Votre nom</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom et prénom"
            />
          </label>

          <div className={styles.field}>
            <span>Votre signature</span>
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              className={styles.pad}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
            <button type="button" className={styles.clear} onClick={clear}>
              Effacer
            </button>
          </div>

          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Je certifie l&apos;exactitude des informations et j&apos;accepte ce
              devis — <strong>« Bon pour accord »</strong>.
            </span>
          </label>

          {error && (
            <p className={styles.err} role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className={styles.submit}
            disabled={!ready}
            onClick={submit}
          >
            {busy ? "Signature en cours…" : "Signer le devis"}
          </button>
          <p className={styles.legal}>
            En signant, vous acceptez que votre nom, la date, votre signature et
            des données techniques (IP) soient enregistrés comme preuve d&apos;accord.
          </p>
        </div>
      </div>
    </div>
  );
}
