// Vocabulaire des tags « Activités / Contrats » d'un client (§2). Client-safe
// (aucune I/O). Un client peut cumuler plusieurs tags. Sert à cocher la fiche
// client et à proposer les documents/contrats correspondants.

export type ActivityTag =
  | "hotte"
  | "restaurant"
  | "desinsectisation"
  | "deratisation"
  | "punaises"
  | "cafards"
  | "guepes_frelons"
  | "autres_nuisibles"
  | "contrat_recurrent"
  | "ponctuel";

export const ACTIVITY_TAG_LABEL: Record<ActivityTag, string> = {
  hotte: "Hotte professionnelle",
  restaurant: "Restaurant / Cuisine pro",
  desinsectisation: "Désinsectisation",
  deratisation: "Dératisation",
  punaises: "Punaises de lit",
  cafards: "Cafards",
  guepes_frelons: "Guêpes / Frelons",
  autres_nuisibles: "Autres nuisibles",
  contrat_recurrent: "Contrat récurrent",
  ponctuel: "Intervention ponctuelle",
};

// Regroupement pour l'affichage (3 blocs de cases à cocher).
export const ACTIVITY_TAG_GROUPS: { title: string; tags: ActivityTag[] }[] = [
  { title: "Hotte & cuisine", tags: ["hotte", "restaurant"] },
  { title: "Nuisibles", tags: ["desinsectisation", "deratisation", "punaises", "cafards", "guepes_frelons", "autres_nuisibles"] },
  { title: "Nature de la relation", tags: ["contrat_recurrent", "ponctuel"] },
];

export const ALL_ACTIVITY_TAGS: ActivityTag[] = ACTIVITY_TAG_GROUPS.flatMap((g) => g.tags);

export function isActivityTag(v: string): v is ActivityTag {
  return (ALL_ACTIVITY_TAGS as string[]).includes(v);
}
