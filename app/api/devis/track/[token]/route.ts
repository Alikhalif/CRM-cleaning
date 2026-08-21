import { NextResponse } from "next/server";
import { verifyOpenToken } from "@/lib/devis/tracking";
import { markLeadDevisOuvert } from "@/lib/devis/status";

export const runtime = "nodejs";

// GIF transparent 1×1 (le « pixel de suivi »).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// GET /api/devis/track/<token>.gif
// Chargé par le client mail quand il ouvre l'e-mail du devis → fait avancer le
// lead « Devis envoyé » → « Devis ouvert » (méthode gratuite, sans Brevo Pro).
// Renvoie TOUJOURS le pixel (même token invalide) pour ne pas afficher d'image
// cassée. Monotone + idempotent via markLeadDevisOuvert.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const leadId = verifyOpenToken(token.replace(/\.gif$/, ""));
  if (leadId) {
    try {
      await markLeadDevisOuvert(leadId, "email_pixel");
    } catch {
      /* best-effort — on renvoie le pixel quoi qu'il arrive */
    }
  }
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
