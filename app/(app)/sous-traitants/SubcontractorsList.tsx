"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SubcoOverviewRow } from "@/lib/subcontractors-server";
import { INSURANCE_STATUS_LABEL, money } from "@/lib/subcontractors-shared";
import s from "./SubcontractorsList.module.scss";

type FilterKey = "all" | "complete" | "incomplete" | "ins_expired" | "ins_soon" | "contract_unsigned" | "missing";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "complete", label: "Dossiers complets" },
  { key: "incomplete", label: "Dossiers incomplets" },
  { key: "missing", label: "Documents manquants" },
  { key: "ins_expired", label: "Assurances expirées" },
  { key: "ins_soon", label: "Bientôt expirées" },
  { key: "contract_unsigned", label: "Contrats non signés" },
];

function Pill({ ok, warn, bad, children }: { ok?: boolean; warn?: boolean; bad?: boolean; children: React.ReactNode }) {
  const cls = ok ? s.ok : warn ? s.warn : bad ? s.bad : s.neutral;
  return <span className={`${s.pill} ${cls}`}>{children}</span>;
}

export default function SubcontractorsList({ rows }: { rows: SubcoOverviewRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const id = r.identity;
      if (needle) {
        const hay = [id.name, id.raisonSociale, id.nomCommercial, id.dirigeant, id.siret, id.email, id.cpVille]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const c = r.conformity;
      switch (filter) {
        case "complete": return c.isComplete;
        case "incomplete": return !c.isComplete;
        case "ins_expired": return c.assurance === "expiree";
        case "ins_soon": return c.assurance === "bientot_expiree";
        case "contract_unsigned": return c.contrat === "non_signe";
        case "missing": return c.kbis === "manquant" || c.cni === "manquant" || c.assurance === "manquante";
        default: return true;
      }
    });
  }, [rows, q, filter]);

  const totalIncomplete = rows.filter((r) => !r.conformity.isComplete).length;

  return (
    <div className={s.wrap}>
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Sous-traitants</h1>
          <p className={s.sub}>
            {rows.length} intervenant{rows.length > 1 ? "s" : ""} · {totalIncomplete} dossier{totalIncomplete > 1 ? "s" : ""} incomplet{totalIncomplete > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      <div className={s.toolbar}>
        <input
          className={s.search}
          placeholder="Rechercher : nom, société, SIRET, dirigeant, ville…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className={s.chips}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${s.chip} ${filter === f.key ? s.chipOn : ""}`}
              onClick={() => setFilter(f.key)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={s.empty}>Aucun sous-traitant ne correspond.</div>
      ) : (
        <div className={s.grid}>
          {filtered.map((r) => {
            const id = r.identity;
            const c = r.conformity;
            return (
              <Link key={id.technicianId} href={`/sous-traitants/${id.technicianId}`} className={s.card}>
                <div className={s.cardHead}>
                  <span className={s.avatar} style={{ background: id.color }}>{id.initials}</span>
                  <div className={s.who}>
                    <span className={s.name}>{id.name}</span>
                    <span className={s.company}>{id.raisonSociale || id.nomCommercial || (id.sectors.join(", ") || "—")}</span>
                  </div>
                  <Pill ok={c.isComplete} bad={!c.isComplete}>{c.isComplete ? "Dossier complet" : "Dossier incomplet"}</Pill>
                </div>

                <div className={s.conf}>
                  <Pill ok={c.kbis === "present"} bad={c.kbis === "manquant"}>Kbis {c.kbis === "present" ? "✓" : "✗"}</Pill>
                  <Pill
                    ok={c.assurance === "valide"}
                    warn={c.assurance === "bientot_expiree"}
                    bad={c.assurance === "expiree" || c.assurance === "manquante"}
                  >Décennale · {INSURANCE_STATUS_LABEL[c.assurance]}</Pill>
                  <Pill ok={c.cni === "present"} bad={c.cni === "manquant"}>CNI {c.cni === "present" ? "✓" : "✗"}</Pill>
                  <Pill ok={c.contrat === "signe"} bad={c.contrat === "non_signe"}>Contrat {c.contrat === "signe" ? "signé" : "non signé"}</Pill>
                </div>

                <div className={s.foot}>
                  <span>{r.interventionsCount} intervention{r.interventionsCount > 1 ? "s" : ""}</span>
                  <span>
                    {r.invoicesCount} facture{r.invoicesCount > 1 ? "s" : ""}
                    {r.outstandingCount > 0 ? ` · ${money(r.outstandingTtc)} à régler` : ""}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
