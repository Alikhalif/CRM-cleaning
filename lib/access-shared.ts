// Périmètre d'accès par rôle — source de vérité UNIQUE du cloisonnement.
// Module pur (aucune I/O) → importable côté client comme serveur.
//
// Principe métier (décision client) : la SIGNATURE est la frontière.
//   • AVANT signature  → le commercial gère son dossier de bout en bout
//     (lead → contact → découverte → infos/photos → devis → relance →
//     négociation → signature). Tout son parcours existant reste intact.
//   • APRÈS signature  → le dossier passe à la planificatrice. La planification,
//     la sous-traitance, la comptabilité, les documents/contrats internes et le
//     paramétrage ne font PLUS partie du périmètre du commercial.
//
// Le commercial conserve en revanche la VISIBILITÉ de son historique commercial
// (ses ventes, son CA, son taux de transformation) : /performance, /recherche et
// la liste des documents de ses propres dossiers restent accessibles — ils sont
// cloisonnés par la RLS (`owner_id = auth.uid()`), pas par ce module.
//
// ⚠️ Ce module décide de la VISIBILITÉ et des GARDES applicatives. Il ne
// remplace pas la RLS, qui reste la frontière réelle côté base.

export type ModuleScope =
  | "all" // tout utilisateur authentifié (le cloisonnement des données est fait par la RLS)
  | "backOffice" // Super Admin + Planification
  | "admin"; // Super Admin uniquement

export const ROLE_ADMIN = "admin";
export const ROLE_COMMERCIAL = "commercial";
export const ROLE_PLANIFICATION = "planification";

export function hasRole(roleSlugs: string[], slug: string): boolean {
  return roleSlugs.includes(slug);
}

export function isAdminRole(roleSlugs: string[]): boolean {
  return hasRole(roleSlugs, ROLE_ADMIN);
}

export function isPlannerRole(roleSlugs: string[]): boolean {
  return hasRole(roleSlugs, ROLE_PLANIFICATION);
}

// Back-office = tout ce qui intervient APRÈS la signature.
export function isBackOfficeRole(roleSlugs: string[]): boolean {
  return isAdminRole(roleSlugs) || isPlannerRole(roleSlugs);
}

// Un commercial « pur » : ni admin, ni planificateur. C'est le seul profil dont
// l'interface est restreinte — les rôles cumulés gardent l'union de leurs droits
// (CDC §3 : « effective permissions are the union »).
export function isCommercialOnly(roleSlugs: string[]): boolean {
  return !isBackOfficeRole(roleSlugs);
}

// Modules HORS périmètre commercial, par préfixe de route. Tout ce qui n'est pas
// listé ici est `all` — on n'ajoute donc aucune restriction au parcours de vente
// existant (/leads, /pipeline, /clients, /decouverte, /devis, /signatures,
// /performance, /recherche, /ma-journee, /dashboard, /notifications…).
//
// L'ordre compte : le préfixe le PLUS LONG qui matche gagne.
export const RESTRICTED_MODULES: { prefix: string; scope: Exclude<ModuleScope, "all"> }[] = [
  // ── Opérations post-signature (planificatrice) ────────────────────────
  { prefix: "/planification", scope: "backOffice" },
  { prefix: "/chiffrage", scope: "backOffice" },
  { prefix: "/sous-traitants", scope: "backOffice" },
  { prefix: "/certificat-hotte", scope: "backOffice" },
  // ── Comptabilité / facturation opérationnelle ─────────────────────────
  { prefix: "/comptabilite", scope: "backOffice" },
  // ── Documents & contrats internes / bibliothèque administrative ───────
  { prefix: "/documents", scope: "backOffice" },
  // ── Affectation des leads (file « sans propriétaire ») ────────────────
  { prefix: "/a-affecter", scope: "backOffice" },
  // ── Paramétrage & pilotage d'équipe (Super Admin) ─────────────────────
  { prefix: "/settings", scope: "backOffice" }, // les pages internes gardent leur propre garde admin
  { prefix: "/commerciaux", scope: "admin" },
  { prefix: "/presence", scope: "admin" },
];

// Scope requis pour une route. Compare sur segment entier : `/documents` et
// `/documents/x` matchent, `/documents-publics` NON.
export function scopeForPath(pathname: string): ModuleScope {
  let best: { prefix: string; scope: Exclude<ModuleScope, "all"> } | null = null;
  for (const entry of RESTRICTED_MODULES) {
    const matches = pathname === entry.prefix || pathname.startsWith(entry.prefix + "/");
    if (matches && (!best || entry.prefix.length > best.prefix.length)) best = entry;
  }
  return best?.scope ?? "all";
}

export function canAccessScope(roleSlugs: string[], scope: ModuleScope): boolean {
  if (scope === "all") return true;
  if (scope === "admin") return isAdminRole(roleSlugs);
  return isBackOfficeRole(roleSlugs);
}

export function canAccessPath(roleSlugs: string[], pathname: string): boolean {
  return canAccessScope(roleSlugs, scopeForPath(pathname));
}
