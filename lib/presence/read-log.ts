import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";

// Journalise une LECTURE (ouverture de lead / consultation fiche client) dans
// audit_logs, de façon THROTTLÉE (une entrée max par utilisateur+entité toutes
// les 5 min) pour ne pas saturer le journal aux rafraîchissements. Best-effort :
// invisible pour l'utilisateur, ne ralentit/casse jamais la page.
//
// Écrit en service-role car la lecture d'audit_logs (pour le throttle) est
// réservée admin ; l'acteur (user_id) est celui de la session vérifiée ici.
const THROTTLE_MINUTES = 5;

export async function logEntityRead(
  entityType: "lead" | "client",
  entityId: string,
): Promise<void> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const action = entityType === "lead" ? "lead.open" : "client.open";
    const sb = await supabaseServiceRole();
    const since = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString();

    const { data: recent } = await sb
      .from("audit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("action", action)
      .eq("entity_id", entityId)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (recent) return; // déjà tracé récemment → on n'ajoute rien

    await sb.from("audit_logs").insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
    });
  } catch {
    /* best-effort — la traçabilité de lecture ne doit jamais gêner l'usage */
  }
}
