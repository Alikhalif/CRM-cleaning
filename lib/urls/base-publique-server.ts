import "server-only";

// Couche de lecture de l'environnement pour `lib/urls/base-publique.ts`, qui
// porte la décision et reste pur.
//
// Elle existe pour que les quatre points de construction d'URL du dépôt
// deviennent un appel chacun, au lieu de quatre expressions différentes dont
// deux étaient dangereuses.

import { headers } from "next/headers";
import { modeEffectif } from "@/lib/env/cible";
import {
  type Resolution,
  resoudreBase,
  verifierLienPublic,
} from "./base-publique";

function mode() {
  return modeEffectif({ cgkEnv: process.env.CGK_ENV, nodeEnv: process.env.NODE_ENV });
}

/**
 * URL de base publique, ou refus nommé.
 *
 * `headers()` n'est disponible que dans un contexte de requête (route
 * handler, server action, RSC). Hors de ce contexte il lève : on traite ce cas
 * comme « pas d'en-tête », et la décision se rabat sur la configuration.
 */
export async function baseUrlPublique(): Promise<Resolution> {
  let hoteEntete: string | null = null;
  let protoEntete: string | null = null;
  try {
    const h = await headers();
    hoteEntete = h.get("x-forwarded-host") || h.get("host");
    protoEntete = h.get("x-forwarded-proto");
  } catch {
    // Appel hors contexte de requête : aucun en-tête à valider.
  }

  return resoudreBase({
    mode: mode(),
    signatureBaseUrl: process.env.SIGNATURE_BASE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    domainesPublics: process.env.CGK_DOMAINES_PUBLICS,
    hoteEntete,
    protoEntete,
  });
}

/**
 * Dernier contrôle avant qu'un lien quitte le CRM vers un client.
 *
 * Rend `{ ok: false, raison }` plutôt que de lever : l'appelant décide s'il
 * refuse l'envoi (c'est ce que font tous les appelants actuels) ou s'il
 * poursuit sans lien.
 */
export function verifierLien(lien: string): { ok: true } | { ok: false; raison: string } {
  return verifierLienPublic(lien, process.env.CGK_DOMAINES_PUBLICS, mode());
}
