import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Country } from "@/lib/leads";
import { aujourdhuiLegal } from "./series-shared";

// D26 — état des séries de factures, par société.
//
// `select("*")` sur `legal_entities` : `code_numerotation` et
// `numerotation_depuis` n'existent qu'avec la migration 20261109000003. Sans
// elle, l'écran le DIT (« migration non appliquée ») au lieu de casser la page
// des sociétés.

export type EtatSerie = {
  id: string;
  nom: string;
  pays: Country | null;
  code: string | null;
  depuis: string | null;
  /** Date d'effet atteinte : la société numérote déjà dans sa série. */
  active: boolean;
  /** Au moins une facture a été numérotée dans la série dédiée. */
  employee: boolean;
};

export async function lireSeries(): Promise<{ migrationAppliquee: boolean; series: EtatSerie[] }> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("legal_entities").select("*").order("legal_name");
  const lignes = (data ?? []) as Record<string, unknown>[];
  const migrationAppliquee = lignes.length === 0 || "code_numerotation" in lignes[0];

  // Les compteurs ne sont lisibles QUE par le service-role (RLS sans politique,
  // voulue) : on n'en lit que l'existence, par société.
  const employees = new Set<string>();
  if (migrationAppliquee && lignes.length > 0) {
    const admin = await supabaseServiceRole();
    const { data: c } = await admin.from("facture_counters").select("entity_id");
    for (const r of (c ?? []) as { entity_id: string }[]) employees.add(r.entity_id);
  }

  const series = lignes.map((l) => {
    const pays = (l.country as Country | null) ?? null;
    const code = (l.code_numerotation as string | null) ?? null;
    const depuis = (l.numerotation_depuis as string | null) ?? null;
    return {
      id: l.id as string,
      nom: (l.legal_name as string) ?? "",
      pays,
      code,
      depuis,
      active: !!code && !!depuis && aujourdhuiLegal(pays) >= depuis,
      employee: employees.has(l.id as string),
    };
  });
  return { migrationAppliquee, series };
}
