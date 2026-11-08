// D26 — séries de factures par société : règles PURES (aucune I/O).
//
// Décision du client du 2026-11-09 : « Chaque société émettrice doit disposer
// d'une série de facturation adaptée à ses obligations légales et comptables.
// Les séries doivent être indépendantes et sécurisées. Aucune facture déjà
// émise ne doit être renumérotée. »
//
// Ce module ne décide RIEN de juridique : il refuse les saisies qui
// produiraient une série incohérente, et il SIGNALE ce qui demande l'avis de
// l'expert-comptable. La base garde les invariants (migration 20261109000003) :
// format, unicité du code, immutabilité d'une série active ou employée.

import type { Country } from "@/lib/leads";

export const FORMAT_CODE = /^[A-Z0-9]{2,8}$/;

/** Ce que les textes exigent, par pays — à CONFIRMER par l'expert-comptable. */
export const OBLIGATIONS_PAYS: Record<Country, { exigence: string; fuseau: string }> = {
  // Les références d'articles ne sont citées que lorsqu'elles ont été
  // vérifiées : une citation fausse dans un module comptable est pire
  // qu'aucune. Tout le reste est l'usage connu, à confirmer.
  FR: { exigence: "Numérotation unique, chronologique et continue (CGI, ann. II, art. 242 nonies A).", fuseau: "Europe/Paris" },
  BE: { exigence: "Numérotation unique et suivie, selon la réglementation TVA belge.", fuseau: "Europe/Paris" },
  LU: { exigence: "Numéro séquentiel unique, selon la réglementation TVA luxembourgeoise.", fuseau: "Europe/Paris" },
  CH: { exigence: "Pas de format de numérotation imposé à notre connaissance ; numéro unique d'usage.", fuseau: "Europe/Paris" },
  CA: { exigence: "Pas de séquence continue imposée à notre connaissance ; numéro d'identification d'usage (TPS/TVQ).", fuseau: "America/Toronto" },
};

export type SaisieSerie = { code: string; depuis: string /* AAAA-MM-JJ */ };

export type VerdictSerie =
  | { ok: true; code: string; depuis: string; signalements: string[] }
  | { ok: false; erreur: string };

/** Date du jour à l'heure légale d'un pays, au format AAAA-MM-JJ. */
export function aujourdhuiLegal(pays: Country | null, maintenant: Date = new Date()): string {
  const fuseau = OBLIGATIONS_PAYS[pays ?? "FR"]?.fuseau ?? "Europe/Paris";
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
}

export function verifierSaisieSerie(
  saisie: SaisieSerie,
  contexte: { pays: Country | null; serieActive: boolean; codesPris: string[]; maintenant?: Date },
): VerdictSerie {
  if (contexte.serieActive) {
    return { ok: false, erreur: "Cette série est active ou a déjà servi : elle ne se modifie plus. Aucune facture émise n'est renumérotée." };
  }
  const code = saisie.code.trim().toUpperCase();
  if (!FORMAT_CODE.test(code)) {
    return { ok: false, erreur: "Code de 2 à 8 caractères, lettres majuscules et chiffres seulement (ex. CGK, OPTFR)." };
  }
  if (contexte.codesPris.map((c) => c.toUpperCase()).includes(code)) {
    return { ok: false, erreur: `Le code ${code} est déjà celui d'une autre société : deux séries ne partagent jamais un code.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saisie.depuis) || Number.isNaN(Date.parse(saisie.depuis))) {
    return { ok: false, erreur: "Date d'effet invalide." };
  }
  const aujourdhui = aujourdhuiLegal(contexte.pays, contexte.maintenant);
  if (saisie.depuis < aujourdhui) {
    return { ok: false, erreur: "Une date d'effet passée réécrirait la frontière entre deux séries : choisissez aujourd'hui ou plus tard." };
  }
  const signalements: string[] = [];
  if (!saisie.depuis.endsWith("-01-01")) {
    signalements.push(
      "La date choisie n'est pas un 1er janvier : la société aura DEUX séries la même année (l'historique, puis la sienne). À valider avec l'expert-comptable.",
    );
  }
  if (contexte.pays) signalements.push(OBLIGATIONS_PAYS[contexte.pays].exigence + " — à confirmer par l'expert-comptable.");
  return { ok: true, code, depuis: saisie.depuis, signalements };
}
