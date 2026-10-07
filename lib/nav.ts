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
  | "settings";

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      { href: "/dashboard",      label: "Dashboard",     icon: "dashboard" },
      { href: "/ma-journee",     label: "Ma journée",    icon: "checklist" },
      { href: "/recherche",      label: "Recherche",     icon: "search" },
      { href: "/pipeline",       label: "Pipeline",      icon: "pipeline" },
      { href: "/leads",          label: "Leads & devis", icon: "leads", badge: "leadsUntreated" },
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
