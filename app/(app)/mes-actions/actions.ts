"use server";

// Mutations du module « Mes actions ».
//
// Deux sources, deux tables, et une règle : on n'écrit JAMAIS dans
// `commercial_actions` autrement que par les server actions qui existaient
// déjà (completeAction / snoozeAction), inchangées. Les tâches manuelles
// vivent dans `commercial_tasks`, qui n'appartient qu'à ce module.

import { revalidatePath } from "next/cache";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { getCurrentUserProfile } from "@/lib/users-server";
import type { Priorite } from "@/lib/mes-actions/shared";
import { TYPES_MANUELS } from "@/lib/mes-actions/shared";

export type Resultat = { ok: boolean; error?: string; at?: string };

const TYPES_VALIDES = new Set<string>(TYPES_MANUELS.map((t) => t.value));
const PRIORITES = new Set<Priorite>(["normale", "importante", "urgente"]);

type Garde = { userId: string; isManager: boolean };

async function garde(): Promise<Garde | null> {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;
  return {
    userId: profile.id,
    isManager: profile.roles.some((r) => r.slug === "admin" || r.slug === "planification"),
  };
}

/**
 * La tâche existe-t-elle, et appartient-elle au demandeur ?
 *
 * Le contrôle est ici, côté serveur, et pas seulement dans l'interface : un
 * commercial ne doit pas pouvoir clore la tâche d'un collègue en rejouant
 * l'appel avec un autre identifiant (§16).
 */
async function tachePossedee(taskId: string, g: Garde) {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("commercial_tasks")
    .select("id, owner_id, status, due_at, has_time")
    .eq("id", taskId)
    .maybeSingle<{ id: string; owner_id: string; status: string; due_at: string; has_time: boolean }>();
  if (!data) return null;
  if (!g.isManager && data.owner_id !== g.userId) return null;
  return data;
}

function rafraichir() {
  revalidatePath("/mes-actions");
}

// ── Création (§8) ─────────────────────────────────────────────────────
export type NouvelleTache = {
  type: string;
  title: string;
  description?: string | null;
  /** Dossier facultatif : une tâche d'organisation n'en a pas (§15). */
  leadId?: string | null;
  /** AAAA-MM-JJ */
  date: string;
  /** HH:MM, facultatif. Absente = tâche « dans la journée ». */
  heure?: string | null;
  priorite: Priorite;
};

export async function creerTache(t: NouvelleTache): Promise<Resultat> {
  const g = await garde();
  if (!g) return { ok: false, error: "Session expirée — reconnectez-vous." };

  const titre = (t.title ?? "").trim();
  if (!titre) return { ok: false, error: "Donnez un intitulé à l'action." };
  if (!TYPES_VALIDES.has(t.type)) return { ok: false, error: "Type d'action inconnu." };
  if (!PRIORITES.has(t.priorite)) return { ok: false, error: "Priorité inconnue." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date ?? "")) return { ok: false, error: "Date d'échéance invalide." };

  const heure = (t.heure ?? "").trim();
  const avecHeure = /^\d{2}:\d{2}$/.test(heure);
  // Construite en heure de Paris, pas en UTC : « jeudi 14 h » doit rester
  // 14 h à l'écran, quel que soit le fuseau du serveur.
  const echeance = instantParis(t.date, avecHeure ? heure : "09:00");
  if (echeance == null) return { ok: false, error: "Date ou heure invalide." };

  const sb = await supabaseServiceRole();

  // Dossier rattaché : on vérifie qu'il existe ET qu'il est visible par le
  // demandeur. Jamais de création de prospect au passage (§8).
  let leadId: string | null = null;
  if (t.leadId) {
    let q = sb.from("leads").select("id").eq("id", t.leadId).is("deleted_at", null);
    if (!g.isManager) q = q.eq("owner_id", g.userId);
    const { data } = await q.maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: "Dossier introuvable ou hors de votre périmètre." };
    leadId = data.id;
  }

  const { data: creee, error } = await sb
    .from("commercial_tasks")
    .insert({
      owner_id: g.userId,
      lead_id: leadId,
      type: t.type,
      title: titre,
      description: (t.description ?? "").trim() || null,
      priority: t.priorite,
      due_at: new Date(echeance).toISOString(),
      has_time: avecHeure,
      created_by: g.userId,
    } as never)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !creee) {
    console.error("[mes-actions] création :", error?.code, error?.message);
    return { ok: false, error: "L'action n'a pas pu être enregistrée." };
  }

  await sb.from("commercial_task_events").insert({
    task_id: creee.id, kind: "created", by_user: g.userId,
    detail: { due_at: new Date(echeance).toISOString(), has_time: avecHeure, priority: t.priorite },
  } as never);

  rafraichir();
  return { ok: true, at: new Date().toISOString() };
}

// ── Terminer (§7) ─────────────────────────────────────────────────────
export async function terminerTache(taskId: string, result?: string): Promise<Resultat> {
  const g = await garde();
  if (!g) return { ok: false, error: "Session expirée — reconnectez-vous." };
  const t = await tachePossedee(taskId, g);
  if (!t) return { ok: false, error: "Action introuvable." };
  if (t.status === "terminee") return { ok: true, at: new Date().toISOString() };

  const sb = await supabaseServiceRole();
  const nowIso = new Date().toISOString();
  const { error } = await sb
    .from("commercial_tasks")
    .update({ status: "terminee", closed_at: nowIso, closed_by: g.userId, result: result?.trim() || "fait" } as never)
    .eq("id", taskId);
  if (error) {
    console.error("[mes-actions] clôture :", error.code, error.message);
    return { ok: false, error: "L'action n'a pas pu être terminée." };
  }
  await sb.from("commercial_task_events").insert({
    task_id: taskId, kind: "closed", by_user: g.userId, detail: { result: result?.trim() || null },
  } as never);
  rafraichir();
  return { ok: true, at: nowIso };
}

// ── Reporter (§7) ─────────────────────────────────────────────────────
//
// L'ancienne échéance est conservée dans le journal : le report s'historise,
// il n'efface rien.
export async function reporterTache(
  taskId: string,
  date: string,
  heure?: string | null,
): Promise<Resultat> {
  const g = await garde();
  if (!g) return { ok: false, error: "Session expirée — reconnectez-vous." };
  const t = await tachePossedee(taskId, g);
  if (!t) return { ok: false, error: "Action introuvable." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return { ok: false, error: "Nouvelle date invalide." };

  const h = (heure ?? "").trim();
  const avecHeure = /^\d{2}:\d{2}$/.test(h);
  const echeance = instantParis(date, avecHeure ? h : "09:00");
  if (echeance == null) return { ok: false, error: "Date ou heure invalide." };

  const sb = await supabaseServiceRole();
  const { data: cur } = await sb
    .from("commercial_tasks").select("report_count").eq("id", taskId)
    .maybeSingle<{ report_count: number }>();

  const nouvelle = new Date(echeance).toISOString();
  const { error } = await sb
    .from("commercial_tasks")
    .update({ due_at: nouvelle, has_time: avecHeure, report_count: (cur?.report_count ?? 0) + 1 } as never)
    .eq("id", taskId);
  if (error) {
    console.error("[mes-actions] report :", error.code, error.message);
    return { ok: false, error: "L'action n'a pas pu être reportée." };
  }
  await sb.from("commercial_task_events").insert({
    task_id: taskId, kind: "reported", by_user: g.userId,
    detail: { de: t.due_at, vers: nouvelle, has_time: avecHeure },
  } as never);
  rafraichir();
  return { ok: true, at: nouvelle };
}

// ── Report d'une action du MOTEUR, à une date choisie ─────────────────
//
// `snoozeAction` existe déjà mais ne prend qu'un nombre d'heures. Le cahier
// demande une date et une heure. On convertit ici, puis on appelle la
// fonction existante : `commercial_actions` n'est pas touchée autrement.
export async function reporterActionMoteur(
  actionId: string,
  date: string,
  heure?: string | null,
): Promise<Resultat> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return { ok: false, error: "Nouvelle date invalide." };
  const h = (heure ?? "").trim();
  const cible = instantParis(date, /^\d{2}:\d{2}$/.test(h) ? h : "09:00");
  if (cible == null) return { ok: false, error: "Date ou heure invalide." };

  const heures = (cible - Date.now()) / 3_600_000;
  if (heures <= 0) return { ok: false, error: "Choisissez une échéance future." };

  const { snoozeAction } = await import("@/app/(app)/ma-journee/actions");
  const r = await snoozeAction(actionId, heures);
  if (!r.ok) return { ok: false, error: r.error ?? "Le report a échoué." };
  rafraichir();
  return { ok: true, at: new Date(cible).toISOString() };
}

/** Termine une action du moteur via la server action existante. */
export async function terminerActionMoteur(actionId: string, result?: string): Promise<Resultat> {
  const { completeAction } = await import("@/app/(app)/ma-journee/actions");
  const r = await completeAction(actionId, result);
  if (!r.ok) return { ok: false, error: r.error ?? "La clôture a échoué." };
  rafraichir();
  return { ok: true, at: new Date().toISOString() };
}

/**
 * Instant correspondant à « ce jour, cette heure, à Paris ».
 *
 * Le décalage est DÉDUIT de la date visée, jamais codé en dur : il vaut
 * +1 h en hiver et +2 h en été, et une tâche créée en octobre pour
 * novembre doit tomber à la bonne heure.
 */
function instantParis(date: string, heure: string): number | null {
  const [a, m, j] = date.split("-").map(Number);
  const [hh, mm] = heure.split(":").map(Number);
  if (![a, m, j, hh, mm].every(Number.isFinite)) return null;
  const naif = Date.UTC(a, m - 1, j, hh, mm, 0);
  if (!Number.isFinite(naif)) return null;
  const vuDeParis = new Date(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date(naif)).replace(" ", "T") + "Z",
  ).getTime();
  return naif - (vuDeParis - naif);
}
