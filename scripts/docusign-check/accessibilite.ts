// ACCESSIBILITÉ DEPUIS L'INTERFACE — « le code existe » ne suffit pas.
//
// POURQUOI CE CONTRÔLE EXISTE. Consigne du 2026-11-04, §3 : « Une
// fonctionnalité présente dans le code mais inaccessible depuis l'interface
// ne doit pas être déclarée conforme. »
//
// Deux pannes réelles de ce CRM étaient exactement de cette nature :
//   • `lib/generation/` — 1 106 lignes écrites le 31 octobre, zéro appelant ;
//   • le badge `leadsUntreated` — déclaré dans `lib/nav.ts` depuis l'origine,
//     consommé par aucun composant.
//
// Ni le typage ni le build ne les ont signalées : le code compilait
// parfaitement, il était simplement inatteignable. Ce fichier remonte la
// CHAÎNE D'ACCÈS de chaque fonctionnalité livrée :
//
//   symbole exporté → composant → page → route → rôle autorisé
//
// CE QU'IL NE FAIT PAS : il ne clique pas. Il prouve qu'un chemin existe, pas
// qu'un humain l'a parcouru. Les étapes d'écriture en base restent à valider
// dans l'application.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { canAccessPath } from "@/lib/access-shared";
import { NAV_GROUPS } from "@/lib/nav";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}

const lu = new Map<string, string>();
function fichier(p: string): string {
  const cache = lu.get(p);
  if (cache !== undefined) return cache;
  const t = existsSync(p) ? readFileSync(p, "utf8") : "";
  lu.set(p, t);
  return t;
}
const reference = (chemin: string, symbole: string): boolean =>
  fichier(chemin).includes(symbole);

type Maillon = {
  f: string;
  /**
   * Ce que CE fichier doit contenir pour que le maillon tienne.
   *
   * Pas forcément le nom de la fonction source : une page qui monte un
   * composant lui passe une PROP, elle ne nomme jamais la fonction serveur
   * qui a produit la valeur. Vérifier le mauvais symbole ferait échouer une
   * chaîne parfaitement reliée — c'était le défaut de la première version de
   * ce test, corrigé ici.
   */
  s: string;
};

type Chaine = {
  nom: string;
  source: string;
  symbole: string;
  maillons: Maillon[];
  route: string;
  roles: string[];
  rolesExclus?: string[];
};

const CHAINES: Chaine[] = [
  {
    nom: "Bandeau « NOUVEAU LEAD — À RAPPELER » (tableau de bord)",
    source: "lib/leads-non-traites-server.ts",
    symbole: "getLeadsNonTraites",
    maillons: [
      { f: "app/(app)/dashboard/AlerteNouveauxLeads.tsx", s: "LeadsNonTraites" },
      { f: "app/(app)/dashboard/AlerteNouveauxLeads.tsx", s: "À RAPPELER" },
      { f: "app/(app)/dashboard/page.tsx", s: "AlerteNouveauxLeads" },
      { f: "app/(app)/dashboard/page.tsx", s: "getLeadsNonTraites" },
    ],
    route: "/dashboard",
    roles: ["commercial", "admin", "planification"],
  },
  {
    nom: "Pastille « à rappeler » (navigation)",
    source: "lib/leads-non-traites-server.ts",
    symbole: "getLeadsNonTraites",
    maillons: [
      { f: "lib/nav.ts", s: "leadsUntreated" },
      { f: "components/Sidebar/Sidebar.tsx", s: "leadsUntreated" },
      { f: "components/Sidebar/Sidebar.tsx", s: "navBadge" },
      { f: "components/Sidebar/Sidebar.module.scss", s: ".navBadge" },
      { f: "app/(app)/layout.tsx", s: "getLeadsNonTraites" },
      { f: "app/(app)/layout.tsx", s: "leadsUntreated" },
    ],
    route: "/leads",
    roles: ["commercial", "admin", "planification"],
  },
  {
    nom: "Bouton « Générer le devis » (fiche découverte)",
    source: "app/(app)/leads/[id]/devis-actions.ts",
    symbole: "genererDevisDepuisDecouverte",
    maillons: [
      { f: "app/(app)/leads/[id]/DiscoveryCard.tsx", s: "genererDevisDepuisDecouverte" },
      { f: "app/(app)/leads/[id]/DiscoveryCard.tsx", s: "Générer le devis" },
      { f: "app/(app)/leads/[id]/page.tsx", s: "DiscoveryCard" },
      { f: "app/(app)/leads/[id]/page.tsx", s: "devisBrouillon" },
    ],
    route: "/leads",
    roles: ["commercial", "admin"],
  },
  {
    nom: "Moteur de rédaction du devis",
    source: "lib/generation/devis-contenu.ts",
    symbole: "genererContenuDevis",
    maillons: [
      { f: "lib/generation/devis-depuis-decouverte.ts", s: "genererContenuDevis" },
      { f: "app/(app)/leads/[id]/devis-actions.ts", s: "genererDepuisLead" },
      { f: "app/(app)/leads/[id]/devis-actions.ts", s: "notesDevis" },
      { f: "app/(app)/leads/[id]/DiscoveryCard.tsx", s: "activiteCouverte" },
    ],
    route: "/leads",
    roles: ["commercial", "admin"],
  },
  {
    nom: "Modification d'un brouillon de devis, en place",
    source: "app/(app)/devis/new/actions.ts",
    symbole: "updateDevisBrouillon",
    maillons: [
      { f: "app/(app)/devis/new/QuoteEditor.tsx", s: "updateDevisBrouillon" },
      { f: "app/(app)/devis/new/QuoteEditor.tsx", s: "brouillonId" },
      { f: "app/(app)/devis/new/page.tsx", s: "brouillonId" },
      { f: "app/(app)/devis/new/page.tsx", s: "brouillonParam" },
    ],
    route: "/devis/new",
    roles: ["commercial", "admin"],
  },
  {
    nom: "Lien « Modifier » sur un devis brouillon",
    source: "app/(app)/_shared/DocumentActions.tsx",
    symbole: "/devis/new?brouillon=",
    maillons: [
      { f: "app/(app)/_shared/DocumentView.tsx", s: "DocumentActions" },
      { f: "app/(app)/devis/[id]/page.tsx", s: "DocumentView" },
    ],
    route: "/devis",
    roles: ["commercial", "admin"],
  },
  {
    nom: "Accès direct au brouillon depuis « Devis à réaliser »",
    source: "lib/devis-a-realiser/shared.ts",
    symbole: "devisId",
    maillons: [
      { f: "lib/devis-a-realiser/server.ts", s: "devisId" },
      { f: "app/(app)/devis-a-realiser/DevisARealiser.tsx", s: "l.devisId" },
      { f: "app/(app)/devis-a-realiser/page.tsx", s: "getDevisARealiser" },
    ],
    route: "/devis-a-realiser",
    roles: ["commercial", "admin", "planification"],
  },
  {
    nom: "Colonne « Dernière modification » (Devis à réaliser)",
    source: "lib/devis-a-realiser/shared.ts",
    symbole: "modifieLe",
    maillons: [
      { f: "lib/devis-a-realiser/server.ts", s: "modifieLe" },
      { f: "app/(app)/devis-a-realiser/DevisARealiser.tsx", s: "l.modifieLe" },
    ],
    route: "/devis-a-realiser",
    roles: ["commercial", "admin"],
  },
  {
    nom: "Recherche des prestataires référencés",
    source: "lib/sous-traitance/contrats-shared.ts",
    symbole: "classerPrestataires",
    maillons: [
      { f: "app/(app)/planification/[id]/ContratSousTraitance.tsx", s: "classerPrestataires" },
      { f: "app/(app)/planification/[id]/ContratSousTraitance.tsx", s: "Correspondent à la mission" },
      { f: "app/(app)/planification/[id]/ContratSousTraitance.tsx", s: "Secteur géographique" },
      { f: "app/(app)/planification/[id]/page.tsx", s: "getPrestataires" },
      { f: "app/(app)/planification/[id]/page.tsx", s: "prestataires" },
    ],
    route: "/planification",
    roles: ["admin", "planification"],
    rolesExclus: ["commercial"],
  },
  {
    nom: "Représentation d'une société par une personne morale",
    source: "lib/sous-traitance/variables.ts",
    symbole: "representative_company_name",
    maillons: [
      { f: "lib/entities-shared.ts", s: "representative_company_name" },
      { f: "app/(app)/settings/entities/actions.ts", s: "buildPayload" },
      { f: "app/(app)/settings/entities/EntityFormModal.tsx", s: "representativeCompanyName" },
      { f: "app/(app)/settings/entities/EntitiesList.tsx", s: "representativeCompanyName" },
      { f: "lib/documents-server.ts", s: "representativeCompanyName" },
      { f: "supabase/migrations/20261104000001_entites_multipays_representation.sql", s: "representative_company_name" },
    ],
    route: "/settings/entities",
    roles: ["admin"],
    rolesExclus: ["commercial"],
  },
  {
    nom: "Identifiant légal par pays (5 pays)",
    source: "lib/leads.ts",
    symbole: "IDENTIFIANT_LEGAL",
    maillons: [
      { f: "app/(app)/settings/entities/EntityFormModal.tsx", s: "IDENTIFIANT_LEGAL" },
      { f: "app/(app)/settings/entities/EntityFormModal.tsx", s: "Pays d&apos;établissement" },
      { f: "app/(app)/settings/entities/EntitiesList.tsx", s: "IDENTIFIANT_LEGAL" },
      { f: "lib/entities-shared.ts", s: "IDENTIFIANT_LEGAL" },
    ],
    route: "/settings/entities",
    roles: ["admin"],
    rolesExclus: ["commercial"],
  },
  {
    nom: "Fiche de mission enrichie (planificatrice)",
    source: "lib/sous-traitance/contrats-shared.ts",
    symbole: "niveauDifficulte",
    maillons: [
      { f: "lib/sous-traitance/contrats-server.ts", s: "niveauDifficulte" },
      { f: "lib/sous-traitance/contrats-server.ts", s: "mission_difficulty" },
      { f: "lib/sous-traitance/contrats-server.ts", s: "dateSouhaitee" },
      { f: "lib/sous-traitance/contrats-server.ts", s: "volumeDebarras" },
    ],
    route: "/planification",
    roles: ["admin", "planification"],
    rolesExclus: ["commercial"],
  },
  {
    nom: "Résumé horizontal du pipeline commercial",
    source: "lib/pipeline-summary.ts",
    symbole: "resumePipeline",
    maillons: [
      { f: "app/(app)/pipeline/PipelineSummary.tsx", s: "resumePipeline" },
      { f: "lib/pipeline-summary.ts", s: "DÉCOUVERTE EFFECTUÉE" },
      { f: "app/(app)/pipeline/PipelineSummary.tsx", s: "e.libelle" },
      { f: "app/(app)/pipeline/PipelineSummary.module.scss", s: ".etapes" },
      { f: "app/(app)/pipeline/PipelineBoard.tsx", s: "PipelineSummary" },
      { f: "app/(app)/pipeline/PipelineBoard.tsx", s: "leads={visibleLeads}" },
      { f: "app/styles/_tokens.scss", s: "--pipeline-decouverte" },
    ],
    route: "/pipeline",
    roles: ["commercial", "admin"],
  },
  {
    nom: "Demande de tarif aux prestataires (e-mails préparés)",
    source: "lib/generation/demande-prestataire.ts",
    symbole: "preparerDemande",
    maillons: [
      { f: "lib/generation/demande-depuis-dossier.ts", s: "preparerDemande" },
      { f: "lib/generation/demande-depuis-dossier.ts", s: "contexteRedige" },
      { f: "app/(app)/planification/[id]/DemandeTarif.tsx", s: "demandePourDossier" },
      { f: "app/(app)/planification/[id]/ContratSousTraitance.tsx", s: "DemandeTarif" },
      { f: "app/(app)/planification/[id]/page.tsx", s: "ContratSousTraitance" },
    ],
    route: "/planification",
    roles: ["admin", "planification"],
    rolesExclus: ["commercial"],
  },
  {
    nom: "Provenance marketing : permission résolue, non présumée",
    source: "lib/leads-server.ts",
    symbole: "currentUserCanSeeProvenance",
    maillons: [
      { f: "lib/documents-server.ts", s: "currentUserCanSeeProvenance" },
      { f: "lib/documents-server.ts", s: "mapLead(row.lead, false, canProvenance)" },
      { f: "app/(app)/comptabilite/layout.tsx", s: "requireBackOffice" },
    ],
    route: "/comptabilite",
    roles: ["admin", "planification"],
    rolesExclus: ["commercial"],
  },
];

console.log("== Chaque fonctionnalité est atteignable depuis l'interface ==");
for (const c of CHAINES) {
  console.log(`\n  ${c.nom}`);
  vrai(`    source présente : ${c.source}`, fichier(c.source).length > 0);
  vrai(`    symbole « ${c.symbole} » dans la source`, reference(c.source, c.symbole));
  for (const m of c.maillons) {
    vrai(`    ${m.f} porte « ${m.s} »`, fichier(m.f).length > 0 && reference(m.f, m.s));
  }
  for (const r of c.roles) {
    vrai(`    ${r} accède à ${c.route}`, canAccessPath([r], c.route));
  }
  for (const r of c.rolesExclus ?? []) {
    vrai(`    ${r} n'accède PAS à ${c.route}`, !canAccessPath([r], c.route));
  }
}

// ══════════════════════════════════════════════════════════════════════
//  Aucun module de logique métier sans appelant
// ══════════════════════════════════════════════════════════════════════

console.log("\n== Aucun module de génération orphelin ==");
const APPELANTS_POSSIBLES = [
  "app/(app)/leads/[id]/devis-actions.ts",
  "app/(app)/leads/[id]/DiscoveryCard.tsx",
  "app/(app)/layout.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/dashboard/AlerteNouveauxLeads.tsx",
  "lib/generation/devis-depuis-decouverte.ts",
  "app/(app)/planification/[id]/ContratSousTraitance.tsx",
  "lib/sous-traitance/contrats-server.ts",
  "app/(app)/planification/[id]/DemandeTarif.tsx",
];
for (const m of [
  { module: "lib/generation/devis-contenu.ts", symbole: "genererContenuDevis" },
  { module: "lib/generation/devis-depuis-decouverte.ts", symbole: "genererDepuisLead" },
  { module: "lib/leads-non-traites-server.ts", symbole: "getLeadsNonTraites" },
  { module: "lib/sous-traitance/contrats-shared.ts", symbole: "classerPrestataires" },
  { module: "lib/generation/demande-depuis-dossier.ts", symbole: "demandePourDossier" },
]) {
  const appelants = APPELANTS_POSSIBLES
    .filter((f) => f !== m.module)
    .filter((f) => reference(f, m.symbole));
  vrai(`${m.module} a au moins un appelant (${appelants.length})`, appelants.length > 0);
}

// `demande-prestataire.ts` a été branché le 2026-11-04. Ce contrôle empêche
// qu'il retombe en code mort : c'était son état pendant quatre jours.
console.log("\n== E-mails prestataires : branchés ==");
vrai("lib/generation/demande-prestataire.ts a un appelant",
  reference("lib/generation/demande-depuis-dossier.ts", "preparerDemande"));
vrai("le pont a lui-même un appelant d'interface",
  reference("app/(app)/planification/[id]/DemandeTarif.tsx", "demandePourDossier"));
vrai("le panneau est monté dans l'écran de contrat",
  reference("app/(app)/planification/[id]/ContratSousTraitance.tsx", "DemandeTarif"));
vrai("le double garde de confidentialité est traversé",
  reference("lib/generation/demande-depuis-dossier.ts", "contexteRedige")
  && reference("lib/generation/demande-prestataire.ts", "verifierFuites"));

// ══════════════════════════════════════════════════════════════════════
//  Modules "use server" : aucune RÉEXPORTATION
// ══════════════════════════════════════════════════════════════════════
//
// Bug du 2026-11-05, sur le formulaire des sociétés émettrices :
//
//   ReferenceError: EntityInput is not defined
//     at module evaluation (… settings/entities/page/actions.js)
//
// Un `export type { EntityInput };` avait été ajouté dans un fichier
// `"use server"`. TypeScript efface bien cette ligne, mais le chargeur
// d'actions serveur énumère les exports du module et émet une liaison de
// réexport pour un symbole qui n'existe plus à l'exécution.
//
// ⚠️ LA DISTINCTION EST FINE, ET IMPORTANTE :
//
//   export type Result = { … };     DÉCLARATION locale → effacée → OK.
//                                   24 des 30 fichiers du dépôt le font,
//                                   en production, sans problème.
//   export type { Foo };            RÉEXPORTATION → liaison émise → CASSE.
//   export { bar } from "./x";      idem.
//   export * from "./x";            idem.
//
// Ce contrôle ne traque donc QUE les réexportations. Interdire les
// déclarations de type casserait 24 fichiers qui marchent.
//
// Et il existe parce que RIEN d'autre ne l'a vu : `tsc`, ESLint et
// `npm run build` sont tous passés au vert. Le build compile le module sans
// jamais l'évaluer ; l'erreur n'apparaît qu'au premier appel réel.

console.log("\n== Modules « use server » : aucune réexportation ==");
{
  const racine = ".";
  const aVisiter = ["app", "lib"];
  const fichiers: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        parcourir(chemin);
      } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
        fichiers.push(chemin);
      }
    }
  };
  for (const d of aVisiter) parcourir(`${racine}/${d}`);

  const serveur = fichiers.filter((f) => /^\s*"use server"/m.test(fichier(f)));
  vrai(`des modules « use server » sont bien trouvés (${serveur.length})`, serveur.length > 10);

  // Réexportations : `export {` ou `export type {` ou `export *`, en début de
  // ligne. Une déclaration (`export type Foo =`) ne correspond pas.
  const fautifs = serveur.filter((f) =>
    /^export\s+(type\s+)?\{/m.test(fichier(f)) || /^export\s+\*/m.test(fichier(f)));
  if (fautifs.length > 0) for (const f of fautifs) console.log(`        → ${f}`);
  vrai("aucune réexportation dans un module « use server »", fautifs.length === 0);

  // Le fichier qui portait le bug, nommément.
  const coupable = "./app/(app)/settings/entities/actions.ts";
  vrai("settings/entities/actions.ts ne réexporte plus de type",
    !/^export\s+type\s+\{/m.test(fichier(coupable)));
  vrai("et le formulaire prend EntityInput dans le module pur",
    reference("app/(app)/settings/entities/EntityFormModal.tsx",
      'from "@/lib/entities-shared"'));
}

// ══════════════════════════════════════════════════════════════════════
//  Navigation : toute entrée mène à une page qui existe
// ══════════════════════════════════════════════════════════════════════

console.log("\n== Chaque entrée de navigation mène à une page réelle ==");
let entrees = 0;
for (const groupe of NAV_GROUPS) {
  for (const item of groupe.items) {
    entrees++;
    const seg = item.href.replace(/^\//, "");
    const ok = [`app/(app)/${seg}/page.tsx`, `app/(app)/${seg}/layout.tsx`]
      .some((p) => fichier(p).length > 0);
    vrai(`${item.href} → page présente`, ok);
  }
}
console.log(`  (${entrees} entrées de navigation vérifiées)`);

// ══════════════════════════════════════════════════════════════════════
//  Cloisonnement : le commercial s'arrête à la signature
// ══════════════════════════════════════════════════════════════════════

console.log("\n== Le commercial n'atteint pas l'après-signature ==");
for (const route of [
  "/planification", "/comptabilite", "/sous-traitants", "/documents",
  "/chiffrage", "/a-affecter", "/settings", "/commerciaux", "/certificat-hotte",
]) {
  vrai(`commercial bloqué sur ${route}`, !canAccessPath(["commercial"], route));
}

console.log("\n== Le commercial atteint son propre périmètre ==");
for (const route of [
  "/dashboard", "/leads", "/pipeline", "/devis-a-realiser", "/decouverte",
  "/ma-journee", "/mes-actions", "/recherche", "/notifications", "/performance",
]) {
  vrai(`commercial accède à ${route}`, canAccessPath(["commercial"], route));
}

console.log("\n== La planificatrice atteint son périmètre ==");
for (const route of [
  "/planification", "/comptabilite", "/sous-traitants", "/documents", "/chiffrage",
]) {
  vrai(`planification accède à ${route}`, canAccessPath(["planification"], route));
}
vrai("planification n'accède PAS à /commerciaux (réservé admin)",
  !canAccessPath(["planification"], "/commerciaux"));

console.log("\n== Le Super Admin atteint tout ==");
for (const route of [
  "/dashboard", "/leads", "/pipeline", "/planification", "/comptabilite",
  "/settings", "/commerciaux", "/sous-traitants", "/documents", "/presence",
  "/devis-a-realiser", "/grilles-tarifaires",
]) {
  vrai(`admin accède à ${route}`, canAccessPath(["admin"], route));
}

console.log("\n== Rôles cumulés : l'union, jamais l'intersection ==");
// La matrice du cahier des charges est explicite : un utilisateur peut tenir
// plusieurs rôles, et ses permissions effectives sont leur UNION.
vrai("commercial + planification accède à /planification",
  canAccessPath(["commercial", "planification"], "/planification"));
vrai("commercial + planification accède à /leads",
  canAccessPath(["commercial", "planification"], "/leads"));
vrai("un rôle inconnu n'ouvre rien de restreint",
  !canAccessPath(["role_inexistant"], "/comptabilite"));

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
