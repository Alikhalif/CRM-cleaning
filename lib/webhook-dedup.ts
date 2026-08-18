import "server-only";
import { supabaseServiceRole } from "./supabase/service";

// Idempotence des webhooks (CDC : « duplicate events return 200 no-op »).
// Insère (source, event_key) ; une violation d'unicité => événement déjà traité.
// Best-effort : en cas d'erreur d'infra on renvoie false (on traite l'événement)
// pour ne pas perdre un webhook légitime.
export async function isDuplicateWebhook(source: string, eventKey: string): Promise<boolean> {
  if (!eventKey) return false;
  try {
    const admin = await supabaseServiceRole();
    const { error } = await admin
      .from("webhook_events")
      .insert({ source, event_key: eventKey } as never);
    if (!error) return false;
    // 23505 = unique_violation → déjà vu.
    return (error as { code?: string }).code === "23505";
  } catch (e) {
    console.error("isDuplicateWebhook failed:", e);
    return false;
  }
}
