import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

// Annulation d'une facture émise (migration 20261109000003).
//
// Lu par `select("*")` et non par une liste de colonnes : tant que la
// migration n'est pas appliquée, `annulee_at` n'existe pas, et une liste
// explicite ferait échouer la lecture de TOUTE la fiche facture. Avec `*`, la
// colonne est simplement absente et la facture se lit comme avant.
export type AnnulationFacture = { annuleeAt: string; motif: string | null } | null;

export async function lireAnnulationFacture(documentId: string): Promise<AnnulationFacture> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle<{ annulee_at?: string | null; annulation_motif?: string | null }>();
  if (!data?.annulee_at) return null;
  return { annuleeAt: data.annulee_at, motif: data.annulation_motif ?? null };
}
