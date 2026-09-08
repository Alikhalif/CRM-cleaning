"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "../Icon/Icon";
import styles from "./MobileTabBar.module.scss";

// Barre d'onglets basse — VISIBLE UNIQUEMENT en mobile (≤768px, via le SCSS).
// Ne rend rien de neuf métier : elle pointe vers les routes EXISTANTES, adaptées
// au rôle connecté. « Plus » ouvre le tiroir de navigation complet (Sidebar
// off-canvas), via un évènement écouté par la Sidebar.

export const TOGGLE_MOBILE_NAV = "cgk:toggle-mobile-nav";

type Tab = { href: string; label: string; icon: IconName };

const TABS: Record<string, Tab[]> = {
  admin: [
    { href: "/dashboard", label: "Cockpit", icon: "dashboard" },
    { href: "/presence", label: "Présence", icon: "presence" },
    { href: "/leads", label: "Leads", icon: "leads" },
    { href: "/comptabilite", label: "CA", icon: "comptabilite" },
  ],
  planification: [
    { href: "/dashboard", label: "Accueil", icon: "dashboard" },
    { href: "/planification", label: "Planning", icon: "planification" },
    { href: "/comptabilite", label: "Factures", icon: "comptabilite" },
    { href: "/signatures", label: "Docs", icon: "document" },
  ],
  commercial: [
    { href: "/dashboard", label: "Accueil", icon: "dashboard" },
    { href: "/leads", label: "Leads", icon: "leads" },
    { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
    { href: "/devis/new", label: "Devis", icon: "document" },
  ],
};

export default function MobileTabBar({ role }: { role: string }) {
  const pathname = usePathname();
  const tabs = TABS[role] ?? TABS.commercial;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className={styles.tabbar} data-no-print="true" aria-label="Navigation mobile">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={styles.tab} data-active={isActive(t.href) ? "true" : "false"}>
          <Icon name={t.icon} size={21} />
          <span>{t.label}</span>
        </Link>
      ))}
      <button
        type="button"
        className={styles.tab}
        onClick={() => window.dispatchEvent(new Event(TOGGLE_MOBILE_NAV))}
        aria-label="Plus"
      >
        <Icon name="more-vertical" size={21} />
        <span>Plus</span>
      </button>
    </nav>
  );
}
