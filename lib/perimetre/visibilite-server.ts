import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

// D32 — « l'objet est-il visible par l'APPELANT ? », tranché par la RLS.
//
// À appeler AVANT toute lecture au service-role qui porte sur un identifiant
// fourni par la requête (un dossier, un lead) : sans ce contrôle, le
// service-role répondrait pour n'importe quel dossier, y compris hors du
// périmètre de la planificatrice — un accès INDIRECT, exactement ce que le
// §3 du client interdit (« un document ou un contrat ne doit pas permettre
// d'accéder indirectement à un dossier hors périmètre »).

export async function dossierVisible(dossierId: string | null | undefined): Promise<boolean> {
  if (!dossierId) return false;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("dossiers").select("id").eq("id", dossierId).maybeSingle();
  return !!data;
}

export async function leadVisible(leadId: string | null | undefined): Promise<boolean> {
  if (!leadId) return false;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle();
  return !!data;
}
