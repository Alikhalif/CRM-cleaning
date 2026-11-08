// Facture finale — calcul PUR (aucune I/O), importable côté client comme
// serveur, et testable sans base (scripts/recette-check/facturation.ts).
//
// Décision du client du 2026-11-09 : « La facture finale doit reprendre les
// prestations du devis signé, les avenants éventuels et les acomptes déjà
// facturés. »
//
//   · PRESTATIONS : les lignes du devis signé sont recopiées telles quelles ;
//   · ACOMPTES : chaque facture d'acompte ÉMISE (et non annulée) est déduite
//     par une ligne négative qui la NOMME — numéro et date — pour que le client
//     retrouve ce qu'il a déjà payé ;
//   · AVENANTS : il n'existe AUCUN avenant de devis client dans ce CRM (le mot
//     n'apparaît que pour les contrats de sous-traitance). Le paramètre est
//     prévu, vide par défaut ; il ne fabrique rien.
//
// Les totaux sont RECALCULÉS depuis les lignes, puis comparés à ceux du devis :
// un écart signale une ligne corrompue au lieu d'être imprimé en silence.

export type LigneSource = {
  label: string;
  quantity: number;
  unit: string | null;
  unitPriceHt: number;
  vatRate: number;
  discountPct: number;
  totalHt: number;
  prestationId?: string | null;
};

export type AcompteEmis = {
  num: string;
  emiseAt: string | null; // ISO — date d'émission, à défaut d'émission connue : null
  totalHt: number;
  totalVat: number;
  totalTtc: number;
};

export type LigneFinale = LigneSource & { orderIndex: number };

export type FinaleCalculee =
  | {
      ok: true;
      lignes: LigneFinale[];
      totalHt: number;
      totalVat: number;
      totalTtc: number;
      acompteDeduit: number;
      signalements: string[];
    }
  | { ok: false; erreur: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Numéro d'un brouillon : provisoire, jamais légal (migration 20261109000003). */
export function estNumeroProvisoire(num: string | null | undefined): boolean {
  return !num || num.startsWith("BROUILLON-");
}

/** Ce que l'écran et le PDF affichent à la place d'un numéro provisoire. */
export function numeroAffiche(num: string | null | undefined): string {
  return estNumeroProvisoire(num) ? "Brouillon — non numérotée" : (num as string);
}

function tvaDeLigne(l: LigneSource): number {
  return r2(l.totalHt * (l.vatRate / 100));
}

export function calculerFinale(input: {
  devis: { num: string; totalHt: number; totalVat: number; totalTtc: number; lignes: LigneSource[] };
  acomptes: AcompteEmis[];
  avenants?: LigneSource[];
}): FinaleCalculee {
  const { acomptes } = input;
  let { devis } = input;
  const avenants = input.avenants ?? [];
  const signalements: string[] = [];

  // Devis ANCIENS sans lignes enregistrées (l'écran les reconstitue à la volée,
  // lib/documents-server.ts) : on ne bloque pas leur facturation, on reprend
  // le devis en UNE ligne fidèle à ses totaux — et on le dit.
  if (devis.lignes.length === 0) {
    if (r2(devis.totalHt) <= 0) {
      return { ok: false, erreur: `Le devis ${devis.num} n'a ni ligne ni montant : rien à reprendre.` };
    }
    signalements.push(
      `Le devis ${devis.num} ne porte pas de lignes détaillées : la facture le reprend en une ligne. Détaillez-la avant d'émettre si nécessaire.`,
    );
    devis = {
      ...devis,
      lignes: [{
        label: `Prestation selon devis ${devis.num}`,
        quantity: 1,
        unit: "forfait",
        unitPriceHt: r2(devis.totalHt),
        vatRate: r2((devis.totalVat / devis.totalHt) * 100),
        discountPct: 0,
        totalHt: r2(devis.totalHt),
      }],
    };
  }

  // Contrôle d'intégrité : les lignes du devis doivent redonner SON total HT.
  const htLignes = r2(devis.lignes.reduce((s, l) => s + l.totalHt, 0));
  if (Math.abs(htLignes - r2(devis.totalHt)) > 0.01) {
    signalements.push(
      `Les lignes du devis ${devis.num} totalisent ${htLignes.toFixed(2)} € HT, `
        + `le devis annonce ${r2(devis.totalHt).toFixed(2)} € HT. Vérifiez avant d'émettre.`,
    );
  }

  const lignes: LigneFinale[] = [];
  let ordre = 0;
  for (const l of devis.lignes) lignes.push({ ...l, orderIndex: ordre++ });
  for (const a of avenants) lignes.push({ ...a, label: `Avenant — ${a.label}`, orderIndex: ordre++ });

  let acompteDeduit = 0;
  let htDeduit = 0;
  let tvaDeduite = 0;
  for (const a of acomptes) {
    const date = a.emiseAt ? new Date(a.emiseAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : null;
    const taux = a.totalHt !== 0 ? r2((a.totalVat / a.totalHt) * 100) : 0;
    lignes.push({
      label: `Acompte déjà facturé — facture ${a.num}${date ? ` du ${date}` : ""}`,
      quantity: 1,
      unit: "forfait",
      unitPriceHt: -r2(a.totalHt),
      vatRate: taux,
      discountPct: 0,
      totalHt: -r2(a.totalHt),
      orderIndex: ordre++,
    });
    acompteDeduit += a.totalTtc;
    htDeduit += a.totalHt;
    tvaDeduite += a.totalVat;
  }

  const htPrestations = r2(
    devis.lignes.reduce((s, l) => s + l.totalHt, 0) + avenants.reduce((s, l) => s + l.totalHt, 0),
  );
  const tvaPrestations = r2(
    devis.lignes.reduce((s, l) => s + tvaDeLigne(l), 0) + avenants.reduce((s, l) => s + tvaDeLigne(l), 0),
  );
  // La TVA du devis fait foi s'il n'y a pas d'avenant : on ne recalcule pas un
  // arrondi différent de celui que le client a signé.
  const tvaBase = avenants.length === 0 ? r2(devis.totalVat) : tvaPrestations;
  const htBase = avenants.length === 0 ? r2(devis.totalHt) : htPrestations;

  const totalHt = r2(htBase - htDeduit);
  const totalVat = r2(tvaBase - tvaDeduite);
  const totalTtc = r2(totalHt + totalVat);

  if (totalTtc <= 0) {
    return {
      ok: false,
      erreur: `Solde nul ou négatif (${totalTtc.toFixed(2)} € TTC) : les acomptes couvrent déjà le devis ${devis.num}.`,
    };
  }

  return { ok: true, lignes, totalHt, totalVat, totalTtc, acompteDeduit: r2(acompteDeduit), signalements };
}
