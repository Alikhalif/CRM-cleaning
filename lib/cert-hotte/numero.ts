import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";

// Alloue le prochain numéro de certificat au format « CERT-HOTTE-AAAA-00001 ».
// Gapless, per-year, atomique côté base (RPC SECURITY DEFINER + verrou de ligne)
// — un numéro n'est consommé qu'à l'émission réelle, jamais à l'aperçu.
export async function allocateCertHotteNumero(
  year: number = new Date().getFullYear(),
): Promise<string> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.rpc("next_cert_hotte_num", { p_year: year });
  if (error || !data) {
    throw new Error(
      "Allocation du numéro de certificat échouée : " +
        (error?.message ?? "réponse vide"),
    );
  }
  return data as string;
}
