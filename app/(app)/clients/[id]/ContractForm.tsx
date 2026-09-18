"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon/Icon";
import type { ContractTemplate, FieldValue, TemplateField } from "@/lib/documents/contracts-types";
import { createContract, type CreateContractPayload } from "./contracts-actions";
import styles from "./ClientDetail.module.scss";

const strOf = (v: FieldValue): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const numOf = (v: FieldValue): number | null => {
  const n = Number(strOf(v).replace(",", "."));
  return Number.isFinite(n) && strOf(v) !== "" ? n : null;
};

// Formulaire de contrat GÉNÉRÉ depuis le template (sections + champs), pré-rempli
// à partir de la fiche client (§7). Aucune ressaisie des infos déjà connues.
export default function ContractForm({
  clientId, templates, prefill, onDone,
}: {
  clientId: string;
  templates: ContractTemplate[];
  prefill: Record<string, string>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState<string>(templates[0]?.key ?? "");
  const template = useMemo(() => templates.find((t) => t.key === templateKey) ?? null, [templates, templateKey]);

  const initialValues = (tpl: ContractTemplate | null): Record<string, FieldValue> => {
    const v: Record<string, FieldValue> = {};
    for (const s of tpl?.sections ?? []) {
      for (const f of s.fields) {
        v[f.name] = f.type === "checkgroup" ? [] : (f.prefill ? (prefill[f.prefill] ?? "") : "");
      }
    }
    return v;
  };
  const [title, setTitle] = useState<string>(template?.name ?? "");
  // Échéance = attribut de premier plan du contrat (pas propre à un modèle) :
  // c'est elle qui alimente le KPI « expirent bientôt » et l'alerte de
  // renouvellement (sans date de fin, aucune alerte ne se déclenche).
  const [endDate, setEndDate] = useState<string>("");
  const [values, setValues] = useState<Record<string, FieldValue>>(() => initialValues(template));

  const onTemplateChange = (key: string) => {
    setTemplateKey(key);
    const tpl = templates.find((t) => t.key === key) ?? null;
    setTitle(tpl?.name ?? "");
    setValues(initialValues(tpl));
  };

  const setField = (name: string, value: FieldValue) => setValues((cur) => ({ ...cur, [name]: value }));
  const toggleCheck = (name: string, opt: string) => {
    setValues((cur) => {
      const arr = Array.isArray(cur[name]) ? [...(cur[name] as string[])] : [];
      const i = arr.indexOf(opt);
      if (i >= 0) arr.splice(i, 1); else arr.push(opt);
      return { ...cur, [name]: arr };
    });
  };

  const submit = () => {
    if (!template) { setError("Choisissez un modèle."); return; }
    setError(null);
    const payload: CreateContractPayload = {
      templateKey: template.key,
      title: title.trim() || template.name,
      frequency: strOf(values["frequency"]) || undefined,
      startDate: strOf(values["date_debut"]) || undefined,
      endDate: endDate || undefined,
      amount: numOf(values["tarif"]),
      billingMode: strOf(values["reglement"]) || undefined,
      values,
    };
    startTransition(async () => {
      const res = await createContract(clientId, payload);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
      onDone();
    });
  };

  const renderField = (f: TemplateField) => {
    const v = values[f.name];
    if (f.type === "textarea") {
      return <textarea rows={2} value={strOf(v)} onChange={(e) => setField(f.name, e.target.value)} />;
    }
    if (f.type === "select") {
      return (
        <select value={strOf(v)} onChange={(e) => setField(f.name, e.target.value)}>
          <option value="">—</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === "checkgroup") {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div className={styles.cfCheckgroup}>
          {(f.options ?? []).map((o) => (
            <label key={o} className={`${styles.cfCheck} ${arr.includes(o) ? styles.cfCheckOn : ""}`}>
              <input type="checkbox" checked={arr.includes(o)} onChange={() => toggleCheck(f.name, o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );
    }
    return (
      <input
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        value={strOf(v)}
        placeholder={f.placeholder}
        onChange={(e) => setField(f.name, e.target.value)}
      />
    );
  };

  return (
    <div className={styles.contractForm}>
      <div className={styles.cfTop}>
        <label className={styles.uploadField}>
          <span>Modèle</span>
          <select value={templateKey} onChange={(e) => onTemplateChange(e.target.value)}>
            {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </label>
        <label className={`${styles.uploadField} ${styles.uploadTitle}`}>
          <span>Intitulé</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label
          className={styles.uploadField}
          title="Date de fin du contrat — déclenche l'alerte de renouvellement (J-7) et le KPI « expirent bientôt »."
        >
          <span>Échéance</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>

      {template?.sections.map((sec) => (
        <div key={sec.title} className={styles.cfSection}>
          <p className={styles.cfSectionTitle}>{sec.title}</p>
          <div className={styles.cfGrid}>
            {sec.fields.map((f) => (
              <label key={f.name} className={`${styles.cfField} ${f.full || f.type === "textarea" || f.type === "checkgroup" ? styles.cfFull : ""}`}>
                <span>{f.label}</span>
                {renderField(f)}
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className={styles.uploadError}><Icon name="alert" size={13} /> {error}</p>}
      <div className={styles.cfFoot}>
        <button type="button" className={styles.btn} onClick={onDone} disabled={pending}>Annuler</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submit} disabled={pending}>
          {pending ? "Génération…" : "Créer & générer le PDF"}
        </button>
      </div>
    </div>
  );
}
