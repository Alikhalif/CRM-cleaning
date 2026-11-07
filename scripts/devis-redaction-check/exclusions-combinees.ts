// LES QUATRE CAS D'EXCLUSION — correction du Lot A, 2026-11-07.
//
// ── LE DÉFAUT CORRIGÉ ────────────────────────────────────────────────
//
// `RESERVE_MURS_EXCLUS` nomme les murs ET les plafonds, et ne sortait que si
// les deux étaient refusés : `if (mursExclus && plafondsExclus)`.
//
// Conséquence : un client qui refusait le lessivage des murs en gardant les
// plafonds — ou l'inverse — recevait un devis **muet sur son refus**. Une
// réserve existe pour dire ce qui n'est pas compris ; se taire la vide de son
// objet, et laisse une ambiguïté sur un document contractuel.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// 1. Les quatre cas produisent chacun leur réserve, et une seule.
// 2. Le cas combiné n'écrit PAS les deux réserves simples par-dessus.
// 3. Aucune réserve n'est contradictoire avec une prestation incluse.
// 4. **Les réserves préexistantes survivent** — c'est la garantie de
//    non-régression : la correction ajoute, elle ne remplace pas.
// 5. Un thème non mentionné ne devient JAMAIS une exclusion.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import { genererContenuDevis, type Decouverte } from "@/lib/generation/devis-contenu";
import {
  RESERVE_MURS_EXCLUS,
  RESERVE_MURS_SEULS_EXCLUS,
  RESERVE_PLAFONDS_SEULS_EXCLUS,
  RESERVE_VITRERIE_EXCLUE,
  RESERVE_REEVALUATION,
  RESERVE_NON_SIGNALE,
  RESERVE_SUPPORTS,
} from "@/lib/generation/bibliotheque-redaction";

let ko = 0;
function vrai(nom: string, cond: boolean, detail?: string) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}${detail ? `\n    ${detail}` : ""}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  console.log(ja === jb ? `  ok    ${nom}` : `  ECHEC ${nom}\n    obtenu  ${ja}\n    attendu ${jb}`);
  if (ja !== jb) ko++;
}

/** Découverte de nettoyage approfondi, avec les refus qu'on lui passe. */
const devis = (refus: Record<string, unknown>) => genererContenuDevis({
  sector: "nettoyage",
  surfaceM2: 95,
  etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "appartement", nbSdb: 1,
    ...refus,
  },
  contexteIntervention: null,
} as Decouverte);

const reservesDe = (refus: Record<string, unknown>) => devis(refus)?.reserves ?? "";

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. LES QUATRE CAS, chacun sa réserve");
// ══════════════════════════════════════════════════════════════════════

// (a) Les murs SEULS — c'est le cas qui ne produisait RIEN.
const a = reservesDe({ murs: "non" });
vrai("(a) murs seuls refusés → la réserve des murs figure",
  a.includes(RESERVE_MURS_SEULS_EXCLUS), a.slice(-200));
vrai("(a) et elle ne parle PAS des plafonds",
  !a.includes(RESERVE_MURS_EXCLUS) && !a.includes(RESERVE_PLAFONDS_SEULS_EXCLUS));
vrai("(a) le mot « plafonds » n'apparaît pas dans cette réserve",
  !/lessivage des murs et des plafonds/.test(a));

// (b) Les plafonds SEULS — même défaut, même correction.
const b = reservesDe({ plafonds: "non" });
vrai("(b) plafonds seuls refusés → la réserve des plafonds figure",
  b.includes(RESERVE_PLAFONDS_SEULS_EXCLUS), b.slice(-200));
vrai("(b) et elle ne parle PAS des murs",
  !b.includes(RESERVE_MURS_EXCLUS) && !b.includes(RESERVE_MURS_SEULS_EXCLUS));

// (c) Les deux — comportement existant, CONSERVÉ.
const c = reservesDe({ murs: "non", plafonds: "non" });
vrai("(c) les deux refusés → la réserve groupée figure",
  c.includes(RESERVE_MURS_EXCLUS), c.slice(-200));
vrai("(c) et PAS les deux réserves simples par-dessus",
  !c.includes(RESERVE_MURS_SEULS_EXCLUS) && !c.includes(RESERVE_PLAFONDS_SEULS_EXCLUS));
eq("(c) une seule phrase sur le lessivage, pas deux",
  (c.match(/lessivage/g) ?? []).length, 1);

// (d) La vitrerie — comportement existant, libellé précisé.
const d = reservesDe({ vitrerie: "non" });
vrai("(d) vitrerie refusée → la réserve figure",
  d.includes(RESERVE_VITRERIE_EXCLUE), d.slice(-200));
vrai("(d) et elle nomme les ENCADREMENTS", /encadrements/.test(d));

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. Les combinaisons");
// ══════════════════════════════════════════════════════════════════════

const vm = reservesDe({ vitrerie: "non", murs: "non" });
vrai("vitrerie + murs : les deux réserves, distinctes",
  vm.includes(RESERVE_VITRERIE_EXCLUE) && vm.includes(RESERVE_MURS_SEULS_EXCLUS), vm.slice(-300));
vrai("vitrerie + murs : pas la réserve groupée murs-plafonds",
  !vm.includes(RESERVE_MURS_EXCLUS));

const vmp = reservesDe({ vitrerie: "non", murs: "non", plafonds: "non" });
vrai("vitrerie + murs + plafonds : vitrerie seule + groupée murs-plafonds",
  vmp.includes(RESERVE_VITRERIE_EXCLUE) && vmp.includes(RESERVE_MURS_EXCLUS), vmp.slice(-300));
eq("vitrerie + murs + plafonds : toujours une seule phrase sur le lessivage",
  (vmp.match(/lessivage/g) ?? []).length, 1);

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. NON-RÉGRESSION : les réserves préexistantes survivent");
// ══════════════════════════════════════════════════════════════════════
//
// La correction AJOUTE deux branches. Si elle avait remplacé au lieu
// d'ajouter, le socle contractuel disparaîtrait — et c'est exactement le
// genre de perte que ce lot doit éviter.

for (const [nom, refus] of [
  ["aucun refus", {}],
  ["murs seuls", { murs: "non" }],
  ["plafonds seuls", { plafonds: "non" }],
  ["les deux", { murs: "non", plafonds: "non" }],
  ["vitrerie", { vitrerie: "non" }],
] as [string, Record<string, unknown>][]) {
  const r = reservesDe(refus);
  vrai(`${nom} : la clause de réévaluation est là`, r.includes(RESERVE_REEVALUATION));
  vrai(`${nom} : la clause des éléments non signalés est là`, r.includes(RESERVE_NON_SIGNALE));
  vrai(`${nom} : la réserve des dégradations préexistantes est là`,
    r.includes(RESERVE_SUPPORTS), r.slice(0, 150));
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Un silence n'est JAMAIS une exclusion");
// ══════════════════════════════════════════════════════════════════════
//
// Règle arbitrée le 2026-11-06 : une absence de réponse n'autorise rien, et
// elle ne refuse rien non plus. Seul un « non » explicite produit une réserve.

const muet = reservesDe({});
vrai("sans réponse sur les murs : aucune réserve de murs",
  !muet.includes(RESERVE_MURS_SEULS_EXCLUS) && !muet.includes(RESERVE_MURS_EXCLUS));
vrai("sans réponse sur les plafonds : aucune réserve de plafonds",
  !muet.includes(RESERVE_PLAFONDS_SEULS_EXCLUS));
vrai("sans réponse sur la vitrerie : aucune réserve de vitrerie",
  !muet.includes(RESERVE_VITRERIE_EXCLUE));

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Aucune contradiction entre le détail et les réserves");
// ══════════════════════════════════════════════════════════════════════

const incluMurs = devis({ murs: "lessivage_complet", plafonds: "non" });
const rIncluMurs = incluMurs?.reserves ?? "";
vrai("murs demandés + plafonds refusés : la réserve ne nie pas les murs",
  !rIncluMurs.includes(RESERVE_MURS_SEULS_EXCLUS) && !rIncluMurs.includes(RESERVE_MURS_EXCLUS),
  rIncluMurs.slice(-250));
vrai("… et elle refuse bien les plafonds seuls",
  rIncluMurs.includes(RESERVE_PLAFONDS_SEULS_EXCLUS));

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. Les textes, au mot près");
// ══════════════════════════════════════════════════════════════════════
//
// Ce sont des clauses contractuelles : une reformulation silencieuse du code
// changerait ce que l'entreprise oppose à son client.

eq("murs seuls", RESERVE_MURS_SEULS_EXCLUS,
  "Le lessivage des murs n'est pas compris dans la présente prestation.");
eq("plafonds seuls", RESERVE_PLAFONDS_SEULS_EXCLUS,
  "Le lessivage des plafonds n'est pas compris dans la présente prestation.");
eq("murs et plafonds", RESERVE_MURS_EXCLUS,
  "Le lessivage des murs et des plafonds n'est pas compris dans la présente prestation.");
eq("vitrerie", RESERVE_VITRERIE_EXCLUE,
  "Le nettoyage des surfaces vitrées et de leurs encadrements n'est pas compris dans la présente prestation.");

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
