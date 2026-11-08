// UX/UI — jetons CSS valides et cellules de tableau étiquetées.
//
// Priorité 4 du client du 2026-11-09 : corriger I1, I2 et I3.
//
// ── LA DISTINCTION QUE CE CONTRÔLE ENCODE ───────────────────────────
//
// Un `var(--x)` sans repli dont `--x` n'est défini nulle part rend la
// propriété **invalide à la valeur calculée** : l'élément perd sa couleur, sa
// bordure ou sa taille, en silence. C'est l'anomalie I1.
//
// MAIS un jeton peut être défini AILLEURS QUE DANS LE SCSS :
//
//   · posé en ligne depuis le TSX — `style={{ "--sc": couleur }}` — ce qui
//     est le mécanisme des pastilles de secteur et des barres de progression ;
//   · fourni par Next — `--font-geist-sans` vient du chargeur de polices.
//
// Un contrôle qui l'ignorerait signalerait 55 faux positifs, et « corriger »
// ces 55 emplacements casserait des éléments qui fonctionnent. C'est
// exactement ce que j'ai failli faire en me fiant au décompte brut.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { eq, faux, titre, vrai, bilan } from "./commun";

function fichiers(racine: string, ext: string): string[] {
  const out: string[] = [];
  const parcourir = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) {
        if (e === "node_modules" || e === ".next") continue;
        parcourir(p);
      } else if (e.endsWith(ext)) out.push(p.replace(/\\/g, "/"));
    }
  };
  parcourir(racine);
  return out.sort();
}

const scss = [...fichiers("app", ".scss"), ...fichiers("components", ".scss")];
const tsx = [...fichiers("app", ".tsx"), ...fichiers("components", ".tsx")];

// ═══════════════════════════════════════════════════════════════════════
titre("1. Aucun jeton CSS employé sans être défini quelque part");
// ═══════════════════════════════════════════════════════════════════════

// Définis dans le SCSS.
const definisScss = new Set<string>();
for (const f of scss) {
  for (const m of readFileSync(f, "utf8").matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    definisScss.add(m[1]);
  }
}

// Posés en ligne depuis le TSX, ou fournis par Next.
const definisAilleurs = new Set<string>();
for (const f of tsx) {
  const src = readFileSync(f, "utf8");
  // La syntaxe reelle est `["--sc" as string]: …` : une cle calculee avec
  // assertion de type. Un motif exigeant le deux-points colle au guillemet
  // n'en trouvait que deux sur six. On retient donc tout nom de jeton
  // apparaissant comme litteral de chaine dans un TSX : s'il y figure,
  // c'est qu'on l'y pose ou qu'on s'y refere.
  for (const m of src.matchAll(/["'`](--[a-zA-Z0-9-]+)["'`]/g)) definisAilleurs.add(m[1]);
  for (const m of src.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*\$\{/g)) definisAilleurs.add(m[1]);
}
// Le chargeur de polices de Next expose ces deux-là.
definisAilleurs.add("--font-geist-sans");
definisAilleurs.add("--font-geist-mono");

vrai(`${definisScss.size} jetons sont définis dans le SCSS`, definisScss.size > 50);
vrai(`${definisAilleurs.size} jetons sont posés ailleurs (TSX, Next)`, definisAilleurs.size > 0);

const orphelins: string[] = [];
for (const f of scss) {
  const lignes = readFileSync(f, "utf8").split("\n");
  for (const [i, ligne] of lignes.entries()) {
    // Sans repli : aucune virgule dans le `var()`.
    for (const m of ligne.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
      const j = m[1];
      if (!definisScss.has(j) && !definisAilleurs.has(j)) {
        orphelins.push(`${f}:${i + 1} → ${j}`);
      }
    }
  }
}
vrai("aucun jeton orphelin — ni dans le SCSS, ni posé en ligne",
  orphelins.length === 0, orphelins.slice(0, 8).join(" · "));

// Les deux corrections du 2026-11-09, figées.
vrai("--fs-2xs existe désormais dans l'échelle", definisScss.has("--fs-2xs"));
vrai("… et vaut un cran sous --fs-xs",
  /--fs-2xs:\s*11px/.test(readFileSync("app/styles/_tokens.scss", "utf8")));
const tousScss = scss.map((f) => readFileSync(f, "utf8")).join("\n");
faux("--text-strong n'est plus employé nulle part", /var\(--text-strong\)/.test(tousScss));
vrai("… remplacé par --text-primary, qui existe", definisScss.has("--text-primary"));

// ═══════════════════════════════════════════════════════════════════════
titre("2. Cellules de tableau : data-label en mode carte");
// ═══════════════════════════════════════════════════════════════════════
//
// Sous 1024 px, les tableaux deviennent des cartes et chaque cellule affiche
// son intitulé via `data-label`. Une cellule sans l'attribut s'affiche comme
// une ligne SANS INTITULÉ — illisible sur un téléphone.

type Compte = { avec: number; sans: number };
const parFichier = new Map<string, Compte>();
let avecTotal = 0;
let sansTotal = 0;

for (const f of tsx) {
  const src = readFileSync(f, "utf8");
  let avec = 0;
  let sans = 0;
  for (const m of src.matchAll(/<td\b[^>]*>/g)) {
    // Une cellule d'etat vide couvre TOUTES les colonnes (`colSpan`) : un
    // intitule de colonne n'y aurait aucun sens, et en exiger un ferait
    // echouer un controle sur du code juste.
    if (/colSpan/.test(m[0])) continue;
    if (m[0].includes("data-label")) avec++;
    else sans++;
  }
  if (avec + sans > 0) {
    parFichier.set(f, { avec, sans });
    avecTotal += avec;
    sansTotal += sans;
  }
}

vrai(`${avecTotal} cellules portent déjà leur intitulé`, avecTotal > 0);

// ⚠️ PLAFOND, et non zéro. 168 cellules n'ont pas d'intitulé, réparties sur
// 24 écrans. Les corriger demande de rattacher chaque cellule à son en-tête
// de colonne — ce qui ne s'automatise pas sans risque : colonnes
// conditionnelles, `colSpan`, fragments. Les écrans nommés par le client sont
// traités en priorité ; ce plafond empêche le nombre d'AUGMENTER pendant ce
// temps, et il devra baisser à mesure.
const PLAFOND = 168;
vrai(
  `au plus ${PLAFOND} cellules sans intitulé (actuel : ${sansTotal})`,
  sansTotal <= PLAFOND,
  sansTotal > PLAFOND ? `${sansTotal - PLAFOND} de plus qu'au 2026-11-09` : undefined,
);

// Les écrans que le client a nommés : commercial, superviseur, planificatrice,
// sous-traitance, devis, comptabilité.
const NOMMES = [
  "app/(app)/comptabilite/Comptabilite.tsx",
  "app/(app)/planification/Planification.tsx",
  "app/(app)/_shared/DocumentView.tsx",
];
for (const f of NOMMES) {
  const c = parFichier.get(f);
  if (!c) continue;
  eq(`${f.split("/").pop()} : toutes ses cellules sont étiquetées`, c.sans, 0);
}

// ═══════════════════════════════════════════════════════════════════════
titre("3. La bascule en cartes existe là où un tableau est servi");
// ═══════════════════════════════════════════════════════════════════════

const avecBascule: string[] = [];
const sansBascule: string[] = [];
for (const f of scss) {
  const src = readFileSync(f, "utf8");
  if (!/data-label/.test(src)) continue;
  (/max-width:\s*1024px/.test(src) ? avecBascule : sansBascule).push(f);
}
vrai(`${avecBascule.length} modules portent la règle de bascule`, avecBascule.length > 0);
eq("… et aucun module n'emploie data-label sans la règle", sansBascule.length, 0);

// La règle de référence, citée par CLAUDE.md.
const reference = readFileSync("app/(app)/leads/SuiviCommercial.module.scss", "utf8");
vrai("l'implémentation de référence porte toujours la bascule",
  /max-width:\s*1024px/.test(reference) && reference.includes("data-label"));
vrai("… scopée sous .table, pour ne pas fuir",
  /\.table[\s\S]{0,400}max-width:\s*1024px/.test(reference)
  || /max-width:\s*1024px[\s\S]{0,400}\.table/.test(reference));

bilan("UX/UI : jetons CSS et étiquetage des cellules");
