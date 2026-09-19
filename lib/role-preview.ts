// Constantes partagées pour le sélecteur « Vue » et l'aperçu lecture seule des
// rôles (recette A15, CDC §3.6). Module pur (aucune I/O) → importable côté
// client comme serveur.
//
// Deux clés localStorage :
//  - ACTIVE_ROLE_KEY  : rôle actif choisi PARMI les rôles détenus (change juste
//    l'étiquette « Vue · » + l'écran d'accueil au clic ; NE modifie PAS les
//    permissions — elles restent l'union des rôles, cf. SPEC).
//  - PREVIEW_ROLE_KEY : rôle prévisualisé en lecture seule (réservé à l'admin,
//    qui a déjà accès à toutes les données via RLS — aucun read élevé requis).
//    Non vide ⇒ l'appli passe en aperçu (contenu principal `inert`).

export const ACTIVE_ROLE_KEY = "cgk-active-role";
export const PREVIEW_ROLE_KEY = "cgk-preview-role";

export type PreviewRole = { slug: string; label: string; home: string };

// Rôles opérationnels qu'un admin peut prévisualiser (écrans « métier »).
export const PREVIEWABLE_ROLES: PreviewRole[] = [
  { slug: "commercial", label: "Commercial", home: "/pipeline" },
  { slug: "planification", label: "Planification", home: "/planification" },
];

const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard",
  commercial: "/pipeline",
  planification: "/planification",
};

export function roleHome(slug: string): string {
  return ROLE_HOME[slug] ?? "/dashboard";
}

export function previewRoleLabel(slug: string): string {
  return PREVIEWABLE_ROLES.find((r) => r.slug === slug)?.label ?? slug;
}
