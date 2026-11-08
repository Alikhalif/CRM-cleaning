// Actions attendues du back-office — logique PURE (aucune I/O), testée par
// scripts/recette-check/actions-back-office.ts.
//
// Décision du client du 2026-11-09 : alertes immédiates, actives tant que
// l'action n'est pas faite, escalade paramétrable, aucun doublon.
//
// Trois fonctions, et elles suffisent :
//   attendues()   — à partir de l'ÉTAT, quelles actions DEVRAIENT être ouvertes ;
//   reconcilier() — comparé aux actions ouvertes : quoi ouvrir, fermer, escalader ;
//   lireConfig()  — les délais, bornés, avec leurs valeurs initiales.
// Aucune ne connaît la notion de « lu » : c'est voulu.

import { PAYMENT_TERMS, type PaymentTermSlug } from "@/lib/leads";

export type TypeAction =
  | "dossier.a_planifier" | "dossier.a_valider" | "facture.a_preparer"
  | "facture.a_emettre" | "facture.impayee" | "acompte.impaye";

// ── Configuration — valeurs initiales DOCUMENTÉES, modifiables par le Super
// Admin (/settings/integrations), bornées pour qu'une faute de frappe ne
// puisse ni noyer l'équipe ni faire taire une alerte pendant un an. ─────────
export type ConfigEscalade = {
  /** Heures avant remontée au Super Admin, par type d'action. */
  escaladeHeures: Record<TypeAction, number>;
  /** Jours après l'ÉCHÉANCE avant qu'une facture finale soit « impayée ». */
  factureImpayeeApresEcheanceJours: number;
  /** Jours après l'ÉMISSION avant qu'un acompte soit « impayé ». */
  acompteImpayeApresJours: number;
};

export const CONFIG_INITIALE: ConfigEscalade = {
  escaladeHeures: {
    "dossier.a_planifier": 48,  // signé, pas planifié depuis 2 jours
    "dossier.a_valider": 48,    // terminé, pas validé depuis 2 jours
    "facture.a_preparer": 72,   // validé, pas facturé depuis 3 jours
    "facture.a_emettre": 48,    // facture préparée, pas émise depuis 2 jours
    "facture.impayee": 360,     // impayée depuis 15 jours
    "acompte.impaye": 168,      // acompte impayé depuis 7 jours
  },
  factureImpayeeApresEcheanceJours: 0,
  acompteImpayeApresJours: 7,
};

export const BORNES = { heures: [1, 2160] as const, jours: [0, 365] as const };

export const CLE_CONFIG = "escalade_actions_back_office";

const borne = (v: unknown, [min, max]: readonly [number, number], defaut: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : defaut;
};

/** Lit une valeur brute d'`app_settings` : tout ce qui manque ou déborde retombe sur l'initial. */
export function lireConfig(brut: unknown): ConfigEscalade {
  const b = (brut && typeof brut === "object" ? brut : {}) as Partial<ConfigEscalade>;
  const h = (b.escaladeHeures ?? {}) as Partial<Record<TypeAction, unknown>>;
  const escaladeHeures = Object.fromEntries(
    (Object.keys(CONFIG_INITIALE.escaladeHeures) as TypeAction[]).map((t) => [
      t, borne(h[t], BORNES.heures, CONFIG_INITIALE.escaladeHeures[t]),
    ]),
  ) as Record<TypeAction, number>;
  return {
    escaladeHeures,
    factureImpayeeApresEcheanceJours: borne(b.factureImpayeeApresEcheanceJours, BORNES.jours, CONFIG_INITIALE.factureImpayeeApresEcheanceJours),
    acompteImpayeApresJours: borne(b.acompteImpayeApresJours, BORNES.jours, CONFIG_INITIALE.acompteImpayeApresJours),
  };
}

// ── L'état observé ─────────────────────────────────────────────────────────
export type EtatDossier = {
  id: string;
  status: string;
  pays: string | null;
  client: string;
  /** Une facture finale ACTIVE (brouillon ou émise, non annulée) existe. */
  finaleActive: boolean;
};

export type EtatFacture = {
  id: string;
  type: "acompte" | "finale";
  pays: string | null;
  status: string;          // brouillon | envoye | retard | paye
  num: string;
  client: string;
  emiseAt: string | null;
  termeSlug: PaymentTermSlug | null;
};

export type Attendue = {
  cle: string;
  type: TypeAction;
  roleCible: "planification";
  entityType: "dossier" | "document";
  entityId: string;
  /** Pays du dossier : seuls les planificateurs qui le couvrent sont concernés. */
  pays: string | null;
  titre: string;
  href: string;
  /**
   * Faut-il NOTIFIER à la naissance ? Non pour « à planifier » : la
   * planification est déjà avertie par `quote.signed` au moment même de la
   * signature (lib/signature-server.ts, lib/devis/status.ts). Notifier encore
   * serait un DOUBLON — l'action existe, la notification non.
   */
  notifier: boolean;
};

const JOUR = 86_400_000;

export function attendues(
  dossiers: EtatDossier[],
  factures: EtatFacture[],
  maintenant: Date,
  config: ConfigEscalade,
): Attendue[] {
  const out: Attendue[] = [];
  for (const d of dossiers) {
    const base = { roleCible: "planification" as const, entityType: "dossier" as const, entityId: d.id, pays: d.pays, href: "/planification" };
    if (d.status === "a_planifier") {
      out.push({ ...base, cle: `dossier.a_planifier:${d.id}`, type: "dossier.a_planifier", titre: `Intervention à planifier — ${d.client}`, notifier: false });
    } else if (d.status === "finalise") {
      out.push({ ...base, cle: `dossier.a_valider:${d.id}`, type: "dossier.a_valider", titre: `Intervention terminée, à valider — ${d.client}`, notifier: true });
    } else if (d.status === "valide" && !d.finaleActive) {
      out.push({ ...base, cle: `facture.a_preparer:${d.id}`, type: "facture.a_preparer", titre: `Facture finale à préparer — ${d.client}`, notifier: true });
    }
  }
  for (const f of factures) {
    const base = { roleCible: "planification" as const, entityType: "document" as const, entityId: f.id, pays: f.pays, href: `/factures/${f.id}` };
    if (f.status === "brouillon") {
      if (f.type === "finale") {
        out.push({ ...base, cle: `facture.a_emettre:${f.id}`, type: "facture.a_emettre", titre: `Facture finale préparée, à émettre — ${f.client}`, notifier: true });
      }
      continue;
    }
    if (f.status === "paye" || !f.emiseAt) continue;
    const emise = new Date(f.emiseAt).getTime();
    if (f.type === "acompte") {
      if (maintenant.getTime() >= emise + config.acompteImpayeApresJours * JOUR) {
        out.push({ ...base, cle: `acompte.impaye:${f.id}`, type: "acompte.impaye", titre: `Acompte impayé — ${f.num} · ${f.client}`, notifier: true });
      }
    } else {
      const terme = f.termeSlug ? PAYMENT_TERMS[f.termeSlug]?.days ?? 0 : 0;
      if (maintenant.getTime() >= emise + (terme + config.factureImpayeeApresEcheanceJours) * JOUR) {
        out.push({ ...base, cle: `facture.impayee:${f.id}`, type: "facture.impayee", titre: `Facture impayée — ${f.num} · ${f.client}`, notifier: true });
      }
    }
  }
  return out;
}

export type Ouverte = { id: string; cle: string; type: TypeAction; ouverteAt: string; escaladeeAt: string | null };

export type Plan = {
  aOuvrir: Attendue[];
  aFermer: { id: string; cle: string }[];
  aEscalader: Ouverte[];
};

export function reconcilier(
  voulues: Attendue[],
  ouvertes: Ouverte[],
  maintenant: Date,
  config: ConfigEscalade,
): Plan {
  const voulu = new Map(voulues.map((a) => [a.cle, a]));
  const ouvert = new Map(ouvertes.map((o) => [o.cle, o]));
  // Une clé n'est ouverte qu'une fois, même si l'état la produit deux fois.
  const aOuvrir = [...voulu.values()].filter((a) => !ouvert.has(a.cle));
  // Fermer = l'état a disparu. Jamais pour une autre raison.
  const aFermer = ouvertes.filter((o) => !voulu.has(o.cle)).map((o) => ({ id: o.id, cle: o.cle }));
  const aEscalader = ouvertes.filter((o) =>
    voulu.has(o.cle)
    && !o.escaladeeAt
    && maintenant.getTime() - new Date(o.ouverteAt).getTime() >= config.escaladeHeures[o.type] * 3_600_000,
  );
  return { aOuvrir, aFermer, aEscalader };
}
