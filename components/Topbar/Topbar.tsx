"use client";

import Icon from "../Icon/Icon";
import { OPEN_PALETTE_EVENT } from "../CommandPalette/CommandPalette";
import { useClientValue } from "@/lib/client-store";
import styles from "./Topbar.module.scss";

// The search button is the second way to open the ⌘K palette; the keyboard
// shortcut handler lives inside <CommandPalette>. Filters and notifications
// are still visual stubs.

export default function Topbar() {
  const shortcutLabel = useClientValue(
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    "⌘K",
  );

  const openPalette = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
    }
  };

  return (
    <header className={styles.topbar} role="banner" data-no-print="true">
      <button
        type="button"
        className={styles.search}
        aria-label="Rechercher"
        onClick={openPalette}
      >
        <Icon name="search" size={16} />
        <span className={styles.searchPlaceholder}>Rechercher un lead, un client, une page…</span>
        <kbd className={styles.kbd}>{shortcutLabel}</kbd>
      </button>

      <div className={styles.filters}>
        <button type="button" className={styles.filterChip} aria-haspopup="listbox">
          <span className={styles.filterLabel}>Période</span>
          <span className={styles.filterValue}>30 derniers jours</span>
          <Icon name="chevron-down" size={14} />
        </button>
        <button type="button" className={styles.filterChip} aria-haspopup="listbox">
          <span className={styles.filterLabel}>Activité</span>
          <span className={styles.filterValue}>Toutes</span>
          <Icon name="chevron-down" size={14} />
        </button>
      </div>

      <div className={styles.right}>
        <button type="button" className={styles.iconBtn} aria-label="Notifications">
          <Icon name="bell" size={18} />
          <span className={styles.dot} aria-hidden="true" />
        </button>

        <button type="button" className={styles.viewSwitcher} aria-haspopup="menu">
          <span className={styles.viewLabel}>Vue ·</span>
          <span className={styles.viewRole}>Super Admin</span>
          <Icon name="chevron-down" size={14} />
        </button>

        <button type="button" className={styles.userMenu} aria-haspopup="menu" aria-label="Menu utilisateur">
          <span className={styles.avatar} aria-hidden="true">AK</span>
        </button>
      </div>
    </header>
  );
}
