import "server-only";

// Historique des modifications de coordonnées bancaires.
//
// ── POURQUOI AUCUNE TABLE NOUVELLE ──────────────────────────────────
//
// Le client demande que chaque modification soit « historisée, sécurisée et
// tracée ». `audit_logs` fait déjà les trois : il est **append-only**, écrit
// par la clé de service, et conservé. Créer une table `iban_history` à côté
// aurait coûté une migration — donc une autorisation de plus à demander — pour
// dupliquer une garantie qui existe.
//
// L'historique est donc une LECTURE de `audit_logs`, filtrée sur l'action
// `entity.bank_change`.
//
// ⚠️ Ce que cette lecture rend est déjà MASQUÉ à l'écriture : l'action
// n'écrit jamais l'IBAN en clair dans le journal. Il n'y a donc rien à
// masquer ici — et surtout rien à déchiffrer, parce qu'il n'y a rien de
// chiffré : le masque a été calculé avant l'écriture.

import { supabaseServer } from "@/lib/supabase/server";

export type ModificationBancaire = {
  /** Horodatage de la modification. */
  quand: string;
  /** Nom de l'auteur, ou `null` si la résolution échoue. */
  qui: string | null;
  /** Coordonnée AVANT, masquée. */
  avant: string;
  /** Coordonnée APRÈS, masquée. */
  apres: string;
  /** BIC avant / après, masqués. */
  bicAvant: string;
  bicApres: string;
  /** La valeur écrite était-elle chiffrée ? */
  chiffre: boolean;
};

type LigneAudit = {
  created_at: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  user: { first_name: string | null; last_name: string | null } | null;
};

function texte(v: unknown): string {
  return typeof v === "string" ? v : "(inconnu)";
}

/**
 * Historique des coordonnées bancaires, par société.
 *
 * Une seule requête pour toutes les sociétés : l'écran les affiche côte à
 * côte, et une requête par société multiplierait les allers-retours pour
 * sept lignes.
 *
 * Une lecture en échec rend une carte VIDE plutôt que de lever : l'absence
 * d'historique ne doit pas empêcher de consulter ou de corriger un IBAN.
 */
export async function historiqueBancaireParSociete(): Promise<
  Map<string, ModificationBancaire[]>
> {
  const out = new Map<string, ModificationBancaire[]>();
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("audit_logs")
      .select("created_at, entity_id, before, after, user:users(first_name, last_name)")
      .eq("action", "entity.bank_change")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<LigneAudit[]>();

    if (error) {
      console.error("[coordonnees-bancaires] historique illisible :", error.message);
      return out;
    }

    for (const l of data ?? []) {
      if (!l.entity_id) continue;
      const nom = l.user
        ? [l.user.first_name, l.user.last_name].filter(Boolean).join(" ").trim() || null
        : null;
      const entree: ModificationBancaire = {
        quand: l.created_at ?? "",
        qui: nom,
        avant: texte(l.before?.iban),
        apres: texte(l.after?.iban),
        bicAvant: texte(l.before?.bic),
        bicApres: texte(l.after?.bic),
        chiffre: l.after?.chiffre === true,
      };
      out.set(l.entity_id, [...(out.get(l.entity_id) ?? []), entree]);
    }
  } catch (e) {
    console.error(
      "[coordonnees-bancaires] historique indisponible :",
      e instanceof Error ? e.message : "cause inconnue",
    );
  }
  return out;
}
