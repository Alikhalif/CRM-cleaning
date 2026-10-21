import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Distance routière entre deux adresses, sans clé API : géocodage Nominatim
// (OpenStreetMap) puis itinéraire OSRM public. Best-effort — si un service est
// indisponible, renvoie 502 et le commercial saisit la distance à la main.
// Usage faible volume (une fois par dossier déménagement) → conforme aux
// politiques d'usage de ces services publics.

const UA = "CGK-CRM/1.0 (distance lookup)";

// Pays couverts par le CRM → code ISO attendu par Nominatim.
const PAYS_ISO: Record<string, string> = {
  FR: "fr", CH: "ch", LU: "lu", BE: "be", CA: "ca",
};

async function geocode(q: string, pays: string | null): Promise<{ lat: number; lon: number } | null> {
  // Sans ce biais, un code postal saisi seul (« 1000 », « 75011 ») peut
  // désigner une commune de n'importe quel pays : le commercial obtenait une
  // distance absurde sans comprendre pourquoi.
  const iso = pays ? PAYS_ISO[pays] : undefined;
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}` +
    (iso ? `&countrycodes=${iso}` : "");
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

export async function GET(req: Request) {
  // Réservé aux utilisateurs authentifiés (évite un proxy de géocodage ouvert).
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();
  // Pays du dossier, s'il est connu. Une valeur inattendue est ignorée plutôt
  // que refusée : mieux vaut un géocodage mondial qu'un calcul impossible.
  const paysBrut = (searchParams.get("pays") ?? "").trim().toUpperCase();
  const pays = PAYS_ISO[paysBrut] ? paysBrut : null;
  if (!from || !to) {
    return NextResponse.json({ error: "Adresses de départ et d'arrivée requises." }, { status: 400 });
  }

  try {
    const [a, b] = await Promise.all([geocode(from, pays), geocode(to, pays)]);
    if (!a) return NextResponse.json({ error: "Adresse de départ introuvable." }, { status: 422 });
    if (!b) return NextResponse.json({ error: "Adresse d'arrivée introuvable." }, { status: 422 });

    const osrm = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const res = await fetch(osrm, { headers: { "User-Agent": UA } });
    if (!res.ok) return NextResponse.json({ error: "Service d'itinéraire indisponible." }, { status: 502 });
    const data = (await res.json()) as { routes?: { distance: number }[] };
    const meters = data.routes?.[0]?.distance;
    if (meters == null) return NextResponse.json({ error: "Itinéraire introuvable." }, { status: 422 });

    return NextResponse.json({ km: Math.round(meters / 100) / 10 }); // 1 décimale
  } catch {
    return NextResponse.json({ error: "Calcul de distance indisponible." }, { status: 502 });
  }
}
