"use client";

import { useRef, useState } from "react";
import { composerAdresse } from "@/lib/adresses";

type Cles = { rue: string; cp: string; ville: string };

/**
 * Calcul du kilométrage routier entre deux adresses de la découverte.
 *
 * `auto` = déclenché en sortant d'un champ adresse, sans clic : le commercial
 * oubliait le bouton et la distance manquait au devis. Deux garde-fous, parce
 * que Nominatim/OSRM sont des services publics gratuits plafonnés (~1 req/s) :
 *   • on ne part QUE sur sortie de champ, jamais à chaque frappe ;
 *   • on mémorise le dernier couple d'adresses calculé, donc traverser les
 *     champs sans rien modifier ne redéclenche rien.
 *
 * En mode auto on reste silencieux si les adresses sont incomplètes — c'est
 * l'état normal pendant la saisie, pas une erreur à afficher. Le bouton
 * « Recalculer » reste la reprise manuelle (adresse corrigée, service tombé).
 */
export function useDistance(
  details: Record<string, unknown>,
  set: (k: string, v: unknown) => void,
  depart: Cles,
  arrivee: Cles,
  /** Pays du dossier — oriente le géocodage d'un code postal saisi seul. */
  pays?: string | null,
) {
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const dernierCouple = useRef<string>("");
  // Verrou d'appel. Cliquer sur « Recalculer » fait d'abord perdre le focus au
  // champ adresse : sans ce verrou, le blur et le clic lanceraient DEUX
  // requêtes simultanées. Un ref, pas un state : il doit être à jour dans le
  // même tick, avant tout re-rendu.
  const enCours = useRef(false);

  const lire = (c: Cles) =>
    composerAdresse({
      rue: typeof details[c.rue] === "string" ? (details[c.rue] as string) : "",
      cp: typeof details[c.cp] === "string" ? (details[c.cp] as string) : "",
      ville: typeof details[c.ville] === "string" ? (details[c.ville] as string) : "",
    }).trim();

  const calculer = async (auto = false) => {
    // Les anciens dossiers n'ont que la rue — qui contenait souvent la ville
    // entière : composerAdresse les laisse passer tels quels, donc leur
    // distance continue de se calculer.
    const from = lire(depart);
    const to = lire(arrivee);
    if (!from || !to) {
      if (!auto) setErreur("Renseignez les deux adresses.");
      return;
    }
    const couple = `${from} » ${to} » ${pays ?? ""}`;
    if (auto && couple === dernierCouple.current) return;
    if (enCours.current) return;
    enCours.current = true;
    dernierCouple.current = couple;
    setErreur(null);
    setBusy(true);
    try {
      const r = await fetch(
        `/api/geo/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
          (pays ? `&pays=${encodeURIComponent(pays)}` : ""),
      );
      const d = (await r.json()) as { km?: number; error?: string };
      if (!r.ok || d.km == null) {
        setErreur(d.error ?? "Calcul impossible.");
        return;
      }
      set("distanceKm", d.km);
    } catch {
      setErreur("Service de distance indisponible — saisissez la distance à la main.");
    } finally {
      enCours.current = false;
      setBusy(false);
    }
  };

  return { busy, erreur, calculer };
}
