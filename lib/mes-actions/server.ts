import "server-only";

// Lectures du module « Mes actions ».
//
// Le module ne possède que `commercial_tasks`. Tout le reste est lu, jamais
// écrit : `commercial_actions` appartient au moteur de relances, `leads` au
// Suivi commercial. Aucune fonction de ce fichier ne modifie quoi que ce
// soit hors de son périmètre.

import { supabaseServiceRole } from "@/lib/supabase/service";
import { selectEnLotsTolerant } from "@/lib/supabase/batch";
import { getMyActions } from "@/lib/commercial-actions/read-server";
import { SECTOR_LABEL, type Sector } from "@/lib/leads";
import { depuisAction, type Item, type Priorite } from "./shared";

type TacheRow = {
  id: string;
  owner_id: string;
  lead_id: string | null;
  type: string;
  title: string;
  description: string | null;
  priority: Priorite;
  due_at: string;
  has_time: boolean;
  status: string;
  report_count: number;
  closed_at: string | null;
  result: string | null;
};

export type EvenementTache = {
  at: string;
  kind: string;
  detail: Record<string, unknown>;
};

export type DonneesMesActions = {
  items: Item[];
  urgentAfterHours: number;
  /** Horloge du serveur : l'écran part d'un instant cohérent. */
  serverNow: number;
  /** Renseigné quand une source n'a pas pu être lue — jamais un faux zéro. */
  erreur: string | null;
};

/** Libellé + téléphone + activité des dossiers cités, en une seule passe. */
async function contexteDossiers(
  sb: Awaited<ReturnType<typeof supabaseServiceRole>>,
  leadIds: string[],
): Promise<Map<string, { activite: string | null; phone: string | null; ref: string | null; nom: string | null }>> {
  const out = new Map<string, { activite: string | null; phone: string | null; ref: string | null; nom: string | null }>();
  if (leadIds.length === 0) return out;
  const { rows } = await selectEnLotsTolerant(
    leadIds,
    (lot) => sb
      .from("leads")
      .select("id, short_id, client_phone, is_company, client_company, client_first_name, client_last_name, activity:activities(slug)")
      .in("id", lot),
    { table: "leads", filtre: "id IN (…) — contexte « Mes actions »" },
  );
  for (const l of rows as {
    id: string; short_id: string | null; client_phone: string | null;
    is_company: boolean | null; client_company: string | null;
    client_first_name: string | null; client_last_name: string | null;
    activity: { slug: string } | null;
  }[]) {
    const slug = l.activity?.slug ?? null;
    out.set(l.id, {
      activite: slug ? (SECTOR_LABEL[slug as Sector] ?? slug) : null,
      phone: l.client_phone,
      ref: l.short_id,
      nom: l.is_company
        ? (l.client_company?.trim() || null)
        : (`${l.client_first_name ?? ""} ${l.client_last_name ?? ""}`.trim() || null),
    });
  }
  return out;
}

/**
 * Tout ce qu'un commercial doit voir dans « Mes actions ».
 *
 * `erreur` est renseignée dès qu'une des deux sources échoue. L'interface
 * doit alors dire que le chargement a échoué, et surtout PAS afficher
 * « 0 action » — un faux zéro laisse croire que la journée est vide (§18).
 */
export async function getMesActions(userId: string): Promise<DonneesMesActions> {
  const sb = await supabaseServiceRole();
  let erreur: string | null = null;

  const [moteur, tachesRes] = await Promise.all([
    getMyActions(userId).catch((e: unknown) => {
      console.error("[mes-actions] moteur de relances :", e);
      erreur = "Les relances automatiques n'ont pas pu être chargées.";
      return { actions: [], urgentAfterHours: 48 };
    }),
    // Tâches manuelles : actives, plus les terminées des 30 derniers jours
    // (l'historique du module remonte à un mois à l'écran).
    sb.from("commercial_tasks")
      .select("*")
      .eq("owner_id", userId)
      .or(`status.neq.terminee,closed_at.gte.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`)
      .order("due_at", { ascending: true })
      .returns<TacheRow[]>(),
  ]);

  if (tachesRes.error) {
    console.error("[mes-actions] tâches manuelles :", tachesRes.error.code, tachesRes.error.message);
    erreur = erreur
      ? "Plusieurs sources n'ont pas pu être chargées."
      : "Vos tâches manuelles n'ont pas pu être chargées.";
  }
  const taches = tachesRes.data ?? [];

  const leadIds = [
    ...new Set([
      ...moteur.actions.map((a) => a.leadId),
      ...taches.map((t) => t.lead_id).filter(Boolean) as string[],
    ]),
  ];
  const ctx = await contexteDossiers(sb, leadIds);
  const now = Date.now();

  const items: Item[] = [
    ...moteur.actions.map((a) =>
      depuisAction(a, moteur.urgentAfterHours, now, {
        activite: ctx.get(a.leadId)?.activite ?? null,
        phone: ctx.get(a.leadId)?.phone ?? null,
      }),
    ),
    ...taches.map((t): Item => {
      const c = t.lead_id ? ctx.get(t.lead_id) : undefined;
      return {
        id: t.id,
        source: "manuelle",
        leadId: t.lead_id,
        leadRef: c?.ref ?? null,
        clientName: c?.nom ?? null,
        activite: c?.activite ?? null,
        ownerId: t.owner_id,
        ownerName: null,
        type: t.type,
        typeLabel: t.type,
        title: t.title,
        description: t.description,
        dueAt: t.due_at,
        hasTime: t.has_time,
        priorite: t.priority,
        termine: t.status === "terminee",
        closedAt: t.closed_at,
        result: t.result,
        reportCount: t.report_count,
        phone: c?.phone ?? null,
      };
    }),
  ];

  return { items, urgentAfterHours: moteur.urgentAfterHours, serverNow: now, erreur };
}

/** Journal d'une tâche manuelle — reports compris (§10). */
export async function getEvenementsTaches(
  userId: string,
  taskIds: string[],
): Promise<Map<string, EvenementTache[]>> {
  const out = new Map<string, EvenementTache[]>();
  if (taskIds.length === 0) return out;
  const sb = await supabaseServiceRole();
  const { rows } = await selectEnLotsTolerant(
    taskIds,
    (lot) => sb
      .from("commercial_task_events")
      .select("task_id, at, kind, detail")
      .in("task_id", lot)
      .order("at", { ascending: false }),
    {
      table: "commercial_task_events",
      filtre: "task_id IN (…)",
      trier: (a, b) => String((b as { at: string }).at).localeCompare(String((a as { at: string }).at)),
    },
  );
  for (const e of rows as { task_id: string; at: string; kind: string; detail: Record<string, unknown> }[]) {
    const l = out.get(e.task_id) ?? [];
    l.push({ at: e.at, kind: e.kind, detail: e.detail });
    out.set(e.task_id, l);
  }
  return out;
}

/** Dossiers que le commercial peut rattacher à une tâche (§8). */
export async function getDossiersRattachables(
  userId: string,
  isManager: boolean,
): Promise<{ id: string; ref: string | null; nom: string; activite: string | null }[]> {
  const sb = await supabaseServiceRole();
  let q = sb
    .from("leads")
    .select("id, short_id, is_company, client_company, client_first_name, client_last_name, activity:activities(slug)")
    .is("deleted_at", null)
    .order("received_at", { ascending: false })
    .limit(300);
  // Le commercial ne voit QUE ses dossiers — restriction appliquée ici,
  // côté serveur, pas seulement dans l'interface (§16).
  if (!isManager) q = q.eq("owner_id", userId);
  const { data, error } = await q.returns<{
    id: string; short_id: string | null; is_company: boolean | null;
    client_company: string | null; client_first_name: string | null; client_last_name: string | null;
    activity: { slug: string } | null;
  }[]>();
  if (error || !data) return [];
  return data.map((l) => ({
    id: l.id,
    ref: l.short_id,
    nom: (l.is_company
      ? l.client_company?.trim()
      : `${l.client_first_name ?? ""} ${l.client_last_name ?? ""}`.trim()) || "Sans nom",
    activite: l.activity?.slug ? (SECTOR_LABEL[l.activity.slug as Sector] ?? l.activity.slug) : null,
  }));
}
