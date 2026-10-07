import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUserProfile } from "./users-server";
import {
  canAccessScope,
  isAdminRole,
  isBackOfficeRole,
  isCommercialOnly,
  isPlannerRole,
  type ModuleScope,
} from "./access-shared";

// Gardes serveur du cloisonnement par rôle (cf. lib/access-shared.ts).
//
// À utiliser dans un `layout.tsx` de module plutôt que page par page : la garde
// couvre alors TOUTES les sous-routes, y compris celles ajoutées plus tard —
// un commercial ne peut pas contourner la restriction par une URL directe.
//
// `getCurrentUserProfile()` est mémoïsé par requête (React `cache()`), donc
// empiler ces gardes ne coûte pas de requête SQL supplémentaire.

export type AccessContext = {
  userId: string | null;
  roles: string[];
  isAdmin: boolean;
  isPlanner: boolean;
  isBackOffice: boolean;
  isCommercialOnly: boolean;
};

export async function getAccessContext(): Promise<AccessContext> {
  const profile = await getCurrentUserProfile();
  const roles = (profile?.roles ?? []).map((r) => r.slug);
  return {
    userId: profile?.id ?? null,
    roles,
    isAdmin: isAdminRole(roles),
    isPlanner: isPlannerRole(roles),
    isBackOffice: isBackOfficeRole(roles),
    isCommercialOnly: isCommercialOnly(roles),
  };
}

// Garde de rendu : rend un 404 si le scope n'est pas accordé. Un 404 (plutôt
// qu'un message « accès refusé ») est volontaire : le module ne doit pas exister
// dans l'interface du commercial.
export async function requireScope(scope: ModuleScope): Promise<AccessContext> {
  const access = await getAccessContext();
  if (!canAccessScope(access.roles, scope)) notFound();
  return access;
}

export async function requireBackOffice(): Promise<AccessContext> {
  return requireScope("backOffice");
}

export async function requireAdmin(): Promise<AccessContext> {
  return requireScope("admin");
}

// Variante pour les server actions et les routes API : renvoie un booléen au
// lieu de rendre un 404, afin que l'appelant décide de son format d'erreur.
export async function hasScope(scope: ModuleScope): Promise<boolean> {
  const { roles } = await getAccessContext();
  return canAccessScope(roles, scope);
}

// Sucre pour les server actions, qui renvoient `{ ok, error }` dans ce repo.
export async function assertBackOffice(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await hasScope("backOffice")) return { ok: true };
  return { ok: false, error: "Action réservée à la planification / l'administration." };
}
