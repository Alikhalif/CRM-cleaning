"use server";

// Réglage des seuils d'ancienneté de la vue « Devis à réaliser » (§6).
//
// Ce sont des seuils d'AFFICHAGE : ils décident d'une couleur et d'un compteur
// « en retard », jamais d'un montant, d'un statut de pipeline ni d'une tâche.
// Les modifier ne déplace aucun dossier.
//
// Réservé au Super Admin, et vérifié ICI en plus de la RLS : la table
// `app_settings` n'accepte les écritures que de `is_admin()`, mais un message
// d'erreur clair vaut mieux qu'un refus muet de la base.

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { APP_SETTING_KEYS } from "@/lib/app-settings";
import { SEUILS_DEFAUT } from "@/lib/devis-a-realiser/shared";

export type Result = { ok: true } | { ok: false; error: string };

export async function setSeuilsDevis(vertH: number, orangeH: number): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: roles } = await supabase
    .from("user_roles").select("roles(slug)").eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  if (!(roles ?? []).some((r) => r.roles?.slug === "admin")) {
    return { ok: false, error: "Réservé au Super Admin." };
  }

  // Les bornes doivent rester ordonnées, sinon la colonne « Attente » ne veut
  // plus rien dire : on refuse plutôt que de réordonner en silence.
  if (!Number.isFinite(vertH) || vertH <= 0) {
    return { ok: false, error: "Le seuil vert doit être un nombre d'heures positif." };
  }
  if (!Number.isFinite(orangeH) || orangeH <= vertH) {
    return { ok: false, error: "Le seuil orange doit être supérieur au seuil vert." };
  }

  const ecrire = async (key: string, value: number) =>
    supabase
      .from("app_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: user.id } as never,
        { onConflict: "key" },
      );

  const [a, b] = await Promise.all([
    ecrire(APP_SETTING_KEYS.devisSeuilVertH, vertH),
    ecrire(APP_SETTING_KEYS.devisSeuilOrangeH, orangeH),
  ]);
  const erreur = a.error ?? b.error;
  if (erreur) return { ok: false, error: erreur.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    after: { devis_a_realiser_seuils: { vertH, orangeH }, defauts: SEUILS_DEFAUT },
  });

  // Les trois surfaces qui portent le compteur ou la couleur.
  revalidatePath("/devis-a-realiser");
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  return { ok: true };
}
