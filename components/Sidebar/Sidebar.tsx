"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../Icon/Icon";
import { logout } from "@/app/(auth)/actions";
import { NAV_GROUPS } from "@/lib/nav";
import { setStoredValue, useStoredValue } from "@/lib/client-store";
import styles from "./Sidebar.module.scss";

const COLLAPSED_KEY = "cgk-sidebar-collapsed";
const THEME_KEY = "cgk-theme";

export default function Sidebar() {
  const pathname = usePathname();
  const collapsed = useStoredValue(COLLAPSED_KEY, "0") === "1";
  const theme = (useStoredValue(THEME_KEY, "light") === "dark" ? "dark" : "light") as
    | "light"
    | "dark";

  const toggleCollapsed = () => setStoredValue(COLLAPSED_KEY, collapsed ? "0" : "1");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setStoredValue(THEME_KEY, next);
  };

  return (
    <aside
      className={styles.sidebar}
      data-collapsed={collapsed ? "true" : "false"}
      data-no-print="true"
      aria-label="Navigation principale"
    >
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">CGK</span>
        {!collapsed && <span className={styles.brandName}>CRM</span>}
      </div>

      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className={styles.group}>
            {!collapsed && <div className={styles.groupLabel}>{group.label}</div>}
            <ul>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.navLink}
                      data-active={active ? "true" : "false"}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={styles.navIcon}>
                        <Icon name={item.icon} size={18} />
                      </span>
                      {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          onClick={toggleTheme}
          className={styles.footerBtn}
          aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"}
          title={theme === "dark" ? "Mode clair" : "Mode sombre"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          {!collapsed && <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>}
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={styles.footerBtn}
          aria-label={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
          title={collapsed ? "Étendre" : "Réduire"}
        >
          <Icon name="panel-left" size={18} />
          {!collapsed && <span>Réduire</span>}
        </button>
        <form action={logout}>
          <button
            type="submit"
            className={styles.footerBtn}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <Icon name="x" size={18} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
