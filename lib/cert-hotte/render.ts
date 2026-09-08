import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import CertificatHottePdf from "@/lib/pdf/CertificatHottePdf";
import type { CertHotte } from "./types";

// Génère le PDF A4 (1 page) du certificat de conformité via @react-pdf/renderer.
// Même mécanique que les documents CRM (cf. lib/signature-server.ts) : on passe
// l'élément <Document> retourné par le composant directement à renderToBuffer.
export async function genererCertHotteBuffer(cert: CertHotte): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(CertificatHottePdf({ cert })));
}
