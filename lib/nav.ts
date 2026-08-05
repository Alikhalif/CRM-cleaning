// Navigation config — single source of truth for the sidebar (and later, the ⌘K palette).
// Order and groupings match §4.1 of the cahier des charges.

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  // For the leads counter badge etc.
  badge?: "leadsUntreated";
};

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
  | "settings";

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    items: [
      { href: "/dashboard",      label: "Dashboard",     icon: "dashboard" },
      { href: "/recherche",      label: "Recherche",     icon: "search" },
      { href: "/pipeline",       label: "Pipeline",      icon: "pipeline" },
      { href: "/leads",          label: "Leads & devis", icon: "leads", badge: "leadsUntreated" },
      { href: "/a-affecter",     label: "À affecter",    icon: "leads" },
      { href: "/decouverte",     label: "Découverte",    icon: "search" },
      { href: "/commerciaux",    label: "Commerciaux",   icon: "commerciaux" },
      { href: "/performance",    label: "Performance",   icon: "commerciaux" },
      { href: "/planification",  label: "Planification", icon: "planification" },
      { href: "/chiffrage",      label: "Chiffrage",     icon: "planification" },
      { href: "/comptabilite",   label: "Comptabilité",  icon: "comptabilite" },
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
