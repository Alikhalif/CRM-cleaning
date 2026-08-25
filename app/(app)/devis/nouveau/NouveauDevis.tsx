"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./NouveauDevis.module.scss";
import type { DevisPrefill } from "@/lib/devis/prefill";
import type { DevisInput } from "@/lib/devis/types";
import {
  renderTemplate,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
  type TemplateCategory,
} from "@/lib/message-templates-shared";
import type { MessageTemplate } from "@/lib/message-templates-server";
import { formatEUR } from "@/lib/leads";

type Props = {
  prefill: DevisPrefill | null;
  leadId: string | null;
  // Modèles de relance e-mail (portée rôle/profil, filtrés au secteur du lead)
  // et variables réelles du lead pour l'interpolation.
  templates: MessageTemplate[];
  vars: Record<string, string>;
  // Modèle graphique du PDF (secteur du lead) : "nettoyage" → design OPTIMIVV
  // NETTOYAGE ; "demenagement" (défaut) → design déménagement.
  template?: "demenagement" | "nettoyage";
};

type Form = {
  nom: string;
  adresse: string;
  adresse2: string;
  telephone: string;
  email: string;
  lieu_intervention: string;
  date_prevue: string;
  description: string;
  montant_ht: string; // champ texte — vide = « …… € HT » à compléter
  validite_jours: string;
  acompte_pct: string;
};

// Montant en euros, format français à 2 décimales (« 1 250,00 € »). Utilisé
// dans le récapitulatif de tarif ; formatEUR (lib/leads) arrondit à l'entier,
// insuffisant pour un devis.
const fmtEUR2 = (n: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// Conversions pour le sélecteur de date natif (<input type="date"> parle ISO
// AAAA-MM-JJ) ↔ le format JJ/MM/AAAA attendu par le PDF.
const frToIso = (fr: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const isoToFr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

// Montants dérivés du formulaire — source unique partagée par formToInput,
// buildProEmail et mergedVars.
function deriveMontants(f: Form): {
  montantHt: number | null;
  acomptePct: number | null;
  acompteAmt: number | null;
} {
  const raw = f.montant_ht.trim().replace(",", ".");
  const n = Number(raw);
  const montantHt = raw !== "" && Number.isFinite(n) ? n : null;
  const acomptePct = f.acompte_pct ? Number(f.acompte_pct) : null;
  const acompteAmt =
    montantHt != null && acomptePct
      ? Math.round(montantHt * acomptePct) / 100
      : null;
  return { montantHt, acomptePct, acompteAmt };
}

function formToInput(f: Form): DevisInput {
  return {
    client: {
      nom: f.nom.trim(),
      adresse: f.adresse.trim() || undefined,
      adresse2: f.adresse2.trim() || undefined,
      telephone: f.telephone.trim() || undefined,
      email: f.email.trim() || undefined,
    },
    lieu_intervention: f.lieu_intervention.trim() || undefined,
    date_prevue: f.date_prevue.trim() || undefined,
    description: f.description || undefined,
    montant_ht: deriveMontants(f).montantHt,
    validite_jours: f.validite_jours ? Number(f.validite_jours) : undefined,
    acompte_pct: f.acompte_pct ? Number(f.acompte_pct) : undefined,
  };
}

// E-mail professionnel composé à partir des DONNÉES DU DEVIS en cours (client,
// lieu, date, prestation, montant, acompte, validité). Les champs vides sont
// omis. Sert d'option par défaut dans le sélecteur de la modale d'envoi.
const PRO_TEMPLATE_ID = "__pro__";

function buildProEmail(
  f: Form,
  societe: string,
  commercial: string,
  docType: "devis" | "facture",
): { subject: string; body: string } {
  const kind = docType === "facture" ? "facture" : "devis";
  const { montantHt, acomptePct, acompteAmt } = deriveMontants(f);

  const lines: string[] = [];
  lines.push(`Bonjour ${f.nom.trim() || "Madame, Monsieur"},`);
  lines.push("");
  lines.push(
    `Suite à votre demande, veuillez trouver ci-joint votre ${kind} pour la prestation suivante :`,
  );
  lines.push("");
  if (f.description.trim()) lines.push(`• Prestation : ${f.description.trim()}`);
  if (f.lieu_intervention.trim())
    lines.push(`• Lieu d'intervention : ${f.lieu_intervention.trim()}`);
  if (f.date_prevue.trim()) lines.push(`• Date prévue : ${f.date_prevue.trim()}`);
  if (montantHt != null) lines.push(`• Montant : ${formatEUR(montantHt)} HT`);
  if (acomptePct)
    lines.push(
      `• Acompte à la commande : ${acomptePct} %` +
        (acompteAmt != null ? ` (${formatEUR(acompteAmt)})` : ""),
    );
  lines.push(`• Validité de l'offre : ${f.validite_jours || "30"} jours`);
  lines.push("");
  lines.push(
    "Pour l'accepter, il vous suffit de nous retourner le devis signé avec la mention « Bon pour accord », en réponse à cet e-mail.",
  );
  lines.push("");
  lines.push("Nous restons à votre disposition pour toute question ou ajustement.");
  lines.push("");
  lines.push("Bien cordialement,");
  if (commercial) lines.push(commercial);
  lines.push(societe);

  return {
    subject: `Votre ${kind} déménagement — ${societe}`,
    body: lines.join("\n"),
  };
}

export default function NouveauDevis({ prefill, leadId, templates, vars, template = "demenagement" }: Props) {
  const [form, setForm] = useState<Form>({
    nom: prefill?.client.nom ?? "",
    adresse: prefill?.client.adresse ?? "",
    adresse2: prefill?.client.adresse2 ?? "",
    telephone: prefill?.client.telephone ?? "",
    email: prefill?.client.email ?? "",
    lieu_intervention: prefill?.lieu_intervention ?? "",
    date_prevue: "",
    description: prefill?.description ?? "",
    montant_ht: "",
    validite_jours: "30",
    acompte_pct: "30",
  });

  const [docType, setDocType] = useState<"devis" | "facture">("devis");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; msg: string } | null>(
    null,
  );
  const lastUrlRef = useRef<string | null>(null);

  // Relance e-mail : modèle choisi + objet/message interpolés avec les vraies
  // données du lead. « Confirmer l'envoi » reste désactivé tant qu'un choix
  // n'est pas fait (objet + message non vides).
  const [templateId, setTemplateId] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const groupedTemplates = useMemo(() => {
    const order = (c: TemplateCategory) => {
      const i = TEMPLATE_CATEGORIES.indexOf(c);
      return i === -1 ? TEMPLATE_CATEGORIES.length : i;
    };
    const byCat = new Map<TemplateCategory, MessageTemplate[]>();
    for (const t of templates) {
      const arr = byCat.get(t.category) ?? [];
      arr.push(t);
      byCat.set(t.category, arr);
    }
    return [...byCat.entries()]
      .sort((a, b) => order(a[0]) - order(b[0]))
      .map(([cat, list]) => ({
        cat,
        label: TEMPLATE_CATEGORY_LABEL[cat],
        list: [...list].sort(
          (x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name),
        ),
      }));
  }, [templates]);

  // Variables réelles enrichies avec les DONNÉES DU FORMULAIRE en cours (nom,
  // téléphone, e-mail, adresse, montant, acompte) — pour que les modèles de
  // relance reflètent exactement le devis en préparation. Les valeurs vides
  // retombent sur la baseline serveur (données du lead).
  const mergedVars = useMemo(() => {
    const v: Record<string, string> = { ...vars };
    const setIf = (k: string, val: string) => {
      if (val) v[k] = val;
    };
    const nomTrim = form.nom.trim();
    setIf("client.nom_complet", nomTrim);
    const parts = nomTrim.split(/\s+/).filter(Boolean);
    if (parts.length) {
      v["client.prenom"] = parts[0];
      v["client.nom"] = parts.slice(1).join(" ");
    }
    setIf("client.telephone", form.telephone.trim());
    setIf("client.email", form.email.trim());
    setIf(
      "client.adresse",
      [form.adresse, form.adresse2].map((s) => s.trim()).filter(Boolean).join(", "),
    );
    setIf("client.ville", form.adresse2.trim());

    const { montantHt, acomptePct, acompteAmt } = deriveMontants(form);
    if (acomptePct) v["acompte.pct"] = `${acomptePct} %`;
    if (montantHt != null) v["montant.total"] = formatEUR(montantHt);
    if (acompteAmt != null) v["montant.acompte"] = formatEUR(acompteAmt);
    if (montantHt != null && acompteAmt != null) {
      v["montant.solde"] = formatEUR(montantHt - acompteAmt);
    }
    return v;
  }, [vars, form]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === PRO_TEMPLATE_ID) {
      const pro = buildProEmail(
        form,
        "OPTIMIVV Déménagement",
        mergedVars["commercial.nom"] || "",
        docType,
      );
      setEmailSubject(pro.subject);
      setEmailBody(pro.body);
      return;
    }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (t.subject) setEmailSubject(renderTemplate(t.subject, mergedVars));
    setEmailBody(renderTemplate(t.body, mergedVars));
  };

  // `template` pilote le modèle graphique du PDF côté serveur (aperçu, émission,
  // envoi, signature passent tous par genererDevisBuffer, qui dispatche dessus).
  const input = useMemo(() => ({ ...formToInput(form), template }), [form, template]);
  const dataKey = useMemo(() => JSON.stringify(input), [input]);
  // Récapitulatif de tarif affiché en direct (Total HT / acompte € / solde).
  const montants = useMemo(() => deriveMontants(form), [form]);

  // Aperçu : régénéré en debounce 600 ms (pas à chaque frappe) via un <iframe>
  // sur un blob PDF. Mode "preview" côté API → aucun numéro consommé.
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/devis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: input, mode: "preview", docType }),
            signal: controller.signal,
          });
          if (!res.ok) return;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
          lastUrlRef.current = url;
          setPreviewUrl(url);
        } catch {
          /* abort / réseau — ignoré, l'aperçu suivant réessaiera */
        }
      })();
    }, 600);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [dataKey, input, docType]);

  // Nettoyage du dernier blob au démontage.
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function telecharger() {
    if (!form.nom.trim()) {
      setFlash({ tone: "err", msg: "Le nom du client est obligatoire." });
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: input, mode: "final", affaire: leadId, docType }),
      });
      if (!res.ok) {
        setFlash({ tone: "err", msg: "Échec de la génération (" + res.status + ")." });
        return;
      }
      const numero = res.headers.get("X-Devis-Numero") || "";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}-${numero || "optimivv"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const label = docType === "facture" ? "Facture" : "Devis";
      setFlash({ tone: "ok", msg: `${label} ${numero} généré(e) et archivé(e).` });
    } catch (e) {
      setFlash({ tone: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function envoyer() {
    setConfirming(false);
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/devis/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: input,
          affaire: leadId,
          docType,
          sujet: emailSubject.trim(),
          corps: emailBody,
        }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        numero?: string;
        envoye_a?: string;
        statut?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !j.ok) {
        setFlash({
          tone: "err",
          msg:
            j.error === "email_failed"
              ? "Envoi échoué : " + (j.detail || "vérifiez la configuration e-mail.")
              : "Échec de l'envoi (" + (j.error || res.status) + ").",
        });
        return;
      }
      const label = docType === "facture" ? "Facture" : "Devis";
      const suffix = j.statut === "envoye" ? " · lead passé à « Devis envoyé »" : "";
      setFlash({
        tone: "ok",
        msg: `${label} ${j.numero} envoyé(e) à ${j.envoye_a} et archivé(e).${suffix}`,
      });
    } catch (e) {
      setFlash({ tone: "err", msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <h1 className={styles.title}>
            Nouveau {docType === "facture" ? "facture" : "devis"} —{" "}
            {template === "nettoyage" ? "OPTIMIVV NETTOYAGE" : "OPTIMIVV DÉMÉNAGEMENT"}
          </h1>
          <div className={styles.toggle} role="group" aria-label="Type de document">
            <button
              type="button"
              className={docType === "devis" ? styles.toggleActive : styles.toggleBtn}
              onClick={() => setDocType("devis")}
            >
              Devis
            </button>
            <button
              type="button"
              className={docType === "facture" ? styles.toggleActive : styles.toggleBtn}
              onClick={() => setDocType("facture")}
            >
              Facture
            </button>
          </div>
        </div>
        <p className={styles.subtitle}>
          {template === "nettoyage"
            ? "Nettoyage · Désinfection · Décontamination"
            : "Déménagement · Débarras · Intervention spécialisée"}
          {leadId ? " · prérempli depuis l'affaire" : ""}
        </p>
      </header>

      <div className={styles.layout}>
        {/* ---------------------------------------------------- Formulaire */}
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <fieldset className={styles.group}>
            <legend>Client</legend>
            <label className={styles.field}>
              <span>Nom / Société *</span>
              <input value={form.nom} onChange={set("nom")} placeholder="Mme Sarah Benali" />
            </label>
            <label className={styles.field}>
              <span>Adresse</span>
              <input value={form.adresse} onChange={set("adresse")} placeholder="14 rue des Chartrons" />
            </label>
            <label className={styles.field}>
              <span>Code postal / Ville</span>
              <input value={form.adresse2} onChange={set("adresse2")} placeholder="33000 Bordeaux" />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Téléphone</span>
                <input value={form.telephone} onChange={set("telephone")} placeholder="06 12 34 56 78" />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input value={form.email} onChange={set("email")} placeholder="client@example.com" type="email" />
              </label>
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Intervention</legend>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Lieu d&apos;intervention</span>
                <input value={form.lieu_intervention} onChange={set("lieu_intervention")} placeholder="Bordeaux (33) → Mérignac (33)" />
              </label>
              <label className={styles.field}>
                <span>Date prévue</span>
                <input
                  type="date"
                  value={frToIso(form.date_prevue)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date_prevue: isoToFr(e.target.value) }))
                  }
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Description de la prestation</span>
              <textarea rows={6} value={form.description} onChange={set("description")} placeholder="Déménagement complet d'un T3…" />
            </label>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Tarif & conditions</legend>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Montant HT</span>
                <div className={styles.inputEuro}>
                  <input value={form.montant_ht} onChange={set("montant_ht")} placeholder="0,00" inputMode="decimal" />
                  <span className={styles.euroSuffix}>€ HT</span>
                </div>
              </label>
              <label className={styles.field}>
                <span>Validité (jours)</span>
                <input value={form.validite_jours} onChange={set("validite_jours")} inputMode="numeric" />
              </label>
              <label className={styles.field}>
                <span>Acompte (%)</span>
                <input value={form.acompte_pct} onChange={set("acompte_pct")} inputMode="numeric" />
              </label>
            </div>

            {/* Récapitulatif calculé en direct : Total HT, acompte € et solde.
                Pour ces secteurs en franchise de TVA, TTC = HT. */}
            <div className={styles.recap} aria-live="polite">
              <div className={styles.recapRow}>
                <span>Total HT</span>
                <strong>{montants.montantHt != null ? fmtEUR2(montants.montantHt) : "—"}</strong>
              </div>
              <div className={styles.recapRow}>
                <span>
                  Acompte{montants.acomptePct != null ? ` (${montants.acomptePct} %)` : ""}
                </span>
                <strong>{montants.acompteAmt != null ? fmtEUR2(montants.acompteAmt) : "—"}</strong>
              </div>
              <div className={`${styles.recapRow} ${styles.recapTotal}`}>
                <span>Solde à la livraison</span>
                <strong>
                  {montants.montantHt != null && montants.acompteAmt != null
                    ? fmtEUR2(montants.montantHt - montants.acompteAmt)
                    : "—"}
                </strong>
              </div>
            </div>
          </fieldset>

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={telecharger} disabled={busy}>
              Télécharger
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (!form.nom.trim()) return setFlash({ tone: "err", msg: "Le nom du client est obligatoire." });
                if (!form.email.trim()) return setFlash({ tone: "err", msg: "L'email du client est obligatoire pour l'envoi." });
                // Pré-remplit l'e-mail professionnel avec les données du devis.
                applyTemplate(PRO_TEMPLATE_ID);
                setConfirming(true);
              }}
              disabled={busy}
            >
              Envoyer au client
            </button>
          </div>

          {flash && (
            <p className={flash.tone === "ok" ? styles.flashOk : styles.flashErr}>{flash.msg}</p>
          )}
        </form>

        {/* ---------------------------------------------------- Aperçu PDF */}
        <div className={styles.preview}>
          {previewUrl ? (
            <iframe title="Aperçu du devis" src={previewUrl} className={styles.iframe} />
          ) : (
            <div className={styles.previewEmpty}>Génération de l&apos;aperçu…</div>
          )}
        </div>
      </div>

      {/* Confirmation d'envoi — relecture du destinataire en clair. */}
      {confirming && (
        <div className={styles.modalBackdrop} onClick={() => setConfirming(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Envoyer {docType === "facture" ? "la facture" : "le devis"} ?</h2>
            <p>
              {docType === "facture"
                ? "La facture va être générée, archivée et envoyée par e-mail à"
                : "Le devis va être généré, archivé et envoyé par e-mail à"}
              &nbsp;:
              <strong className={styles.dest}>{form.email.trim()}</strong>
            </p>

            {/* Modèle de relance prérempli avec les vraies données du lead. */}
            <label className={styles.field}>
              <span>Modèle e-mail</span>
              <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value={PRO_TEMPLATE_ID}>E-mail professionnel (devis)</option>
                {groupedTemplates.map((g) => (
                  <optgroup key={g.cat} label={g.label}>
                    {g.list.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {templates.length === 0 && (
              <p className={styles.hint}>
                Aucun modèle e-mail pour votre profil — rédigez l&apos;objet et le
                message ci-dessous (ou créez des modèles dans Paramètres →
                Templates).
              </p>
            )}

            <label className={styles.field}>
              <span>Objet</span>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Objet de l'e-mail"
              />
            </label>
            <label className={styles.field}>
              <span>Message</span>
              <textarea
                rows={7}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Choisissez un modèle ou rédigez le message…"
              />
            </label>

            <p className={styles.warn}>
              {docType === "facture" ? "Une facture part" : "Un devis part"} chez un
              vrai client — vérifiez l&apos;adresse et le message avant de confirmer.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirming(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={envoyer}
                disabled={busy || !emailSubject.trim() || !emailBody.trim()}
                title={
                  !emailSubject.trim() || !emailBody.trim()
                    ? "Choisissez un modèle ou rédigez l'objet et le message"
                    : undefined
                }
              >
                Confirmer l&apos;envoi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
