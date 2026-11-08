import "server-only";

// Le goulet par lequel passe TOUT envoi réel, et la capture de ce qui ne part
// pas. Voir `lib/envoi/decision.ts` pour la décision, qui est pure.
//
// ── CE QUE « CAPTURER » VEUT DIRE ICI ────────────────────────────────
//
// Un message refusé n'est pas jeté : il est écrit sur le disque, en entier,
// pièces jointes comprises. On peut donc vérifier en recette ce qu'un client
// AURAIT reçu — le sujet, le corps, le PDF, le RIB — sans qu'aucun client ne
// reçoive rien.
//
// ── ET CE QU'ELLE NE FAIT PAS : MENTIR ───────────────────────────────
//
// Un message capturé rend `{ ok: false }`, avec un message qui dit pourquoi et
// où le trouver. Faire croire à l'interface que l'envoi a réussi serait une
// validation fictive : on vérifierait un écran qui affiche « Envoyé » alors
// que rien n'est parti. L'erreur explicite est le comportement juste.

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { modeEffectif } from "@/lib/env/cible";
import { type Canal, deciderEnvoi } from "./decision";

export type PieceJointe = { name: string; bytes: Buffer | Uint8Array };

export type Tentative = {
  canal: Canal;
  /** Quel transport aurait servi : sert à prouver qu'AUCUN ne contourne. */
  transport: "brevo" | "smtp";
  destinataire: string;
  sujet?: string;
  corpsHtml?: string;
  corpsTexte?: string;
  expediteur?: string;
  pieces?: PieceJointe[];
};

export type ResultatGarde = { ok: true } | { ok: false; error: string };

/** Répertoire des captures. Hors du dépôt par défaut (voir `.gitignore`). */
function repertoireCaptures(): string {
  const brut = process.env.CGK_CAPTURE_DIR?.trim();
  return resolve(process.cwd(), brut && brut.length > 0 ? brut : "var/envois-captures");
}

function horodatage(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function nomDeFichierSur(valeur: string): string {
  return valeur.replace(/[^a-zA-Z0-9._@-]/g, "_").slice(0, 60);
}

/**
 * Écrit la tentative sur le disque et rend le chemin du descripteur.
 *
 * Une capture qui échoue ne doit JAMAIS laisser passer l'envoi : l'appelant
 * traite l'échec d'écriture comme un refus, pas comme une permission.
 */
async function capturer(t: Tentative, motif: string): Promise<string> {
  const dossier = repertoireCaptures();
  await mkdir(dossier, { recursive: true });

  const base = `${horodatage()}__${t.canal}__${nomDeFichierSur(t.destinataire)}`;
  const descripteur = join(dossier, `${base}.json`);

  const nomsPieces: string[] = [];
  for (const [i, p] of (t.pieces ?? []).entries()) {
    const nom = `${base}__${String(i + 1).padStart(2, "0")}__${nomDeFichierSur(p.name)}`;
    await writeFile(join(dossier, nom), Buffer.from(p.bytes));
    nomsPieces.push(nom);
  }

  await writeFile(
    descripteur,
    JSON.stringify(
      {
        capture_le: new Date().toISOString(),
        motif,
        canal: t.canal,
        transport_qui_aurait_servi: t.transport,
        destinataire: t.destinataire,
        expediteur: t.expediteur ?? null,
        sujet: t.sujet ?? null,
        corps_texte: t.corpsTexte ?? null,
        corps_html: t.corpsHtml ?? null,
        pieces_jointes: nomsPieces,
      },
      null,
      2,
    ),
    "utf8",
  );

  return descripteur;
}

/**
 * À appeler AVANT tout accès réseau, dans chacun des trois points d'envoi.
 *
 * `{ ok: true }` → l'appelant procède à l'envoi réel.
 * `{ ok: false }` → l'appelant REND cette erreur et n'envoie rien.
 */
export async function garderEnvoi(t: Tentative): Promise<ResultatGarde> {
  const mode = modeEffectif({
    cgkEnv: process.env.CGK_ENV,
    nodeEnv: process.env.NODE_ENV,
  });

  const decision = deciderEnvoi({
    mode,
    canal: t.canal,
    destinataire: t.destinataire,
    envoiReelAutorise: process.env.CGK_ENVOI_REEL,
    destinatairesAutorises: process.env.CGK_DESTINATAIRES_AUTORISES,
  });

  if (decision.autorise) return { ok: true };

  // Refusé. On capture, et on le dit.
  try {
    const chemin = await capturer(t, decision.code);
    console.warn(
      `[garde-envoi] ${t.canal} via ${t.transport} REFUSÉ (${decision.code}) — ` +
        `capturé dans ${chemin}`,
    );
    return { ok: false, error: `${decision.message} Capture : ${chemin}` };
  } catch (err) {
    // Une capture impossible ne devient pas une autorisation.
    const cause = err instanceof Error ? err.message : "inconnue";
    console.error(`[garde-envoi] capture impossible : ${cause}`);
    return {
      ok: false,
      error: `${decision.message} (La capture a échoué : ${cause}. Rien n'a été envoyé.)`,
    };
  }
}
