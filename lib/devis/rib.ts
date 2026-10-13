import "server-only";
import fs from "node:fs";
import path from "node:path";

// RIB OPTIMIVV joint à chaque devis/facture envoyé au client, pour qu'il n'ait
// pas à le réclamer avant de virer l'acompte.
//
// ⚠️ Le fichier vit dans assets/ et NON dans public/ : un IBAN servi à une URL
// devinable permet de monter un mandat de prélèvement SEPA frauduleux. Il n'est
// lisible que par le serveur, au moment de composer l'e-mail. next.config.ts
// l'embarque dans le bundle standalone (outputFileTracingIncludes, /api/devis).
const RIB_PATH =
  process.env.DEVIS_RIB_PATH ||
  path.join(process.cwd(), "assets", "rib-optimivv.pdf");

// Nom vu par le client dans sa boîte mail.
export const RIB_FILENAME = "RIB-OPTIMIVV.pdf";

let cache: Buffer | null | undefined;

// Renvoie null si le fichier est absent ou illisible : l'envoi du devis ne doit
// JAMAIS échouer à cause de la pièce jointe secondaire. Lu une fois par
// processus — le RIB ne change pas en cours de vie du serveur.
export function ribBuffer(): Buffer | null {
  if (cache !== undefined) return cache;
  try {
    cache = fs.readFileSync(RIB_PATH);
  } catch {
    cache = null;
  }
  return cache;
}
