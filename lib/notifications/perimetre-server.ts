import "server-only";
import { notify, type NotifyInput } from "@/lib/notifications";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { dansPerimetre, type Portee } from "./perimetre-shared";

// D31 — notifier le back-office DANS le périmètre de chacun.
//
// Remplace `notifyRole("planification")`, qui avertissait toute l'équipe :
// une planificatrice lisait alors le nom de clients de pays qu'elle ne voit
// pas. Ici, chaque destinataire est retenu par `dansPerimetre()` — le miroir
// de la règle que la base revérifie à l'insertion et à la lecture.
//
// FAIL-CLOSED : une portée sans pays (pays du dossier inconnu) n'est envoyée
// à AUCUNE planificatrice ; elle ne part qu'aux administrateurs si
// `inclureAdmins` est demandé. Une alerte mal ciblée est pire qu'une alerte
// remontée au Super Admin.

export async function notifierBackOffice(
  portee: Portee,
  input: Omit<NotifyInput, "userId" | "pays" | "entiteId">,
  opts: { inclureAdmins?: boolean; exclureUserId?: string } = {},
): Promise<number> {
  try {
    const sb = await supabaseServiceRole();
    const { data: roles } = await sb.from("roles").select("id, slug").in("slug", ["planification", "admin"] as never[]);
    const idRole = new Map(((roles ?? []) as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));
    const visés = [idRole.get("planification"), opts.inclureAdmins ? idRole.get("admin") : undefined].filter(Boolean) as string[];
    if (visés.length === 0) return 0;

    const { data: liens } = await sb.from("user_roles").select("user_id, role_id").in("role_id", visés);
    const rolesParUser = new Map<string, string[]>();
    for (const l of (liens ?? []) as { user_id: string; role_id: string }[]) {
      const slug = [...idRole.entries()].find(([, id]) => id === l.role_id)?.[0];
      if (slug) rolesParUser.set(l.user_id, [...(rolesParUser.get(l.user_id) ?? []), slug]);
    }
    const ids = [...rolesParUser.keys()].filter((id) => id !== opts.exclureUserId);
    if (ids.length === 0) return 0;

    // `select("*")` : `entites_autorisees` n'existe qu'avec la migration …07.
    const { data: users } = await sb.from("users").select("*").in("id", ids).eq("is_active", true);
    let n = 0;
    for (const u of (users ?? []) as Record<string, unknown>[]) {
      const id = u.id as string;
      const dest = {
        roles: rolesParUser.get(id) ?? [],
        countries: (u.countries as string[] | null) ?? [],
        entitesAutorisees: (u.entites_autorisees as string[] | null) ?? [],
      };
      // Pays inconnu : seuls les admins (s'ils sont visés) reçoivent.
      if (portee.pays === null && !dest.roles.includes("admin")) continue;
      if (!dansPerimetre(dest, portee)) continue;
      await notify({ ...input, userId: id, pays: portee.pays, entiteId: portee.entiteId });
      n++;
    }
    return n;
  } catch (err) {
    console.error("notifierBackOffice failed:", err);
    return 0;
  }
}

type LeadPortee = { country: string | null; entity_id: string | null } | null;

/** Portée d'un lead : son pays et sa société. */
export async function porteeDuLead(leadId: string | null): Promise<Portee> {
  if (!leadId) return { pays: null, entiteId: null };
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("leads").select("country, entity_id").eq("id", leadId).maybeSingle<LeadPortee & object>();
  return { pays: data?.country ?? null, entiteId: data?.entity_id ?? null };
}

/** Portée d'un document : pays du lead, et la société ÉMETTRICE du document. */
export async function porteeDuDocument(documentId: string | null): Promise<Portee> {
  if (!documentId) return { pays: null, entiteId: null };
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("documents").select("entity_id, lead:leads(country)").eq("id", documentId)
    .maybeSingle<{ entity_id: string | null; lead: { country: string | null } | null }>();
  return { pays: data?.lead?.country ?? null, entiteId: data?.entity_id ?? null };
}

/** Portée d'un contrat CLIENT : par le lead source du client. Client direct sans lead : pays inconnu. */
export async function porteeDuContratClient(contractId: string): Promise<Portee> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("contracts").select("client:clients(source_lead_id)").eq("id", contractId)
    .maybeSingle<{ client: { source_lead_id: string | null } | null }>();
  return porteeDuLead(data?.client?.source_lead_id ?? null);
}
