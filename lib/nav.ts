// Navigation config — single source of truth for the sidebar (and later, the ⌘K palette).
// Order and groupings match §4.1 of the cahier des charges.

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  // For the leads counter badge etc.
  badge?: "leadsUntreated";
};

// La VISIBILITÉ d'une entrée n'est pas déclarée ici : elle est dérivée de son
// `href` via `scopeForPath()` (lib/access-shared.ts), qui est aussi ce qui garde
// les routes côté serveur. Une seule source de vérité → la sidebar, la palette
// ⌘K et les gardes de module ne peuvent pas diverger.

export type NavGroup = {
  id: "pilotage" | "configuration";
  label: string;
  items: NavItem[];
};

export type NavIcon =
  | "dashboard"
  | "pipeline"
  | "leads"
  | "search"
  | "commerciaux"
  | "planification"
  | "comptabilite"
  | "document"
  | "folder"
  | "presence"
  | "checklist"
  | "subcontractor"
  | "calendar"
  | "bell"
  | "settings";

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      { href: "/dashboard",      label: "Dashboard",     icon: "dashboard" },
      { href: "/mes-actions",    label: "Mes actions",   icon: "checklist" },
      // Ajoutées au Lot A du 2026-11-07. Les deux pages existaient et
      // fonctionnaient, mais n'étaient atteignables que par URL directe :
      // développées et invisibles, donc non livrées côté interface.
      //
      // « Ma journée » suit « Mes actions » : même famille, le travail du jour.
      { href: "/ma-journee",     label: "Ma journée",    icon: "calendar" },
      { href: "/recherche",      label: "Recherche",     icon: "search" },
      { href: "/pipeline",       label: "Pipeline",      icon: "pipeline" },
      { href: "/leads",          label: "Suivi commercial", icon: "leads", badge: "leadsUntreated" },
      // Vue de travail entre la découverte et l'envoi du devis. Ouverte à
      // tous : son périmètre est déjà restreint par la RLS et par le filtre
      // d'activité, elle n'a donc rien à faire dans RESTRICTED_MODULES.
      { href: "/devis-a-realiser", label: "Devis à réaliser", icon: "document" },
      { href: "/a-affecter",     label: "À affecter",    icon: "leads" },
      { href: "/decouverte",     label: "Découverte",    icon: "search" },
      { href: "/commerciaux",    label: "Commerciaux",   icon: "commerciaux" },
      { href: "/performance",    label: "Performance",   icon: "commerciaux" },
      { href: "/planification",  label: "Planification", icon: "planification" },
      { href: "/chiffrage",      label: "Chiffrage",     icon: "planification" },
      { href: "/sous-traitants", label: "Sous-traitants", icon: "subcontractor" },
      { href: "/comptabilite",   label: "Comptabilité",  icon: "comptabilite" },
      { href: "/documents",      label: "Documents & Contrats", icon: "folder" },
      { href: "/signatures",     label: "Signatures",    icon: "document" },
      { href: "/presence",       label: "Présence & Actions", icon: "presence" },
      { href: "/grilles-tarifaires", label: "Grilles tarifaires", icon: "comptabilite" },
      // La cloche de la Topbar ouvre un panneau ; cette entrée mène à la page
      // complète. Même icône, pour qu'on comprenne que c'est le même sujet.
      { href: "/notifications",  label: "Notifications", icon: "bell" },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [
      { href: "/settings", label: "Paramètres", icon: "settings" },
    ],
  },
];
