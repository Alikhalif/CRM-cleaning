import "server-only";
import { after } from "next/server";
import { evaluerActionsBackOffice } from "./engine-server";

/**
 * Évaluation IMMÉDIATE des actions back-office, juste après la réponse.
 *
 * « Les alertes doivent être immédiates lorsqu'une action est attendue » : le
 * cron seul laisserait jusqu'à deux minutes de latence. `after()` (Next 16,
 * voir node_modules/next/dist/docs/…/after.md) exécute l'évaluation une fois
 * la réponse envoyée — l'utilisateur n'attend pas. Le moteur est idempotent :
 * l'appeler même quand l'action a échoué est sans effet.
 */
export function declencherActionsBackOffice(): void {
  after(async () => {
    try {
      const b = await evaluerActionsBackOffice();
      if (!b.ok) console.warn("[actions-back-office] évaluation immédiate ignorée :", b.raison);
    } catch (e) {
      console.error("[actions-back-office] évaluation immédiate en échec :", (e as Error).message);
    }
  });
}
