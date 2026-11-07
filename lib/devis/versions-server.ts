import "server-only";

// M1 — historique des versions d'un devis.
//
// ── LE MANQUE QUE CE MODULE COMBLE ───────────────────────────────────
//
// La rédaction assistée garde un historique DANS L'ÉDITEUR, pas en base.
// Fermer l'onglet avant d'enregistrer perd les versions intermédiaires, et
// une fois « Enregistrer » cliqué, le texte précédent est écrasé.
//
// Personne ne peut donc dire qui a réécrit quoi sur un devis, ni quand, ni
// comparer le texte envoyé au client avec celui que le moteur avait produit.
// Le jour où un client contestera une formulation, c'est exactement ce qu'il
// faudra montrer.
//
// ── ⚠️ LA TABLE N'EXISTE PAS ENCORE ──────────────────────────────────
//
// `document_versions` est décrite dans `docs/MIGRATION-M1-HISTORIQUE-DEVIS.md`
// et **la migration attend votre autorisation**. Elle n'est donc ni dans
// `supabase/migrations/`, ni dans les types générés.
//
// Ce module est écrit pour que son absence NE CASSE RIEN :
//
//   · `enregistrerVersion()` échoue en silence et retourne `false` ;
//   · `historiqueDuDocument()` retourne « indisponible » plutôt qu'une
//     erreur, et l'écran affiche pourquoi ;
//   · aucun appelant ne dépend de son succès pour accomplir sa tâche.
//
// Le jour où la migration est appliquée, l'historique se remplit tout seul.
// Rien d'autre n'est à faire.

import { supabaseServer } from "@/lib/supabase/server";
import type {
  Historique, OrigineVersion, VersionDocument,
} from "./versions-shared";

// Les types et les libellés vivent dans `versions-shared.ts` : le panneau qui
// affiche l'historique est un composant CLIENT, et il ne peut pas importer un
// module `server-only`. On les réexporte pour que les appelants serveur
// n'aient qu'un seul import à écrire.
export type { Historique, OrigineVersion, VersionDocument };
export { LIBELLE_ORIGINE, versionDEmission } from "./versions-shared";

/**
 * Codes d'erreur qui signifient « la table n'existe pas ».
 *
 * PostgREST en rend deux selon qu'il interroge Postgres directement ou son
 * cache de schéma. Les traiter comme une panne afficherait une erreur rouge
 * là où la bonne réponse est « fonctionnalité non activée ».
 */
const TABLE_ABSENTE = new Set(["42P01", "PGRST205", "PGRST204"]);

const estTableAbsente = (code: string | undefined | null): boolean =>
  code != null && TABLE_ABSENTE.has(code);

/**
 * Accès à une table absente des types générés.
 *
 * ⚠️ C'est le SEUL endroit du dépôt où ce contournement est écrit, et il est
 * temporaire : `document_versions` entrera dans `database.types.ts` à la
 * première régénération qui suivra la migration. L'isoler ici évite que le
 * contournement se propage.
 */
type ClientBrut = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: unknown[] | null;
          error: { code?: string; message: string } | null;
        }>;
      };
    };
    insert: (rows: unknown) => Promise<{
      error: { code?: string; message: string } | null;
    }>;
  };
};

const texte = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Enregistre une version. Ne fait jamais échouer l'action de l'appelant.
 *
 * ── Pourquoi « meilleur effort » ─────────────────────────────────────
 *
 * Même discipline que `lib/audit.ts` : un historique est une trace, pas une
 * condition. Refuser d'enregistrer un devis parce que sa version n'a pas pu
 * être écrite transformerait un confort en panne.
 *
 * Le numéro de version est attribué par la base : `unique (document_id,
 * version)` garantit qu'une course perdue lève une violation d'unicité au
 * lieu d'écrire deux fois la même version. On relit donc le dernier numéro
 * et on réessaie une fois en cas de collision.
 */
export async function enregistrerVersion(args: {
  documentId: string;
  designation: string;
  notes: string;
  origine: OrigineVersion;
  regles?: string[];
  note?: string;
}): Promise<boolean> {
  try {
    const sb = (await supabaseServer()) as unknown as ClientBrut;
    const { data: { user } } = await (await supabaseServer()).auth.getUser();

    for (let essai = 0; essai < 2; essai++) {
      const lues = await sb
        .from("document_versions")
        .select("version")
        .eq("document_id", args.documentId)
        .order("version", { ascending: false });
      if (lues.error) {
        if (estTableAbsente(lues.error.code)) return false;
        return false;
      }
      const derniere = (lues.data ?? [])
        .map((r) => Number((r as { version?: unknown }).version ?? 0))
        .reduce((max, n) => (n > max ? n : max), 0);

      const { error } = await sb.from("document_versions").insert({
        document_id: args.documentId,
        version: derniere + 1,
        designation: args.designation,
        notes: args.notes,
        origine: args.origine,
        regles: args.regles ?? [],
        note: args.note ?? null,
        cree_par: user?.id ?? null,
      });
      if (!error) return true;
      // 23505 = violation d'unicité : un autre onglet a pris le numéro.
      // On relit et on réessaie UNE fois ; au-delà, on abandonne sans bruit.
      if (error.code !== "23505") return false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Historique d'un document, du plus récent au plus ancien.
 *
 * La lecture passe par la session : la RLS de `document_versions` est calquée
 * sur celle de `documents`, donc un commercial ne voit que l'historique de
 * SES devis — un historique plus permissif que le document qu'il décrit
 * serait une fuite.
 */
export async function historiqueDuDocument(documentId: string): Promise<Historique> {
  if (!documentId) return { disponible: true, versions: [] };
  try {
    const sb = (await supabaseServer()) as unknown as ClientBrut;
    const { data, error } = await sb
      .from("document_versions")
      .select("id, version, designation, notes, origine, regles, note, cree_le, cree_par")
      .eq("document_id", documentId)
      .order("version", { ascending: false });

    if (error) {
      if (estTableAbsente(error.code)) {
        return {
          disponible: false,
          motif:
            "L'historique des versions n'est pas encore activé : la migration "
            + "M1 n'a pas été appliquée. Le descriptif actuel reste consultable, "
            + "mais les versions antérieures ne sont pas conservées.",
        };
      }
      return { disponible: false, motif: `Lecture impossible : ${error.message}` };
    }

    const versions = (data ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      return {
        id: texte(o.id),
        version: Number(o.version ?? 0),
        designation: texte(o.designation),
        notes: texte(o.notes),
        origine: (texte(o.origine) || "manuel") as OrigineVersion,
        regles: Array.isArray(o.regles) ? (o.regles as unknown[]).map(texte) : [],
        note: texte(o.note),
        creeLe: texte(o.cree_le),
        creePar: texte(o.cree_par) || null,
        auteur: null,
      } satisfies VersionDocument;
    });

    return { disponible: true, versions };
  } catch (e) {
    return {
      disponible: false,
      motif: `Lecture impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    };
  }
}

// `versionDEmission` est réexportée depuis `versions-shared.ts` : elle est
// pure, et le panneau client en a besoin autant que le serveur.
