import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { notifyRole } from "@/lib/notifications";

// Alertes documentaires « push » (§9) — cloche de la planification. Volontairement
// conservateur et dédupliqué au jour (une notification par contrat et par jour)
// pour ne jamais spammer. La visibilité complète des alertes vit sur /documents
// (calcul à la lecture) ; ce moteur ne fait que pousser les plus urgentes.

const SOON_DAYS = 7;
const MAX_NOTIFS = 50;

type Sb = Awaited<ReturnType<typeof supabaseServiceRole>>;

// Déjà notifié aujourd'hui pour ce (kind, contrat) ?
async function alreadyNotifiedToday(sb: Sb, kind: string, contractId: string, sinceIso: string): Promise<boolean> {
  const { count } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("entity_id", contractId)
    .gte("created_at", sinceIso);
  return (count ?? 0) > 0;
}

export async function evaluateDocumentAlerts(): Promise<{ ok: true; notified: number; ranAt: string }> {
  const sb = await supabaseServiceRole();
  const now = Date.now();
  const soonCut = new Date(now + SOON_DAYS * 86_400_000).toISOString().slice(0, 10);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const sinceIso = dayStart.toISOString();
  let notified = 0;

  // Contrats actifs / à renouveler qui expirent sous 7 jours.
  const { data: contracts } = await sb
    .from("contracts")
    .select("id, ref, title, client_id, end_date, status")
    .is("deleted_at", null)
    .in("status", ["actif", "a_renouveler"] as never[])
    .not("end_date", "is", null)
    .lte("end_date", soonCut)
    .limit(MAX_NOTIFS)
    .returns<{ id: string; ref: string | null; title: string; client_id: string; end_date: string | null; status: string }[]>();

  for (const c of contracts ?? []) {
    if (await alreadyNotifiedToday(sb, "contract.expiring", c.id, sinceIso)) continue;
    await notifyRole("planification", {
      kind: "contract.expiring",
      entityType: "client",
      entityId: c.id, // clé de dédup (le lien pointe vers le tableau de bord)
      title: `Contrat à renouveler — ${c.title}`,
      body: `${c.ref ?? ""} · échéance ${c.end_date}`,
      href: "/documents",
    });
    notified += 1;
  }

  return { ok: true, notified, ranAt: new Date().toISOString() };
}
